#!/usr/bin/env node

/**
 * Generate Firebase Cloud Messaging VAPID Key Pair
 * Ejecuta: node generate-vapid.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Función para generar par de claves VAPID
function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'der'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der'
    }
  });

  // Convertir a base64 URL-safe
  const publicKeyBase64 = publicKey.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const privateKeyBase64 = privateKey.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return {
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64
  };
}

try {
  const keys = generateVapidKeys();

  console.log('\n✅ VAPID Key Pair Generated Successfully!\n');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('🔑 PUBLIC KEY (VITE_FIREBASE_VAPID_KEY):');
  console.log(`\n${keys.publicKey}\n`);
  console.log('───────────────────────────────────────────────────────\n');
  console.log('🔐 PRIVATE KEY (para Firebase Admin / Backend):');
  console.log(`\n${keys.privateKey}\n`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Guardar en archivo .env.keys.json como backup
  const keysFile = path.join(__dirname, '.env.keys.json');
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
  console.log(`✅ Keys guardadas en: ${keysFile}\n`);

  // Mostrar comando para agregar a .env.local
  console.log('📝 Agregar a tu .env.local:\n');
  console.log(`VITE_FIREBASE_VAPID_KEY=${keys.publicKey}\n`);

} catch (error) {
  console.error('❌ Error generando VAPID keys:', error.message);
  process.exit(1);
}
