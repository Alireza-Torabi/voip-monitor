import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  ApiError,
  type PbxConnectionState,
  type PbxProfile,
  type SecurityAlertRecord,
  type SystemMetricsResponse,
  type SystemMetricsSample,
  type TelephonyInstanceState,
} from './api.js';
import { isActiveChannel, type TelephonyPage } from './TelephonyWorkspace.js';
import { messages, type Language } from './i18n.js';

type TextMap = (typeof messages)[Language];
type LiveState = 'connecting' | 'connected' | 'disconnected';
export type OperatorDestination = TelephonyPage | 'pbx' | 'security';

function connectionLabel(text: TextMap, state: PbxConnectionState) {
  if (state === 'CONNECTED') return text.connected;
  if (state === 'CONNECTING') return text.connecting;
  if (state === 'DISCONNECTED') return text.disconnected;
  if (state === 'DEGRADED') return text.degraded;
  if (state === 'ERROR') return text.connectionError;
  return text.unverified;
}

function synchronizationLabel(text: TextMap, state: TelephonyInstanceState['synchronization']) {
  if (state === 'CURRENT') return text.telephonyCurrent;
  if (state === 'STALE') return text.telephonyStale;
  return text.telephonyAwaitingSnapshot;
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

function DialGauge({
  value,
  label,
  display,
  unavailable,
}: {
  value?: number | undefined;
  label: string;
  display: string;
  unavailable?: boolean | undefined;
}) {
  const percent = Math.max(0, Math.min(100, value ?? 0));
  const angle = Math.PI + (Math.PI * percent) / 100;
  const needleX = 60 + 39 * Math.cos(angle);
  const needleY = 60 + 39 * Math.sin(angle);

  return (
    <Card.Root variant="outline" minW="0">
      <Card.Body alignItems="center" gap="1">
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
          {!unavailable ? (
            <path
              d="M 12 60 A 48 48 0 0 1 108 60"
              fill="none"
              stroke="var(--chakra-colors-blue-500)"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${percent} 100`}
            />
          ) : null}
          <line
            x1="60"
            y1="60"
            x2={unavailable ? 60 : needleX}
            y2={unavailable ? 60 : needleY}
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

function StatCard({
  label,
  value,
  detail,
  badge,
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
  onClick?: (() => void) | undefined;
}) {
  const card = (
    <Card.Root
      variant="outline"
      bg="bg.panel"
      minW="0"
      h="full"
      transition="transform 120ms ease, box-shadow 120ms ease"
      {...(onClick ? { _hover: { transform: 'translateY(-2px)', shadow: 'md' } } : {})}
    >
      <Card.Body gap="2">
        <Flex justify="space-between" align="start" gap="3">
          <Text fontSize="sm" color="fg.muted" fontWeight="semibold">
            {label}
          </Text>
          {badge}
        </Flex>
        <Heading size="lg" overflowWrap="anywhere">
          {value}
        </Heading>
        {detail ? (
          <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
            {detail}
          </Text>
        ) : null}
      </Card.Body>
    </Card.Root>
  );

  if (!onClick) return card;
  return (
    <Button
      variant="plain"
      p="0"
      h="auto"
      minW="0"
      textAlign="start"
      whiteSpace="normal"
      onClick={onClick}
    >
      {card}
    </Button>
  );
}

function formatPersianDateTime(value: Date) {
  const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(value);
  const time = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(value);
  return { date, time };
}

function PersianClock({ text }: { text: TextMap }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatted = formatPersianDateTime(now);
  return (
    <Card.Root variant="outline" bg="blue.50" borderColor="blue.100" minW={{ md: '260px' }}>
      <Card.Body gap="0.5" py="3">
        <Text fontSize="xs" color="blue.700" fontWeight="semibold">
          {text.persianDateTime}
        </Text>
        <Heading size="md" dir="rtl">
          {formatted.time}
        </Heading>
        <Text fontSize="sm" color="fg.muted" dir="rtl">
          {formatted.date}
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

function StorageOverview({
  text,
  filesystems,
}: {
  text: TextMap;
  filesystems: NonNullable<SystemMetricsSample['filesystems']>;
}) {
  return (
    <Card.Root variant="outline">
      <Card.Header pb="2">
        <Card.Title fontSize="md">{text.storageTitle}</Card.Title>
        <Card.Description>{text.storageHint}</Card.Description>
      </Card.Header>
      <Card.Body>
        {filesystems.length === 0 ? (
          <Text color="fg.muted">{text.storageNoData}</Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
            {filesystems.map((filesystem) => {
              const usedBytes = Math.max(0, filesystem.totalBytes - filesystem.availableBytes);
              const usedPercent =
                filesystem.totalBytes > 0 ? (100 * usedBytes) / filesystem.totalBytes : 0;
              const palette =
                usedPercent >= 90 ? 'red.500' : usedPercent >= 75 ? 'orange.400' : 'blue.500';
              return (
                <Box
                  key={filesystem.filesystemId}
                  data-storage-filesystem={filesystem.mountPoint}
                  borderWidth="1px"
                  borderRadius="xl"
                  p="4"
                  minW="0"
                  bg="bg.panel"
                >
                  <Flex justify="space-between" align="start" gap="3" mb="3">
                    <Box minW="0">
                      <Text fontWeight="semibold" dir="ltr" overflowWrap="anywhere">
                        {filesystem.mountPoint}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" dir="ltr" overflowWrap="anywhere">
                        {filesystem.filesystemId}
                      </Text>
                    </Box>
                    <Badge
                      colorPalette={
                        usedPercent >= 90 ? 'red' : usedPercent >= 75 ? 'orange' : 'blue'
                      }
                    >
                      {usedPercent.toFixed(0)}%
                    </Badge>
                  </Flex>
                  <Box h="9px" borderRadius="full" bg="gray.100" overflow="hidden" mb="3">
                    <Box h="full" w={`${usedPercent}%`} bg={palette} borderRadius="full" />
                  </Box>
                  <SimpleGrid columns={2} gap="2">
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        {text.storageUsed}
                      </Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {formatBytes(usedBytes)}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        {text.storageFree}
                      </Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {formatBytes(filesystem.availableBytes)}
                      </Text>
                    </Box>
                  </SimpleGrid>
                  <Text fontSize="xs" color="fg.muted" mt="2">
                    {text.storageTotal}: {formatBytes(filesystem.totalBytes)}
                  </Text>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function ServiceHealthOverview({
  text,
  services,
}: {
  text: TextMap;
  services: NonNullable<SystemMetricsSample['services']>;
}) {
  return (
    <Card.Root variant="outline">
      <Card.Header pb="2">
        <Card.Title fontSize="md">{text.serviceHealthTitle}</Card.Title>
        <Card.Description>{text.serviceHealthHint}</Card.Description>
      </Card.Header>
      <Card.Body>
        {services.length === 0 ? (
          <Text color="fg.muted">{text.serviceHealthNoData}</Text>
        ) : (
          <Stack gap="2">
            {services.map((service) => (
              <Flex
                key={service.serviceId}
                justify="space-between"
                align="center"
                gap="3"
                borderBottomWidth="1px"
                pb="2"
                _last={{ borderBottomWidth: '0', pb: '0' }}
              >
                <Text fontSize="sm" fontWeight="semibold" dir="ltr" overflowWrap="anywhere">
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

function MetricsTrend({ text, samples }: { text: TextMap; samples: SystemMetricsSample[] }) {
  const ordered = [...samples].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const usable = ordered.filter((sample) => sample.cpu || sample.memory);
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
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter((value): value is string => value !== undefined)
      .join(' ');

  const cpuPoints = points((sample) => sample.cpu?.utilizationPercent);
  const memoryPoints = points((sample) =>
    sample.memory && sample.memory.totalBytes > 0
      ? (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) / sample.memory.totalBytes
      : undefined,
  );

  return (
    <Card.Root variant="outline">
      <Card.Header pb="2">
        <Flex justify="space-between" align="start" gap="4" flexWrap="wrap">
          <Box>
            <Card.Title fontSize="md">{text.metricsTrendTitle}</Card.Title>
            <Card.Description>{text.metricsTrendHint}</Card.Description>
          </Box>
          <HStack gap="3" fontSize="xs">
            <HStack gap="1">
              <Box boxSize="8px" borderRadius="full" bg="blue.500" />
              <Text>{text.cpuUsage}</Text>
            </HStack>
            <HStack gap="1">
              <Box boxSize="8px" borderRadius="full" bg="purple.500" />
              <Text>{text.memoryUsage}</Text>
            </HStack>
          </HStack>
        </Flex>
      </Card.Header>
      <Card.Body pt="2">
        {usable.length < 2 ? (
          <Text color="fg.muted">{text.metricsTrendNoData}</Text>
        ) : (
          <Box overflowX="auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height="220"
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
                      strokeWidth="1"
                    />
                    <text x="2" y={y + 4} fontSize="10" fill="var(--chakra-colors-gray-500)">
                      {value}%
                    </text>
                  </g>
                );
              })}
              {cpuPoints ? (
                <polyline
                  points={cpuPoints}
                  fill="none"
                  stroke="var(--chakra-colors-blue-500)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {memoryPoints ? (
                <polyline
                  points={memoryPoints}
                  fill="none"
                  stroke="var(--chakra-colors-purple-500)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              <text x={left} y={height - 5} fontSize="10" fill="var(--chakra-colors-gray-500)">
                {text.metricsTrendOldest}
              </text>
              <text
                x={width - right}
                y={height - 5}
                fontSize="10"
                textAnchor="end"
                fill="var(--chakra-colors-gray-500)"
              >
                {text.metricsTrendNow}
              </text>
            </svg>
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function QueueBars({ text, queues }: { text: TextMap; queues: TelephonyInstanceState['queues'] }) {
  const top = [...queues].sort((a, b) => b.waitingCount - a.waitingCount).slice(0, 6);
  const max = Math.max(1, ...top.map((item) => item.waitingCount));

  return (
    <Card.Root variant="outline">
      <Card.Header pb="2">
        <Card.Title fontSize="md">{text.queuePressure}</Card.Title>
        <Card.Description>{text.queuePressureHint}</Card.Description>
      </Card.Header>
      <Card.Body>
        {top.length === 0 ? (
          <Text color="fg.muted">{text.noResults}</Text>
        ) : (
          <Stack gap="3">
            {top.map((queue) => (
              <Box key={queue.queueId}>
                <Flex justify="space-between" gap="3" mb="1">
                  <Text fontSize="sm" fontWeight="semibold" dir="ltr">
                    {queue.queueId}
                  </Text>
                  <Text fontSize="sm">{queue.waitingCount}</Text>
                </Flex>
                <Box h="8px" borderRadius="full" bg="gray.100" overflow="hidden">
                  <Box
                    h="full"
                    w={`${Math.max(3, (queue.waitingCount / max) * 100)}%`}
                    bg={queue.waitingCount > 0 ? 'orange.400' : 'green.400'}
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

export function OperatorDashboard({
  text,
  profiles,
  onUnauthorized,
  onNavigate,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
  onNavigate?: (destination: OperatorDestination) => void;
}) {
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
  const [error, setError] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length === 0) {
      setSelectedId('');
      return;
    }
    if (!selected) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

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
    setMetricsLive('connecting');
    setAlertsLive('connecting');
    setTelephonyLive('connecting');

    const fail = (failure: unknown) => {
      if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      else if (!(failure instanceof ApiError && failure.code === 'pbx_network_disabled')) {
        if (!cancelled) setError(text.dashboardLoadFailed);
      }
    };

    const refreshProvider = () =>
      api
        .providerStatus(selected.id)
        .then((value) => {
          if (!cancelled) setConnection(value.connectionStatus);
        })
        .catch(fail);

    void Promise.all([
      refreshProvider(),
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
    ]);

    const providerRefresh = window.setInterval(() => void refreshProvider(), 15_000);

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
        if (payload.current) {
          setMetricHistory((current) => {
            const withoutDuplicate = current.filter(
              (sample) => sample.observedAt !== payload.current!.observedAt,
            );
            return [...withoutDuplicate, payload.current!]
              .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
              .slice(-120);
          });
        }
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
            source: payload.source!,
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
        else if (payload.alert) {
          setAlerts((current) => [
            payload.alert!,
            ...current.filter((item) => item.ruleId !== payload.alert!.ruleId),
          ]);
        }
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
      window.clearInterval(providerRefresh);
      metricsSource.close();
      alertSource.close();
      telephonySource.close();
    };
  }, [selected?.id]);

  const sample = metrics?.current ?? null;
  const memoryUsed =
    sample?.memory === undefined
      ? undefined
      : sample.memory.totalBytes - sample.memory.availableBytes;
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
  const totalWaiting = telephony?.queues.reduce((sum, queue) => sum + queue.waitingCount, 0) ?? 0;
  const allLive = [metricsLive, alertsLive, telephonyLive];
  const liveConnected = allLive.every((value) => value === 'connected');
  const metricsUnavailable = metrics?.source?.health.freshness === 'UNAVAILABLE';

  if (profiles.length === 0) {
    return (
      <Card.Root variant="outline">
        <Card.Body>
          <Heading id="dashboard-title" size="lg">
            {text.dashboardTitle}
          </Heading>
          <Text color="fg.muted">{text.dashboardNoPbx}</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Stack gap="6">
      <Flex
        align={{ base: 'stretch', md: 'end' }}
        justify="space-between"
        direction={{ base: 'column', md: 'row' }}
        gap="4"
      >
        <Box>
          <Heading id="dashboard-title" size="xl">
            {text.dashboardTitle}
          </Heading>
          <Text color="fg.muted" mt="1">
            {text.dashboardHint}
          </Text>
        </Box>
        <HStack align="stretch" gap="3" flexWrap="wrap" justify={{ md: 'flex-end' }}>
          <PersianClock text={text} />
          <Box minW={{ base: '100%', md: '260px' }} alignSelf="end">
            <Text fontSize="sm" fontWeight="semibold" mb="1.5">
              {text.dashboardPbx}
            </Text>
            <NativeSelect.Root>
              <NativeSelect.Field
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
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <StatCard
          label={text.providerConnection}
          value={connectionLabel(text, connection)}
          detail={selected?.enabled ? text.enabled : text.disabled}
          badge={
            <Badge
              colorPalette={
                connection === 'CONNECTED' ? 'green' : connection === 'ERROR' ? 'red' : 'gray'
              }
            >
              {connection}
            </Badge>
          }
        />
        <StatCard
          label={text.telephonySynchronization}
          value={
            telephony
              ? synchronizationLabel(text, telephony.synchronization)
              : text.telephonyNoState
          }
          detail={
            telephony
              ? `${text.telephonyRevision}: ${telephony.revision}`
              : text.telephonyNoSnapshot
          }
          badge={
            <Badge colorPalette={telephony?.synchronization === 'CURRENT' ? 'green' : 'orange'}>
              {telephony?.synchronization ?? 'NO STATE'}
            </Badge>
          }
        />
        <StatCard
          label={text.securityAlertsSummary}
          value={alerts.length}
          detail={alerts.length === 0 ? text.noAlerts : text.currentAlerts}
          onClick={onNavigate ? () => onNavigate('security') : undefined}
        />
        <StatCard
          label={text.liveState}
          value={liveConnected ? text.liveConnected : text.liveDisconnectedShort}
          detail={metrics?.source?.health.freshness ?? text.noMetrics}
          badge={
            <Badge colorPalette={liveConnected ? 'green' : 'orange'}>
              {liveConnected ? 'LIVE' : 'DEGRADED'}
            </Badge>
          }
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="4">
        <DialGauge
          value={sample?.cpu?.utilizationPercent}
          label={text.cpuUsage}
          display={sample?.cpu ? `${sample.cpu.utilizationPercent.toFixed(1)}%` : '—'}
          unavailable={!sample?.cpu}
        />
        <DialGauge
          value={memoryPercent}
          label={text.memoryUsage}
          display={
            memoryUsed !== undefined && sample?.memory
              ? `${formatBytes(memoryUsed)} / ${formatBytes(sample.memory.totalBytes)}`
              : '—'
          }
          unavailable={memoryPercent === undefined}
        />
        <DialGauge
          value={endpointPercent}
          label={text.endpointReachability}
          display={
            endpointPercent === undefined
              ? '—'
              : `${reachableEndpoints} / ${telephony?.endpoints.length ?? 0}`
          }
          unavailable={endpointPercent === undefined}
        />
        <StatCard
          label={text.uptime}
          value={formatUptime(sample?.uptime?.uptimeSeconds)}
          detail={sample?.source ?? text.noMetrics}
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
        <MetricsTrend text={text} samples={metricHistory} />
        <ServiceHealthOverview text={text} services={sample?.services ?? []} />
      </SimpleGrid>

      <StorageOverview
        text={text}
        filesystems={(sample?.filesystems ?? []).filter(
          (filesystem) =>
            selectedFilesystemIds === null ||
            selectedFilesystemIds.includes(filesystem.filesystemId),
        )}
      />

      {metricsUnavailable ? (
        <Card.Root variant="outline" bg="orange.50" borderColor="orange.200">
          <Card.Body gap="1">
            <Text fontWeight="semibold">{text.metricsUnavailableTitle}</Text>
            <Text fontSize="sm" color="fg.muted">
              {text.metricsUnavailableHint}
            </Text>
          </Card.Body>
        </Card.Root>
      ) : null}

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
        <QueueBars text={text} queues={telephony?.queues ?? []} />
        <Card.Root variant="outline">
          <Card.Header pb="2">
            <Card.Title fontSize="md">{text.telephonyOverview}</Card.Title>
            <Card.Description>{text.telephonyOverviewHint}</Card.Description>
          </Card.Header>
          <Card.Body>
            <SimpleGrid columns={{ base: 2, md: 3 }} gap="3">
              <StatCard
                label={text.telephonyCalls}
                value={telephony?.calls.length ?? 0}
                detail={text.openDetails}
                onClick={onNavigate ? () => onNavigate('calls') : undefined}
              />
              <StatCard
                label={text.telephonyChannels}
                value={activeChannels.length}
                detail={text.activeOnly}
                onClick={onNavigate ? () => onNavigate('channels') : undefined}
              />
              <StatCard
                label={text.telephonyEndpoints}
                value={telephony?.endpoints.length ?? 0}
                detail={text.openDetails}
                onClick={onNavigate ? () => onNavigate('endpoints') : undefined}
              />
              <StatCard
                label={text.telephonyTrunks}
                value={telephony?.trunks.length ?? 0}
                detail={text.openDetails}
                onClick={onNavigate ? () => onNavigate('trunks') : undefined}
              />
              <StatCard
                label={text.telephonyQueues}
                value={telephony?.queues.length ?? 0}
                detail={`${text.telephonyWaiting}: ${totalWaiting}`}
                onClick={onNavigate ? () => onNavigate('queues') : undefined}
              />
              <StatCard
                label={text.telephonyAgents}
                value={telephony?.agentInteractions.length ?? 0}
                detail={text.openDetails}
                onClick={onNavigate ? () => onNavigate('agents') : undefined}
              />
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      <HStack gap="2" flexWrap="wrap">
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('pbx')}>
          {text.managePbx}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('security')}>
          {text.openSecurity}
        </Button>
      </HStack>

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
  );
}
