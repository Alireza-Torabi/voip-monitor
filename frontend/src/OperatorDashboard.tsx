import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type PbxConnectionState,
  type PbxProfile,
  type SecurityAlertRecord,
  type SystemMetricsResponse,
} from './api.js';
import { messages, type Language } from './i18n.js';

type Text = (typeof messages)[Language];
type LiveState = 'connecting' | 'connected' | 'disconnected';

function connectionLabel(text: Text, state: PbxConnectionState) {
  if (state === 'CONNECTED') return text.connected;
  if (state === 'CONNECTING') return text.connecting;
  if (state === 'DISCONNECTED') return text.disconnected;
  if (state === 'DEGRADED') return text.degraded;
  if (state === 'ERROR') return text.connectionError;
  return text.unverified;
}

function formatBytes(value: number | undefined) {
  if (value === undefined) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let index = 0;
  let current = value;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(seconds: number | undefined) {
  if (seconds === undefined) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export function OperatorDashboard({
  text,
  profiles,
  onUnauthorized,
}: {
  text: Text;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [connection, setConnection] = useState<PbxConnectionState>(
    profiles[0]?.connectionStatus ?? 'UNVERIFIED',
  );
  const [metrics, setMetrics] = useState<SystemMetricsResponse>();
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [metricsLive, setMetricsLive] = useState<LiveState>('connecting');
  const [alertsLive, setAlertsLive] = useState<LiveState>('connecting');
  const [error, setError] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length === 0) {
      setSelectedId('');
      return;
    }
    if (selected) return;
    setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setConnection(selected.connectionStatus);
    setMetrics(undefined);
    setAlerts([]);
    setError('');
    setMetricsLive('connecting');
    setAlertsLive('connecting');

    const refreshProvider = () =>
      api
        .providerStatus(selected.id)
        .then((value) => {
          if (!cancelled) setConnection(value.connectionStatus);
        })
        .catch((failure: unknown) => {
          if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
          else if (!(failure instanceof ApiError && failure.code === 'pbx_network_disabled')) {
            if (!cancelled) setError(text.dashboardLoadFailed);
          }
        });

    void Promise.all([
      refreshProvider(),
      api
        .systemMetrics(selected.id)
        .then((value) => {
          if (!cancelled) setMetrics(value);
        })
        .catch((failure: unknown) => {
          if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
          else if (!cancelled) setError(text.dashboardLoadFailed);
        }),
      api
        .listSecurityAlerts(selected.id)
        .then((value) => {
          if (!cancelled) setAlerts(value.current);
        })
        .catch((failure: unknown) => {
          if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
          else if (!cancelled) setError(text.dashboardLoadFailed);
        }),
    ]);

    const providerRefresh = window.setInterval(() => {
      void refreshProvider();
    }, 15_000);

    const metricsSource = new EventSource(api.systemMetricsStreamUrl(selected.id));
    metricsSource.onopen = () => setMetricsLive('connected');
    metricsSource.onerror = () => setMetricsLive('disconnected');
    metricsSource.addEventListener('system-metrics', (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent<string>).data,
        ) as Partial<SystemMetricsResponse>;
        setMetrics((current) => {
          const source = payload.source ?? current?.source;
          return {
            current: payload.current === undefined ? (current?.current ?? null) : payload.current,
            ...(source ? { source } : {}),
          };
        });
      } catch {
        setMetricsLive('disconnected');
      }
    });
    metricsSource.addEventListener('system-metrics-health', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          source?: SystemMetricsResponse['source'];
        };
        if (payload.source) {
          setMetrics((current) => ({
            current: current?.current ?? null,
            ...(payload.source ? { source: payload.source } : {}),
          }));
        }
      } catch {
        setMetricsLive('disconnected');
      }
    });

    const alertSource = new EventSource(api.securityAlertStreamUrl(selected.id));
    alertSource.onopen = () => setAlertsLive('connected');
    alertSource.onerror = () => setAlertsLive('disconnected');
    alertSource.addEventListener('security-alert', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          current?: SecurityAlertRecord[];
          alert?: SecurityAlertRecord;
        };
        if (payload.current) setAlerts(payload.current);
        else if (payload.alert)
          setAlerts((current) => [
            payload.alert!,
            ...current.filter((item) => item.ruleId !== payload.alert!.ruleId),
          ]);
      } catch {
        setAlertsLive('disconnected');
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(providerRefresh);
      metricsSource.close();
      alertSource.close();
    };
  }, [selected?.id]);

  if (profiles.length === 0) {
    return (
      <section className="dashboard" aria-labelledby="dashboard-title">
        <h2 id="dashboard-title">{text.dashboardTitle}</h2>
        <p>{text.dashboardNoPbx}</p>
      </section>
    );
  }

  const sample = metrics?.current ?? null;
  const memoryUsed =
    sample?.memory === undefined
      ? undefined
      : sample.memory.totalBytes - sample.memory.availableBytes;
  const liveConnected = metricsLive === 'connected' && alertsLive === 'connected';
  const liveDisconnected = metricsLive === 'disconnected' || alertsLive === 'disconnected';

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <h2 id="dashboard-title">{text.dashboardTitle}</h2>
          <p>{text.dashboardHint}</p>
        </div>
        <label>
          {text.dashboardPbx}
          <select
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="dashboard-grid">
        <article className="summary-card">
          <span className="summary-label">{text.providerConnection}</span>
          <strong>{connectionLabel(text, connection)}</strong>
          <small>{selected?.enabled ? text.enabled : text.disabled}</small>
        </article>
        <article className="summary-card">
          <span className="summary-label">{text.liveState}</span>
          <strong>
            {liveConnected
              ? text.liveConnected
              : liveDisconnected
                ? text.liveDisconnectedShort
                : text.liveConnecting}
          </strong>
          <small>{metrics?.source?.health.freshness ?? text.noMetrics}</small>
        </article>
        <article className="summary-card">
          <span className="summary-label">{text.cpuUsage}</span>
          <strong>{sample?.cpu ? `${sample.cpu.utilizationPercent.toFixed(1)}%` : '—'}</strong>
          <small>{sample?.observedAt ?? text.noMetrics}</small>
        </article>
        <article className="summary-card">
          <span className="summary-label">{text.memoryUsage}</span>
          <strong>
            {memoryUsed === undefined || sample?.memory === undefined
              ? '—'
              : `${formatBytes(memoryUsed)} / ${formatBytes(sample.memory.totalBytes)}`}
          </strong>
          <small>
            {text.available}: {formatBytes(sample?.memory?.availableBytes)}
          </small>
        </article>
        <article className="summary-card">
          <span className="summary-label">{text.uptime}</span>
          <strong>{formatUptime(sample?.uptime?.uptimeSeconds)}</strong>
          <small>{sample?.source ?? text.noMetrics}</small>
        </article>
        <article className="summary-card">
          <span className="summary-label">{text.securityAlertsSummary}</span>
          <strong>{alerts.length}</strong>
          <small>{alerts.length === 0 ? text.noAlerts : text.currentAlerts}</small>
        </article>
      </div>

      <nav className="dashboard-nav" aria-label={text.dashboardNavigation}>
        <a href="#pbx-title">{text.managePbx}</a>
        <a href="#security-title">{text.openSecurity}</a>
      </nav>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
