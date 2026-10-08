import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  HistoricalQueuePerformanceMetrics,
  HistoricalQueuePerformanceReport,
  HistoricalQueuePerformanceRow,
} from '@voip-monitor/shared';
import { api } from './api.js';
import type { messages } from './i18n.js';
import {
  exportQueuePerformanceExcel,
  exportQueuePerformancePdf,
} from './queuePerformanceExport.js';
import { DataSurface, WorkspaceState } from './WorkspacePrimitives.js';

type TextMap = (typeof messages)['en'] | (typeof messages)['fa'];

const COLORS = {
  incoming: '#4DA3FF',
  answered: '#3CCB9A',
  lost: '#FF637D',
  abandoned: '#FF5C8A',
  timeout: '#F6B94A',
  exitKey: '#9D7CFF',
  forced: '#FF8E4D',
  failure: '#E45050',
  unresolved: '#72849D',
  answerTime: '#4DA3FF',
  waitTime: '#B77CFF',
  attempts: '#F6B94A',
} as const;

function dateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function initialWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: dateTimeLocalValue(from), to: dateTimeLocalValue(to) };
}

function percent(value: number): string {
  return value.toFixed(1) + '%';
}

function seconds(value: number | undefined, text: TextMap): string {
  return value === undefined ? '—' : value.toFixed(1) + ' ' + text.historyQueuePerformanceSeconds;
}

function SummaryCard(props: { label: string; value: string | number; detail?: string }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="noc.border"
      borderRadius="nocControl"
      bg="rgba(9,27,47,.72)"
      px="3.5"
      py="3"
    >
      <Text fontSize="9px" color="noc.textSubtle" fontWeight="800">
        {props.label}
      </Text>
      <Text mt="1.5" fontSize="21px" lineHeight="1" color="noc.text" fontWeight="900" dir="ltr">
        {props.value}
      </Text>
      {props.detail ? (
        <Text mt="1.5" fontSize="10px" color="noc.textMuted" dir="ltr">
          {props.detail}
        </Text>
      ) : null}
    </Box>
  );
}

function LegendDot(props: { color: string; label: string }) {
  return (
    <HStack gap="1.5">
      <Box w="8px" h="8px" borderRadius="full" bg={props.color} />
      <Text fontSize="9px" color="noc.textSubtle">
        {props.label}
      </Text>
    </HStack>
  );
}

function ChartShell(props: { title: string; children: ReactNode }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="noc.border"
      borderRadius="nocControl"
      bg="rgba(6,19,34,.46)"
      p="4"
    >
      <Text fontSize="11px" color="noc.text" fontWeight="800" mb="4">
        {props.title}
      </Text>
      {props.children}
    </Box>
  );
}

type BarSeries = {
  label: string;
  key: keyof HistoricalQueuePerformanceRow;
  color: string;
  percent?: boolean;
};

