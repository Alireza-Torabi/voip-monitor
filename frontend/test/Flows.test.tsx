// @vitest-environment jsdom
import { ChakraProvider } from '@chakra-ui/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, FirstAdminForm, LoginForm, PbxWorkspace } from '../src/App.js';
import { SecurityWorkspace } from '../src/SecurityWorkspace.js';
import { SshMetricsWorkspace } from '../src/SshMetricsWorkspace.js';
import { DatabaseSourceWorkspace } from '../src/DatabaseSourceWorkspace.js';
import { HistoryWorkspace } from '../src/HistoryWorkspace.js';
import { DashboardStorageWorkspace } from '../src/DashboardStorageWorkspace.js';
import { DashboardBuilder } from '../src/DashboardBuilder.js';
import { ServiceMonitoringWorkspace } from '../src/ServiceMonitoringWorkspace.js';
import { AccountsWorkspace } from '../src/AccountsWorkspace.js';
import { OperatorDashboard } from '../src/OperatorDashboard.js';
import { TelephonyWorkspace } from '../src/TelephonyWorkspace.js';
import { FleetOverviewWorkspace } from '../src/FleetOverviewWorkspace.js';
import { messages } from '../src/i18n.js';
import { nocSystem } from '../src/theme.js';

type TestResponse = { ok: boolean; status: number; json: () => Promise<object> };
let container: HTMLDivElement;
let root: Root;
function response(value: object, status = 200): TestResponse {
  return { ok: status < 400, status, json: async () => value };
}
function input(name: string): HTMLInputElement {
  const field = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!field) throw new Error('input missing');
  return field;
}
async function enter(name: string, value: string) {
  await act(async () => {
    const field = input(name);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  const reactRoot = createRoot(container);
  root = {
    render(children) {
      reactRoot.render(<ChakraProvider value={nocSystem}>{children}</ChakraProvider>);
    },
    unmount() {
      reactRoot.unmount();
    },
  } as Root;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('secret form lifecycle', () => {
  it('moves from first-admin setup to login and onboarding without persistent secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/setup/status') return response({ adminSetupRequired: true });
        if (path === '/setup/admin') return response({ id: 'synthetic', username: 'admin' }, 201);
        if (path === '/auth/login' || path === '/auth/me')
          return response({ id: 'synthetic', username: 'admin' });
        if (path === '/api/pbx-instances') return response({ items: [] });
        throw new Error('unexpected API route');
      }),
    );
    await act(async () => root.render(<App initialLanguage="en" />));
    expect(container.textContent).toContain('Create first administrator');
    await enter('bootstrap-token', 'synthetic-token');
    await enter('username', 'admin');
    await enter('new-password', 'synthetic admin passphrase');
    await enter('confirm-password', 'synthetic admin passphrase');
    await submit();
    expect(container.textContent).toContain('Administrator login');
    await enter('username', 'admin');
    await enter('password', 'synthetic admin passphrase');
    await submit();
    expect(container.textContent).toContain('Add the first PBX profile');
    expect(Object.keys(window.localStorage)).toEqual(['voip-monitor-language']);
    expect(container.textContent).not.toContain('synthetic-token');
  });

  it('keeps the authenticated view when logout revocation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('synthetic network failure');
      }),
    );
    await act(async () => root.render(<App initialLanguage="en" initialView="ready" />));
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === 'Log out',
    );
    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('PBX profiles');
    expect(container.textContent).toContain('Application unavailable');
    expect(container.textContent).not.toContain('Administrator login');
  });
  it('clears bootstrap token and both administrator password fields after creation', async () => {
    const onCreated = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ id: 'synthetic', username: 'admin' }, 201)),
    );
    await act(async () => root.render(<FirstAdminForm text={messages.en} onCreated={onCreated} />));
    await enter('bootstrap-token', 'synthetic-token');
    await enter('username', 'admin');
    await enter('new-password', 'synthetic admin passphrase');
    await enter('confirm-password', 'synthetic admin passphrase');
    await submit();
    expect(onCreated).toHaveBeenCalledOnce();
    expect(input('bootstrap-token').value).toBe('');
    expect(input('new-password').value).toBe('');
    expect(input('confirm-password').value).toBe('');
  });
  it('clears login password after successful authentication', async () => {
    const onLoggedIn = vi.fn(async () => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) =>
        response(
          path === '/auth/me'
            ? { id: 'synthetic', username: 'admin' }
            : { id: 'synthetic', username: 'admin' },
        ),
      ),
    );
    await act(async () => root.render(<LoginForm text={messages.en} onLoggedIn={onLoggedIn} />));
    await enter('username', 'admin');
    await enter('password', 'synthetic admin passphrase');
    await submit();
    expect(onLoggedIn).toHaveBeenCalledOnce();
    expect(input('password').value).toBe('');
  });
  it('removes the AMI password field after a saved new profile', async () => {
    const onRefresh = vi.fn(async () => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ id: 'synthetic' }, 201)),
    );
    await act(async () =>
      root.render(
        <PbxWorkspace
          text={messages.en}
          profiles={[]}
          onRefresh={onRefresh}
          onUnauthorized={() => {}}
        />,
      ),
    );
    await enter('display-name', 'Synthetic PBX');
    await enter('ami-host', 'pbx.example.test');
    await enter('ami-username', 'synthetic-user');
    await enter('ami-password', 'synthetic-ami-secret');
    await submit();
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('synthetic-ami-secret');
    expect(container.querySelector('input[name="ami-password"]')).toBeNull();
  });
  it('runs an authenticated PBX connection test without exposing the stored password', async () => {
    const onRefresh = vi.fn(async () => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/synthetic-id/test-connection') {
          return response({
            status: 'verified',
            discovery: {
              metadata: {
                id: 'synthetic-id',
                providerType: 'ASTERISK',
                displayName: 'Synthetic PBX',
                product: 'Asterisk',
                version: '13.synthetic',
              },
              observedAt: '2026-09-25T00:00:00.000Z',
            },
          });
        }
        throw new Error('unexpected API route');
      }),
    );
    await act(async () =>
      root.render(
        <PbxWorkspace
          text={messages.en}
          profiles={[
            {
              id: 'synthetic-id',
              displayName: 'Synthetic PBX',
              providerType: 'ASTERISK',
              enabled: false,
              amiHost: 'pbx.example.test',
              amiPort: 5038,
              amiUsername: 'synthetic-user',
              hasAmiPassword: true,
              connectionStatus: 'UNVERIFIED',
              createdAt: '',
              updatedAt: '',
            },
          ]}
          onRefresh={onRefresh}
          onUnauthorized={() => {}}
        />,
      ),
    );
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === 'Test connection',
    );
    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Connection verified: Asterisk 13.synthetic');
    expect(container.textContent).not.toContain('synthetic-ami-secret');
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

