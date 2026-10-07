import { Box, Button, Flex, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_DASHBOARD_REFRESH_RATES,
  evaluateOperationalHealth,
  type DashboardRefreshRates,
  type OperationalHealthState,
} from '@voip-monitor/shared';
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
  refreshRates?: DashboardRefreshRates | undefined;
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

function useCadencedValue<T>(value: T, cadenceMs: number, resetKey: string, ready = true): T {
  const latest = useRef(value);
  latest.current = value;
  const [displayed, setDisplayed] = useState(value);
  const wasReady = useRef(ready);

  useEffect(() => {
    setDisplayed(latest.current);
    wasReady.current = ready;
  }, [resetKey]);

  useEffect(() => {
    if (ready !== wasReady.current) setDisplayed(latest.current);
    wasReady.current = ready;
  }, [ready]);

  useEffect(() => {
    const timer = window.setInterval(() => setDisplayed(latest.current), cadenceMs);
    return () => window.clearInterval(timer);
  }, [cadenceMs, resetKey]);

  return displayed;
}

function useActiveCallHistory(
  count: number,
  cadenceMs: number,
  resetKey: string,
): Array<{ at: number; value: number }> {
  const latest = useRef(count);
  latest.current = count;
  const [history, setHistory] = useState<Array<{ at: number; value: number }>>(() => [
    { at: Date.now(), value: count },
  ]);

  useEffect(() => {
    setHistory([{ at: Date.now(), value: latest.current }]);
  }, [resetKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHistory((current) => {
        const next = [...current, { at: Date.now(), value: latest.current }];
        return next.slice(-60);
      });
    }, cadenceMs);
    return () => window.clearInterval(timer);
  }, [cadenceMs, resetKey]);

  return history;
}

