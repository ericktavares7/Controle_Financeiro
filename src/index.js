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
    localStorage.setItem(DB_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error('Erro ao salvar:', e);
    alert('Não foi possível salvar. Verifique o armazenamento do navegador.');
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
  const receita = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.val, 0);

  // Despesa = tudo que é expense E não é caixinha
  const despesa = transactions
    .filter(t => t.type === 'expense' && !t.cat.startsWith('Caixinha'))
    .reduce((s, t) => s + t.val, 0);

  // Caixinha = expense com categoria começando em "Caixinha"
  const caixinha = transactions
    .filter(t => t.type == 'saving')
    .reduce((s, t) => s + t.val, 0);

  const saldo = receita - despesa - caixinha;
  const poupanca = receita > 0
    ? (((receita - despesa - caixinha) / receita) * 100).toFixed(1)
    : 0;

  // Retorna caixinha junto com o resto
  return { receita, despesa, saldo, poupanca, caixinha };
}

function calcPorCategoria(transactions) {
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.cat] = (acc[t.cat] || 0) + t.val;
      return acc;
    }, {});
}

function renderKPIs({ receita, despesa, saldo, poupanca, caixinha }) {
  document.getElementById('display-receita').textContent = formatBRL(receita);
  document.getElementById('display-despesa').textContent = formatBRL(despesa);
  document.getElementById('display-saldo').textContent = formatBRL(saldo);
  document.getElementById('display-poupanca').textContent = `${poupanca}%`;

  // Só atualiza se o elemento existir no HTML
  const caixinhaEl = document.getElementById('display-caixinha');
  if (caixinhaEl) caixinhaEl.textContent = formatBRL(caixinha);

  // Cor do saldo
  document.getElementById('display-saldo').style.color =
    saldo >= 0 ? 'var(--entradas)' : 'var(--saidas)';
}

