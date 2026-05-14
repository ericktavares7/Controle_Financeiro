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
  const modalContent = modal?.querySelector('.modal-content');

  if (modalContent) {
    modalContent.classList.remove('tipo-income', 'tipo-expense', 'tipo-goal');
    modalContent.classList.add(`tipo-${tipo}`);
  }
  
  const groupDespesas = document.getElementById('group-despesas');
  const groupReceitas = document.getElementById('group-receitas');
  const groupCaixinhas = document.getElementById('group-caixinhas');
  const selectCat = document.getElementById('input-cat');

  if (inputTipo && modal) {
    inputTipo.value = tipo;

    if (groupDespesas) groupDespesas.style.display = (tipo === 'expense') ? 'block' : 'none';
    if (groupReceitas) groupReceitas.style.display = (tipo === 'income') ? 'block' : 'none';
    if (groupCaixinhas) groupCaixinhas.style.display = (tipo === 'goal') ? 'block' : 'none';

    if (selectCat) {
      selectCat.value = (tipo === 'income') ? 'Salário' : (tipo === 'goal' ? 'Reserva de Emergência' : 'Alimentação');
    }

    modal.classList.add('active');
  }
};

window.fecharModal = () => {
  const modal = document.getElementById('modal-registro');
  if (modal) modal.classList.remove('active');
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
    ? '<p style="text-align:center;padding:24px;">Nenhuma transação.</p>'
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

  // Evento de clique na lista (APENAS para deletar)
  lista.onclick = async (event) => {
    const botaoExcluir = event.target.closest('.tx-delete');
    if (botaoExcluir) {
      const id = botaoExcluir.getAttribute('data-id');
      if (confirm('Deseja realmente excluir esta transação?')) {
        const sucesso = await dbRemoveFirestore(id);
        if (sucesso) {
          transactions = transactions.filter(t => t.id !== id);
          atualizarDashboard();
        }
      }
    }
  };
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
  // 1. BUSCA DADOS INICIAIS
  transactions = await dbLoadFirestore();

  // 2. CONFIGURA O LOGO
  const logo = document.getElementById('main-logo');
  if (logo) logo.src = logoImg;

  // 3. INICIALIZA O GRÁFICO
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

  // 4. LÓGICA DE ABAS (Troca de telas)
  const botoesTab = document.querySelectorAll('.tab-btn');
  botoesTab.forEach(btn => {
    btn.addEventListener('click', () => {
      const abaAlvo = btn.getAttribute('data-tab');

      botoesTab.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const secaoOverview = document.getElementById('tab-overview');
      const secaoTransacoes = document.getElementById('tab-transacoes');
      const secaoIA = document.getElementById('tab-ia');

      if (secaoOverview) secaoOverview.style.display = (abaAlvo === 'overview') ? 'block' : 'none';
      if (secaoTransacoes) secaoTransacoes.style.display = (abaAlvo === 'transacoes') ? 'block' : 'none';
      if (secaoIA) secaoIA.style.display = (abaAlvo === 'ia') ? 'block' : 'none';
    });
  });

  // 5. CONFIGURAÇÃO DOS BOTÕES GLOBAIS
  const btnFechar = document.getElementById('fechar-modal');
  if (btnFechar) btnFechar.onclick = () => window.fecharModal();

  const btnAddReceita = document.getElementById('dash-card-receita');
  const btnAddDespesa = document.getElementById('dash-card-despesa');
  const btnAddCaixinha = document.getElementById('dash-card-caixinhas');

  if (btnAddReceita) btnAddReceita.onclick = () => window.abrirModal('income');
  if (btnAddDespesa) btnAddDespesa.onclick = () => window.abrirModal('expense');
  if (btnAddCaixinha) btnAddCaixinha.onclick = () => window.abrirModal('goal');

  // Para ao clicar no fundo o card fechar.
  const modal = document.getElementById('modal-registro');

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      window.fecharModal();
    }
  });

  // 6. FORMULÁRIO DE ENVIO
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

  // 7. FILTRO DE MÊS
  document.getElementById('filtro-mes')?.addEventListener('change', atualizarDashboard);

  // 8. COMANDO FINAL: DESENHA TUDO NA TELA
  atualizarDashboard();
});