describe('security monitoring workspace', () => {
  const profile = {
    id: 'synthetic-id',
    displayName: 'Synthetic PBX',
    providerType: 'ASTERISK',
    enabled: true,
    amiHost: 'pbx.example.test',
    amiPort: 5038,
    amiUsername: 'synthetic-user',
    hasAmiPassword: true,
    connectionStatus: 'CONNECTED',
    createdAt: '',
    updatedAt: '',
  } as const;

  it('loads current alerts and persisted rules', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/synthetic-id/security-alerts') {
          return response({
            current: [
              {
                instanceId: 'synthetic-id',
                ruleId: 'AUTHENTICATION_FAILURE_THRESHOLD',
                observedAt: '2026-09-26T07:00:00.000Z',
                matchedEventCount: 3,
              },
            ],
          });
        }
        if (path.startsWith('/api/pbx-instances/synthetic-id/security-alerts/history?')) {
          return response({
            items: [
              {
                instanceId: 'synthetic-id',
                ruleId: 'AUTHENTICATION_FAILURE_ANY',
                observedAt: '2026-09-26T06:00:00.000Z',
                matchedEventCount: 1,
              },
            ],
          });
        }
        if (path === '/api/pbx-instances/synthetic-id/security-alert-rules') {
          return response({
            items: [
              {
                instanceId: 'synthetic-id',
                id: 'AUTHENTICATION_FAILURE_THRESHOLD',
                enabled: true,
                threshold: 3,
                windowSeconds: 60,
                reason: 'INVALID_PASSWORD',
              },
            ],
          });
        }
        throw new Error('unexpected API route');
      }),
    );
    await act(async () =>
      root.render(
        <SecurityWorkspace text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );
    expect(container.textContent).toContain('Matched events: 3');
    expect(container.textContent).toContain('Recent alert history (24 hours)');
    expect(container.textContent).toContain('Matched events: 1');
    expect(input('rule-threshold').value).toBe('3');
    expect(input('rule-window-seconds').value).toBe('60');
    expect(input('rule-threshold-enabled').checked).toBe(true);
  });

  it('saves the bounded threshold rule through the authenticated API client', async () => {
    const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/pbx-instances/synthetic-id/security-alerts')
        return response({ current: [] });
      if (path.startsWith('/api/pbx-instances/synthetic-id/security-alerts/history?'))
        return response({ items: [] });
      if (path === '/api/pbx-instances/synthetic-id/security-alert-rules') {
        return response({ items: [] });
      }
      if (
        path ===
          '/api/pbx-instances/synthetic-id/security-alert-rules/AUTHENTICATION_FAILURE_THRESHOLD' &&
        init?.method === 'PUT'
      ) {
        return response({
          instanceId: 'synthetic-id',
          id: 'AUTHENTICATION_FAILURE_THRESHOLD',
          enabled: true,
          threshold: 5,
          windowSeconds: 120,
        });
      }
      throw new Error('unexpected API route');
    });
    vi.stubGlobal('fetch', fetchMock);
    await act(async () =>
      root.render(
        <SecurityWorkspace text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );
    await enter('rule-threshold', '5');
    await enter('rule-window-seconds', '120');
    await act(async () => {
      input('rule-threshold-enabled').click();
    });
    const thresholdForm = input('rule-threshold').closest('form');
    await act(async () => {
      thresholdForm?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(
      fetchMock.mock.calls.some(
        ([path, init]) =>
          path ===
            '/api/pbx-instances/synthetic-id/security-alert-rules/AUTHENTICATION_FAILURE_THRESHOLD' &&
          init?.method === 'PUT' &&
          String(init?.body).includes('"threshold":5') &&
          String(init?.body).includes('"windowSeconds":120'),
      ),
    ).toBe(true);
  });

  it('merges persistence-backed realtime alerts into current state and recent history without duplicates', async () => {
    class FakeEventSource {
      static latest: FakeEventSource | undefined;
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private listeners = new Map<string, EventListener>();
      constructor(readonly url: string) {
        FakeEventSource.latest = this;
      }
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (typeof listener === 'function') this.listeners.set(type, listener);
      }
      removeEventListener(type: string) {
        this.listeners.delete(type);
      }
      close() {}
      emit(type: string, value: object) {
        this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(value) }));
      }
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/synthetic-id/security-alerts')
          return response({ current: [] });
        if (path.startsWith('/api/pbx-instances/synthetic-id/security-alerts/history?'))
          return response({ items: [] });
        if (path === '/api/pbx-instances/synthetic-id/security-alert-rules')
          return response({ items: [] });
        throw new Error('unexpected API route');
      }),
    );
    await act(async () =>
      root.render(
        <SecurityWorkspace text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );
    expect(FakeEventSource.latest?.url).toBe(
      '/api/pbx-instances/synthetic-id/security-alerts/stream',
    );
    await act(async () => FakeEventSource.latest?.onopen?.());
    expect(container.textContent).toContain('Live updates connected');
    const alert = {
      instanceId: 'synthetic-id',
      ruleId: 'AUTHENTICATION_FAILURE_THRESHOLD',
      observedAt: '2026-09-26T07:30:00.000Z',
      matchedEventCount: 4,
      streamGeneration: 3,
      streamSequence: 9,
    };
    await act(async () => {
      FakeEventSource.latest?.emit('security-alert', { alert });
      FakeEventSource.latest?.emit('security-alert', { alert });
    });
    expect(container.textContent).toContain('Matched events: 4');
    expect(container.querySelectorAll('[data-security-alert]')).toHaveLength(2);
  });
});

