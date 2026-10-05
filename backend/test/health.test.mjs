import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp, writeSseChunk } from '../dist/server.js';

test('GET /health returns a JSON health response', async () => {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('SSE writer destroys a slow response before buffered output can grow without bound', () => {
  const response = {
    destroyed: false,
    writableEnded: false,
    writableLength: 0,
    chunks: [],
    write(chunk) {
      this.chunks.push(chunk);
      this.writableLength += 300 * 1024;
      return false;
    },
    destroy() {
      this.destroyed = true;
    },
  };

  assert.equal(writeSseChunk(response, 'event: synthetic\ndata: {}\n\n'), false);
  assert.equal(response.destroyed, true);
  assert.equal(response.chunks.length, 1);
});
