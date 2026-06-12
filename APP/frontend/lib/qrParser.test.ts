import { describe, it, expect } from 'vitest';
import { parseScanInputLenient, parseScanFromLines, parseHojaDeRuta } from './qrParser';

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

describe('parseHojaDeRuta', () => {
  // Hoja de ruta real de Solmicro (FAVRAM) — incluye las trampas reales:
  // OF antigua en "Histórico OFs", código de materia prima en consumos y fechas.
  const HOJA_COMPLETA = [
    'Hoja de Ruta - Orden de Fabricación',
    'Solmicro-2.025 V.1.0',
    'FAVRAM,S.L.',
    'Ofertador: HERRANZ SANTAMARIA, MAXIMO',
    'O.F. Nº: OF26-05481',
    'Artículo: 20230110001',
    'Cantidad 10 F. Lzto: 24/06/2026',
    'Descripción: TIRANTA EXTERNA CAJA CALIENTE',
    'Rev: 0 F. Prev: 24/06/2026',
    'Subfamilia: PIDE -',
    'Artículo: 20230110001 Rev - 0',
    'Centro: 1200 - PROGRAMACIÓN C.N.C./DESARROLLO',
    '5- SOLICITUD DE CAMBIO',
    'Artículo: 20230110001 Rev - 0',
    'Centro: 1390 - AUTO LASER',
    '10- AUTO LASER',
    'Histórico OFs Operarios',
    'OF25-11034 105',
    'Consumos en esta fase:',
    '0 AIN304L2B0-0003011-0 CH AISI 304L 2B 3*1500*1500',
  ];

  it('extracts article + OF from the full hoja de ruta', () => {
    const r = parseHojaDeRuta(HOJA_COMPLETA);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: '20230110001', orderFab: 'OF26-05481' });
  });

  it('ignores the OF from the Histórico OFs block', () => {
    const r = parseHojaDeRuta(['Histórico OFs', 'OF25-11034 105', 'O.F. Nº: OF26-05481', 'Artículo: 20230110001']);
    // La OF etiquetada gana aunque la del histórico aparezca antes... pero el
    // histórico corta el scope: con el bloque al principio, todo queda fuera.
    // El caso real (histórico al pie) es HOJA_COMPLETA; aquí validamos que
    // jamás se devuelva la OF del histórico.
    if (r.success) expect(r.data.orderFab).not.toBe('OF25-11034');
  });

  it('works when the photo only captures the red header box', () => {
    const r = parseHojaDeRuta(['O.F. Nº: OF26-05481', 'Artículo: 20230110001']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: '20230110001', orderFab: 'OF26-05481' });
  });

  it('works when Vision splits labels and values into separate lines', () => {
    const r = parseHojaDeRuta(['O.F. Nº:', 'Artículo:', 'OF26-05481', '20230110001']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: '20230110001', orderFab: 'OF26-05481' });
  });

  it('frequency voting picks the repeated article over noise numbers', () => {
    const r = parseHojaDeRuta([
      'OF26-05481',
      'Ref 20230110001',
      'Centro 1200',
      '20230110001 Rev 0',
      '24/06/2026',
      '20230110001',
    ]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('20230110001');
  });

  it('rejects glued dates as article candidates', () => {
    const r = parseHojaDeRuta(['O.F. Nº: OF26-05481', '24062026', 'Articulo 20230110001']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('20230110001');
  });

  it('never returns label residue ("O.F.") as the article', () => {
    const r = parseHojaDeRuta(['O.F. Nº: OF26-05481']);
    expect(r.success).toBe(false);
  });

  it('accepts a multiline string instead of lines', () => {
    const r = parseHojaDeRuta('O.F. Nº: OF26-05481\nArtículo: 20230110001');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderFab).toBe('OF26-05481');
  });

  it('fails without OF so the caller can fall back', () => {
    expect(parseHojaDeRuta(['Artículo: 20230110001']).success).toBe(false);
  });

  // ── Formato del artículo LIBRE: lo que manda es la etiqueta, no el formato ──

  it('accepts alphanumeric article formats (CL34712023)', () => {
    const r = parseHojaDeRuta(['O.F. Nº: OF26-05481', 'Artículo: CL34712023']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('CL34712023');
  });

  it('accepts article codes with dashes and letters mixed', () => {
    const r = parseHojaDeRuta(['O.F. Nº: OF26-05481', 'Artículo: AB-123-XYZ Rev 0']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('AB-123-XYZ');
  });

  it('label wins even if the code is short or unusual', () => {
    const r = parseHojaDeRuta(['O.F. Nº: OF26-05481', 'Artículo: X9-PLUS']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('X9-PLUS');
  });

  it('finds alphanumeric article in lines after a split label', () => {
    const r = parseHojaDeRuta(['O.F. Nº:', 'Artículo:', 'OF26-05481', 'CL34712023']);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ articleCode: 'CL34712023', orderFab: 'OF26-05481' });
  });

  it('frequency voting works with alphanumeric codes too', () => {
    const r = parseHojaDeRuta([
      'OF26-05481',
      'Ref CL34712023',
      'Fase 10 CL34712023',
      'Centro 1390',
      'CL34712023',
    ]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('CL34712023');
  });

  it('does not mistake the description or dates for the article', () => {
    const r = parseHojaDeRuta([
      'O.F. Nº: OF26-05481',
      'Descripción: TIRANTA EXTERNA CAJA CALIENTE',
      'Cantidad 10 F. Lzto: 24/06/2026',
      'Artículo: 20230110001',
    ]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleCode).toBe('20230110001');
  });
});
