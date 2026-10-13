/**
 * unify-of.cjs — Unifica las OFs mal tecleadas de las piezas ubicadas (C2).
 *
 * "OF26-0461 9", "OF26--03910", "OF26-5315"… son la misma OF que la forma
 * canónica "OFyy-nnnnn", pero al formar parte de la identidad de la pieza
 * (aggregateKey) el sistema las trataba como piezas distintas. Desde el commit
 * que añade canonicalOrderFab, las nuevas se guardan bien; este script arregla
 * las que ya estaban guardadas.
 *
 * Solo toca presencias ACTIVAS cuya OF parezca un número de OF mal escrito.
 * El texto libre ("OF- RECHAZO SEDECAL", "OF26-VARIOS") no se toca.
 *
 * Por cada presencia afectada actualiza, en una transacción:
 *   - items/{presenceId}: orderFab + aggregateKey
 *   - todas las locations que contienen esa presencia (incluidas las gemelas
 *     de las urgentes compartidas): orderFab del ítem
 *   - itemAggregates: la saca del agregado viejo y la mete en el nuevo
 *
 * Uso (desde la raiz del repo):
 *   node herramientas/servidor/utilidades/unify-of.cjs            → SOLO INFORME, no escribe nada
 *   node herramientas/servidor/utilidades/unify-of.cjs --apply    → aplica los cambios
 */
const path = require('path');
const fs = require('fs');
const admin = require('../../../servidor/node_modules/firebase-admin');

const APPLY = process.argv.includes('--apply');

const saPath = [
  path.resolve(__dirname, '../../../serviceAccount.json'),
  path.resolve(process.cwd(), 'serviceAccount.json'),
].find((p) => fs.existsSync(p));
admin.initializeApp(saPath ? { credential: admin.credential.cert(require(saPath)) } : undefined);
const db = admin.firestore();

// Espejo de backend/src/ofNormalize.ts
const OF_PATTERN = /^OF(\d{2})[-_]*(\d{1,5})$/;
const canonicalOrderFab = (raw) => {
  const upper = String(raw || '').trim().toUpperCase();
  const match = OF_PATTERN.exec(upper.replace(/\s+/g, ''));
  if (!match || Number(match[2]) === 0) return upper;
  return `OF${match[1]}-${match[2].padStart(5, '0')}`;
};
const norm = (v) => String(v || '').trim().toUpperCase();
const aggKey = (articleCode, orderFab) => `${norm(articleCode)}__${norm(orderFab)}`;

async function main() {
  console.log(APPLY ? '*** MODO APLICAR: se escribirá en Firestore ***' : 'Modo informe (no se escribe nada). Usa --apply para aplicar.');

  // 1) Presencias activas con OF no canónica
  const itemsSnap = await db.collection('items').where('active', '==', true).get();
  const affected = [];
  const canonicalExisting = new Set(); // aggregateKeys canónicas ya presentes
  itemsSnap.forEach((d) => {
    const it = d.data();
    const of = String(it.orderFab || '');
    const canon = canonicalOrderFab(of);
    if (canon === norm(of)) {
      canonicalExisting.add(aggKey(it.articleCode, of));
      return;
    }
    affected.push({ ref: d.ref, id: d.id, data: it, from: of, to: canon });
  });

  // 2) Índice presenceId → locations que la contienen. collectionGroup: muchos
  //    documentos shelves/{code} no existen como tales (solo su subcolección).
  const locsByPresence = new Map();
  const allLocs = await db.collectionGroup('locations').get();
  allLocs.forEach((loc) => {
    for (const item of loc.data().items || []) {
      if (!item.presenceId) continue;
      if (!locsByPresence.has(item.presenceId)) locsByPresence.set(item.presenceId, []);
      locsByPresence.get(item.presenceId).push(loc.ref);
    }
  });

  // OFs que empiezan como un número de OF pero no lo son (p. ej. el artículo
  // pegado detrás: "OF26-0556524165"). No se pueden arreglar solas.
  const suspicious = [];
  itemsSnap.forEach((d) => {
    const it = d.data();
    const compact = norm(it.orderFab).replace(/\s+/g, '');
    if (/^OF\d{2}[-_]*\d{6,}$/.test(compact)) suspicious.push({ id: d.id, it });
  });

  console.log(`\nPresencias activas: ${itemsSnap.size}. Con OF mal escrita: ${affected.length}\n`);
  for (const a of affected) {
    const newKey = aggKey(a.data.articleCode, a.to);
    const merges = canonicalExisting.has(newKey) ? '  ← se une a una pieza que ya existe con la OF bien escrita' : '';
    const locs = (locsByPresence.get(a.id) || []).map((r) => `${r.parent.parent.id}-${r.id}`).join(', ') || '(sin location)';
    console.log(`  ${a.data.articleCode} | "${a.from}" → "${a.to}"  en ${locs}${merges}`);
  }

  if (suspicious.length > 0) {
    console.log(`\nRevisar a mano (${suspicious.length}): la OF tiene más de 5 dígitos, no se toca:`);
    for (const { id, it } of suspicious) {
      const locs = (locsByPresence.get(id) || []).map((r) => `${r.parent.parent.id}-${r.id}`).join(', ');
      console.log(`  ${it.articleCode} | "${it.orderFab}"  en ${locs}`);
    }
  }

  if (!APPLY || affected.length === 0) {
    console.log(APPLY ? '\nNada que hacer.' : '\nNo se ha escrito nada.');
    return;
  }

  let done = 0;
  for (const a of affected) {
    const oldKey = String(a.data.aggregateKey || aggKey(a.data.articleCode, a.from));
    const newKey = aggKey(a.data.articleCode, a.to);
    const locRefs = locsByPresence.get(a.id) || [];
    await db.runTransaction(async (tx) => {
      const oldAggRef = db.collection('itemAggregates').doc(oldKey);
      const newAggRef = db.collection('itemAggregates').doc(newKey);
      const [oldAgg, newAgg, ...locSnaps] = await Promise.all([
        tx.get(oldAggRef), tx.get(newAggRef), ...locRefs.map((r) => tx.get(r)),
      ]);
      const now = new Date().toISOString();

      tx.update(a.ref, { orderFab: a.to, aggregateKey: newKey, ofUnifiedFrom: a.from, ofUnifiedAt: now });

      locSnaps.forEach((snap, i) => {
        if (!snap.exists) return;
        const items = (snap.data().items || []).map((it) =>
          it.presenceId === a.id ? { ...it, orderFab: a.to } : it);
        tx.update(locRefs[i], { items });
      });

      if (oldAgg.exists) {
        const ids = (oldAgg.data().activePresenceIds || []).filter((id) => id !== a.id);
        tx.set(oldAggRef, { activePresenceIds: ids, totalActivePresences: ids.length, updatedAt: now }, { merge: true });
      }
      const newIds = Array.from(new Set([...(newAgg.exists ? newAgg.data().activePresenceIds || [] : []), a.id]));
      // Mismos campos que escribe shelfOperate ubicar al crear el agregado.
      tx.set(newAggRef, newAgg.exists
        ? { activePresenceIds: newIds, totalActivePresences: newIds.length, updatedAt: now }
        : { aggregateKey: newKey, articleCode: a.data.articleCode, orderFab: a.to, activePresenceIds: newIds, totalActivePresences: newIds.length, totalPlacements: 1, updatedAt: now },
      { merge: true });
    });
    done++;
  }
  console.log(`\nUnificadas ${done} presencias.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
