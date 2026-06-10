const admin = require('../APP/backend/node_modules/firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccount.json'))
});

async function checkDevices() {
  console.log('--- Revisando dispositivos registrados ---');
  const snapshot = await admin.firestore().collection('dispositivos').get();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.assignedShelf === 'PRE' || data.assignedShelf === 'MEC') {
      console.log(`Dispositivo encontrado: ${doc.id}`);
      console.log(`  - Nombre: ${data.name || data.nombre || 'N/A'}`);
      console.log(`  - Tipo: ${data.type || 'N/A'}`);
      console.log(`  - Estanteria actual: ${data.assignedShelf}`);
      
      await doc.ref.update({ assignedShelf: 'PME' });
      console.log(`  ✅ Actualizado a: PME\n`);
      count++;
    }
  }
  
  console.log(`\nRevisión completada. Se han actualizado ${count} dispositivos a PME.`);
  process.exit(0);
}

checkDevices();
