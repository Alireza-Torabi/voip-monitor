import { Badge, Box, Button, HStack, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import type {
  HistoricalCallOutcomeAnalytics,
  HistoricalQueueAbandonmentAnalytics,
} from '@voip-monitor/shared';
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

function dateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialReportWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from: dateTimeLocalValue(from), to: dateTimeLocalValue(to) };
}

function validWindow(from: string, to: string): boolean {
  return Boolean(from && to && from < to);
}

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
  const initialWindow = useMemo(() => initialReportWindow(), []);
  const [outcomeFrom, setOutcomeFrom] = useState(initialWindow.from);
  const [outcomeTo, setOutcomeTo] = useState(initialWindow.to);
  const [outcomes, setOutcomes] = useState<HistoricalCallOutcomeAnalytics | null>(null);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [queueFrom, setQueueFrom] = useState(initialWindow.from);
  const [queueTo, setQueueTo] = useState(initialWindow.to);
  const [queueOptions, setQueueOptions] = useState<string[]>([]);
  const [queueId, setQueueId] = useState('');
  const [longWaitMinutes, setLongWaitMinutes] = useState('');
  const [queueAnalytics, setQueueAnalytics] = useState<HistoricalQueueAbandonmentAnalytics | null>(
    null,
  );
  const [queueAnalyticsLoading, setQueueAnalyticsLoading] = useState(false);
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
    if (cause instanceof ApiError) {
      if (cause.code === 'database_backoff_active') setError(text.historyDatabaseBackoff);
      else if (cause.code === 'history_database_timeout') setError(text.historyDatabaseTimeout);
      else if (cause.code === 'history_query_failed') setError(text.historyQueryFailed);
      else if (cause.code === 'history_row_limit') setError(text.historyRowLimit);
      else if (cause.code === 'history_output_limit') setError(text.historyOutputLimit);
      else if (cause.code === 'history_unsupported_value') setError(text.historyUnsupportedValue);
      else if (cause.code === 'database_authentication_failed')
        setError(text.databaseSourceAuthenticationFailed);
      else if (cause.code === 'database_not_found') setError(text.databaseSourceDatabaseNotFound);
      else if (cause.code === 'database_host_blocked') setError(text.databaseSourceHostBlocked);
      else if (cause.code === 'database_tls_failed') setError(text.databaseSourceTlsFailed);
      else setError(text.historyLoadFailed);
      return;
    }
    setError(text.historyLoadFailed);
  }

  async function loadCapabilities(id: string) {
    setLoading(true);
    setError('');
    setRows([]);
    setOutcomes(null);
    setQueueAnalytics(null);
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

  async function loadQueueOptions(id: string) {
    try {
      const state = await api.telephonyState(id);
      const queues = [
        ...new Set((state.current?.queues ?? []).map((queue) => queue.queueId)),
      ].sort();
      setQueueOptions(queues);
      setQueueId((current) => (current && queues.includes(current) ? current : (queues[0] ?? '')));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      else setQueueOptions([]);
    }
  }

  async function loadCallOutcomes(id: string) {
    if (!validWindow(outcomeFrom, outcomeTo)) {
      setError(text.historyReportWindowInvalid);
      return;
    }
    setOutcomesLoading(true);
    setError('');
    try {
      setOutcomes(await api.historyCallOutcomes(id, { from: outcomeFrom, to: outcomeTo }));
    } catch (cause) {
      setOutcomes(null);
      await handleError(cause);
    } finally {
      setOutcomesLoading(false);
    }
  }

  async function loadQueueAbandonment(id: string) {
    const threshold = Number(longWaitMinutes);
    if (
      !queueId ||
      !validWindow(queueFrom, queueTo) ||
      !Number.isSafeInteger(threshold) ||
      threshold < 1 ||
      threshold > 60
    ) {
      setError(text.historyQueueAbandonmentInvalidInput);
      return;
    }
    setQueueAnalyticsLoading(true);
    setError('');
    try {
      setQueueAnalytics(
        await api.historyQueueAbandonment(id, queueId, { from: queueFrom, to: queueTo }, threshold),
      );
    } catch (cause) {
      setQueueAnalytics(null);
      await handleError(cause);
    } finally {
      setQueueAnalyticsLoading(false);
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
    if (selectedId) {
      void loadCapabilities(selectedId);
      void loadQueueOptions(selectedId);
    }
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

      {capabilities?.calls.availability === 'SUPPORTED' ? (
        <DataSurface
          title={text.historyOutcomeTitle}
          meta={text.historyOutcomeSourceHint}
          footer={
            <Text fontSize="10px" color="noc.textSubtle">
              {text.historyOutcomeUnknownHint}
            </Text>
          }
        >
          <Stack gap="4" p="4">
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="3" alignItems="end">
              <Box>
                <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
                  {text.historyReportFrom}
                </Text>
                <Input
                  name="history-outcome-from"
                  type="datetime-local"
                  step={60}
                  value={outcomeFrom}
                  onChange={(event) => {
                    setOutcomeFrom(event.target.value);
                    setOutcomes(null);
                  }}
                  dir="ltr"
                />
              </Box>
              <Box>
                <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
                  {text.historyReportTo}
                </Text>
                <Input
                  name="history-outcome-to"
                  type="datetime-local"
                  step={60}
                  value={outcomeTo}
                  onChange={(event) => {
                    setOutcomeTo(event.target.value);
                    setOutcomes(null);
                  }}
                  dir="ltr"
                />
              </Box>
              <Button
                size="sm"
                colorPalette="blue"
                disabled={outcomesLoading}
                onClick={() => void loadCallOutcomes(selected.id)}
              >
                {text.historyOutcomeLoad}
              </Button>
            </SimpleGrid>
            {outcomesLoading ? (
              <WorkspaceState tone="info" title={text.loading} loading role="status" />
            ) : outcomes ? (
              <SimpleGrid columns={{ base: 2, md: 4, xl: 8 }} gap="3">
                <HistoryDatum label={text.historyOutcomeTotal} value={outcomes.totalCalls} ltr />
                <HistoryDatum
                  label={text.historyOutcomeAnswered}
                  value={outcomes.answeredCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyOutcomeNoAnswer}
                  value={outcomes.noAnswerCalls}
                  ltr
                />
                <HistoryDatum label={text.historyOutcomeBusy} value={outcomes.busyCalls} ltr />
                <HistoryDatum label={text.historyOutcomeFailed} value={outcomes.failedCalls} ltr />
                <HistoryDatum
                  label={text.historyOutcomeUnknown}
                  value={outcomes.unknownCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyOutcomeAnswerRatio}
                  value={`${outcomes.answerRatioPercent.toFixed(1)}%`}
                  ltr
                />
                <HistoryDatum
                  label={text.historyOutcomeAverageDuration}
                  value={`${outcomes.averageDurationSeconds.toFixed(1)}s`}
                  ltr
                />
              </SimpleGrid>
            ) : (
              <Text color="noc.textSubtle" fontSize="12px">
                {text.historyOutcomeEmpty}
              </Text>
            )}
          </Stack>
        </DataSurface>
      ) : null}

      {capabilities ? (
        <DataSurface
          title={text.historyQueueAbandonmentTitle}
          meta={text.historyQueueAbandonmentSourceHint}
          footer={
            <Text fontSize="10px" color="noc.textSubtle">
              {text.historyQueueAbandonmentSemanticsHint}
            </Text>
          }
        >
          <Stack gap="4" p="4">
            {capabilities.queueAbandonment.availability !== 'SUPPORTED' ? (
              <Text color="noc.textSubtle" fontSize="12px">
                {text.historyQueueAbandonmentUnavailable}{' '}
                {capabilities.queueAbandonment.availability}
              </Text>
            ) : null}
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="3">
              <Box>
                <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
                  {text.historyQueueAbandonmentQueue}
                </Text>
                <WorkspaceSelect
                  value={queueId}
                  onChange={(value) => {
                    setQueueId(value);
                    setQueueAnalytics(null);
                  }}
                  ariaLabel={text.historyQueueAbandonmentQueue}
                >
                  <option value="">{text.historyQueueAbandonmentQueuePlaceholder}</option>
                  {queueOptions.map((queue) => (
                    <option key={queue} value={queue}>
                      {queue}
                    </option>
                  ))}
                </WorkspaceSelect>
              </Box>
              <Box>
                <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
                  {text.historyReportFrom}
                </Text>
                <Input
                  name="history-queue-from"
                  type="datetime-local"
                  step={60}
                  value={queueFrom}
                  onChange={(event) => {
                    setQueueFrom(event.target.value);
                    setQueueAnalytics(null);
                  }}
                  dir="ltr"
                />
              </Box>
              <Box>
                <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
                  {text.historyReportTo}
                </Text>
                <Input
                  name="history-queue-to"
                  type="datetime-local"
                  step={60}
                  value={queueTo}
                  onChange={(event) => {
                    setQueueTo(event.target.value);
                    setQueueAnalytics(null);
                  }}
                  dir="ltr"
                />
              </Box>
              <Box>
                <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
                  {text.historyQueueAbandonmentThreshold}
                </Text>
                <Input
                  name="history-long-wait-minutes"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={longWaitMinutes}
                  onChange={(event) => {
                    setLongWaitMinutes(event.target.value);
                    setQueueAnalytics(null);
                  }}
                  placeholder={text.historyQueueAbandonmentThresholdPlaceholder}
                  dir="ltr"
                />
              </Box>
            </SimpleGrid>
            <HStack gap="2">
              <Button
                size="sm"
                colorPalette="blue"
                disabled={
                  queueAnalyticsLoading ||
                  capabilities.queueAbandonment.availability !== 'SUPPORTED' ||
                  queueOptions.length === 0
                }
                onClick={() => void loadQueueAbandonment(selected.id)}
              >
                {text.historyQueueAbandonmentLoad}
              </Button>
            </HStack>
            {queueAnalyticsLoading ? (
              <WorkspaceState tone="info" title={text.loading} loading role="status" />
            ) : queueAnalytics ? (
              <SimpleGrid columns={{ base: 2, md: 4, xl: 8 }} gap="3">
                <HistoryDatum
                  label={text.historyQueueEntered}
                  value={queueAnalytics.enteredCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueueConnected}
                  value={queueAnalytics.connectedCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueueAbandoned}
                  value={queueAnalytics.abandonedCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueueTimedOut}
                  value={queueAnalytics.timedOutCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueueAbandonmentRate}
                  value={
                    queueAnalytics.abandonmentRatePercent === undefined
                      ? '—'
                      : `${queueAnalytics.abandonmentRatePercent.toFixed(1)}%`
                  }
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueueAverageWait}
                  value={
                    queueAnalytics.averageWaitBeforeAbandonSeconds === undefined
                      ? '—'
                      : `${queueAnalytics.averageWaitBeforeAbandonSeconds.toFixed(1)}s`
                  }
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueueLongWait}
                  value={queueAnalytics.longWaitAbandonedCalls}
                  ltr
                />
                <HistoryDatum
                  label={text.historyQueuePercentiles}
                  value={
                    queueAnalytics.p50WaitBeforeAbandonSeconds === undefined ||
                    queueAnalytics.p90WaitBeforeAbandonSeconds === undefined
                      ? '—'
                      : `P50 ${queueAnalytics.p50WaitBeforeAbandonSeconds.toFixed(1)}s / P90 ${queueAnalytics.p90WaitBeforeAbandonSeconds.toFixed(1)}s`
                  }
                  ltr
                />
              </SimpleGrid>
            ) : (
              <Text color="noc.textSubtle" fontSize="12px">
                {text.historyQueueAbandonmentEmpty}
              </Text>
            )}
          </Stack>
        </DataSurface>
      ) : null}

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
