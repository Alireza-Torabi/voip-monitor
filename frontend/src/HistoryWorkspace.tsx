import { Badge, Box, Button, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
  api,
  ApiError,
  type HistoricalCallEventRecord,
  type HistoricalCallRecord,
  type HistoricalDatasetAvailability,
  type HistoricalQueueEventRecord,
  type HistoricalSourceCapabilities,
  type PbxProfile,
} from './api.js';
import type { messages } from './i18n.js';
import {
  DataSurface,
  WorkspaceField,
  WorkspaceHeader,
  WorkspaceSelect,
  WorkspaceState,
  WorkspaceToolbar,
} from './WorkspacePrimitives.js';

type TextMap = (typeof messages)['en'] | (typeof messages)['fa'];
type Dataset = 'calls' | 'call-events' | 'queue-events';
type Row = HistoricalCallRecord | HistoricalCallEventRecord | HistoricalQueueEventRecord;

function availability(capabilities: HistoricalSourceCapabilities | null, dataset: Dataset) {
  if (!capabilities) return undefined;
  if (dataset === 'calls') return capabilities.calls.availability;
  if (dataset === 'call-events') return capabilities.callEvents.availability;
  return capabilities.queueEvents.availability;
}

function statusTone(value: HistoricalDatasetAvailability) {
  return value === 'SUPPORTED' ? 'green' : value === 'AMBIGUOUS' ? 'orange' : 'gray';
}

function HistoryDatum({
  label,
  value,
  ltr = false,
  mono = false,
}: {
  label: string;
  value: string | number;
  ltr?: boolean;
  mono?: boolean;
}) {
  return (
    <Box minW="0">
      <Text
        fontSize="9px"
        color="noc.textSubtle"
        fontWeight="700"
        letterSpacing=".04em"
        textTransform="uppercase"
      >
        {label}
      </Text>
      <Text
        mt="1"
        fontSize="12px"
        color="noc.textMuted"
        dir={ltr ? 'ltr' : undefined}
        fontFamily={mono ? 'mono' : undefined}
        truncate
      >
        {value}
      </Text>
    </Box>
  );
}

