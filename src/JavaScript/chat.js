import { marked } from 'marked';
import { db, auth } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const HISTORICO_KEY = 'finance_chat_historico';

// =========================
// STORAGE — Firestore + localStorage fallback
// =========================

function getUid() {
  return auth?.currentUser?.uid || null;
}

async function carregarHistorico() {
  const uid = getUid();

  if (uid) {
    try {
      const ref = doc(db, 'usuarios', uid, 'chat', 'historico');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data().mensagens || [];
      }
      return [];
    } catch (e) {
      console.warn('Erro ao carregar histórico do Firestore:', e);
    }
  }

  try {
    const salvo = localStorage.getItem(HISTORICO_KEY);
    return salvo ? JSON.parse(salvo) : [];
  } catch {
    return [];
  }
}

async function salvarHistorico(hist) {
  const uid = getUid();

  if (uid) {
    try {
      const ref = doc(db, 'usuarios', uid, 'chat', 'historico');
      await setDoc(ref, {
        mensagens: hist,
        atualizadoEm: serverTimestamp()
      });
      return;
    } catch (e) {
      console.warn('Erro ao salvar histórico no Firestore:', e);
    }
  }

  try {
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(hist));
  } catch {
    console.warn('Não foi possível salvar histórico.');
  }
}

// =========================
// API KEY
// =========================

function getApiKey() {
  return localStorage.getItem('finance_api_key') || '';
}

export function toggleConfigIA() {
  const panel = document.getElementById('config-ia-panel');
  panel?.classList.toggle('hidden');

  const key = localStorage.getItem('finance_api_key');
  if (key) {
    const input = document.getElementById('input-api-key');
    if (input) input.value = key;
    const status = document.getElementById('config-ia-status');
    if (status) {
      status.textContent = '✓ Chave configurada';
      status.className = 'config-ia-status status-ok';
    }
  }
  document.body.classList.add('panel-open');
}

export function salvarApiKey() {
  const input = document.getElementById('input-api-key');
  const status = document.getElementById('config-ia-status');
  const key = input?.value?.trim();

  if (!key || !key.startsWith('sk-ant-')) {
    if (status) {
      status.textContent = '⚠ Chave inválida. Deve começar com sk-ant-';
      status.className = 'config-ia-status status-erro';
    }
    return;
  }

  localStorage.setItem('finance_api_key', key);

  if (status) {
    status.textContent = '✓ Chave salva com sucesso!';
    status.className = 'config-ia-status status-ok';
  }

  setTimeout(() => {
    document.getElementById('config-ia-panel')?.classList.add('hidden');
  }, 1500);
}

// =========================
// CONTEXTO FINANCEIRO COMPLETO
// =========================

