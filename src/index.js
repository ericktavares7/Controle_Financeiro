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


window.alternarOrdemFiltro = () => {
  ordemCrescente = !ordemCrescente;

  // Atualiza o ícone do botão para dar feedback visual
  const btn = document.getElementById('btn-ordem');
  if (btn) {
    btn.innerHTML = ordemCrescente ? '▲' : '▼';
  }

  // RE-RENDERIZA o dashboard para aplicar a nova ordem
  atualizarDashboard();
};

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
  categoriasArray.sort((a, b) => {
    return ordemCrescente
      ? a[1].valor - b[1].valor  // Menor para Maior
      : b[1].valor - a[1].valor; // Maior para Menor
  });

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
  if (!select) return;

  // 1. Pega o mês e ano selecionados no Select
  const [anoFiltro, mesFiltro] = select.value.split('-').map(Number);

  // 2. Filtra as transações baseadas na escolha do usuário
  const dadosExibicao = transactions.filter(t => {
    // Tratativa para datas do Firestore (Timestamp) ou datas normais
    const d = new Date(t.createdAt?.seconds ? t.createdAt.seconds * 1000 : t.createdAt);
    return d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro;
  });

  // 3. Inicializa os contadores para os cálculos
  let receitaTotal = 0;
  let despesaEssencial = 0; // Gastos comuns
  let reservaCaixinha = 0;  // Gastos marcados como 'goal'

  dadosExibicao.forEach(t => {
    if (t.type === 'income') {
      receitaTotal += t.val;
    } else if (t.type === 'expense') {
      despesaEssencial += t.val;
    } else if (t.type === 'goal') {
      reservaCaixinha += t.val;
    }
  });

  // 4. Cálculos de Saldo e Taxa de Poupança
  const saldoFinal = receitaTotal - despesaEssencial - reservaCaixinha;
  // A poupança real é o que sobra da receita após as despesas essenciais
  const taxaPoupanca = receitaTotal > 0 ? ((receitaTotal - despesaEssencial) / receitaTotal * 100).toFixed(1) : 0;

  // 5. Atualiza os Cards de Valor na Aba Transações
  const elMesReceita = document.getElementById('mes-receita');
  const elMesDespesa = document.getElementById('mes-despesa');
  const elMesSaldo = document.getElementById('mes-saldo');

  if (elMesReceita) elMesReceita.textContent = formatBRL(receitaTotal);
  if (elMesDespesa) elMesDespesa.textContent = formatBRL(despesaEssencial);
  if (elMesSaldo) elMesSaldo.textContent = formatBRL(saldoFinal);

  // 6. Atualiza o Card da Taxa de Poupança (Com mensagens dinâmicas)
  const displayPoupanca = document.getElementById('display-poupanca');
  const msgPoupanca = document.getElementById('msg-poupanca');

  if (displayPoupanca) {
    displayPoupanca.textContent = `${taxaPoupanca}%`;
    if (msgPoupanca) {
      if (taxaPoupanca >= 20) {
        msgPoupanca.textContent = "🚀 Excelente! Você está poupando acima da meta.";
        msgPoupanca.style.color = "#00FFB2";
      } else if (taxaPoupanca > 0) {
        msgPoupanca.textContent = "Keep going! Tente chegar em 20% de reserva.";
        msgPoupanca.style.color = "#FFD700";
      } else {
        msgPoupanca.textContent = "Atenção: Suas despesas estão consumindo toda a renda.";
        msgPoupanca.style.color = "#FF6B35";
      }
    }
  }

  // 7. Atualiza o Card de Metas 70/20/10 (IA Financeira)
  atualizarMetasIA(receitaTotal, despesaEssencial, reservaCaixinha);

  // 8. Atualiza o Gráfico e as Listas com os dados filtrados
  renderListaTransacoes(dadosExibicao);
  renderCategoriasGrafico(dadosExibicao);
}

/**
 * Lógica visual para as barras de metas dentro do card
 */
function atualizarMetasIA(receita, despesa, reserva) {
  const container = document.getElementById('metas-container');
  if (!container || receita === 0) return;

  // Cálculos das porcentagens reais
  const pEssencial = ((despesa / receita) * 100).toFixed(1);
  const pReserva = ((reserva / receita) * 100).toFixed(1);

  const valorLazer = receita * 0.10;
  const pLazer = 10.0; 

  container.innerHTML = `
    <div class="meta-item">
      <div class="meta-header">
        <span>Essencial (Meta 70%)</span>
        <span style="color: ${pEssencial > 70 ? '#FF6B35' : '#00FFB2'}">${pEssencial}%</span>
      </div>
      <div class="progress-bar"><div style="width:${Math.min(pEssencial, 100)}%; background:${pEssencial > 70 ? '#FF6B35' : '#00FFB2'}"></div></div>
    </div>

    <div class="meta-item">
      <div class="meta-header">
        <span>Reserva/Investimento (Meta 20%)</span>
        <span style="color: #00D1FF">${pReserva}%</span>
      </div>
      <div class="progress-bar"><div style="width:${Math.min(pReserva, 100)}%; background:#00D1FF"></div></div>
    </div>

    <div class="meta-item">
      <div class="meta-header">
        <span>Estilo de Vida (Meta 10%)</span>
        <span style="color: #FFD700">10%</span>
      </div>
      <div class="progress-bar"><div style="width:10%; background:#FFD700; box-shadow: 0 0 10px #FFD70066;"></div></div>
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
  // 1. POPULAR O SELECT DE MESES (Primeira tarefa: preparar o filtro)
  popularSelectMeses();

  // 2. CONFIGURAR O SELETOR DE ABAS (TABS)
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Remove classes ativas de tudo
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      tabs.forEach(b => b.classList.remove('active'));

      // Ativa a aba clicada
      document.getElementById(`tab-${target}`)?.classList.add('active');
      btn.classList.add('active');
    });
  });

  // 3. INICIALIZAR O GRÁFICO (Chart.js)
  const ctx = document.getElementById('mainEvolutionChart');
  if (ctx) {
    grafico = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [
          { label: 'Receitas', data: [], borderColor: '#00FFB2', backgroundColor: 'rgba(0, 255, 178, 0.1)', fill: true, tension: 0.4 },
          { label: 'Despesas', data: [], borderColor: '#FF6B35', backgroundColor: 'rgba(255, 107, 53, 0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } }
      }
    });
  }

  // 4. ESCUTADOR DO SELECT DE MESES
  const selectMes = document.getElementById('filtro-mes');
  selectMes?.addEventListener('change', () => {
    atualizarDashboard(); // Quando mudar o mês, recalcula tudo
  });

  // 5. EVENTO DE FECHAR MODAL CLICANDO FORA
  window.onclick = (event) => {
    const modal = document.getElementById('modal-registro');
    if (event.target === modal) window.fecharModal();
  };

  // 6. FORMULÁRIO DE ENVIO (SUBMIT)
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

  dbListenFirestore();
});

// --- FUNÇÃO AUXILIAR (Fora do DOM, mas chamada por ele) ---
function popularSelectMeses() {
  const select = document.getElementById('filtro-mes');
  if (!select) return;

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dataAtual = new Date();
  const anoAtual = dataAtual.getFullYear();

  select.innerHTML = mesesNomes.map((nome, index) => {
    const selected = index === dataAtual.getMonth() ? 'selected' : '';
    return `<option value="${anoAtual}-${index}" ${selected}>${nome} ${anoAtual}</option>`;
  }).join('');
}