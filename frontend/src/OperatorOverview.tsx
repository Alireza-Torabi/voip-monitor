import { Box, Button, Flex, SimpleGrid, Stack, Text } from '@chakra-ui/react';
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

function formatBytes(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = Math.max(0, value);
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
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

function TimeSeries({
  samples,
  label,
  valueFor,
  current,
}: {
  samples: SystemMetricsSample[];
  label: string;
  valueFor: (sample: SystemMetricsSample) => number | undefined;
  current: number | undefined;
}) {
  const values = useMemo(
    () =>
      [...samples]
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
        .slice(-60)
        .map((sample) => ({ observedAt: sample.observedAt, value: valueFor(sample) }))
        .filter((item): item is { observedAt: string; value: number } => item.value !== undefined),
    [samples, valueFor],
  );
  const points = values
    .map((item, index) => {
      const x = (index * 100) / Math.max(1, values.length - 1);
      const y = 42 - (Math.max(0, Math.min(100, item.value)) * 36) / 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <NocInset p="3" data-time-series={label}>
      <Flex align="baseline" justify="space-between" gap="3">
        <Text fontSize="11px" color="noc.textMuted" fontWeight="600">
          {label}
        </Text>
        <Text fontSize="18px" color="noc.text" fontWeight="700" dir="ltr">
          {compactPercent(current)}
        </Text>
      </Flex>
      <Box h="68px" mt="2">
        {values.length >= 2 ? (
          <svg
            viewBox="0 0 100 46"
            width="100%"
            height="68"
            preserveAspectRatio="none"
            role="img"
            aria-label={label}
          >
            <path d="M0 42 H100" stroke="var(--chakra-colors-noc-border)" strokeWidth="1" />
            <path
              d="M0 24 H100"
              stroke="var(--chakra-colors-noc-border)"
              strokeWidth=".6"
              opacity=".65"
            />
            <path
              d="M0 6 H100"
              stroke="var(--chakra-colors-noc-border)"
              strokeWidth=".6"
              opacity=".65"
            />
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
      <Flex justify="space-between" mt="1">
        <Text fontSize="9px" color="noc.textSubtle">
          0%
        </Text>
        <Text fontSize="9px" color="noc.textSubtle">
          100%
        </Text>
      </Flex>
    </NocInset>
  );
}

function StorageGauge({
  filesystem,
  usedLabel,
  totalLabel,
}: {
  filesystem: NonNullable<SystemMetricsSample['filesystems']>[number];
  usedLabel: string;
  totalLabel: string;
}) {
  const usedBytes = Math.max(0, filesystem.totalBytes - filesystem.availableBytes);
  const percent = filesystem.totalBytes > 0 ? (100 * usedBytes) / filesystem.totalBytes : 0;
  const clamped = Math.max(0, Math.min(100, percent));
  const pathLength = 100;
  const tone = percentTone(percent, 90, 97);
  const color = {
    healthy: 'var(--chakra-colors-noc-healthy)',
    warning: 'var(--chakra-colors-noc-warning)',
    critical: 'var(--chakra-colors-noc-critical)',
    info: 'var(--chakra-colors-noc-info)',
    unknown: 'var(--chakra-colors-noc-unknown)',
  }[tone];
  return (
    <NocInset p="3" minW="0" data-storage-gauge={filesystem.filesystemId}>
      <Text fontSize="11px" color="noc.textMuted" fontWeight="600" dir="ltr" truncate>
        {filesystem.mountPoint}
      </Text>
      <Box position="relative" h="92px" mt="1">
        <svg
          viewBox="0 0 120 70"
          width="100%"
          height="92"
          role="img"
          aria-label={filesystem.mountPoint}
        >
          <path
            d="M15 58 A45 45 0 0 1 105 58"
            pathLength={pathLength}
            fill="none"
            stroke="var(--chakra-colors-noc-surface3)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M15 58 A45 45 0 0 1 105 58"
            pathLength={pathLength}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${clamped} ${100 - clamped}`}
          />
        </svg>
        <Box
          position="absolute"
          inset="0"
          display="flex"
          alignItems="end"
          justifyContent="center"
          pb="6px"
        >
          <Text fontSize="22px" fontWeight="700" color="noc.text" dir="ltr">
            {compactPercent(percent)}
          </Text>
        </Box>
      </Box>
      <Flex justify="space-between" gap="3" mt="1">
        <Text fontSize="9px" color="noc.textSubtle">
          {usedLabel}:{' '}
          <Box as="span" dir="ltr">
            {formatBytes(usedBytes)}
          </Box>
        </Text>
        <Text fontSize="9px" color="noc.textSubtle">
          {totalLabel}:{' '}
          <Box as="span" dir="ltr">
            {formatBytes(filesystem.totalBytes)}
          </Box>
        </Text>
      </Flex>
    </NocInset>
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
  const sample = metrics?.source?.health.freshness === 'CURRENT' ? (metrics.current ?? null) : null;
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
            value={healthyEndpoints.toString()}
            detail={`${telephony?.endpoints.length ?? 0} ${text.dashboardTotalEndpoints}`}
            tone={telephony ? 'info' : 'unknown'}
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
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              <TimeSeries
                samples={metricHistory}
                label={text.cpuUsage}
                valueFor={(historySample) => historySample.cpu?.utilizationPercent}
                current={sample?.cpu?.utilizationPercent}
              />
              <TimeSeries
                samples={metricHistory}
                label={text.memoryUsage}
                valueFor={(historySample) =>
                  historySample.memory && historySample.memory.totalBytes > 0
                    ? (100 *
                        (historySample.memory.totalBytes - historySample.memory.availableBytes)) /
                      historySample.memory.totalBytes
                    : undefined
                }
                current={memoryPercent}
              />
            </SimpleGrid>
            <Box>
              <Flex align="center" justify="space-between" gap="3" mb="2">
                <Text fontSize="11px" color="noc.textMuted" fontWeight="600">
                  {text.storageTitle}
                </Text>
                <Text fontSize="10px" color="noc.textSubtle">
                  {visibleFilesystems.length}
                </Text>
              </Flex>
              {visibleFilesystems.length > 0 ? (
                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3">
                  {visibleFilesystems.map((filesystem) => (
                    <StorageGauge
                      key={filesystem.filesystemId}
                      filesystem={filesystem}
                      usedLabel={text.storageUsed}
                      totalLabel={text.storageTotal}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <NocInset p="3">
                  <Text fontSize="11px" color="noc.textSubtle">
                    {text.storageNoData}
                  </Text>
                </NocInset>
              )}
            </Box>
            <Flex align="center" justify="space-between" gap="3">
              <Text fontSize="12px" color="noc.textMuted">
                {text.uptime}
              </Text>
              <Text fontSize="12px" color="noc.text" fontWeight="600" dir="ltr">
                {formatUptime(sample?.uptime?.uptimeSeconds)}
              </Text>
            </Flex>
          </Stack>
        </NocPanel>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        <NocPanel
          p="4"
          data-endpoint-reachability
          data-reachable={healthyEndpoints}
          data-total={telephony?.endpoints.length ?? 0}
          data-unreachable={unreachableEndpoints}
        >
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
                {healthyEndpoints}
              </Text>
              <Text mt="1.5" fontSize="11px" color="noc.textMuted">
                {text.dashboardReachable}
              </Text>
              <Text mt="1" fontSize="10px" color="noc.textSubtle" dir="ltr">
                {text.dashboardTotalEndpoints}: {telephony?.endpoints.length ?? 0}
              </Text>
            </Box>
            <StatusIndicator
              tone="info"
              label={`${unreachableEndpoints} ${text.dashboardUnreachable}`}
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
