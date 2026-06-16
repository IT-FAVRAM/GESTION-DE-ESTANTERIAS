import { admin } from './src/firebaseAdmin';

const registerKiosk = async () => {
  const db = admin.firestore();
  const deviceId = 'device_1781612490504_ral0ku';
  
  try {
    await db.collection('dispositivos').doc(deviceId).set({
      id: deviceId,
      deviceName: 'Kiosko REPASADO',
      deviceType: 'KIOSK',
      assignedShelf: 'REP',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    }, { merge: true });
    
    console.log(`✅ Dispositivo ${deviceId} registrado como Kiosko REPASADO`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

registerKiosk();
