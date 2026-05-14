import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD5rfL-blONmlS8eIu2N4Z4JNlpEUYOhRA",
  authDomain: "finance2026-6bcda.firebaseapp.com",
  projectId: "finance2026-6bcda",
  storageBucket: "finance2026-6bcda.firebasestorage.app",
  messagingSenderId: "621145612611",
  appId: "1:621145612611:web:01bdeaf02045944214cff6",
  measurementId: "G-CLKZN9LYEF"
};

// 1. Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// 2. Exporta as instâncias
export const db = getFirestore(app);
export const auth = getAuth(app);

let userLogado = null;

// --- MONITOR DE ESTADO DE LOGIN ---
onAuthStateChanged(auth, (user) => {
  const authContainer = document.getElementById('auth-container');
  if (user) {
    userLogado = user;
    if (authContainer) authContainer.style.display = 'none';
    dbListenFirestore(user.uid);
  } else {
    userLogado = null;
    if (authContainer) authContainer.style.display = 'flex';
  }
});

// --- LÓGICA DE CADASTRO / LOGIN ---
let modoLogin = true;

// O listener de clique deve estar fora de funções para registrar assim que o script carregar
const toggleLink = document.getElementById('toggle-auth-link');
if (toggleLink) {
  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    modoLogin = !modoLogin;
    document.getElementById('auth-title').textContent = modoLogin ? 'Bem-vindo de volta' : 'Criar Nova Conta';
    document.getElementById('btn-auth-primary').textContent = modoLogin ? 'Entrar' : 'Cadastrar';
    toggleLink.textContent = modoLogin ? 'Criar conta grátis' : 'Já tenho conta';
  });
}

document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  try {
    if (modoLogin) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    alert("Erro: " + error.message);
  }
});

// Função para deslogar (você pode chamar no clique de um botão "Sair")
export async function logOut() {
  await signOut(auth);
}

// --- FUNÇÕES DE BANCO DE DADOS ---
export async function addTransaction(data) {
  if (!userLogado) return;

  try {
    await addDoc(collection(db, "transactions"), {
      ...data,
      userId: userLogado.uid,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Erro ao salvar:", e);
  }
}

function dbListenFirestore(userId) {
  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId)
  );

  onSnapshot(q, (snapshot) => {
    // transactions aqui deve ser a variável global do seu index.js 
    // ou você pode disparar um evento customizado
    window.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (typeof atualizarDashboard === "function") {
      atualizarDashboard();
    }
  });
}