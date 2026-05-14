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
window.filtrarPorCategoria = (categoria) => {
  // 1. Mudamos para a aba de transações se não estivermos nela
  const tabTransacoes = document.querySelector('[data-tab="transacoes"]');
  if (tabTransacoes) tabTransacoes.click();

  // 2. Aguarda um tempo mínimo para a aba renderizar
  setTimeout(() => {
    const itens = document.querySelectorAll('.tx-item');
    let primeiroItemencontrado = null;

    itens.forEach(item => {
      // Verifica se o texto da categoria está dentro do item
      if (item.innerText.includes(categoria)) {
        if (!primeiroItemencontrado) primeiroItemencontrado = item;

        // Define a cor do brilho baseado no tipo (Receita ou Despesa)
        const eReceita = item.querySelector('.tx-val--income');
        item.style.setProperty('--cor-destaque', eReceita ? '#00FFB2' : '#FF6B35');

        // Adiciona o brilho
        item.classList.add('tx-highlight');

        // Remove o brilho após 2 segundos
        setTimeout(() => {
          item.classList.remove('tx-highlight');
        }, 2000);
      }
    });

    // 3. Rola a tela até o primeiro item encontrado
    if (primeiroItemencontrado) {
      primeiroItemencontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
};

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
  const select = document.getElementById('filtro-mes');
  let dadosExibicao = transactions;

  // 1. Lógica de Filtro por Mês
  if (select && select.value) {
    dadosExibicao = transactions.filter(t => {
      const d = new Date(t.createdAt?.seconds ? t.createdAt.seconds * 1000 : t.createdAt);

      const [ano, mes] = select.value.split('-').map(Number);

      return d.getFullYear() === ano && d.getMonth() === mes;
    });
  }

  // 2. Cálculos de Totais
  let receitaTotal = 0;
  let despesaEssencial = 0; // Gastos fixos/essenciais
  let reserva = 0;         // Caixinhas/Investimentos

  dadosExibicao.forEach(t => {
    if (t.type === 'income') {
      receitaTotal += t.val;
    } else if (t.type === 'expense') {
      despesaEssencial += t.val;
    } else if (t.type === 'goal') {
      reserva += t.val;
    }
  });

  const saldoFinal = receitaTotal - despesaEssencial - reserva;

  // 3. Atualização dos Cards Básicos (Aba Transações)
  const elMesReceita = document.getElementById('mes-receita');
  const elMesDespesa = document.getElementById('mes-despesa');
  const elMesSaldo = document.getElementById('mes-saldo');

  if (elMesReceita) elMesReceita.textContent = formatBRL(receitaTotal);
  if (elMesDespesa) elMesDespesa.textContent = formatBRL(despesaEssencial);
  if (elMesSaldo) elMesSaldo.textContent = formatBRL(saldoFinal);

  // 4. Interface de Metas 70/20/10 (Substituindo Saldo Livre)
  atualizarMetasIA(receitaTotal, despesaEssencial, reserva);

  // 5. Atualização da Taxa de Poupança (Ponto 5 do seu pedido)
  const displayPoupanca = document.getElementById('display-poupanca');
  const msgPoupanca = document.getElementById('msg-poupanca');

  if (displayPoupanca) {
    const taxa = receitaTotal > 0 ? ((receitaTotal - despesaEssencial) / receitaTotal * 100).toFixed(1) : 0;
    displayPoupanca.textContent = `${taxa}%`;

    if (msgPoupanca) {
      if (taxa >= 20) {
        msgPoupanca.textContent = "🚀 Excelente! Você está poupando acima da meta.";
        msgPoupanca.style.color = "#00FFB2";
      } else if (taxa > 0) {
        msgPoupanca.textContent = "Keep going! Tente reduzir gastos para chegar em 20%.";
        msgPoupanca.style.color = "#FFD700";
      } else {
        msgPoupanca.textContent = "Atenção: Suas despesas estão consumindo toda a renda.";
        msgPoupanca.style.color = "#FF6B35";
      }
    }
  }

  // 6. Sincronização com outros componentes
  renderListaTransacoes(dadosExibicao);
  renderCategoriasGrafico(dadosExibicao);
}

/**
 * Função auxiliar para a lógica visual das metas (Ponto 6)
 */
function atualizarMetasIA(receita, despesa, reserva) {
  const container = document.getElementById('metas-container');
  if (!container) return;

  if (receita === 0) {
    container.innerHTML = '<p style="opacity:0.5">Aguardando registros para calcular metas...</p>';
    return;
  }

  const pEssencial = ((despesa / receita) * 100).toFixed(1);
  const pReserva = ((reserva / receita) * 100).toFixed(1);

  const corEssencial = pEssencial > 70 ? "#FF6B35" : "#00FFB2";

  container.innerHTML = `
    <div class="meta-item" style="margin-bottom: 12px;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
        <span>Gastos Essenciais (Meta 70%)</span>
        <span style="color:${corEssencial}">${pEssencial}%</span>
      </div>
      <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:4px;">
        <div style="width:${Math.min(pEssencial, 100)}%; background:${corEssencial}; height:100%; border-radius:4px; transition: 0.5s;"></div>
      </div>
    </div>

    <div class="meta-item">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
        <span>Reserva/Investimentos (Meta 20%)</span>
        <span style="color:#00D1FF">${pReserva}%</span>
      </div>
      <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:4px;">
        <div style="width:${Math.min(pReserva, 100)}%; background:#00D1FF; height:100%; border-radius:4px; transition: 0.5s;"></div>
      </div>
    </div>
  `;
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

  const selectMes = document.getElementById('filtro-mes');
  if (selectMes) {
    selectMes.addEventListener('change', () => {
      console.log("Mês alterado para:", selectMes.value);
      atualizarDashboard();
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

  window.onclick = (event) => {
    const modal = document.getElementById('modal-registro');
    if (event.target === modal) {
      window.fecharModal();
    }
  };

  // 4. Inicia a escuta do Banco
  dbListenFirestore();
});