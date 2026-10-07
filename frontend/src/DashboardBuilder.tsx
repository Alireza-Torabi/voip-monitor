import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  ApiError,
  type DashboardDefinition,
  type DashboardWidget,
  type DashboardWidgetType,
  type PbxConnectionState,
  type PbxProfile,
  type SecurityAlertRecord,
  type SystemMetricsResponse,
  type SystemMetricsSample,
  type TelephonyInstanceState,
} from './api.js';
import { isActiveChannel, type TelephonyPage } from './TelephonyWorkspace.js';
import { messages, type Language } from './i18n.js';
import { OperatorOverview } from './OperatorOverview.js';

type TextMap = (typeof messages)[Language];
type LiveState = 'connecting' | 'connected' | 'disconnected';
export type DashboardDestination = TelephonyPage | 'security';

const WIDGET_TYPES: DashboardWidgetType[] = [
  'clock',
  'provider',
  'telephony-sync',
  'security-alerts',
  'live-state',
  'cpu',
  'memory',
  'endpoint-reachability',
  'uptime',
  'metrics-trend',
  'service-health',
  'queue-pressure',
  'storage',
  'calls',
  'channels',
  'endpoints',
  'trunks',
  'queues',
  'agents',
];

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'clock', type: 'clock', width: 3, height: 1 },
  { id: 'provider', type: 'provider', width: 3, height: 1 },
  { id: 'telephony-sync', type: 'telephony-sync', width: 3, height: 1 },
  { id: 'live-state', type: 'live-state', width: 3, height: 1 },
  { id: 'cpu', type: 'cpu', width: 3, height: 2 },
  { id: 'memory', type: 'memory', width: 3, height: 2 },
  { id: 'endpoint-reachability', type: 'endpoint-reachability', width: 3, height: 2 },
  { id: 'uptime', type: 'uptime', width: 3, height: 2 },
  { id: 'metrics-trend', type: 'metrics-trend', width: 8, height: 2 },
  { id: 'service-health', type: 'service-health', width: 4, height: 2 },
  { id: 'storage', type: 'storage', width: 12, height: 2 },
  { id: 'queue-pressure', type: 'queue-pressure', width: 6, height: 2 },
  { id: 'calls', type: 'calls', width: 2, height: 1 },
  { id: 'channels', type: 'channels', width: 2, height: 1 },
  { id: 'endpoints', type: 'endpoints', width: 2, height: 1 },
  { id: 'trunks', type: 'trunks', width: 2, height: 1 },
  { id: 'queues', type: 'queues', width: 2, height: 1 },
  { id: 'agents', type: 'agents', width: 2, height: 1 },
];

function cloneDefaultWidgets(): DashboardWidget[] {
  return DEFAULT_WIDGETS.map((widget) => ({ ...widget }));
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
  return current.toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
}

function formatUptime(seconds: number | undefined) {
  if (seconds === undefined) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? days + 'd ' + hours + 'h' : hours + 'h';
}

function gauge(value: number | undefined, label: string, display: string) {
  const percent = Math.max(0, Math.min(100, value ?? 0));
  const angle = Math.PI + (Math.PI * percent) / 100;
  const needleX = 60 + 39 * Math.cos(angle);
  const needleY = 60 + 39 * Math.sin(angle);
  return (
    <Card.Root variant="outline" h="full">
      <Card.Body alignItems="center" justifyContent="center" gap="1">
        <Text fontSize="sm" color="fg.muted" fontWeight="semibold">
          {label}
        </Text>
        <svg viewBox="0 0 120 78" width="150" height="96" aria-hidden="true">
          <path
            d="M 12 60 A 48 48 0 0 1 108 60"
            fill="none"
            stroke="var(--chakra-colors-gray-200)"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength="100"
          />
          {value !== undefined ? (
            <path
              d="M 12 60 A 48 48 0 0 1 108 60"
              fill="none"
              stroke="var(--chakra-colors-blue-500)"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={String(percent) + ' 100'}
            />
          ) : null}
          <line
            x1="60"
            y1="60"
            x2={value === undefined ? 60 : needleX}
            y2={value === undefined ? 60 : needleY}
            stroke="var(--chakra-colors-gray-800)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="4" fill="var(--chakra-colors-gray-800)" />
        </svg>
        <Heading size="md">{display}</Heading>
      </Card.Body>
    </Card.Root>
  );
}

