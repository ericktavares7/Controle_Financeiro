import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import './transactions.css';
import './responsive.css';
import Chart from 'chart.js/auto';
import { db } from './firebase.js';
import { collection, addDoc, query, orderBy, deleteDoc, doc, onSnapshot } from "firebase/firestore";

// --- VARIÁVEIS GLOBAIS ---
let transactions = [];
let grafico;
let ordemCrescente = false;

window.abrirModal = (tipo) => {
  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  if (modal && inputTipo) {
    inputTipo.value = tipo;
    modal.classList.add('active');
    document.getElementById('input-desc')?.focus();
  }
};

window.fecharModal = () => {
  document.getElementById('modal-registro')?.classList.remove('active');
};

window.deletarTransacao = async (id) => {
  if (confirm('Deseja realmente excluir esta transação?')) {
    await deleteDoc(doc(db, "transacoes", id));
  }
};

// --- FUNÇÕES DE BANCO DE DADOS ---

function dbListenFirestore() {
  const q = query(collection(db, "transacoes"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategoriasGrafico(transactions);
    if (grafico) atualizarGrafico(grafico, transactions);
    atualizarDashboard();
  });
}

/**
 * Adiciona nova transação
 */
async function dbAdd(transacao) {
  try {
    const docRef = await addDoc(collection(db, "transacoes"), transacao);
    return { id: docRef.id, ...transacao };
  } catch (e) {
    console.error("Erro ao salvar no banco:", e);
    return null;
  }
}

/**
 * Remove transação
 */
async function dbRemoveFirestore(id) {
  try {
    await deleteDoc(doc(db, "transacoes", id));
    return true;
  } catch (e) {
    console.error("Erro ao remover:", e);
    return false;
  }
}

// --- UTILITÁRIOS ---

function formatBRL(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }


function formatDate(isoString) {
  if (!isoString) return "--/--/--";
  return new Date(isoString).toLocaleDateString('pt-BR');
}

// --- RENDERIZAÇÃO DA INTERFACE ---

function renderCategoriasGrafico(lista) {
  const containerOverview = document.getElementById('categoryList');
  const containerTransacoes = document.getElementById('mes-categorias'); // Seletor para a outra aba

  if (!containerOverview && !containerTransacoes) return;

  const totais = {};
  lista.forEach(t => {
    if (!totais[t.cat]) totais[t.cat] = { valor: 0, tipo: t.type };
    totais[t.cat].valor += t.val;
  });

  let categoriasArray = Object.entries(totais);
  categoriasArray.sort((a, b) => ordemCrescente ? a[1].valor - b[1].valor : b[1].valor - a[1].valor);

  const maiorValor = Math.max(...categoriasArray.map(c => c[1].valor), 0);
  const cores = { income: '#00FFB2', expense: '#FF6B35', goal: '#00D1FF' };

  const htmlFinal = categoriasArray.map(([cat, info]) => {
    const porcentagem = maiorValor > 0 ? (info.valor / maiorValor) * 100 : 0;
    const corBase = cores[info.tipo] || '#ffffff';
    const gradient = info.tipo === 'income'
      ? 'linear-gradient(90deg, #00FFB2, #00d1ff)'
      : 'linear-gradient(90deg, #FF6B35, #ff4d4d)';

    return `
      <div class="category-bar-item" onclick="filtrarPorCategoria('${cat}')" style="margin-bottom: 16px; cursor:pointer;">
        <div class="bar-info" style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:#ccc; font-size:0.85rem;">${cat}</span>
          <span style="color:#fff; font-weight:bold; font-size:0.85rem;">${formatBRL(info.valor)}</span>
        </div>
        <div class="bar-bg" style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px;">
          <div class="bar-fill" style="width:${porcentagem}%; background:${gradient}; height:100%; border-radius:10px; box-shadow: 0 0 12px ${corBase}33;"></div>
        </div>
      </div>`;
  }).join('');

  if (containerOverview) containerOverview.innerHTML = htmlFinal;
  if (containerTransacoes) containerTransacoes.innerHTML = htmlFinal;
}

function atualizarDashboard() {
  let receita = 0, despesa = 0;
  transactions.forEach(t => {
    if (t.type === 'income') receita += t.val;
    else if (t.type === 'expense') despesa += t.val;
  });

  document.getElementById('display-saldo').textContent = formatBRL(receita - despesa);
  document.getElementById('mes-receita').textContent = formatBRL(receita);
  document.getElementById('mes-despesa').textContent = formatBRL(despesa);
  document.getElementById('mes-saldo').textContent = formatBRL(receita - despesa);

  if (receita > 0) {
    const taxa = Math.max(0, ((receita - despesa) / receita) * 100).toFixed(1);
    document.getElementById('display-poupanca').textContent = `${taxa}%`;
  }

  renderListaTransacoes(transactions);
}

