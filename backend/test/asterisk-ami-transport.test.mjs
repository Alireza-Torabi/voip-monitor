import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import {
  AmiTransportError,
  AsteriskProvider,
  MockAmiTransport,
  TcpAmiTransport,
} from '../dist/providers/asterisk/index.js';

function parseHeaders(raw) {
  return Object.fromEntries(
    raw.split('\r\n').map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator), line.slice(separator + 1).trimStart()];
    }),
  );
}

async function syntheticAmi(handler, run) {
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('Asterisk Call Manager/2.10.4\r\n');
    let buffer = '';
    socket.on('data', async (chunk) => {
      buffer += chunk;
      while (true) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 4);
        await handler(parseHeaders(raw), socket);
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(address.port);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('TCP AMI transport parses banner, ignores events, and correlates a synthetic response', async () => {
  await syntheticAmi(
    async (action, socket) => {
      assert.equal(action.Action, 'Ping');
      assert.match(action.ActionID, /^vm-[0-9]+$/);
      socket.write(
        'Event: FullyBooted\r\nStatus: Fully Booted\r\n\r\n' +
          `Response: Success\r\nActionID: ${action.ActionID}\r\nPing: Pong\r\n\r\n`,
      );
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      assert.equal(transport.banner, 'Asterisk Call Manager/2.10.4');
      const response = await transport.request({ action: 'Ping' });
      assert.equal(response.response, 'Success');
      assert.equal(response.fields.Ping, 'Pong');
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport rejects header injection before sending an action', async () => {
  let received = 0;
  await syntheticAmi(
    async () => {
      received += 1;
    },
    async (port) => {
      const transport = new TcpAmiTransport(1000);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      await assert.rejects(
        transport.request({
          action: 'Login',
          fields: { Username: 'admin\r\nAction: Logoff' },
        }),
        (error) => error instanceof AmiTransportError && error.code === 'INVALID_ACTION',
      );
      assert.equal(received, 0);
      await transport.disconnect();
    },
  );
});

test('TCP AMI transport times out a synthetic action without leaking protocol details', async () => {
  await syntheticAmi(
    async () => undefined,
    async (port) => {
      const transport = new TcpAmiTransport(40);
      await transport.connect({ host: 'synthetic.test', address: '127.0.0.1', port });
      await assert.rejects(
        transport.request({ action: 'Ping' }),
        (error) => error instanceof AmiTransportError && error.code === 'TIMEOUT',
      );
      await transport.disconnect();
    },
  );
});

test('Asterisk provider logs in, discovers version, reconciles, and wipes password buffer', async () => {
  const transport = new MockAmiTransport();
  let suppliedPassword;
  transport
    .on('Login', (action) => {
      assert.equal(action.fields?.Username, 'synthetic-admin');
      assert.equal(action.fields?.Secret, 'synthetic-ami-secret');
      assert.equal(action.fields?.Events, 'off');
      return { response: 'Success', message: 'Authentication accepted', fields: {} };
    })
    .on('CoreSettings', () => ({
      response: 'Success',
      fields: { AsteriskVersion: '13.20.0', AMIversion: '2.10.4' },
    }))
    .on('Ping', () => ({ response: 'Success', fields: { Ping: 'Pong' } }))
    .on('Logoff', () => ({ response: 'Goodbye', fields: {} }));

  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: 'pbx.example.test',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => {
      suppliedPassword = Buffer.from('synthetic-ami-secret');
      return suppliedPassword;
    },
    resolver: {
      async resolve() {
        return ['192.0.2.20'];
      },
    },
    transport,
  });

  await provider.connect();
  assert.ok(suppliedPassword.every((byte) => byte === 0));
  assert.equal(transport.actions[0].fields?.Secret, '<redacted>');
  assert.equal((await provider.getHealth()).connection.state, 'CONNECTED');

  const discovery = await provider.discover();
  assert.deepEqual(discovery.metadata, {
    id: 'synthetic-pbx',
    providerType: 'ASTERISK',
    displayName: 'Synthetic PBX',
    product: 'Asterisk',
    version: '13.20.0',
  });
  assert.equal(discovery.capabilities.telephony.channels, 'UNKNOWN');

  await provider.reconcile();
  assert.equal((await provider.getHealth()).sources.AMI.freshness, 'CURRENT');
  await provider.disconnect();
  const disconnected = await provider.getHealth();
  assert.equal(disconnected.connection.state, 'DISCONNECTED');
  assert.equal(disconnected.sources.AMI.freshness, 'UNAVAILABLE');
});

test('Asterisk provider maps rejected login to safe authentication failure health', async () => {
  const transport = new MockAmiTransport().on('Login', () => ({
    response: 'Error',
    message: 'Authentication failed',
    fields: {},
  }));
  const provider = new AsteriskProvider({
    instanceId: 'synthetic-pbx',
    displayName: 'Synthetic PBX',
    host: '192.0.2.21',
    port: 5038,
    amiUsername: 'synthetic-admin',
    readAmiPassword: () => Buffer.from('synthetic-wrong-secret'),
    resolver: {
      async resolve() {
        throw new Error('resolver must not run for an IP literal');
      },
    },
    transport,
  });

  await assert.rejects(provider.connect(), (error) => error.code === 'AUTHENTICATION_FAILED');
  const health = await provider.getHealth();
  assert.equal(health.connection.state, 'ERROR');
  assert.equal(health.sources.AMI.freshness, 'ERROR');
  assert.equal(health.sources.AMI.error.code, 'AUTHENTICATION_FAILED');
  assert.equal(transport.connected, false);
});
