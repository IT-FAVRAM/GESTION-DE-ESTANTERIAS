#!/usr/bin/env node
/**
 * backfill_urg_mec_pre — Sincroniza por única vez las ubicaciones urgentes
 * compartidas "URG MEC-PRE 001..004" entre las estanterías PRE (Prensas) y
 * MEC (Mecanizado).
 *
 * Contexto: ambas estanterías comparten físicamente esas 4 ubicaciones, pero en
 * Firestore son documentos separados (shelves/PRE/locations/... y
 * shelves/MEC/locations/...). A partir de la sincronización en `shelfOperate`,
 * las NUEVAS operaciones se espejan automáticamente; este script reconcilia los
 * artículos urgentes YA existentes para que ambas estanterías muestren la unión.
 *
 * Estrategia: para cada posición, une los `items` de PRE y MEC deduplicando por
 * `presenceId` (o, en su defecto, por articleCode+orderFab) y escribe la unión
 * en AMBOS documentos. Es idempotente: re-ejecutar no duplica.
 *
 * Uso (desde servidor):
 *   npm run build && node lib/scripts/backfill_urg_mec_pre.js          # dry-run (no escribe)
 *   npm run build && node lib/scripts/backfill_urg_mec_pre.js --apply  # aplica los cambios
 */

import { admin } from '../firebaseAdmin';

const SHARED_POSITIONS = [
  'URG MEC-PRE 001',
  'URG MEC-PRE 002',
  'URG MEC-PRE 003',
  'URG MEC-PRE 004',
];
const SHELVES = ['PRE', 'MEC'] as const;

const itemKey = (item: any): string =>
  item?.presenceId
    ? `p:${item.presenceId}`
    : `a:${String(item?.articleCode || '').trim().toUpperCase()}__${String(item?.orderFab || '').trim().toUpperCase()}`;

/** Une dos arrays de items deduplicando por presenceId / articleCode+orderFab. */
function unionItems(a: any[], b: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const it of [...a, ...b]) {
    const key = itemKey(it);
    // El primero gana; si llega un duplicado con más datos, conserva el existente.
    if (!byKey.has(key)) byKey.set(key, it);
  }
  return [...byKey.values()];
}

async function backfill() {
  const apply = process.argv.includes('--apply');
  const db = admin.firestore();
  console.log(`🔄 Backfill URG MEC-PRE (${apply ? 'APLICAR' : 'DRY-RUN'})`);
  console.log('='.repeat(50));

  let changed = 0;

  for (const position of SHARED_POSITIONS) {
    const refs = SHELVES.map((sc) => db.collection('shelves').doc(sc).collection('locations').doc(position));
    const snaps = await Promise.all(refs.map((r) => r.get()));
    const itemsByShelf = snaps.map((s) => (s.exists ? ((s.data()?.items || []) as any[]) : []));

    const union = unionItems(itemsByShelf[0], itemsByShelf[1]);

    console.log(`\n📍 ${position}`);
    SHELVES.forEach((sc, i) => console.log(`   ${sc}: ${itemsByShelf[i].length} item(s)`));
    console.log(`   → unión: ${union.length} item(s)`);

    for (let i = 0; i < SHELVES.length; i++) {
      const current = itemsByShelf[i];
      // Sólo escribe si el contenido difiere de la unión (idempotencia).
      const needsWrite = current.length !== union.length ||
        union.some((u) => !current.some((c) => itemKey(c) === itemKey(u)));
      if (!needsWrite) continue;
      changed++;
      console.log(`   ${apply ? '✍️' : '👀'} ${SHELVES[i]} ${current.length} → ${union.length}`);
      if (apply) {
        await refs[i].set(
          { position, items: union, isEmpty: union.length === 0 },
          { merge: true },
        );
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  if (changed === 0) {
    console.log('✅ Ya estaba todo sincronizado (nada que cambiar).');
  } else if (apply) {
    console.log(`✅ Backfill aplicado: ${changed} documento(s) actualizados.`);
  } else {
    console.log(`ℹ️  ${changed} documento(s) se actualizarían. Ejecuta con --apply para aplicar.`);
  }
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en el backfill:', err);
    process.exit(1);
  });
