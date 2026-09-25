// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, FirstAdminForm, LoginForm, PbxWorkspace } from '../src/App.js';
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
});
