/**
 * Ejecutar UNA VEZ para configurar la sesión en OpenWA y el webhook.
 * Uso: npm run setup
 */
import 'dotenv/config';
import axios from 'axios';

const OPENWA_URL = process.env.OPENWA_URL || 'http://localhost:2785';
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || '';
const SESSION_NAME = process.env.OPENWA_SESSION_ID || 'favram-bot';
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || '3001';

const api = axios.create({
  baseURL: OPENWA_URL + '/api',
  headers: { 'X-API-Key': OPENWA_API_KEY, 'Content-Type': 'application/json' },
  timeout: 15_000,
});

async function setup(): Promise<void> {
  console.log('\n=== Setup Bot WMS Favram ===\n');

  if (!OPENWA_API_KEY) {
    console.error('❌ Falta OPENWA_API_KEY en el .env');
    process.exit(1);
  }

  // 1. Crear sesión → capturar el UUID devuelto
  console.log(`1. Creando sesión "${SESSION_NAME}"...`);
  let sessionId: string;
  try {
    const res = await api.post('/sessions', { name: SESSION_NAME });
    sessionId = res.data.id as string;
    console.log(`   ✓ Sesión creada (id: ${sessionId})`);
  } catch (e: any) {
    if (e.response?.status === 409) {
      // Ya existe: buscarla por nombre
      console.log('   ℹ Ya existe, buscando id...');
      const listRes = await api.get('/sessions');
      const sessions: Array<{ id: string; name: string }> = listRes.data?.items ?? listRes.data ?? [];
      const found = sessions.find((s) => s.name === SESSION_NAME);
      if (!found) {
        console.error(`   ✗ No se encontró sesión con nombre "${SESSION_NAME}"`);
        process.exit(1);
      }
      sessionId = found.id;
      console.log(`   ℹ id: ${sessionId}`);
    } else {
      console.error('   ✗ Error:', e.response?.data ?? e.message);
      console.log('\n   ¿Está corriendo OpenWA? Ejecuta: cd OpenWA && npm run dev');
      process.exit(1);
    }
  }

  // Guardar el sessionId en el .env del bot para que index.ts lo use si es necesario
  // (en este proyecto usamos el nombre como sessionId en la ruta, así que guardamos el UUID aparte)

  // 2. Iniciar sesión
  console.log(`2. Iniciando sesión...`);
  try {
    await api.post(`/sessions/${sessionId}/start`);
    console.log('   ✓ Sesión iniciada');
  } catch (e: any) {
    const msg = (e.response?.data?.message ?? e.message) as string;
    if (msg?.toLowerCase().includes('already')) {
      console.log('   ℹ Sesión ya estaba iniciada');
    } else {
      console.log(`   ℹ ${msg}`);
    }
  }

  // 3. Estado / QR
  console.log(`3. Verificando autenticación WhatsApp...`);
  try {
    const statusRes = await api.get(`/sessions/${sessionId}`);
    const status: string = statusRes.data?.status ?? '';
    if (status === 'authenticated' || status === 'connected') {
      console.log('   ✓ WhatsApp ya autenticado');
    } else {
      console.log(`   ⚠ Estado: ${status}`);
      try {
        const qrRes = await api.get(`/sessions/${sessionId}/qr`);
        const qrUrl: string = qrRes.data?.qrUrl ?? qrRes.data?.url ?? '';
        if (qrUrl) {
          console.log(`   → QR disponible: ${qrUrl}`);
        }
      } catch { /* ignorar */ }
      console.log(`   → Escanea el QR desde el dashboard: http://localhost:2886`);
    }
  } catch (e: any) {
    console.log('   ℹ Usa el dashboard para escanear el QR: http://localhost:2886');
  }

  // 4. Configurar webhook usando el UUID de sesión
  const webhookUrl = `http://localhost:${WEBHOOK_PORT}/webhook`;
  console.log(`4. Configurando webhook → ${webhookUrl}...`);
  try {
    await api.post(`/sessions/${sessionId}/webhooks`, {
      url: webhookUrl,
      events: ['message.received'],
    });
    console.log('   ✓ Webhook configurado');
  } catch (e: any) {
    if (e.response?.status === 409) {
      console.log('   ℹ Webhook ya estaba configurado');
    } else {
      console.error('   ✗ Error:', e.response?.data ?? e.message);
    }
  }

  // 5. Actualizar OPENWA_SESSION_ID en el env del bot con el UUID real
  console.log(`5. Actualizando SESSION_ID en bot/.env con UUID...`);
  const { readFileSync, writeFileSync } = await import('fs');
  const { resolve } = await import('path');
  const envPath = resolve(__dirname, '../.env');
  try {
    let envContent = readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /^OPENWA_SESSION_ID=.*/m,
      `OPENWA_SESSION_ID=${sessionId}`,
    );
    writeFileSync(envPath, envContent, 'utf8');
    console.log(`   ✓ OPENWA_SESSION_ID=${sessionId}`);
  } catch (e: any) {
    console.log(`   ℹ No se pudo actualizar el .env: ${e.message}`);
    console.log(`   → Pon manualmente en bot/.env: OPENWA_SESSION_ID=${sessionId}`);
  }

  console.log('\n=== Setup completado ===');
  console.log('Ahora ejecuta el bot: npm run dev');
  console.log('(Asegúrate de que OpenWA sigue corriendo)\n');
}

setup().catch(console.error);
