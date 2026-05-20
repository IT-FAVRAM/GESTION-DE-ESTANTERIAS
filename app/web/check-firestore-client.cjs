const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

// Configuración de Firebase leída del archivo .env.local
const firebaseConfig = {
  apiKey: "AIzaSyARd3U4v2dLciTswSbnaKI2YgXnzUTap70",
  authDomain: "gestion-de-estanterias.firebaseapp.com",
  projectId: "gestion-de-estanterias",
  storageBucket: "gestion-de-estanterias.firebasestorage.app",
  messagingSenderId: "570794350818",
  appId: "1:570794350818:web:ba71424870eb1a87f0e6bb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  try {
    console.log('--- Consultando documento tablets/kiosko-mecanizado ---');
    const tabletRef = doc(db, 'tablets', 'kiosko-mecanizado');
    const tabletSnap = await getDoc(tabletRef);
    if (tabletSnap.exists()) {
      console.log('¡Existe en tablets!');
      console.log(JSON.stringify(tabletSnap.data(), null, 2));
    } else {
      console.log('No existe en la colección "tablets".');
    }

    console.log('\n--- Consultando documento kiosks/kiosko-mecanizado ---');
    const kioskRef = doc(db, 'kiosks', 'kiosko-mecanizado');
    const kioskSnap = await getDoc(kioskRef);
    if (kioskSnap.exists()) {
      console.log('¡Existe en kiosks!');
      console.log(JSON.stringify(kioskSnap.data(), null, 2));
    } else {
      console.log('No existe en la colección "kiosks".');
    }

    console.log('\n--- Consultando colección tablets completa ---');
    const tabletsCol = collection(db, 'tablets');
    const tabletsSnap = await getDocs(tabletsCol);
    tabletsSnap.forEach(d => {
      console.log(`Documento id: ${d.id}`, d.data());
    });

    console.log('\n--- Consultando colección kiosks completa ---');
    const kiosksCol = collection(db, 'kiosks');
    const kiosksSnap = await getDocs(kiosksCol);
    kiosksSnap.forEach(d => {
      console.log(`Documento id: ${d.id}`, d.data());
    });

    console.log('\n--- Consultando colección dispositivos completa ---');
    const dispCol = collection(db, 'dispositivos');
    const dispSnap = await getDocs(dispCol);
    dispSnap.forEach(d => {
      console.log(`Documento id: ${d.id}`, d.data());
    });

    process.exit(0);
  } catch (error) {
    console.error('Error durante la consulta:', error);
    process.exit(1);
  }
}

main();
