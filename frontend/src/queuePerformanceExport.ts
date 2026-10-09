import type {
  HistoricalQueueCallDetail,
  HistoricalQueueCallOutcome,
  HistoricalQueuePerformanceMetrics,
  HistoricalQueuePerformanceReport,
} from '@voip-monitor/shared';
import type { SheetData, SheetOptions } from 'write-excel-file/browser';
import type { messages } from './i18n.js';

type TextMap = (typeof messages)['en'] | (typeof messages)['fa'];

export interface QueuePerformanceExportPayload {
  report: HistoricalQueuePerformanceReport;
  pbxName: string;
  text: TextMap;
}

export interface QueueCallDetailsExportPayload extends QueuePerformanceExportPayload {
  details: readonly HistoricalQueueCallDetail[];
}

const EXPORT_TIMEOUT_MS = 15_000;
const PALETTE = {
  background: '#07111F',
  surface: '#0D1D30',
  border: '#29415F',
  text: '#E7EEF8',
  muted: '#8DA2BD',
  incoming: '#4DA3FF',
  answered: '#3CCB9A',
  lost: '#FF637D',
  abandoned: '#FF5C8A',
  timeout: '#F6B94A',
  exitKey: '#9D7CFF',
  forced: '#FF8E4D',
  failure: '#E45050',
  unresolved: '#72849D',
} as const;

function safeFileBaseName(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 120) || 'voip-monitor-queue-performance'
  );
}

function fileBaseName(report: HistoricalQueuePerformanceReport): string {
  const compact = (value: string) => value.replace(/[^0-9]/gu, '').slice(0, 12);
  return safeFileBaseName(
    'voip-monitor-queue-performance-' + compact(report.from) + '-' + compact(report.to),
  );
}

function isRtl(text: TextMap): boolean {
  return /[\u0600-\u06ff]/u.test(text.historyQueuePerformanceTitle);
}

function withTimeout<T>(promise: Promise<T>, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(code)), EXPORT_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('report_canvas_unavailable');
  return { canvas, context };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function textSetup(
  context: CanvasRenderingContext2D,
  rtl: boolean,
  color: string,
  font: string,
  align?: CanvasTextAlign,
) {
  context.direction = rtl ? 'rtl' : 'ltr';
  context.textAlign = align ?? (rtl ? 'right' : 'left');
  context.fillStyle = color;
  context.font = font;
}

function percentage(value: number): string {
  return value.toFixed(1) + '%';
}

function drawSummaryCard(
  context: CanvasRenderingContext2D,
  rtl: boolean,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  detail?: string,
) {
  roundedRect(context, x, y, width, 98, 14, '#11263D', '#203B58');
  const textX = rtl ? x + width - 16 : x + 16;
  textSetup(context, rtl, PALETTE.muted, '600 14px "Segoe UI", Tahoma, sans-serif');
  context.fillText(label, textX, y + 29);
  textSetup(
    context,
    false,
    PALETTE.text,
    '800 27px "Segoe UI", Tahoma, sans-serif',
    rtl ? 'right' : 'left',
  );
  context.fillText(value, textX, y + 62);
  if (detail) {
    textSetup(
      context,
      false,
      PALETTE.muted,
      '600 13px "Segoe UI", Tahoma, sans-serif',
      rtl ? 'right' : 'left',
    );
    context.fillText(detail, textX, y + 84);
  }
}

