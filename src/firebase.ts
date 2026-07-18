import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA9dMErhemDU5ez1CapocUvoro-4qU4UMw",
  authDomain: "dom-eduardo.firebaseapp.com",
  projectId: "dom-eduardo",
  storageBucket: "dom-eduardo.firebasestorage.app",
  messagingSenderId: "203602472701",
  appId: "1:203602472701:web:bc98865ea721f952585894"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
