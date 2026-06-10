"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWeeklyReport = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const TELEGRAM_API = 'https://api.telegram.org/bot';
async function sendMessage(chatId, text, token) {
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        }),
    });
}
async function getAllowedChatIds() {
    var _a;
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('telegram').get();
    if (!configDoc.exists) {
        return [];
    }
    return ((_a = configDoc.data()) === null || _a === void 0 ? void 0 : _a.allowedChatIds) || [];
}
async function generateReport() {
    const db = admin.firestore();
    const lines = [];
    lines.push('📊 <b>REPORTE SEMANAL WMS</b>');
    lines.push(`📅 ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push('');
    const shelvesSnap = await db.collection('shelves').get();
    let totalItems = 0;
    lines.push('<b>📦 Ocupación por estantería:</b>');
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
            const pct = Math.round((shelfItems / Math.max(locSnap.size, 1)) * 100);
            lines.push(`  • ${shelfCode}: ${shelfItems} artículos (${locSnap.size} posiciones, ${pct}% ocupación)`);
        }
    }
    lines.push(`\n  <b>Total: ${totalItems} artículos</b>`);
    lines.push('');
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const stale7Snap = await db.collection('items')
        .where('active', '==', true)
        .where('locatedAt', '<', sevenDaysAgo)
        .count()
        .get();
    const stale30Snap = await db.collection('items')
        .where('active', '==', true)
        .where('locatedAt', '<', thirtyDaysAgo)
        .count()
        .get();
    lines.push('<b>⚠️  Antigüedad de artículos:</b>');
    lines.push(`  • >7 días: ${stale7Snap.data().count} artículos`);
    lines.push(`  • >30 días: ${stale30Snap.data().count} artículos`);
    lines.push('');
    const calLocSnap = await db.collection('shelves').doc('CAL').collection('locations').get();
    let reprocessCount = 0;
    let totalReprocessCost = 0;
    calLocSnap.docs.forEach(doc => {
        const items = doc.data().items || [];
        items.forEach((item) => {
            reprocessCount++;
            totalReprocessCost += (item.unitCost || 0) * (item.quantity || 1);
        });
    });
    lines.push('<b>🔧 Reprocesos CAL:</b>');
    lines.push(`  • Total: ${reprocessCount} artículos`);
    lines.push(`  • Importe estimado: ${totalReprocessCost.toFixed(2)} €`);
    return lines.join('\n');
}
exports.telegramWeeklyReport = functions.pubsub.schedule('0 8 * * 1')
    .timeZone('Europe/Madrid')
    .onRun(async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatIds = await getAllowedChatIds();
    if (chatIds.length === 0) {
        functions.logger.warn('No allowed chat IDs for weekly report');
        return;
    }
    const report = await generateReport();
    for (const chatId of chatIds) {
        try {
            await sendMessage(chatId, report, token);
            functions.logger.info(`Weekly report sent to chat ${chatId}`);
        }
        catch (err) {
            functions.logger.error(`Failed to send report to chat ${chatId}:`, err);
        }
    }
});
//# sourceMappingURL=report.js.map