describe('operator dashboard', () => {
  const profile = {
    id: 'dashboard-pbx',
    displayName: 'Dashboard PBX',
    providerType: 'ASTERISK',
    enabled: true,
    amiHost: 'pbx.example.test',
    amiPort: 5038,
    amiUsername: 'synthetic-user',
    hasAmiPassword: true,
    connectionStatus: 'CONNECTED',
    createdAt: '',
    updatedAt: '',
  } as const;

  it('summarizes existing provider, metrics, alert, and realtime boundaries', async () => {
    class FakeEventSource {
      static instances = new Map<string, FakeEventSource>();
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private listeners = new Map<string, EventListener>();
      constructor(readonly url: string) {
        FakeEventSource.instances.set(url, this);
      }
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (typeof listener === 'function') this.listeners.set(type, listener);
      }
      close() {}
      emit(type: string, value: object) {
        this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(value) }));
      }
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/dashboard-pbx/provider-status') {
          return response({
            connectionStatus: 'CONNECTED',
            managed: true,
            networkEnabled: true,
          });
        }
        if (path === '/api/pbx-instances/dashboard-pbx/dashboard-storage') {
          return response({ selectedFilesystemIds: ['/data'] });
        }
        if (path === '/api/pbx-instances/dashboard-pbx/system-metrics') {
          return response({
            current: {
              instanceId: 'dashboard-pbx',
              source: 'SSH',
              observedAt: '2026-10-05T04:00:00.000Z',
              cpu: { utilizationPercent: 12.5 },
              memory: { totalBytes: 8589934592, availableBytes: 6442450944 },
              filesystems: [
                {
                  filesystemId: '/',
                  mountPoint: '/',
                  totalBytes: 107374182400,
                  availableBytes: 64424509440,
                },
                {
                  filesystemId: '/data',
                  mountPoint: '/data',
                  totalBytes: 214748364800,
                  availableBytes: 107374182400,
                },
              ],
              uptime: { uptimeSeconds: 90000 },
              services: [
                { serviceId: 'asterisk.service', state: 'ACTIVE' },
                { serviceId: 'helper.service', state: 'INACTIVE' },
              ],
            },
            source: {
              instanceId: 'dashboard-pbx',
              health: { source: 'SSH', freshness: 'CURRENT' },
              consecutiveFailures: 0,
            },
          });
        }
        if (path.startsWith('/api/pbx-instances/dashboard-pbx/system-metrics/history?')) {
          return response({
            items: [
              {
                instanceId: 'dashboard-pbx',
                source: 'SSH',
                observedAt: '2026-10-05T03:00:00.000Z',
                cpu: { utilizationPercent: 20 },
                memory: { totalBytes: 8589934592, availableBytes: 5368709120 },
              },
              {
                instanceId: 'dashboard-pbx',
                source: 'SSH',
                observedAt: '2026-10-05T04:00:00.000Z',
                cpu: { utilizationPercent: 12.5 },
                memory: { totalBytes: 8589934592, availableBytes: 6442450944 },
              },
            ],
          });
        }
        if (path === '/api/pbx-instances/dashboard-pbx/security-alerts') {
          return response({
            current: [
              {
                instanceId: 'dashboard-pbx',
                ruleId: 'AUTHENTICATION_FAILURE_ANY',
                observedAt: '2026-10-05T04:00:00.000Z',
                matchedEventCount: 1,
              },
            ],
          });
        }
        if (path === '/api/pbx-instances/dashboard-pbx/telephony-state') {
          return response({
            current: {
              instanceId: 'dashboard-pbx',
              revision: 8,
              synchronization: 'CURRENT',
              lastSnapshotAt: '2026-10-05T04:00:00.000Z',
              channels: [
                {
                  channelId: 'channel-1',
                  linkedId: 'call-1',
                  state: 'Up',
                  bridgeId: 'bridge-1',
                  updatedAt: '2026-10-05T04:00:01.000Z',
                },
              ],
              calls: [
                {
                  callId: 'call-1',
                  linkedId: 'call-1',
                  channelIds: ['channel-1'],
                  bridgeIds: ['bridge-1'],
                  updatedAt: '2026-10-05T04:00:01.000Z',
                },
              ],
              endpointCapability: 'SUPPORTED',
              endpointSynchronization: 'CURRENT',
              endpoints: [
                {
                  endpointId: 'SIP/100',
                  registrationState: 'REGISTERED',
                  reachability: 'REACHABLE',
                  updatedAt: '2026-10-05T04:00:01.000Z',
                  reliability: {
                    availability: 'ONLINE',
                    lastReachableAt: '2026-10-05T04:00:01.000Z',
                    flapCount: 0,
                    recentTransitions: [],
                  },
                },
              ],
              trunkCapability: 'SUPPORTED',
              trunkSynchronization: 'CURRENT',
              trunks: [
                {
                  trunkId: 'SIP/trunk@example.test',
                  kind: 'OUTBOUND_REGISTRATION',
                  technology: 'CHAN_SIP',
                  confidence: 'CONFIRMED',
                  registrationState: 'REGISTERED',
                  updatedAt: '2026-10-05T04:00:01.000Z',
                  reliability: {
                    availability: 'UP',
                    lastUpAt: '2026-10-05T04:00:01.000Z',
                    flapCount: 0,
                    reconnectCount: 0,
                    recentTransitions: [],
                  },
                },
              ],
              queueCapability: 'SUPPORTED',
              queueSynchronization: 'CURRENT',
              queues: [
                {
                  queueId: 'support',
                  waitingCount: 1,
                  updatedAt: '2026-10-05T04:00:01.000Z',
                },
              ],
              queueMembers: [
                {
                  queueId: 'support',
                  memberId: 'SIP/100',
                  availability: 'AVAILABLE',
                  paused: false,
                  inCall: false,
                  updatedAt: '2026-10-05T04:00:01.000Z',
                },
              ],
              queueCallers: [
                {
                  queueId: 'support',
                  callerId: 'caller-1',
                  position: 1,
                  waitSeconds: 12,
                  updatedAt: '2026-10-05T04:00:01.000Z',
                },
              ],
              agentCapability: 'SUPPORTED',
              agentSynchronization: 'LIVE_ONLY',
              agentInteractions: [
                {
                  queueId: 'support',
                  callerId: 'caller-1',
                  memberId: 'SIP/100',
                  memberName: 'Agent 100',
                  phase: 'RINGING',
                  updatedAt: '2026-10-05T04:00:01.000Z',
                },
              ],
            },
          });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <OperatorDashboard text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );

    expect(container.textContent).toContain('Operator dashboard');
    expect(container.textContent).toContain('Connected');
    expect(container.textContent).toContain('12.5%');
    expect(container.textContent).toContain('2.0 GiB / 8.0 GiB');
    expect(container.textContent).toContain('1d 1h');
    expect(container.textContent).toContain('Current security alerts');
    expect(container.textContent).toContain('Telephony overview');
    expect(container.textContent).toContain('Current calls');
    expect(container.textContent).toContain('Endpoint reachability');
    expect(container.textContent).toContain('Queue pressure');
    expect(container.textContent).toContain('Persian date & time');
    expect(container.textContent).toContain('System performance trend');
    expect(container.textContent).toContain('Storage / filesystems');
    expect(container.querySelectorAll('[data-storage-filesystem]')).toHaveLength(1);
    expect(container.textContent).toContain('/data');
    expect(container.textContent).toContain('Service health');
    expect(container.textContent).toContain('asterisk.service');
    expect(container.textContent).not.toContain('call-1');
    expect(container.textContent).toContain('Agent interactions1');

    const telephonyStream = FakeEventSource.instances.get(
      '/api/pbx-instances/dashboard-pbx/telephony-state/stream',
    );
    expect(telephonyStream).toBeDefined();
    await act(async () => {
      telephonyStream?.emit('telephony-state', {
        current: {
          instanceId: 'dashboard-pbx',
          revision: 9,
          synchronization: 'STALE',
          lastSnapshotAt: '2026-10-05T04:00:00.000Z',
          channels: [],
          calls: [],
          endpointCapability: 'SUPPORTED',
          endpointSynchronization: 'STALE',
          endpoints: [],
          trunkCapability: 'SUPPORTED',
          trunkSynchronization: 'STALE',
          trunks: [],
          queueCapability: 'SUPPORTED',
          queueSynchronization: 'STALE',
          queues: [],
          queueMembers: [],
          queueCallers: [],
          agentCapability: 'SUPPORTED',
          agentSynchronization: 'STALE',
          agentInteractions: [],
        },
      });
    });
    expect(container.textContent).toContain('Stale');
    expect(container.textContent).toContain('Revision: 9');
    expect(container.textContent).not.toContain('Agent 100');
    expect(container.textContent).toContain('Agent interactions0');
  });
});