function drawGroupedChart(
  context: CanvasRenderingContext2D,
  payload: QueuePerformanceExportPayload,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { report, text } = payload;
  const rtl = isRtl(text);
  roundedRect(context, x, y, width, height, 18, '#0B1A2B', '#29415F');
  textSetup(context, rtl, PALETTE.text, '700 20px "Segoe UI", Tahoma, sans-serif');
  context.fillText(text.historyQueuePerformanceVolumeChart, rtl ? x + width - 24 : x + 24, y + 34);
  const chartTop = y + 68;
  const chartBottom = y + height - 36;
  const chartHeight = chartBottom - chartTop;
  const max = Math.max(1, ...report.queues.map((row) => row.enteredCalls));
  const groupWidth = (width - 60) / Math.max(1, report.queues.length);
  const barWidth = Math.min(18, Math.max(7, groupWidth / 5));
  report.queues.forEach((row, index) => {
    const center = x + 30 + groupWidth * index + groupWidth / 2;
    const values = [
      [row.enteredCalls, PALETTE.incoming],
      [row.answeredCalls, PALETTE.answered],
      [row.confirmedLostCalls, PALETTE.lost],
    ] as const;
    values.forEach(([value, color], seriesIndex) => {
      const barHeight = (value / max) * Math.max(1, chartHeight - 40);
      context.fillStyle = color;
      context.fillRect(
        center + (seriesIndex - 1) * (barWidth + 4) - barWidth / 2,
        chartBottom - 24 - barHeight,
        barWidth,
        barHeight,
      );
    });
    textSetup(context, false, PALETTE.muted, '600 11px "Segoe UI", Tahoma, sans-serif', 'center');
    context.fillText(row.queueId.slice(0, 12), center, chartBottom - 4);
  });
}

function drawLostChart(
  context: CanvasRenderingContext2D,
  payload: QueuePerformanceExportPayload,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { report, text } = payload;
  const rtl = isRtl(text);
  roundedRect(context, x, y, width, height, 18, '#0B1A2B', '#29415F');
  textSetup(context, rtl, PALETTE.text, '700 20px "Segoe UI", Tahoma, sans-serif');
  context.fillText(text.historyQueuePerformanceLostChart, rtl ? x + width - 24 : x + 24, y + 34);
  const segments = [
    ['callerAbandonedCalls', PALETTE.abandoned],
    ['timedOutCalls', PALETTE.timeout],
    ['exitWithKeyCalls', PALETTE.exitKey],
    ['forcedExitCalls', PALETTE.forced],
    ['systemFailureCalls', PALETTE.failure],
    ['unresolvedUnansweredCalls', PALETTE.unresolved],
  ] as const;
  const rowHeight = Math.min(48, (height - 72) / Math.max(1, report.queues.length));
  report.queues.forEach((row, index) => {
    const rowY = y + 64 + index * rowHeight;
    textSetup(context, false, PALETTE.muted, '700 12px "Segoe UI", Tahoma, sans-serif', 'left');
    context.fillText(row.queueId.slice(0, 16), x + 22, rowY + 11);
    const barX = x + 126;
    const barWidth = width - 154;
    let cursor = barX;
    const denominator = Math.max(1, row.unansweredCalls);
    segments.forEach(([key, color]) => {
      const value = row[key];
      if (value <= 0) return;
      const segmentWidth = (value / denominator) * barWidth;
      context.fillStyle = color;
      context.fillRect(cursor, rowY, segmentWidth, 14);
      cursor += segmentWidth;
    });
  });
}

function drawRateChart(
  context: CanvasRenderingContext2D,
  payload: QueuePerformanceExportPayload,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { report, text } = payload;
  const rtl = isRtl(text);
  roundedRect(context, x, y, width, height, 18, '#0B1A2B', '#29415F');
  textSetup(context, rtl, PALETTE.text, '700 20px "Segoe UI", Tahoma, sans-serif');
  context.fillText(text.historyQueuePerformanceRateChart, rtl ? x + width - 24 : x + 24, y + 34);
  const rowHeight = Math.min(48, (height - 72) / Math.max(1, report.queues.length));
  report.queues.forEach((row, index) => {
    const rowY = y + 64 + index * rowHeight;
    textSetup(context, false, PALETTE.muted, '700 12px "Segoe UI", Tahoma, sans-serif', 'left');
    context.fillText(row.queueId.slice(0, 16), x + 22, rowY + 12);
    const barX = x + 126;
    const barWidth = width - 154;
    context.fillStyle = 'rgba(110,140,170,.14)';
    context.fillRect(barX, rowY, barWidth, 14);
    context.fillStyle = PALETTE.answered;
    context.fillRect(barX, rowY, (row.answerRatePercent / 100) * barWidth, 6);
    context.fillStyle = PALETTE.lost;
    context.fillRect(
      barX,
      rowY + 8,
      (Math.min(100, row.confirmedLostRatePercent) / 100) * barWidth,
      6,
    );
  });
}

