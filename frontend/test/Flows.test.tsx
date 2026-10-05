// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, FirstAdminForm, LoginForm, PbxWorkspace } from '../src/App.js';
import { SecurityWorkspace } from '../src/SecurityWorkspace.js';
import { SshMetricsWorkspace } from '../src/SshMetricsWorkspace.js';
import { OperatorDashboard } from '../src/OperatorDashboard.js';
import { TelephonyWorkspace } from '../src/TelephonyWorkspace.js';
import { messages } from '../src/i18n.js';

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
      reactRoot.render(<ChakraProvider value={defaultSystem}>{children}</ChakraProvider>);
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
                },
              ],
              trunkCapability: 'SUPPORTED',
              trunkSynchronization: 'CURRENT',
              trunks: [
                {
                  trunkId: 'SIP/trunk@example.test',
                  kind: 'OUTBOUND_REGISTRATION',
                  registrationState: 'REGISTERED',
                  updatedAt: '2026-10-05T04:00:01.000Z',
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
    expect(container.querySelectorAll('[data-storage-filesystem]')).toHaveLength(2);
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
        if (
          path === '/api/pbx-instances/ssh-pbx/ssh-configuration' &&
          (!init || init.method === undefined)
        )
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
