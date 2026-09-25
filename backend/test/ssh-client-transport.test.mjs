import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import ssh2 from 'ssh2';
const { Server, utils } = ssh2;
import { Ssh2RestrictedSshTransport } from '../dist/collectors/system/ssh-client-transport.js';
import {
  RestrictedSshTransportError,
  resolveRestrictedSshCommand,
} from '../dist/collectors/system/ssh-transport.js';

const PBX_ID = 'synthetic-pbx';
const USERNAME = 'monitor';
const PASSWORD = 'synthetic-password';

function fingerprint(privateKey) {
  const parsed = utils.parseKey(privateKey);
  assert.ok(!(parsed instanceof Error));
  const publicBlob = parsed.getPublicSSH();
  return `SHA256:${createHash('sha256').update(publicBlob).digest('base64').replace(/=+$/u, '')}`;
}

async function createServer(handler) {
  const hostKey = readFileSync(
    new URL('../../node_modules/ssh2/test/fixtures/ssh_host_rsa_key', import.meta.url),
  );
  const hostFingerprint = fingerprint(hostKey);

  const connections = new Set();
  const server = new Server({ hostKeys: [hostKey] });
  server.on('connection', (connection) => {
    connections.add(connection);
    connection.once('close', () => connections.delete(connection));
    connection.on('error', () => {});
    connection.on('authentication', (context) => {
      if (
        context.method === 'password' &&
        context.username === USERNAME &&
        context.password === PASSWORD
      ) {
        context.accept();
      } else {
        context.reject();
      }
    });

    connection.on('ready', () => {
      connection.on('session', (accept) => {
        const session = accept();
        session.on('exec', (acceptChannel, rejectChannel, info) => {
          handler(acceptChannel, rejectChannel, info.command);
        });
      });
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    server,
    port: address.port,
    hostFingerprint,
    connections,
  };
}

function options(port, hostFingerprint, overrides = {}) {
  return {
    pbxInstanceId: PBX_ID,
    configuration: {
      get() {
        return {
          pbxInstanceId: PBX_ID,
          host: 'synthetic.invalid',
          port,
          username: USERNAME,
          authMethod: 'PASSWORD',
          hostKeyPolicy: 'PINNED_SHA256',
          hostKeyFingerprint: hostFingerprint,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          hasCredential: true,
          hasPrivateKeyPassphrase: false,
        };
      },
    },
    secrets: {
      getSecret(_instanceId, name) {
        if (name === 'ssh-password') return Buffer.from(PASSWORD);
        return undefined;
      },
    },
    resolveAddresses: async () => ['127.0.0.1'],
    validateAddresses: (_host, addresses) => addresses,
    ...overrides,
  };
}

function limits(timeoutMs = 2_000, maxOutputBytes = 64 * 1024) {
  return { timeoutMs, maxOutputBytes };
}

async function stopServer(fixture) {
  for (const connection of fixture.connections) connection.end();
  fixture.server.closeAllConnections?.();
  await new Promise((resolve) => fixture.server.close(resolve));
}

test('restricted SSH transport executes a synthetic loopback command with pinned host key', async () => {
  const seen = [];
  const fixture = await createServer((accept, _reject, command) => {
    seen.push(command);
    const channel = accept();
    channel.write('1.25 0.50 0.25\n');
    channel.exit(0);
    channel.end();
  });

  try {
    const transport = new Ssh2RestrictedSshTransport(
      options(fixture.port, fixture.hostFingerprint),
    );
    const result = await transport.execute(resolveRestrictedSshCommand({ id: 'UPTIME' }), limits());

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '1.25 0.50 0.25\n');
    assert.deepEqual(seen, ["'cat' '/proc/uptime'"]);
  } finally {
    await stopServer(fixture);
  }
});

test('restricted SSH transport rejects a mismatched pinned host key', async () => {
  const fixture = await createServer((accept) => {
    const channel = accept();
    channel.end();
  });

  try {
    const transport = new Ssh2RestrictedSshTransport(
      options(fixture.port, 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    );

    await assert.rejects(
      transport.execute(resolveRestrictedSshCommand({ id: 'UPTIME' }), limits()),
      (error) => error instanceof RestrictedSshTransportError && error.code === 'CONNECTION_FAILED',
    );
  } finally {
    await stopServer(fixture);
  }
});

test('restricted SSH transport performs one injected resolution and rejects unsafe targets by default', async () => {
  let resolutions = 0;
  const transport = new Ssh2RestrictedSshTransport({
    ...options(22, 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    resolveAddresses: async () => {
      resolutions += 1;
      return ['127.0.0.1'];
    },
    validateAddresses: undefined,
  });

  await assert.rejects(
    transport.execute(resolveRestrictedSshCommand({ id: 'UPTIME' }), limits()),
    (error) => error instanceof Error && /Network target rejected: LOOPBACK/u.test(error.message),
  );
  assert.equal(resolutions, 1);
});

test('restricted SSH transport stops streaming when the output limit is exceeded', async () => {
  const fixture = await createServer((accept) => {
    const channel = accept();
    const chunk = Buffer.alloc(4096, 'x');
    for (let index = 0; index < 16; index += 1) {
      channel.write(chunk);
    }
    channel.end();
  });

  try {
    const transport = new Ssh2RestrictedSshTransport(
      options(fixture.port, fixture.hostFingerprint),
    );

    await assert.rejects(
      transport.execute(resolveRestrictedSshCommand({ id: 'MEMINFO' }), limits(2_000, 8 * 1024)),
      (error) => error instanceof RestrictedSshTransportError && error.code === 'OUTPUT_LIMIT',
    );
  } finally {
    await stopServer(fixture);
  }
});

test('restricted SSH transport enforces a wall-clock command timeout', async () => {
  const fixture = await createServer((accept) => {
    const channel = accept();
    channel.write('waiting\n');
  });

  try {
    const transport = new Ssh2RestrictedSshTransport(
      options(fixture.port, fixture.hostFingerprint),
    );

    await assert.rejects(
      transport.execute(resolveRestrictedSshCommand({ id: 'UPTIME' }), limits(100, 64 * 1024)),
      (error) => error instanceof RestrictedSshTransportError && error.code === 'TIMEOUT',
    );
  } finally {
    await stopServer(fixture);
  }
});
