import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy
} from "firebase/firestore";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  browserLocalPersistence
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD5rfL-blONmlS8eIu2N4Z4JNlpEUYOhRA",
  authDomain: "finance2026-6bcda.firebaseapp.com",
  projectId: "finance2026-6bcda",
  storageBucket: "finance2026-6bcda.firebasestorage.app",
  messagingSenderId: "621145612611",
  appId: "1:621145612611:web:01bdeaf02045944214cff6"
};

const appFirebase = initializeApp(firebaseConfig);

export const db = getFirestore(appFirebase);
export const auth = getAuth(appFirebase);

/* ========================================
   AUTH STATE
======================================== */

let unsubscribeTransactions = null;

onAuthStateChanged(auth, (user) => {

  const authContainer = document.getElementById('auth-container');
  const app = document.getElementById('app');

  if (user) {

    console.log("Usuário logado:", user.email);

    /* REMOVE LOGIN */
    authContainer?.remove();

    /* MOSTRA APP */
    if (app) {
      app.style.display = 'block';
    }

    /* BODY */
    document.body.classList.add('logged-in');

    /* REMOVE LISTENER ANTIGO */
    if (unsubscribeTransactions) {
      unsubscribeTransactions();
    }

    /* NOVO LISTENER */
    unsubscribeTransactions = dbListenFirestore(user.uid);

  } else {

    console.log("Nenhum usuário logado.");

    /* ESCONDE APP */
    if (app) {
      app.style.display = 'none';
    }

    /* BODY */
    document.body.classList.remove('logged-in');

    /* LIMPA DADOS */
    window.transactions = [];

    /* REMOVE LISTENER */
    if (unsubscribeTransactions) {
      unsubscribeTransactions();
      unsubscribeTransactions = null;
    }
  }
});

/* ========================================
   ADD TRANSACTION
======================================== */

export async function addTransaction(data) {

  if (!auth.currentUser) return;

  try {

    await addDoc(collection(db, "transacoes"), {
      ...data,
      userId: auth.currentUser.uid
    });

  } catch (e) {

    console.error("Erro ao adicionar:", e);

  }
}

/* ========================================
   LISTENER FIRESTORE
======================================== */

export function dbListenFirestore(uid) {

  const q = query(
    collection(db, "transacoes"),
    where("userId", "==", uid),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {

    const txs = [];

    snapshot.forEach(doc => {

      txs.push({
        id: doc.id,
        ...doc.data()
      });

    });

    window.transactions = txs;

    /* DASHBOARD */
    if (window.atualizarDashboard) {
      window.atualizarDashboard();
    }

    /* GRÁFICO */
    if (window.meuGrafico && window.atualizarGrafico) {
      window.atualizarGrafico(window.meuGrafico, txs);
    }

  }, (error) => {

    console.error("Erro Firestore:", error);

  });
}