import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import logoImg from './assets/logo_finance.png';
import Chart from 'chart.js/auto';
import './transactions.css';
import './responsive.css'; // Sempre por último

const DB_KEY = 'finance_simplefy_transactions';
let transactions = dbLoad();
let grafico;
let ordemCrescente = null;

function dbLoad() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler banco de dados:', e);
    return [];
  }
}

function dbSave(transactions) {
  try {
    // Trava de segurança: Se tentar salvar algo vazio mas já existir algo no banco,
    // o sistema avisa para evitar perda de dados.
    if (transactions.length === 0 && dbLoad().length > 0) {
      console.warn("Bloqueio de segurança: Tentativa de salvar lista vazia ignorada.");
      return;
    }

    localStorage.setItem(DB_KEY, JSON.stringify(transactions));
    console.log("💾 Salvo com sucesso!");
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
}

function dbAdd(transactions, novaTransacao) {
  const atualizado = [novaTransacao, ...transactions];
  dbSave(atualizado);
  return atualizado;
}

function dbRemove(transactions, id) {
  const atualizado = transactions.filter(t => t.id !== id);
  dbSave(atualizado);
  return atualizado;
}

function formatBRL(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR');
}

function calcTotais(transactions) {
  let receita = 0;
  let despesa = 0;
  let caixinha = 0;

  transactions.forEach(t => {
    const valor = Number(t.val || t.amount || 0);

    const tipo = String(t.type || t.tipo || '').toLowerCase().trim();

    if (tipo === 'income' || tipo === 'receita') {
      receita += valor;
    } else if (tipo === 'expense' || tipo === 'despesa' || tipo === 'saving') {
      despesa += valor;
    } else if (tipo === 'goal' || tipo === 'caixinha') {
      caixinha += valor;
    }
  });

  return {
    receita,
    despesa,
    saldo: receita - despesa,
    caixinha,
    poupanca: receita > 0 ? Math.round(((receita - despesa) / receita) * 100) : 0
  };
}

function calcPorCategoria(transactions) {
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      // Se for cartão, agrupamos visualmente, mas mantemos a referência
      const nomeExibicao = t.cat.startsWith('Cartão') ? 'Cartão de Crédito' : t.cat;

      if (!acc[nomeExibicao]) {
        acc[nomeExibicao] = { total: 0, original: t.cat };
      }
      acc[nomeExibicao].total += t.val;
      return acc;
    }, {});
}

function renderKPIs({ receita, despesa, saldo, poupanca, caixinha }) {
  // 1. Atualiza o Saldo (com cor dinâmica)
  const elSaldo = document.getElementById('display-saldo');
  if (elSaldo) {
    elSaldo.textContent = formatBRL(saldo);
    elSaldo.style.color = saldo >= 0 ? 'var(--entradas)' : 'var(--saidas)';
  }

  // 2. Atualiza a Porcentagem de Poupança
  const elPoupanca = document.getElementById('display-poupanca');
  if (elPoupanca) {
    elPoupanca.textContent = `${poupanca}%`;
  }

  // 3. Atualiza a mensagem de feedback (se o elemento existir)
  const msgEl = document.getElementById('msg-poupanca');
  if (msgEl) {
    msgEl.className = 'poupanca-msg'; // Reseta as classes
    if (poupanca >= 20) {
      msgEl.textContent = "🚀 Mandou bem! Você está acima da média.";
      msgEl.classList.add('poupanca-msg--sucesso');
    } else if (poupanca > 0) {
      msgEl.textContent = "Siga firme! Cada centavo conta.";
      msgEl.classList.add('poupanca-msg--alerta');
    } else if (receita > 0) {
      msgEl.textContent = "Atenção! Despesas superaram a receita.";
      msgEl.classList.add('poupanca-msg--critico');
    } else {
      msgEl.textContent = "";
    }
  }
}

