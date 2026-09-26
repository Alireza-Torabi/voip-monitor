import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadAppConfig } from '../dist/config.js';
import { SqliteStorage } from '../dist/storage/index.js';
import { SecurityAlertRuntime } from '../dist/security/runtime.js';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-alert-runtime-'));
  try {
    const storage = await SqliteStorage.open(loadAppConfig({ DATA_PATH: directory }));
    try {
      storage.pbxInstances.save({
        id: 'runtime-pbx',
        providerType: 'ASTERISK',
        displayName: 'Runtime',
      });
      await run(storage);
    } finally {
      storage.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

class FakeSecuritySource {
  listener;
  subscribeSecurityEvents(listener) {
    this.listener = listener;
    return () => {
      delete this.listener;
    };
  }
  emit(event) {
    this.listener?.(event);
  }
}

test('security alert runtime persists events, evaluates configured enabled rules, and persists matches', () =>
  fixture(async (storage) => {
    storage.securityAlertRules.put({
      instanceId: 'runtime-pbx',
      id: 'AUTHENTICATION_FAILURE_ANY',
      enabled: true,
    });
    storage.securityAlertRules.put({
      instanceId: 'runtime-pbx',
      id: 'AUTHENTICATION_FAILURE_THRESHOLD',
      enabled: true,
      threshold: 2,
      windowSeconds: 60,
      reason: 'INVALID_PASSWORD',
    });
    const source = new FakeSecuritySource();
    const runtime = new SecurityAlertRuntime(storage, source, () => '2026-09-26T09:00:00.000Z');
    runtime.start();
    const event = (observedAt, streamSequence, reason = 'INVALID_PASSWORD') => ({
      instanceId: 'runtime-pbx',
      source: 'AMI',
      type: 'AUTHENTICATION_FAILURE',
      reason,
      observedAt,
      streamGeneration: 1,
      streamSequence,
    });
    source.emit(event('2026-09-26T10:00:00.000Z', 1));
    assert.equal(storage.securityAlerts.listCurrent('runtime-pbx').length, 1);
    source.emit(event('2026-09-26T10:00:30.000Z', 2));
    const current = storage.securityAlerts.listCurrent('runtime-pbx');
    assert.equal(current.length, 2);
    assert.equal(
      storage.securityAlerts.getCurrent('runtime-pbx', 'AUTHENTICATION_FAILURE_THRESHOLD')
        .matchedEventCount,
      2,
    );
    runtime.stop();
    source.emit(event('2026-09-26T10:00:40.000Z', 3));
    assert.equal(
      storage.securityEvents.listHistory(
        'runtime-pbx',
        '2026-09-26T10:00:31.000Z',
        '2026-09-26T10:01:00.000Z',
        10,
      ).length,
      0,
    );
  }));

test('security alert runtime keeps disabled rules inert and fails closed after event persistence failure', () =>
  fixture(async (storage) => {
    storage.securityAlertRules.put({
      instanceId: 'runtime-pbx',
      id: 'AUTHENTICATION_FAILURE_ANY',
      enabled: false,
    });
    const source = new FakeSecuritySource();
    const runtime = new SecurityAlertRuntime(storage, source, () => '2026-09-26T09:00:00.000Z');
    runtime.start();
    source.emit({
      instanceId: 'runtime-pbx',
      source: 'AMI',
      type: 'AUTHENTICATION_FAILURE',
      reason: 'INVALID_PASSWORD',
      observedAt: '2026-09-26T10:00:00.000Z',
    });
    assert.deepEqual(storage.securityAlerts.listCurrent('runtime-pbx'), []);
    runtime.stop();
  }));
