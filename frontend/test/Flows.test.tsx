// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, FirstAdminForm, LoginForm, PbxWorkspace } from '../src/App.js';
import { SecurityWorkspace } from '../src/SecurityWorkspace.js';
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
  root = createRoot(container);
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
    expect(container.querySelectorAll('.security-alerts li')).toHaveLength(2);
  });
});
