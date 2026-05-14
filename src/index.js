import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import './transactions.css';
import './responsive.css';
import logoImg from './assets/logo_finance.png';
import Chart from 'chart.js/auto';
import { db } from './firebase.js';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";

// --- VARIÁVEIS GLOBAIS ---
let transactions = [];
let grafico;

// --- FUNÇÕES DE BANCO DE DADOS ---

async function dbLoadFirestore() {
  try {
    const q = query(collection(db, "transacoes"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const transacoesSincronizadas = [];
    querySnapshot.forEach((doc) => {
      transacoesSincronizadas.push({ id: doc.id, ...doc.data() });
    });
    return transacoesSincronizadas;
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
    return [];
  }
}

async function dbAdd(novaTransacao) {
  try {
    const docRef = await addDoc(collection(db, "transacoes"), {
      ...novaTransacao,
      createdAt: new Date()
    });
    return { id: docRef.id, ...novaTransacao };
  } catch (e) {
    console.error("Erro ao salvar:", e);
    return null;
  }
}

async function dbRemoveFirestore(id) {
  try {
    await deleteDoc(doc(db, "transacoes", id));
    return true;
  } catch (e) {
    return false;
  }
}

// --- NAVEGAÇÃO E MODAL (EXPOSTOS PARA O WINDOW) ---

window.abrirModal = (tipo) => {
  const inputTipo = document.getElementById('input-tipo');
  const modal = document.getElementById('modal-registro');
  if (inputTipo && modal) {
    inputTipo.value = tipo;
    modal.classList.add('active');
  }
};

window.fecharModal = () => {
  document.getElementById('modal-registro')?.classList.remove('active');
};

window.irParaTransacoes = (e) => {
  if (e) e.preventDefault();
  document.getElementById('dashboard-section').style.display = 'none';
  document.getElementById('transactions-section').style.display = 'block';
};

window.irParaDashboard = (e) => {
  if (e) e.preventDefault();
  document.getElementById('transactions-section').style.display = 'none';
  document.getElementById('dashboard-section').style.display = 'block';
};

// --- UTILITÁRIOS ---

function formatBRL(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR');
}

// --- RENDERIZAÇÃO ---

function renderListaTransacoes(listaFiltrada) {
  const lista = document.getElementById('transaction-list');
  if (!lista) return;

  lista.innerHTML = listaFiltrada.length === 0
    ? '<p style="text-align:center;padding:24px;">Nenhuma transação encontrada.</p>'
    : listaFiltrada.map(t => `
        <div class="tx-item">
          <div class="tx-info">
            <span class="tx-desc">${t.desc}</span>
            <span class="tx-meta">${t.cat} · ${formatDate(t.date)}</span>
          </div>
          <div class="tx-right">
            <span class="tx-val ${t.type === 'income' ? 'tx-val--income' : 'tx-val--expense'}">
              ${t.type === 'income' ? '+' : '−'}${formatBRL(t.val)}
            </span>
            <button class="tx-delete" data-id="${t.id}">✕</button>
          </div>
        </div>`).join('');

  // Event Delegation para deletar
  lista.querySelectorAll('.tx-delete').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Excluir transação?')) {
        if (await dbRemoveFirestore(id)) {
          transactions = transactions.filter(t => t.id !== id);
          atualizarDashboard();
        }
      }
    };
  });
}

function atualizarDashboard() {
  const select = document.getElementById('filtro-mes');
  let dadosExibicao = transactions;

  if (select && select.value) {
    const [ano, mes] = select.value.split('-').map(Number);
    dadosExibicao = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === ano && d.getMonth() === mes;
    });
  }

  // Cálculos Básicos
  let receita = 0, despesa = 0;
  dadosExibicao.forEach(t => {
    if (t.type === 'income') receita += t.val;
    else despesa += t.val;
  });

  // Atualiza KPIs
  const elSaldo = document.getElementById('display-saldo');
  if (elSaldo) {
    elSaldo.textContent = formatBRL(receita - despesa);
    elSaldo.style.color = (receita - despesa) >= 0 ? '#00FFB2' : '#FF6B35';
  }

  renderListaTransacoes(dadosExibicao);
  if (grafico) atualizarGrafico(grafico, transactions);
}

function atualizarGrafico(chart, todasTransactions) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const agora = new Date();
  const ultimos5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (4 - i), 1);
    return { label: meses[d.getMonth()], ano: d.getFullYear(), mes: d.getMonth() };
  });

  chart.data.labels = ultimos5.map(m => m.label);
  chart.data.datasets[0].data = ultimos5.map(m =>
    todasTransactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === m.mes).reduce((s, t) => s + t.val, 0)
  );
  chart.data.datasets[1].data = ultimos5.map(m =>
    todasTransactions.filter(t => t.type === 'income' && new Date(t.date).getMonth() === m.mes).reduce((s, t) => s + t.val, 0)
  );
  chart.update();
}

// --- INICIALIZAÇÃO ---

document.addEventListener('DOMContentLoaded', async () => {
  transactions = await dbLoadFirestore();

  const logo = document.getElementById('main-logo');
  if (logo) logo.src = logoImg;

  const ctx = document.getElementById('mainEvolutionChart')?.getContext('2d');
  if (ctx) {
    grafico = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Despesas', data: [], borderColor: '#FF6B35', tension: 0.4 },
          { label: 'Receitas', data: [], borderColor: '#00FFB2', tension: 0.4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const form = document.getElementById('form-transacao');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nova = {
      desc: document.getElementById('input-desc').value,
      val: parseFloat(document.getElementById('input-val').value),
      type: document.getElementById('input-tipo').value,
      cat: document.getElementById('input-cat').value,
      date: document.getElementById('input-data').value ? new Date(document.getElementById('input-data').value + 'T00:00').toISOString() : new Date().toISOString()
    };

    const salva = await dbAdd(nova);
    if (salva) {
      transactions = [salva, ...transactions];
      atualizarDashboard();
      form.reset();
      window.fecharModal();
    }


  });

  document.getElementById('filtro-mes')?.addEventListener('change', atualizarDashboard);

  // --- LÓGICA DE ABAS ---

  const botoesTab = document.querySelectorAll('.tab-btn');
  botoesTab.forEach(btn => {
    btn.addEventListener('click', () => {
      const abaAlvo = btn.getAttribute('data-tab');

      // Estilo do botão
      botoesTab.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Troca de telas (Ajuste os IDs conforme seu HTML)
      const secaoOverview = document.getElementById('tab-overview');
      const secaoTransacoes = document.getElementById('tab-transacoes');
      const secaoIA = document.getElementById('tab-ia');

      if (secaoOverview) secaoOverview.style.display = 'none';
      if (secaoTransacoes) secaoTransacoes.style.display = 'none';
      if (secaoIA) secaoIA.style.display = 'none';

      if (abaAlvo === 'overview' && secaoOverview) {
        secaoOverview.style.display = 'block';
      } else if (abaAlvo === 'transacoes' && secaoTransacoes) {
        secaoTransacoes.style.display = 'block';
      } else if (abaAlvo === 'ia' && secaoIA) {
        secaoIA.style.display = 'block';
      }
    });
  });

  atualizarDashboard();
});