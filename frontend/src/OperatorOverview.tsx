import { Badge, Box, Button, Flex, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useMemo } from 'react';
import { evaluateOperationalHealth, type OperationalHealthState } from '@voip-monitor/shared';
import type {
  PbxConnectionState,
  SecurityAlertRecord,
  SystemMetricsResponse,
  SystemMetricsSample,
  TelephonyInstanceState,
} from './api.js';
import {
  NocInset,
  NocPanel,
  SectionHeader,
  StatusIndicator,
  type OperationalTone,
} from './NocPrimitives.js';
import { messages, type Language } from './i18n.js';
import type { TelephonyPage } from './TelephonyWorkspace.js';

type TextMap = (typeof messages)[Language];
type LiveState = 'connecting' | 'connected' | 'disconnected';
type Destination = TelephonyPage | 'security';

interface OperatorOverviewProps {
  text: TextMap;
  instanceId: string;
  connection: PbxConnectionState;
  metrics?: SystemMetricsResponse | undefined;
  metricHistory: SystemMetricsSample[];
  alerts: SecurityAlertRecord[];
  telephony: TelephonyInstanceState | null;
  metricsLive: LiveState;
  alertsLive: LiveState;
  telephonyLive: LiveState;
  visibleFilesystems: NonNullable<SystemMetricsSample['filesystems']>;
  onNavigate?: ((destination: Destination) => void) | undefined;
  wallboard?: boolean | undefined;
}

interface OperationalIssue {
  id: string;
  tone: Exclude<OperationalTone, 'info'>;
  title: string;
  detail: string;
  destination?: Destination;
}

function percentTone(value: number | undefined, warning = 75, critical = 90): OperationalTone {
  if (value === undefined) return 'unknown';
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'healthy';
}

function compactPercent(value: number | undefined) {
  return value === undefined ? '—' : value.toFixed(0) + '%';
}

function formatUptime(seconds: number | undefined) {
  if (seconds === undefined) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? days + 'd ' + hours + 'h' : hours + 'h';
}

function KpiCell({
  label,
  value,
  detail,
  tone = 'unknown',
  onClick,
}: {
  label: string;
  value: string | number;
  detail?: string | undefined;
  tone?: OperationalTone | undefined;
  onClick?: (() => void) | undefined;
}) {
  const content = (
    <Box px="4" py="3.5" minW="0">
      <Flex align="center" justify="space-between" gap="2">
        <Text fontSize="11px" color="noc.textMuted" fontWeight="600" letterSpacing=".02em">
          {label}
        </Text>
        <Box
          w="7px"
          h="7px"
          borderRadius="full"
          bg={
            {
              healthy: 'noc.healthy',
              warning: 'noc.warning',
              critical: 'noc.critical',
              info: 'noc.info',
              unknown: 'noc.unknown',
            }[tone]
          }
        />
      </Flex>
      <Text
        mt="1.5"
        fontSize={{ base: '20px', xl: '24px' }}
        lineHeight="1"
        fontWeight="700"
        color="noc.text"
        dir="ltr"
      >
        {value}
      </Text>
      {detail ? (
        <Text mt="1.5" fontSize="10px" color="noc.textSubtle" truncate>
          {detail}
        </Text>
      ) : null}
    </Box>
  );

  if (!onClick) return content;
  return (
    <Button
      variant="plain"
      p="0"
      h="auto"
      minW="0"
      textAlign="start"
      borderRadius="0"
      _hover={{ bg: 'rgba(255,255,255,.025)' }}
      onClick={onClick}
    >
      {content}
    </Button>
  );
}

function MetricBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | undefined;
  detail?: string | undefined;
}) {
  const tone = percentTone(value);
  const color = {
    healthy: 'noc.healthy',
    warning: 'noc.warning',
    critical: 'noc.critical',
    info: 'noc.info',
    unknown: 'noc.unknown',
  }[tone];
  return (
    <Box>
      <Flex justify="space-between" align="baseline" gap="3">
        <Text fontSize="12px" color="noc.textMuted">
          {label}
        </Text>
        <Text fontSize="13px" color="noc.text" fontWeight="600" dir="ltr">
          {compactPercent(value)}
        </Text>
      </Flex>
      <Box mt="2" h="6px" bg="noc.surface3" borderRadius="full" overflow="hidden">
        <Box
          h="full"
          w={(value === undefined ? 0 : Math.max(2, Math.min(100, value))) + '%'}
          bg={color}
          borderRadius="full"
        />
      </Box>
      {detail ? (
        <Text mt="1.5" fontSize="10px" color="noc.textSubtle" dir="ltr">
          {detail}
        </Text>
      ) : null}
    </Box>
  );
}

