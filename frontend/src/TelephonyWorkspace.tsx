import { Box, Stack, Table, Text } from '@chakra-ui/react';
import { HelpButton as Button } from './ContextHelp.js';
import { useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiError,
  type PbxProfile,
  type TelephonyEndpointState,
  type TelephonyInstanceState,
  type TelephonyTrunkState,
} from './api.js';
import type { OperationalTone } from './NocPrimitives.js';
import { messages, type Language } from './i18n.js';
import {
  DataSurface,
  WorkspaceField,
  WorkspaceHeader,
  WorkspaceSearch,
  WorkspaceSelect,
  WorkspaceState,
  WorkspaceStatusPills,
  WorkspaceToolbar,
} from './WorkspacePrimitives.js';

type TextMap = (typeof messages)[Language];
export type TelephonyPage = 'calls' | 'channels' | 'endpoints' | 'trunks' | 'queues' | 'agents';

const PAGE_SIZE = 20;
const closedChannelStates = new Set([
  'down',
  'hungup',
  'closed',
  'destroyed',
  'terminated',
  'unavailable',
]);

export function isActiveChannel(state?: string) {
  return !state || !closedChannelStates.has(state.trim().toLowerCase());
}

function titleFor(text: TextMap, page: TelephonyPage) {
  if (page === 'calls') return text.telephonyCalls;
  if (page === 'channels') return text.telephonyChannels;
  if (page === 'endpoints') return text.telephonyEndpoints;
  if (page === 'trunks') return text.telephonyTrunks;
  if (page === 'queues') return text.telephonyQueues;
  return text.telephonyAgents;
}

function capabilityFor(state: TelephonyInstanceState | null, page: TelephonyPage) {
  if (!state) return undefined;
  if (page === 'endpoints') return state.endpointCapability;
  if (page === 'trunks') return state.trunkCapability;
  if (page === 'queues') return state.queueCapability;
  if (page === 'agents') return state.agentCapability;
  return undefined;
}

function syncFor(state: TelephonyInstanceState | null, page: TelephonyPage) {
  if (!state) return undefined;
  if (page === 'endpoints') return state.endpointSynchronization;
  if (page === 'trunks') return state.trunkSynchronization;
  if (page === 'queues') return state.queueSynchronization;
  if (page === 'agents') return state.agentSynchronization;
  return state.synchronization;
}

function matches(query: string, ...values: Array<string | number | undefined>) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return values.some((value) =>
    String(value ?? '')
      .toLocaleLowerCase()
      .includes(needle),
  );
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function endpointReliability(
  item: TelephonyEndpointState,
): NonNullable<TelephonyEndpointState['reliability']> {
  if (item.reliability) return item.reliability;
  const availability =
    item.reachability === 'UNREACHABLE' || item.registrationState === 'UNREGISTERED'
      ? 'OFFLINE'
      : item.reachability === 'REACHABLE' || item.registrationState === 'REGISTERED'
        ? 'ONLINE'
        : 'UNKNOWN';
  return {
    availability,
    ...(availability === 'ONLINE' ? { lastReachableAt: item.updatedAt } : {}),
    ...(availability === 'OFFLINE'
      ? { lastUnreachableAt: item.updatedAt, offlineStartedAt: item.updatedAt }
      : {}),
    flapCount: 0,
    recentTransitions: [],
  };
}

function trunkReliability(
  item: TelephonyTrunkState,
): NonNullable<TelephonyTrunkState['reliability']> {
  if (item.reliability) return item.reliability;
  const availability =
    item.reachability === 'UNREACHABLE' ||
    ['UNREGISTERED', 'REJECTED', 'FAILED'].includes(item.registrationState)
      ? 'DOWN'
      : item.registrationState === 'REGISTERING'
        ? 'TRANSITIONING'
        : item.registrationState === 'REGISTERED' ||
            (item.registrationState === 'NOT_APPLICABLE' && item.reachability === 'REACHABLE')
          ? 'UP'
          : 'UNKNOWN';
  return {
    availability,
    ...(availability === 'UP' ? { lastUpAt: item.updatedAt } : {}),
    ...(availability === 'DOWN'
      ? { lastDownAt: item.updatedAt, outageStartedAt: item.updatedAt }
      : {}),
    flapCount: 0,
    reconnectCount: 0,
    recentTransitions: [],
  };
}

