/**
 * limpiar-estanteria.cjs — Quita de una estantería todo lo ubicado ANTES de una
 * fecha, para que el sistema vuelva a reflejar lo que hay físicamente.
 *
 * Caso de uso (sep 2026): Zincado tenía 353 piezas registradas cuando en la
 * estantería real había muy pocas: las que se llevaban no se retiraban.
 *
 * Qué hace, por cada presencia afectada (misma lógica que el op retirar):
 *   - items/{presenceId}: active=false, removedAt, removedBy, locationIds=[]
 *   - la quita del array items de su location (y del gemelo URG si lo hubiera)
 *   - la saca de itemAggregates.activePresenceIds
 *   - historial: acción LIMPIEZA_INVENTARIO (no RETIRAR, para no falsear el
 *     informe de Lead Time con salidas que no fueron reales)
 * Antes de escribir guarda una copia completa en APP/backend/backup_*.json
 * (ignorado por git) con la que se puede deshacer con --restore.
 *
 * Uso (desde APP/backend):
 *   node scripts/limpiar-estanteria.cjs --shelf ZIN --desde 2026-09-01            → SOLO INFORME
 *   node scripts/limpiar-estanteria.cjs --shelf ZIN --desde 2026-09-01 --apply    → aplica
 *   node scripts/limpiar-estanteria.cjs --restore backup_limpieza-ZIN-....json    → deshace
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const RESTORE = arg('--restore');
const SHELF = String(arg('--shelf') || '').trim().toUpperCase();
const DESDE = String(arg('--desde') || '').trim();

const saPath = [
  path.resolve(__dirname, '../../../serviceAccount.json'),
  path.resolve(process.cwd(), 'serviceAccount.json'),
].find((p) => fs.existsSync(p));
admin.initializeApp(saPath ? { credential: admin.credential.cert(require(saPath)) } : undefined);
const db = admin.firestore();

const REMOVED_BY = 'limpieza-inventario';
const ACTOR_NAME = 'Limpieza de inventario (administración)';

/** Medianoche de `yyyy-mm-dd` en hora de Madrid, como instante UTC. */
function madridMidnight(ymd) {
  const utcGuess = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(utcGuess)) throw new Error(`Fecha no válida: ${ymd}`);
  const madridWall = new Date(utcGuess).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
  const offset = Date.parse(`${madridWall.replace(' ', 'T')}Z`) - utcGuess;
  return new Date(utcGuess - offset);
}

