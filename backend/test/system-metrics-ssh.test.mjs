import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectSystemMetrics,
  computeCpuUtilizationPercent,
  parseDfPosix,
  parseProcMeminfo,
  parseProcStatCpu,
  parseProcUptime,
  parseSystemctlServiceStates,
  resolveRestrictedSshCommand,
  RestrictedSshSystemMetricsCollector,
  RestrictedSshTransportError,
  runRestrictedSshCommand,
  SystemMetricsCollectorError,
  SystemMetricsParseError,
} from '../dist/collectors/system/index.js';

class SyntheticSshTransport {
  calls = [];
  queues = new Map();

  queue(commandId, result) {
    const items = this.queues.get(commandId) ?? [];
    items.push(result);
    this.queues.set(commandId, items);
    return this;
  }

  async execute(command, limits) {
    this.calls.push({
      id: command.id,
      program: command.program,
      args: [...command.args],
      limits: { ...limits },
    });
    const items = this.queues.get(command.id) ?? [];
    if (items.length === 0) throw new Error('synthetic missing response');
    const result = items.shift();
    if (result instanceof Error) throw result;
    if (typeof result === 'function') return result(command, limits);
    return result;
  }
}

function success(stdout, stderr = '') {
  return { exitCode: 0, stdout, stderr };
}

function fullTransport() {
  return new SyntheticSshTransport()
    .queue('CPU_STAT', success('cpu 100 0 50 850 0 0 0 0 0 0\n'))
    .queue('CPU_STAT', success('cpu 150 0 70 880 0 0 0 0 0 0\n'))
    .queue(
      'MEMINFO',
      success('MemTotal:        8192 kB\nMemFree:         1024 kB\nMemAvailable:    4096 kB\n'),
    )
    .queue(
      'FILESYSTEMS',
      success(
        'Source 1-blocks Used Available Capacity Mounted on\n/dev/sda1 100000 40000 60000 40% /\ntmpfs 20000 1000 19000 5% /run\n',
      ),
    )
    .queue('UPTIME', success('86400.75 12345.00\n'))
    .queue(
      'SERVICE_STATUS',
      success(
        'Id=synthetic-helper.service\nActiveState=inactive\n\nId=synthetic-telephony.service\nActiveState=active\n',
      ),
    );
}

test('restricted SSH command resolver exposes only the fixed read-only allowlist', () => {
  assert.deepEqual(resolveRestrictedSshCommand({ id: 'CPU_STAT' }), {
    id: 'CPU_STAT',
    program: 'cat',
    args: ['/proc/stat'],
  });
  assert.deepEqual(
    resolveRestrictedSshCommand({
      id: 'SERVICE_STATUS',
      serviceIds: ['synthetic-telephony.service', 'synthetic-helper.service'],
    }),
    {
      id: 'SERVICE_STATUS',
      program: 'systemctl',
      args: [
        'show',
        '--no-pager',
        '--property=Id',
        '--property=ActiveState',
        '--',
        'synthetic-telephony.service',
        'synthetic-helper.service',
      ],
    },
  );

  assert.throws(
    () =>
      resolveRestrictedSshCommand({
        id: 'SERVICE_STATUS',
        serviceIds: ['synthetic.service;touch-/tmp/nope'],
      }),
    (error) => error instanceof RestrictedSshTransportError && error.code === 'INVALID_COMMAND',
  );
});

test('restricted SSH collector rejects invalid service identifiers before any transport call', () => {
  const transport = new SyntheticSshTransport();
  assert.throws(
    () =>
      new RestrictedSshSystemMetricsCollector({
        transport,
        serviceIds: ['synthetic.service;touch-/tmp/nope'],
      }),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );
  assert.deepEqual(transport.calls, []);
});

