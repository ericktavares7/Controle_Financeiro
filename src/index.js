import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import './transactions.css';
import './responsive.css';
import Chart from 'chart.js/auto';
import { db, auth, addTransaction } from './firebase.js';
import { collection, addDoc, query, orderBy, deleteDoc, doc, onSnapshot } from "firebase/firestore";

const categoriasPorTipo = {
  income: ["Salário", "Freelance", "Investimentos", "Presente", "Venda", "Outros"],
  expense: ["Alimentação", "Transporte", "Aluguel", "Lazer", "Saúde", "Educação", "Cartão de Crédito", "Outros"],
  goal: ["Reserva de Emergência", "Meta de Compra", "Aposentadoria", "Viagem"]
};

window.abrirModal = (tipo) => {
  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  const selectCat = document.getElementById('input-cat');
  const modalContent = modal?.querySelector('.modal-content');

  if (modal && inputTipo && selectCat) {
    inputTipo.value = tipo;

    // Ajusta a estilização visual (bordas coloridas)
    if (modalContent) {
      modalContent.classList.remove('borda-receita', 'borda-despesa', 'borda-caixinha');
      if (tipo === 'income') modalContent.classList.add('borda-receita');
      else if (tipo === 'expense') modalContent.classList.add('borda-despesa');
      else if (tipo === 'goal') modalContent.classList.add('borda-caixinha');
    }

    // LIMPEZA E FILTRO: Remove categorias antigas e coloca as novas
    selectCat.innerHTML = '';
    const lista = categoriasPorTipo[tipo] || [];

    lista.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      selectCat.appendChild(option);
    });

    // Abre o modal
    modal.classList.add('active');

    // Foca no campo de descrição para facilitar a digitação
    setTimeout(() => document.getElementById('input-desc')?.focus(), 100);
  }
};

// --- VARIÁVEIS GLOBAIS ---

let grafico;
let ordemCrescente = false;
window.transactions = [];
window.atualizarDashboard = atualizarDashboard;

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

window.fecharModal = () => {
  document.getElementById('modal-registro')?.classList.remove('active');
};

window.deletarTransacao = async (id) => {
  if (confirm('Deseja realmente excluir esta transação?')) {
    await deleteDoc(doc(db, "transacoes", id));
  }
};

async function dbAdd(transacao) {
  try {
    const docRef = await addDoc(collection(db, "transacoes"), transacao);
    return { id: docRef.id, ...transacao };
  } catch (e) {
    console.error("Erro ao salvar no banco:", e);
    return null;
  }
}

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

  // 1. Pega o mês e ano do Select
  const [anoFiltro, mesFiltro] = select.value.split('-').map(Number);

  console.log("Dados globais:", window.transactions);

  // 2. Filtra usando window.transactions e tratando a data do Firestore
  const dadosExibicao = (window.transactions || []).filter(t => {
    const timestamp = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : (t.date || Date.now());
    const d = new Date(timestamp);
    return d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro;
  });

  console.log("Dados após filtro:", dadosExibicao);

  // 3. Inicializa os contadores para os cálculos
  let receitaTotal = 0;
  let despesaEssencial = 0;
  let reservaCaixinha = 0;

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
  if (!chart || !todasTransactions || todasTransactions.length === 0) return;

  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // 1. Descobre quais meses e anos existem nos dados e ordena
  const mesesPresentes = [...new Set(todasTransactions.map(t => {
    const d = new Date(t.createdAt?.seconds ? t.createdAt.seconds * 1000 : t.createdAt);
    return `${d.getFullYear()}-${d.getMonth()}`;
  }))].sort((a, b) => {
    const [anoA, mesA] = a.split('-').map(Number);
    const [anoB, mesB] = b.split('-').map(Number);
    return anoA !== anoB ? anoA - anoB : mesA - mesB;
  });

  const labelsDinâmicas = [];
  const ganhos = [];
  const gastos = [];

  mesesPresentes.forEach(chave => {
    const [ano, mes] = chave.split('-').map(Number);
    labelsDinâmicas.push(`${mesesNomes[mes]}/${ano.toString().slice(-2)}`);

    // Soma o que for daquele mês/ano específico
    const somaMes = todasTransactions.reduce((acc, t) => {
      const d = new Date(t.createdAt?.seconds ? t.createdAt.seconds * 1000 : t.createdAt);

      if (d.getFullYear() === ano && d.getMonth() === mes) {
        // ATENÇÃO: Verifique se no seu banco é 'tipo' ou 'type' / 'valor' ou 'val'
        const valorNumerico = Number(t.valor || t.val || 0);
        const tipoTransacao = t.tipo || t.type;

        if (tipoTransacao === 'income') acc.ganhos += valorNumerico;
        if (tipoTransacao === 'expense') acc.gastos += valorNumerico;
      }
      return acc;
    }, { ganhos: 0, gastos: 0 });

    ganhos.push(somaMes.ganhos);
    gastos.push(somaMes.gastos);
  });

  // 3. Alimenta o gráfico com a nova estrutura
  chart.data.labels = labelsDinâmicas;
  chart.data.datasets[0].data = ganhos;
  chart.data.datasets[1].data = gastos;

  chart.update(); // Agora a linha vai subir!
  // --- INICIALIZAÇÃO ---
}
document.addEventListener('DOMContentLoaded', () => {

  let touchstartX = 0;
  let touchendX = 0;
  document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
  }, false);

  // Registra onde o dedo saiu e calcula a direção
  document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    handleGesture();
  }, false);

  function handleGesture() {
    const threshold = 70; // Sensibilidade do deslize (em pixels)
    const abas = ['dashboard', 'transacoes']; // IDs das suas abas (conforme seu data-tab)
    const abaAtual = document.querySelector('.tab-btn.active').dataset.tab;
    const indexAtual = abas.indexOf(abaAtual);

    // Deslizar para a ESQUERDA (Dedo vai p/ esquerda -> Próxima aba)
    if (touchendX < touchstartX - threshold) {
      if (indexAtual < abas.length - 1) {
        mudarAba(abas[indexAtual + 1]);
      }
    }

    // Deslizar para a DIREITA (Dedo vai p/ direita -> Aba anterior)
    if (touchendX > touchstartX + threshold) {
      if (indexAtual > 0) {
        mudarAba(abas[indexAtual - 1]);
      }
    }
  }

  // Função auxiliar para simular o clique na aba
  function mudarAba(nomeAba) {
    const btn = document.querySelector(`[data-tab="${nomeAba}"]`);
    if (btn) btn.click();
  }

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
    window.meuGrafico = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Receitas',
            data: [],
            borderColor: '#00FFB2',
            backgroundColor: 'rgba(0, 255, 178, 0.1)', // Um brilho suave
            tension: 0.4,
            fill: true
          },
          {
            label: 'Despesas',
            data: [],
            borderColor: '#FF6B35',
            backgroundColor: 'rgba(255, 107, 53, 0.1)', // Um brilho suave
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#888' }
          }
        }
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
      userId: auth.currentUser?.uid,
      createdAt: new Date()
    };
    const salvo = await addTransaction(nova);
    if (salvo !== null) {
      form.reset();
      window.fecharModal();

    }
  });
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