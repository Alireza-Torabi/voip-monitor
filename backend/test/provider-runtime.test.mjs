import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';
import { test } from 'node:test';
import { AuthService } from '../dist/auth/index.js';
import { loadAppConfig } from '../dist/config.js';
import { PbxOnboardingService } from '../dist/onboarding/index.js';
import { ProviderRuntimeError, ProviderRuntimeManager } from '../dist/providers/runtime/index.js';
import { SecretStore } from '../dist/security/secret-store.js';
import { createApp } from '../dist/server.js';
import { SqliteStorage } from '../dist/storage/index.js';

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'voip-monitor-runtime-'));
  const config = loadAppConfig({ DATA_PATH: directory, APP_ENV: 'test' });
  let storage;
  let secrets;
  let runtime;
  try {
    storage = await SqliteStorage.open(config);
    secrets = await SecretStore.open(config, storage);
    const auth = await AuthService.open(config, storage);
    await run({
      config,
      storage,
      secrets,
      auth,
      setRuntime(value) {
        runtime = value;
      },
    });
  } finally {
    await runtime?.stop();
    secrets?.close();
    storage?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function profileInput(enabled = true) {
  return {
    displayName: 'Synthetic PBX',
    providerType: 'ASTERISK',
    enabled,
    amiHost: 'pbx.example.test',
    amiPort: 5038,
    amiUsername: 'synthetic-admin',
    amiPassword: 'synthetic-ami-secret',
  };
}

class FakeProvider {
  state = 'DISCONNECTED';
  connectAttempts = 0;
  disconnects = 0;
  reconciles = 0;
  snapshotReads = 0;
  failSnapshots = 0;
  eventListeners = new Set();

  constructor(profile, failConnects = 0) {
    this.profile = profile;
    this.failConnects = failConnects;
  }

  async connect() {
    this.connectAttempts += 1;
    if (this.connectAttempts <= this.failConnects) {
      this.state = 'ERROR';
      throw new Error('synthetic connection failure');
    }
    this.state = 'CONNECTED';
  }

  async disconnect() {
    this.disconnects += 1;
    this.state = 'DISCONNECTED';
  }

  async discover() {
    if (this.state !== 'CONNECTED') throw new Error('not connected');
    return {
      metadata: {
        id: this.profile.id,
        providerType: 'ASTERISK',
        displayName: this.profile.displayName,
        product: 'Asterisk',
        version: '13.synthetic',
      },
      capabilities: {
        telephony: {
          channels: 'UNKNOWN',
          calls: 'UNKNOWN',
          endpoints: 'UNKNOWN',
          trunks: 'UNKNOWN',
          queues: 'UNKNOWN',
          agents: 'UNKNOWN',
        },
        system: {
          cpu: 'UNKNOWN',
          memory: 'UNKNOWN',
          filesystems: 'UNKNOWN',
          uptime: 'UNKNOWN',
          services: 'UNKNOWN',
        },
        security: { authenticationEvents: 'UNKNOWN' },
      },
      observedAt: new Date().toISOString(),
    };
  }

  async getCapabilities() {
    return (await this.discover()).capabilities;
  }

  async getHealth() {
    return {
      instanceId: this.profile.id,
      connection: { state: this.state },
      sources: {
        AMI: {
          source: 'AMI',
          freshness: this.state === 'CONNECTED' ? 'CURRENT' : 'UNAVAILABLE',
        },
      },
    };
  }

  async getCurrentState() {
    if (this.state !== 'CONNECTED' && this.state !== 'DEGRADED') throw new Error('not connected');
    this.snapshotReads += 1;
    if (this.snapshotReads <= this.failSnapshots) {
      this.state = 'DEGRADED';
      throw new Error('synthetic snapshot failure');
    }
    this.state = 'CONNECTED';
    return {
      instanceId: this.profile.id,
      source: 'AMI',
      observedAt: `2026-09-25T00:00:${String(this.snapshotReads).padStart(2, '0')}.000Z`,
      channels: [
        {
          channelId: `synthetic-channel-${this.snapshotReads}`,
          channelName: 'SIP/100-00000001',
          linkedId: 'synthetic-call-1',
          state: 'Up',
        },
      ],
    };
  }

  subscribeEvents(listener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  emitEvent(event) {
    for (const listener of this.eventListeners) listener(event);
  }

  async reconcile() {
    this.reconciles += 1;
    return this.getCurrentState();
  }
}

class FakeFactory {
  created = [];

  constructor(failFirstConnects = 0) {
    this.failFirstConnects = failFirstConnects;
  }

  create(profile) {
    const provider = new FakeProvider(
      profile,
      this.created.length === 0 ? this.failFirstConnects : 0,
    );
    this.created.push(provider);
    return provider;
  }
}

async function waitFor(predicate, timeoutMs = 500) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('condition was not reached');
}

test('runtime keeps one provider per enabled PBX, reconnects with backoff, and reloads safely', async () =>
  fixture(async ({ storage, secrets, setRuntime }) => {
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(true));
    const factory = new FakeFactory(1);
    const runtime = new ProviderRuntimeManager(storage, secrets, factory, {
      reconnectBaseMs: 5,
      reconnectMaxMs: 5,
      reconcileMs: 10_000,
      random: () => 0.5,
    });
    setRuntime(runtime);
    const resets = [];
    const connectionStates = [];
    runtime.subscribeInstanceResets((id) => resets.push(id));
    runtime.subscribeConnectionStates((id, state) => connectionStates.push([id, state]));

    runtime.start();
    await waitFor(() => factory.created[0]?.connectAttempts >= 2);
    assert.equal(factory.created.length, 1);
    assert.equal(runtime.connectionState(profile.id), 'CONNECTED');
    assert.ok(connectionStates.some(([id, state]) => id === profile.id && state === 'CONNECTED'));

    onboarding.update(profile.id, { enabled: false });
    await runtime.syncProfile(profile.id);
    assert.equal(runtime.connectionState(profile.id), 'UNVERIFIED');
    assert.ok(factory.created[0].disconnects >= 1);
    assert.deepEqual(resets, [profile.id]);

    await runtime.stop();
    assert.equal(factory.created.length, 1);
  }));

