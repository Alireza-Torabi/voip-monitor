import type { SheetData, SheetOptions } from 'write-excel-file/browser';

export interface ReportExportDatum {
  label: string;
  value: string | number;
}

export interface QueueReportExportPayload {
  fileBaseName: string;
  title: string;
  subtitle: string;
  rtl: boolean;
  filtersTitle: string;
  metricsTitle: string;
  chartTitle: string;
  filters: readonly ReportExportDatum[];
  metrics: readonly ReportExportDatum[];
  chartTotal: number;
  chartTotalLabel: string;
  chartSegments: readonly { label: string; value: number; color: string }[];
}

function safeFileBaseName(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 120) || 'voip-monitor-report'
  );
}

const EXPORT_TIMEOUT_MS = 15_000;

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

function canvas2d(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('report_canvas_unavailable');
  return { canvas, context };
}

function applyTextDirection(context: CanvasRenderingContext2D, rtl: boolean): void {
  context.direction = rtl ? 'rtl' : 'ltr';
  context.textAlign = rtl ? 'right' : 'left';
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
): void {
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

function drawQueueDonut(
  context: CanvasRenderingContext2D,
  payload: QueueReportExportPayload,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  const segments = payload.chartSegments.filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  context.save();
  context.lineCap = 'round';
  context.lineWidth = Math.max(24, radius * 0.22);
  context.strokeStyle = '#1B3047';
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  if (total > 0) {
    let start = -Math.PI / 2;
    for (const segment of segments) {
      const sweep = (segment.value / total) * Math.PI * 2;
      const gap = Math.min(0.035, sweep * 0.12);
      context.strokeStyle = segment.color;
      context.beginPath();
      context.arc(centerX, centerY, radius, start + gap, start + sweep - gap);
      context.stroke();
      start += sweep;
    }
  }
  context.restore();

  context.save();
  context.textAlign = 'center';
  context.direction = payload.rtl ? 'rtl' : 'ltr';
  context.fillStyle = '#E7EEF8';
  context.font = '700 46px "Segoe UI", Tahoma, sans-serif';
  context.fillText(payload.chartTotal.toLocaleString(), centerX, centerY + 2);
  context.fillStyle = '#748CA9';
  context.font = '600 16px "Segoe UI", Tahoma, sans-serif';
  context.fillText(payload.chartTotalLabel, centerX, centerY + 36);
  context.restore();
}

function renderQueueChartCanvas(payload: QueueReportExportPayload): HTMLCanvasElement {
  const { canvas, context } = canvas2d(1200, 620);
  context.fillStyle = '#091625';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 24, 24, 1152, 572, 24, '#0D1D30', '#29415F');

  applyTextDirection(context, payload.rtl);
  context.fillStyle = '#E7EEF8';
  context.font = '700 26px "Segoe UI", Tahoma, sans-serif';
  const titleX = payload.rtl ? 1140 : 60;
  context.fillText(payload.chartTitle, titleX, 72);

  drawQueueDonut(context, payload, payload.rtl ? 860 : 340, 340, 150);

  const segments = payload.chartSegments.filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const boxX = payload.rtl ? 70 : 650;
  const labelX = payload.rtl ? boxX + 430 : boxX + 46;
  const valueX = payload.rtl ? boxX + 46 : boxX + 430;
  for (const [index, segment] of segments.entries()) {
    const y = 145 + index * 100;
    drawRoundedRect(context, boxX, y, 480, 76, 14, '#12253C', '#203B58');
    context.fillStyle = segment.color;
    context.beginPath();
    context.arc(payload.rtl ? boxX + 446 : boxX + 34, y + 38, 8, 0, Math.PI * 2);
    context.fill();

    applyTextDirection(context, payload.rtl);
    context.fillStyle = '#B7C6D9';
    context.font = '600 18px "Segoe UI", Tahoma, sans-serif';
    context.fillText(segment.label, labelX, y + 34);

    context.direction = 'ltr';
    context.textAlign = payload.rtl ? 'left' : 'right';
    context.fillStyle = '#E7EEF8';
    context.font = '700 19px "Segoe UI", Tahoma, sans-serif';
    const percentage = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0.0';
    context.fillText(`${segment.value.toLocaleString()}   ${percentage}%`, valueX, y + 34);
  }
  return canvas;
}

