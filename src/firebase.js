import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Aquelas informações que apareceram quando você registrou o App Web
const firebaseConfig = {
   apiKey: "AIzaSyD5rfL-blONmlS8eIu2N4Z4JNlpEUYOhRA",
  authDomain: "finance2026-6bcda.firebaseapp.com",
  projectId: "finance2026-6bcda",
  storageBucket: "finance2026-6bcda.firebasestorage.app",
  messagingSenderId: "621145612611",
  appId: "1:621145612611:web:01bdeaf02045944214cff6",
  measurementId: "G-CLKZN9LYEF"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o banco de dados para usarmos no index.js
export const db = getFirestore(app);