function montarContextoFinanceiro() {
  const todasTx = window.transactions || [];

  if (!todasTx.length) return null;

  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mesesCurtos = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // ── Totais gerais ──
  let totalReceita = 0, totalDespesa = 0, totalReserva = 0;
  todasTx.forEach(t => {
    const v = Number(t.val) || 0;
    if (t.type === 'income') totalReceita += v;
    else if (t.type === 'expense') totalDespesa += v;
    else if (t.type === 'goal') totalReserva += v;
  });

  // ── Resumo por mês (últimos 6) ──
  const porMes = {};
  todasTx.forEach(t => {
    const d = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!porMes[chave]) porMes[chave] = { receita: 0, despesa: 0, reserva: 0 };
    const v = Number(t.val) || 0;
    if (t.type === 'income') porMes[chave].receita += v;
    else if (t.type === 'expense') porMes[chave].despesa += v;
    else if (t.type === 'goal') porMes[chave].reserva += v;
  });

  const resumoMeses = Object.entries(porMes)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([mes, v]) =>
      `  - ${mes}: receita R$${v.receita.toFixed(2)} | despesa R$${v.despesa.toFixed(2)} | reserva R$${v.reserva.toFixed(2)} | sobra R$${(v.receita - v.despesa - v.reserva).toFixed(2)}`
    )
    .join('\n');

  // ── Top categorias ──
  const categorias = {};
  todasTx.filter(t => t.type === 'expense').forEach(t => {
    categorias[t.cat || 'Outros'] = (categorias[t.cat || 'Outros'] || 0) + (Number(t.val) || 0);
  });
  const topCats = Object.entries(categorias)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, val]) => `  - ${cat}: R$ ${val.toFixed(2)}`)
    .join('\n');

  // ── Gastos fixos únicos ──
  const fixosUnicos = {};
  todasTx.filter(t => t.fixedExpense && t.type === 'expense').forEach(t => {
    const nome = (t.desc || '').replace(/\s*\(fixa\)|\s*\(\d+\/\d+\)/g, '').trim();
    if (!fixosUnicos[nome]) fixosUnicos[nome] = Number(t.val) || 0;
  });
  const listaFixos = Object.entries(fixosUnicos)
    .map(([nome, val]) => `  - ${nome}: R$ ${val.toFixed(2)}/mês`)
    .join('\n');

  // ── Receita média (últimos 3 meses) ──
  const hoje = new Date();
  let receitaMediaTotal = 0, receitaMediaCount = 0;
  for (let j = 1; j <= 3; j++) {
    const refAno = new Date(hoje.getFullYear(), hoje.getMonth() - j, 1).getFullYear();
    const refMes = new Date(hoje.getFullYear(), hoje.getMonth() - j, 1).getMonth();
    const rec = todasTx
      .filter(t => {
        if (t.type !== 'income') return false;
        const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        return d.getFullYear() === refAno && d.getMonth() === refMes;
      })
      .reduce((acc, t) => acc + (Number(t.val) || 0), 0);
    if (rec > 0) { receitaMediaTotal += rec; receitaMediaCount++; }
  }
  const receitaMedia = receitaMediaCount > 0 ? receitaMediaTotal / receitaMediaCount : 0;

  // ── Projeção dos próximos 5 meses ──
  const projecao = [];
  for (let i = 1; i <= 5; i++) {
    const dataFutura = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const anoFut = dataFutura.getFullYear();
    const mesFut = dataFutura.getMonth();

    // Faturas de cartão que vencem nesse mês
    const faturas = todasTx.filter(t =>
      t.type === 'expense' &&
      t.paymentMethod === 'credit' &&
      t.invoiceYear === anoFut &&
      t.invoiceMonth === mesFut
    );
    const totalFaturas = faturas.reduce((acc, t) => acc + (Number(t.val) || 0), 0);

    // Detalhes das faturas por cartão
    const faturasPorCartao = {};
    faturas.forEach(t => {
      const nomeCartao = (window.cards || []).find(c => c.id === t.cardId)?.name || 'Cartão';
      faturasPorCartao[nomeCartao] = (faturasPorCartao[nomeCartao] || 0) + (Number(t.val) || 0);
    });
    const detalheFaturas = Object.entries(faturasPorCartao)
      .map(([c, v]) => `${c}: R$${v.toFixed(2)}`)
      .join(', ');

    // Gastos fixos que caem nesse mês
    const fixosMes = todasTx.filter(t => {
      if (!t.fixedExpense || t.type !== 'expense') return false;
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      return d.getFullYear() === anoFut && d.getMonth() === mesFut;
    });
    const totalFixosMes = fixosMes.reduce((acc, t) => acc + (Number(t.val) || 0), 0);

    const sobra = receitaMedia - totalFaturas - totalFixosMes;

    projecao.push({
      label: `${mesesCurtos[mesFut]}/${anoFut}`,
      faturas: totalFaturas,
      detalheFaturas,
      fixos: totalFixosMes,
      receitaEstimada: receitaMedia,
      sobra
    });
  }

  const resumoProjecao = projecao.map(m =>
    `  - ${m.label}: ` +
    `receita estimada R$${m.receitaEstimada.toFixed(2)} | ` +
    `faturas cartão R$${m.faturas.toFixed(2)}${m.detalheFaturas ? ` (${m.detalheFaturas})` : ''} | ` +
    `fixos R$${m.fixos.toFixed(2)} | ` +
    `sobra estimada R$${m.sobra.toFixed(2)} ${m.sobra < 0 ? '⚠️ NEGATIVO' : '✅'}`
  ).join('\n');

  // ── Mês selecionado no filtro ──
  const select = document.getElementById('filtro-mes');
  let mesSelecionado = null;
  if (select?.value) {
    const [ano, mes] = select.value.split('-').map(Number);
    mesSelecionado = `${mesesNomes[mes]} ${ano}`;
  }

  return {
    mesSelecionado,
    totalReceita,
    totalDespesa,
    totalReserva,
    saldoGeral: totalReceita - totalDespesa - totalReserva,
    resumoMeses,
    topCats,
    listaFixos,
    resumoProjecao,
    totalTransacoes: todasTx.length,
    nomeUsuario: document.getElementById('header-user-name')?.textContent || 'usuário',
    regra: window.regraFinanceira || { essencial: 70, reserva: 20, lazer: 10 }
  };
}