function ActiveCallsChart({
  history,
  current,
  text,
  wallboard,
}: {
  history: Array<{ at: number; value: number }>;
  current: number;
  text: TextMap;
  wallboard: boolean;
}) {
  const maxValue = Math.max(1, ...history.map((item) => item.value));
  const points = history
    .map((item, index) => {
      const x = (index * 100) / Math.max(1, history.length - 1);
      const y = 44 - (Math.max(0, item.value) * 38) / maxValue;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPoints = history.length > 1 ? `0,44 ${points} 100,44` : '';
  return (
    <NocPanel p={wallboard ? '3' : '4'} h="full" data-active-calls-chart>
      <SectionHeader
        title={text.activeCallsTrendTitle}
        description={wallboard ? undefined : text.activeCallsTrendHint}
        action={
          <Flex align="baseline" gap="2">
            <Text
              fontSize={wallboard ? '24px' : '30px'}
              fontWeight="700"
              color="noc.text"
              dir="ltr"
            >
              {current}
            </Text>
            <Text fontSize="10px" color="noc.textSubtle">
              {text.activeCallsNow}
            </Text>
          </Flex>
        }
      />
      <Box h={wallboard ? '110px' : '170px'} mt={wallboard ? '2' : '3'} minH="0">
        {history.length >= 2 ? (
          <svg
            viewBox="0 0 100 48"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            role="img"
            aria-label={text.activeCallsTrendTitle}
          >
            <defs>
              <linearGradient id="active-call-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chakra-colors-noc-accent)" stopOpacity=".36" />
                <stop offset="100%" stopColor="var(--chakra-colors-noc-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 44 H100" stroke="var(--chakra-colors-noc-border)" strokeWidth=".7" />
            <path
              d="M0 25 H100"
              stroke="var(--chakra-colors-noc-border)"
              strokeWidth=".45"
              opacity=".6"
            />
            <path
              d="M0 6 H100"
              stroke="var(--chakra-colors-noc-border)"
              strokeWidth=".45"
              opacity=".6"
            />
            {areaPoints ? <polygon points={areaPoints} fill="url(#active-call-area)" /> : null}
            <polyline
              points={points}
              fill="none"
              stroke="var(--chakra-colors-noc-accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'all 220ms ease' }}
            />
          </svg>
        ) : (
          <Flex h="full" align="center" justify="center">
            <Text fontSize="11px" color="noc.textSubtle">
              {current}
            </Text>
          </Flex>
        )}
      </Box>
      <Flex justify="space-between" mt="1">
        <Text fontSize="9px" color="noc.textSubtle">
          0
        </Text>
        <Text fontSize="9px" color="noc.textSubtle" dir="ltr">
          max {maxValue}
        </Text>
      </Flex>
    </NocPanel>
  );
}

function CpuMemoryTimeSeries({
  samples,
  cpuCurrent,
  memoryCurrent,
  text,
  wallboard,
}: {
  samples: SystemMetricsSample[];
  cpuCurrent: number | undefined;
  memoryCurrent: number | undefined;
  text: TextMap;
  wallboard: boolean;
}) {
  const values = useMemo(
    () =>
      [...samples]
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
        .slice(-60)
        .map((sample) => ({
          observedAt: sample.observedAt,
          cpu: sample.cpu?.utilizationPercent,
          memory:
            sample.memory && sample.memory.totalBytes > 0
              ? (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) /
                sample.memory.totalBytes
              : undefined,
        })),
    [samples],
  );
  const line = (key: 'cpu' | 'memory') =>
    values
      .map((item, index) => {
        const value = item[key];
        if (value === undefined) return null;
        const x = (index * 100) / Math.max(1, values.length - 1);
        const y = 42 - (Math.max(0, Math.min(100, value)) * 36) / 100;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter((item): item is string => item !== null)
      .join(' ');
  const cpuPoints = line('cpu');
  const memoryPoints = line('memory');
  return (
    <NocInset p={wallboard ? '2.5' : '3'} data-time-series="cpu-memory">
      <Flex align="center" justify="space-between" gap="3" flexWrap="wrap">
        <Text fontSize="11px" color="noc.textMuted" fontWeight="600">
          {text.dashboardSystemTrendTitle}
        </Text>
        <Flex gap="4" align="center">
          <Flex gap="1.5" align="center">
            <Box w="7px" h="7px" borderRadius="full" bg="noc.accent" />
            <Text fontSize="10px" color="noc.textMuted">
              CPU
            </Text>
            <Text fontSize="12px" color="noc.text" fontWeight="700" dir="ltr">
              {compactPercent(cpuCurrent)}
            </Text>
          </Flex>
          <Flex gap="1.5" align="center">
            <Box w="7px" h="7px" borderRadius="full" bg="noc.warning" />
            <Text fontSize="10px" color="noc.textMuted">
              RAM
            </Text>
            <Text fontSize="12px" color="noc.text" fontWeight="700" dir="ltr">
              {compactPercent(memoryCurrent)}
            </Text>
          </Flex>
        </Flex>
      </Flex>
      <Box h={wallboard ? '74px' : '112px'} mt="2">
        {cpuPoints || memoryPoints ? (
          <svg
            viewBox="0 0 100 46"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            role="img"
            aria-label={text.dashboardSystemTrendTitle}
          >
            <path d="M0 42 H100" stroke="var(--chakra-colors-noc-border)" strokeWidth=".7" />
            <path
              d="M0 24 H100"
              stroke="var(--chakra-colors-noc-border)"
              strokeWidth=".45"
              opacity=".6"
            />
            <path
              d="M0 6 H100"
              stroke="var(--chakra-colors-noc-border)"
              strokeWidth=".45"
              opacity=".6"
            />
            {cpuPoints ? (
              <polyline
                points={cpuPoints}
                fill="none"
                stroke="var(--chakra-colors-noc-accent)"
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {memoryPoints ? (
              <polyline
                points={memoryPoints}
                fill="none"
                stroke="var(--chakra-colors-noc-warning)"
                strokeWidth="1.8"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
        ) : (
          <Flex h="full" align="center" justify="center">
            <Text fontSize="11px" color="noc.textSubtle">
              —
            </Text>
          </Flex>
        )}
      </Box>
    </NocInset>
  );
}

function StorageGauge({
  filesystem,
  usedLabel,
  totalLabel,
  compact = false,
}: {
  filesystem: NonNullable<SystemMetricsSample['filesystems']>[number];
  usedLabel: string;
  totalLabel: string;
  compact?: boolean | undefined;
}) {
  const usedBytes = Math.max(0, filesystem.totalBytes - filesystem.availableBytes);
  const percent = filesystem.totalBytes > 0 ? (100 * usedBytes) / filesystem.totalBytes : 0;
  const clamped = Math.max(0, Math.min(100, percent));
  const pathLength = 100;
  const gradientId = `storage-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <NocInset p={compact ? '2' : '3'} minW="0" data-storage-gauge={filesystem.filesystemId}>
      <Text fontSize="11px" color="noc.textMuted" fontWeight="600" dir="ltr" truncate>
        {filesystem.mountPoint}
      </Text>
      <Box position="relative" h={compact ? '62px' : '92px'} mt="1">
        <svg
          viewBox="0 0 120 70"
          width="100%"
          height={compact ? 62 : 92}
          role="img"
          aria-label={filesystem.mountPoint}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chakra-colors-noc-healthy)" />
              <stop offset="58%" stopColor="var(--chakra-colors-noc-healthy)" />
              <stop offset="76%" stopColor="var(--chakra-colors-noc-warning)" />
              <stop offset="100%" stopColor="var(--chakra-colors-noc-critical)" />
            </linearGradient>
          </defs>
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
            stroke={`url(#${gradientId})`}
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
          pb={compact ? '1px' : '6px'}
        >
          <Text fontSize={compact ? '16px' : '22px'} fontWeight="700" color="noc.text" dir="ltr">
            {compactPercent(percent)}
          </Text>
        </Box>
      </Box>
      {!compact ? (
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
      ) : null}
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
  refreshRates = DEFAULT_DASHBOARD_REFRESH_RATES,
  onNavigate,
  wallboard = false,
}: OperatorOverviewProps) {
  const sample = metrics?.source?.health.freshness === 'CURRENT' ? (metrics.current ?? null) : null;
  const memoryPercent =
    sample?.memory && sample.memory.totalBytes > 0
      ? (100 * (sample.memory.totalBytes - sample.memory.availableBytes)) / sample.memory.totalBytes
      : undefined;
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

  const rawHealthyEndpoints =
    telephony?.endpoints.filter((endpoint) => endpoint.reachability === 'REACHABLE').length ?? 0;
  const endpointStats = useCadencedValue(
    {
      reachable: rawHealthyEndpoints,
      total: telephony?.endpoints.length ?? 0,
      unreachable: unreachableEndpoints,
    },
    refreshRates.endpointsMs,
    instanceId,
    telephony !== null,
  );
  const queueStats = useCadencedValue(
    { waiting: waitingCallers, total: telephony?.queues.length ?? 0 },
    refreshRates.queuesMs,
    instanceId,
    telephony !== null,
  );
  const serviceStats = useCadencedValue(
    {
      active: sample?.services?.filter((service) => service.state === 'ACTIVE').length ?? 0,
      failed: failedServices,
    },
    refreshRates.servicesMs,
    instanceId,
    sample !== null,
  );
  const cpuMemoryDisplay = useCadencedValue(
    { sample, history: metricHistory },
    refreshRates.cpuMemoryMs,
    instanceId,
    sample !== null,
  );
  const displayMemoryPercent =
    cpuMemoryDisplay.sample?.memory && cpuMemoryDisplay.sample.memory.totalBytes > 0
      ? (100 *
          (cpuMemoryDisplay.sample.memory.totalBytes -
            cpuMemoryDisplay.sample.memory.availableBytes)) /
        cpuMemoryDisplay.sample.memory.totalBytes
      : undefined;
  const displayFilesystems = useCadencedValue(
    visibleFilesystems,
    refreshRates.storageMs,
    instanceId,
    metrics !== undefined,
  );
  const displayIssues = useCadencedValue(issues, refreshRates.problemsMs, instanceId);
  const displayHealthState = useCadencedValue(health.overall, refreshRates.problemsMs, instanceId);
  const overallTone = toneFor(displayHealthState);
  const activeCallHistory = useActiveCallHistory(
    telephony?.calls.length ?? 0,
    refreshRates.activeCallsMs,
    instanceId,
  );
  const displayedActiveCalls = activeCallHistory.at(-1)?.value ?? 0;

  return (
    <Box
      display="grid"
      gridTemplateRows={wallboard ? 'auto minmax(0, 1.55fr) auto minmax(0, .72fr)' : 'auto'}
      gap={wallboard ? '2' : '4'}
      h={wallboard ? 'full' : undefined}
      minH="0"
      overflow={wallboard ? 'hidden' : undefined}
      data-operator-overview
      data-overall-tone={overallTone}
      data-wallboard-overview={wallboard ? 'true' : 'false'}
    >
      <NocPanel overflow="hidden">
        <SimpleGrid columns={{ base: 2, md: 5 }} divideX={{ md: '1px' }} divideColor="noc.border">
          <KpiCell
            label={text.dashboardHealth}
            value={labelFor(displayHealthState)}
            detail={connection}
            tone={overallTone}
          />
          <KpiCell
            label={text.telephonyEndpoints}
            value={endpointStats.reachable.toString()}
            detail={`${endpointStats.total} ${text.dashboardTotalEndpoints}`}
            tone={telephony ? 'info' : 'unknown'}
            onClick={onNavigate ? () => onNavigate('endpoints') : undefined}
          />
          <KpiCell
            label={text.telephonyQueues}
            value={queueStats.total.toString()}
            detail={queueStats.waiting + ' ' + text.telephonyWaiting.toLowerCase()}
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

      <SimpleGrid columns={{ base: 1, lg: 12 }} gap={wallboard ? '2' : '4'} minH="0">
        <Box gridColumn={{ lg: 'span 7' }} minH="0">
          <ActiveCallsChart
            history={activeCallHistory}
            current={displayedActiveCalls}
            text={text}
            wallboard={wallboard}
          />
        </Box>

        <NocPanel
          gridColumn={{ lg: 'span 5' }}
          p={wallboard ? '3' : '4'}
          minH="0"
          overflow="hidden"
        >
          <SectionHeader
            title={text.dashboardInfrastructure}
            description={wallboard ? undefined : text.metricsTrendHint}
            action={
              <Text fontSize="10px" color="noc.textSubtle" dir="ltr">
                {formatUptime(cpuMemoryDisplay.sample?.uptime?.uptimeSeconds)}
              </Text>
            }
          />
          <Stack gap={wallboard ? '2' : '3'} mt={wallboard ? '2' : '3'} minH="0">
            <CpuMemoryTimeSeries
              samples={cpuMemoryDisplay.history}
              cpuCurrent={cpuMemoryDisplay.sample?.cpu?.utilizationPercent}
              memoryCurrent={displayMemoryPercent}
              text={text}
              wallboard={wallboard}
            />
            <Box minH="0">
              <Flex align="center" justify="space-between" gap="3" mb="1.5">
                <Text fontSize="10px" color="noc.textMuted" fontWeight="600">
                  {text.storageTitle}
                </Text>
                <Text fontSize="9px" color="noc.textSubtle">
                  {displayFilesystems.length}
                </Text>
              </Flex>
              {displayFilesystems.length > 0 ? (
                <SimpleGrid
                  columns={{
                    base: 1,
                    sm: 2,
                    xl: wallboard ? Math.min(3, Math.max(1, displayFilesystems.length)) : 2,
                  }}
                  gap={wallboard ? '1.5' : '2'}
                >
                  {displayFilesystems.map((filesystem) => (
                    <StorageGauge
                      key={filesystem.filesystemId}
                      filesystem={filesystem}
                      usedLabel={text.storageUsed}
                      totalLabel={text.storageTotal}
                      compact={wallboard}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <NocInset p="2.5">
                  <Text fontSize="10px" color="noc.textSubtle">
                    {text.storageNoData}
                  </Text>
                </NocInset>
              )}
            </Box>
          </Stack>
        </NocPanel>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, sm: 3 }} gap={wallboard ? '2' : '4'}>
        <NocPanel
          p={wallboard ? '3' : '4'}
          data-endpoint-reachability
          data-reachable={endpointStats.reachable}
          data-total={endpointStats.total}
          data-unreachable={endpointStats.unreachable}
        >
          <SectionHeader title={text.endpointReachability} />
          <Flex mt={wallboard ? '2' : '4'} align="end" justify="space-between" gap="3">
            <Box>
              <Text
                fontSize={wallboard ? '26px' : '28px'}
                lineHeight="1"
                fontWeight="700"
                color="noc.text"
                dir="ltr"
              >
                {endpointStats.reachable}
              </Text>
              <Text mt="1" fontSize="10px" color="noc.textMuted">
                {text.dashboardReachable}
              </Text>
              <Text mt="0.5" fontSize="9px" color="noc.textSubtle" dir="ltr">
                {text.dashboardTotalEndpoints}: {endpointStats.total}
              </Text>
            </Box>
            <StatusIndicator
              tone="info"
              label={`${endpointStats.unreachable} ${text.dashboardUnreachable}`}
            />
          </Flex>
        </NocPanel>

        <NocPanel p={wallboard ? '3' : '4'}>
          <SectionHeader title={text.queuePressure} />
          <Flex mt={wallboard ? '2' : '4'} align="end" justify="space-between" gap="3">
            <Box>
              <Text
                fontSize={wallboard ? '26px' : '28px'}
                lineHeight="1"
                fontWeight="700"
                color="noc.text"
                dir="ltr"
              >
                {queueStats.waiting}
              </Text>
              <Text mt="1" fontSize="10px" color="noc.textMuted">
                {text.telephonyWaiting}
              </Text>
            </Box>
            <StatusIndicator
              tone={toneFor(health.components.QUEUES.state)}
              label={queueStats.total}
            />
          </Flex>
        </NocPanel>

        <NocPanel p={wallboard ? '3' : '4'}>
          <SectionHeader title={text.serviceHealthTitle} />
          <Flex mt={wallboard ? '2' : '4'} align="end" justify="space-between" gap="3">
            <Box>
              <Text
                fontSize={wallboard ? '26px' : '28px'}
                lineHeight="1"
                fontWeight="700"
                color="noc.text"
                dir="ltr"
              >
                {serviceStats.active}
              </Text>
              <Text mt="1" fontSize="10px" color="noc.textMuted">
                {text.dashboardServicesActive}
              </Text>
            </Box>
            <StatusIndicator
              tone={toneFor(health.components.SYSTEM.state)}
              label={serviceStats.failed > 0 ? String(serviceStats.failed) : 'OK'}
            />
          </Flex>
        </NocPanel>
      </SimpleGrid>

      <NocPanel p={wallboard ? '3' : '4'} minH="0" overflow="hidden" data-current-problems>
        <SectionHeader
          title={text.dashboardCurrentProblems}
          description={wallboard ? undefined : text.dashboardCurrentProblemsHint}
          action={
            <StatusIndicator
              tone={overallTone}
              label={
                displayIssues.length === 0 ? text.dashboardNoProblems : String(displayIssues.length)
              }
            />
          }
        />
        <SimpleGrid columns={{ base: 1, md: wallboard ? 3 : 1 }} gap="2" mt={wallboard ? '2' : '4'}>
          {displayIssues.length === 0 ? (
            <NocInset p={wallboard ? '2.5' : '4'}>
              <Flex align="center" gap="3">
                <StatusIndicator tone="healthy" label={text.dashboardNoProblems} />
                {!wallboard ? (
                  <Text fontSize="12px" color="noc.textMuted">
                    {text.dashboardNoProblemsHint}
                  </Text>
                ) : null}
              </Flex>
            </NocInset>
          ) : (
            displayIssues.slice(0, wallboard ? 3 : 6).map((issue) => (
              <Button
                key={issue.id}
                variant="plain"
                h="auto"
                p="0"
                textAlign="start"
                disabled={!issue.destination}
                onClick={
                  issue.destination && onNavigate ? () => onNavigate(issue.destination!) : undefined
                }
              >
                <NocInset
                  w="full"
                  px="3"
                  py={wallboard ? '2' : '3'}
                  {...(issue.destination ? { _hover: { borderColor: 'noc.borderStrong' } } : {})}
                >
                  <Flex align="center" justify="space-between" gap="3">
                    <StatusIndicator tone={issue.tone} label={issue.title} />
                    <Text fontSize="11px" color="noc.text" fontWeight="600" dir="ltr">
                      {issue.detail}
                    </Text>
                  </Flex>
                </NocInset>
              </Button>
            ))
          )}
        </SimpleGrid>
      </NocPanel>
    </Box>
  );
}