function renderQueueReportCanvas(payload: QueueReportExportPayload): HTMLCanvasElement {
  const { canvas, context } = canvas2d(1800, 1180);
  context.fillStyle = '#07111F';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 40, 40, 1720, 1100, 26, '#0D1D30', '#29415F');

  const left = 90;
  const right = 1710;
  applyTextDirection(context, payload.rtl);
  const textX = payload.rtl ? right : left;
  context.fillStyle = '#E7EEF8';
  context.font = '800 36px "Segoe UI", Tahoma, sans-serif';
  context.fillText(payload.title, textX, 105);
  context.fillStyle = '#8DA2BD';
  context.font = '600 18px "Segoe UI", Tahoma, sans-serif';
  context.fillText(payload.subtitle, textX, 140);

  const drawSection = (
    title: string,
    items: readonly ReportExportDatum[],
    top: number,
    columns: number,
  ) => {
    applyTextDirection(context, payload.rtl);
    context.fillStyle = '#7EA9D7';
    context.font = '700 19px "Segoe UI", Tahoma, sans-serif';
    context.fillText(title, textX, top);
    const gap = 18;
    const width = (1620 - gap * (columns - 1)) / columns;
    const rows = Math.ceil(items.length / columns);
    for (const [index, item] of items.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = payload.rtl
        ? right - width - column * (width + gap)
        : left + column * (width + gap);
      const y = top + 28 + row * 112;
      drawRoundedRect(context, x, y, width, 94, 14, '#11263D', '#203B58');
      applyTextDirection(context, payload.rtl);
      const innerX = payload.rtl ? x + width - 18 : x + 18;
      context.fillStyle = '#748CA9';
      context.font = '600 15px "Segoe UI", Tahoma, sans-serif';
      context.fillText(item.label, innerX, y + 30);
      context.fillStyle = '#E7EEF8';
      context.font = '700 19px "Segoe UI", Tahoma, sans-serif';
      context.fillText(String(item.value), innerX, y + 64);
    }
    return top + 28 + rows * 112;
  };

  let y = drawSection(payload.filtersTitle, payload.filters, 200, 3);
  y = drawSection(payload.metricsTitle, payload.metrics, y + 20, 4);

  const chart = renderQueueChartCanvas(payload);
  const chartTop = y + 28;
  const availableHeight = 1080 - chartTop;
  const chartScale = Math.min(1.25, 1620 / chart.width, availableHeight / chart.height);
  const chartWidth = chart.width * chartScale;
  const chartHeight = chart.height * chartScale;
  context.drawImage(chart, (canvas.width - chartWidth) / 2, chartTop, chartWidth, chartHeight);
  return canvas;
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('report_image_failed'))),
      'image/png',
    );
  });
}