test('runtime publishes initial and reconciliation snapshots without extra provider instances', async () =>
  fixture(async ({ storage, secrets, setRuntime }) => {
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(true));
    const factory = new FakeFactory();
    const runtime = new ProviderRuntimeManager(storage, secrets, factory, {
      reconnectBaseMs: 5,
      reconnectMaxMs: 5,
      reconcileMs: 15,
      random: () => 0.5,
    });
    setRuntime(runtime);
    const snapshots = [];
    const unsubscribe = runtime.subscribeSnapshots((snapshot) => snapshots.push(snapshot));

    runtime.start();
    await waitFor(() => snapshots.length >= 2);
    assert.equal(factory.created.length, 1);
    assert.equal(snapshots[0].channels[0].channelId, 'synthetic-channel-1');
    assert.equal(snapshots[1].channels[0].channelId, 'synthetic-channel-2');
    assert.deepEqual(runtime.currentState(profile.id), snapshots.at(-1));
    assert.equal(runtime.status(profile.id).snapshot.currentState, undefined);

    unsubscribe();
  }));

test('snapshot degradation keeps the provider connected and recovers on reconciliation', async () =>
  fixture(async ({ storage, secrets, setRuntime }) => {
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(true));
    const factory = new FakeFactory();
    const runtime = new ProviderRuntimeManager(storage, secrets, factory, {
      reconnectBaseMs: 5,
      reconnectMaxMs: 5,
      reconcileMs: 15,
      random: () => 0.5,
    });
    setRuntime(runtime);

    runtime.start();
    factory.created[0].failSnapshots = 1;
    await waitFor(() => runtime.connectionState(profile.id) === 'DEGRADED');
    assert.equal(factory.created[0].connectAttempts, 1);
    assert.equal(factory.created[0].disconnects, 0);

    await waitFor(() => runtime.currentState(profile.id) !== undefined);
    assert.equal(runtime.connectionState(profile.id), 'CONNECTED');
    assert.equal(factory.created[0].connectAttempts, 1);
  }));

test('runtime forwards provider events without creating browser-driven provider instances', async () =>
  fixture(async ({ storage, secrets, setRuntime }) => {
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(true));
    const factory = new FakeFactory();
    const runtime = new ProviderRuntimeManager(storage, secrets, factory, {
      reconnectBaseMs: 5,
      reconnectMaxMs: 5,
      reconcileMs: 10_000,
      random: () => 0.5,
    });
    setRuntime(runtime);
    const events = [];
    const unsubscribe = runtime.subscribeEvents((event) => events.push(event));

    runtime.start();
    await waitFor(() => runtime.connectionState(profile.id) === 'CONNECTED');
    assert.equal(factory.created.length, 1);

    factory.created[0].emitEvent({
      type: 'CHANNEL_CREATED',
      instanceId: profile.id,
      source: 'AMI',
      observedAt: '2026-09-25T00:00:00.000Z',
      channelId: 'synthetic-channel-1',
      channelName: 'SIP/100-00000001',
      state: 'Ring',
    });
    assert.deepEqual(events, [
      {
        type: 'CHANNEL_CREATED',
        instanceId: profile.id,
        source: 'AMI',
        observedAt: '2026-09-25T00:00:00.000Z',
        channelId: 'synthetic-channel-1',
        channelName: 'SIP/100-00000001',
        state: 'Ring',
      },
    ]);
    assert.equal(factory.created.length, 1);

    unsubscribe();
    factory.created[0].emitEvent({
      type: 'CHANNEL_DESTROYED',
      instanceId: profile.id,
      source: 'AMI',
      observedAt: '2026-09-25T00:00:01.000Z',
      channelId: 'synthetic-channel-1',
    });
    assert.equal(events.length, 1);
  }));

