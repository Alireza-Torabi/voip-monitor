import type { SheetData } from 'write-excel-file/browser';

export interface ReportExportDatum {
  label: string;
  value: string | number;
}

export interface QueueReportExportPayload {
  reportElement: HTMLElement;
  chartElement: HTMLElement;
  fileBaseName: string;
  title: string;
  subtitle: string;
  rtl: boolean;
  filtersTitle: string;
  metricsTitle: string;
  chartTitle: string;
  filters: readonly ReportExportDatum[];
  metrics: readonly ReportExportDatum[];
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

async function renderElement(element: HTMLElement, scale = 2) {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(element, {
    backgroundColor: '#091625',
    scale,
    logging: false,
    useCORS: true,
    removeContainer: true,
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('report_image_failed'));
    }, 'image/png');
  });
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
  const canvas = await renderElement(payload.reportElement, 2);
  const jpeg = await canvasJpeg(canvas);
  const pdf = buildImagePdf(jpeg, canvas.width, canvas.height);
  const pdfBytes = new Uint8Array(pdf.length);
  pdfBytes.set(pdf);
  downloadBlob(
    new Blob([pdfBytes.buffer], { type: 'application/pdf' }),
    `${safeFileBaseName(payload.fileBaseName)}.pdf`,
  );
}

export async function exportQueueReportExcel(payload: QueueReportExportPayload): Promise<void> {
  const chartCanvas = await renderElement(payload.chartElement, 2);
  const chartBlob = await canvasBlob(chartCanvas);
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
  await writeXlsxFile(rows, {
    sheet: payload.title.slice(0, 31),
    rightToLeft: payload.rtl,
    showGridLines: false,
    columns: [{ width: 34 }, { width: 24 }, { width: 20 }, { width: 20 }],
    images: [
      {
        content: chartBlob,
        contentType: 'image/png',
        width: Math.min(760, Math.max(520, chartCanvas.width / 2)),
        height: Math.min(420, Math.max(280, chartCanvas.height / 2)),
        dpi: 96,
        anchor: { row: chartAnchorRow, column: 1 },
        title: payload.chartTitle,
        description: payload.chartTitle,
      },
    ],
  }).toFile(`${safeFileBaseName(payload.fileBaseName)}.xlsx`);
}