function drawTimeChart(
  context: CanvasRenderingContext2D,
  payload: QueuePerformanceExportPayload,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { report, text } = payload;
  const rtl = isRtl(text);
  roundedRect(context, x, y, width, height, 18, '#0B1A2B', '#29415F');
  textSetup(context, rtl, PALETTE.text, '700 20px "Segoe UI", Tahoma, sans-serif');
  context.fillText(text.historyQueuePerformanceTimeChart, rtl ? x + width - 24 : x + 24, y + 34);
  const max = Math.max(
    1,
    ...report.queues.flatMap((row) => [row.averageAnswerSeconds ?? 0, row.averageWaitSeconds ?? 0]),
  );
  const rowHeight = Math.min(48, (height - 72) / Math.max(1, report.queues.length));
  report.queues.forEach((row, index) => {
    const rowY = y + 64 + index * rowHeight;
    textSetup(context, false, PALETTE.muted, '700 12px "Segoe UI", Tahoma, sans-serif', 'left');
    context.fillText(row.queueId.slice(0, 16), x + 22, rowY + 12);
    const barX = x + 126;
    const barWidth = width - 154;
    context.fillStyle = PALETTE.incoming;
    context.fillRect(barX, rowY, ((row.averageAnswerSeconds ?? 0) / max) * barWidth, 6);
    context.fillStyle = PALETTE.exitKey;
    context.fillRect(barX, rowY + 8, ((row.averageWaitSeconds ?? 0) / max) * barWidth, 6);
  });
}

function renderChartsCanvas(payload: QueuePerformanceExportPayload): HTMLCanvasElement {
  const { canvas, context } = canvas2d(1500, 1000);
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGroupedChart(context, payload, 24, 24, 714, 452);
  drawLostChart(context, payload, 762, 24, 714, 452);
  drawRateChart(context, payload, 24, 500, 714, 452);
  drawTimeChart(context, payload, 762, 500, 714, 452);
  return canvas;
}

function renderPdfCanvas(payload: QueuePerformanceExportPayload): HTMLCanvasElement {
  const { report, pbxName, text } = payload;
  const rtl = isRtl(text);
  const { canvas, context } = canvas2d(2200, 2250);
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 40, 40, 2120, 2170, 28, PALETTE.surface, PALETTE.border);
  const titleX = rtl ? 2100 : 100;
  textSetup(context, rtl, PALETTE.text, '800 40px "Segoe UI", Tahoma, sans-serif');
  context.fillText(text.historyQueuePerformanceTitle, titleX, 105);
  textSetup(context, rtl, PALETTE.muted, '600 18px "Segoe UI", Tahoma, sans-serif');
  context.fillText(pbxName, titleX, 142);
  context.fillText(
    report.from.replace('T', ' ') + '  →  ' + report.to.replace('T', ' '),
    titleX,
    172,
  );

  const cards = [
    [text.historyQueuePerformanceIncoming, report.total.enteredCalls.toLocaleString(), '100%'],
    [
      text.historyQueuePerformanceAnswered,
      report.total.answeredCalls.toLocaleString(),
      percentage(report.total.answerRatePercent),
    ],
    [
      text.historyQueuePerformanceConfirmedLost,
      report.total.confirmedLostCalls.toLocaleString(),
      percentage(report.total.confirmedLostRatePercent),
    ],
    [
      text.historyQueuePerformanceUniqueCallers,
      report.total.uniqueCallers.toLocaleString(),
      percentage(report.total.callerIdentificationRatePercent),
    ],
    [
      text.historyQueuePerformanceRepeatCallers,
      report.total.repeatCallers.toLocaleString(),
      percentage(report.total.repeatCallerRatePercent),
    ],
    [
      text.historyQueuePerformanceAvgCallsPerCaller,
      report.total.averageCallsPerCaller.toFixed(2),
      '',
    ],
    [
      text.historyQueuePerformanceCallsFromRepeatCallers,
      report.total.callsFromRepeatCallers.toLocaleString(),
      percentage(report.total.repeatCallSharePercent),
    ],
    [
      text.historyQueuePerformanceUnanswered,
      report.total.unansweredCalls.toLocaleString(),
      percentage(report.total.unansweredRatePercent),
    ],
    [
      text.historyQueuePerformanceAvgAnswer,
      report.total.averageAnswerSeconds?.toFixed(1) ?? '—',
      text.historyQueuePerformanceSeconds,
    ],
    [
      text.historyQueuePerformanceAvgWait,
      report.total.averageWaitSeconds?.toFixed(1) ?? '—',
      text.historyQueuePerformanceSeconds,
    ],
  ] as const;
  const cardGap = 18;
  const cardWidth = (2000 - cardGap * 3) / 4;
  cards.forEach(([label, value, detail], index) => {
    drawSummaryCard(
      context,
      rtl,
      100 + (index % 4) * (cardWidth + cardGap),
      220 + Math.floor(index / 4) * 118,
      cardWidth,
      label,
      value,
      detail,
    );
  });

  const charts = renderChartsCanvas(payload);
  context.drawImage(charts, 100, 600, 2000, 1533);

  textSetup(context, rtl, PALETTE.muted, '600 13px "Segoe UI", Tahoma, sans-serif');
  context.fillText(text.historyQueuePerformanceLongRangeHint, titleX, 2180, 1960);
  return canvas;
}