function MiniTrend({ samples, label }: { samples: SystemMetricsSample[]; label: string }) {
  const points = useMemo(() => {
    const usable = [...samples]
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
      .slice(-40)
      .map((sample) => sample.cpu?.utilizationPercent)
      .filter((value): value is number => value !== undefined);
    if (usable.length < 2) return '';
    return usable
      .map((value, index) => {
        const x = (index * 100) / Math.max(1, usable.length - 1);
        const y = 42 - (Math.max(0, Math.min(100, value)) * 36) / 100;
        return x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
  }, [samples]);

  return (
    <Box h="52px" mt="2">
      {points ? (
        <svg
          viewBox="0 0 100 46"
          width="100%"
          height="52"
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
        >
          <path d="M0 42 H100" stroke="var(--chakra-colors-noc-border)" strokeWidth="1" />
          <polyline
            points={points}
            fill="none"
            stroke="var(--chakra-colors-noc-accent)"
            strokeWidth="1.8"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <Flex h="full" align="center" justify="center">
          <Text fontSize="11px" color="noc.textSubtle">
            —
          </Text>
        </Flex>
      )}
    </Box>
  );
}

export function OperatorOverview({
  text,
  instanceId,
  connection,
  metrics,
  metricHistory,
  alerts,
  telephony,
  metricsLive,
  alertsLive,
  telephonyLive,
  visibleFilesystems,
  onNavigate,
  wallboard = false,
}: OperatorOverviewProps) {
  const sample = metrics?.current ?? null;
  const memoryPercent =
    sample?.memory && sample.memory.totalBytes > 0
      ? (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) / sample.memory.totalBytes
      : undefined;
  const activeChannels =
    telephony?.channels.filter(
      (channel) => !['DOWN', 'HUNGUP', 'DESTROYED'].includes((channel.state ?? '').toUpperCase()),
    ).length ?? 0;
  const unreachableEndpoints =
    telephony?.endpoints.filter((endpoint) => endpoint.reachability === 'UNREACHABLE').length ?? 0;
  const unhealthyTrunks =
    telephony?.trunks.filter(
      (trunk) =>
        trunk.registrationState === 'UNREGISTERED' ||
        trunk.registrationState === 'REJECTED' ||
        trunk.reachability === 'UNREACHABLE',
    ).length ?? 0;
  const waitingCallers = telephony?.queues.reduce((sum, queue) => sum + queue.waitingCount, 0) ?? 0;
  const failedServices =
    sample?.services?.filter((service) => service.state === 'FAILED').length ?? 0;
  const worstFilesystemPercent = visibleFilesystems.reduce((max, filesystem) => {
    if (filesystem.totalBytes <= 0) return max;
    const used =
      (100 * (filesystem.totalBytes - filesystem.availableBytes)) / filesystem.totalBytes;
    return Math.max(max, used);
  }, 0);
  const liveConnected = [metricsLive, alertsLive, telephonyLive].every(
    (state) => state === 'connected',
  );

  const health = evaluateOperationalHealth({
    instanceId,
    providerState: connection,
    ...(telephony
      ? {
          telephony: {
            synchronization: telephony.synchronization,
            trunkCapability: telephony.trunkCapability,
            trunkSynchronization: telephony.trunkSynchronization,
            trunks: telephony.trunks.map((trunk) => ({
              registrationState: trunk.registrationState,
              ...(trunk.reachability ? { reachability: trunk.reachability } : {}),
            })),
            endpointCapability: telephony.endpointCapability,
            endpointSynchronization: telephony.endpointSynchronization,
            endpoints: telephony.endpoints.map((endpoint) => ({
              reachability: endpoint.reachability,
            })),
            queueCapability: telephony.queueCapability,
            queueSynchronization: telephony.queueSynchronization,
            queues: telephony.queues.map((queue) => ({ waitingCount: queue.waitingCount })),
          },
        }
      : {}),
    ...(metrics?.source
      ? {
          system: {
            freshness: metrics.source.health.freshness,
            ...(sample?.cpu ? { cpuPercent: sample.cpu.utilizationPercent } : {}),
            ...(memoryPercent !== undefined ? { memoryPercent } : {}),
            ...(visibleFilesystems.length > 0
              ? { maxFilesystemPercent: worstFilesystemPercent }
              : {}),
            ...(sample?.services ? { services: sample.services } : {}),
          },
        }
      : {}),
    security: { currentAlertCount: alerts.length },
  });

  const toneFor = (state: OperationalHealthState): OperationalTone =>
    state === 'HEALTHY'
      ? 'healthy'
      : state === 'CRITICAL'
        ? 'critical'
        : state === 'DEGRADED' || state === 'STALE'
          ? 'warning'
          : 'unknown';
  const labelFor = (state: OperationalHealthState): string =>
    state === 'HEALTHY'
      ? text.dashboardHealthLabel.healthy
      : state === 'CRITICAL'
        ? text.dashboardHealthLabel.critical
        : state === 'DEGRADED'
          ? text.dashboardHealthLabel.warning
          : state === 'STALE'
            ? text.telephonyStale
            : text.dashboardHealthLabel.unknown;

  const issues: OperationalIssue[] = [];
  if (connection === 'ERROR' || connection === 'DISCONNECTED') {
    issues.push({
      id: 'provider',
      tone: 'critical',
      title: text.providerConnection,
      detail: connection,
    });
  } else if (connection === 'DEGRADED' || connection === 'CONNECTING') {
    issues.push({
      id: 'provider-degraded',
      tone: 'warning',
      title: text.providerConnection,
      detail: connection,
    });
  }
  if (telephony?.synchronization === 'STALE') {
    issues.push({
      id: 'telephony-stale',
      tone: 'warning',
      title: text.telephonySynchronization,
      detail: text.telephonyStale,
    });
  }
  if (!liveConnected) {
    issues.push({
      id: 'live',
      tone: 'warning',
      title: text.liveState,
      detail: text.liveDisconnectedShort,
    });
  }
  if (alerts.length > 0) {
    issues.push({
      id: 'security',
      tone: 'critical',
      title: text.securityAlertsSummary,
      detail: String(alerts.length),
      destination: 'security',
    });
  }
  if (unhealthyTrunks > 0) {
    issues.push({
      id: 'trunks',
      tone: 'critical',
      title: text.telephonyTrunks,
      detail: String(unhealthyTrunks),
      destination: 'trunks',
    });
  }
  if (unreachableEndpoints > 0) {
    issues.push({
      id: 'endpoints',
      tone: health.components.ENDPOINTS.state === 'CRITICAL' ? 'critical' : 'warning',
      title: text.telephonyEndpoints,
      detail: String(unreachableEndpoints),
      destination: 'endpoints',
    });
  }
  if (waitingCallers > 0) {
    issues.push({
      id: 'queues',
      tone: 'warning',
      title: text.queuePressure,
      detail: String(waitingCallers),
      destination: 'queues',
    });
  }
  const inactiveServices =
    sample?.services?.filter((service) => service.state === 'INACTIVE').length ?? 0;
  if (failedServices > 0) {
    issues.push({
      id: 'services',
      tone: 'critical',
      title: text.serviceHealthTitle,
      detail: String(failedServices),
    });
  } else if (inactiveServices > 0) {
    issues.push({
      id: 'services-inactive',
      tone: 'warning',
      title: text.serviceHealthTitle,
      detail: String(inactiveServices),
    });
  }
  if (metrics?.source?.health.freshness === 'STALE') {
    issues.push({
      id: 'system-stale',
      tone: 'warning',
      title: text.dashboardInfrastructure,
      detail: 'STALE',
    });
  } else if (metrics?.source?.health.freshness === 'ERROR') {
    issues.push({
      id: 'system-error',
      tone: 'critical',
      title: text.dashboardInfrastructure,
      detail: 'ERROR',
    });
  }
  if (health.components.TRUNKS.state === 'DEGRADED' && unhealthyTrunks === 0) {
    issues.push({
      id: 'trunks-degraded',
      tone: 'warning',
      title: text.telephonyTrunks,
      detail: labelFor(health.components.TRUNKS.state),
      destination: 'trunks',
    });
  }
  if ((sample?.cpu?.utilizationPercent ?? 0) >= 85) {
    issues.push({
      id: 'cpu',
      tone: sample!.cpu!.utilizationPercent >= 95 ? 'critical' : 'warning',
      title: text.cpuUsage,
      detail: compactPercent(sample?.cpu?.utilizationPercent),
    });
  }
  if ((memoryPercent ?? 0) >= 90) {
    issues.push({
      id: 'memory',
      tone: memoryPercent! >= 97 ? 'critical' : 'warning',
      title: text.memoryUsage,
      detail: compactPercent(memoryPercent),
    });
  }
  if (worstFilesystemPercent >= 90) {
    issues.push({
      id: 'storage',
      tone: worstFilesystemPercent >= 97 ? 'critical' : 'warning',
      title: text.storageTitle,
      detail: compactPercent(worstFilesystemPercent),
    });
  }

  if (issues.length === 0 && !['HEALTHY', 'UNKNOWN'].includes(health.overall)) {
    issues.push({
      id: 'unified-health',
      tone: health.overall === 'CRITICAL' ? 'critical' : 'warning',
      title: text.dashboardHealth,
      detail: labelFor(health.overall),
    });
  }

  const overallTone = toneFor(health.overall);

  const healthyEndpoints =
    telephony?.endpoints.filter((endpoint) => endpoint.reachability === 'REACHABLE').length ?? 0;
  const registeredTrunks =
    telephony?.trunks.filter((trunk) => trunk.registrationState === 'REGISTERED').length ?? 0;

  return (
    <Stack
      gap={wallboard ? '5' : '4'}
      data-operator-overview
      data-overall-tone={overallTone}
      data-wallboard-overview={wallboard ? 'true' : 'false'}
    >
      <NocPanel overflow="hidden">
        <SimpleGrid
          columns={{ base: 2, md: 4, xl: 7 }}
          divideX={{ xl: '1px' }}
          divideColor="noc.border"
        >
          <KpiCell
            label={text.dashboardHealth}
            value={labelFor(health.overall)}
            detail={connection}
            tone={overallTone}
          />
          <KpiCell
            label={text.telephonyCalls}
            value={telephony?.calls.length ?? 0}
            detail={activeChannels + ' ' + text.telephonyChannels.toLowerCase()}
            tone={telephony ? 'info' : 'unknown'}
            onClick={onNavigate ? () => onNavigate('calls') : undefined}
          />
          <KpiCell
            label={text.telephonyTrunks}
            value={(telephony?.trunks.length ?? 0).toString()}
            detail={registeredTrunks + ' ' + text.dashboardRegistered}
            tone={toneFor(health.components.TRUNKS.state)}
            onClick={onNavigate ? () => onNavigate('trunks') : undefined}
          />
          <KpiCell
            label={text.telephonyEndpoints}
            value={(telephony?.endpoints.length ?? 0).toString()}
            detail={healthyEndpoints + ' ' + text.dashboardReachable}
            tone={toneFor(health.components.ENDPOINTS.state)}
            onClick={onNavigate ? () => onNavigate('endpoints') : undefined}
          />
          <KpiCell
            label={text.telephonyQueues}
            value={(telephony?.queues.length ?? 0).toString()}
            detail={waitingCallers + ' ' + text.telephonyWaiting.toLowerCase()}
            tone={toneFor(health.components.QUEUES.state)}
            onClick={onNavigate ? () => onNavigate('queues') : undefined}
          />
          <KpiCell
            label={text.securityAlertsSummary}
            value={alerts.length}
            detail={alerts.length === 0 ? text.noAlerts : text.dashboardNeedsAttention}
            tone={toneFor(health.components.SECURITY.state)}
            onClick={onNavigate ? () => onNavigate('security') : undefined}
          />
          <KpiCell
            label={text.liveState}
            value={liveConnected ? text.dashboardLive : text.dashboardDegraded}
            detail={metrics?.source?.health.freshness ?? telephony?.synchronization ?? '—'}
            tone={liveConnected ? 'healthy' : 'warning'}
          />
        </SimpleGrid>
      </NocPanel>

      <SimpleGrid columns={{ base: 1, xl: 12 }} gap="4">
        <NocPanel gridColumn={{ xl: 'span 7' }} p="4">
          <SectionHeader
            title={text.dashboardCurrentProblems}
            description={text.dashboardCurrentProblemsHint}
            action={
              <StatusIndicator
                tone={overallTone}
                label={issues.length === 0 ? text.dashboardNoProblems : String(issues.length)}
              />
            }
          />
          <Stack gap="2" mt="4">
            {issues.length === 0 ? (
              <NocInset p="4">
                <Flex align="center" gap="3">
                  <StatusIndicator tone="healthy" label={text.dashboardNoProblems} />
                  <Text fontSize="12px" color="noc.textMuted">
                    {text.dashboardNoProblemsHint}
                  </Text>
                </Flex>
              </NocInset>
            ) : (
              issues.slice(0, 6).map((issue) => (
                <Button
                  key={issue.id}
                  variant="plain"
                  h="auto"
                  p="0"
                  textAlign="start"
                  disabled={!issue.destination}
                  onClick={
                    issue.destination && onNavigate
                      ? () => onNavigate(issue.destination!)
                      : undefined
                  }
                >
                  <NocInset
                    w="full"
                    px="3.5"
                    py="3"
                    {...(issue.destination ? { _hover: { borderColor: 'noc.borderStrong' } } : {})}
                  >
                    <Flex align="center" justify="space-between" gap="4">
                      <StatusIndicator tone={issue.tone} label={issue.title} />
                      <Text fontSize="12px" color="noc.text" fontWeight="600" dir="ltr">
                        {issue.detail}
                      </Text>
                    </Flex>
                  </NocInset>
                </Button>
              ))
            )}
          </Stack>
        </NocPanel>

        <NocPanel gridColumn={{ xl: 'span 5' }} p="4">
          <SectionHeader title={text.dashboardInfrastructure} description={text.metricsTrendHint} />
          <Stack gap="4" mt="4">
            <MetricBar label={text.cpuUsage} value={sample?.cpu?.utilizationPercent} />
            <MetricBar label={text.memoryUsage} value={memoryPercent} />
            <MetricBar
              label={text.storageTitle}
              value={visibleFilesystems.length > 0 ? worstFilesystemPercent : undefined}
              detail={visibleFilesystems[0]?.mountPoint}
            />
            <Flex align="center" justify="space-between" gap="3">
              <Text fontSize="12px" color="noc.textMuted">
                {text.uptime}
              </Text>
              <Text fontSize="12px" color="noc.text" fontWeight="600" dir="ltr">
                {formatUptime(sample?.uptime?.uptimeSeconds)}
              </Text>
            </Flex>
            <MiniTrend samples={metricHistory} label={text.metricsTrendTitle} />
          </Stack>
        </NocPanel>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 12 }} gap="4">
        <NocPanel gridColumn={{ xl: 'span 7' }} p="4">
          <SectionHeader
            title={text.dashboardActiveCalls}
            description={text.dashboardActiveCallsHint}
            action={
              onNavigate ? (
                <Button
                  size="xs"
                  variant="ghost"
                  color="noc.textMuted"
                  onClick={() => onNavigate('calls')}
                >
                  {text.openDetails}
                </Button>
              ) : undefined
            }
          />
          <Stack gap="0" mt="3">
            {(telephony?.calls ?? []).slice(0, 6).map((call, index) => (
              <Flex
                key={call.callId}
                align="center"
                justify="space-between"
                gap="4"
                minH={wallboard ? '46px' : '38px'}
                py="2"
                borderTopWidth={index === 0 ? '0' : '1px'}
                borderColor="noc.border"
              >
                <Flex align="center" gap="3" minW="0">
                  <Box w="7px" h="7px" borderRadius="full" bg="noc.healthy" flex="0 0 auto" />
                  <Text fontSize="12px" fontWeight="600" color="noc.text" dir="ltr" truncate>
                    {call.callId}
                  </Text>
                </Flex>
                <Flex gap="4" flex="0 0 auto">
                  <Text fontSize="11px" color="noc.textMuted" dir="ltr">
                    {call.channelIds.length} ch
                  </Text>
                  <Text fontSize="11px" color="noc.textSubtle" dir="ltr">
                    {call.bridgeIds.length} br
                  </Text>
                </Flex>
              </Flex>
            ))}
            {(telephony?.calls.length ?? 0) === 0 ? (
              <Text py="6" textAlign="center" fontSize="12px" color="noc.textSubtle">
                {text.noResults}
              </Text>
            ) : null}
          </Stack>
        </NocPanel>

        <NocPanel gridColumn={{ xl: 'span 5' }} p="4">
          <SectionHeader
            title={text.telephonyTrunks}
            description={text.dashboardTrunkHealthHint}
            action={
              onNavigate ? (
                <Button
                  size="xs"
                  variant="ghost"
                  color="noc.textMuted"
                  onClick={() => onNavigate('trunks')}
                >
                  {text.openDetails}
                </Button>
              ) : undefined
            }
          />
          <Stack gap="0" mt="3">
            {(telephony?.trunks ?? []).slice(0, 6).map((trunk, index) => {
              const tone: OperationalTone =
                trunk.registrationState === 'REGISTERED'
                  ? trunk.reachability === 'UNREACHABLE'
                    ? 'warning'
                    : 'healthy'
                  : trunk.registrationState === 'UNREGISTERED' ||
                      trunk.registrationState === 'REJECTED'
                    ? 'critical'
                    : 'unknown';
              return (
                <Flex
                  key={trunk.trunkId}
                  align="center"
                  justify="space-between"
                  gap="3"
                  minH={wallboard ? '46px' : '38px'}
                  py="2"
                  borderTopWidth={index === 0 ? '0' : '1px'}
                  borderColor="noc.border"
                >
                  <StatusIndicator
                    tone={tone}
                    label={
                      <Box as="span" dir="ltr">
                        {trunk.trunkId}
                      </Box>
                    }
                  />
                  <Badge
                    variant="subtle"
                    bg="noc.surface2"
                    color="noc.textMuted"
                    borderWidth="1px"
                    borderColor="noc.border"
                    fontSize="9px"
                  >
                    {trunk.registrationState}
                  </Badge>
                </Flex>
              );
            })}
            {(telephony?.trunks.length ?? 0) === 0 ? (
              <Text py="6" textAlign="center" fontSize="12px" color="noc.textSubtle">
                {text.noResults}
              </Text>
            ) : null}
          </Stack>
        </NocPanel>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <NocPanel p="4">
          <SectionHeader title={text.endpointReachability} />
          <Flex mt="4" align="end" justify="space-between" gap="3">
            <Box>
              <Text
                fontSize={wallboard ? '34px' : '28px'}
                lineHeight="1"
                fontWeight="700"
                color="noc.text"
                dir="ltr"
              >
                {healthyEndpoints}/{telephony?.endpoints.length ?? 0}
              </Text>
              <Text mt="1.5" fontSize="11px" color="noc.textMuted">
                {text.dashboardReachable}
              </Text>
            </Box>
            <StatusIndicator
              tone={toneFor(health.components.ENDPOINTS.state)}
              label={unreachableEndpoints > 0 ? String(unreachableEndpoints) : 'OK'}
            />
          </Flex>
        </NocPanel>

        <NocPanel p="4">
          <SectionHeader title={text.queuePressure} />
          <Flex mt="4" align="end" justify="space-between" gap="3">
            <Box>
              <Text
                fontSize={wallboard ? '34px' : '28px'}
                lineHeight="1"
                fontWeight="700"
                color="noc.text"
                dir="ltr"
              >
                {waitingCallers}
              </Text>
              <Text mt="1.5" fontSize="11px" color="noc.textMuted">
                {text.telephonyWaiting}
              </Text>
            </Box>
            <StatusIndicator
              tone={toneFor(health.components.QUEUES.state)}
              label={telephony?.queues.length ?? 0}
            />
          </Flex>
        </NocPanel>

        <NocPanel p="4">
          <SectionHeader title={text.serviceHealthTitle} />
          <Flex mt="4" align="end" justify="space-between" gap="3">
            <Box>
              <Text
                fontSize={wallboard ? '34px' : '28px'}
                lineHeight="1"
                fontWeight="700"
                color="noc.text"
                dir="ltr"
              >
                {sample?.services?.filter((service) => service.state === 'ACTIVE').length ?? 0}
              </Text>
              <Text mt="1.5" fontSize="11px" color="noc.textMuted">
                {text.dashboardServicesActive}
              </Text>
            </Box>
            <StatusIndicator
              tone={toneFor(health.components.SYSTEM.state)}
              label={failedServices > 0 ? String(failedServices) : 'OK'}
            />
          </Flex>
        </NocPanel>
      </SimpleGrid>
    </Stack>
  );
}