function renderBarrasCategorias(transactions) {
  const lista = document.getElementById('categoryList');
  const catEl = document.getElementById('mes-categorias');

  const processarDutos = (elemento, txs) => {
    if (!elemento) return;
    const totaisCat = calcPorCategoria(txs);
    const entradas = Object.entries(totaisCat);

    if (entradas.length === 0) {
      elemento.innerHTML = '<p style="color:var(--txt_secondario);font-size:13px;">Nenhuma despesa.</p>';
      return;
    }

    if (ordemCrescente === true) entradas.sort((a, b) => a[1].total - b[1].total);
    else if (ordemCrescente === false) entradas.sort((a, b) => b[1].total - a[1].total);

    const maximo = Math.max(...entradas.map(([, d]) => d.total));

    elemento.innerHTML = entradas.map(([nome, dados]) => {
      const total = dados.total;
      const pct = ((total / maximo) * 100).toFixed(1);
      return `
        <div class="bar-item">
          <div class="bar-info">
            <span class="cat-name">${nome}</span>
            <span class="cat-value">${formatBRL(total)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill expense-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  };

  processarDutos(lista, transactions);
  processarDutos(catEl, transactions);
}

function renderListaTransacoes(transactions) {

  function getIconeTx(t) {
    const tipo = String(t.type).toLowerCase();
    if (tipo === 'goal' || tipo === 'caixinha') return '🚀';
    if (t.cat && t.cat.includes('Cartão')) return '💳';
    if (tipo === 'income' || tipo === 'receita') return '↑';
    return '↓';
  }

  function getClasseTx(t) {
    const tipo = String(t.type).toLowerCase();
    if (tipo === 'goal' || tipo === 'caixinha') return 'tx-icon--caixinha';
    if (t.cat && t.cat.startsWith('Cartão')) return 'tx-icon--cartao';
    if (tipo === 'income' || tipo === 'receita') return 'tx-icon--income';
    return 'tx-icon--expense';
  }

  const html = transactions.length === 0
    ? '<p style="color:var(--txt_secondario);text-align:center;padding:24px 0;">Nenhuma transação ainda.</p>'
    : transactions.map(t => `
        <div class="tx-item">
          <div class="tx-icon ${getClasseTx(t)}">${getIconeTx(t)}</div>
          <div class="tx-info">
            <span class="tx-desc">${t.desc}</span>
            <span class="tx-meta">${t.cat} · ${formatDate(t.date)}</span>
          </div>
          <div class="tx-right">
            <span class="tx-val ${t.type === 'income' ? 'tx-val--income' : 'tx-val--expense'}">
              ${t.type === 'income' ? '+' : '−'}${formatBRL(t.val)}
            </span>
           <button class="tx-delete" onclick="removerTransacao(${t.id})" title="Remover">✕</button>
          </div>
        </div>`).join('');

  const lista1 = document.getElementById('transaction-list');
  const lista2 = document.getElementById('transaction-list-historico');

  if (lista1) lista1.innerHTML = html;
  if (lista2) lista2.innerHTML = html;

  const deleteButtons = document.querySelectorAll('.tx-delete');
  deleteButtons.forEach(btn => {
    btn.onclick = function () {
      const idParaRemover = Number(this.getAttribute('data-id'));

      removerTransacao(idParaRemover);
    };
  });
}

window.removerTransacao = function (id) {

  console.log("Tentando remover transação ID:", id);

  if (confirm('Deseja excluir esta transação?')) {

    transactions = transactions.filter(t => t.id !== id);

    dbSave(transactions);

    atualizarDashboard(grafico, transactions);

    console.log("Item removido com sucesso!");
  }
};

window.alternarOrdenacao = function () {

  if (ordemCrescente === null) ordemCrescente = false;
  else if (ordemCrescente === false) ordemCrescente = true;
  else ordemCrescente = null;

  console.log("Nova ordenação:", ordemCrescente);

  atualizarDashboard(grafico, transactions);
};

function atualizarGrafico(chart, transactions) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const agora = new Date();
  const ultimos5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (4 - i), 1);
    return { label: meses[d.getMonth()], ano: d.getFullYear(), mes: d.getMonth() };
  });
  const despesas = ultimos5.map(({ ano, mes }) =>
    transactions.filter(t => { const d = new Date(t.date); return t.type === 'expense' && d.getFullYear() === ano && d.getMonth() === mes; }).reduce((s, t) => s + t.val, 0)
  );
  const receitas = ultimos5.map(({ ano, mes }) =>
    transactions.filter(t => { const d = new Date(t.date); return t.type === 'income' && d.getFullYear() === ano && d.getMonth() === mes; }).reduce((s, t) => s + t.val, 0)
  );
  chart.data.labels = ultimos5.map(m => m.label);
  chart.data.datasets[0].data = despesas;
  chart.data.datasets[1].data = receitas;
  chart.update();
}

function atualizarDashboard(chart, todasTransactions) {
  const select = document.getElementById('filtro-mes');
  let dadosParaExibir = todasTransactions;

  console.log("1. Todas as transações no DB:", todasTransactions.length);

  if (select && select.value) {
    const [ano, mes] = select.value.split('-').map(Number);
    console.log(`2. Filtrando para: Mês ${mes}, Ano ${ano}`);

    dadosParaExibir = filtrarPorMes(todasTransactions, ano, mes);
    console.log("3. Transações encontradas para este mês:", dadosParaExibir.length);

    atualizarTextoHeader(select.value);
    renderMes(todasTransactions, ano, mes);
  }

  const totais = calcTotais(dadosParaExibir);
  console.log("4. Totais calculados:", totais);

  renderKPIs(totais);
  renderBarrasCategorias(dadosParaExibir);
  renderListaTransacoes(dadosParaExibir);

  if (chart) atualizarGrafico(chart, todasTransactions);
}

function atualizarTextoHeader(valorSeletor) {
  const headerDate = document.getElementById('header-date');
  if (!headerDate) return;

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const [ano, mes] = valorSeletor.split('-').map(Number);
  headerDate.textContent = `${meses[mes]} ${ano} • dashboard pessoal`;
}

function filtrarPorMes(transactions, anoAlvo, mesAlvo) {
  return transactions.filter(t => {
    const data = new Date(t.date);
    return data.getFullYear() === anoAlvo && data.getMonth() === mesAlvo;
  });
}

function calcDelta(valorAtual, valorAnterior) {
  if (valorAnterior === 0) return null;
  const pct = (((valorAtual - valorAnterior) / valorAnterior) * 100).toFixed(0);
  const sinal = pct > 0 ? '↑' : '↓';
  const cor = pct > 0 ? 'var(--entradas)' : 'var(--saidas)';
  return { texto: `${sinal}${Math.abs(pct)}% vs mês ant.`, cor };
}

function getMesesDisponiveis(transactions) {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const agora = new Date();
  const set = new Set();

  // sempre inclui o mês atual
  set.add(`${agora.getFullYear()}-${agora.getMonth()}`);

  transactions.forEach(t => {
    const d = new Date(t.date);
    set.add(`${d.getFullYear()}-${d.getMonth()}`);
  });

  return Array.from(set)
    .map(s => {
      const [ano, mes] = s.split('-').map(Number);
      return { ano, mes, label: `${meses[mes]} ${ano}` };
    })
    .sort((a, b) => b.ano - a.ano || b.mes - a.mes); // mais recente primeiro
}

function getMesAnoAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${agora.getMonth()}`;
}

function popularSeletorMes(transactions) {
  const select = document.getElementById('filtro-mes');
  if (!select) return;

  const opcoes = getMesesDisponiveis(transactions);
  const hoje = getMesAnoAtual();

  select.innerHTML = opcoes
    .map(o => {
      const value = `${o.ano}-${o.mes}`;
      const isSelected = value === hoje ? 'selected' : '';
      return `<option value="${value}" ${isSelected}>${o.label}</option>`;
    })
    .join('');
}

function renderMes(transactions, ano, mes) {
  const mesAnterior = mes === 0 ? 11 : mes - 1;
  const anoAnterior = mes === 0 ? ano - 1 : ano;

  const txMes = filtrarPorMes(transactions, ano, mes);
  const txAnt = filtrarPorMes(transactions, anoAnterior, mesAnterior);

  const totaisMes = calcTotais(txMes);
  const totaisAnt = calcTotais(txAnt);

  // 1. Ordenação Global do mês
  if (ordemCrescente === true) {
    txMes.sort((a, b) => a.val - b.val);
  } else if (ordemCrescente === false) {
    txMes.sort((a, b) => b.val - a.val);
  }

  // 2. Separação para o histórico segmentado
  const receitas = txMes.filter(t => t.type === 'income');
  const despesas = txMes.filter(t => t.type === 'expense' || t.type === 'saving');

  const gerarHtmlLista = (lista) => {
    if (lista.length === 0) return '<p class="msg-vazio">Nada registrado.</p>';
    return lista.map(t => {
      // Normalização idêntica para evitar erro de acento/espaço
      const slug = t.cat
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '');

      return `
        <div class="tx-item cat-group-${slug}" id="tx-${t.id}"> 
          <div class="tx-info">
            <span class="tx-desc">${t.desc}</span>
            <span class="tx-meta">${t.cat} · ${formatDate(t.date)}</span>
          </div>
          <div class="tx-right">
            <span class="tx-val ${t.type === 'income' ? 'tx-val--income' : 'tx-val--expense'}">
              ${t.type === 'income' ? '+' : '−'}${formatBRL(t.val)}
            </span>
            <button class="tx-delete" onclick="removerTransacao(${t.id})" title="Remover">✕</button>
    </div>
          </div>
        </div>`;
    }).join('');
  };

  const elReceitas = document.getElementById('lista-receitas-historico');
  const elDespesas = document.getElementById('lista-despesas-historico');


  if (elReceitas) elReceitas.innerHTML = gerarHtmlLista(receitas);
  if (elDespesas) elDespesas.innerHTML = gerarHtmlLista(despesas);

  // 3. KPIs e Deltas
  document.getElementById('mes-receita').textContent = formatBRL(totaisMes.receita);
  document.getElementById('mes-despesa').textContent = formatBRL(totaisMes.despesa);
  document.getElementById('mes-saldo').textContent = formatBRL(totaisMes.saldo);
  document.getElementById('mes-saldo').style.color = totaisMes.saldo >= 0 ? 'var(--entradas)' : 'var(--saidas)';

  const deltaReceita = calcDelta(totaisMes.receita, totaisAnt.receita);
  const deltaDespesa = calcDelta(totaisMes.despesa, totaisAnt.despesa);

  const elDR = document.getElementById('mes-receita-delta');
  const elDD = document.getElementById('mes-despesa-delta');
  if (elDR) elDR.innerHTML = deltaReceita ? `<span style="color:${deltaReceita.cor}">${deltaReceita.texto}</span>` : '';
  if (elDD) elDD.innerHTML = deltaDespesa ? `<span style="color:${deltaDespesa.cor}">${deltaDespesa.texto}</span>` : '';

  // 4. Barras de Categorias
  const catEl = document.getElementById('mes-categorias');
  if (catEl) {
    const totaisCat = calcPorCategoria(txMes);
    const entradas = Object.entries(totaisCat);

    // Ajuste na ordenação: agora acessamos .total
    if (ordemCrescente === true) entradas.sort((a, b) => a[1].total - b[1].total);
    else if (ordemCrescente === false) entradas.sort((a, b) => b[1].total - a[1].total);

    if (entradas.length === 0) {
      catEl.innerHTML = '<p style="color:var(--txt_secondario);font-size:13px;">Nenhuma despesa neste mês.</p>';
    } else {
      // Ajuste para pegar o valor máximo corretamente
      const maximo = Math.max(...entradas.map(([, dados]) => dados.total));

      catEl.innerHTML = entradas.map(([nome, dados]) => {
        const total = dados.total;
        const categoriaReal = dados.original; // A categoria que realmente existe na lista
        const pct = ((total / maximo) * 100).toFixed(1);

        return `
          <div class="bar-item" 
               onclick="scrollParaCategoria('${categoriaReal}')" 
               style="cursor: pointer;" 
               title="Clique para ver gastos de ${nome}">
            <div class="bar-info">
              <span class="cat-name">${nome}</span>
              <span class="cat-value">${formatBRL(total)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill expense-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
      }).join('');
    }
  }
}

function setupHistoricoMensal(getTransactions) {
  const select = document.getElementById('filtro-mes');
  if (!select) return;

  select.addEventListener('change', () => {
    const [ano, mes] = select.value.split('-').map(Number);
    renderMes(getTransactions(), ano, mes);
  });
}

function setupAbas(getTransactions) {

  const botoes = document.querySelectorAll('.tab-btn');
  const secoes = document.querySelectorAll('.tab-section');

  botoes.forEach(botao => {
    botao.addEventListener('click', () => {

      const abaAlvo = botao.dataset.tab;

      botoes.forEach(b => b.classList.remove('active'));
      secoes.forEach(s => s.classList.remove('active'));

      botao.classList.add('active');

      document.getElementById(`tab-${abaAlvo}`).classList.add('active');

      if (abaAlvo === 'transacoes') {
        const txs = getTransactions();
        popularSeletorMes(txs);
      }
    });
  });
}

window.scrollParaCategoria = function (nomeCategoria) {
  const slug = nomeCategoria
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '');

  const classeBusca = `.cat-group-${slug}`;

  // Buscamos em todo o documento
  const todosItens = document.querySelectorAll(classeBusca);

  if (todosItens.length > 0) {
    // Pegamos o primeiro item visível
    const primeiroItem = Array.from(todosItens).find(el => el.offsetParent !== null) || todosItens[0];

    primeiroItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

    todosItens.forEach(item => {
      item.classList.add('destaque-flash');
      setTimeout(() => {
        item.classList.remove('destaque-flash');
      }, 2500);
    });
  } else {
    // Se cair aqui, a classe não existe no HTML gerado
    alert(`Nenhuma transação de "${nomeCategoria}" visível nesta aba.`);
  }
};

function adicionarMensagem(texto, tipo) {
  const chat = document.getElementById('chat-mensagens');
  if (!chat) return;
  chat.insertAdjacentHTML('beforeend', `
        <div class="msg msg-${tipo}">
            ${texto.replace(/\n/g, '<br>')}
        </div>
    `);
  chat.scrollTop = chat.scrollHeight;
}

function mostrarCarregando() {
  const chat = document.getElementById('chat-mensagens');
  if (!chat) return;
  chat.insertAdjacentHTML('beforeend', `
        <div class="msg msg-assistente msg-loading" id="msg-loading">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
    `);
  chat.scrollTop = chat.scrollHeight;
}

function removerCarregando() {
  const loading = document.getElementById('msg-loading');
  if (loading) loading.remove();
}

// ESTA É A FUNÇÃO QUE ESTAVA FALTANDO:
function setupChat(getTransactions) {
  const input = document.getElementById('chat-input');
  const botao = document.getElementById('chat-enviar');

  if (!input || !botao) return;

  async function enviar() {
    const texto = input.value.trim();
    if (!texto) return;

    input.disabled = true;
    botao.disabled = true;
    input.value = '';

    adicionarMensagem(texto, 'usuario');
    mostrarCarregando();

    // Aqui chama a função chamarIA que você já deve ter
    const resposta = await chamarIA(texto, getTransactions());

    removerCarregando();
    adicionarMensagem(resposta, 'assistente');

    input.disabled = false;
    botao.disabled = false;
    input.focus();
  }

  botao.addEventListener('click', enviar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {

  let historicoChat = [];

  document.title = "Finance Simplefy";

  const logoElement = document.getElementById('main-logo');
  if (logoElement) {
    logoElement.src = logoImg;
  }

  const favicon = document.getElementById('favicon');
  if (favicon) {
    favicon.href = logoImg;
  }
  // 2. REFERÊNCIAS DE UI
  const modalRegistro = document.getElementById('modal-registro');
  const modalContent = modalRegistro?.querySelector('.modal-content');
  const form = document.getElementById('form-transacao');
  const btnSave = form?.querySelector('.btn-save');

  // 3. FUNÇÃO DE FILTRAGEM
  function filtrarCategoriasNoModal(tipo) {
    const selectCat = document.getElementById('input-cat');
    const grupoDespesas = document.getElementById('group-despesas');
    const grupoReceitas = document.getElementById('group-receitas');
    const grupoCaixinhas = document.getElementById('group-caixinhas');
    const modalContent = document.querySelector('#modal-registro .modal-content');

    if (!selectCat) return;

    if (grupoDespesas) grupoDespesas.style.display = 'none';
    if (grupoReceitas) grupoReceitas.style.display = 'none';
    if (grupoCaixinhas) grupoCaixinhas.style.display = 'none';


    if (tipo === 'expense') {
      if (grupoDespesas) grupoDespesas.style.display = 'block';
      selectCat.value = "Alimentação";
      if (modalContent) modalContent.style.borderTop = "4px solid #FF6B35"; // Laranja
    }
    else if (tipo === 'income') {
      if (grupoReceitas) grupoReceitas.style.display = 'block';
      selectCat.value = "Salário";
      if (modalContent) modalContent.style.borderTop = "4px solid #00FFB2"; // Verde
    }
    else if (tipo === 'goal') {
      if (grupoCaixinhas) grupoCaixinhas.style.display = 'block';
      selectCat.value = "Reserva de Emergência";
      if (modalContent) modalContent.style.borderTop = "4px solid #00D1FF"; // Azul
    }

    selectCat.blur();
    selectCat.focus();
  }

  // 4. FUNÇÃO PARA ABRIR O MODAL (Ajustada para o seu ID real)
  function abrirModalTransacao(tipo) {
    if (modalRegistro) {
      document.body.style.overflow = 'hidden';
      modalRegistro.classList.add('active');

      const inputTipo = document.getElementById('input-tipo');
      const inputDesc = document.getElementById('input-desc');

      if (inputTipo) inputTipo.value = tipo;
      filtrarCategoriasNoModal(tipo);

      setTimeout(() => {
        inputDesc?.focus({ preventScroll: true });
      }, 300);
    }
  }

  // 5. INICIALIZAÇÃO DO GRÁFICO
  const canvas = document.getElementById('mainEvolutionChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
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

  // 6. EVENTOS DE CLIQUE (BOTÕES)
  document.getElementById('dash-card-receita')?.addEventListener('click', () => abrirModalTransacao('income'));
  document.getElementById('dash-card-despesa')?.addEventListener('click', () => abrirModalTransacao('expense'));
  document.getElementById('dash-card-caixinhas')?.addEventListener('click', () => abrirModalTransacao('goal'));

  // 7. FECHAR MODAL
  document.getElementById('fechar-modal')?.addEventListener('click', () => {
    if (modalRegistro) {
      modalRegistro.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });

  // Fechar ao clicar no fundo escuro
  modalRegistro?.addEventListener('click', (e) => {
    if (e.target === modalRegistro) {
      modalRegistro.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });

  // 8. ENVIO DO FORMULÁRIO
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('input-desc').value.trim();
    const val = parseFloat(document.getElementById('input-val').value);
    const dataInput = document.getElementById('input-data').value;
    const type = document.getElementById('input-tipo').value;
    const cat = document.getElementById('input-cat').value;

    if (!desc || !val) return alert('Preencha corretamente!');

    const nova = {
      id: Date.now(),
      desc, val, type, cat,
      date: dataInput ? new Date(dataInput + 'T00:00').toISOString() : new Date().toISOString()
    };

    transactions = dbAdd(transactions, nova);
    atualizarDashboard(grafico, transactions);
    form.reset();
    modalRegistro?.classList.remove('active');
    document.body.style.overflow = 'auto';
  });

  document.getElementById('btn-ordenar-valor')?.addEventListener('click', () => {
    // 1. Alterna o estado da ordem
    if (ordemCrescente === null) {
      ordemCrescente = false; // Começa pelo maior valor (o que você quer)
    } else if (ordemCrescente === false) {
      ordemCrescente = true;  // Muda para o menor valor
    } else {
      ordemCrescente = null;  // Volta ao padrão (por data)
    }

    // 2. Atualiza o ícone visualmente
    const icon = document.getElementById('sort-icon');
    if (icon) {
      if (ordemCrescente === false) icon.innerText = '▼';
      else if (ordemCrescente === true) icon.innerText = '▲';
      else icon.innerText = '⇅';
    }

    atualizarDashboard(grafico, transactions);
  });

  // 9. INICIALIZAÇÃO FINAL
  setupAbas(() => transactions);
  setupChat(() => transactions);

  popularSeletorMes(transactions);

  const seletorMes = document.getElementById('filtro-mes');
  seletorMes?.addEventListener('change', () => {
    atualizarDashboard(grafico, transactions);
  });

  atualizarDashboard(grafico, transactions);
});
