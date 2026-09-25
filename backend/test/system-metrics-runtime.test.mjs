import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from '../dist/auth/index.js';
import { loadAppConfig } from '../dist/config.js';
import { SystemMetricsRuntime } from '../dist/collectors/system/runtime.js';
import { SshConfigurationService } from '../dist/ssh/configuration.js';
import { SecretStore } from '../dist/security/secret-store.js';
import { SqliteStorage } from '../dist/storage/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-system-runtime-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: 'test' });
  let storage;
  let secrets;
  let runtime;
  try {
    storage = await SqliteStorage.open(config);
    secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    await run({ storage, secrets, auth, setRuntime: (value) => (runtime = value) });
  } finally {
    runtime?.stop();
    secrets?.close();
    storage?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function profileInput() {
  return {
    displayName: 'Synthetic PBX',
    providerType: 'ASTERISK',
    enabled: true,
    amiHost: 'pbx.example.test',
    amiPort: 5038,
    amiUsername: 'synthetic-admin',
    amiPassword: 'synthetic-ami-secret',
  };
}

function sample(instanceId, second = 0) {
  return {
    instanceId,
    source: 'SSH',
    observedAt: `2026-09-25T00:00:${String(second).padStart(2, '0')}.000Z`,
    capabilities: {
      cpu: 'SUPPORTED',
      memory: 'NOT_CONFIGURED',
      filesystems: 'NOT_CONFIGURED',
      uptime: 'NOT_CONFIGURED',
      services: 'NOT_CONFIGURED',
    },
    cpu: { utilizationPercent: 12.5 },
  };
}

class FakeCollector {
  source = 'SSH';
  calls = 0;

  constructor(behavior) {
    this.behavior = behavior;
  }

  async collect(instanceId) {
    this.calls += 1;
    return this.behavior(instanceId, this.calls);
  }
}

class FakeCollectorFactory {
  created = [];

  constructor(behavior) {
    this.behavior = behavior;
  }

  create() {
    const collector = new FakeCollector(this.behavior);
    this.created.push(collector);
    return collector;
  }
}

async function waitFor(predicate, timeoutMs = 500) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail('condition was not reached');
}

async function configureSsh(storage, secrets, id) {
  const service = new SshConfigurationService(storage, secrets);
  service.configure(id, {
    host: '127.0.0.1',
    port: 2222,
    username: 'synthetic',
    authMethod: 'PASSWORD',
    hostKeyPolicy: 'PINNED_SHA256',
    hostKeyFingerprint: `SHA256:${'A'.repeat(43)}`,
    credential: 'synthetic-ssh-secret',
  });
  return service;
}

test('system metrics runtime keeps SSH health per PBX and publishes bounded samples', async () => {
  await fixture(async ({ storage, secrets, setRuntime }) => {
    const { PbxOnboardingService } = await import('../dist/onboarding/index.js');
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput());
    const ssh = await configureSsh(storage, secrets, profile.id);
    const factory = new FakeCollectorFactory((id, call) => sample(id, call));
    const runtime = new SystemMetricsRuntime(storage, ssh, factory, {
      intervalMs: 10_000,
      failureBackoffBaseMs: 5,
      failureBackoffMaxMs: 10,
      random: () => 0.5,
    });
    setRuntime(runtime);
    const samples = [];
    const health = [];
    runtime.subscribeSamples((value) => samples.push(value));
    runtime.subscribeHealth((value) => health.push(value));

    assert.equal(runtime.status(profile.id).health.freshness, 'UNAVAILABLE');
    runtime.start();
    await waitFor(() => samples.length === 1);

    assert.equal(factory.created.length, 1);
    assert.equal(factory.created[0].calls, 1);
    assert.equal(runtime.status(profile.id).health.freshness, 'CURRENT');
    assert.equal(runtime.status(profile.id).sample.cpu.utilizationPercent, 12.5);
    assert.equal(health.at(-1).health.source, 'SSH');
    assert.equal(health.at(-1).consecutiveFailures, 0);
  });
});

test('system metrics runtime backs off bounded failures and recovers without throwing', async () => {
  await fixture(async ({ storage, secrets, setRuntime }) => {
    const { PbxOnboardingService } = await import('../dist/onboarding/index.js');
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput());
    const ssh = await configureSsh(storage, secrets, profile.id);
    const factory = new FakeCollectorFactory((id, call) => {
      if (call === 1) throw new Error('synthetic collector failure');
      return sample(id, call);
    });
    const runtime = new SystemMetricsRuntime(storage, ssh, factory, {
      intervalMs: 10_000,
      failureBackoffBaseMs: 5,
      failureBackoffMaxMs: 10,
      random: () => 0.5,
    });
    setRuntime(runtime);
    runtime.start();

    await waitFor(() => runtime.status(profile.id).health.freshness === 'ERROR');
    assert.equal(runtime.status(profile.id).health.error.code, 'UNKNOWN');
    assert.equal(runtime.status(profile.id).consecutiveFailures, 1);
    assert.equal(factory.created[0].calls, 1);

    await waitFor(() => runtime.status(profile.id).health.freshness === 'CURRENT');
    assert.equal(runtime.status(profile.id).consecutiveFailures, 0);
    assert.equal(factory.created[0].calls, 2);
  });
});

test('system metrics runtime does not create a source without SSH credentials and stops cleanly', async () => {
  await fixture(async ({ storage, secrets, setRuntime }) => {
    const { PbxOnboardingService } = await import('../dist/onboarding/index.js');
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput());
    const ssh = new SshConfigurationService(storage, secrets);
    const factory = new FakeCollectorFactory((id, call) => sample(id, call));
    const runtime = new SystemMetricsRuntime(storage, ssh, factory, { intervalMs: 10_000 });
    setRuntime(runtime);
    runtime.start();

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(factory.created.length, 0);
    assert.equal(runtime.status(profile.id).health.freshness, 'UNAVAILABLE');

    await configureSsh(storage, secrets, profile.id);
    runtime.syncProfile(profile.id);
    await waitFor(() => factory.created.length === 1);
    runtime.stop();
    const calls = factory.created[0].calls;
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(factory.created[0].calls, calls);
  });
});