test('manual verification uses one-shot provider, persists discovery, and connection edits invalidate setup', async () =>
  fixture(async ({ storage, secrets, setRuntime }) => {
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(false));
    const factory = new FakeFactory();
    const runtime = new ProviderRuntimeManager(storage, secrets, factory);
    setRuntime(runtime);
    runtime.start();

    assert.equal(factory.created.length, 0);
    const result = await runtime.verify(profile.id);
    assert.equal(result.discovery.metadata.version, '13.synthetic');
    assert.equal(result.health.connection.state, 'DISCONNECTED');
    assert.equal(factory.created.length, 1);
    assert.equal(factory.created[0].disconnects, 1);
    assert.equal(storage.setup.get().state, 'COMPLETE');
    assert.equal(storage.pbxInstances.get(profile.id).version, '13.synthetic');
    assert.ok(storage.pbxProfiles.get(profile.id).lastVerifiedAt);

    onboarding.update(profile.id, { amiPort: 5040 });
    assert.equal(storage.setup.get().state, 'PBX_CONFIGURED_UNVERIFIED');
    assert.equal(storage.pbxProfiles.get(profile.id).lastVerifiedAt, undefined);
    assert.equal(storage.pbxInstances.get(profile.id).version, undefined);
  }));

test('system metrics API requires auth and exposes current/history', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('admin', 'synthetic admin passphrase', token);
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(false));
    const current = {
      instanceId: profile.id,
      source: 'SSH',
      observedAt: '2026-09-26T00:00:00.000Z',
      capabilities: {
        cpu: 'SUPPORTED',
        memory: 'NOT_CONFIGURED',
        filesystems: 'NOT_CONFIGURED',
        uptime: 'NOT_CONFIGURED',
        services: 'NOT_CONFIGURED',
      },
      cpu: { utilizationPercent: 42 },
    };
    storage.systemMetrics.save(current, '2026-09-25T00:00:00.000Z');
    const systemMetrics = {
      status: () => ({
        instanceId: profile.id,
        health: { source: 'SSH', freshness: 'CURRENT' },
        consecutiveFailures: 0,
      }),
      subscribeSamples: () => () => {},
      subscribeHealth: () => () => {},
    };
    const apiAuth = {
      requiresSecureOrigin: false,
      principal: function () {
        return { id: 'admin', username: 'admin' };
      },
    };
    const app = await serve(storage, secrets, apiAuth, undefined, systemMetrics);
    try {
      const cookie = 'vm_session=synthetic';
      const response = await send(
        app.base,
        'GET',
        '/api/pbx-instances/' + profile.id + '/system-metrics',
        undefined,
        cookie,
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).current.observedAt, current.observedAt);
      const history = await fetch(
        app.base +
          '/api/pbx-instances/' +
          profile.id +
          '/system-metrics/history?from=2026-09-25T23:00:00Z&to=2026-09-26T01:00:00Z&limit=10',
        { headers: { Cookie: cookie } },
      );
      assert.equal(history.status, 200);
      assert.equal((await history.json()).items.length, 1);
      assert.equal(
        (
          await fetch(
            app.base +
              '/api/pbx-instances/' +
              profile.id +
              '/system-metrics/history?from=bad&to=2026-09-26T01:00:00Z&limit=10',
            { headers: { Cookie: cookie } },
          )
        ).status,
        400,
      );
    } finally {
      await app.close();
    }
  }));