describe('telephony entity workspace', () => {
  const profile = {
    id: 'entity-pbx',
    displayName: 'Entity PBX',
    providerType: 'ASTERISK',
    enabled: true,
    amiHost: 'pbx.example.test',
    amiPort: 5038,
    amiUsername: 'synthetic-user',
    hasAmiPassword: true,
    connectionStatus: 'CONNECTED',
    createdAt: '',
    updatedAt: '',
  } as const;

  it('filters closed channels, searches current state, and paginates bounded rows', async () => {
    class FakeEventSource {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      addEventListener() {}
      close() {}
      constructor(readonly url: string) {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    const channels = Array.from({ length: 25 }, (_, index) => ({
      channelId: `active-${String(index + 1).padStart(2, '0')}`,
      channelName: `SIP/${100 + index}`,
      state: 'Up',
      updatedAt: '2026-10-05T04:00:01.000Z',
    }));
    channels.push({
      channelId: 'closed-channel',
      channelName: 'SIP/999',
      state: 'Down',
      updatedAt: '2026-10-05T04:00:01.000Z',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/entity-pbx/telephony-state') {
          return response({
            current: {
              instanceId: 'entity-pbx',
              revision: 1,
              synchronization: 'CURRENT',
              lastSnapshotAt: '2026-10-05T04:00:00.000Z',
              channels,
              calls: [],
              endpointCapability: 'SUPPORTED',
              endpointSynchronization: 'CURRENT',
              endpoints: [],
              trunkCapability: 'SUPPORTED',
              trunkSynchronization: 'CURRENT',
              trunks: [],
              queueCapability: 'SUPPORTED',
              queueSynchronization: 'CURRENT',
              queues: [],
              queueMembers: [],
              queueCallers: [],
              agentCapability: 'SUPPORTED',
              agentSynchronization: 'LIVE_ONLY',
              agentInteractions: [],
            },
          });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <TelephonyWorkspace
          text={messages.en}
          profiles={[profile]}
          page="channels"
          onUnauthorized={() => {}}
        />,
      ),
    );

    expect(container.textContent).toContain('Results: 25');
    expect(container.textContent).toContain('active-01');
    expect(container.textContent).not.toContain('closed-channel');
    expect(container.textContent).not.toContain('active-25');

    const next = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Next',
    );
    await act(async () => next?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('active-25');

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search current state…"]',
    );
    expect(search).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'active-03');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Results: 1');
    expect(container.textContent).toContain('active-03');
    expect(container.textContent).not.toContain('active-25');
  });

  it('renders endpoint reliability and ranks offline endpoints first', async () => {
    class FakeEventSource {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      addEventListener() {}
      close() {}
      constructor(readonly url: string) {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/entity-pbx/telephony-state') {
          return response({
            current: {
              instanceId: 'entity-pbx',
              revision: 3,
              synchronization: 'CURRENT',
              lastSnapshotAt: '2026-10-07T06:10:00.000Z',
              channels: [],
              calls: [],
              endpointCapability: 'SUPPORTED',
              endpointSynchronization: 'CURRENT',
              endpoints: [
                {
                  endpointId: 'PJSIP/200',
                  registrationState: 'REGISTERED',
                  reachability: 'REACHABLE',
                  updatedAt: '2026-10-07T06:10:00.000Z',
                  reliability: {
                    availability: 'ONLINE',
                    lastReachableAt: '2026-10-07T06:10:00.000Z',
                    flapCount: 0,
                    recentTransitions: [],
                  },
                },
                {
                  endpointId: 'PJSIP/100',
                  registrationState: 'UNREGISTERED',
                  reachability: 'UNREACHABLE',
                  updatedAt: '2026-10-07T06:09:00.000Z',
                  reliability: {
                    availability: 'OFFLINE',
                    lastReachableAt: '2026-10-07T06:00:00.000Z',
                    lastUnreachableAt: '2026-10-07T06:09:00.000Z',
                    offlineStartedAt: '2026-10-07T06:09:00.000Z',
                    offlineDurationSeconds: 60,
                    flapCount: 4,
                    recentTransitions: [
                      {
                        observedAt: '2026-10-07T06:09:00.000Z',
                        from: 'ONLINE',
                        to: 'OFFLINE',
                        registrationState: 'UNREGISTERED',
                        reachability: 'UNREACHABLE',
                        source: 'EVENT',
                      },
                    ],
                  },
                },
              ],
              trunkCapability: 'SUPPORTED',
              trunkSynchronization: 'CURRENT',
              trunks: [],
              queueCapability: 'SUPPORTED',
              queueSynchronization: 'CURRENT',
              queues: [],
              queueMembers: [],
              queueCallers: [],
              agentCapability: 'SUPPORTED',
              agentSynchronization: 'LIVE_ONLY',
              agentInteractions: [],
            },
          });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <TelephonyWorkspace
          text={messages.en}
          profiles={[profile]}
          page="endpoints"
          onUnauthorized={() => {}}
        />,
      ),
    );
    expect(container.textContent).toContain('Availability');
    expect(container.textContent).toContain('Last reachable');
    expect(container.textContent).toContain('Last unreachable');
    expect(container.textContent).toContain('Offline');
    expect(container.textContent).toContain('Flaps');
    expect(container.textContent).toContain('Recent transitions');
    expect(container.textContent).toContain('ONLINE→OFFLINE');
    const text = container.textContent ?? '';
    expect(text.indexOf('PJSIP/100')).toBeLessThan(text.indexOf('PJSIP/200'));
  });

  it('renders confirmed registrations separately from candidate peer trunks', async () => {
    class FakeEventSource {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      addEventListener() {}
      close() {}
      constructor(readonly url: string) {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/entity-pbx/telephony-state') {
          return response({
            current: {
              instanceId: 'entity-pbx',
              revision: 2,
              synchronization: 'CURRENT',
              lastSnapshotAt: '2026-10-05T04:00:00.000Z',
              channels: [],
              calls: [],
              endpointCapability: 'SUPPORTED',
              endpointSynchronization: 'CURRENT',
              endpoints: [],
              trunkCapability: 'SUPPORTED',
              trunkSynchronization: 'CURRENT',
              trunks: [
                {
                  trunkId: 'PJSIP/carrier-east',
                  technology: 'PJSIP',
                  kind: 'OUTBOUND_REGISTRATION',
                  confidence: 'CONFIRMED',
                  registrationState: 'FAILED',
                  updatedAt: '2026-10-05T04:00:05.000Z',
                  reliability: {
                    availability: 'DOWN',
                    lastUpAt: '2026-10-05T03:59:00.000Z',
                    lastDownAt: '2026-10-05T04:00:05.000Z',
                    outageStartedAt: '2026-10-05T04:00:05.000Z',
                    outageDurationSeconds: 10,
                    flapCount: 3,
                    reconnectCount: 2,
                    recentTransitions: [
                      {
                        observedAt: '2026-10-05T04:00:05.000Z',
                        from: 'UP',
                        to: 'DOWN',
                        registrationState: 'FAILED',
                        source: 'EVENT',
                      },
                    ],
                  },
                },
                {
                  trunkId: 'SIP/static-carrier',
                  technology: 'CHAN_SIP',
                  kind: 'PEER',
                  confidence: 'CANDIDATE',
                  registrationState: 'NOT_APPLICABLE',
                  reachability: 'REACHABLE',
                  updatedAt: '2026-10-05T04:00:01.000Z',
                  reliability: {
                    availability: 'UP',
                    lastUpAt: '2026-10-05T04:00:01.000Z',
                    flapCount: 0,
                    reconnectCount: 0,
                    recentTransitions: [],
                  },
                },
              ],
              queueCapability: 'SUPPORTED',
              queueSynchronization: 'CURRENT',
              queues: [],
              queueMembers: [],
              queueCallers: [],
              agentCapability: 'SUPPORTED',
              agentSynchronization: 'LIVE_ONLY',
              agentInteractions: [],
            },
          });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <TelephonyWorkspace
          text={messages.en}
          profiles={[profile]}
          page="trunks"
          onUnauthorized={() => {}}
        />,
      ),
    );

    expect(container.textContent).toContain('Technology');
    expect(container.textContent).toContain('Classification');
    expect(container.textContent).toContain('PJSIP');
    expect(container.textContent).toContain('CONFIRMED');
    expect(container.textContent).toContain('CHAN_SIP');
    expect(container.textContent).toContain('CANDIDATE');
    expect(container.textContent).toContain('NOT_APPLICABLE');
    expect(container.textContent).toContain('REACHABLE');
    expect(container.textContent).toContain('Availability');
    expect(container.textContent).toContain('Last down');
    expect(container.textContent).toContain('Outage');
    expect(container.textContent).toContain('Flaps');
    expect(container.textContent).toContain('Reconnects');
    expect(container.textContent).toContain('Recent transitions');
    expect(container.textContent).toContain('DOWN');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('UP→DOWN');
    expect(container.textContent).toContain('Trunk discovery uses explicit confidence');
  });
});