function endpointReliabilityRank(item: TelephonyEndpointState): number {
  const reliability = endpointReliability(item);
  if (reliability.availability === 'OFFLINE') return 0;
  if (reliability.flapCount > 0) return 1;
  if (reliability.availability === 'UNKNOWN') return 2;
  return 3;
}

function trunkReliabilityRank(item: TelephonyTrunkState): number {
  const reliability = trunkReliability(item);
  if (reliability.availability === 'DOWN') return 0;
  if (reliability.availability === 'TRANSITIONING') return 1;
  if (reliability.flapCount > 0) return 2;
  if (reliability.availability === 'UNKNOWN') return 3;
  return 4;
}

export function TelephonyWorkspace({
  text,
  profiles,
  page,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  page: TelephonyPage;
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [state, setState] = useState<TelephonyInstanceState | null>(null);
  const [live, setLive] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [query, setQuery] = useState('');
  const [reliabilityNow, setReliabilityNow] = useState(() => Date.now());
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState('');

  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!selected && profiles.length > 0) setSelectedId(profiles[0]?.id ?? '');
  }, [profiles, selected]);

  useEffect(() => {
    setQuery('');
    setPageNumber(1);
  }, [page, selected?.id]);

  useEffect(() => {
    if (!selected) {
      setState(null);
      return;
    }
    let cancelled = false;
    setState(null);
    setError('');
    setLive('connecting');

    api
      .telephonyState(selected.id)
      .then((value) => {
        if (!cancelled) setState(value.current);
      })
      .catch((failure) => {
        if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
        else if (!cancelled) setError(text.dashboardLoadFailed);
      });

    const refreshCurrent = async () => {
      try {
        const value = await api.telephonyState(selected.id);
        if (!cancelled) setState(value.current);
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) onUnauthorized();
      }
    };
    const fallbackTimer = window.setInterval(() => void refreshCurrent(), 10_000);

    const source = new EventSource(api.telephonyStateStreamUrl(selected.id));
    source.onopen = () => setLive('connected');
    source.onerror = () => {
      setLive('disconnected');
      void refreshCurrent();
    };
    source.addEventListener('telephony-state', (event) => {
      try {
        const value = JSON.parse((event as MessageEvent<string>).data) as {
          current?: TelephonyInstanceState | null;
        };
        if ('current' in value) setState(value.current ?? null);
      } catch {
        setLive('disconnected');
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(fallbackTimer);
      source.close();
    };
  }, [selected?.id]);

  useEffect(() => {
    const hasActiveDuration =
      (page === 'trunks' &&
        state?.trunks.some((trunk) => trunkReliability(trunk).outageStartedAt)) ||
      (page === 'endpoints' &&
        state?.endpoints.some((endpoint) => endpointReliability(endpoint).offlineStartedAt));
    if (!hasActiveDuration) return;
    const timer = window.setInterval(() => setReliabilityNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [page, state]);

  const rows = useMemo(() => {
    if (!state) return [];
    if (page === 'calls') {
      return state.calls
        .filter((item) =>
          matches(
            query,
            item.callId,
            item.linkedId,
            item.channelIds.join(' '),
            item.bridgeIds.join(' '),
          ),
        )
        .map((item) => ({
          key: item.callId,
          cells: [
            item.callId,
            item.linkedId ?? '—',
            String(item.channelIds.length),
            String(item.bridgeIds.length),
            item.updatedAt,
          ],
        }));
    }
    if (page === 'channels') {
      return state.channels
        .filter((item) => isActiveChannel(item.state))
        .filter((item) =>
          matches(
            query,
            item.channelId,
            item.channelName,
            item.linkedId,
            item.state,
            item.bridgeId,
          ),
        )
        .map((item) => ({
          key: item.channelId,
          cells: [
            item.channelId,
            item.channelName ?? '—',
            item.state ?? 'UNKNOWN',
            item.linkedId ?? '—',
            item.bridgeId ?? '—',
            item.updatedAt,
          ],
        }));
    }
    if (page === 'endpoints') {
      return state.endpoints
        .filter((item) =>
          matches(
            query,
            item.endpointId,
            item.registrationState,
            item.reachability,
            endpointReliability(item).availability,
          ),
        )
        .sort(
          (left, right) =>
            endpointReliabilityRank(left) - endpointReliabilityRank(right) ||
            endpointReliability(right).flapCount - endpointReliability(left).flapCount ||
            left.endpointId.localeCompare(right.endpointId),
        )
        .map((item) => {
          const reliability = endpointReliability(item);
          const offlineSeconds = reliability.offlineStartedAt
            ? Math.max(
                0,
                Math.floor((reliabilityNow - Date.parse(reliability.offlineStartedAt)) / 1000),
              )
            : undefined;
          const transitions = reliability.recentTransitions
            .slice(-3)
            .reverse()
            .map((transition) => `${transition.from}→${transition.to} ${transition.observedAt}`)
            .join(' · ');
          return {
            key: item.endpointId,
            cells: [
              item.endpointId,
              reliability.availability,
              item.registrationState,
              item.reachability,
              reliability.lastReachableAt ?? '—',
              reliability.lastUnreachableAt ?? '—',
              offlineSeconds === undefined ? '—' : formatDuration(offlineSeconds),
              String(reliability.flapCount),
              transitions || '—',
              item.updatedAt,
            ],
          };
        });
    }
    if (page === 'trunks') {
      return state.trunks
        .filter((item) =>
          matches(
            query,
            item.trunkId,
            item.kind,
            item.technology,
            item.confidence,
            item.registrationState,
            item.reachability,
            trunkReliability(item).availability,
          ),
        )
        .sort(
          (left, right) =>
            trunkReliabilityRank(left) - trunkReliabilityRank(right) ||
            trunkReliability(right).flapCount - trunkReliability(left).flapCount ||
            trunkReliability(right).reconnectCount - trunkReliability(left).reconnectCount ||
            left.trunkId.localeCompare(right.trunkId),
        )
        .map((item) => {
          const reliability = trunkReliability(item);
          const outageSeconds = reliability.outageStartedAt
            ? Math.max(
                0,
                Math.floor((reliabilityNow - Date.parse(reliability.outageStartedAt)) / 1000),
              )
            : undefined;
          const transitions = reliability.recentTransitions
            .slice(-3)
            .reverse()
            .map((transition) => `${transition.from}→${transition.to} ${transition.observedAt}`)
            .join(' · ');
          return {
            key: item.trunkId,
            cells: [
              item.trunkId,
              item.technology,
              item.kind,
              item.confidence,
              reliability.availability,
              item.registrationState,
              item.reachability ?? '—',
              reliability.lastUpAt ?? '—',
              reliability.lastDownAt ?? '—',
              outageSeconds === undefined ? '—' : formatDuration(outageSeconds),
              String(reliability.flapCount),
              String(reliability.reconnectCount),
              transitions || '—',
              item.updatedAt,
            ],
          };
        });
    }
    if (page === 'queues') {
      return state.queues
        .filter((item) => matches(query, item.queueId, item.strategy))
        .map((item) => {
          const members = state.queueMembers.filter((member) => member.queueId === item.queueId);
          const callers = state.queueCallers.filter((caller) => caller.queueId === item.queueId);
          return {
            key: item.queueId,
            cells: [
              item.queueId,
              item.strategy ?? '—',
              String(item.waitingCount),
              String(members.length),
              String(callers.length),
              item.updatedAt,
            ],
          };
        });
    }
    return state.agentInteractions
      .filter((item) =>
        matches(query, item.memberId, item.memberName, item.queueId, item.callerId, item.phase),
      )
      .map((item) => ({
        key: `${item.queueId}:${item.callerId}:${item.memberId}`,
        cells: [
          item.memberName ?? item.memberId,
          item.memberId,
          item.queueId,
          item.callerId,
          item.phase,
          item.updatedAt,
        ],
      }));
  }, [state, page, query, reliabilityNow]);

  const headers =
    page === 'calls'
      ? [
          text.entityId,
          text.linkedId,
          text.telephonyChannels,
          text.telephonyBridges,
          text.updatedAt,
        ]
      : page === 'channels'
        ? [
            text.entityId,
            text.channelName,
            text.entityState,
            text.linkedId,
            text.telephonyBridges,
            text.updatedAt,
          ]
        : page === 'endpoints'
          ? [
              text.entityId,
              text.endpointAvailability,
              text.registrationState,
              text.reachability,
              text.endpointLastReachable,
              text.endpointLastUnreachable,
              text.endpointOffline,
              text.endpointFlaps,
              text.endpointRecentTransitions,
              text.updatedAt,
            ]
          : page === 'trunks'
            ? [
                text.entityId,
                text.trunkTechnology,
                text.trunkKind,
                text.trunkConfidence,
                text.trunkAvailability,
                text.registrationState,
                text.reachability,
                text.trunkLastUp,
                text.trunkLastDown,
                text.trunkOutage,
                text.trunkFlaps,
                text.trunkReconnects,
                text.trunkRecentTransitions,
                text.updatedAt,
              ]
            : page === 'queues'
              ? [
                  text.entityId,
                  text.queueStrategy,
                  text.telephonyWaiting,
                  text.telephonyMembers,
                  text.telephonyCallers,
                  text.updatedAt,
                ]
              : [
                  text.agentName,
                  text.agentId,
                  text.telephonyQueues,
                  text.callerId,
                  text.entityState,
                  text.updatedAt,
                ];

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(pageNumber, pageCount);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const capability = capabilityFor(state, page);
  const synchronization = syncFor(state, page);

  if (profiles.length === 0) {
    return <WorkspaceState title={text.dashboardNoPbx} />;
  }

  const liveTone =
    live === 'connected' ? 'healthy' : live === 'disconnected' ? 'critical' : 'unknown';
  const syncTone: OperationalTone =
    synchronization === 'CURRENT' || synchronization === 'LIVE_ONLY'
      ? 'healthy'
      : synchronization === 'STALE'
        ? 'warning'
        : 'unknown';

  return (
    <Stack gap="4" data-workspace="telephony">
      <WorkspaceHeader
        title={titleFor(text, page)}
        description={text.entityWorkspaceHint}
        status={
          <WorkspaceStatusPills
            items={[
              {
                label:
                  live === 'connected'
                    ? text.liveConnected
                    : live === 'disconnected'
                      ? text.liveDisconnectedShort
                      : text.liveConnecting,
                tone: liveTone,
              },
              ...(capability
                ? [
                    {
                      label: capability,
                      tone:
                        capability === 'SUPPORTED' ? ('healthy' as const) : ('unknown' as const),
                    },
                  ]
                : []),
              ...(synchronization ? [{ label: synchronization, tone: syncTone }] : []),
            ]}
          />
        }
      />

      <WorkspaceToolbar>
        <WorkspaceField label={text.dashboardPbx}>
          <WorkspaceSelect
            value={selected?.id ?? ''}
            onChange={setSelectedId}
            ariaLabel={text.dashboardPbx}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </WorkspaceSelect>
        </WorkspaceField>
        <WorkspaceField label={text.search}>
          <WorkspaceSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPageNumber(1);
            }}
            placeholder={text.searchPlaceholder}
            ariaLabel={text.search}
          />
        </WorkspaceField>
      </WorkspaceToolbar>

      {page === 'trunks' ? (
        <WorkspaceState
          tone="warning"
          title={text.trunkDiscoveryLimited}
          detail={text.trunkDiscoveryLimitedHint}
          role="status"
        />
      ) : null}

      {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}

      <DataSurface
        title={text.results + ': ' + rows.length}
        meta={text.page + ' ' + safePage + ' / ' + pageCount}
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            >
              {text.previousPage}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount}
              onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
            >
              {text.nextPage}
            </Button>
          </>
        }
      >
        <Box overflowX="auto">
          <Table.Root size="sm" interactive>
            <Table.Header bg="noc.surface2">
              <Table.Row>
                {headers.map((header) => (
                  <Table.ColumnHeader
                    key={header}
                    whiteSpace="nowrap"
                    fontSize="10px"
                    color="noc.textSubtle"
                    letterSpacing=".04em"
                    borderColor="noc.border"
                  >
                    {header}
                  </Table.ColumnHeader>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {visibleRows.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={headers.length} borderColor="noc.border">
                    <Text color="noc.textSubtle" py="8" textAlign="center" fontSize="12px">
                      {text.noResults}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ) : (
                visibleRows.map((row) => (
                  <Table.Row key={row.key} _hover={{ bg: 'rgba(255,255,255,.025)' }}>
                    {row.cells.map((cell, index) => (
                      <Table.Cell
                        key={`${row.key}:${index}`}
                        whiteSpace={index === 0 ? 'nowrap' : 'normal'}
                        dir={index === 0 || page !== 'queues' ? 'ltr' : undefined}
                        borderColor="noc.border"
                        color={index === 0 ? 'noc.text' : 'noc.textMuted'}
                        fontSize="12px"
                        py="2.5"
                      >
                        {cell}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </DataSurface>
    </Stack>
  );
}
