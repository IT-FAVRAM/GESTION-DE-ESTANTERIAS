
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import "firebase/compat/messaging";
import "firebase/compat/functions"; // Add functions import

const firebaseConfig = {
  apiKey: "AIzaSyARd3U4v2dLciTswSbnaKI2YgXnzUTap70",
  authDomain: "gestion-de-estanterias.firebaseapp.com",
  projectId: "gestion-de-estanterias",
  storageBucket: "gestion-de-estanterias.firebasestorage.app",
  messagingSenderId: "570794350818",
  appId: "1:570794350818:web:ba71424870eb1a87f0e6bb",
  measurementId: "G-6VPFSYWH8M",
};

// Initialize Firebase (Compat)
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);

export const db = app.firestore();
export const auth = app.auth();
export const messaging = firebase.messaging.isSupported() ? app.messaging() : null;
export const functions = app.functions(); // Export functions
export default app;