describe('read-only database source workspace', () => {
  it('saves only PBX-scoped source configuration and clears the write-only password', async () => {
    const profile = {
      id: 'database-pbx',
      displayName: 'Database PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-user',
      hasAmiPassword: true,
      connectionStatus: 'CONNECTED',
      createdAt: '',
      updatedAt: '',
    } as const;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/pbx-instances/database-pbx/database-source' && init?.method === 'GET')
          return response({}, 404);
        if (path === '/api/pbx-instances/database-pbx/database-source' && init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as {
            credential?: string;
            accessMode?: string;
            dialect?: string;
            tlsMode?: string;
          };
          expect(body.credential).toBe('synthetic-database-password');
          expect(body.accessMode).toBe('READ_ONLY');
          expect(body.dialect).toBe('MYSQL_MARIADB');
          expect(body.tlsMode).toBe('REQUIRED');
          return response({
            pbxInstanceId: 'database-pbx',
            dialect: 'MYSQL_MARIADB',
            host: 'db.example.test',
            port: 3306,
            databaseName: 'pbx_reporting',
            username: 'readonly_monitor',
            accessMode: 'READ_ONLY',
            tlsMode: 'REQUIRED',
            hasCredential: true,
            createdAt: '',
            updatedAt: '',
          });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <DatabaseSourceWorkspace
          text={messages.en}
          profiles={[profile]}
          onUnauthorized={() => {}}
        />,
      ),
    );

    await enter('database-host', 'db.example.test');
    await enter('database-name', 'pbx_reporting');
    await enter('database-username', 'readonly_monitor');
    await enter('database-credential', 'synthetic-database-password');
    await submit();

    expect(container.textContent).toContain('Read-only database source configuration saved.');
    expect(input('database-credential').value).toBe('');
    expect(container.textContent).toContain('Read-only source; saving does not test connectivity');
    expect(container.textContent).not.toContain('synthetic-database-password');
  });
});