function montarSystemPrompt(ctx) {
  if (!ctx) {
    return `Você é um assistente financeiro pessoal inteligente e direto.
O usuário ainda não tem dados financeiros registrados.
Incentive o cadastro de transações e responda perguntas gerais sobre finanças pessoais.
Responda sempre em português brasileiro, de forma clara e objetiva.`;
  }

  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

  return `Você é um assistente financeiro pessoal do app Finance Simplefy.
Analise os dados reais do usuário e dê conselhos práticos, diretos e personalizados.

## Dados financeiros completos — ${ctx.nomeUsuario}
${ctx.mesSelecionado ? `Mês selecionado no app: ${ctx.mesSelecionado}` : ''}

**Totais históricos (todos os meses cadastrados):**
- Receita total: ${fmt(ctx.totalReceita)}
- Despesas totais: ${fmt(ctx.totalDespesa)}
- Reserva total: ${fmt(ctx.totalReserva)}
- Saldo geral: ${fmt(ctx.saldoGeral)}
- Total de transações: ${ctx.totalTransacoes}

**Histórico dos últimos 6 meses:**
${ctx.resumoMeses || '  Sem dados'}

**Gastos fixos mensais cadastrados:**
${ctx.listaFixos || '  Nenhum gasto fixo'}

**Top categorias de despesa (histórico geral):**
${ctx.topCats || '  Nenhuma despesa registrada'}

**Projeção dos próximos 5 meses (faturas + fixos + sobra estimada):**
${ctx.resumoProjecao || '  Sem dados futuros'}

**Regra financeira configurada: ${ctx.regra.essencial}/${ctx.regra.reserva}/${ctx.regra.lazer}**

## Instruções de comportamento
- Responda SEMPRE em português brasileiro
- Use os dados reais acima nas respostas — nunca invente números
- Ao projetar meses futuros, use a seção "Projeção dos próximos 5 meses"
- Ao falar de meses passados, use o "Histórico dos últimos 6 meses"
- Quando a sobra for negativa (⚠️), alerte o usuário e sugira onde cortar
- Dê conselhos concretos e práticos baseados na situação real
- Seja encorajador quando a situação for boa, honesto e construtivo quando não for
- Respostas curtas e objetivas — máximo 3 parágrafos salvo se pedir detalhes
- Não invente dados que não estão acima`;
}

// =========================
// HISTÓRICO EM MEMÓRIA
// =========================

let historico = [];

function adicionarAoHistorico(role, content) {
  historico.push({ role, content });
  if (historico.length > 40) {
    historico = historico.slice(historico.length - 40);
  }
  salvarHistorico(historico);
}

// =========================
// BOTÃO COPIAR
// =========================