test('restricted SSH execution enforces output and timeout limits without exposing raw output', async () => {
  const oversized = new SyntheticSshTransport().queue('UPTIME', success('x'.repeat(101)));
  await assert.rejects(
    () =>
      runRestrictedSshCommand(oversized, { id: 'UPTIME' }, { timeoutMs: 100, maxOutputBytes: 100 }),
    (error) => error instanceof RestrictedSshTransportError && error.code === 'OUTPUT_LIMIT',
  );

  const hanging = {
    async execute() {
      return await new Promise(() => {});
    },
  };
  await assert.rejects(
    () =>
      runRestrictedSshCommand(hanging, { id: 'UPTIME' }, { timeoutMs: 5, maxOutputBytes: 1024 }),
    (error) => error instanceof RestrictedSshTransportError && error.code === 'TIMEOUT',
  );
});

test('system metric parsers normalize proc, df, uptime, and service output', () => {
  const previous = parseProcStatCpu('cpu 100 0 50 850 0 0 0 0 20 0\n');
  const current = parseProcStatCpu('cpu 150 0 70 880 0 0 0 0 40 0\n');
  assert.equal(computeCpuUtilizationPercent(previous, current), 70);

  assert.deepEqual(
    parseProcMeminfo('MemTotal: 8192 kB\nMemAvailable: 4096 kB\nCached: 1000 kB\n'),
    {
      totalBytes: 8_388_608,
      availableBytes: 4_194_304,
    },
  );

  assert.deepEqual(
    parseDfPosix(
      'Source 1-blocks Used Available Capacity Mounted on\n/dev/sda1 100000 40000 60000 40% /\ntmpfs 20000 1000 19000 5% /run\n',
    ),
    [
      { filesystemId: '/', mountPoint: '/', totalBytes: 100000, availableBytes: 60000 },
      { filesystemId: '/run', mountPoint: '/run', totalBytes: 20000, availableBytes: 19000 },
    ],
  );

  assert.deepEqual(parseProcUptime('86400.75 12345.00\n'), { uptimeSeconds: 86400 });
  assert.deepEqual(
    parseSystemctlServiceStates(
      'Id=synthetic-helper.service\nActiveState=inactive\n\nId=synthetic-telephony.service\nActiveState=active\n',
      ['synthetic-telephony.service', 'synthetic-helper.service'],
    ),
    [
      { serviceId: 'synthetic-helper.service', state: 'INACTIVE' },
      { serviceId: 'synthetic-telephony.service', state: 'ACTIVE' },
    ],
  );
});

test('system metric parsers fail closed on malformed or inconsistent output', () => {
  assert.throws(
    () => parseProcMeminfo('MemTotal: 8192 kB\n'),
    (error) => error instanceof SystemMetricsParseError && error.code === 'INVALID_OUTPUT',
  );
  assert.throws(
    () =>
      parseDfPosix(
        'Filesystem 1-blocks Used Available Capacity Mounted on\n/dev/sda1 100 10 200 10% /\n',
      ),
    (error) => error instanceof SystemMetricsParseError && error.code === 'INVALID_OUTPUT',
  );
  assert.throws(
    () =>
      parseSystemctlServiceStates('Id=unexpected.service\nActiveState=active\n', [
        'synthetic-telephony.service',
      ]),
    (error) => error instanceof SystemMetricsParseError && error.code === 'INVALID_OUTPUT',
  );
});

test('restricted SSH collector builds a complete provider-neutral sample from synthetic command output', async () => {
  const transport = fullTransport();
  const collector = new RestrictedSshSystemMetricsCollector({
    transport,
    serviceIds: ['synthetic-telephony.service', 'synthetic-helper.service'],
    cpuSampleIntervalMs: 0,
    sleep: async () => {},
    now: () => '2026-09-25T15:00:00.000Z',
  });

  const sample = await collectSystemMetrics(collector, 'pbx-1');

  assert.equal(sample.cpu.utilizationPercent, 70);
  assert.deepEqual(sample.memory, {
    totalBytes: 8_388_608,
    availableBytes: 4_194_304,
  });
  assert.equal(sample.filesystems.length, 2);
  assert.deepEqual(sample.uptime, { uptimeSeconds: 86400 });
  assert.deepEqual(sample.services, [
    { serviceId: 'synthetic-helper.service', state: 'INACTIVE' },
    { serviceId: 'synthetic-telephony.service', state: 'ACTIVE' },
  ]);
  assert.deepEqual(sample.capabilities, {
    cpu: 'SUPPORTED',
    memory: 'SUPPORTED',
    filesystems: 'SUPPORTED',
    uptime: 'SUPPORTED',
    services: 'SUPPORTED',
  });
  assert.deepEqual(
    transport.calls.map((call) => call.id),
    ['CPU_STAT', 'CPU_STAT', 'MEMINFO', 'FILESYSTEMS', 'UPTIME', 'SERVICE_STATUS'],
  );
  assert.ok(transport.calls.every((call) => call.program !== 'sh' && call.program !== 'bash'));
});

