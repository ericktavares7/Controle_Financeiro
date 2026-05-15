import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

// 1. Configuração do seu Firebase (Mantenha suas chaves aqui)
const firebaseConfig = {
  apiKey: "AIzaSyD5rfL-blONmlS8eIu2N4Z4JNlpEUYOhRA",
  authDomain: "finance2026-6bcda.firebaseapp.com",
  projectId: "finance2026-6bcda",
  storageBucket: "finance2026-6bcda.firebasestorage.app",
  messagingSenderId: "621145612611",
  appId: "1:621145612611:web:01bdeaf02045944214cff6",
  measurementId: "G-CLKZN9LYEF"
};

// 2. Inicialização das Instâncias
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Variável de controle local para o usuário logado
let userLogado = null;
let unsubscribe = null;
// --- MONITOR DE ESTADO DE LOGIN ---

onAuthStateChanged(auth, (user) => {
  const authContainer = document.getElementById('auth-container');
  const body = document.body;

  if (user) {
    // 1. Se já houver um escuta ativo de outra conta, desliga-o primeiro
    if (unsubscribe && typeof unsubscribe === "function") unsubscribe();

    userLogado = user;
    if (authContainer) authContainer.style.display = 'none';
    body.classList.add('logged-in');

    // 2. Guarda o novo "interruptor"
    unsubscribe = dbListenFirestore(user.uid);
  } else {
    if (unsubscribe && typeof unsubscribe === "function") {
      unsubscribe();
      unsubscribe = null;
    }
    userLogado = null;
    if (authContainer) authContainer.style.display = 'flex';
    body.classList.remove('logged-in');
  }
});

/**
 * Função para deslogar o usuário
 */
export async function logOut() {
  try {
    const confirmacao = confirm("Deseja realmente sair?");
    if (confirmacao) {
      await signOut(auth);
      // LIMPEZA CRÍTICA: Remove os dados da memória ao sair
      window.transactions = [];
      if (typeof window.atualizarDashboard === "function") {
        window.atualizarDashboard();
      }
    }
  } catch (error) {
    console.error("Erro ao deslogar:", error);
  }
}

// Vincula ao window para que o 'onclick' do botão no HTML funcione
window.logOut = logOut;

// Lógica para alternar entre as telas de "Login" e "Cadastro" no mesmo Card
let modoLogin = true;
const toggleLink = document.getElementById('toggle-auth-link');

if (toggleLink) {
  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    modoLogin = !modoLogin;

    // Atualiza os textos da interface
    document.getElementById('auth-title').textContent = modoLogin ? 'Bem-vindo de volta' : 'Criar Nova Conta';
    document.getElementById('btn-auth-primary').textContent = modoLogin ? 'Entrar' : 'Cadastrar';
    toggleLink.textContent = modoLogin ? 'Criar conta grátis' : 'Já tenho conta';
  });
}

// Escuta o envio do formulário de Login/Cadastro
document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  try {
    if (modoLogin) {
      // Tenta fazer login
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      // Tenta criar nova conta
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    // Alerta de erro amigável (ex: senha incorreta ou e-mail já cadastrado)
    alert("Erro na Autenticação: " + error.message);
  }
});

// --- FUNÇÕES DE BANCO DE DADOS (FIRESTORE) ---

/**
 * Adiciona uma nova transação vinculada ao ID do usuário atual
 */
export async function addTransaction(data) {
  if (!auth.currentUser) return;

  try {
    await addDoc(collection(db, "transacoes"), {
      ...data,
      userId: auth.currentUser.uid, // Verifique se esta linha existe!
      createdAt: serverTimestamp()
    });
    console.log("Transação enviada com sucesso!");
  } catch (e) {
    console.error("Erro ao salvar:", e);
  }
}

export function dbListenFirestore(uid) {
  const q = query(collection(db, "users", uid, "transactions"), orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    const todasTransactions = [];
    snapshot.forEach((doc) => {
      todasTransactions.push({ id: doc.id, ...doc.data() });
    });

    atualizarInterface(todasTransactions);

    if (window.meuGrafico) {
      atualizarGrafico(window.meuGrafico, todasTransactions);
    }
  });
}