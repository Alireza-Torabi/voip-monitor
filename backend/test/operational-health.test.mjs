import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateOperationalHealth } from '@voip-monitor/shared';

function healthyInput() {
  return {
    instanceId: 'synthetic-pbx',
    providerState: 'CONNECTED',
    telephony: {
      synchronization: 'CURRENT',
      trunkCapability: 'SUPPORTED',
      trunkSynchronization: 'CURRENT',
      trunks: [{ registrationState: 'REGISTERED', reachability: 'REACHABLE' }],
      endpointCapability: 'SUPPORTED',
      endpointSynchronization: 'CURRENT',
      endpoints: [{ reachability: 'REACHABLE' }, { reachability: 'REACHABLE' }],
      queueCapability: 'SUPPORTED',
      queueSynchronization: 'CURRENT',
      queues: [{ waitingCount: 0 }],
    },
    system: {
      freshness: 'CURRENT',
      cpuPercent: 12,
      memoryPercent: 28,
      maxFilesystemPercent: 41,
      services: [{ state: 'ACTIVE' }],
    },
    security: { currentAlertCount: 0 },
  };
}

test('unified health stays healthy when monitored dimensions are healthy and future capability is unknown', () => {
  const result = evaluateOperationalHealth(healthyInput());
  assert.equal(result.overall, 'HEALTHY');
  assert.equal(result.components.PROVIDER.state, 'HEALTHY');
  assert.equal(result.components.TELEPHONY.state, 'HEALTHY');
  assert.equal(result.components.TRUNKS.state, 'HEALTHY');
  assert.equal(result.components.ENDPOINTS.state, 'HEALTHY');
  assert.equal(result.components.QUEUES.state, 'HEALTHY');
  assert.equal(result.components.SYSTEM.state, 'HEALTHY');
  assert.equal(result.components.SECURITY.state, 'HEALTHY');
  assert.equal(result.components.CALL_QUALITY.state, 'UNKNOWN');
});

test('critical health outranks stale and degraded components', () => {
  const input = healthyInput();
  input.telephony.trunks = [{ registrationState: 'UNREGISTERED', reachability: 'UNREACHABLE' }];
  input.telephony.endpoints = [{ reachability: 'UNREACHABLE' }, { reachability: 'REACHABLE' }];
  input.telephony.queues = [{ waitingCount: 4 }];
  input.system.freshness = 'STALE';
  const result = evaluateOperationalHealth(input);
  assert.equal(result.overall, 'CRITICAL');
  assert.equal(result.components.TRUNKS.state, 'CRITICAL');
  assert.equal(result.components.ENDPOINTS.state, 'HEALTHY');
  assert.equal(result.components.QUEUES.state, 'DEGRADED');
  assert.equal(result.components.SYSTEM.state, 'STALE');
});

test('unreachable endpoints are availability statistics and do not degrade operational health', () => {
  const input = healthyInput();
  input.telephony.endpoints = [{ reachability: 'UNREACHABLE' }, { reachability: 'UNREACHABLE' }];
  const result = evaluateOperationalHealth(input);
  assert.equal(result.components.ENDPOINTS.state, 'HEALTHY');
  assert.deepEqual(result.components.ENDPOINTS.reasons, []);
  assert.equal(result.overall, 'HEALTHY');
});

test('stale health outranks degraded when no component is critical', () => {
  const input = healthyInput();
  input.telephony.synchronization = 'STALE';
  input.telephony.queues = [{ waitingCount: 1 }];
  const result = evaluateOperationalHealth(input);
  assert.equal(result.overall, 'STALE');
  assert.equal(result.components.TELEPHONY.state, 'STALE');
  assert.equal(result.components.QUEUES.state, 'DEGRADED');
});

test('system thresholds and security alerts are bounded deterministic reasons', () => {
  const input = healthyInput();
  input.system.cpuPercent = 96;
  input.system.memoryPercent = 92;
  input.security.currentAlertCount = 2;
  const result = evaluateOperationalHealth(input);
  assert.equal(result.overall, 'CRITICAL');
  assert.equal(result.components.SYSTEM.state, 'CRITICAL');
  assert.deepEqual(
    result.components.SYSTEM.reasons.map((reason) => reason.code),
    ['SYSTEM_CPU_CRITICAL', 'SYSTEM_MEMORY_HIGH'],
  );
  assert.deepEqual(result.components.SECURITY.reasons, [
    { code: 'SECURITY_ALERT_ACTIVE', count: 2 },
  ]);
});