async function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('report_image_failed'))),
      'image/jpeg',
      0.94,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function buildImagePdf(
  jpeg: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
): Uint8Array {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;
  const scale = Math.min(
    (pageWidth - margin * 2) / pixelWidth,
    (pageHeight - margin * 2) / pixelHeight,
  );
  const width = pixelWidth * scale;
  const height = pixelHeight * scale;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;
  const content = ascii(
    `q\n${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`,
  );
  const chunks: Uint8Array[] = [
    new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 255, 255, 255, 255, 10]),
  ];
  const offsets = [0, 0, 0, 0, 0, 0];
  let length = chunks[0]!.length;
  const append = (...items: Uint8Array[]) => {
    for (const item of items) {
      chunks.push(item);
      length += item.length;
    }
  };
  const object = (id: number, ...body: Uint8Array[]) => {
    offsets[id] = length;
    append(ascii(`${id} 0 obj\n`), ...body, ascii('\nendobj\n'));
  };

  object(1, ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  object(
    3,
    ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
  );
  object(
    4,
    ascii(
      `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    ),
    jpeg,
    ascii('\nendstream'),
  );
  object(5, ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('endstream'));

  const xrefOffset = length;
  const xref = [
    'xref',
    '0 6',
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  append(ascii(xref));
  return concatenate(chunks);
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
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportQueueReportPdf(payload: QueueReportExportPayload): Promise<void> {
  const canvas = renderQueueReportCanvas(payload);
  const jpeg = await withTimeout(canvasJpeg(canvas), 'report_pdf_timeout');
  const pdf = buildImagePdf(jpeg, canvas.width, canvas.height);
  const pdfBytes = new Uint8Array(pdf.length);
  pdfBytes.set(pdf);
  downloadBlob(
    new Blob([pdfBytes.buffer], { type: 'application/pdf' }),
    `${safeFileBaseName(payload.fileBaseName)}.pdf`,
  );
}

export async function exportQueueReportExcel(payload: QueueReportExportPayload): Promise<void> {
  const chartCanvas = renderQueueChartCanvas(payload);
  const chartBlob = await withTimeout(canvasPngBlob(chartCanvas), 'report_excel_chart_timeout');
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const titleCell = {
    value: payload.title,
    fontWeight: 'bold' as const,
    fontSize: 18,
    textColor: '#FFFFFF',
    backgroundColor: '#10243B',
    align: payload.rtl ? ('right' as const) : ('left' as const),
    columnSpan: 4,
    height: 32,
  };
  const subtitleCell = {
    value: payload.subtitle,
    fontSize: 11,
    textColor: '#58708D',
    align: payload.rtl ? ('right' as const) : ('left' as const),
    columnSpan: 4,
    height: 22,
  };
  const sectionCell = (value: string) => ({
    value,
    fontWeight: 'bold' as const,
    fontSize: 12,
    textColor: '#FFFFFF',
    backgroundColor: '#1A3A5E',
    align: payload.rtl ? ('right' as const) : ('left' as const),
    columnSpan: 4,
    height: 24,
  });
  const labelCell = (value: string) => ({
    value,
    fontWeight: 'bold' as const,
    textColor: '#385A7A',
    backgroundColor: '#EAF2FA',
    align: payload.rtl ? ('right' as const) : ('left' as const),
    borderColor: '#D5E2EF',
    borderStyle: 'thin' as const,
    wrap: true,
  });
  const valueCell = (value: string | number) => ({
    value,
    textColor: '#10243B',
    align:
      typeof value === 'number'
        ? ('right' as const)
        : payload.rtl
          ? ('right' as const)
          : ('left' as const),
    borderColor: '#D5E2EF',
    borderStyle: 'thin' as const,
    wrap: true,
  });

  const rows: SheetData = [[titleCell], [subtitleCell], [], [sectionCell(payload.filtersTitle)]];
  for (const item of payload.filters) rows.push([labelCell(item.label), valueCell(item.value)]);
  rows.push([], [sectionCell(payload.metricsTitle)]);
  for (const item of payload.metrics) rows.push([labelCell(item.label), valueCell(item.value)]);
  rows.push([], [sectionCell(payload.chartTitle)], [], [], [], [], [], [], [], [], [], []);

  const chartAnchorRow = payload.filters.length + payload.metrics.length + 11;
  const sheetOptions: SheetOptions<Blob | File | ArrayBuffer> = {
    sheet: payload.title.slice(0, 31),
    rightToLeft: payload.rtl,
    showGridLines: false,
    columns: [{ width: 34 }, { width: 24 }, { width: 20 }, { width: 20 }],
    images: [
      {
        content: chartBlob,
        contentType: 'image/png',
        width: 720,
        height: 372,
        dpi: 96,
        anchor: { row: chartAnchorRow, column: 1 },
        title: payload.chartTitle,
        description: payload.chartTitle,
      },
    ],
  };
  const workbook = writeXlsxFile(rows, sheetOptions);
  const blob = await withTimeout(workbook.toBlob(), 'report_excel_workbook_timeout');
  downloadBlob(blob, `${safeFileBaseName(payload.fileBaseName)}.xlsx`);
}