describe('source-backed history workspace', () => {
  it('inspects dataset support and loads only bounded normalized rows', async () => {
    const profile = {
      id: 'history-pbx',
      displayName: 'History PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-user',
      hasAmiPassword: true,
      connectionStatus: 'CONNECTED',
      createdAt: '',
      updatedAt: '',
    } as const;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/pbx-instances/history-pbx/history')
          return response({
            instanceId: 'history-pbx',
            source: 'DATABASE',
            adapter: 'ASTERISK_CONVENTIONAL_SQL_V1',
            calls: { availability: 'SUPPORTED' },
            callEvents: { availability: 'NOT_FOUND' },
            queueEvents: { availability: 'SCHEMA_MISMATCH' },
          });
        if (path === '/api/pbx-instances/history-pbx/history/calls?limit=100')
          return response({
            items: [
              {
                instanceId: 'history-pbx',
                source: 'DATABASE',
                recordId: 'call-1',
                sourceStartedAt: '2026-10-06 10:00:00',
                sourceNumber: '100',
                destinationNumber: '200',
                durationSeconds: 12,
                billableSeconds: 10,
                disposition: 'ANSWERED',
              },
            ],
          });
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <HistoryWorkspace text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );
    expect(container.textContent).toContain('Source-backed history');
    expect(container.textContent).toContain('SUPPORTED');
    expect(container.textContent).toContain('NOT_FOUND');

    const loadButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Load recent rows'),
    );
    await act(async () => loadButton?.click());

    expect(container.textContent).toContain('call-1');
    expect(container.textContent).toContain('ANSWERED');
    expect(container.textContent).toContain('2026-10-06 10:00:00');
  });
});

describe('SSH metrics management workspace', () => {
  it('loads only safe metadata and clears write-only credential after save', async () => {
    const profile = {
      id: 'ssh-pbx',
      displayName: 'SSH PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-user',
      hasAmiPassword: true,
      connectionStatus: 'CONNECTED',
      createdAt: '',
      updatedAt: '',
    } as const;
    const fingerprint = 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/pbx-instances/ssh-pbx/ssh-configuration' && init?.method === 'GET')
          return response({}, 404);
        if (path === '/api/pbx-instances/ssh-pbx/ssh-configuration' && init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { credential?: string };
          expect(body.credential).toBe('synthetic-ssh-password');
          return response({
            pbxInstanceId: 'ssh-pbx',
            host: 'pbx.example.test',
            port: 22,
            username: 'monitor',
            authMethod: 'PASSWORD',
            hostKeyPolicy: 'PINNED_SHA256',
            hostKeyFingerprint: fingerprint,
            hasCredential: true,
            hasPrivateKeyPassphrase: false,
            createdAt: '',
            updatedAt: '',
          });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <SshMetricsWorkspace text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );

    await enter('ssh-host', 'pbx.example.test');
    await enter('ssh-username', 'monitor');
    await enter('ssh-fingerprint', fingerprint);
    await enter('ssh-credential', 'synthetic-ssh-password');
    await submit();

    expect(container.textContent).toContain('SSH configuration saved and runtime synchronized.');
    expect(input('ssh-credential').value).toBe('');
    expect(container.textContent).not.toContain('synthetic-ssh-password');
  });
});

