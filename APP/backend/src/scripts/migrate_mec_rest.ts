#!/usr/bin/env node
/**
 * migrate_mec_rest — Renumera las ubicaciones MEC usando la REST API de Firestore.
 * No necesita service account — usa el token de gcloud del usuario autenticado.
 *
 * Uso (desde APP/backend):
 *   npm run build && node lib/scripts/migrate_mec_rest.js          # dry-run
 *   npm run build && node lib/scripts/migrate_mec_rest.js --apply  # aplica
 */

import { execSync } from 'child_process';
import * as https from 'https';

const PROJECT = 'gestion-de-estanterias';
const DB = '(default)';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents`;

const SHELF = 'MEC';
const POSITION_MAP: Record<number, number> = {};
for (let i = 1; i <= 21; i++) POSITION_MAP[i] = i + 13;  // cuerpos 1+2: +13
for (let i = 22; i <= 30; i++) POSITION_MAP[i] = i + 16; // cuerpo3: +16

const pad3 = (n: number) => String(n).padStart(3, '0');
const oldDocId = (pos: number) => `${SHELF}-${pad3(pos)}`;
const newDocId = (pos: number) => `${SHELF}-${pad3(POSITION_MAP[pos])}`;
const newPosStr = (pos: number) => pad3(POSITION_MAP[pos]);

function getToken(): string {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

function firestoreRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const url = new URL(`${BASE}/${path}`);
    const payload = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) { resolve(null); return; }
        if (res.statusCode === 204 || res.statusCode === 200) {
          try { resolve(data ? JSON.parse(data) : null); }
          catch { resolve(null); }
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Convierte un documento Firestore REST en un objeto JS plano */
function fromFirestore(doc: any): Record<string, any> {
  if (!doc || !doc.fields) return {};
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries<any>(doc.fields)) {
    result[key] = decodeValue(val);
  }
  return result;
}

function decodeValue(val: any): any {
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in val) return fromFirestore(val.mapValue);
  return val;
}

/** Convierte un objeto JS plano a formato Firestore REST */
function toFirestore(obj: Record<string, any>): { fields: Record<string, any> } {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = encodeValue(val);
  }
  return { fields };
}

function encodeValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(encodeValue) } };
  if (typeof val === 'object') return { mapValue: toFirestore(val) };
  return { stringValue: String(val) };
}

async function migrate() {
  const apply = process.argv.includes('--apply');
  const includeCuerpo3 = process.argv.includes('--include-cuerpo3');

  console.log(`🔄 Migración MEC positions — REST API (${apply ? 'APLICAR' : 'DRY-RUN'})`);
  if (!includeCuerpo3) console.log('   cuerpo3 (022-030) omitido — vacío intencionalmente');
  console.log('='.repeat(60));

  const maxPos = includeCuerpo3 ? 30 : 21;
  let moved = 0;
  let empty = 0;

  for (let oldPos = 1; oldPos <= maxPos; oldPos++) {
    const oldId = oldDocId(oldPos);
    const newId = newDocId(oldPos);
    const docPath = `shelves/${SHELF}/locations/${oldId}`;

    const doc = await firestoreRequest('GET', docPath);
    if (!doc) {
      console.log(`   ⬜ ${oldId} → ${newId}  (no existe)`);
      empty++;
      continue;
    }

    const data = fromFirestore(doc);
    const items = (data.items as any[]) || [];
    const isEmpty = data.isEmpty as boolean ?? items.length === 0;

    if (isEmpty && items.length === 0) {
      console.log(`   ⬜ ${oldId} → ${newId}  (vacío, saltar)`);
      empty++;
      if (apply) {
        // Borrar doc vacío para limpiar
        await firestoreRequest('DELETE', docPath);
      }
      continue;
    }

    console.log(`   ${apply ? '✍️ ' : '👀'} ${oldId} → ${newId}  (${items.length} artículo(s))`);
    items.forEach((it: any) => console.log(`      • ${it.articleCode || '?'} / ${it.orderFab || '?'}`));

    if (apply) {
      const newData = { ...data, position: newPosStr(oldPos) };
      const newPath = `shelves/${SHELF}/locations/${newId}`;
      // Crear/sobreescribir documento nuevo
      await firestoreRequest('PATCH', newPath, toFirestore(newData));
      // Borrar documento antiguo
      await firestoreRequest('DELETE', docPath);
    }

    moved++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Con artículos: ${moved}  |  Vacíos/inexistentes: ${empty}`);
  if (!apply) {
    console.log('\n⚠️  DRY-RUN. Ejecuta con --apply para aplicar los cambios.');
  } else {
    console.log('\n✅ Migración completada.');
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌', err.message); process.exit(1); });
