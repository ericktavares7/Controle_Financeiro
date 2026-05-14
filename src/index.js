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
let ordemCrescente = null;

// --- FUNÇÕES DE BANCO DE DADOS (FIREBASE) ---

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
    console.log("✅ Salvo na nuvem com ID:", docRef.id);
    // Retorna o objeto com o ID gerado pelo Firebase
    return { id: docRef.id, ...novaTransacao };
  } catch (e) {
    console.error("❌ Erro ao salvar no Firebase:", e);
    return null;
  }
}

async function dbRemoveFirestore(id) {
  try {
    await deleteDoc(doc(db, "transacoes", id));
    console.log("🗑️ Removido do Firebase");
    return true;
  } catch (e) {
    console.error("Erro ao remover:", e);
    return false;
  }
}

// --- UTILITÁRIOS ---

function formatBRL(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR');
}

function calcTotais(transactions) {
  let receita = 0; let despesa = 0; let caixinha = 0;
  transactions.forEach(t => {
    const valor = Number(t.val || t.amount || 0);
    const tipo = String(t.type || t.tipo || '').toLowerCase().trim();
    if (tipo === 'income' || tipo === 'receita') receita += valor;
    else if (tipo === 'expense' || tipo === 'despesa' || tipo === 'saving') despesa += valor;
    else if (tipo === 'goal' || tipo === 'caixinha') caixinha += valor;
  });
  return {
    receita, despesa, saldo: receita - despesa, caixinha,
    poupanca: receita > 0 ? Math.round(((receita - despesa) / receita) * 100) : 0
  };
}

function calcPorCategoria(transactions) {
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const nomeExibicao = t.cat.startsWith('Cartão') ? 'Cartão de Crédito' : t.cat;
      if (!acc[nomeExibicao]) acc[nomeExibicao] = { total: 0, original: t.cat };
      acc[nomeExibicao].total += t.val;
      return acc;
    }, {});
}

// --- RENDERIZAÇÃO DA INTERFACE ---

function renderKPIs({ receita, despesa, saldo, poupanca }) {
  const elSaldo = document.getElementById('display-saldo');
  if (elSaldo) {
    elSaldo.textContent = formatBRL(saldo);
    elSaldo.style.color = saldo >= 0 ? 'var(--entradas)' : 'var(--saidas)';
  }
  const elPoupanca = document.getElementById('display-poupanca');
  if (elPoupanca) elPoupanca.textContent = `${poupanca}%`;
}

function renderListaTransacoes(transactions) {
  const getIconeTx = (t) => {
    const tipo = String(t.type).toLowerCase();
    if (tipo === 'goal' || tipo === 'caixinha') return '🚀';
    if (t.cat && t.cat.includes('Cartão')) return '💳';
    return tipo === 'income' || tipo === 'receita' ? '↑' : '↓';
  };

  const html = transactions.length === 0
    ? '<p style="color:var(--txt_secondario);text-align:center;padding:24px 0;">Nenhuma transação.</p>'
    : transactions.map(t => `
        <div class="tx-item">
          <div class="tx-info">
            <span class="tx-desc">${t.desc}</span>
            <span class="tx-meta">${t.cat} · ${formatDate(t.date)}</span>
          </div>
          <div class="tx-right">
            <span class="tx-val ${t.type === 'income' ? 'tx-val--income' : 'tx-val--expense'}">
              ${t.type === 'income' ? '+' : '−'}${formatBRL(t.val)}
            </span>
            <button class="tx-delete" data-id="${t.id}" title="Remover">✕</button>
          </div>
        </div>`).join('');

  const lista = document.getElementById('transaction-list');
  if (lista) {
    lista.innerHTML = html;
    // Adiciona evento de clique nos botões de deletar
    lista.querySelectorAll('.tx-delete').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Excluir transação?')) {
          const sucesso = await dbRemoveFirestore(id);
          if (sucesso) {
            transactions = transactions.filter(t => t.id !== id);
            atualizarDashboard(grafico, transactions);
          }
        }
      };
    });
  }
}