function renderDetailPages(payload: QueuePerformanceExportPayload): HTMLCanvasElement[] {
  const { report, text } = payload;
  const rtl = isRtl(text);
  const groups: (typeof report.queues)[] = [];
  for (let index = 0; index < report.queues.length; index += 3) {
    groups.push(report.queues.slice(index, index + 3));
  }
  return groups.map((rows, pageIndex) => {
    const { canvas, context } = canvas2d(2200, 1400);
    context.fillStyle = PALETTE.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    roundedRect(context, 40, 40, 2120, 1320, 28, PALETTE.surface, PALETTE.border);
    const titleX = rtl ? 2100 : 100;
    textSetup(context, rtl, PALETTE.text, '800 34px "Segoe UI", Tahoma, sans-serif');
    context.fillText(text.historyQueuePerformanceTableTitle, titleX, 100);
    textSetup(context, rtl, PALETTE.muted, '600 16px "Segoe UI", Tahoma, sans-serif');
    context.fillText(String(pageIndex + 1) + ' / ' + String(groups.length), titleX, 132);

    const metrics = (row: HistoricalQueuePerformanceMetrics) =>
      [
        [
          text.historyQueuePerformanceIncoming,
          row.enteredCalls.toLocaleString() + ' / ' + percentage(row.incomingSharePercent),
        ],
        [text.historyQueuePerformanceUniqueCallers, row.uniqueCallers.toLocaleString()],
        [
          text.historyQueuePerformanceRepeatCallers,
          row.repeatCallers.toLocaleString() + ' / ' + percentage(row.repeatCallerRatePercent),
        ],
        [text.historyQueuePerformanceAvgCallsPerCaller, row.averageCallsPerCaller.toFixed(2)],
        [
          text.historyQueuePerformanceCallsFromRepeatCallers,
          row.callsFromRepeatCallers.toLocaleString() +
            ' / ' +
            percentage(row.repeatCallSharePercent),
        ],
        [
          text.historyQueuePerformanceAnswered,
          row.answeredCalls.toLocaleString() + ' / ' + percentage(row.answerRatePercent),
        ],
        [
          text.historyQueuePerformanceUnanswered,
          row.unansweredCalls.toLocaleString() + ' / ' + percentage(row.unansweredRatePercent),
        ],
        [
          text.historyQueuePerformanceConfirmedLost,
          row.confirmedLostCalls.toLocaleString() +
            ' / ' +
            percentage(row.confirmedLostRatePercent),
        ],
        [
          text.historyQueuePerformanceCallerAbandon,
          row.callerAbandonedCalls.toLocaleString() +
            ' / ' +
            percentage(row.callerAbandonRatePercent),
        ],
        [
          text.historyQueuePerformanceTimeout,
          row.timedOutCalls.toLocaleString() + ' / ' + percentage(row.timedOutRatePercent),
        ],
        [
          text.historyQueuePerformanceExitKey,
          row.exitWithKeyCalls.toLocaleString() + ' / ' + percentage(row.exitWithKeyRatePercent),
        ],
        [
          text.historyQueuePerformanceForcedExit,
          row.forcedExitCalls.toLocaleString() + ' / ' + percentage(row.forcedExitRatePercent),
        ],
        [
          text.historyQueuePerformanceSystemFailure,
          row.systemFailureCalls.toLocaleString() +
            ' / ' +
            percentage(row.systemFailureRatePercent),
        ],
        [
          text.historyQueuePerformanceUnresolved,
          row.unresolvedUnansweredCalls.toLocaleString() +
            ' / ' +
            percentage(row.unresolvedUnansweredRatePercent),
        ],
        [
          text.historyQueuePerformanceRingNoAnswer,
          row.ringNoAnswerAttempts.toLocaleString() +
            ' / ' +
            row.ringNoAnswerAttemptsPer100Entered.toFixed(1),
        ],
        [text.historyQueuePerformanceRingCanceled, row.ringCanceledAttempts.toLocaleString()],
        [
          text.historyQueuePerformanceAvgAnswer,
          row.averageAnswerSeconds === undefined ? '—' : row.averageAnswerSeconds.toFixed(1) + 's',
        ],
        [
          text.historyQueuePerformanceAvgWait,
          row.averageWaitSeconds === undefined ? '—' : row.averageWaitSeconds.toFixed(1) + 's',
        ],
      ] as const;

    rows.forEach((row, rowIndex) => {
      const y = 170 + rowIndex * 390;
      roundedRect(context, 100, y, 2000, 356, 18, '#0B1A2B', '#29415F');
      textSetup(context, false, PALETTE.text, '800 25px "Segoe UI", Tahoma, sans-serif', 'left');
      context.fillText(row.queueId, 128, y + 38);
      const cells = metrics(row);
      const columns = 6;
      const gap = 10;
      const cellWidth = (1944 - gap * (columns - 1)) / columns;
      cells.forEach(([label, value], metricIndex) => {
        const column = metricIndex % columns;
        const line = Math.floor(metricIndex / columns);
        const x = 128 + column * (cellWidth + gap);
        const cellY = y + 58 + line * 92;
        roundedRect(context, x, cellY, cellWidth, 80, 10, '#11263D', '#203B58');
        const tx = rtl ? x + cellWidth - 10 : x + 10;
        textSetup(context, rtl, PALETTE.muted, '600 11px "Segoe UI", Tahoma, sans-serif');
        context.fillText(label, tx, cellY + 25, cellWidth - 20);
        textSetup(
          context,
          false,
          PALETTE.text,
          '700 15px "Segoe UI", Tahoma, sans-serif',
          rtl ? 'right' : 'left',
        );
        context.fillText(value, tx, cellY + 55, cellWidth - 20);
      });
    });
    return canvas;
  });
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function buildImagePagesPdf(
  pages: readonly { jpeg: Uint8Array; width: number; height: number }[],
): Uint8Array {
  if (pages.length === 0) throw new Error('report_pdf_no_pages');
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;
  const objectCount = 2 + pages.length * 3;
  const chunks: Uint8Array[] = [
    new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 255, 255, 255, 255, 10]),
  ];
  const offsets = Array.from({ length: objectCount + 1 }, () => 0);
  let length = chunks[0]!.length;
  const append = (...items: Uint8Array[]) => {
    for (const item of items) {
      chunks.push(item);
      length += item.length;
    }
  };
  const object = (id: number, ...body: Uint8Array[]) => {
    offsets[id] = length;
    append(ascii(String(id) + ' 0 obj\n'), ...body, ascii('\nendobj\n'));
  };
  const pageObjectIds = pages.map((_, index) => 3 + index * 3);
  object(1, ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  object(
    2,
    ascii(
      '<< /Type /Pages /Kids [' +
        pageObjectIds.map((id) => String(id) + ' 0 R').join(' ') +
        '] /Count ' +
        String(pages.length) +
        ' >>',
    ),
  );
  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const scale = Math.min(
      (pageWidth - margin * 2) / page.width,
      (pageHeight - margin * 2) / page.height,
    );
    const width = page.width * scale;
    const height = page.height * scale;
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;
    const content = ascii(
      'q\n' +
        width.toFixed(2) +
        ' 0 0 ' +
        height.toFixed(2) +
        ' ' +
        x.toFixed(2) +
        ' ' +
        y.toFixed(2) +
        ' cm\n/Im0 Do\nQ\n',
    );
    object(
      pageId,
      ascii(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
          String(pageWidth) +
          ' ' +
          String(pageHeight) +
          '] /Resources << /XObject << /Im0 ' +
          String(imageId) +
          ' 0 R >> >> /Contents ' +
          String(contentId) +
          ' 0 R >>',
      ),
    );
    object(
      imageId,
      ascii(
        '<< /Type /XObject /Subtype /Image /Width ' +
          String(page.width) +
          ' /Height ' +
          String(page.height) +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
          String(page.jpeg.length) +
          ' >>\nstream\n',
      ),
      page.jpeg,
      ascii('\nendstream'),
    );
    object(
      contentId,
      ascii('<< /Length ' + String(content.length) + ' >>\nstream\n'),
      content,
      ascii('endstream'),
    );
  });
  const xrefOffset = length;
  const xref = [
    'xref',
    '0 ' + String(objectCount + 1),
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n '),
    'trailer',
    '<< /Size ' + String(objectCount + 1) + ' /Root 1 0 R >>',
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  append(ascii(xref));
  return concatenate(chunks);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('report_image_failed'))),
      type,
      type === 'image/jpeg' ? 0.94 : undefined,
    );
  });
}

