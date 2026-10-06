import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
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
    return (
      <Card.Root variant="outline">
        <Card.Body>
          <Text>{text.historyNoPbx}</Text>
        </Card.Body>
      </Card.Root>
    );
  }

  const selectedAvailability = availability(capabilities, dataset);

  return (
    <Stack gap="5">
      <Card.Root variant="outline">
        <Card.Body gap="4">
          <Box>
            <Text fontWeight="semibold">{text.historyTitle}</Text>
            <Text color="fg.muted" fontSize="sm">
              {text.historyHint}
            </Text>
          </Box>
          <NativeSelect.Root maxW="md">
            <NativeSelect.Field
              value={selectedId}
              onChange={(event) => setSelectedId(event.currentTarget.value)}
              aria-label={text.historyPbx}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          {error ? (
            <Text color="red.700" role="alert">
              {error}
            </Text>
          ) : null}
          {loading ? (
            <HStack>
              <Spinner size="sm" />
              <Text>{text.loading}</Text>
            </HStack>
          ) : null}
          {capabilities ? (
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
              {(
                [
                  ['calls', text.historyCalls, capabilities.calls.availability],
                  ['call-events', text.historyCallEvents, capabilities.callEvents.availability],
                  ['queue-events', text.historyQueueEvents, capabilities.queueEvents.availability],
                ] as const
              ).map(([value, label, state]) => (
                <Button
                  key={value}
                  variant={dataset === value ? 'solid' : 'outline'}
                  colorPalette={dataset === value ? 'blue' : 'gray'}
                  justifyContent="space-between"
                  disabled={state !== 'SUPPORTED'}
                  onClick={() => {
                    setDataset(value);
                    setRows([]);
                  }}
                >
                  <span>{label}</span>
                  <Badge colorPalette={statusTone(state)}>{state}</Badge>
                </Button>
              ))}
            </SimpleGrid>
          ) : null}
          <HStack>
            <Button
              colorPalette="blue"
              disabled={!selectedAvailability || selectedAvailability !== 'SUPPORTED' || loading}
              onClick={() => void loadRows(selected.id)}
            >
              {text.historyLoad}
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void loadCapabilities(selected.id)}
            >
              {text.historyInspect}
            </Button>
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            {text.historySourceTimestampHint}
          </Text>
        </Card.Body>
      </Card.Root>

      <Stack gap="3">
        {rows.length === 0 && !loading ? <Text color="fg.muted">{text.historyNoRows}</Text> : null}
        {rows.map((row, index) => (
          <Card.Root key={index} variant="outline">
            <Card.Body>
              {'recordId' in row ? (
                <SimpleGrid columns={{ base: 1, md: 4 }} gap="3">
                  <Text>
                    <b>{text.historyTime}:</b> <span dir="ltr">{row.sourceStartedAt}</span>
                  </Text>
                  <Text>
                    <b>{text.historyFrom}:</b> <span dir="ltr">{row.sourceNumber ?? '—'}</span>
                  </Text>
                  <Text>
                    <b>{text.historyTo}:</b> <span dir="ltr">{row.destinationNumber ?? '—'}</span>
                  </Text>
                  <Text>
                    <b>{text.historyDisposition}:</b> {row.disposition}
                  </Text>
                  <Text>
                    <b>{text.historyDuration}:</b> {row.durationSeconds}s
                  </Text>
                  <Text>
                    <b>{text.historyBillable}:</b> {row.billableSeconds}s
                  </Text>
                  <Text>
                    <b>{text.historyRecordId}:</b> <span dir="ltr">{row.recordId}</span>
                  </Text>
                </SimpleGrid>
              ) : 'queueId' in row ? (
                <SimpleGrid columns={{ base: 1, md: 4 }} gap="3">
                  <Text>
                    <b>{text.historyTime}:</b> <span dir="ltr">{row.sourceOccurredAt}</span>
                  </Text>
                  <Text>
                    <b>{text.historyEvent}:</b> {row.eventType}
                  </Text>
                  <Text>
                    <b>{text.historyQueue}:</b> <span dir="ltr">{row.queueId}</span>
                  </Text>
                  <Text>
                    <b>{text.historyAgent}:</b> <span dir="ltr">{row.agentId ?? '—'}</span>
                  </Text>
                  <Text>
                    <b>{text.historyCallId}:</b> <span dir="ltr">{row.callId}</span>
                  </Text>
                </SimpleGrid>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 4 }} gap="3">
                  <Text>
                    <b>{text.historyTime}:</b> <span dir="ltr">{row.sourceOccurredAt}</span>
                  </Text>
                  <Text>
                    <b>{text.historyEvent}:</b> {row.eventType}
                  </Text>
                  <Text>
                    <b>{text.historyCallId}:</b> <span dir="ltr">{row.callId}</span>
                  </Text>
                  <Text>
                    <b>{text.historyExtension}:</b> <span dir="ltr">{row.extension ?? '—'}</span>
                  </Text>
                  <Text>
                    <b>{text.historyCaller}:</b> <span dir="ltr">{row.callerNumber ?? '—'}</span>
                  </Text>
                </SimpleGrid>
              )}
            </Card.Body>
          </Card.Root>
        ))}
      </Stack>
    </Stack>
  );
}
