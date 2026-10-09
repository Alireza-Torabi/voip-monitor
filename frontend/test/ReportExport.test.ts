import { describe, expect, it } from 'vitest';
import { buildImagePdf } from '../src/reportExport.js';
import { buildImagePagesPdf } from '../src/queuePerformanceExport.js';

const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

function assertXref(text: string, lastObjectId: number, expectedSize: number) {
  const startXrefMatch = /startxref\n(\d+)\n%%EOF/u.exec(text);
  expect(startXrefMatch).not.toBeNull();
  const xrefOffset = Number(startXrefMatch?.[1]);
  expect(text.slice(xrefOffset, xrefOffset + 4)).toBe('xref');
  const lines = text.slice(xrefOffset).split('\n');
  expect(lines[0]).toBe('xref');
  expect(lines[1]).toBe('0 ' + expectedSize);
  for (let objectId = 1; objectId <= lastObjectId; objectId += 1) {
    const entry = lines[2 + objectId];
    expect(entry).toBeDefined();
    const offset = Number(entry?.slice(0, 10));
    expect(text.slice(offset, offset + String(objectId).length + 6)).toBe(
      String(objectId) + ' 0 obj',
    );
  }
}

describe('report PDF writer', () => {
  it('builds a one-page image PDF with valid xref offsets', () => {
    const pdf = buildImagePdf(jpeg, 640, 360);
    const text = Buffer.from(pdf).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Filter /DCTDecode');
    assertXref(text, 5, 6);
  });

  it('builds a multi-page queue report PDF with valid xref offsets', () => {
    const pdf = buildImagePagesPdf([
      { jpeg, width: 640, height: 360 },
      { jpeg, width: 640, height: 360 },
    ]);
    const text = Buffer.from(pdf).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text.match(/\/Subtype \/Image/gu)?.length).toBe(2);
    assertXref(text, 8, 9);
  });
});