test('system metrics stream is authenticated and PBX-scoped', async () =>
  fixture(async ({ config, storage, secrets, auth }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    await auth.createFirst('admin', 'synthetic admin passphrase', token);
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(false));
    let sampleListener;
    const systemMetrics = {
      status: () => ({
        instanceId: profile.id,
        health: { source: 'SSH', freshness: 'NEVER_COLLECTED' },
        consecutiveFailures: 0,
      }),
      subscribeSamples: (listener) => {
        sampleListener = listener;
        return () => {};
      },
      subscribeHealth: () => () => {},
    };
    const apiAuth = {
      requiresSecureOrigin: false,
      principal: function () {
        return { id: 'admin', username: 'admin' };
      },
    };
    const app = await serve(storage, secrets, apiAuth, undefined, systemMetrics);
    try {
      const cookie = 'vm_session=synthetic';
      const response = await fetch(
        app.base + '/api/pbx-instances/' + profile.id + '/system-metrics/stream',
        { headers: { Cookie: cookie, origin: app.base } },
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
      const reader = response.body.getReader();
      assert.match(new TextDecoder().decode((await reader.read()).value), /event: system-metrics/);
      sampleListener({
        instanceId: profile.id,
        source: 'SSH',
        observedAt: '2026-09-26T00:01:00.000Z',
        capabilities: {
          cpu: 'SUPPORTED',
          memory: 'NOT_CONFIGURED',
          filesystems: 'NOT_CONFIGURED',
          uptime: 'NOT_CONFIGURED',
          services: 'NOT_CONFIGURED',
        },
        cpu: { utilizationPercent: 50 },
      });
      assert.match(new TextDecoder().decode((await reader.read()).value), /00:01:00/);
      await reader.cancel();
    } finally {
      await app.close();
    }
  }));

test('disabled network mode rejects verification without constructing a provider', async () =>
  fixture(async ({ storage, secrets, setRuntime }) => {
    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(false));
    const runtime = new ProviderRuntimeManager(storage, secrets, undefined);
    setRuntime(runtime);
    runtime.start();

    await assert.rejects(
      runtime.verify(profile.id),
      (error) => error instanceof ProviderRuntimeError && error.code === 'NETWORK_DISABLED',
    );
    assert.equal(runtime.connectionState(profile.id), 'UNVERIFIED');
    assert.equal(runtime.status(profile.id).networkEnabled, false);
  }));

async function serve(storage, secrets, auth, runtime, systemMetrics) {
  const server = createApp(storage, secrets, auth, runtime, systemMetrics);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function send(base, method, path, data, cookie, origin = base) {
  return fetch(base + path, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      ...(data ? { 'content-type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}

test('authenticated connection-test API is same-origin, secret-safe, and does not affect readiness', async () =>
  fixture(async ({ config, storage, secrets, auth, setRuntime }) => {
    const token = (
      await readFile(join(config.secretDirectory, 'bootstrap-admin.token'), 'utf8')
    ).trim();
    assert.ok(
      await auth.createFirst('admin', 'synthetic admin passphrase', token),
      'administrator should be created',
    );

    const onboarding = new PbxOnboardingService(storage, secrets);
    const profile = onboarding.create(profileInput(false));
    const factory = new FakeFactory();
    const runtime = new ProviderRuntimeManager(storage, secrets, factory);
    setRuntime(runtime);
    runtime.start();

    const app = await serve(storage, secrets, auth, runtime);
    try {
      assert.equal(
        (await fetch(`${app.base}/api/pbx-instances/${profile.id}/provider-status`)).status,
        401,
      );
      assert.equal(
        (
          await send(
            app.base,
            'POST',
            `/api/pbx-instances/${profile.id}/test-connection`,
            undefined,
            undefined,
          )
        ).status,
        401,
      );

      const login = await send(app.base, 'POST', '/auth/login', {
        username: 'admin',
        ['password']: 'synthetic admin passphrase',
      });
      assert.equal(login.status, 200);
      assert.ok(login.headers.get('set-cookie'));
      const cookie = login.headers.get('set-cookie').split(';')[0];

      assert.equal(
        (
          await send(
            app.base,
            'POST',
            `/api/pbx-instances/${profile.id}/test-connection`,
            undefined,
            cookie,
            'https://evil.example',
          )
        ).status,
        403,
      );

      const verified = await send(
        app.base,
        'POST',
        `/api/pbx-instances/${profile.id}/test-connection`,
        undefined,
        cookie,
      );
      assert.equal(verified.status, 200);
      const text = await verified.text();
      assert.ok(!text.includes('synthetic-ami-secret'));
      const payload = JSON.parse(text);
      assert.equal(payload.status, 'verified');
      assert.equal(payload.discovery.metadata.product, 'Asterisk');
      assert.equal(storage.setup.get().state, 'COMPLETE');
      assert.equal((await fetch(app.base + '/ready')).status, 200);

      const providerStatus = await (
        await fetch(`${app.base}/api/pbx-instances/${profile.id}/provider-status`, {
          headers: { cookie },
        })
      ).json();
      assert.equal(providerStatus.networkEnabled, true);
      assert.equal(providerStatus.managed, false);
      assert.equal(providerStatus.connectionStatus, 'DISCONNECTED');
    } finally {
      await app.close();
    }
  }));