function GroupedBars(props: {
  title: string;
  rows: readonly HistoricalQueuePerformanceRow[];
  series: readonly BarSeries[];
  max?: number;
}) {
  const maxValue =
    props.max ??
    Math.max(
      1,
      ...props.rows.flatMap((row) =>
        props.series.map((series) => {
          const value = row[series.key];
          return typeof value === 'number' ? value : 0;
        }),
      ),
    );
  return (
    <ChartShell title={props.title}>
      <HStack gap="3" flexWrap="wrap" mb="4">
        {props.series.map((series) => (
          <LegendDot key={series.label} color={series.color} label={series.label} />
        ))}
      </HStack>
      <Stack gap="4">
        {props.rows.map((row) => (
          <Box key={row.queueId}>
            <Text fontSize="10px" color="noc.textMuted" fontWeight="800" mb="1.5" dir="ltr">
              {row.queueId}
            </Text>
            <Stack gap="1.5">
              {props.series.map((series) => {
                const raw = row[series.key];
                const value = typeof raw === 'number' ? raw : 0;
                const width = series.percent
                  ? Math.min(100, Math.max(0, value))
                  : (value / maxValue) * 100;
                return (
                  <HStack key={series.label} gap="2">
                    <Text w="110px" fontSize="9px" color="noc.textSubtle" truncate>
                      {series.label}
                    </Text>
                    <Box
                      flex="1"
                      h="9px"
                      borderRadius="full"
                      bg="rgba(110,140,170,.13)"
                      overflow="hidden"
                    >
                      <Box
                        h="full"
                        w={Math.max(value > 0 ? 1 : 0, width) + '%'}
                        bg={series.color}
                        borderRadius="full"
                      />
                    </Box>
                    <Text w="68px" fontSize="9px" textAlign="end" color="noc.textMuted" dir="ltr">
                      {series.percent ? percent(value) : value.toFixed(value % 1 === 0 ? 0 : 1)}
                    </Text>
                  </HStack>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </ChartShell>
  );
}

function LostBreakdown(props: { rows: readonly HistoricalQueuePerformanceRow[]; text: TextMap }) {
  const segments = [
    [props.text.historyQueuePerformanceCallerAbandon, 'callerAbandonedCalls', COLORS.abandoned],
    [props.text.historyQueuePerformanceTimeout, 'timedOutCalls', COLORS.timeout],
    [props.text.historyQueuePerformanceExitKey, 'exitWithKeyCalls', COLORS.exitKey],
    [props.text.historyQueuePerformanceForcedExit, 'forcedExitCalls', COLORS.forced],
    [props.text.historyQueuePerformanceSystemFailure, 'systemFailureCalls', COLORS.failure],
    [props.text.historyQueuePerformanceUnresolved, 'unresolvedUnansweredCalls', COLORS.unresolved],
  ] as const;
  return (
    <ChartShell title={props.text.historyQueuePerformanceLostChart}>
      <HStack gap="3" flexWrap="wrap" mb="4">
        {segments.map(([label, , color]) => (
          <LegendDot key={label} color={color} label={label} />
        ))}
      </HStack>
      <Stack gap="4">
        {props.rows.map((row) => (
          <Box key={row.queueId}>
            <HStack justify="space-between" mb="1.5">
              <Text fontSize="10px" color="noc.textMuted" fontWeight="800" dir="ltr">
                {row.queueId}
              </Text>
              <Text fontSize="9px" color="noc.textSubtle" dir="ltr">
                {row.unansweredCalls.toLocaleString()}
              </Text>
            </HStack>
            <HStack
              gap="0"
              h="16px"
              bg="rgba(110,140,170,.1)"
              borderRadius="full"
              overflow="hidden"
            >
              {segments.map(([, key, color]) => {
                const value = row[key];
                return value > 0 ? (
                  <Box
                    key={key}
                    h="full"
                    w={(value / Math.max(1, row.unansweredCalls)) * 100 + '%'}
                    bg={color}
                  />
                ) : null;
              })}
            </HStack>
          </Box>
        ))}
      </Stack>
    </ChartShell>
  );
}

function metricCells(row: HistoricalQueuePerformanceMetrics, text: TextMap): string[] {
  return [
    row.enteredCalls.toLocaleString() + ' (' + percent(row.incomingSharePercent) + ')',
    row.answeredCalls.toLocaleString() + ' (' + percent(row.answerRatePercent) + ')',
    row.unansweredCalls.toLocaleString() + ' (' + percent(row.unansweredRatePercent) + ')',
    row.confirmedLostCalls.toLocaleString() + ' (' + percent(row.confirmedLostRatePercent) + ')',
    row.callerAbandonedCalls.toLocaleString() + ' (' + percent(row.callerAbandonRatePercent) + ')',
    row.timedOutCalls.toLocaleString() + ' (' + percent(row.timedOutRatePercent) + ')',
    row.exitWithKeyCalls.toLocaleString() + ' (' + percent(row.exitWithKeyRatePercent) + ')',
    row.forcedExitCalls.toLocaleString() + ' (' + percent(row.forcedExitRatePercent) + ')',
    row.systemFailureCalls.toLocaleString() + ' (' + percent(row.systemFailureRatePercent) + ')',
    row.unresolvedUnansweredCalls.toLocaleString() +
      ' (' +
      percent(row.unresolvedUnansweredRatePercent) +
      ')',
    row.ringNoAnswerAttempts.toLocaleString() +
      ' (' +
      row.ringNoAnswerAttemptsPer100Entered.toFixed(1) +
      ' ' +
      text.historyQueuePerformancePer100 +
      ')',
    row.ringCanceledAttempts.toLocaleString(),
    seconds(row.averageAnswerSeconds, text),
    seconds(row.averageWaitSeconds, text),
  ];
}

export function QueuePerformanceReportBuilder(props: {
  text: TextMap;
  pbxId: string;
  pbxName: string;
  queueOptions: readonly string[];
  supported: boolean;
  unavailableLabel?: string;
  onError: (cause: unknown) => Promise<void>;
}) {
  const initial = useMemo(() => initialWindow(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [report, setReport] = useState<HistoricalQueuePerformanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setSelectedQueues((current) => {
      const valid = current.filter((queue) => props.queueOptions.includes(queue));
      return valid.length > 0 ? valid : props.queueOptions[0] ? [props.queueOptions[0]] : [];
    });
    setReport(null);
  }, [props.queueOptions]);

  function toggleQueue(queueId: string, checked: boolean) {
    setReport(null);
    setLocalError('');
    setSelectedQueues((current) => {
      if (checked) {
        return current.includes(queueId) || current.length >= 16 ? current : [...current, queueId];
      }
      return current.filter((value) => value !== queueId);
    });
  }

  async function generate() {
    const rangeMs = Date.parse(to) - Date.parse(from);
    if (
      !from ||
      !to ||
      from >= to ||
      !Number.isFinite(rangeMs) ||
      rangeMs > 90 * 24 * 60 * 60 * 1000 ||
      selectedQueues.length === 0 ||
      selectedQueues.length > 16
    ) {
      setLocalError(props.text.historyQueuePerformanceInvalidInput);
      return;
    }
    setLoading(true);
    setLocalError('');
    setReport(null);
    try {
      setReport(await api.historyQueuePerformance(props.pbxId, selectedQueues, { from, to }));
    } catch (cause) {
      await props.onError(cause);
    } finally {
      setLoading(false);
    }
  }

  async function doExport(format: 'pdf' | 'excel') {
    if (!report) return;
    setExporting(format);
    setLocalError('');
    try {
      const payload = { report, pbxName: props.pbxName, text: props.text };
      if (format === 'pdf') await exportQueuePerformancePdf(payload);
      else await exportQueuePerformanceExcel(payload);
    } catch {
      setLocalError(props.text.historyQueuePerformanceExportFailed);
    } finally {
      setExporting(null);
    }
  }

  const allSelectable = props.queueOptions.slice(0, 16);
  const qualityWarning =
    report !== null &&
    (report.total.unresolvedUnansweredCalls > 0 || report.total.outcomeExcessCalls > 0);
  const tableHeaders = [
    props.text.historyQueueAbandonmentQueue,
    props.text.historyQueuePerformanceIncoming,
    props.text.historyQueuePerformanceAnswered,
    props.text.historyQueuePerformanceUnanswered,
    props.text.historyQueuePerformanceConfirmedLost,
    props.text.historyQueuePerformanceCallerAbandon,
    props.text.historyQueuePerformanceTimeout,
    props.text.historyQueuePerformanceExitKey,
    props.text.historyQueuePerformanceForcedExit,
    props.text.historyQueuePerformanceSystemFailure,
    props.text.historyQueuePerformanceUnresolved,
    props.text.historyQueuePerformanceRingNoAnswer,
    props.text.historyQueuePerformanceRingCanceled,
    props.text.historyQueuePerformanceAvgAnswer,
    props.text.historyQueuePerformanceAvgWait,
  ];

  return (
    <DataSurface
      title={props.text.historyQueuePerformanceTitle}
      meta={props.text.historyQueuePerformanceSourceHint}
      footer={
        <Text fontSize="10px" color="noc.textSubtle">
          {props.text.historyQueuePerformanceLongRangeHint}
        </Text>
      }
    >
      <Stack gap="5" p="4">
        {!props.supported ? (
          <Text color="noc.textSubtle" fontSize="12px">
            {props.text.historyQueuePerformanceUnavailable} {props.unavailableLabel ?? ''}
          </Text>
        ) : null}

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
          <Box>
            <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
              {props.text.historyReportFrom}
            </Text>
            <Input
              type="datetime-local"
              step={60}
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setReport(null);
              }}
              dir="ltr"
            />
          </Box>
          <Box>
            <Text fontSize="10px" color="noc.textSubtle" fontWeight="700" mb="1.5">
              {props.text.historyReportTo}
            </Text>
            <Input
              type="datetime-local"
              step={60}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setReport(null);
              }}
              dir="ltr"
            />
          </Box>
        </SimpleGrid>

        <Box>
          <HStack justify="space-between" align="center" gap="3" flexWrap="wrap" mb="2">
            <Box>
              <Text fontSize="11px" color="noc.text" fontWeight="800">
                {props.text.historyQueuePerformanceQueues}
              </Text>
              <Text mt="1" fontSize="9px" color="noc.textSubtle">
                {props.text.historyQueuePerformanceQueueHint}
              </Text>
            </Box>
            <HStack gap="2">
              <Button
                size="xs"
                variant="outline"
                disabled={allSelectable.length === 0}
                onClick={() => {
                  setSelectedQueues([...allSelectable]);
                  setReport(null);
                }}
              >
                {props.text.historyQueuePerformanceSelectAll}
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={selectedQueues.length === 0}
                onClick={() => {
                  setSelectedQueues([]);
                  setReport(null);
                }}
              >
                {props.text.historyQueuePerformanceClear}
              </Button>
            </HStack>
          </HStack>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 4 }} gap="2">
            {props.queueOptions.map((queueId) => {
              const checked = selectedQueues.includes(queueId);
              return (
                <Checkbox.Root
                  key={queueId}
                  checked={checked}
                  disabled={!checked && selectedQueues.length >= 16}
                  onCheckedChange={(details) => toggleQueue(queueId, details.checked === true)}
                  borderWidth="1px"
                  borderColor={checked ? 'noc.borderStrong' : 'noc.border'}
                  bg={checked ? 'rgba(45,140,255,.09)' : 'noc.surface2'}
                  borderRadius="nocControl"
                  p="2.5"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label flex="1">
                    <Text fontSize="11px" color="noc.text" fontWeight="700" dir="ltr">
                      {queueId}
                    </Text>
                  </Checkbox.Label>
                </Checkbox.Root>
              );
            })}
          </SimpleGrid>
        </Box>

        <HStack gap="2" flexWrap="wrap">
          <Button
            size="sm"
            colorPalette="blue"
            disabled={!props.supported || loading || selectedQueues.length === 0}
            onClick={() => void generate()}
          >
            {props.text.historyQueuePerformanceGenerate}
          </Button>
          <Badge colorPalette="blue" variant="subtle">
            {selectedQueues.length} / 16
          </Badge>
        </HStack>

        {localError ? <WorkspaceState tone="critical" title={localError} role="alert" /> : null}
        {loading ? (
          <WorkspaceState tone="info" title={props.text.loading} loading role="status" />
        ) : null}

        {report ? (
          <Stack gap="5">
            <Box>
              <HStack justify="space-between" align="start" gap="3" flexWrap="wrap" mb="3">
                <Box>
                  <Text fontSize="14px" color="noc.text" fontWeight="900">
                    {props.text.historyQueuePerformanceTotal}
                  </Text>
                  <Text mt="1" fontSize="9px" color="noc.textSubtle" dir="ltr">
                    {report.from.replace('T', ' ')} → {report.to.replace('T', ' ')}
                  </Text>
                </Box>
                <Badge colorPalette="green" variant="subtle">
                  {report.chunkCount} {props.text.historyQueuePerformanceChunkUnit}
                </Badge>
              </HStack>
              <SimpleGrid columns={{ base: 2, md: 4, xl: 7 }} gap="3">
                <SummaryCard
                  label={props.text.historyQueuePerformanceIncoming}
                  value={report.total.enteredCalls.toLocaleString()}
                  detail="100%"
                />
                <SummaryCard
                  label={props.text.historyQueuePerformanceAnswered}
                  value={report.total.answeredCalls.toLocaleString()}
                  detail={percent(report.total.answerRatePercent)}
                />
                <SummaryCard
                  label={props.text.historyQueuePerformanceUnanswered}
                  value={report.total.unansweredCalls.toLocaleString()}
                  detail={percent(report.total.unansweredRatePercent)}
                />
                <SummaryCard
                  label={props.text.historyQueuePerformanceConfirmedLost}
                  value={report.total.confirmedLostCalls.toLocaleString()}
                  detail={percent(report.total.confirmedLostRatePercent)}
                />
                <SummaryCard
                  label={props.text.historyQueuePerformanceAvgAnswer}
                  value={seconds(report.total.averageAnswerSeconds, props.text)}
                />
                <SummaryCard
                  label={props.text.historyQueuePerformanceAvgWait}
                  value={seconds(report.total.averageWaitSeconds, props.text)}
                />
                <SummaryCard
                  label={props.text.historyQueuePerformanceRingNoAnswer}
                  value={report.total.ringNoAnswerAttempts.toLocaleString()}
                  detail={
                    report.total.ringNoAnswerAttemptsPer100Entered.toFixed(1) +
                    ' ' +
                    props.text.historyQueuePerformancePer100
                  }
                />
              </SimpleGrid>
            </Box>

            <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
              <GroupedBars
                title={props.text.historyQueuePerformanceVolumeChart}
                rows={report.queues}
                series={[
                  {
                    label: props.text.historyQueuePerformanceChartIncoming,
                    key: 'enteredCalls',
                    color: COLORS.incoming,
                  },
                  {
                    label: props.text.historyQueuePerformanceChartAnswered,
                    key: 'answeredCalls',
                    color: COLORS.answered,
                  },
                  {
                    label: props.text.historyQueuePerformanceChartLost,
                    key: 'confirmedLostCalls',
                    color: COLORS.lost,
                  },
                ]}
              />
              <LostBreakdown rows={report.queues} text={props.text} />
              <GroupedBars
                title={props.text.historyQueuePerformanceRateChart}
                rows={report.queues}
                max={100}
                series={[
                  {
                    label: props.text.historyQueuePerformanceAnswerRate,
                    key: 'answerRatePercent',
                    color: COLORS.answered,
                    percent: true,
                  },
                  {
                    label: props.text.historyQueuePerformanceLostRate,
                    key: 'confirmedLostRatePercent',
                    color: COLORS.lost,
                    percent: true,
                  },
                ]}
              />
              <GroupedBars
                title={props.text.historyQueuePerformanceTimeChart}
                rows={report.queues}
                series={[
                  {
                    label: props.text.historyQueuePerformanceAvgAnswer,
                    key: 'averageAnswerSeconds',
                    color: COLORS.answerTime,
                  },
                  {
                    label: props.text.historyQueuePerformanceAvgWait,
                    key: 'averageWaitSeconds',
                    color: COLORS.waitTime,
                  },
                ]}
              />
            </SimpleGrid>
            <GroupedBars
              title={props.text.historyQueuePerformanceAttemptsChart}
              rows={report.queues}
              series={[
                {
                  label: props.text.historyQueuePerformanceRingNoAnswer,
                  key: 'ringNoAnswerAttempts',
                  color: COLORS.attempts,
                },
              ]}
            />

            <DataSurface title={props.text.historyQueuePerformanceTableTitle}>
              <Box overflowX="auto">
                <Table.Root size="sm" interactive minW="1900px">
                  <Table.Header bg="noc.surface2">
                    <Table.Row>
                      {tableHeaders.map((header, index) => (
                        <Table.ColumnHeader
                          key={header + ':' + index}
                          borderColor="noc.border"
                          fontSize="9px"
                          color="noc.textSubtle"
                          whiteSpace="nowrap"
                          textAlign={index === 0 ? 'start' : 'end'}
                        >
                          {header}
                        </Table.ColumnHeader>
                      ))}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {report.queues.map((row) => (
                      <Table.Row key={row.queueId} _hover={{ bg: 'rgba(255,255,255,.025)' }}>
                        <Table.Cell borderColor="noc.border" fontWeight="800" dir="ltr">
                          {row.queueId}
                        </Table.Cell>
                        {metricCells(row, props.text).map((value, index) => (
                          <Table.Cell
                            key={index}
                            borderColor="noc.border"
                            textAlign="end"
                            whiteSpace="nowrap"
                            dir="ltr"
                          >
                            {value}
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))}
                    <Table.Row bg="rgba(45,140,255,.06)">
                      <Table.Cell borderColor="noc.border" fontWeight="900">
                        {props.text.historyQueuePerformanceTotal}
                      </Table.Cell>
                      {metricCells(report.total, props.text).map((value, index) => (
                        <Table.Cell
                          key={index}
                          borderColor="noc.border"
                          textAlign="end"
                          whiteSpace="nowrap"
                          dir="ltr"
                          fontWeight="800"
                        >
                          {value}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  </Table.Body>
                </Table.Root>
              </Box>
            </DataSurface>

            {qualityWarning ? (
              <Box
                borderWidth="1px"
                borderColor="noc.warning"
                borderRadius="nocControl"
                bg="rgba(246,185,74,.06)"
                p="3.5"
              >
                <Text fontSize="11px" color="noc.text" fontWeight="800">
                  {props.text.historyQueuePerformanceQualityTitle}
                </Text>
                <Text mt="1.5" fontSize="10px" color="noc.textMuted">
                  {props.text.historyQueuePerformanceQualityHint}
                </Text>
                <HStack mt="2" gap="3" flexWrap="wrap" dir="ltr">
                  <Text fontSize="10px" color="noc.textMuted">
                    {props.text.historyQueuePerformanceQualityUnresolved}=
                    {report.total.unresolvedUnansweredCalls}
                  </Text>
                  <Text fontSize="10px" color="noc.textMuted">
                    {props.text.historyQueuePerformanceQualityCrossWindow}=
                    {report.total.outcomeExcessCalls}
                  </Text>
                </HStack>
              </Box>
            ) : null}

            <HStack gap="2" flexWrap="wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void doExport('pdf')}
              >
                {exporting === 'pdf'
                  ? props.text.historyQueuePerformanceExportingPdf
                  : props.text.historyQueuePerformanceExportPdf}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void doExport('excel')}
              >
                {exporting === 'excel'
                  ? props.text.historyQueuePerformanceExportingExcel
                  : props.text.historyQueuePerformanceExportExcel}
              </Button>
            </HStack>
          </Stack>
        ) : null}
      </Stack>
    </DataSurface>
  );
}
