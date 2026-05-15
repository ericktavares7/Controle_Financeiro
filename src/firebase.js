import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

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

let unsubscribe = null;

onAuthStateChanged(auth, (user) => {
  const authContainer = document.getElementById('auth-container');
  if (user) {
    if (authContainer) authContainer.style.display = 'none';
    document.body.classList.add('logged-in');
    unsubscribe = dbListenFirestore(user.uid);
  } else {
    if (unsubscribe) unsubscribe();
    if (authContainer) authContainer.style.display = 'flex';
    document.body.classList.remove('logged-in');
  }
});

export async function addTransaction(data) {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, "transacoes"), {
      ...data,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
  } catch (e) { console.error(e); }
}

export function dbListenFirestore(uid) {
  // ATENÇÃO: Verifique se você criou o ÍNDICE no Firebase console para o orderBy
  const q = query(
    collection(db, "transacoes"),
    where("userId", "==", uid),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const txs = [];
    snapshot.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));

    window.transactions = txs;

    if (typeof window.atualizarDashboard === "function") window.atualizarDashboard();
    if (window.meuGrafico && typeof window.atualizarGrafico === "function") {
      window.atualizarGrafico(window.meuGrafico, txs);
    }
  });
}

// Auth UI Logic
window.logOut = () => signOut(auth);