async function clean() {
  if (!SHELF || !DESDE) throw new Error('Faltan --shelf y --desde');
  const cutoff = madridMidnight(DESDE);
  console.log(APPLY ? '*** MODO APLICAR: se escribirá en Firestore ***' : 'Modo informe (no se escribe nada). Usa --apply para aplicar.');
  console.log(`Estantería ${SHELF}: se quita lo ubicado antes del ${DESDE} (hora de Madrid = ${cutoff.toISOString()} UTC)\n`);

  const snap = await db.collection('items').where('active', '==', true).get();
  const inShelf = [];
  snap.forEach((d) => {
    const it = d.data();
    const locationId = String((it.locationIds || [])[0] || '');
    if (locationId.split('-')[0] !== SHELF) return;
    inShelf.push({ id: d.id, data: it, locationId, position: locationId.split('-').slice(1).join('-') });
  });
  const toRemove = inShelf.filter((p) => !p.data.locatedAt || new Date(p.data.locatedAt) < cutoff);
  const toKeep = inShelf.filter((p) => !toRemove.includes(p));

  const byPos = (list) => list.reduce((acc, p) => { acc[p.position] = (acc[p.position] || 0) + 1; return acc; }, {});
  const byMonth = (list) => list.reduce((acc, p) => { const m = String(p.data.locatedAt || 'sin fecha').slice(0, 7); acc[m] = (acc[m] || 0) + 1; return acc; }, {});
  console.log(`Presencias activas en ${SHELF}: ${inShelf.length}`);
  console.log(`  Se QUITAN: ${toRemove.length}  por mes ${JSON.stringify(byMonth(toRemove))}  por hueco ${JSON.stringify(byPos(toRemove))}`);
  console.log(`  Se QUEDAN: ${toKeep.length}  por hueco ${JSON.stringify(byPos(toKeep))}`);
  console.log('\nSe quedan (ubicadas desde el corte):');
  for (const p of toKeep.sort((a, b) => a.position.localeCompare(b.position))) {
    console.log(`  ${p.locationId}  ${p.data.articleCode} | ${p.data.orderFab}  (${String(p.data.locatedAt).slice(0, 10)})`);
  }

  if (!APPLY || toRemove.length === 0) {
    console.log(APPLY ? '\nNada que hacer.' : '\nNo se ha escrito nada.');
    return;
  }

  // Copia de seguridad completa ANTES de escribir.
  const locIds = [...new Set(toRemove.map((p) => p.position))];
  const locBackup = {};
  for (const pos of locIds) {
    const s = await db.collection('shelves').doc(SHELF).collection('locations').doc(pos).get();
    locBackup[pos] = s.exists ? s.data() : null;
  }
  const aggKeys = [...new Set(toRemove.map((p) => p.data.aggregateKey).filter(Boolean))];
  const aggBackup = {};
  for (const k of aggKeys) {
    const s = await db.collection('itemAggregates').doc(k).get();
    aggBackup[k] = s.exists ? s.data() : null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.resolve(__dirname, `../backup_limpieza-${SHELF}-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    shelf: SHELF, desde: DESDE, cutoff: cutoff.toISOString(), createdAt: new Date().toISOString(),
    presences: toRemove.map((p) => ({ id: p.id, data: p.data })),
    locations: locBackup, aggregates: aggBackup,
  }, null, 2));
  console.log(`\nCopia de seguridad: ${backupFile}`);

  const now = new Date().toISOString();
  let done = 0;
  for (const p of toRemove) {
    const presenceRef = db.collection('items').doc(p.id);
    const locRef = db.collection('shelves').doc(SHELF).collection('locations').doc(p.position);
    const aggRef = p.data.aggregateKey ? db.collection('itemAggregates').doc(p.data.aggregateKey) : null;
    const presenceId = p.data.presenceId || p.id;
    await db.runTransaction(async (tx) => {
      const [pSnap, lSnap, aSnap] = await Promise.all([
        tx.get(presenceRef), tx.get(locRef), aggRef ? tx.get(aggRef) : Promise.resolve(null),
      ]);
      if (!pSnap.exists || pSnap.data().active === false) return; // ya retirada por otro
      if (lSnap.exists) {
        const items = (lSnap.data().items || []).filter((it) => it.presenceId !== presenceId);
        tx.set(locRef, { position: p.position, items, isEmpty: items.length === 0 }, { merge: true });
      }
      tx.update(presenceRef, { active: false, removedAt: now, removedBy: REMOVED_BY, removedReason: `Limpieza: ubicado antes del ${DESDE}`, locationIds: [] });
      if (aSnap && aSnap.exists) {
        const ids = (aSnap.data().activePresenceIds || []).filter((id) => id !== presenceId && id !== p.id);
        tx.set(aggRef, { activePresenceIds: ids, totalActivePresences: ids.length, updatedAt: now }, { merge: true });
      }
      const hRef = db.collection('history').doc();
      tx.set(hRef, {
        id: hRef.id, action: 'LIMPIEZA_INVENTARIO', articleCode: p.data.articleCode, orderFab: p.data.orderFab,
        fromLocation: p.locationId, toLocation: null, shelfCode: SHELF,
        operarioId: REMOVED_BY, operarioName: ACTOR_NAME, user: ACTOR_NAME, role: 'ADMIN',
        timestamp: now, source: 'script:limpiar-estanteria', note: `Ubicado ${String(p.data.locatedAt).slice(0, 10)}, antes del ${DESDE}`,
      });
    });
    done++;
    if (done % 50 === 0) console.log(`  … ${done}/${toRemove.length}`);
  }
  console.log(`\nQuitadas ${done} presencias de ${SHELF}. Quedan ${toKeep.length}.`);
}

async function restore(file) {
  const backup = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  console.log(`Restaurando ${backup.presences.length} presencias de ${backup.shelf} (limpieza ${backup.createdAt})`);
  const now = new Date().toISOString();
  for (const { id, data } of backup.presences) {
    const presenceRef = db.collection('items').doc(id);
    const position = String((data.locationIds || [])[0] || '').split('-').slice(1).join('-');
    const locRef = db.collection('shelves').doc(backup.shelf).collection('locations').doc(position);
    const aggRef = data.aggregateKey ? db.collection('itemAggregates').doc(data.aggregateKey) : null;
    const presenceId = data.presenceId || id;
    const originalItem = ((backup.locations[position] || {}).items || []).find((it) => it.presenceId === presenceId);
    await db.runTransaction(async (tx) => {
      const [pSnap, lSnap, aSnap] = await Promise.all([
        tx.get(presenceRef), tx.get(locRef), aggRef ? tx.get(aggRef) : Promise.resolve(null),
      ]);
      if (!pSnap.exists || pSnap.data().removedBy !== REMOVED_BY) return; // solo lo que quitó la limpieza
      tx.set(presenceRef, { ...data, restoredAt: now });
      const items = lSnap.exists ? (lSnap.data().items || []) : [];
      if (originalItem && !items.some((it) => it.presenceId === presenceId)) {
        tx.set(locRef, { position, items: [...items, originalItem], isEmpty: false }, { merge: true });
      }
      if (aggRef) {
        const ids = Array.from(new Set([...(aSnap && aSnap.exists ? aSnap.data().activePresenceIds || [] : []), presenceId]));
        tx.set(aggRef, { activePresenceIds: ids, totalActivePresences: ids.length, updatedAt: now }, { merge: true });
      }
    });
  }
  console.log('Restaurado.');
}

(RESTORE ? restore(RESTORE) : clean())
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
