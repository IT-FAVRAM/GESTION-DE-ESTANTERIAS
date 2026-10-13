/**
 * seedDatabase — Script para poblar la BD inicial
 * Gestor de Estanterías WMS v3.0
 * 
 * Crea la estructura inicial de estanterías, ubicaciones,
 * configuración, y usuarios en Firestore.
 * 
 * Ejecutar: npx tsx app/scripts/seedDatabase.ts
 * (Requiere firebase-admin configurado)
 */

/**
 * IMPORTANTE: Este script está diseñado para ejecutarse con firebase-admin
 * desde entorno Node.js, NO desde el navegador.
 * 
 * Para usarlo:
 * 1. Instalar firebase-admin: npm install firebase-admin --save-dev
 * 2. Descargar el archivo de credenciales de servicio del proyecto Firebase
 * 3. Configurar la variable GOOGLE_APPLICATION_CREDENTIALS
 * 4. Ejecutar: npx tsx app/scripts/seedDatabase.ts
 * 
 * Alternativa: Ejecutar la lógica de seed desde la app web
 * llamando a la función seedFromBrowser() exportada abajo.
 */

import { 
  doc, setDoc, collection, writeBatch 
} from 'firebase/firestore';
import { db } from '../web/lib/firebaseV3';
import { 
  COLLECTIONS, CONFIG_DOC_ID,
  DEFAULT_APP_CONFIG,
  SHELF_DEFINITIONS, CART_DEFINITIONS,
  type Shelf, type LocationDoc, type DeviceDoc
} from '../web/lib/firestoreSchema';

// ─── Seed Configuration ───

const seedConfig = async () => {
  console.log('📝 Seeding app config...');
  const configRef = doc(db, COLLECTIONS.CONFIG, CONFIG_DOC_ID);
  await setDoc(configRef, DEFAULT_APP_CONFIG);
  console.log('  ✅ Config created');
};

// ─── Seed Shelves + Locations ───

const seedShelf = async (shelf: Shelf) => {
  console.log(`📦 Seeding shelf: ${shelf.code} (${shelf.name})...`);
  
  // Create shelf document
  const shelfRef = doc(db, COLLECTIONS.SHELVES, shelf.code);
  await setDoc(shelfRef, {
    code: shelf.code,
    name: shelf.name,
    section: shelf.section,
    type: shelf.type,
    locationCount: shelf.locationCount,
    layout: shelf.layout,
  });

  // Create location documents in batches (max 500 per batch)
  const BATCH_SIZE = 400;
  let batch = writeBatch(db);
  let count = 0;

  for (let i = 1; i <= shelf.locationCount; i++) {
    const pos = i.toString().padStart(3, '0');
    const locRef = doc(db, COLLECTIONS.SHELVES, shelf.code, COLLECTIONS.LOCATIONS, pos);
    
    const locDoc: LocationDoc = {
      position: pos,
      items: [],
      isEmpty: true,
    };
    
    batch.set(locRef, locDoc);
    count++;
    
    if (count >= BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`  ✅ ${shelf.code}: ${shelf.locationCount} locations created`);
};

const seedAllShelves = async () => {
  for (const shelf of SHELF_DEFINITIONS) {
    await seedShelf(shelf);
  }
  for (const cart of CART_DEFINITIONS) {
    await seedShelf(cart);
  }
};

// ─── Seed Users ───

interface SeedUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'CARRETILLERO' | 'JEFE_SECCION' | 'CALIDAD' | 'ADMIN' | 'SUPERADMIN';
  section?: 'MECANIZADO' | 'PRENSAS' | 'PLEGADORA' | 'SOLDADURA' | 'PINTURA' | 'LASER' | 'REPASADO';
}

