import type {
  FleetOverviewItem,
  FleetOverviewSnapshot,
  OperationalHealthState,
} from '@voip-monitor/shared';
import { Box, Button, Flex, SimpleGrid, Stack, Table, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api.js';
import type { messages } from './i18n.js';
import { NocPanel, StatusIndicator, type OperationalTone } from './NocPrimitives.js';
import { DataSurface, WorkspaceHeader, WorkspaceState } from './WorkspacePrimitives.js';

type TextMap = (typeof messages)[keyof typeof messages];

function tone(state: OperationalHealthState): OperationalTone {
  if (state === 'HEALTHY') return 'healthy';
  if (state === 'CRITICAL') return 'critical';
  if (state === 'DEGRADED' || state === 'STALE') return 'warning';
  return 'unknown';
}

function label(text: TextMap, state: OperationalHealthState): string {
  if (state === 'HEALTHY') return text.dashboardHealthLabel.healthy;
  if (state === 'CRITICAL') return text.dashboardHealthLabel.critical;
  if (state === 'DEGRADED') return text.dashboardHealthLabel.warning;
  if (state === 'STALE') return text.telephonyStale;
  return text.dashboardHealthLabel.unknown;
}

function SummaryMetric({
  label,
  value,
  state,
}: {
  label: string;
  value: number;
  state?: OperationalHealthState;
}) {
  return (
    <NocPanel p="4">
      <Flex align="center" justify="space-between" gap="3">
        <Text fontSize="11px" color="noc.textMuted" fontWeight="600">
          {label}
        </Text>
        {state ? <StatusIndicator tone={tone(state)} label={String(value)} /> : null}
      </Flex>
      <Text mt="2" fontSize="28px" lineHeight="1" fontWeight="700" color="noc.text" dir="ltr">
        {value}
      </Text>
    </NocPanel>
  );
}

function FleetRow({
  item,
  text,
  onOpen,
}: {
  item: FleetOverviewItem;
  text: TextMap;
  onOpen: (id: string) => void;
}) {
  return (
    <Table.Row _hover={{ bg: 'rgba(255,255,255,.025)' }}>
      <Table.Cell borderColor="noc.border" py="3">
        <Stack gap="1">
          <Button
            variant="plain"
            p="0"
            h="auto"
            justifyContent="flex-start"
            onClick={() => onOpen(item.instanceId)}
          >
            <Text fontSize="12px" fontWeight="700" color="noc.text">
              {item.displayName}
            </Text>
          </Button>
          <Text fontSize="9px" color="noc.textSubtle" dir="ltr">
            {item.instanceId}
          </Text>
        </Stack>
      </Table.Cell>
      <Table.Cell borderColor="noc.border">
        <StatusIndicator
          tone={tone(item.health.overall)}
          label={label(text, item.health.overall)}
        />
      </Table.Cell>
      <Table.Cell borderColor="noc.border" textAlign="end" dir="ltr">
        {item.activeCalls}
      </Table.Cell>
      <Table.Cell
        borderColor="noc.border"
        textAlign="end"
        dir="ltr"
        color={item.trunkFailures > 0 ? 'noc.critical' : 'noc.textMuted'}
      >
        {item.trunkFailures}
      </Table.Cell>
      <Table.Cell
        borderColor="noc.border"
        textAlign="end"
        dir="ltr"
        color={item.endpointFailures > 0 ? 'noc.warning' : 'noc.textMuted'}
      >
        {item.endpointFailures}
      </Table.Cell>
      <Table.Cell
        borderColor="noc.border"
        textAlign="end"
        dir="ltr"
        color={item.waitingCallers > 0 ? 'noc.warning' : 'noc.textMuted'}
      >
        {item.waitingCallers}
      </Table.Cell>
      <Table.Cell
        borderColor="noc.border"
        textAlign="end"
        dir="ltr"
        color={item.criticalAlerts > 0 ? 'noc.critical' : 'noc.textMuted'}
      >
        {item.criticalAlerts}
      </Table.Cell>
      <Table.Cell borderColor="noc.border" textAlign="end">
        <Button size="xs" variant="outline" onClick={() => onOpen(item.instanceId)}>
          {text.fleetOpenPbx}
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}

export function FleetOverviewWorkspace({
  text,
  onUnauthorized,
  onOpenPbx,
}: {
  text: TextMap;
  onUnauthorized: () => void;
  onOpenPbx: (instanceId: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<FleetOverviewSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await api.fleetOverview();
        if (!cancelled) {
          setSnapshot(next);
          setError('');
          setLoading(false);
        }
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
        else if (!cancelled) {
          setError(text.fleetLoadFailed);
          setLoading(false);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onUnauthorized, text.fleetLoadFailed]);

  const issueCount = useMemo(
    () =>
      snapshot
        ? snapshot.healthCounts.CRITICAL +
          snapshot.healthCounts.DEGRADED +
          snapshot.healthCounts.STALE
        : 0,
    [snapshot],
  );

  return (
    <Stack gap="4" data-workspace="fleet-overview">
      <WorkspaceHeader
        title={text.fleetTitle}
        description={text.fleetHint}
        status={
          snapshot ? (
            <StatusIndicator
              tone={issueCount > 0 ? 'warning' : 'healthy'}
              label={
                issueCount > 0
                  ? `${issueCount} ${text.fleetNeedAttention}`
                  : text.dashboardNoProblems
              }
            />
          ) : undefined
        }
      />

      {loading ? <WorkspaceState tone="info" title={text.loading} loading role="status" /> : null}
      {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}

      {snapshot ? (
        <>
          <SimpleGrid columns={{ base: 2, md: 4, xl: 7 }} gap="3">
            <SummaryMetric label={text.fleetTotalPbx} value={snapshot.totalPbx} />
            <SummaryMetric
              label={text.dashboardHealthLabel.critical}
              value={snapshot.healthCounts.CRITICAL}
              state="CRITICAL"
            />
            <SummaryMetric
              label={text.dashboardHealthLabel.warning}
              value={snapshot.healthCounts.DEGRADED + snapshot.healthCounts.STALE}
              state="DEGRADED"
            />
            <SummaryMetric label={text.telephonyCalls} value={snapshot.activeCalls} />
            <SummaryMetric
              label={text.fleetTrunkFailures}
              value={snapshot.trunkFailures}
              state={snapshot.trunkFailures > 0 ? 'CRITICAL' : 'HEALTHY'}
            />
            <SummaryMetric
              label={text.fleetEndpointFailures}
              value={snapshot.endpointFailures}
              state={snapshot.endpointFailures > 0 ? 'DEGRADED' : 'HEALTHY'}
            />
            <SummaryMetric
              label={text.securityAlertsSummary}
              value={snapshot.criticalAlerts}
              state={snapshot.criticalAlerts > 0 ? 'CRITICAL' : 'HEALTHY'}
            />
          </SimpleGrid>

          <DataSurface
            title={text.fleetSystems}
            meta={`${text.fleetObserved}: ${new Date(snapshot.observedAt).toLocaleTimeString()}`}
          >
            <Box overflowX="auto">
              <Table.Root size="sm" interactive>
                <Table.Header bg="noc.surface2">
                  <Table.Row>
                    {[
                      text.fleetPbx,
                      text.dashboardHealth,
                      text.telephonyCalls,
                      text.telephonyTrunks,
                      text.telephonyEndpoints,
                      text.telephonyQueues,
                      text.securityAlertsSummary,
                      '',
                    ].map((head, index) => (
                      <Table.ColumnHeader
                        key={`${head}:${index}`}
                        borderColor="noc.border"
                        fontSize="10px"
                        color="noc.textSubtle"
                        whiteSpace="nowrap"
                        textAlign={index >= 2 && index <= 6 ? 'end' : undefined}
                      >
                        {head}
                      </Table.ColumnHeader>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {snapshot.items.map((item) => (
                    <FleetRow key={item.instanceId} item={item} text={text} onOpen={onOpenPbx} />
                  ))}
                  {snapshot.items.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={8} borderColor="noc.border">
                        <Text py="8" textAlign="center" color="noc.textSubtle">
                          {text.dashboardNoPbx}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ) : null}
                </Table.Body>
              </Table.Root>
            </Box>
          </DataSurface>
        </>
      ) : null}
    </Stack>
  );
}
