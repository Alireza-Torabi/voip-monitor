import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, PbxWorkspace } from '../src/App.js';
import { SecurityWorkspace } from '../src/SecurityWorkspace.js';
import { messages } from '../src/i18n.js';

describe('bilingual onboarding shell', () => {
  it('renders first administrator setup in English left to right', () => {
    const html = renderToStaticMarkup(<App initialLanguage="en" initialView="setup" />);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Create first administrator');
    expect(html).toContain('name="bootstrap-token"');
    expect(html).toContain('name="confirm-password"');
    expect(html).toContain('name="bootstrap-token" value=""');
  });
  it('renders login in Persian right to left', () => {
    const html = renderToStaticMarkup(<App initialLanguage="fa" initialView="login" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('ورود مدیر');
    expect(html).toContain('type="password"');
  });
  it('renders an authenticated first PBX form before a connection test is available', () => {
    const html = renderToStaticMarkup(<App initialLanguage="en" initialView="ready" />);
    expect(html).toContain('Add the first PBX profile');
    expect(html).toContain('Asterisk / FreePBX');
    expect(html).toContain('name="ami-password"');
    expect(html).not.toContain('Test Connection');
  });
  it('shows only credential presence and unverified status for a saved profile', () => {
    const html = renderToStaticMarkup(
      <PbxWorkspace
        text={messages.en}
        profiles={[
          {
            id: 'synthetic-id',
            displayName: 'Synthetic PBX',
            providerType: 'ASTERISK',
            enabled: true,
            amiHost: 'pbx.example.test',
            amiPort: 5038,
            amiUsername: 'synthetic-user',
            hasAmiPassword: true,
            connectionStatus: 'DISCONNECTED',
            lastVerifiedAt: '2026-09-25T00:00:00.000Z',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        onRefresh={async () => {}}
        onUnauthorized={() => {}}
      />,
    );
    expect(html).toContain('Disconnected');
    expect(html).toContain('Password configured');
    expect(html).toContain('Test connection');
    expect(html).toContain('2026-09-25T00:00:00.000Z');
    expect(html).not.toContain('synthetic-ami-secret');
  });

  it('renders bounded security monitoring controls for a configured PBX', () => {
    const html = renderToStaticMarkup(
      <SecurityWorkspace
        text={messages.en}
        profiles={[
          {
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
          },
        ]}
        onUnauthorized={() => {}}
      />,
    );
    expect(html).toContain('Security monitoring');
    expect(html).toContain('Current alerts');
    expect(html).toContain('Any authentication failure');
    expect(html).toContain('Authentication failure threshold');
    expect(html).toContain('name="rule-threshold"');
    expect(html).toContain('max="100"');
    expect(html).toContain('name="rule-window-seconds"');
    expect(html).toContain('max="3600"');
  });
});