function renderBarrasCategorias(transactions) {
  const lista = document.getElementById('categoryList');
  if (!lista) return;
  const totais = calcPorCategoria(transactions);
  const entradas = Object.entries(totais);
  if (entradas.length === 0) {
    lista.innerHTML = '<p style="color:var(--txt_secondario);font-size:13px;">Nenhuma despesa ainda.</p>';
    return;
  }
  const maximo = Math.max(...entradas.map(([, v]) => v));
  lista.innerHTML = entradas.map(([nome, total]) => {
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
}

function renderListaTransacoes(transactions) {

  function getIconeTx(t) {
    if (t.type === 'saving') return '🐷';
    if (t.cat.startsWith('Cartão')) return '💳';
    if (t.type === 'income') return '↑';
    return '↓';
  }

  function getClasseTx(t) {
    if (t.type === 'saving') return 'tx-icon--caixinha';
    if (t.cat.startsWith('Cartão')) return 'tx-icon--cartao';
    if (t.type === 'income') return 'tx-icon--income';
    return 'tx-icon--expense';
  }

  const lista = document.getElementById('transaction-list');
  if (!lista) return;
  if (transactions.length === 0) {
    lista.innerHTML = '<p style="color:var(--txt_secondario);text-align:center;padding:24px 0;">Nenhuma transação ainda.</p>';
    return;
  }
  lista.innerHTML = transactions.map(t => `
    <div class="tx-item">
     <div class="tx-icon ${getClasseTx(t)}">
      ${getIconeTx(t)}
    </div>
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
}

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

function atualizarDashboard(chart, transactions) {
  const totais = calcTotais(transactions);
  renderKPIs(totais);
  renderBarrasCategorias(transactions);
  renderListaTransacoes(transactions);
  atualizarGrafico(chart, transactions);
}

function setupAbas() {
  const botoes = document.querySelectorAll('.tab-btn');
  const secoes = document.querySelectorAll('.tab-section');

  botoes.forEach(botao => {
    botao.addEventListener('click', () => {

      const abaAlvo = botao.dataset.tab;

      botoes.forEach(b => b.classList.remove('active'));
      secoes.forEach(s => s.classList.remove('active'));

      botao.classList.add('active');

      document.getElementById(`tab-${abaAlvo}`).classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {

  setupAbas();

  let historicoChat = [];

  function montarContextoFinanceiro(transactions) {
    if (transactions.length === 0) {
      return 'O usuário ainda não tem transações registradas.';
    }

    const { receita, despesa, saldo } = calcTotais(transactions);

    // Agrupa despesas por categoria para a IA entender melhor
    const porCategoria = calcPorCategoria(transactions);
    const categoriasTxt = Object.entries(porCategoria)
      .map(([cat, val]) => `${cat}: ${formatBRL(val)}`)
      .join(', ');

    // As últimas 10 transações para contexto recente
    const recentes = transactions
      .slice(0, 10)
      .map(t => `${formatDate(t.date)} | ${t.desc} | ${t.type === 'income' ? '+' : '-'}${formatBRL(t.val)}`)
      .join('\n');

    return `
RESUMO FINANCEIRO DO USUÁRIO:
- Receita total: ${formatBRL(receita)}
- Despesa total: ${formatBRL(despesa)}
- Saldo livre: ${formatBRL(saldo)}
- Taxa de poupança: ${receita > 0 ? (((receita - despesa) / receita) * 100).toFixed(1) : 0}%
 
GASTOS POR CATEGORIA:
${categoriasTxt}
 
TRANSAÇÕES RECENTES:
${recentes}
  `.trim();
  }

  async function chamarIA(mensagemUsuario, transactions) {
    const contexto = montarContextoFinanceiro(transactions);

    // Adiciona a mensagem do usuário ao histórico
    // Fazemos isso ANTES da chamada para manter a ordem correta
    historicoChat.push({
      role: 'user',
      content: mensagemUsuario
    });

    try {
      // fetch é a API nativa do navegador para requisições HTTP
      const resposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // NOTA: a chave de API é injetada automaticamente
          // pelo ambiente do Claude.ai quando usado como artifact.
          // Em produção própria, você adicionaria:
          // 'x-api-key': 'SUA_CHAVE_AQUI',
          // 'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,

          // system → instrução permanente que define o comportamento
          // O usuário não vê isso, mas a IA segue
          system: `Você é um assistente financeiro pessoal inteligente e direto.
Você tem acesso aos dados financeiros reais do usuário abaixo.
Responda sempre em português brasileiro.
Seja específico, use os números reais nas suas respostas.
Seja conciso — máximo 3 parágrafos por resposta.
 
${contexto}`,

          // messages → o histórico completo da conversa
          // A API precisa de tudo para ter contexto
          messages: historicoChat
        })
      });

      // Se o servidor respondeu com erro (401, 429, 500...)
      // fetch NÃO lança erro automaticamente — você precisa checar
      if (!resposta.ok) {
        throw new Error(`Erro na API: ${resposta.status}`);
      }

      // .json() também é assíncrono — lê e converte o body
      const dados = await resposta.json();

      // A API retorna um array de content blocks
      // Cada block tem type e text
      const textoResposta = dados.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Adiciona a resposta da IA ao histórico
      historicoChat.push({
        role: 'assistant',
        content: textoResposta
      });

      return textoResposta;

    } catch (erro) {
      console.error('Erro ao chamar IA:', erro);

      // Remove a última mensagem do histórico se falhou
      // Senão o histórico ficaria dessincronizado
      historicoChat.pop();

      return 'Desculpe, não consegui me conectar. Verifique sua conexão e tente novamente.';
    }
  }

  function adicionarMensagem(texto, tipo) {
    const chat = document.getElementById('chat-mensagens');
    if (!chat) return;

    chat.insertAdjacentHTML('beforeend', `
    <div class="msg msg-${tipo}">
      ${texto.replace(/\n/g, '<br>')}
    </div>
  `);

    // Scroll automático para a última mensagem
    chat.scrollTop = chat.scrollHeight;
  }

  function mostrarCarregando() {
    const chat = document.getElementById('chat-mensagens');
    if (!chat) return;
    chat.insertAdjacentHTML('beforeend', `
    <div class="msg msg-assistente msg-loading" id="msg-loading">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  `);
    chat.scrollTop = chat.scrollHeight;
  }

  function removerCarregando() {
    const loading = document.getElementById('msg-loading');
    if (loading) loading.remove();
  }

  function setupChat(getTransactions) {

    const input = document.getElementById('chat-input');
    const botao = document.getElementById('chat-enviar');

    if (!input || !botao) return;

    async function enviar() {
      const texto = input.value.trim();
      if (!texto) return;

      // Desabilita input enquanto espera (evita spam)
      input.disabled = true;
      botao.disabled = true;
      input.value = '';

      adicionarMensagem(texto, 'usuario');
      mostrarCarregando();

      // Chama a IA com o estado ATUAL das transações
      const resposta = await chamarIA(texto, getTransactions());

      removerCarregando();
      adicionarMensagem(resposta, 'assistente');

      // Reabilita o input
      input.disabled = false;
      botao.disabled = false;
      input.focus();
    }

    // Botão clica → envia
    botao.addEventListener('click', enviar);

    // Enter também envia (UX comum em chats)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviar();
      }
    });
  }

  const logo = document.getElementById('main-logo');
  if (logo) logo.src = logoImg;

  let transactions = dbLoad();

  const ctx = document.getElementById('mainEvolutionChart').getContext('2d');
  const grafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Despesas',
          data: [],
          borderColor: '#FF6B35',
          backgroundColor: 'rgba(255,107,53,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#FF6B35'
        },
        {
          label: 'Receitas',
          data: [],
          borderColor: '#00FFB2',
          backgroundColor: 'rgba(0,255,178,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#00FFB2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 0 },
      plugins: {
        legend: { display: true, labels: { color: '#4a6080', font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${formatBRL(ctx.raw)}` } }
      },
      scales: {
        y: {
          grid: { color: 'rgba(30,45,64,0.8)' },
          ticks: { color: '#4a6080', callback: v => `R$${(v / 1000).toFixed(0)}k` }
        },
        x: { grid: { display: false }, ticks: { color: '#4a6080' } }
      }
    }
  });

  atualizarDashboard(grafico, transactions);

  setupChat(() => transactions);

  // Adicionar transação
  const form = document.getElementById('form-transacao');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const desc = form.querySelector('input[type="text"]').value.trim();
    const val = parseFloat(form.querySelector('input[type="number"]').value);
    const type = form.querySelector('.select-type').value;
    const cat = form.querySelector('.select-category').value;

    if (!desc) return alert('Digite uma descrição!');
    if (!val || val <= 0) return alert('Digite um valor válido!');

    const nova = {
      id: Date.now(),
      desc,
      val,
      type,
      cat: type === 'saving' ? cat : cat,
      date: new Date().toISOString()
    };

    transactions = dbAdd(transactions, nova);
    atualizarDashboard(grafico, transactions);
    form.reset();
  });

  // Deletar transação (event delegation)
  const listContainer = document.getElementById('transaction-list');
  if (listContainer) {
    listContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tx-delete');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!confirm('Remover esta transação?')) return;
      transactions = dbRemove(transactions, id);
      atualizarDashboard(grafico, transactions);
    });
  }

});

