import {
  Badge,
  Box,
  Card,
  ChakraProvider,
  Flex,
  Heading,
  HStack,
  Link,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  defaultSystem,
} from '@chakra-ui/react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  api,
  ApiError,
  type PbxConnectionState,
  type PbxProfile,
  type SecurityAlertRecord,
  type SystemMetricsResponse,
  type TelephonyInstanceState,
} from './api.js';
import { messages, type Language } from './i18n.js';

type TextMap = (typeof messages)[Language];
type LiveState = 'connecting' | 'connected' | 'disconnected';

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

function syncPalette(state: TelephonyInstanceState['synchronization']) {
  if (state === 'CURRENT') return 'green';
  if (state === 'STALE') return 'orange';
  return 'gray';
}

function livePalette(state: LiveState) {
  if (state === 'connected') return 'green';
  if (state === 'disconnected') return 'red';
  return 'gray';
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

function SummaryCard({
  label,
  value,
  detail,
  badge,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Card.Root variant="outline" bg="bg.panel" minW="0">
      <Card.Body gap="2">
        <Flex justify="space-between" align="start" gap="3">
          <Text fontSize="sm" color="fg.muted" fontWeight="semibold">
            {label}
          </Text>
          {badge}
        </Flex>
        <Heading size="md" overflowWrap="anywhere">
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
}

function TelephonyListCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <Card.Root variant="outline" minW="0">
      <Card.Header pb="2">
        <Card.Title fontSize="md">{title}</Card.Title>
      </Card.Header>
      <Card.Body pt="0">
        {empty ? (
          <Text color="fg.muted" fontSize="sm">
            —
          </Text>
        ) : (
          <Stack gap="2">{children}</Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

export function OperatorDashboard({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [connection, setConnection] = useState<PbxConnectionState>(
    profiles[0]?.connectionStatus ?? 'UNVERIFIED',
  );
  const [metrics, setMetrics] = useState<SystemMetricsResponse>();
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
    if (selected) return;
    setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setConnection(selected.connectionStatus);
    setMetrics(undefined);
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

  if (profiles.length === 0) {
    return (
      <ChakraProvider value={defaultSystem}>
        <Card.Root variant="outline">
          <Card.Body>
            <Heading id="dashboard-title" size="lg">
              {text.dashboardTitle}
            </Heading>
            <Text color="fg.muted">{text.dashboardNoPbx}</Text>
          </Card.Body>
        </Card.Root>
      </ChakraProvider>
    );
  }

  const sample = metrics?.current ?? null;
  const memoryUsed =
    sample?.memory === undefined
      ? undefined
      : sample.memory.totalBytes - sample.memory.availableBytes;
  const allLive = [metricsLive, alertsLive, telephonyLive];
  const liveConnected = allLive.every((value) => value === 'connected');
  const liveDisconnected = allLive.some((value) => value === 'disconnected');

  return (
    <ChakraProvider value={defaultSystem}>
      <Box
        as="section"
        aria-labelledby="dashboard-title"
        bg="bg.subtle"
        borderRadius="xl"
        p={{ base: '4', md: '6' }}
      >
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
            <Box minW={{ base: '100%', md: '260px' }}>
              <label htmlFor="dashboard-pbx">
                <Text fontSize="sm" fontWeight="semibold">
                  {text.dashboardPbx}
                </Text>
              </label>
              <NativeSelect.Root mt="2">
                <NativeSelect.Field
                  id="dashboard-pbx"
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
          </Flex>

          <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} gap="4">
            <SummaryCard
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
            <SummaryCard
              label={text.liveState}
              value={
                liveConnected
                  ? text.liveConnected
                  : liveDisconnected
                    ? text.liveDisconnectedShort
                    : text.liveConnecting
              }
              detail={metrics?.source?.health.freshness ?? text.noMetrics}
              badge={
                <Badge
                  colorPalette={livePalette(
                    liveConnected ? 'connected' : liveDisconnected ? 'disconnected' : 'connecting',
                  )}
                >
                  {liveConnected ? 'LIVE' : liveDisconnected ? 'DEGRADED' : 'CONNECTING'}
                </Badge>
              }
            />
            <SummaryCard
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
                telephony ? (
                  <Badge colorPalette={syncPalette(telephony.synchronization)}>
                    {telephony.synchronization}
                  </Badge>
                ) : (
                  <Badge colorPalette="gray">NO STATE</Badge>
                )
              }
            />
            <SummaryCard
              label={text.cpuUsage}
              value={sample?.cpu ? `${sample.cpu.utilizationPercent.toFixed(1)}%` : '—'}
              detail={sample?.observedAt ?? text.noMetrics}
            />
            <SummaryCard
              label={text.memoryUsage}
              value={
                memoryUsed === undefined || sample?.memory === undefined
                  ? '—'
                  : `${formatBytes(memoryUsed)} / ${formatBytes(sample.memory.totalBytes)}`
              }
              detail={`${text.available}: ${formatBytes(sample?.memory?.availableBytes)}`}
            />
            <SummaryCard
              label={text.uptime}
              value={formatUptime(sample?.uptime?.uptimeSeconds)}
              detail={sample?.source ?? text.noMetrics}
            />
            <SummaryCard
              label={text.securityAlertsSummary}
              value={alerts.length}
              detail={alerts.length === 0 ? text.noAlerts : text.currentAlerts}
            />
            <SummaryCard
              label={text.telephonyCalls}
              value={telephony?.calls.length ?? 0}
              detail={`${text.telephonyChannels}: ${telephony?.channels.length ?? 0}`}
            />
            <SummaryCard
              label={text.telephonyQueues}
              value={telephony?.queues.length ?? 0}
              detail={`${text.telephonyAgents}: ${telephony?.agentInteractions.length ?? 0}`}
            />
          </SimpleGrid>

          <Box>
            <Heading size="lg">{text.telephonyTitle}</Heading>
            <Text color="fg.muted" mt="1">
              {text.telephonyHint}
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
            <TelephonyListCard
              title={text.telephonyCalls}
              empty={!telephony || telephony.calls.length === 0}
            >
              {telephony?.calls.map((call) => (
                <Box
                  key={call.callId}
                  borderBottomWidth="1px"
                  pb="2"
                  _last={{ borderBottomWidth: '0', pb: '0' }}
                >
                  <Text fontWeight="semibold" dir="ltr">
                    {call.callId}
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    {text.telephonyChannels}: {call.channelIds.length} · {text.telephonyBridges}:{' '}
                    {call.bridgeIds.length}
                  </Text>
                </Box>
              ))}
            </TelephonyListCard>

            <TelephonyListCard
              title={text.telephonyChannels}
              empty={!telephony || telephony.channels.length === 0}
            >
              {telephony?.channels.map((channel) => (
                <Flex
                  key={channel.channelId}
                  justify="space-between"
                  gap="3"
                  borderBottomWidth="1px"
                  pb="2"
                  _last={{ borderBottomWidth: '0', pb: '0' }}
                >
                  <Box minW="0">
                    <Text fontWeight="semibold" dir="ltr" overflowWrap="anywhere">
                      {channel.channelId}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {channel.bridgeId ?? text.telephonyNoBridge}
                    </Text>
                  </Box>
                  <Badge colorPalette={channel.state === 'Up' ? 'green' : 'gray'}>
                    {channel.state ?? 'UNKNOWN'}
                  </Badge>
                </Flex>
              ))}
            </TelephonyListCard>

            <TelephonyListCard
              title={text.telephonyEndpoints}
              empty={!telephony || telephony.endpoints.length === 0}
            >
              {telephony?.endpoints.map((endpoint) => (
                <Flex
                  key={endpoint.endpointId}
                  justify="space-between"
                  gap="3"
                  borderBottomWidth="1px"
                  pb="2"
                  _last={{ borderBottomWidth: '0', pb: '0' }}
                >
                  <Text fontWeight="semibold" dir="ltr">
                    {endpoint.endpointId}
                  </Text>
                  <HStack gap="2">
                    <Badge>{endpoint.registrationState}</Badge>
                    <Badge variant="outline">{endpoint.reachability}</Badge>
                  </HStack>
                </Flex>
              ))}
            </TelephonyListCard>

            <TelephonyListCard
              title={text.telephonyTrunks}
              empty={!telephony || telephony.trunks.length === 0}
            >
              {telephony?.trunks.map((trunk) => (
                <Flex
                  key={trunk.trunkId}
                  justify="space-between"
                  gap="3"
                  borderBottomWidth="1px"
                  pb="2"
                  _last={{ borderBottomWidth: '0', pb: '0' }}
                >
                  <Box>
                    <Text fontWeight="semibold" dir="ltr">
                      {trunk.trunkId}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {trunk.kind}
                    </Text>
                  </Box>
                  <Badge>{trunk.registrationState}</Badge>
                </Flex>
              ))}
            </TelephonyListCard>

            <TelephonyListCard
              title={text.telephonyQueues}
              empty={!telephony || telephony.queues.length === 0}
            >
              {telephony?.queues.map((queue) => {
                const members = telephony.queueMembers.filter(
                  (member) => member.queueId === queue.queueId,
                );
                const callers = telephony.queueCallers.filter(
                  (caller) => caller.queueId === queue.queueId,
                );
                return (
                  <Box
                    key={queue.queueId}
                    borderBottomWidth="1px"
                    pb="2"
                    _last={{ borderBottomWidth: '0', pb: '0' }}
                  >
                    <Flex justify="space-between" gap="3">
                      <Text fontWeight="semibold" dir="ltr">
                        {queue.queueId}
                      </Text>
                      <Badge colorPalette={queue.waitingCount > 0 ? 'orange' : 'gray'}>
                        {text.telephonyWaiting}: {queue.waitingCount}
                      </Badge>
                    </Flex>
                    <Text fontSize="sm" color="fg.muted">
                      {text.telephonyMembers}: {members.length} · {text.telephonyCallers}:{' '}
                      {callers.length}
                    </Text>
                  </Box>
                );
              })}
            </TelephonyListCard>

            <TelephonyListCard
              title={text.telephonyAgents}
              empty={!telephony || telephony.agentInteractions.length === 0}
            >
              {telephony?.agentInteractions.map((interaction) => (
                <Flex
                  key={`${interaction.queueId}:${interaction.callerId}:${interaction.memberId}`}
                  justify="space-between"
                  gap="3"
                  borderBottomWidth="1px"
                  pb="2"
                  _last={{ borderBottomWidth: '0', pb: '0' }}
                >
                  <Box minW="0">
                    <Text fontWeight="semibold" dir="ltr" overflowWrap="anywhere">
                      {interaction.memberName ?? interaction.memberId}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" dir="ltr">
                      {interaction.queueId}
                    </Text>
                  </Box>
                  <Badge colorPalette={interaction.phase === 'CONNECTED' ? 'green' : 'blue'}>
                    {interaction.phase}
                  </Badge>
                </Flex>
              ))}
            </TelephonyListCard>
          </SimpleGrid>

          <HStack gap="4" flexWrap="wrap" aria-label={text.dashboardNavigation}>
            <Link href="#pbx-title" colorPalette="blue" fontWeight="semibold">
              {text.managePbx}
            </Link>
            <Link href="#security-title" colorPalette="blue" fontWeight="semibold">
              {text.openSecurity}
            </Link>
          </HStack>

          {error ? (
            <Box
              role="alert"
              borderWidth="1px"
              borderColor="red.200"
              bg="red.50"
              color="red.800"
              borderRadius="md"
              p="3"
            >
              {error}
            </Box>
          ) : null}
        </Stack>
      </Box>
    </ChakraProvider>
  );
}