function metricRow(label: string, metrics: HistoricalQueuePerformanceMetrics): (string | number)[] {
  return [
    label,
    metrics.enteredCalls,
    metrics.incomingSharePercent,
    metrics.uniqueCallers,
    metrics.repeatCallers,
    metrics.repeatCallerRatePercent,
    metrics.averageCallsPerCaller,
    metrics.callsFromRepeatCallers,
    metrics.repeatCallSharePercent,
    metrics.callerIdentificationRatePercent,
    metrics.answeredCalls,
    metrics.answerRatePercent,
    metrics.unansweredCalls,
    metrics.unansweredRatePercent,
    metrics.confirmedLostCalls,
    metrics.confirmedLostRatePercent,
    metrics.callerAbandonedCalls,
    metrics.callerAbandonRatePercent,
    metrics.timedOutCalls,
    metrics.timedOutRatePercent,
    metrics.exitWithKeyCalls,
    metrics.exitWithKeyRatePercent,
    metrics.forcedExitCalls,
    metrics.forcedExitRatePercent,
    metrics.systemFailureCalls,
    metrics.systemFailureRatePercent,
    metrics.unresolvedUnansweredCalls,
    metrics.unresolvedUnansweredRatePercent,
    metrics.outcomeExcessCalls,
    metrics.ringNoAnswerAttempts,
    metrics.ringNoAnswerAttemptsPer100Entered,
    metrics.ringCanceledAttempts,
    metrics.averageAnswerSeconds ?? '',
    metrics.averageWaitSeconds ?? '',
  ];
}