function stat(label: string, value: string | number, detail?: string, badge?: string) {
  return (
    <Card.Root variant="outline" h="full">
      <Card.Body gap="2" justifyContent="center">
        <Flex justify="space-between" align="start" gap="2">
          <Text fontSize="sm" color="fg.muted" fontWeight="semibold">
            {label}
          </Text>
          {badge ? <Badge>{badge}</Badge> : null}
        </Flex>
        <Heading size="lg">{value}</Heading>
        {detail ? (
          <Text fontSize="xs" color="fg.muted">
            {detail}
          </Text>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}

function PersianClock({ text }: { text: TextMap }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return (
    <Card.Root variant="outline" bg="blue.50" borderColor="blue.100" h="full">
      <Card.Body justifyContent="center">
        <Text fontSize="xs" color="blue.700" fontWeight="semibold">
          {text.persianDateTime}
        </Text>
        <Heading size="lg" dir="rtl">
          {time}
        </Heading>
        <Text fontSize="sm" color="fg.muted" dir="rtl">
          {date}
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

function MetricsTrend({ text, samples }: { text: TextMap; samples: SystemMetricsSample[] }) {
  const usable = [...samples]
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .filter((sample) => sample.cpu || sample.memory);
  const width = 620;
  const height = 180;
  const left = 32;
  const right = 12;
  const top = 12;
  const bottom = 26;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = (selector: (sample: SystemMetricsSample) => number | undefined) =>
    usable
      .map((sample, index) => {
        const value = selector(sample);
        if (value === undefined) return undefined;
        const x =
          left + (usable.length <= 1 ? plotWidth / 2 : (index * plotWidth) / (usable.length - 1));
        const y = top + plotHeight - (Math.max(0, Math.min(100, value)) * plotHeight) / 100;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .filter((value): value is string => value !== undefined)
      .join(' ');
  const cpu = points((sample) => sample.cpu?.utilizationPercent);
  const memory = points((sample) =>
    sample.memory && sample.memory.totalBytes > 0
      ? (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) / sample.memory.totalBytes
      : undefined,
  );
  return (
    <Card.Root variant="outline" h="full">
      <Card.Header pb="1">
        <Card.Title fontSize="md">{text.metricsTrendTitle}</Card.Title>
      </Card.Header>
      <Card.Body pt="1">
        {usable.length < 2 ? (
          <Text color="fg.muted">{text.metricsTrendNoData}</Text>
        ) : (
          <svg
            viewBox={'0 0 ' + width + ' ' + height}
            width="100%"
            height="100%"
            role="img"
            aria-label={text.metricsTrendTitle}
          >
            {[0, 25, 50, 75, 100].map((value) => {
              const y = top + plotHeight - (value * plotHeight) / 100;
              return (
                <g key={value}>
                  <line
                    x1={left}
                    x2={width - right}
                    y1={y}
                    y2={y}
                    stroke="var(--chakra-colors-gray-200)"
                  />
                  <text x="2" y={y + 4} fontSize="10">
                    {value}%
                  </text>
                </g>
              );
            })}
            {cpu ? (
              <polyline
                points={cpu}
                fill="none"
                stroke="var(--chakra-colors-blue-500)"
                strokeWidth="2.5"
              />
            ) : null}
            {memory ? (
              <polyline
                points={memory}
                fill="none"
                stroke="var(--chakra-colors-purple-500)"
                strokeWidth="2.5"
              />
            ) : null}
          </svg>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function ServiceHealth({ text, sample }: { text: TextMap; sample: SystemMetricsSample | null }) {
  const services = sample?.services ?? [];
  const capability = sample?.capabilities?.services;
  return (
    <Card.Root variant="outline" h="full">
      <Card.Header pb="2">
        <Flex justify="space-between" align="center">
          <Card.Title fontSize="md">{text.serviceHealthTitle}</Card.Title>
          <Badge colorPalette={capability === 'SUPPORTED' ? 'green' : 'gray'}>
            {capability ?? 'NO DATA'}
          </Badge>
        </Flex>
      </Card.Header>
      <Card.Body>
        {services.length === 0 ? (
          <Text color="fg.muted">
            {capability === 'NOT_CONFIGURED'
              ? text.serviceHealthConfigureHint
              : text.serviceHealthNoData}
          </Text>
        ) : (
          <Stack gap="2">
            {services.map((service) => (
              <Flex key={service.serviceId} justify="space-between" gap="2">
                <Text fontSize="sm" dir="ltr">
                  {service.serviceId}
                </Text>
                <Badge
                  colorPalette={
                    service.state === 'ACTIVE'
                      ? 'green'
                      : service.state === 'FAILED'
                        ? 'red'
                        : service.state === 'INACTIVE'
                          ? 'orange'
                          : 'gray'
                  }
                >
                  {service.state}
                </Badge>
              </Flex>
            ))}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function StorageWidget({
  text,
  filesystems,
}: {
  text: TextMap;
  filesystems: NonNullable<SystemMetricsSample['filesystems']>;
}) {
  return (
    <Card.Root variant="outline" h="full">
      <Card.Header pb="2">
        <Card.Title fontSize="md">{text.storageTitle}</Card.Title>
      </Card.Header>
      <Card.Body>
        {filesystems.length === 0 ? (
          <Text color="fg.muted">{text.storageNoData}</Text>
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr', md: 'repeat(auto-fit,minmax(220px,1fr))' }}
            gap="3"
          >
            {filesystems.map((filesystem) => {
              const used = Math.max(0, filesystem.totalBytes - filesystem.availableBytes);
              const percent = filesystem.totalBytes > 0 ? (100 * used) / filesystem.totalBytes : 0;
              return (
                <Box key={filesystem.filesystemId} borderWidth="1px" borderRadius="lg" p="3">
                  <Flex justify="space-between" gap="2">
                    <Text fontWeight="semibold" dir="ltr">
                      {filesystem.mountPoint}
                    </Text>
                    <Badge>{percent.toFixed(0)}%</Badge>
                  </Flex>
                  <Box h="8px" borderRadius="full" bg="gray.100" overflow="hidden" my="2">
                    <Box
                      h="full"
                      w={String(percent) + '%'}
                      bg={percent >= 90 ? 'red.500' : percent >= 75 ? 'orange.400' : 'blue.500'}
                    />
                  </Box>
                  <Text fontSize="xs" color="fg.muted">
                    {formatBytes(used)} / {formatBytes(filesystem.totalBytes)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function QueuePressure({
  text,
  telephony,
}: {
  text: TextMap;
  telephony: TelephonyInstanceState | null;
}) {
  const top = [...(telephony?.queues ?? [])]
    .sort((a, b) => b.waitingCount - a.waitingCount)
    .slice(0, 6);
  const max = Math.max(1, ...top.map((queue) => queue.waitingCount));
  return (
    <Card.Root variant="outline" h="full">
      <Card.Header pb="2">
        <Card.Title fontSize="md">{text.queuePressure}</Card.Title>
      </Card.Header>
      <Card.Body>
        {top.length === 0 ? (
          <Text color="fg.muted">{text.noResults}</Text>
        ) : (
          <Stack gap="3">
            {top.map((queue) => (
              <Box key={queue.queueId}>
                <Flex justify="space-between">
                  <Text dir="ltr">{queue.queueId}</Text>
                  <Text>{queue.waitingCount}</Text>
                </Flex>
                <Box h="8px" bg="gray.100" borderRadius="full">
                  <Box
                    h="full"
                    w={String(Math.max(3, (queue.waitingCount / max) * 100)) + '%'}
                    bg="orange.400"
                    borderRadius="full"
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function widgetLabel(text: TextMap, type: DashboardWidgetType) {
  const labels: Record<DashboardWidgetType, string> = {
    clock: text.persianDateTime,
    provider: text.providerConnection,
    'telephony-sync': text.telephonySynchronization,
    'security-alerts': text.securityAlertsSummary,
    'live-state': text.liveState,
    cpu: text.cpuUsage,
    memory: text.memoryUsage,
    'endpoint-reachability': text.endpointReachability,
    uptime: text.uptime,
    'metrics-trend': text.metricsTrendTitle,
    'service-health': text.serviceHealthTitle,
    'queue-pressure': text.queuePressure,
    storage: text.storageTitle,
    calls: text.telephonyCalls,
    channels: text.telephonyChannels,
    endpoints: text.telephonyEndpoints,
    trunks: text.telephonyTrunks,
    queues: text.telephonyQueues,
    agents: text.telephonyAgents,
  };
  return labels[type];
}

export function DashboardBuilder({
  text,
  profiles,
  onUnauthorized,
  onNavigate,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
  onNavigate?: (destination: DashboardDestination) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [connection, setConnection] = useState<PbxConnectionState>(
    profiles[0]?.connectionStatus ?? 'UNVERIFIED',
  );
  const [metrics, setMetrics] = useState<SystemMetricsResponse>();
  const [metricHistory, setMetricHistory] = useState<SystemMetricsSample[]>([]);
  const [selectedFilesystemIds, setSelectedFilesystemIds] = useState<string[] | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlertRecord[]>([]);
  const [telephony, setTelephony] = useState<TelephonyInstanceState | null>(null);
  const [metricsLive, setMetricsLive] = useState<LiveState>('connecting');
  const [alertsLive, setAlertsLive] = useState<LiveState>('connecting');
  const [telephonyLive, setTelephonyLive] = useState<LiveState>('connecting');
  const [dashboards, setDashboards] = useState<DashboardDefinition[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>([]);
  const [editing, setEditing] = useState(false);
  const [addType, setAddType] = useState<DashboardWidgetType>('cpu');
  const [draggedId, setDraggedId] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [wallboard, setWallboard] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];
  const activeDashboard = dashboards.find((dashboard) => dashboard.id === activeDashboardId);

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  async function loadDashboards(instanceId: string) {
    const value = await api.listDashboards(instanceId);
    let items = value.items;
    if (items.length === 0) {
      const created = await api.createDashboard(
        instanceId,
        text.defaultDashboardName,
        cloneDefaultWidgets(),
      );
      items = [created];
    }
    setDashboards(items);
    const active = items.find((item) => item.id === activeDashboardId) ?? items[0]!;
    setActiveDashboardId(active.id);
    setDraftName(active.name);
    setDraftWidgets(active.widgets.map((widget) => ({ ...widget })));
  }

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setConnection(selected.connectionStatus);
    setMetrics(undefined);
    setMetricHistory([]);
    setSelectedFilesystemIds(null);
    setAlerts([]);
    setTelephony(null);
    setError('');

    const fail = (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else if (!cancelled) setError(text.dashboardLoadFailed);
    };

    void Promise.all([
      api
        .providerStatus(selected.id)
        .then((value) => {
          if (!cancelled) setConnection(value.connectionStatus);
        })
        .catch(fail),
      api
        .systemMetrics(selected.id)
        .then((value) => {
          if (!cancelled) setMetrics(value);
        })
        .catch(fail),
      api
        .dashboardStorage(selected.id)
        .then((value) => {
          if (!cancelled) setSelectedFilesystemIds(value.selectedFilesystemIds);
        })
        .catch(fail),
      api
        .systemMetricsHistory(
          selected.id,
          new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString(),
          120,
        )
        .then((value) => {
          if (!cancelled) setMetricHistory(value.items);
        })
        .catch(fail),
      api
        .listSecurityAlerts(selected.id)
        .then((value) => {
          if (!cancelled) setAlerts(value.current);
        })
        .catch(fail),
      api
        .telephonyState(selected.id)
        .then((value) => {
          if (!cancelled) setTelephony(value.current);
        })
        .catch(fail),
      loadDashboards(selected.id).catch(fail),
    ]);

    const metricsSource = new EventSource(api.systemMetricsStreamUrl(selected.id));
    metricsSource.onopen = () => setMetricsLive('connected');
    metricsSource.onerror = () => setMetricsLive('disconnected');
    metricsSource.addEventListener('system-metrics', (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent<string>).data,
        ) as Partial<SystemMetricsResponse>;
        if (payload.current) {
          setMetrics((current) => {
            const source = payload.source ?? current?.source;
            return {
              current: payload.current ?? current?.current ?? null,
              ...(source ? { source } : {}),
            };
          });
          setMetricHistory((current) =>
            [
              ...current.filter((sample) => sample.observedAt !== payload.current!.observedAt),
              payload.current!,
            ]
              .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
              .slice(-120),
          );
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
    const telephonySource = new EventSource(api.telephonyStateStreamUrl(selected.id));
    telephonySource.onopen = () => setTelephonyLive('connected');
    telephonySource.onerror = () => setTelephonyLive('disconnected');
    telephonySource.addEventListener('telephony-state', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          current?: TelephonyInstanceState | null;
        };
        if ('current' in payload) setTelephony(payload.current ?? null);
      } catch {
        setTelephonyLive('disconnected');
      }
    });
    return () => {
      cancelled = true;
      metricsSource.close();
      alertSource.close();
      telephonySource.close();
    };
  }, [selected?.id]);

  useEffect(() => {
    const handler = () => {
      const isFullscreen = document.fullscreenElement === rootRef.current;
      setFullscreen(isFullscreen);
      setControlsVisible(isFullscreen);
      if (isFullscreen) setEditing(false);
      if (!isFullscreen) setWallboard(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (isFullscreen) {
        hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  async function enterWallboard() {
    setEditing(false);
    setWallboard(true);
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
    if (rootRef.current?.requestFullscreen && document.fullscreenElement !== rootRef.current) {
      try {
        await rootRef.current.requestFullscreen();
      } catch {
        // Wallboard remains usable in-page when browser fullscreen is unavailable or denied.
      }
    }
  }

  async function exitWallboard() {
    setWallboard(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }

  function showControls() {
    if (!fullscreen && !wallboard) return;
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
  }

  function selectDashboard(id: string) {
    const dashboard = dashboards.find((item) => item.id === id);
    if (!dashboard) return;
    setActiveDashboardId(id);
    setDraftName(dashboard.name);
    setDraftWidgets(dashboard.widgets.map((widget) => ({ ...widget })));
    setEditing(false);
  }

  async function saveDashboard() {
    if (!selected || !activeDashboard) return;
    const saved = await api.updateDashboard(
      selected.id,
      activeDashboard.id,
      draftName,
      draftWidgets,
    );
    setDashboards((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setEditing(false);
  }

  async function createDashboard() {
    if (!selected) return;
    const created = await api.createDashboard(
      selected.id,
      text.newDashboardName,
      cloneDefaultWidgets(),
    );
    setDashboards((current) => [created, ...current]);
    selectDashboard(created.id);
    setActiveDashboardId(created.id);
    setDraftName(created.name);
    setDraftWidgets(created.widgets.map((widget) => ({ ...widget })));
    setEditing(true);
  }

  async function removeDashboard() {
    if (!selected || !activeDashboard) return;
    await api.deleteDashboard(selected.id, activeDashboard.id);
    const remaining = dashboards.filter((item) => item.id !== activeDashboard.id);
    if (remaining.length === 0) {
      const created = await api.createDashboard(
        selected.id,
        text.defaultDashboardName,
        cloneDefaultWidgets(),
      );
      setDashboards([created]);
      setActiveDashboardId(created.id);
      setDraftName(created.name);
      setDraftWidgets(created.widgets.map((widget) => ({ ...widget })));
    } else {
      setDashboards(remaining);
      selectDashboard(remaining[0]!.id);
    }
    setEditing(false);
  }

  function addWidget() {
    if (draftWidgets.some((widget) => widget.type === addType)) return;
    setDraftWidgets((current) => [
      ...current,
      { id: addType + '-' + Date.now(), type: addType, width: 3, height: 1 },
    ]);
  }

  function resizeWidget(id: string, widthDelta: number, heightDelta: number) {
    setDraftWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              width: Math.max(1, Math.min(12, widget.width + widthDelta)),
              height: Math.max(1, Math.min(4, widget.height + heightDelta)),
            }
          : widget,
      ),
    );
  }

  function dropWidget(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setDraftWidgets((current) => {
      const from = current.findIndex((widget) => widget.id === draggedId);
      const to = current.findIndex((widget) => widget.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const moved = next.splice(from, 1)[0]!;
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId('');
  }

  const sample = metrics?.current ?? null;
  const memoryPercent =
    sample?.memory && sample.memory.totalBytes > 0
      ? (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) / sample.memory.totalBytes
      : undefined;
  const activeChannels = useMemo(
    () => telephony?.channels.filter((channel) => isActiveChannel(channel.state)) ?? [],
    [telephony],
  );
  const reachableEndpoints =
    telephony?.endpoints.filter((endpoint) => endpoint.reachability === 'REACHABLE').length ?? 0;
  const endpointPercent =
    telephony && telephony.endpoints.length > 0
      ? (100 * reachableEndpoints) / telephony.endpoints.length
      : undefined;
  const liveConnected = [metricsLive, alertsLive, telephonyLive].every(
    (value) => value === 'connected',
  );
  const visibleFilesystems = (sample?.filesystems ?? []).filter(
    (filesystem) =>
      selectedFilesystemIds === null || selectedFilesystemIds.includes(filesystem.filesystemId),
  );

  function renderWidget(type: DashboardWidgetType) {
    if (type === 'clock') return <PersianClock text={text} />;
    if (type === 'provider')
      return stat(
        text.providerConnection,
        connection,
        selected?.enabled ? text.enabled : text.disabled,
        connection,
      );
    if (type === 'telephony-sync')
      return stat(
        text.telephonySynchronization,
        telephony?.synchronization ?? text.telephonyNoState,
        telephony ? text.telephonyRevision + ': ' + telephony.revision : text.telephonyNoSnapshot,
      );
    if (type === 'security-alerts')
      return stat(
        text.securityAlertsSummary,
        alerts.length,
        alerts.length === 0 ? text.noAlerts : text.currentAlerts,
      );
    if (type === 'live-state')
      return stat(
        text.liveState,
        liveConnected ? text.liveConnected : text.liveDisconnectedShort,
        metrics?.source?.health.freshness ?? text.noMetrics,
        liveConnected ? 'LIVE' : 'DEGRADED',
      );
    if (type === 'cpu')
      return gauge(
        sample?.cpu?.utilizationPercent,
        text.cpuUsage,
        sample?.cpu ? sample.cpu.utilizationPercent.toFixed(1) + '%' : '—',
      );
    if (type === 'memory')
      return gauge(
        memoryPercent,
        text.memoryUsage,
        memoryPercent === undefined ? '—' : memoryPercent.toFixed(1) + '%',
      );
    if (type === 'endpoint-reachability')
      return gauge(
        endpointPercent,
        text.endpointReachability,
        endpointPercent === undefined
          ? '—'
          : reachableEndpoints + ' / ' + (telephony?.endpoints.length ?? 0),
      );
    if (type === 'uptime')
      return stat(
        text.uptime,
        formatUptime(sample?.uptime?.uptimeSeconds),
        sample?.source ?? text.noMetrics,
      );
    if (type === 'metrics-trend') return <MetricsTrend text={text} samples={metricHistory} />;
    if (type === 'service-health') return <ServiceHealth text={text} sample={sample} />;
    if (type === 'queue-pressure') return <QueuePressure text={text} telephony={telephony} />;
    if (type === 'storage') return <StorageWidget text={text} filesystems={visibleFilesystems} />;
    if (type === 'calls')
      return stat(text.telephonyCalls, telephony?.calls.length ?? 0, text.openDetails);
    if (type === 'channels')
      return stat(text.telephonyChannels, activeChannels.length, text.activeOnly);
    if (type === 'endpoints')
      return stat(text.telephonyEndpoints, telephony?.endpoints.length ?? 0, text.openDetails);
    if (type === 'trunks')
      return stat(text.telephonyTrunks, telephony?.trunks.length ?? 0, text.openDetails);
    if (type === 'queues')
      return stat(
        text.telephonyQueues,
        telephony?.queues.length ?? 0,
        text.telephonyWaiting +
          ': ' +
          (telephony?.queues.reduce((sum, queue) => sum + queue.waitingCount, 0) ?? 0),
      );
    return stat(text.telephonyAgents, telephony?.agentInteractions.length ?? 0, text.openDetails);
  }

  function openWidget(type: DashboardWidgetType) {
    if (!onNavigate) return;
    if (type === 'security-alerts') onNavigate('security');
    if (['calls', 'channels', 'endpoints', 'trunks', 'queues', 'agents'].includes(type))
      onNavigate(type as TelephonyPage);
  }

  if (profiles.length === 0)
    return (
      <Card.Root variant="outline">
        <Card.Body>{text.dashboardNoPbx}</Card.Body>
      </Card.Root>
    );

  return (
    <Box
      ref={rootRef}
      data-dashboard-root
      data-wallboard={wallboard ? 'true' : 'false'}
      role={wallboard ? 'region' : undefined}
      aria-label={wallboard ? text.wallboard : undefined}
      bg={wallboard ? 'noc.canvas' : 'transparent'}
      minH={fullscreen || wallboard ? '100vh' : undefined}
      p={fullscreen || wallboard ? { base: '3', md: '5', xl: '6' } : '0'}
      overflow={fullscreen || wallboard ? 'auto' : undefined}
      onMouseMove={showControls}
      onKeyDown={showControls}
      onFocusCapture={showControls}
    >
      <Stack gap="4">
        {!fullscreen && !wallboard ? (
          <Flex
            data-dashboard-toolbar
            align={{ base: 'stretch', xl: 'center' }}
            justify="space-between"
            direction={{ base: 'column', xl: 'row' }}
            gap="4"
            pb="1"
          >
            <Box minW="0">
              <Heading size="xl" color="noc.text" letterSpacing="-0.02em">
                {text.dashboardTitle}
              </Heading>
              <Text color="noc.textMuted" mt="1" fontSize="12px">
                {text.dashboardHint}
              </Text>
            </Box>
            <HStack gap="2" flexWrap="wrap" justify={{ base: 'flex-start', xl: 'flex-end' }}>
              {editing ? (
                <>
                  <NativeSelect.Root minW="180px" maxW="230px">
                    <NativeSelect.Field
                      value={activeDashboardId}
                      onChange={(event) => selectDashboard(event.target.value)}
                    >
                      {dashboards.map((dashboard) => (
                        <option key={dashboard.id} value={dashboard.id}>
                          {dashboard.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Button size="sm" variant="outline" onClick={() => void createDashboard()}>
                    {text.newDashboard}
                  </Button>
                </>
              ) : null}
              <Box minW={{ base: '180px', md: '220px' }}>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    aria-label={text.dashboardPbx}
                    value={selected?.id ?? ''}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>
              <Button
                size="sm"
                variant={editing ? 'solid' : 'outline'}
                colorPalette="blue"
                onClick={() => setEditing((value) => !value)}
              >
                {editing ? text.doneEditing : text.editDashboard}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else if (rootRef.current?.requestFullscreen)
                    void rootRef.current.requestFullscreen();
                }}
              >
                {fullscreen ? text.exitFullscreen : text.fullscreen}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void enterWallboard()}
                aria-label={text.wallboard}
              >
                {text.wallboard}
              </Button>
            </HStack>
          </Flex>
        ) : null}

        {fullscreen || wallboard ? (
          <Button
            data-dashboard-fullscreen-exit
            aria-label={wallboard ? text.exitWallboard : text.exitFullscreen}
            size="xs"
            variant="solid"
            position="fixed"
            top="3"
            right="3"
            zIndex="overlay"
            opacity={controlsVisible ? 0.9 : 0}
            pointerEvents={controlsVisible ? 'auto' : 'none'}
            transition="opacity 180ms ease"
            boxShadow="sm"
            onClick={() => {
              if (wallboard) void exitWallboard();
              else if (document.fullscreenElement) void document.exitFullscreen();
            }}
          >
            {wallboard ? text.exitWallboard : text.exitFullscreen}
          </Button>
        ) : null}

        {editing && !fullscreen && !wallboard ? (
          <Card.Root variant="outline">
            <Card.Body gap="3">
              <Flex gap="2" flexWrap="wrap" align="end">
                <Box minW="220px">
                  <Text fontSize="xs" color="fg.muted">
                    {text.dashboardName}
                  </Text>
                  <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                </Box>
                <Box minW="220px">
                  <Text fontSize="xs" color="fg.muted">
                    {text.addWidget}
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={addType}
                      onChange={(event) => setAddType(event.target.value as DashboardWidgetType)}
                    >
                      {WIDGET_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {widgetLabel(text, type)}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
                <Button onClick={addWidget}>{text.addWidget}</Button>
                <Button colorPalette="blue" onClick={() => void saveDashboard()}>
                  {text.saveDashboard}
                </Button>
                <Button colorPalette="red" variant="outline" onClick={() => void removeDashboard()}>
                  {text.deleteDashboard}
                </Button>
              </Flex>
              <Text fontSize="xs" color="fg.muted">
                {text.dashboardDragHint}
              </Text>
            </Card.Body>
          </Card.Root>
        ) : null}

        {!editing ? (
          <OperatorOverview
            text={text}
            instanceId={selected?.id ?? ''}
            connection={connection}
            metrics={metrics}
            metricHistory={metricHistory}
            alerts={alerts}
            telephony={telephony}
            metricsLive={metricsLive}
            alertsLive={alertsLive}
            telephonyLive={telephonyLive}
            visibleFilesystems={visibleFilesystems}
            onNavigate={onNavigate}
            wallboard={wallboard}
          />
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr', md: 'repeat(12, minmax(0, 1fr))' }}
            gridAutoRows="minmax(96px, auto)"
            gap="4"
            data-dashboard-grid
          >
            {draftWidgets.map((widget) => (
              <Box
                key={widget.id}
                gridColumn={{ base: '1 / -1', md: 'span ' + widget.width }}
                minH={String(widget.height * 105) + 'px'}
                position="relative"
                draggable={!fullscreen}
                onDragStart={() => setDraggedId(widget.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropWidget(widget.id)}
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="noc.borderStrong"
                borderRadius="nocPanel"
                p="1"
                cursor="grab"
                onDoubleClick={() => openWidget(widget.type)}
                data-dashboard-widget={widget.type}
              >
                {!fullscreen ? (
                  <Flex
                    position="absolute"
                    zIndex="2"
                    top="1"
                    right="1"
                    gap="1"
                    bg="noc.surface3"
                    borderWidth="1px"
                    borderColor="noc.border"
                    borderRadius="md"
                    p="1"
                  >
                    <Button
                      size="2xs"
                      variant="outline"
                      onClick={() => resizeWidget(widget.id, -1, 0)}
                    >
                      −W
                    </Button>
                    <Button
                      size="2xs"
                      variant="outline"
                      onClick={() => resizeWidget(widget.id, 1, 0)}
                    >
                      +W
                    </Button>
                    <Button
                      size="2xs"
                      variant="outline"
                      onClick={() => resizeWidget(widget.id, 0, -1)}
                    >
                      −H
                    </Button>
                    <Button
                      size="2xs"
                      variant="outline"
                      onClick={() => resizeWidget(widget.id, 0, 1)}
                    >
                      +H
                    </Button>
                    <Button
                      size="2xs"
                      colorPalette="red"
                      variant="outline"
                      onClick={() =>
                        setDraftWidgets((current) =>
                          current.filter((item) => item.id !== widget.id),
                        )
                      }
                    >
                      ×
                    </Button>
                  </Flex>
                ) : null}
                <Box h="full">{renderWidget(widget.type)}</Box>
              </Box>
            ))}
          </Box>
        )}

        {error ? (
          <Box
            role="alert"
            borderWidth="1px"
            borderColor="red.200"
            bg="red.50"
            color="red.800"
            borderRadius="lg"
            p="3"
          >
            {error}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