function renderBarrasCategorias(transactions) {
  const catEl = document.getElementById('mes-categorias');
  if (!catEl) return;
  const totaisCat = calcPorCategoria(transactions);
  const entradas = Object.entries(totaisCat);
  
  if (entradas.length === 0) {
    catEl.innerHTML = '<p>Nenhuma despesa.</p>';
    return;
  }

  const maximo = Math.max(...entradas.map(([, d]) => d.total));
  catEl.innerHTML = entradas.map(([nome, dados]) => {
    const pct = ((dados.total / maximo) * 100).toFixed(1);
    return `
      <div class="bar-item">
        <div class="bar-info"><span>${nome}</span><span>${formatBRL(dados.total)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

// --- LÓGICA DO GRÁFICO ---

function atualizarGrafico(chart, transactions) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const agora = new Date();
  const ultimos5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (4 - i), 1);
    return { label: meses[d.getMonth()], ano: d.getFullYear(), mes: d.getMonth() };
  });

  const datasets = [
    { label: 'Despesas', type: 'expense', color: '#FF6B35' },
    { label: 'Receitas', type: 'income', color: '#00FFB2' }
  ].map(ds => ({
    label: ds.label,
    borderColor: ds.color,
    data: ultimos5.map(({ ano, mes }) => 
      transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === ds.type && d.getFullYear() === ano && d.getMonth() === mes;
      }).reduce((s, t) => s + t.val, 0)
    )
  }));

  chart.data.labels = ultimos5.map(m => m.label);
  chart.data.datasets[0].data = datasets[0].data;
  chart.data.datasets[1].data = datasets[1].data;
  chart.update();
}

// --- LÓGICA CENTRAL ---

function atualizarDashboard(chart, todasTransactions) {
  const select = document.getElementById('filtro-mes');
  let dadosParaExibir = todasTransactions;

  if (select && select.value) {
    const [ano, mes] = select.value.split('-').map(Number);
    dadosParaExibir = todasTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === ano && d.getMonth() === mes;
    });
  }

  const totais = calcTotais(dadosParaExibir);
  renderKPIs(totais);
  renderBarrasCategorias(dadosParaExibir);
  renderListaTransacoes(dadosParaExibir);
  if (chart) atualizarGrafico(chart, todasTransactions);
}

// --- INICIALIZAÇÃO DO APP ---

document.addEventListener('DOMContentLoaded', async () => {
  // 1. CARREGAR DADOS DA NUVEM
  transactions = await dbLoadFirestore();
  document.title = "Finance Simplefy";

  // 2. CONFIGURAR INTERFACE (LOGO E MÊS)
  const logo = document.getElementById('main-logo');
  if (logo) logo.src = logoImg;

  const selectMes = document.getElementById('filtro-mes');
  const hoje = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  if (selectMes && !selectMes.value) selectMes.value = hoje;

  // 3. INICIALIZAR GRÁFICO (CHART.JS)
  const ctx = document.getElementById('mainEvolutionChart')?.getContext('2d');
  if (ctx) {
    grafico = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Despesas', data: [], borderColor: '#FF6B35', tension: 0.4 },
        { label: 'Receitas', data: [], borderColor: '#00FFB2', tension: 0.4 }
      ]},
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // 4. EVENTO DO FORMULÁRIO (SALVAR)
  const form = document.getElementById('form-transacao');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('input-desc').value;
    const val = parseFloat(document.getElementById('input-val').value);
    const type = document.getElementById('input-tipo').value;
    const cat = document.getElementById('input-cat').value;
    const dateInput = document.getElementById('input-data').value;

    if (!desc || isNaN(val)) return alert("Preencha os campos!");

    const nova = {
      desc, val, type, cat,
      date: dateInput ? new Date(dateInput + 'T00:00').toISOString() : new Date().toISOString()
    };

    const transacaoSalva = await dbAdd(nova);
    if (transacaoSalva) {
      transactions = [transacaoSalva, ...transactions];
      atualizarDashboard(grafico, transactions);
      form.reset();
      document.getElementById('modal-registro')?.classList.remove('active');
    }
  });

  // 5. EVENTOS DE FILTRO E ABAS
  selectMes?.addEventListener('change', () => atualizarDashboard(grafico, transactions));
  
  // BOTÕES PARA ABRIR MODAL
  const abrirModal = (tipo) => {
    document.getElementById('input-tipo').value = tipo;
    document.getElementById('modal-registro').classList.add('active');
  };
  document.getElementById('dash-card-receita')?.onclick = () => abrirModal('income');
  document.getElementById('dash-card-despesa')?.onclick = () => abrirModal('expense');

  // 6. RENDERIZAR TUDO
  atualizarDashboard(grafico, transactions);
});