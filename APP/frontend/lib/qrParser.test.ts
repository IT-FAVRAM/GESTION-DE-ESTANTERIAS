import { describe, it, expect } from 'vitest';
import { parseScanInputLenient, parseScanFromLines } from './qrParser';

describe('parseScanInputLenient', () => {
  it('parses classic gun format', () => {
    const r = parseScanInputLenient('CL34712023 // OF25-07221');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: 'CL34712023', orderFab: 'OF25-07221' });
  });

  it('parses OF + article on one blob (no separator)', () => {
    const r = parseScanInputLenient('CL34712023 OF25-07221');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderFab).toBe('OF25-07221');
  });

  it('corrects common OCR confusions in OF', () => {
    const r = parseScanInputLenient('CL3471 0F25 07221');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderFab).toBe('OF25-07221');
  });

  it('fails when no OF present', () => {
    const r = parseScanInputLenient('SOLO TEXTO SIN OF');
    expect(r.success).toBe(false);
  });
});

describe('parseScanFromLines', () => {
  it('takes the line below the OF as the article code', () => {
    const r = parseScanFromLines(['OF25-07221', 'CL34712023']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: 'CL34712023', orderFab: 'OF25-07221' });
  });

  it('handles OF and article on the same line', () => {
    const r = parseScanFromLines(['ARTÍCULO CL34712023 OF25-07221']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: 'CL34712023', orderFab: 'OF25-07221' });
  });

  it('skips noise lines before the OF', () => {
    const r = parseScanFromLines(['ETIQUETA', 'OF25-07221', 'CL34712023', 'PESO 12KG']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderFab).toBe('OF25-07221');
  });

  it('fails (so caller can fall back) when no OF in any line', () => {
    const r = parseScanFromLines(['UNA LINEA', 'OTRA LINEA']);
    expect(r.success).toBe(false);
  });

  it('fails on empty input', () => {
    expect(parseScanFromLines([]).success).toBe(false);
  });
});