function renderListaTransacoes(listaFiltrada) {
  const containerReceitas = document.getElementById('lista-receitas-historico');
  const containerDespesas = document.getElementById('lista-despesas-historico');

  if (!containerReceitas || !containerDespesas) return;

  const criarTemplate = (t) => {
    const dataMillis = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : t.createdAt;

    return `
      <div class="tx-item">
        <div class="tx-info">
          <span class="tx-desc">${t.desc}</span>
          <span class="tx-meta">${t.cat} · ${formatDate(dataMillis)}</span>
        </div>
        <div class="tx-right">
          <span class="tx-val ${t.type === 'income' ? 'tx-val--income' : 'tx-val--expense'}">
            ${t.type === 'income' ? '+' : '−'}${formatBRL(t.val)}
          </span>
          <button class="tx-delete" onclick="window.deletarTransacao('${t.id}')">✕</button>
        </div>
      </div>`;
  };

  const receitas = listaFiltrada.filter(t => t.type === 'income');
  const despesas = listaFiltrada.filter(t => t.type === 'expense');

  containerReceitas.innerHTML = receitas.length ? receitas.map(criarTemplate).join('') : '<p class="empty-msg" style="text-align:center; opacity:0.5; padding:20px;">Nenhuma receita encontrada.</p>';
  containerDespesas.innerHTML = despesas.length ? despesas.map(criarTemplate).join('') : '<p class="empty-msg" style="text-align:center; opacity:0.5; padding:20px;">Nenhuma despesa encontrada.</p>';
}
function atualizarGrafico(chart, todasTransactions) {
  const mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const ganhos = new Array(6).fill(0);
  const gastos = new Array(6).fill(0);

  todasTransactions.forEach(t => {
    const d = new Date(t.createdAt?.seconds ? t.createdAt.seconds * 1000 : t.createdAt);
    const mesIdx = d.getMonth();
    if (mesIdx < 6) {
      if (t.type === 'income') ganhos[mesIdx] += t.val;
      else if (t.type === 'expense') gastos[mesIdx] += t.val;
    }
  });

  chart.data.datasets[0].data = ganhos;
  chart.data.datasets[1].data = gastos;
  chart.update();
}

// --- MODAL E EVENTOS ---

window.abrirModal = (tipo) => {
  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  const modalContent = modal?.querySelector('.modal-content');

  if (modal && inputTipo) {
    inputTipo.value = tipo;

    if (modalContent) {
      modalContent.classList.remove('borda-receita', 'borda-despesa', 'borda-caixinha');
      if (tipo === 'income') modalContent.classList.add('borda-receita');
      else if (tipo === 'expense') modalContent.classList.add('borda-despesa');
      else if (tipo === 'goal') modalContent.classList.add('borda-caixinha');
    }

    modal.classList.add('active');
    setTimeout(() => document.getElementById('input-desc')?.focus(), 100);
  }
};

// --- INICIALIZAÇÃO ---

document.addEventListener('DOMContentLoaded', () => {

  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`tab-${target}`).classList.add('active');
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 1. Configura o Gráfico
  const ctx = document.getElementById('mainEvolutionChart')?.getContext('2d');
  if (ctx) {
    grafico = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [
          { label: 'Receitas', data: [], borderColor: '#00FFB2', tension: 0.4, fill: true, backgroundColor: 'rgba(0, 255, 178, 0.05)' },
          { label: 'Despesas', data: [], borderColor: '#FF6B35', tension: 0.4, fill: true, backgroundColor: 'rgba(255, 107, 53, 0.05)' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { ticks: { color: '#888' }, grid: { color: '#252540' } },
          x: { ticks: { color: '#888' }, grid: { display: false } }
        },
        plugins: { legend: { labels: { color: '#888' } } }
      }
    });
  }

  // 2. Evento do Formulário
  const form = document.getElementById('form-transacao');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nova = {
      desc: document.getElementById('input-desc').value,
      val: parseFloat(document.getElementById('input-val').value),
      type: document.getElementById('input-tipo').value,
      cat: document.getElementById('input-cat').value,
      createdAt: new Date()
    };

    const salvo = await dbAdd(nova);
    if (salvo) {
      form.reset();
      window.fecharModal();
    }
  });

  // 3. Botão de Ordenação
  document.getElementById('btn-ordenar-valor')?.addEventListener('click', () => {
    ordemCrescente = !ordemCrescente;
    renderCategoriasGrafico(transactions);
  });

  // 4. Inicia a escuta do Banco
  dbListenFirestore();
});