export async function exportQueuePerformancePdf(
  payload: QueuePerformanceExportPayload,
): Promise<void> {
  const canvases = [renderPdfCanvas(payload), ...renderDetailPages(payload)];
  const pages = await withTimeout(
    Promise.all(
      canvases.map(async (canvas) => {
        const blob = await canvasBlob(canvas, 'image/jpeg');
        return {
          jpeg: new Uint8Array(await blob.arrayBuffer()),
          width: canvas.width,
          height: canvas.height,
        };
      }),
    ),
    'queue_report_pdf_timeout',
  );
  const pdf = buildImagePagesPdf(pages);
  const bytes = new Uint8Array(pdf.length);
  bytes.set(pdf);
  downloadBlob(
    new Blob([bytes.buffer], { type: 'application/pdf' }),
    fileBaseName(payload.report) + '.pdf',
  );
}

export async function exportQueuePerformanceExcel(
  payload: QueuePerformanceExportPayload,
): Promise<void> {
  const { report, text } = payload;
  const rtl = isRtl(text);
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const headers = [
    text.historyQueueAbandonmentQueue,
    text.historyQueuePerformanceIncoming,
    text.historyQueuePerformanceIncomingShare + ' %',
    text.historyQueuePerformanceUniqueCallers,
    text.historyQueuePerformanceRepeatCallers,
    text.historyQueuePerformanceRepeatCallerRate + ' %',
    text.historyQueuePerformanceAvgCallsPerCaller,
    text.historyQueuePerformanceCallsFromRepeatCallers,
    text.historyQueuePerformanceRepeatCallShare + ' %',
    text.historyQueuePerformanceCallerIdentificationRate + ' %',
    text.historyQueuePerformanceAnswered,
    text.historyQueuePerformanceAnswerRate + ' %',
    text.historyQueuePerformanceUnanswered,
    text.historyQueuePerformanceUnansweredRate + ' %',
    text.historyQueuePerformanceConfirmedLost,
    text.historyQueuePerformanceLostRate + ' %',
    text.historyQueuePerformanceCallerAbandon,
    text.historyQueuePerformanceCallerAbandon + ' %',
    text.historyQueuePerformanceTimeout,
    text.historyQueuePerformanceTimeout + ' %',
    text.historyQueuePerformanceExitKey,
    text.historyQueuePerformanceExitKey + ' %',
    text.historyQueuePerformanceForcedExit,
    text.historyQueuePerformanceForcedExit + ' %',
    text.historyQueuePerformanceSystemFailure,
    text.historyQueuePerformanceSystemFailure + ' %',
    text.historyQueuePerformanceUnresolved,
    text.historyQueuePerformanceUnresolved + ' %',
    text.historyQueuePerformanceOutcomeExcess,
    text.historyQueuePerformanceRingNoAnswer,
    text.historyQueuePerformancePer100,
    text.historyQueuePerformanceRingCanceled,
    text.historyQueuePerformanceAvgAnswer + ' (' + text.historyQueuePerformanceSeconds + ')',
    text.historyQueuePerformanceAvgWait + ' (' + text.historyQueuePerformanceSeconds + ')',
  ];
  const headerCells = headers.map((value) => ({
    value,
    fontWeight: 'bold' as const,
    textColor: '#FFFFFF',
    backgroundColor: '#1A3A5E',
    align: rtl ? ('right' as const) : ('left' as const),
    wrap: true,
  }));
  const rows: SheetData = [
    [
      {
        value: text.historyQueuePerformanceTitle,
        fontWeight: 'bold',
        fontSize: 18,
        textColor: '#FFFFFF',
        backgroundColor: '#10243B',
        columnSpan: headers.length,
        align: rtl ? 'right' : 'left',
      },
    ],
    [
      {
        value:
          payload.pbxName +
          ' | ' +
          report.from.replace('T', ' ') +
          ' -> ' +
          report.to.replace('T', ' '),
        columnSpan: headers.length,
        textColor: '#58708D',
        align: rtl ? 'right' : 'left',
      },
    ],
    [],
    headerCells,
  ];
  for (const row of report.queues) rows.push(metricRow(row.queueId, row));
  rows.push(metricRow(text.historyQueuePerformanceTotal, report.total));

  const chartCanvas = renderChartsCanvas(payload);
  const chartBlob = await withTimeout(
    canvasBlob(chartCanvas, 'image/png'),
    'queue_report_excel_chart_timeout',
  );
  const chartAnchorRow = rows.length + 3;
  rows.push([], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []);

  const sheetOptions: SheetOptions<Blob | File | ArrayBuffer> = {
    sheet: text.historyQueuePerformanceTitle.slice(0, 31),
    rightToLeft: rtl,
    showGridLines: false,
    columns: headers.map((_, index) => ({ width: index === 0 ? 22 : 18 })),
    images: [
      {
        content: chartBlob,
        contentType: 'image/png',
        width: 1050,
        height: 700,
        dpi: 96,
        anchor: { row: chartAnchorRow, column: 1 },
        title: text.historyQueuePerformanceTitle,
        description: text.historyQueuePerformanceSourceHint,
      },
    ],
  };
  const workbook = writeXlsxFile(rows, sheetOptions);
  const blob = await withTimeout(workbook.toBlob(), 'queue_report_excel_timeout');
  downloadBlob(blob, fileBaseName(report) + '.xlsx');
}

