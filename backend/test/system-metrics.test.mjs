import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectSystemMetrics,
  SystemMetricsCollectorError,
  validateSystemMetricsSample,
} from '../dist/collectors/system/index.js';

function validSample(overrides = {}) {
  return {
    instanceId: 'pbx-1',
    source: 'SSH',
    observedAt: '2026-09-25T14:30:00.000Z',
    capabilities: {
      cpu: 'SUPPORTED',
      memory: 'SUPPORTED',
      filesystems: 'SUPPORTED',
      uptime: 'SUPPORTED',
      services: 'SUPPORTED',
    },
    cpu: { utilizationPercent: 37.5 },
    memory: {
      totalBytes: 8_589_934_592,
      availableBytes: 3_221_225_472,
    },
    filesystems: [
      {
        filesystemId: 'synthetic-root',
        mountPoint: '/',
        totalBytes: 107_374_182_400,
        availableBytes: 53_687_091_200,
      },
    ],
    uptime: { uptimeSeconds: 86_400 },
    services: [
      { serviceId: 'synthetic-telephony', state: 'ACTIVE' },
      { serviceId: 'synthetic-helper', state: 'INACTIVE' },
    ],
    ...overrides,
  };
}

class SyntheticCollector {
  source = 'SSH';

  constructor(sample = validSample()) {
    this.sample = sample;
  }

  async collect() {
    return this.sample;
  }
}

test('system metrics collector accepts a complete provider-neutral synthetic sample and clones it', async () => {
  const source = validSample();
  const result = await collectSystemMetrics(new SyntheticCollector(source), 'pbx-1');

  assert.deepEqual(result, source);
  assert.notEqual(result, source);
  assert.notEqual(result.memory, source.memory);
  assert.notEqual(result.filesystems, source.filesystems);
  assert.notEqual(result.services, source.services);

  source.memory.availableBytes = 1;
  source.filesystems[0].availableBytes = 1;
  source.services[0].state = 'FAILED';

  assert.equal(result.memory.availableBytes, 3_221_225_472);
  assert.equal(result.filesystems[0].availableBytes, 53_687_091_200);
  assert.equal(result.services[0].state, 'ACTIVE');
});

test('system metrics sample preserves unavailable dimensions as missing rather than zero', async () => {
  const sample = validSample({
    capabilities: {
      cpu: 'SUPPORTED',
      memory: 'PERMISSION_DENIED',
      filesystems: 'NOT_CONFIGURED',
      uptime: 'SUPPORTED',
      services: 'UNSUPPORTED',
    },
    memory: undefined,
    filesystems: undefined,
    services: undefined,
  });
  const result = await collectSystemMetrics(new SyntheticCollector(sample), 'pbx-1');

  assert.equal(result.cpu.utilizationPercent, 37.5);
  assert.equal(result.uptime.uptimeSeconds, 86_400);
  assert.equal('memory' in result && result.memory !== undefined, false);
  assert.equal('filesystems' in result && result.filesystems !== undefined, false);
  assert.equal('services' in result && result.services !== undefined, false);
});

test('system metrics validator rejects contradictory capability/data and unsafe numeric samples', () => {
  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({
          capabilities: {
            cpu: 'UNSUPPORTED',
            memory: 'SUPPORTED',
            filesystems: 'SUPPORTED',
            uptime: 'SUPPORTED',
            services: 'SUPPORTED',
          },
        }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({ cpu: { utilizationPercent: 101 } }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({
          memory: { totalBytes: 1024, availableBytes: 2048 },
        }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );
});

test('system metrics validator rejects missing required capability keys and malformed optional collections', () => {
  const missingCapability = validSample();
  delete missingCapability.capabilities.services;
  delete missingCapability.services;

  assert.throws(
    () => validateSystemMetricsSample('pbx-1', 'SSH', missingCapability),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({
          filesystems: null,
        }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () => validateSystemMetricsSample('pbx-1', 'SSH', null),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({
          filesystems: [null],
        }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );
});

test('system metrics validator rejects mismatched identity, duplicate resources, and invalid timestamps', () => {
  assert.throws(
    () => validateSystemMetricsSample('pbx-2', 'SSH', validSample()),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({
          filesystems: [
            {
              filesystemId: 'duplicate',
              mountPoint: '/',
              totalBytes: 100,
              availableBytes: 50,
            },
            {
              filesystemId: 'duplicate',
              mountPoint: '/var',
              totalBytes: 100,
              availableBytes: 25,
            },
          ],
        }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  assert.throws(
    () =>
      validateSystemMetricsSample(
        'pbx-1',
        'SSH',
        validSample({
          observedAt: 'not-a-timestamp',
        }),
      ),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );
});

test('system metrics collector converts unknown collection failures to a bounded safe error', async () => {
  const collector = {
    source: 'SSH',
    async collect() {
      throw new Error('synthetic-private-host-and-command-output');
    },
  };

  await assert.rejects(
    () => collectSystemMetrics(collector, 'pbx-1'),
    (error) => {
      assert.ok(error instanceof SystemMetricsCollectorError);
      assert.equal(error.code, 'COLLECTION_FAILED');
      assert.ok(!error.message.includes('synthetic-private-host-and-command-output'));
      return true;
    },
  );
});