describe('dashboard storage settings', () => {
  it('lets an administrator persist only the filesystems chosen for the dashboard', async () => {
    const profile = {
      id: 'storage-pbx',
      displayName: 'Storage PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-user',
      hasAmiPassword: true,
      connectionStatus: 'CONNECTED',
      createdAt: '',
      updatedAt: '',
    } as const;
    const putBodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/pbx-instances/storage-pbx/system-metrics') {
          return response({
            current: {
              instanceId: 'storage-pbx',
              source: 'SSH',
              observedAt: '2026-10-05T04:00:00.000Z',
              filesystems: [
                {
                  filesystemId: '/dev/root',
                  mountPoint: '/',
                  totalBytes: 1000,
                  availableBytes: 400,
                },
                {
                  filesystemId: '/dev/recording',
                  mountPoint: '/recording',
                  totalBytes: 2000,
                  availableBytes: 1000,
                },
                {
                  filesystemId: 'tmpfs-dev',
                  mountPoint: '/dev',
                  totalBytes: 100,
                  availableBytes: 90,
                },
                {
                  filesystemId: 'tmpfs-run',
                  mountPoint: '/run',
                  totalBytes: 100,
                  availableBytes: 80,
                },
              ],
            },
          });
        }
        if (path === '/api/pbx-instances/storage-pbx/dashboard-storage' && init?.method === 'GET') {
          return response({ selectedFilesystemIds: null });
        }
        if (path === '/api/pbx-instances/storage-pbx/dashboard-storage' && init?.method === 'PUT') {
          putBodies.push(JSON.parse(String(init.body)));
          return response({ selectedFilesystemIds: ['/dev/root', '/dev/recording'] });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <DashboardStorageWorkspace
          text={messages.en}
          profiles={[profile]}
          onUnauthorized={() => {}}
        />,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('/recording');
    expect(container.textContent).toContain('/dev');
    expect(container.textContent).toContain('/run');
    const filesystemCheckboxes = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ];
    expect(filesystemCheckboxes).toHaveLength(4);
    for (const option of filesystemCheckboxes.slice(2)) {
      await act(async () => option.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    }
    const save = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save dashboard storage',
    );
    await act(async () => save?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(putBodies).toEqual([{ selectedFilesystemIds: ['/dev/root', '/dev/recording'] }]);
  });
});

describe('dashboard builder', () => {
  it('loads a persisted layout and supports widget edit/delete controls without a new collector', async () => {
    class FakeEventSource {
      onopen = null;
      onerror = null;
      addEventListener() {}
      close() {}
      constructor(readonly url: string) {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    const profile = {
      id: 'builder-pbx',
      displayName: 'Builder PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-user',
      hasAmiPassword: true,
      connectionStatus: 'CONNECTED',
      createdAt: '',
      updatedAt: '',
    } as const;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path) => {
        if (path === '/api/pbx-instances/builder-pbx/provider-status')
          return response({ connectionStatus: 'CONNECTED', managed: true, networkEnabled: true });
        if (path === '/api/pbx-instances/builder-pbx/system-metrics')
          return response({
            current: {
              instanceId: 'builder-pbx',
              source: 'SSH',
              observedAt: '2026-10-05T04:00:00.000Z',
              cpu: { utilizationPercent: 12 },
            },
            source: {
              instanceId: 'builder-pbx',
              health: { source: 'SSH', freshness: 'CURRENT' },
              consecutiveFailures: 0,
            },
          });
        if (path === '/api/pbx-instances/builder-pbx/dashboard-storage')
          return response({ selectedFilesystemIds: null });
        if (path.startsWith('/api/pbx-instances/builder-pbx/system-metrics/history?'))
          return response({ items: [] });
        if (path === '/api/pbx-instances/builder-pbx/security-alerts')
          return response({ current: [], history: [] });
        if (path === '/api/pbx-instances/builder-pbx/telephony-state')
          return response({
            current: {
              instanceId: 'builder-pbx',
              revision: 1,
              synchronization: 'CURRENT',
              lastSnapshotAt: '2026-10-05T04:00:00.000Z',
              channels: [],
              calls: [],
              endpointCapability: 'SUPPORTED',
              endpointSynchronization: 'CURRENT',
              endpoints: [],
              trunkCapability: 'SUPPORTED',
              trunkSynchronization: 'CURRENT',
              trunks: [],
              queueCapability: 'SUPPORTED',
              queueSynchronization: 'CURRENT',
              queues: [],
              queueMembers: [],
              queueCallers: [],
              agentCapability: 'SUPPORTED',
              agentSynchronization: 'LIVE_ONLY',
              agentInteractions: [],
            },
          });
        if (path === '/api/pbx-instances/builder-pbx/dashboards')
          return response({
            items: [
              {
                id: 'dash-1',
                pbxInstanceId: 'builder-pbx',
                name: 'TV',
                widgets: [
                  { id: 'clock', type: 'clock', width: 3, height: 1 },
                  { id: 'cpu', type: 'cpu', width: 3, height: 2 },
                  { id: 'service', type: 'service-health', width: 4, height: 2 },
                ],
                createdAt: '',
                updatedAt: '',
              },
            ],
          });
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <DashboardBuilder text={messages.en} profiles={[profile]} onUnauthorized={() => {}} />,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-operator-overview]')).not.toBeNull();
    expect(container.querySelectorAll('[data-dashboard-widget]')).toHaveLength(0);
    expect(container.textContent).toContain('Current problems');
    expect(container.textContent).toContain('Infrastructure health');
    expect(container.textContent).toContain('Full screen');
    expect(container.textContent).toContain('Wallboard');

    const wallboard = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Wallboard',
    );
    await act(async () => wallboard?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-dashboard-root]')?.getAttribute('data-wallboard')).toBe(
      'true',
    );
    expect(container.querySelector('[data-dashboard-toolbar]')).toBeNull();
    expect(container.textContent).toContain('Exit wallboard');
    const exitWallboard = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Exit wallboard',
    );
    await act(async () => exitWallboard?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-dashboard-root]')?.getAttribute('data-wallboard')).toBe(
      'false',
    );
    expect(container.querySelector('[data-dashboard-toolbar]')).not.toBeNull();

    const edit = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Edit dashboard',
    );
    await act(async () => edit?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-operator-overview]')).toBeNull();
    expect(container.querySelectorAll('[data-dashboard-widget]')).toHaveLength(3);
    expect(container.textContent).toContain('TV');
    expect(container.textContent).toContain('Drag widgets to reorder them.');
    const remove = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '×',
    );
    await act(async () => remove?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelectorAll('[data-dashboard-widget]')).toHaveLength(2);

    const dashboardRoot = container.querySelector('[data-dashboard-root]');
    expect(dashboardRoot).not.toBeNull();
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => dashboardRoot,
    });
    await act(async () => document.dispatchEvent(new Event('fullscreenchange')));

    expect(container.querySelector('[data-dashboard-toolbar]')).toBeNull();
    expect(container.querySelector('[data-dashboard-fullscreen-exit]')).not.toBeNull();
    expect(container.textContent).not.toContain('New dashboard');
    expect(container.textContent).not.toContain('Edit dashboard');
    expect(container.textContent).not.toContain('Dashboard PBX');
    expect(container.textContent).not.toContain('Drag widgets to reorder them.');

    delete (document as unknown as Record<string, unknown>).fullscreenElement;
  });
});