test('restricted SSH collector preserves per-dimension permission/support capability without false zeroes', async () => {
  const transport = new SyntheticSshTransport()
    .queue('CPU_STAT', success('cpu 100 0 50 850 0 0 0 0 0 0\n'))
    .queue('CPU_STAT', success('cpu 150 0 70 880 0 0 0 0 0 0\n'))
    .queue('MEMINFO', success('MemTotal: 8192 kB\nMemAvailable: 4096 kB\n'))
    .queue('FILESYSTEMS', new RestrictedSshTransportError('PERMISSION_DENIED'))
    .queue('UPTIME', success('100.00 1.00\n'))
    .queue('SERVICE_STATUS', new RestrictedSshTransportError('UNSUPPORTED'));

  const collector = new RestrictedSshSystemMetricsCollector({
    transport,
    serviceIds: ['synthetic-telephony.service'],
    cpuSampleIntervalMs: 0,
    sleep: async () => {},
    now: () => '2026-09-25T15:00:00.000Z',
  });

  const sample = await collectSystemMetrics(collector, 'pbx-1');
  assert.equal(sample.capabilities.filesystems, 'PERMISSION_DENIED');
  assert.equal(sample.capabilities.services, 'UNSUPPORTED');
  assert.equal(sample.filesystems, undefined);
  assert.equal(sample.services, undefined);
  assert.equal(sample.memory.availableBytes, 4_194_304);
});

test('restricted SSH collector does not execute a service command when services are not configured', async () => {
  const transport = fullTransport();
  const collector = new RestrictedSshSystemMetricsCollector({
    transport,
    cpuSampleIntervalMs: 0,
    sleep: async () => {},
    now: () => '2026-09-25T15:00:00.000Z',
  });

  const sample = await collectSystemMetrics(collector, 'pbx-1');
  assert.equal(sample.capabilities.services, 'NOT_CONFIGURED');
  assert.equal(sample.services, undefined);
  assert.ok(!transport.calls.some((call) => call.id === 'SERVICE_STATUS'));
});

test('restricted SSH collector converts parser and unknown transport failures to bounded errors', async () => {
  const malformed = fullTransport();
  malformed.queues.set('MEMINFO', [success('MemTotal: 8192 kB\n')]);
  const malformedCollector = new RestrictedSshSystemMetricsCollector({
    transport: malformed,
    cpuSampleIntervalMs: 0,
    sleep: async () => {},
    now: () => '2026-09-25T15:00:00.000Z',
  });

  await assert.rejects(
    () => collectSystemMetrics(malformedCollector, 'pbx-1'),
    (error) => error instanceof SystemMetricsCollectorError && error.code === 'INVALID_SAMPLE',
  );

  const broken = fullTransport();
  broken.queues.set('UPTIME', [new Error('synthetic-private-host-output')]);
  const brokenCollector = new RestrictedSshSystemMetricsCollector({
    transport: broken,
    cpuSampleIntervalMs: 0,
    sleep: async () => {},
    now: () => '2026-09-25T15:00:00.000Z',
  });

  await assert.rejects(
    () => collectSystemMetrics(brokenCollector, 'pbx-1'),
    (error) => {
      assert.ok(error instanceof SystemMetricsCollectorError);
      assert.equal(error.code, 'COLLECTION_FAILED');
      assert.ok(!error.message.includes('synthetic-private-host-output'));
      return true;
    },
  );
});