function queueDetailOutcomeLabel(text: TextMap, outcome: HistoricalQueueCallOutcome): string {
  switch (outcome) {
    case 'ANSWERED':
      return text.historyQueueDetailOutcomeAnswered;
    case 'CALLER_ABANDONED':
      return text.historyQueueDetailOutcomeCallerAbandoned;
    case 'QUEUE_TIMEOUT':
      return text.historyQueueDetailOutcomeQueueTimeout;
    case 'EXIT_WITH_KEY':
      return text.historyQueueDetailOutcomeExitWithKey;
    case 'FORCED_EXIT':
      return text.historyQueueDetailOutcomeForcedExit;
    case 'SYSTEM_FAILURE':
      return text.historyQueueDetailOutcomeSystemFailure;
    default:
      return text.historyQueueDetailOutcomeUnresolved;
  }
}

function detailExportTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('queue_detail_excel_timeout')), 60_000);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

export async function exportQueueCallDetailsExcel(
  payload: QueueCallDetailsExportPayload,
): Promise<void> {
  const { report, text, details } = payload;
  const rtl = isRtl(text);
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const headers = [
    text.historyQueueAbandonmentQueue,
    text.historyQueueDetailCallId,
    text.historyQueueDetailCallerNumber,
    text.historyQueueDetailEnteredAt,
    text.historyQueueDetailInitialPosition,
    text.historyQueueDetailOutcome,
    text.historyQueueDetailAgent,
    text.historyQueueDetailConnectedAt,
    text.historyQueueDetailOutcomeAt,
    text.historyQueueDetailCompletedAt,
    text.historyQueueDetailWaitSeconds,
    text.historyQueueDetailWaitMinutes,
    text.historyQueueDetailTalkSeconds,
    text.historyQueueDetailTalkMinutes,
  ];
  const headerCells = headers.map((value) => ({
    value,
    fontWeight: 'bold' as const,
    textColor: '#FFFFFF',
    backgroundColor: '#1A3A5E',
    align: rtl ? ('right' as const) : ('left' as const),
    wrap: true,
  }));
  const rows: SheetData = [
    [
      {
        value: text.historyQueuePerformanceExportDetailsExcel,
        fontWeight: 'bold',
        fontSize: 18,
        textColor: '#FFFFFF',
        backgroundColor: '#10243B',
        columnSpan: headers.length,
        align: rtl ? 'right' : 'left',
      },
    ],
    [
      {
        value:
          payload.pbxName +
          ' | ' +
          report.from.replace('T', ' ') +
          ' -> ' +
          report.to.replace('T', ' '),
        columnSpan: headers.length,
        textColor: '#58708D',
        align: rtl ? 'right' : 'left',
      },
    ],
    [],
    headerCells,
  ];
  for (const detail of details) {
    rows.push([
      detail.queueId,
      detail.callId,
      detail.callerNumber ?? '',
      detail.enteredAt,
      detail.initialPosition ?? '',
      queueDetailOutcomeLabel(text, detail.outcome),
      detail.agentId ?? '',
      detail.connectedAt ?? '',
      detail.outcomeAt ?? '',
      detail.completedAt ?? '',
      detail.waitSeconds ?? '',
      detail.waitSeconds === undefined ? '' : detail.waitSeconds / 60,
      detail.talkSeconds ?? '',
      detail.talkSeconds === undefined ? '' : detail.talkSeconds / 60,
    ]);
  }
  const workbook = writeXlsxFile(rows, {
    sheet: text.historyQueuePerformanceExportDetailsExcel.slice(0, 31),
    rightToLeft: rtl,
    showGridLines: false,
    columns: [
      { width: 16 },
      { width: 24 },
      { width: 20 },
      { width: 23 },
      { width: 18 },
      { width: 28 },
      { width: 24 },
      { width: 23 },
      { width: 23 },
      { width: 23 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ],
  });
  const blob = await detailExportTimeout(workbook.toBlob());
  downloadBlob(blob, fileBaseName(report) + '-details.xlsx');
}