export function HistoryWorkspace({
  text,
  profiles,
  onUnauthorized,
}: {
  text: TextMap;
  profiles: PbxProfile[];
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const [dataset, setDataset] = useState<Dataset>('calls');
  const [capabilities, setCapabilities] = useState<HistoricalSourceCapabilities | null>(null);
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profiles.some((profile) => profile.id === selectedId)) {
      setSelectedId(profiles[0]?.id ?? '');
    }
  }, [profiles, selectedId]);

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId),
    [profiles, selectedId],
  );

  async function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      onUnauthorized();
      return;
    }
    setError(text.historyLoadFailed);
  }

  async function loadCapabilities(id: string) {
    setLoading(true);
    setError('');
    setRows([]);
    try {
      const next = await api.historyCapabilities(id);
      setCapabilities(next);
      const firstSupported: Dataset | undefined =
        next.calls.availability === 'SUPPORTED'
          ? 'calls'
          : next.callEvents.availability === 'SUPPORTED'
            ? 'call-events'
            : next.queueEvents.availability === 'SUPPORTED'
              ? 'queue-events'
              : undefined;
      if (firstSupported) setDataset(firstSupported);
    } catch (cause) {
      setCapabilities(null);
      await handleError(cause);
    } finally {
      setLoading(false);
    }
  }

  async function loadRows(id: string, nextDataset = dataset) {
    setLoading(true);
    setError('');
    try {
      const response =
        nextDataset === 'calls'
          ? await api.historyCalls(id)
          : nextDataset === 'call-events'
            ? await api.historyCallEvents(id)
            : await api.historyQueueEvents(id);
      setRows(response.items);
    } catch (cause) {
      setRows([]);
      await handleError(cause);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId) void loadCapabilities(selectedId);
  }, [selectedId]);

  if (!selected) {
    return <WorkspaceState title={text.historyNoPbx} />;
  }

  const selectedAvailability = availability(capabilities, dataset);
  const datasetItems = capabilities
    ? ([
        ['calls', text.historyCalls, capabilities.calls.availability],
        ['call-events', text.historyCallEvents, capabilities.callEvents.availability],
        ['queue-events', text.historyQueueEvents, capabilities.queueEvents.availability],
      ] as const)
    : [];

  return (
    <Stack gap="4" data-workspace="history">
      <WorkspaceHeader title={text.historyTitle} description={text.historyHint} />

      <WorkspaceToolbar>
        <WorkspaceField label={text.historyPbx}>
          <WorkspaceSelect value={selectedId} onChange={setSelectedId} ariaLabel={text.historyPbx}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </WorkspaceSelect>
        </WorkspaceField>
        <Box flex="2 1 420px" minW={{ base: '100%', md: '360px' }}>
          <Text
            fontSize="10px"
            color="noc.textSubtle"
            fontWeight="700"
            letterSpacing=".06em"
            textTransform="uppercase"
            mb="1.5"
          >
            {text.historyDataset}
          </Text>
          <HStack gap="1" flexWrap="wrap">
            {datasetItems.map(([value, label, state]) => (
              <Button
                key={value}
                size="sm"
                variant="ghost"
                borderRadius="nocControl"
                color={dataset === value ? 'white' : 'noc.textMuted'}
                bg={dataset === value ? 'rgba(45,140,255,.18)' : 'transparent'}
                borderWidth="1px"
                borderColor={dataset === value ? 'rgba(45,140,255,.30)' : 'noc.border'}
                disabled={state !== 'SUPPORTED'}
                onClick={() => {
                  setDataset(value);
                  setRows([]);
                }}
              >
                <HStack gap="2">
                  <Text fontSize="11px">{label}</Text>
                  <Badge variant="subtle" colorPalette={statusTone(state)} fontSize="9px">
                    {state}
                  </Badge>
                </HStack>
              </Button>
            ))}
          </HStack>
        </Box>
        <HStack gap="2" flex="0 0 auto">
          <Button
            size="sm"
            colorPalette="blue"
            disabled={!selectedAvailability || selectedAvailability !== 'SUPPORTED' || loading}
            onClick={() => void loadRows(selected.id)}
          >
            {text.historyLoad}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void loadCapabilities(selected.id)}
          >
            {text.historyInspect}
          </Button>
        </HStack>
      </WorkspaceToolbar>

      {error ? <WorkspaceState tone="critical" title={error} role="alert" /> : null}
      {loading ? <WorkspaceState tone="info" title={text.loading} loading role="status" /> : null}

      <DataSurface
        title={
          dataset === 'calls'
            ? text.historyCalls
            : dataset === 'call-events'
              ? text.historyCallEvents
              : text.historyQueueEvents
        }
        meta={rows.length + ' ' + text.results.toLowerCase()}
        footer={
          <Text fontSize="10px" color="noc.textSubtle">
            {text.historySourceTimestampHint}
          </Text>
        }
      >
        {rows.length === 0 && !loading ? (
          <Text color="noc.textSubtle" py="10" textAlign="center" fontSize="12px">
            {text.historyNoRows}
          </Text>
        ) : (
          <Stack gap="0">
            {rows.map((row, index) => (
              <Box
                key={index}
                px="4"
                py="3"
                borderTopWidth={index === 0 ? '0' : '1px'}
                borderColor="noc.border"
                _hover={{ bg: 'rgba(255,255,255,.02)' }}
              >
                {'recordId' in row ? (
                  <SimpleGrid columns={{ base: 2, md: 4, xl: 7 }} gap="3">
                    <HistoryDatum label={text.historyTime} value={row.sourceStartedAt} ltr />
                    <HistoryDatum label={text.historyFrom} value={row.sourceNumber ?? '—'} ltr />
                    <HistoryDatum label={text.historyTo} value={row.destinationNumber ?? '—'} ltr />
                    <HistoryDatum label={text.historyDisposition} value={row.disposition} />
                    <HistoryDatum
                      label={text.historyDuration}
                      value={row.durationSeconds + 's'}
                      ltr
                    />
                    <HistoryDatum
                      label={text.historyBillable}
                      value={row.billableSeconds + 's'}
                      ltr
                    />
                    <HistoryDatum label={text.historyRecordId} value={row.recordId} ltr mono />
                  </SimpleGrid>
                ) : 'queueId' in row ? (
                  <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} gap="3">
                    <HistoryDatum label={text.historyTime} value={row.sourceOccurredAt} ltr />
                    <HistoryDatum label={text.historyEvent} value={row.eventType} />
                    <HistoryDatum label={text.historyQueue} value={row.queueId} ltr mono />
                    <HistoryDatum label={text.historyAgent} value={row.agentId ?? '—'} ltr mono />
                    <HistoryDatum label={text.historyCallId} value={row.callId} ltr mono />
                  </SimpleGrid>
                ) : (
                  <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} gap="3">
                    <HistoryDatum label={text.historyTime} value={row.sourceOccurredAt} ltr />
                    <HistoryDatum label={text.historyEvent} value={row.eventType} />
                    <HistoryDatum label={text.historyCallId} value={row.callId} ltr mono />
                    <HistoryDatum
                      label={text.historyExtension}
                      value={row.extension ?? '—'}
                      ltr
                      mono
                    />
                    <HistoryDatum label={text.historyCaller} value={row.callerNumber ?? '—'} ltr />
                  </SimpleGrid>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DataSurface>
    </Stack>
  );
}