const SEED_USERS: SeedUser[] = [
  { uid: 'superadmin_dsoler', email: 'd.soler@favram.com', displayName: 'Daniel Soler', role: 'SUPERADMIN' },
  { uid: 'superadmin_jdiaz', email: 'J.diaz@favram.com', displayName: 'J. Diaz', role: 'SUPERADMIN' },
  { uid: 'admin_jmgomez', email: 'jm.gomez@favram.com', displayName: 'JM. Gómez', role: 'ADMIN' },
  { uid: 'admin_lasensio', email: 'l.asensio@favram.com', displayName: 'L. Asensio', role: 'ADMIN' },
  { uid: 'admin_abarrientos', email: 'a.barrientos@favram.com', displayName: 'A. Barrientos', role: 'ADMIN' },
  { uid: 'carretillero_admin', email: 'administracion@favram.com', displayName: 'Administración', role: 'CARRETILLERO' },
  { uid: 'jefe_hjuvera', email: 'h.juvera@favram.com', displayName: 'H. Juvera', role: 'JEFE_SECCION', section: 'MECANIZADO' },
  { uid: 'jefe_sraboso', email: 's.raboso@favram.com', displayName: 'S. Raboso', role: 'JEFE_SECCION', section: 'PINTURA' },
  { uid: 'jefe_aaguado', email: 'a.aguado@favram.com', displayName: 'A. Aguado', role: 'JEFE_SECCION', section: 'SOLDADURA' },
  { uid: 'jefe_vtorbellino', email: 'v.torbellino@favram.com', displayName: 'V. Torbellino', role: 'JEFE_SECCION', section: 'PLEGADORA' },
  { uid: 'jefe_dfernandez', email: 'd.fernandez@favram.com', displayName: 'D. Fernández', role: 'JEFE_SECCION', section: 'LASER' },
  { uid: 'jefe_jcrodriguez', email: 'jc.rodriguez@favram.com', displayName: 'JC. Rodríguez', role: 'JEFE_SECCION', section: 'REPASADO' },
  { uid: 'jefe_ihernandez', email: 'i.hernandez@favram.com', displayName: 'I. Hernandez', role: 'JEFE_SECCION', section: 'PRENSAS' },
  { uid: 'calidad_compartido', email: 'calidad@favram.com', displayName: 'Calidad', role: 'CALIDAD' },
];

const seedUsers = async () => {
  console.log('👥 Seeding users...');
  
  for (const user of SEED_USERS) {
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      section: user.section || null,
      fcmTokens: [],
      lastLoginAt: null,
    });
    console.log(`  ✅ ${user.email} (${user.role})`);
  }
};

// ─── Seed Devices ───

const SEED_DEVICES: Array<{ id: string; data: DeviceDoc }> = [];

const seedDevices = async () => {
  console.log('📱 Seeding devices...');
  if (SEED_DEVICES.length === 0) {
    console.log('  ℹ️ No se crean dispositivos demo por defecto. Registra navegadores reales o virtuales desde SuperAdmin.');
    return;
  }
  for (const device of SEED_DEVICES) {
    await setDoc(doc(db, COLLECTIONS.DEVICES, device.id), device.data, { merge: true });
    console.log(`  ✅ ${device.data.name}`);
  }
};

// ─── Main Seed Function ───

export const seedFromBrowser = async () => {
  console.log('🚀 Starting database seed...');
  console.log('================================');
  
  try {
    await seedConfig();
    await seedAllShelves();
    await seedUsers();
    await seedDevices();
    
    console.log('================================');
    console.log('✅ Database seed completed!');
    console.log(`  📦 ${SHELF_DEFINITIONS.length} shelves + ${CART_DEFINITIONS.length} carts`);
    console.log(`  👥 ${SEED_USERS.length} users`);
    console.log(`  📱 ${SEED_DEVICES.length} devices`);
    console.log('  ⚙️ App config set');
    
    return true;
  } catch (err) {
    console.error('❌ Seed failed:', err);
    throw err;
  }
};

// Export for direct execution
export default seedFromBrowser;
