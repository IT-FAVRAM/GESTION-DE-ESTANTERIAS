"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumenGeneral = exports.resumenSeccion = exports.verUbicacion = exports.buscarArticulo = void 0;
const admin = require("firebase-admin");
const normalize = (v) => (v || '').trim().toUpperCase();
/** Busca artículos por código en la colección items */
async function buscarArticulo(query) {
    const db = admin.firestore();
    const q = normalize(query);
    const itemsSnap = await db.collection('items')
        .where('active', '==', true)
        .where('articleCode', '>=', q)
        .where('articleCode', '<=', q + '\uf8ff')
        .limit(5)
        .get();
    if (itemsSnap.empty) {
        const itemsSnap2 = await db.collection('items')
            .where('active', '==', true)
            .where('orderFab', '>=', q)
            .where('orderFab', '<=', q + '\uf8ff')
            .limit(5)
            .get();
        if (itemsSnap2.empty) {
            return `No se encontraron artículos con "${query}".`;
        }
        return formatItems(itemsSnap2.docs);
    }
    return formatItems(itemsSnap.docs);
}
exports.buscarArticulo = buscarArticulo;
function formatItems(docs) {
    const lines = docs.map(doc => {
        const d = doc.data();
        const locs = (d.locationIds || []).join(', ') || 'sin ubicación';
        return `📦 ${d.articleCode} | OF: ${d.orderFab}\n   📍 ${locs}${d.quantity ? ` | Cant: ${d.quantity}` : ''}`;
    });
    return lines.join('\n\n');
}
/** Ver la ubicación de una posición concreta */
async function verUbicacion(shelfCode, position) {
    const db = admin.firestore();
    const shelf = normalize(shelfCode);
    const locSnap = await db.collection('shelves').doc(shelf).collection('locations').doc(position).get();
    if (!locSnap.exists) {
        return `La posición ${shelf}-${position} no existe o está vacía.`;
    }
    const data = locSnap.data();
    const items = data.items || [];
    if (items.length === 0) {
        return `📍 ${shelf}-${position}: vacía`;
    }
    const lines = items.map((item) => `  📦 ${item.articleCode} | OF: ${item.orderFab}${item.quantity ? ` | Cant: ${item.quantity}` : ''}`);
    return `📍 ${shelf}-${position} (${items.length} artículo(s)):\n${lines.join('\n')}`;
}
exports.verUbicacion = verUbicacion;
/** Resumen de una sección */
async function resumenSeccion(seccion) {
    const db = admin.firestore();
    const sec = normalize(seccion);
    const SECTION_SHELVES = {
        MECANIZADO: ['MEC'],
        PRENSAS: ['PRE'],
        PRENSAS_MECANIZADO: ['MEC', 'PRE'],
        SOLDADURA: ['SOL', 'RSO', 'SXP'],
        REPASADO: ['REP', 'ZIN'],
        PINTURA: ['PIN'],
        CALIDAD: ['CAL'],
        PLEGADORA: ['PLE'],
        LASER: ['LASER'],
    };
    const shelves = SECTION_SHELVES[sec] || [];
    if (shelves.length === 0) {
        return `Sección "${seccion}" no reconocida. Secciones: MECANIZADO, PRENSAS, PRENSAS_MECANIZADO, SOLDADURA, REPASADO, PINTURA, CALIDAD, PLEGADORA, LASER`;
    }
    let totalItems = 0;
    let totalLocations = 0;
    const details = [];
    for (const shelf of shelves) {
        const locSnap = await db.collection('shelves').doc(shelf).collection('locations').get();
        let shelfItems = 0;
        locSnap.docs.forEach(doc => {
            const items = doc.data().items || [];
            shelfItems += items.length;
        });
        totalLocations += locSnap.size;
        totalItems += shelfItems;
        details.push(`  📦 ${shelf}: ${shelfItems} artículos en ${locSnap.size} posiciones`);
    }
    return `📊 Resumen ${seccion}:\n${details.join('\n')}\n\nTotal: ${totalItems} artículos en ${totalLocations} posiciones`;
}
exports.resumenSeccion = resumenSeccion;
/** Resumen general de todas las estanterías */
async function resumenGeneral() {
    const db = admin.firestore();
    const shelvesSnap = await db.collection('shelves').get();
    const lines = [];
    let totalItems = 0;
    for (const shelfDoc of shelvesSnap.docs) {
        const shelfCode = shelfDoc.id;
        const locSnap = await db.collection('shelves').doc(shelfCode).collection('locations').get();
        let shelfItems = 0;
        locSnap.docs.forEach(doc => {
            const items = doc.data().items || [];
            shelfItems += items.length;
        });
        totalItems += shelfItems;
        if (shelfItems > 0) {
            lines.push(`  📦 ${shelfCode}: ${shelfItems} artículos`);
        }
    }
    // Items > 7 días
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const staleSnap = await db.collection('items')
        .where('active', '==', true)
        .where('locatedAt', '<', sevenDaysAgo)
        .count()
        .get();
    return `📊 Resumen General WMS:\n\n${lines.join('\n')}\n\n📦 Total: ${totalItems} artículos\n⚠️  >7 días: ${staleSnap.data().count} artículos`;
}
exports.resumenGeneral = resumenGeneral;
//# sourceMappingURL=queries.js.map