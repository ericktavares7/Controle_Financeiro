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
  signInWithEmailAndPassword,
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

export async function login(email, senha) {

  try {

    const credencial = await signInWithEmailAndPassword(
      auth,
      email,
      senha
    );

    return credencial.user;

  } catch (error) {

    console.error("ERRO LOGIN:", error);

    alert(error.message);
  }
}

onAuthStateChanged(auth, (user) => {

  const authContainer = document.getElementById('auth-container');
  const app = document.getElementById('app');

  if (user) {

    console.log("Usuário logado:", user.email);

    /* ESCONDE LOGIN */
    if (authContainer) {
      authContainer.style.display = 'none';
    }

    /* MOSTRA APP */
    if (app) {
      app.style.display = 'block';
    }

    document.body.classList.add('logged-in');

    /* REMOVE LISTENER ANTIGO */
    if (unsubscribeTransactions) {
      unsubscribeTransactions();
    }

    /* NOVO LISTENER */
    unsubscribeTransactions = dbListenFirestore(user.uid);

  } else {

    console.log("Nenhum usuário logado.");

    /* MOSTRA LOGIN */
    if (authContainer) {
      authContainer.style.display = 'flex';
    }

    /* ESCONDE APP */
    if (app) {
      app.style.display = 'none';
    }

    document.body.classList.remove('logged-in');

    window.transactions = [];

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