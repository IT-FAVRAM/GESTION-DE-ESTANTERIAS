const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mapeo viejo -> nuevo para Autoplegadora (RPL)
// Old Estanteria 1 (3 columnas): 1 a 21
// Old Estanteria 2 (2 columnas): 22 a 35
// New Estanteria 2 (2 columnas): 1 a 14
// New Estanteria 1 (3 columnas): 15 a 35

function getNewPosition(oldNum) {
  if (oldNum >= 1 && oldNum <= 21) {
    return oldNum + 14;
  } else if (oldNum >= 22 && oldNum <= 35) {
    return oldNum - 21;
  }
  return oldNum; // Por si acaso
}

async function run() {
  console.log('Iniciando migración de Autoplegadora (RPL)...');
  const shelfCode = 'RPL';
  
  // 1. Obtener todas las locations actuales de RPL
  const locationsRef = db.collection('shelves').doc(shelfCode).collection('locations');
  const snapshot = await locationsRef.get();
  
  const oldLocations = snapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  
  console.log(`Encontradas ${oldLocations.length} locations en RPL.`);
  
  // Vamos a hacer una copia de seguridad en memoria
  const backup = {};
  for (const loc of oldLocations) {
    backup[loc.id] = loc.data;
  }
  
  // 2. Borrar las ubicaciones actuales
  console.log('Borrando ubicaciones actuales...');
  const batch1 = db.batch();
  for (const loc of oldLocations) {
    batch1.delete(locationsRef.doc(loc.id));
  }
  await batch1.commit();
  console.log('Borradas.');

  // 3. Crear las nuevas ubicaciones remapeadas
  console.log('Creando ubicaciones remapeadas...');
  const batch2 = db.batch();
  for (const loc of oldLocations) {
    const oldNumStr = loc.id;
    const oldNum = parseInt(oldNumStr, 10);
    if (isNaN(oldNum)) {
       console.log(`Saltando ${oldNumStr} porque no es un numero`);
       batch2.set(locationsRef.doc(loc.id), loc.data);
       continue;
    }
    
    const newNum = getNewPosition(oldNum);
    const newNumStr = newNum.toString().padStart(3, '0');
    
    const newData = { ...loc.data, position: newNumStr };
    
    console.log(`Migrando ${oldNumStr} -> ${newNumStr}`);
    batch2.set(locationsRef.doc(newNumStr), newData);
  }
  await batch2.commit();
  console.log('Ubicaciones migradas.');
  
  // 4. Actualizar la colección "items" (presences)
  console.log('Actualizando colección items...');
  const itemsSnapshot = await db.collection('items')
    .where('shelfCode', '==', shelfCode)
    .get();
    
  let itemsUpdated = 0;
  const batch3 = db.batch();
  for (const doc of itemsSnapshot.docs) {
    const data = doc.data();
    let changed = false;
    let newLocationIds = [...(data.locationIds || [])];
    let newShelfCodes = [...(data.shelfCodes || [])]; // Should stay same but check
    
    for (let i = 0; i < newLocationIds.length; i++) {
      const locId = newLocationIds[i]; // RPL-006
      if (locId.startsWith('RPL-')) {
        const numStr = locId.substring(4);
        const oldNum = parseInt(numStr, 10);
        if (!isNaN(oldNum)) {
          const newNum = getNewPosition(oldNum);
          const newNumStr = newNum.toString().padStart(3, '0');
          newLocationIds[i] = `RPL-${newNumStr}`;
          changed = true;
        }
      }
    }
    
    if (changed) {
      batch3.update(doc.ref, { locationIds: newLocationIds });
      itemsUpdated++;
    }
  }
  
  if (itemsUpdated > 0) {
    await batch3.commit();
  }
  
  console.log(`Migrados ${itemsUpdated} items.`);
  
  // 5. Historial (opcional pero recomendado)
  // No vamos a tocar el historial para no romper cosas viejas, o podríamos
  
  console.log('Migración completada con éxito.');
}

run().catch(console.error);