function criarBotaoCopiar(textoOriginal) {
  const btn = document.createElement('button');
  btn.className = 'btn-copiar-msg';
  btn.title = 'Copiar mensagem';
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>Copiar</span>
  `;

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textoOriginal);
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copiado!</span>
      `;
      btn.classList.add('btn-copiar-ok');
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copiar</span>
        `;
        btn.classList.remove('btn-copiar-ok');
      }, 2000);
    } catch {
      btn.querySelector('span').textContent = 'Erro';
    }
  });

  return btn;
}

// =========================
// MENSAGENS
// =========================

function adicionarMensagem(texto, tipo) {
  const chat = document.getElementById('chat-mensagens');
  if (!chat) return;

  const div = document.createElement('div');
  div.className = `msg msg-${tipo}`;

  if (tipo === 'assistente') {
    div.innerHTML = marked.parse(texto);
    div.appendChild(criarBotaoCopiar(texto));
  } else {
    div.textContent = texto;
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function mostrarLoading() {
  const chat = document.getElementById('chat-mensagens');
  if (!chat) return null;

  const div = document.createElement('div');
  div.className = 'msg msg-assistente msg-loading';
  div.id = 'msg-loading';
  div.innerHTML = `
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  `;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function removerLoading() {
  document.getElementById('msg-loading')?.remove();
}

// =========================
// CLAUDE API
// =========================

async function chamarClaude(mensagemUsuario) {
  if (!getApiKey()) throw new Error('SEM_CHAVE');

  const ctx = montarContextoFinanceiro();
  const systemPrompt = montarSystemPrompt(ctx);

  adicionarAoHistorico('user', mensagemUsuario);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: historico,
    }),
  });

  if (!response.ok) {
    const erro = await response.json().catch(() => ({}));
    throw new Error(erro?.error?.message || `Erro ${response.status}`);
  }

  const data = await response.json();
  const resposta = data.content?.[0]?.text || 'Não consegui gerar uma resposta.';

  adicionarAoHistorico('assistant', resposta);
  return resposta;
}

async function enviarMensagem() {
  const input = document.getElementById('chat-input');
  const btnEnviar = document.getElementById('chat-enviar');

  const texto = input?.value?.trim();
  if (!texto) return;

  input.value = '';
  input.disabled = true;
  btnEnviar.disabled = true;

  adicionarMensagem(texto, 'usuario');
  mostrarLoading();

  try {
    const resposta = await chamarClaude(texto);
    removerLoading();
    adicionarMensagem(resposta, 'assistente');
  } catch (err) {
    removerLoading();
    console.error('Erro na IA:', err);

    const msgErro = err.message?.includes('SEM_CHAVE')
      ? 'Configure sua chave de API clicando no ícone 🔑 acima.'
      : err.message?.includes('401')
        ? 'Chave de API inválida.'
        : err.message?.includes('429')
          ? 'Limite atingido. Tente em instantes.'
          : 'Erro ao conectar com a IA.';

    adicionarMensagem(msgErro, 'assistente');
  } finally {
    input.disabled = false;
    btnEnviar.disabled = false;
    input.focus();
  }
}

// =========================
// INICIAR CHAT
// =========================

export async function iniciarChat() {
  const btnEnviar = document.getElementById('chat-enviar');
  const input = document.getElementById('chat-input');

  if (!btnEnviar || !input) return;

  historico = await carregarHistorico();
  renderizarHistoricoSalvo();

  btnEnviar.addEventListener('click', enviarMensagem);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      historico = await carregarHistorico();
      renderizarHistoricoSalvo();
    }
  });

  const observer = new MutationObserver(() => {
    const nome = document.getElementById('header-user-name')?.textContent;
    const bemVindo = document.querySelector('#chat-mensagens .msg-assistente');
    if (nome && nome !== 'Finance Simplefy' && bemVindo) {
      bemVindo.textContent = `Olá, ${nome.split(' ')[0]}! Analisei suas finanças e estou pronto para ajudar. Pergunte qualquer coisa!`;
      observer.disconnect();
    }
  });

  const chatMensagens = document.getElementById('chat-mensagens');
  const btnScroll = document.getElementById('btn-scroll-bottom');

  if (chatMensagens && btnScroll) {
    chatMensagens.addEventListener('scroll', () => {
      const distanciaDoFim = chatMensagens.scrollHeight - chatMensagens.scrollTop - chatMensagens.clientHeight;
      btnScroll.classList.toggle('visible', distanciaDoFim > 100);
    });
  }

  const headerNome = document.getElementById('header-user-name');
  if (headerNome) observer.observe(headerNome, { childList: true, subtree: true, characterData: true });
}

function renderizarHistoricoSalvo() {
  const chat = document.getElementById('chat-mensagens');
  if (!chat) return;

  chat.innerHTML = '';

  if (!historico.length) {
    chat.innerHTML = `<div class="msg msg-assistente">Olá! Estou pronto para analisar suas finanças. Pergunte qualquer coisa!</div>`;
    return;
  }

  historico.forEach(({ role, content }) => {
    const div = document.createElement('div');
    div.className = `msg msg-${role === 'user' ? 'usuario' : 'assistente'}`;

    if (role === 'assistant') {
      div.innerHTML = marked.parse(content);
      div.appendChild(criarBotaoCopiar(content));
    } else {
      div.textContent = content;
    }

    chat.appendChild(div);
  });

  chat.scrollTop = chat.scrollHeight;
}

// =========================
// LIMPAR HISTÓRICO
// =========================

export async function limparHistoricoChat() {
  historico = [];
  await salvarHistorico([]);

  const chat = document.getElementById('chat-mensagens');
  if (chat) {
    chat.innerHTML = `
      <div class="msg msg-assistente">
        Olá! Conversa reiniciada. Como posso ajudar?
      </div>
    `;
  }
}