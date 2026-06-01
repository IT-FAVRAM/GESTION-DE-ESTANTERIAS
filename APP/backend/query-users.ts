import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccountPath = '../../serviceAccount.json';

let serviceAccount: any;
try {
  const data = fs.readFileSync(serviceAccountPath, 'utf-8');
  serviceAccount = JSON.parse(data);
} catch (e) {
  console.log('Using ADC...');
}

const app = initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : {});
const db = getFirestore(app);

(async () => {
  try {
    const usersSnap = await db.collection('usuarios').get();
    const users = usersSnap.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      displayName: doc.data().displayName,
      role: doc.data().role,
    }));
    
    console.log('=== ALL USUARIOS ===');
    users.forEach(u => {
      console.log(`${u.uid.padEnd(30)} | ${u.email?.padEnd(30) || 'N/A'} | ${u.role?.padEnd(15) || 'N/A'} | ${u.displayName || 'N/A'}`);
    });
    
    console.log('\n=== AUTHORIZED USERS (Dani, Luis Asensio, Alberto, Jorge, Juanma) ===');
    const names = ['dani', 'luis', 'asensio', 'alberto', 'jorge', 'juanma', 'favram036'];
    users.forEach(u => {
      const matches = names.some(n => 
        (u.email?.toLowerCase().includes(n)) || 
        (u.displayName?.toLowerCase().includes(n))
      );
      if (matches) {
        console.log(`${u.uid} | ${u.email} | ${u.displayName}`);
      }
    });
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
})();