describe('service monitoring settings', () => {
  it('persists explicit bounded service IDs instead of hardcoding deployment services', async () => {
    const profile = {
      id: 'service-pbx',
      displayName: 'Service PBX',
      providerType: 'ASTERISK',
      enabled: true,
      amiHost: 'pbx.example.test',
      amiPort: 5038,
      amiUsername: 'synthetic-user',
      hasAmiPassword: true,
      connectionStatus: 'CONNECTED',
      createdAt: '',
      updatedAt: '',
    } as const;
    const writes: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path, init) => {
        if (path === '/api/pbx-instances/service-pbx/service-monitoring' && init?.method === 'GET')
          return response({ serviceIds: [] });
        if (
          path === '/api/pbx-instances/service-pbx/service-monitoring' &&
          init?.method === 'PUT'
        ) {
          writes.push(JSON.parse(String(init.body)));
          return response({ serviceIds: ['synthetic.service', 'synthetic-helper.service'] });
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <ServiceMonitoringWorkspace
          text={messages.en}
          profiles={[profile]}
          onUnauthorized={() => {}}
        />,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const area = container.querySelector('textarea');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, 'synthetic.service\nsynthetic-helper.service');
      area?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save service monitoring',
    );
    await act(async () => save?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(writes).toEqual([{ serviceIds: ['synthetic.service', 'synthetic-helper.service'] }]);
  });
});

describe('account management settings', () => {
  it('shows safe account metadata and creates a local administrator without rendering the password', async () => {
    const principal = { id: 'admin-id', username: 'admin' };
    const createBodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path, init) => {
        if (path === '/api/admin/accounts' && init?.method === 'GET') {
          return response({
            items: [
              {
                id: 'admin-id',
                username: 'admin',
                enabled: true,
                role: 'ADMINISTRATOR',
                createdAt: '2026-10-05T00:00:00.000Z',
                updatedAt: '2026-10-05T00:00:00.000Z',
                lastLoginAt: '2026-10-05T01:00:00.000Z',
              },
            ],
          });
        }
        if (path === '/api/admin/accounts' && init?.method === 'POST') {
          createBodies.push(JSON.parse(String(init.body)));
          return response(
            {
              id: 'ui-test-id',
              username: 'ui-test',
              enabled: true,
              role: 'ADMINISTRATOR',
              createdAt: '2026-10-05T02:00:00.000Z',
              updatedAt: '2026-10-05T02:00:00.000Z',
            },
            201,
          );
        }
        throw new Error('unexpected API route: ' + path);
      }),
    );

    await act(async () =>
      root.render(
        <AccountsWorkspace text={messages.en} principal={principal} onUnauthorized={() => {}} />,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Users & accounts');
    expect(container.textContent).toContain('Administrator');
    expect(container.textContent).toContain('CURRENT');

    const inputs = [...container.querySelectorAll('input')];
    const usernameInput = inputs.find(
      (item) => item.getAttribute('dir') === 'ltr' && item.type === 'text',
    );
    const passwordInput = inputs.find((item) => item.type === 'password');
    const password = 'synthetic ui automation passphrase';
    await act(async () => {
      const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      inputSetter?.call(usernameInput, 'UI-Test');
      usernameInput?.dispatchEvent(new Event('input', { bubbles: true }));
      inputSetter?.call(passwordInput, password);
      passwordInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const create = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Create account',
    );
    await act(async () => create?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(createBodies).toEqual([{ username: 'UI-Test', password }]);
    expect(container.textContent).not.toContain(password);
  });
});

describe('fleet overview', () => {
  it('renders cross-PBX health and drills into the selected PBX', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/fleet-overview')
          return response({
            observedAt: '2026-10-07T01:00:00.000Z',
            healthCounts: { HEALTHY: 1, DEGRADED: 0, CRITICAL: 1, UNKNOWN: 0, STALE: 0 },
            totalPbx: 2,
            activeCalls: 3,
            trunkFailures: 1,
            endpointFailures: 2,
            waitingCallers: 4,
            criticalAlerts: 1,
            items: [
              {
                instanceId: 'critical-id',
                displayName: 'Critical PBX',
                enabled: true,
                health: { instanceId: 'critical-id', overall: 'CRITICAL', components: {} },
                activeCalls: 2,
                trunkFailures: 1,
                endpointFailures: 2,
                waitingCallers: 4,
                criticalAlerts: 1,
              },
              {
                instanceId: 'healthy-id',
                displayName: 'Healthy PBX',
                enabled: true,
                health: { instanceId: 'healthy-id', overall: 'HEALTHY', components: {} },
                activeCalls: 1,
                trunkFailures: 0,
                endpointFailures: 0,
                waitingCallers: 0,
                criticalAlerts: 0,
              },
            ],
          });
        return response({}, 404);
      }),
    );
    const opened: string[] = [];
    await act(async () => {
      root.render(
        <FleetOverviewWorkspace
          text={messages.en}
          onUnauthorized={() => {}}
          onOpenPbx={(id) => opened.push(id)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('PBX Fleet');
    expect(container.textContent).toContain('Critical PBX');
    expect(container.textContent).toContain('Healthy PBX');
    expect(container.textContent).toContain('Trunk failures');
    const open = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Open PBX',
    );
    await act(async () => open?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(opened).toEqual(['critical-id']);
  });
});
