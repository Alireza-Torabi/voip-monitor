import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AsteriskConnection,
  MockAmiTransport,
  NetworkBoundaryError,
  classifyAddress,
  validateResolvedTarget,
} from '../dist/providers/asterisk/index.js';

test('network policy allows private infrastructure addresses and documentation ranges', () => {
  for (const address of ['10.0.0.10', '172.16.1.20', '192.168.1.30', '2001:db8::10', 'fc00::10']) {
    assert.equal(classifyAddress(address).allowed, true, address);
  }
});

test('network policy blocks loopback, link-local, metadata, multicast and unspecified targets', () => {
  const blocked = [
    ['127.0.0.1', 'LOOPBACK'],
    ['::1', 'LOOPBACK'],
    ['169.254.169.254', 'LINK_LOCAL'],
    ['169.254.10.20', 'LINK_LOCAL'],
    ['fe80::1', 'LINK_LOCAL'],
    ['fd00:ec2::254', 'METADATA_SERVICE'],
    ['224.0.0.1', 'MULTICAST'],
    ['ff02::1', 'MULTICAST'],
    ['0.0.0.0', 'UNSPECIFIED'],
    ['::', 'UNSPECIFIED'],
    ['::ffff:127.0.0.1', 'LOOPBACK'],
  ];
  for (const [address, reason] of blocked) {
    assert.deepEqual(classifyAddress(address), { allowed: false, reason }, address);
  }
});

test('hostname targets require pre-resolved addresses and reject any unsafe DNS answer', () => {
  assert.throws(
    () => validateResolvedTarget('pbx.example.test', []),
    (error) => {
      assert.equal(error instanceof NetworkBoundaryError, true);
      assert.equal(error.reason, 'RESOLUTION_REQUIRED');
      return true;
    },
  );
  assert.throws(
    () => validateResolvedTarget('pbx.example.test', ['192.0.2.10', '127.0.0.1']),
    (error) => {
      assert.equal(error instanceof NetworkBoundaryError, true);
      assert.equal(error.reason, 'LOOPBACK');
      return true;
    },
  );
  assert.deepEqual(validateResolvedTarget('pbx.example.test', ['192.0.2.10']), ['192.0.2.10']);
});

test('literal addresses do not depend on resolver results', () => {
  assert.deepEqual(validateResolvedTarget('192.0.2.20', ['127.0.0.1']), ['192.0.2.20']);
});

test('Asterisk connection uses one injected resolution and the approved address', async () => {
  let calls = 0;
  const resolver = {
    async resolve(host) {
      calls += 1;
      assert.equal(host, 'pbx.example.test');
      return ['192.0.2.55'];
    },
  };
  const transport = new MockAmiTransport();
  const connection = new AsteriskConnection(resolver, transport);

  await connection.connect({ host: 'pbx.example.test', port: 5038 });
  assert.equal(calls, 1);
  assert.deepEqual(transport.connections, [
    { host: 'pbx.example.test', address: '192.0.2.55', port: 5038 },
  ]);
  assert.equal(transport.connected, true);

  transport.on('Ping', () => ({ response: 'Success', fields: { Ping: 'Pong' } }));
  const response = await transport.request({ action: 'Ping' });
  assert.equal(response.response, 'Success');
  assert.deepEqual(response.fields, { Ping: 'Pong' });
  assert.deepEqual(transport.actions, [{ action: 'Ping' }]);

  await connection.disconnect();
  assert.equal(transport.connected, false);
});

test('blocked resolved target never reaches transport', async () => {
  const resolver = {
    async resolve() {
      return ['169.254.169.254'];
    },
  };
  const transport = new MockAmiTransport();
  const connection = new AsteriskConnection(resolver, transport);

  await assert.rejects(connection.connect({ host: 'pbx.example.test', port: 5038 }), (error) => {
    assert.equal(error instanceof NetworkBoundaryError, true);
    assert.equal(error.reason, 'LINK_LOCAL');
    return true;
  });
  assert.equal(transport.connections.length, 0);
  assert.equal(transport.connected, false);
});
