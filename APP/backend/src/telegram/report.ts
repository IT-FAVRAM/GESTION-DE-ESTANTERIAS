import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { TELEGRAM_BOT_TOKEN } from './secrets';

const TELEGRAM_API = 'https://api.telegram.org/bot';

async function sendMessage(chatId: number, text: string, token: string): Promise<void> {
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

async function getAllowedChatIds(): Promise<number[]> {
  const db = admin.firestore();
  const configDoc = await db.collection('config').doc('telegram').get();

  if (!configDoc.exists) {
    return [];
  }

  return configDoc.data()?.allowedChatIds || [];
}

async function generateReport(): Promise<string> {
  const db = admin.firestore();
  const lines: string[] = [];

  lines.push('📊 <b>REPORTE SEMANAL WMS</b>');
  lines.push(`📅 ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');

  // Resumen por estantería
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

  // Items >7 días y >30 días
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

  // Reprocesos CAL con importes
  const calLocSnap = await db.collection('shelves').doc('CAL').collection('locations').get();
  let reprocessCount = 0;
  let totalReprocessCost = 0;

  calLocSnap.docs.forEach(doc => {
    const items = doc.data().items || [];
    items.forEach((item: any) => {
      reprocessCount++;
      totalReprocessCost += (item.unitCost || 0) * (item.quantity || 1);
    });
  });

  lines.push('<b>🔧 Reprocesos CAL:</b>');
  lines.push(`  • Total: ${reprocessCount} artículos`);
  lines.push(`  • Importe estimado: ${totalReprocessCost.toFixed(2)} €`);

  return lines.join('\n');
}

export const telegramWeeklyReport = onSchedule({
  schedule: '0 8 * * 1',
  timeZone: 'Europe/Madrid',
  secrets: [TELEGRAM_BOT_TOKEN],
}, async () => {
  const token = TELEGRAM_BOT_TOKEN.value();
  const chatIds = await getAllowedChatIds();

  if (chatIds.length === 0) {
    console.warn('No allowed chat IDs for weekly report');
    return;
  }

  const report = await generateReport();

  for (const chatId of chatIds) {
    try {
      await sendMessage(chatId, report, token);
      console.log(`Weekly report sent to chat ${chatId}`);
    } catch (err) {
      console.error(`Failed to send report to chat ${chatId}:`, err);
    }
  }
});
