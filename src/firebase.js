import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD5rfL-blONmlS8eIu2N4Z4JNlpEUYOhRA",
  authDomain: "finance2026-6bcda.firebaseapp.com",
  projectId: "finance2026-6bcda",
  storageBucket: "finance2026-6bcda.firebasestorage.app",
  messagingSenderId: "621145612611",
  appId: "1:621145612611:web:01bdeaf02045944214cff6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  const authContainer = document.getElementById('auth-container');
  const app = document.getElementById('app');

  if (user) {
    console.log("Usuário logado:", user.email);

    authContainer?.remove();

    if (app) {
      app.style.display = 'block';
    }

    document.body.classList.add('logged-in');

    dbListenFirestore(user.uid);
  }
  else {
    console.log("Nenhum usuário logado.");

    // Mostra o login e remove o conteúdo
    if (app) {
      app.style.display = 'none';
    }

    document.body.classList.remove('logged-in');
  }
});

export async function addTransaction(data) {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, "transacoes"), {
      ...data,
      userId: auth.currentUser.uid
    });
  } catch (e) { console.error(e); }
}

export function dbListenFirestore(uid) {
  const q = query(
    collection(db, "transacoes"),
    where("userId", "==", uid),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const txs = [];
    snapshot.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));
    window.transactions = txs;
    if (window.atualizarDashboard) window.atualizarDashboard();
    if (window.meuGrafico && window.atualizarGrafico) window.atualizarGrafico(window.meuGrafico, txs);
  });
}