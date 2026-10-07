import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, PbxWorkspace } from '../src/App.js';
import { createApplicationEmotionCache } from '../src/emotion-cache.js';
import { SecurityWorkspace } from '../src/SecurityWorkspace.js';
import { messages } from '../src/i18n.js';
import { OperatorOverview } from '../src/OperatorOverview.js';
import { nocSystem } from '../src/theme.js';

function renderUi(node: ReactNode) {
  return renderToStaticMarkup(<ChakraProvider value={nocSystem}>{node}</ChakraProvider>);
}

describe('emotion CSP integration', () => {
  it('copies the gateway nonce into the Emotion cache', () => {
    const documentWithNonce = {
      querySelector: () => ({ content: 'nonce-for-test' }),
    } as unknown as Document;

    const cache = createApplicationEmotionCache(documentWithNonce);

    expect(cache.nonce).toBe('nonce-for-test');
  });
});

describe('bilingual onboarding shell', () => {
  it('renders first administrator setup in English left to right', () => {
    const html = renderUi(<App initialLanguage="en" initialView="setup" />);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Create first administrator');
    expect(html).toContain('name="bootstrap-token"');
    expect(html).toContain('name="confirm-password"');
    expect(html).toContain('name="bootstrap-token" value=""');
  });
  it('renders login in Persian right to left', () => {
    const html = renderUi(<App initialLanguage="fa" initialView="login" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('ورود مدیر');
    expect(html).toContain('type="password"');
  });
  it('renders the approved NOC application shell in English', () => {
    const html = renderUi(<App initialLanguage="en" initialView="ready" />);
    expect(html).toContain('data-app-shell="true"');
    expect(html).toContain('data-app-sidebar="true"');
    expect(html).toContain('data-app-topbar="true"');
    expect(html).toContain('data-skip-link="true"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('Overview');
    expect(html).toContain('PBX Fleet');
    expect(html).toContain('Live Calls');
    expect(html).toContain('Infrastructure');
    expect(html).toContain('Call History');
  });

  it('keeps the approved shell RTL-aware in Persian', () => {
    const html = renderUi(<App initialLanguage="fa" initialView="ready" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('نمای کلی');
    expect(html).toContain('تماس‌های زنده');
    expect(html).toContain('زیرساخت');
  });

  it('renders an authenticated first PBX form before a connection test is available', () => {
    const html = renderUi(<App initialLanguage="en" initialView="ready" />);
    expect(html).toContain('Add the first PBX profile');
    expect(html).toContain('Asterisk / FreePBX');
    expect(html).toContain('name="ami-password"');
    expect(html).not.toContain('Test Connection');
  });
  it('shows only credential presence and unverified status for a saved profile', () => {
    const html = renderUi(
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
    const html = renderUi(
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

describe('problem-first operator overview', () => {
  it('promotes current operational problems ahead of secondary metrics', () => {
    const html = renderUi(
      <OperatorOverview
        text={messages.en}
        instanceId="synthetic-id"
        connection="CONNECTED"
        metrics={{
          current: {
            instanceId: 'synthetic-id',
            source: 'SSH',
            observedAt: '2026-10-06T00:00:00.000Z',
            cpu: { utilizationPercent: 92 },
            memory: { totalBytes: 1000, availableBytes: 50 },
            filesystems: [
              { filesystemId: '/', mountPoint: '/', totalBytes: 1000, availableBytes: 40 },
            ],
            uptime: { uptimeSeconds: 90000 },
            services: [{ serviceId: 'asterisk.service', state: 'FAILED' }],
          },
          source: {
            instanceId: 'synthetic-id',
            health: { source: 'SSH', freshness: 'CURRENT' },
            consecutiveFailures: 0,
          },
        }}
        metricHistory={[]}
        alerts={[
          {
            instanceId: 'synthetic-id',
            ruleId: 'AUTHENTICATION_FAILURE_ANY',
            observedAt: '2026-10-06T00:00:00.000Z',
            matchedEventCount: 1,
          },
        ]}
        telephony={{
          instanceId: 'synthetic-id',
          revision: 1,
          synchronization: 'CURRENT',
          lastSnapshotAt: '2026-10-06T00:00:00.000Z',
          channels: [],
          calls: [],
          endpointCapability: 'SUPPORTED',
          endpointSynchronization: 'CURRENT',
          endpoints: [
            {
              endpointId: 'SIP/100',
              registrationState: 'REGISTERED',
              reachability: 'UNREACHABLE',
              updatedAt: '2026-10-06T00:00:00.000Z',
            },
          ],
          trunkCapability: 'SUPPORTED',
          trunkSynchronization: 'CURRENT',
          trunks: [
            {
              trunkId: 'SIP/provider.example.test',
              kind: 'OUTBOUND_REGISTRATION',
              technology: 'CHAN_SIP',
              confidence: 'CONFIRMED',
              registrationState: 'UNREGISTERED',
              updatedAt: '2026-10-06T00:00:00.000Z',
              reliability: {
                availability: 'DOWN',
                lastDownAt: '2026-10-06T00:00:00.000Z',
                outageStartedAt: '2026-10-06T00:00:00.000Z',
                outageDurationSeconds: 0,
                flapCount: 0,
                reconnectCount: 0,
                recentTransitions: [],
              },
            },
          ],
          queueCapability: 'SUPPORTED',
          queueSynchronization: 'CURRENT',
          queues: [{ queueId: 'support', waitingCount: 6, updatedAt: '2026-10-06T00:00:00.000Z' }],
          queueMembers: [],
          queueCallers: [],
          agentCapability: 'SUPPORTED',
          agentSynchronization: 'LIVE_ONLY',
          agentInteractions: [],
        }}
        metricsLive="connected"
        alertsLive="connected"
        telephonyLive="connected"
        visibleFilesystems={[
          { filesystemId: '/', mountPoint: '/', totalBytes: 1000, availableBytes: 40 },
        ]}
      />,
    );
    expect(html).toContain('data-operator-overview="true"');
    expect(html).toContain('Critical');
    expect(html).toContain('Current problems');
    expect(html).toContain('Current security alerts');
    expect(html).toContain('Trunks');
    expect(html).toContain('Endpoints');
    expect(html).toContain('Infrastructure health');
  });
});
