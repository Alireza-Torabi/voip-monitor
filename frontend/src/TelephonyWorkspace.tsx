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
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type PbxProfile, type TelephonyInstanceState } from './api.js';
import { messages, type Language } from './i18n.js';

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

    const source = new EventSource(api.telephonyStateStreamUrl(selected.id));
    source.onopen = () => setLive('connected');
    source.onerror = () => setLive('disconnected');
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
      source.close();
    };
  }, [selected?.id]);

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
          matches(query, item.endpointId, item.registrationState, item.reachability),
        )
        .map((item) => ({
          key: item.endpointId,
          cells: [item.endpointId, item.registrationState, item.reachability, item.updatedAt],
        }));
    }
    if (page === 'trunks') {
      return state.trunks
        .filter((item) => matches(query, item.trunkId, item.kind, item.registrationState))
        .map((item) => ({
          key: item.trunkId,
          cells: [item.trunkId, item.kind, item.registrationState, item.updatedAt],
        }));
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
  }, [state, page, query]);

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
          ? [text.entityId, text.registrationState, text.reachability, text.updatedAt]
          : page === 'trunks'
            ? [text.entityId, text.trunkKind, text.registrationState, text.updatedAt]
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
    return (
      <Card.Root variant="outline">
        <Card.Body>{text.dashboardNoPbx}</Card.Body>
      </Card.Root>
    );
  }

  return (
    <Stack gap="5">
      <Flex
        align={{ base: 'stretch', md: 'end' }}
        justify="space-between"
        direction={{ base: 'column', md: 'row' }}
        gap="4"
      >
        <Box>
          <Heading size="xl">{titleFor(text, page)}</Heading>
          <Text color="fg.muted" mt="1">
            {text.entityWorkspaceHint}
          </Text>
        </Box>
        <HStack gap="2" flexWrap="wrap">
          <Badge
            colorPalette={live === 'connected' ? 'green' : live === 'disconnected' ? 'red' : 'gray'}
          >
            {live === 'connected'
              ? text.liveConnected
              : live === 'disconnected'
                ? text.liveDisconnectedShort
                : text.liveConnecting}
          </Badge>
          {capability ? <Badge variant="outline">{capability}</Badge> : null}
          {synchronization ? <Badge variant="outline">{synchronization}</Badge> : null}
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <Box>
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
        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb="1.5">
            {text.search}
          </Text>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPageNumber(1);
            }}
            placeholder={text.searchPlaceholder}
          />
        </Box>
      </SimpleGrid>

      {page === 'trunks' && rows.length === 0 ? (
        <Card.Root variant="outline" bg="orange.50" borderColor="orange.200">
          <Card.Body gap="1">
            <Text fontWeight="semibold">{text.trunkDiscoveryLimited}</Text>
            <Text fontSize="sm" color="fg.muted">
              {text.trunkDiscoveryLimitedHint}
            </Text>
          </Card.Body>
        </Card.Root>
      ) : null}

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

      <Card.Root variant="outline">
        <Card.Header py="3">
          <Flex justify="space-between" align="center" gap="3" flexWrap="wrap">
            <Text fontWeight="semibold">
              {text.results}: {rows.length}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {text.page} {safePage} / {pageCount}
            </Text>
          </Flex>
        </Card.Header>
        <Card.Body p="0">
          <Box overflowX="auto">
            <Table.Root size="sm" variant="outline" interactive>
              <Table.Header>
                <Table.Row>
                  {headers.map((header) => (
                    <Table.ColumnHeader key={header} whiteSpace="nowrap">
                      {header}
                    </Table.ColumnHeader>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {visibleRows.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={headers.length}>
                      <Text color="fg.muted" py="5" textAlign="center">
                        {text.noResults}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  visibleRows.map((row) => (
                    <Table.Row key={row.key}>
                      {row.cells.map((cell, index) => (
                        <Table.Cell
                          key={`${row.key}:${index}`}
                          whiteSpace={index === 0 ? 'nowrap' : 'normal'}
                          dir={index === 0 || page !== 'queues' ? 'ltr' : undefined}
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
        </Card.Body>
        <Card.Footer justifyContent="space-between">
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
        </Card.Footer>
      </Card.Root>
    </Stack>
  );
}
