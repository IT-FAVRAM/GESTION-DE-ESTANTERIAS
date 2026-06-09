import express from 'express';
import { config } from './config';
import { initFirestore } from './firestore';
import { sendMessage } from './openwa';
import { processMessage } from './ai';

initFirestore();

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, bot: 'favram-wms' }));

app.post('/webhook', async (req, res) => {
  // Responder 200 inmediatamente para que OpenWA no reintente
  res.sendStatus(200);

  const { event, payload } = req.body as { event?: string; payload?: Record<string, unknown> };

  if (event !== 'message.received' || !payload) return;
  if (payload.fromMe) return;
  if (payload.type !== 'chat') return; // ignorar mensajes de voz, imágenes, etc.

  const sender = String(payload.from ?? '');
  const text = String(payload.body ?? '').trim();

  if (!text) return;

  // Control de acceso: solo el número autorizado
  if (!sender.includes(config.authorizedPhone)) {
    console.log(`[bot] Ignorado — no autorizado: ${sender}`);
    return;
  }

  console.log(`[bot] ← ${sender}: ${text}`);

  try {
    const reply = await processMessage(text);
    await sendMessage(sender, reply);
    console.log(`[bot] → ${reply}`);
  } catch (err) {
    console.error('[bot] Error procesando mensaje:', err);
    try {
      await sendMessage(sender, 'Ha ocurrido un error. Por favor, inténtalo de nuevo.');
    } catch { /* si falla el envío del error, no hacer nada */ }
  }
});

app.listen(config.webhookPort, () => {
  console.log(`\n🤖 Bot WMS Favram arrancado`);
  console.log(`   Webhook:    http://localhost:${config.webhookPort}/webhook`);
  console.log(`   OpenWA:     ${config.openwaUrl}`);
  console.log(`   Autorizado: ${config.authorizedPhone}\n`);
});
