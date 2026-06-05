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

function getUid() {
  return auth?.currentUser?.uid || null;
}

function getApiKey() {
  return localStorage.getItem('finance_api_key') || '';
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
      console.warn('Erro ao carregar histórico:', e);
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
      console.warn('Erro ao salvar histórico:', e);
    }
  }

  try {
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(hist));
  } catch {
    console.warn('Não foi possível salvar histórico.');
  }
}

export function toggleConfigIA() {
  const panel = document.getElementById('config-ia-panel');
  panel?.classList.toggle('hidden');

  const key = localStorage.getItem('finance_api_key');

  if (key) {
    const input = document.getElementById('input-api-key');
    const status = document.getElementById('config-ia-status');

    if (input) input.value = key;

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
  }, 1200);
}

function normalizarData(data) {
  if (!data) return new Date();

  if (data?.toDate) return data.toDate();

  return new Date(data);
}

function montarContextoFinanceiro() {
  const select = document.getElementById('filtro-mes');

  if (!select?.value) return null;

  const [ano, mes] =
    select.value.split('-').map(Number);

  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const transacoes =
    window.transactions || [];

  const cartoes =
    window.cards || [];

  const contasFixas =
    window.fixedBills || [];

  const txMes =
    transacoes.filter(t => {
      const d = normalizarData(t.createdAt);

      return (
        d.getFullYear() === ano &&
        d.getMonth() === mes
      );
    });

  let receita = 0;
  let despesa = 0;
  let despesaSaldo = 0;
  let reserva = 0;
  let lazer = 0;

  const categorias = {};

  const CATS_LAZER = [
    'lazer',
    'entretenimento',
    'festa',
    'viagem',
    'streaming'
  ];

  txMes.forEach(t => {
    const valor = Number(t.val) || 0;

    const catNorm =
      String(t.cat || '').toLowerCase().trim();

    const bloco =
      t.financialCategory ||
      (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (t.type === 'income') {
      receita += valor;
    }

    else if (t.type === 'expense') {
      despesa += valor;

      if (t.paymentMethod !== 'credit') {
        despesaSaldo += valor;
      }

      if (bloco === 'lazer') {
        lazer += valor;
      }

      categorias[t.cat || 'Outros'] =
        (categorias[t.cat || 'Outros'] || 0) + valor;
    }

    else if (t.type === 'goal') {
      reserva += valor;
    }
  });

  const faturasCartao =
    cartoes.map(card => {
      const faturaAtual =
        transacoes
          .filter(t =>
            t.type === 'expense' &&
            t.paymentMethod === 'credit' &&
            t.cardId === card.id &&
            Number(t.invoiceYear) === ano &&
            Number(t.invoiceMonth) === mes
          )
          .reduce(
            (acc, t) => acc + (Number(t.val) || 0),
            0
          );

      const compromissoFuturo =
        transacoes
          .filter(t =>
            t.type === 'expense' &&
            t.paymentMethod === 'credit' &&
            t.cardId === card.id &&
            t.invoiceYear != null &&
            t.invoiceMonth != null &&
            (
              Number(t.invoiceYear) > ano ||
              (
                Number(t.invoiceYear) === ano &&
                Number(t.invoiceMonth) > mes
              )
            )
          )
          .reduce(
            (acc, t) => acc + (Number(t.val) || 0),
            0
          );

      const parcelasFuturas =
        transacoes
          .filter(t =>
            t.type === 'expense' &&
            t.paymentMethod === 'credit' &&
            t.cardId === card.id &&
            t.invoiceYear != null &&
            t.invoiceMonth != null &&
            (
              Number(t.invoiceYear) > ano ||
              (
                Number(t.invoiceYear) === ano &&
                Number(t.invoiceMonth) > mes
              )
            )
          )
          .map(t => ({
            descricao: t.desc,
            valor: Number(t.val) || 0,
            mes: Number(t.invoiceMonth),
            ano: Number(t.invoiceYear),
            parcela: t.installmentNumber || null,
            totalParcelas: t.totalInstallments || null
          }));

      return {
        id: card.id,
        nome: card.name,
        fechamento: card.closingDay,
        vencimento: card.dueDay,
        faturaAtual,
        compromissoFuturo,
        parcelasFuturas
      };
    });

  const contasFixasResumo =
    contasFixas.map(conta => ({
      id: conta.id,
      nome: conta.name,
      valor: Number(conta.value) || 0,
      vencimento: conta.dueDay,
      categoria: conta.category,
      bloco: conta.financialCategory,
      status: conta.paid ? 'paga' : 'pendente',
      pagoEm: conta.paidAt || null
    }));

  const totalFaturasAbertas =
    faturasCartao.reduce(
      (acc, c) => acc + c.faturaAtual,
      0
    );

  const totalCompromissoFuturo =
    faturasCartao.reduce(
      (acc, c) => acc + c.compromissoFuturo,
      0
    );

  const totalContasFixasPendentes =
    contasFixasResumo
      .filter(c => c.status === 'pendente')
      .reduce(
        (acc, c) => acc + c.valor,
        0
      );

  const totalContasFixasPagas =
    contasFixasResumo
      .filter(c => c.status === 'paga')
      .reduce(
        (acc, c) => acc + c.valor,
        0
      );

  const essencial =
    despesa - lazer;

  const regra =
    window.regraFinanceira || {
      essencial: 70,
      reserva: 20,
      lazer: 10
    };

  const faturasPagas =
    (window.invoicePayments || [])
      .filter(p =>
        Number(p.invoiceYear) === ano &&
        Number(p.invoiceMonth) === mes &&
        p.status === 'paid'
      )
      .reduce(
        (acc, p) => acc + (Number(p.amount) || 0),
        0
      );

  const saldoDisponivel =
    receita - despesaSaldo - reserva - faturasPagas;

  const totalAindaAPagarMes =
    totalFaturasAbertas + totalContasFixasPendentes;

  const saldoAposObrigacoes =
    saldoDisponivel - totalAindaAPagarMes;

  const essencialIdeal =
    receita * (regra.essencial / 100);

  const reservaIdeal =
    receita * (regra.reserva / 100);

  const lazerIdeal =
    receita * (regra.lazer / 100);

  let pontos = 0;

  if (essencial <= essencialIdeal) pontos++;
  if (lazer <= lazerIdeal) pontos++;
  if (reserva >= reservaIdeal) pontos++;

  const saude =
    pontos === 3
      ? 'Saudável'
      : pontos === 2
        ? 'Atenção'
        : 'Crítico';

  const topCats =
    Object.entries(categorias)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)}`)
      .join('\n');

  return {
    mes: `${mesesNomes[mes]} ${ano}`,
    ano,
    mesIndex: mes,

    receita,
    despesa,
    despesaSaldo,
    reserva,
    lazer,
    essencial,

    saldoDisponivel,
    saldoAposObrigacoes,

    essencialIdeal,
    reservaIdeal,
    lazerIdeal,

    regra,
    saude,
    topCats,

    totalTransacoes: txMes.length,

    faturasCartao,
    contasFixasResumo,

    totalFaturasAbertas,
    totalCompromissoFuturo,
    totalContasFixasPendentes,
    totalContasFixasPagas,
    totalAindaAPagarMes,

    nomeUsuario:
      document.getElementById('header-user-name')?.textContent || 'usuário'
  };
}

function montarSystemPrompt(ctx) {
  if (!ctx) {
    return `
Você é um assistente financeiro pessoal do app Finance Simplefy.

O usuário ainda não possui dados financeiros suficientes carregados no mês selecionado.

Responda em português brasileiro.
Seja direto, prático e objetivo.
Não invente dados.
`;
  }

  const fmt = (v) =>
    `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

  const pct = (v, base) =>
    base > 0 ? `${((v / base) * 100).toFixed(1)}%` : '0%';

  const cartoesTexto =
    ctx.faturasCartao?.length
      ? ctx.faturasCartao.map(c => `
- ${c.nome}
  • Fechamento: dia ${c.fechamento}
  • Vencimento: dia ${c.vencimento}
  • Fatura atual: ${fmt(c.faturaAtual)}
  • Compromisso futuro: ${fmt(c.compromissoFuturo)}
  • Parcelas futuras: ${c.parcelasFuturas?.length || 0}
`).join('\n')
      : 'Nenhum cartão cadastrado.';

  const contasTexto =
    ctx.contasFixasResumo?.length
      ? ctx.contasFixasResumo.map(c => `
- ${c.nome}
  • Valor: ${fmt(c.valor)}
  • Vencimento: dia ${c.vencimento}
  • Categoria: ${c.categoria}
  • Status: ${c.status}
`).join('\n')
      : 'Nenhuma conta fixa cadastrada.';

  return `
Você é o assistente financeiro pessoal do app Finance Simplefy.

Seu papel é analisar os dados reais do usuário e responder com clareza, precisão e foco prático.

## Dados financeiros de ${ctx.mes} — ${ctx.nomeUsuario}

### Resumo geral
- Receita total: ${fmt(ctx.receita)}
- Despesas totais registradas: ${fmt(ctx.despesa)}
- Despesas que já afetam saldo: ${fmt(ctx.despesaSaldo)}
- Reserva/Caixinhas: ${fmt(ctx.reserva)}
- Saldo disponível atual: ${fmt(ctx.saldoDisponivel)}
- Saúde financeira: ${ctx.saude}
- Total de transações no mês: ${ctx.totalTransacoes}

### Regra financeira configurada: ${ctx.regra.essencial}/${ctx.regra.reserva}/${ctx.regra.lazer}

| Bloco | Usado | Ideal | Status |
|---|---:|---:|---|
| Essenciais | ${fmt(ctx.essencial)} (${pct(ctx.essencial, ctx.receita)}) | ${fmt(ctx.essencialIdeal)} | ${ctx.essencial > ctx.essencialIdeal ? 'Acima do limite' : 'Dentro do limite'} |
| Reserva | ${fmt(ctx.reserva)} (${pct(ctx.reserva, ctx.receita)}) | ${fmt(ctx.reservaIdeal)} | ${ctx.reserva >= ctx.reservaIdeal ? 'Meta atingida' : 'Abaixo da meta'} |
| Lazer | ${fmt(ctx.lazer)} (${pct(ctx.lazer, ctx.receita)}) | ${fmt(ctx.lazerIdeal)} | ${ctx.lazer > ctx.lazerIdeal ? 'Acima do limite' : 'Dentro do limite'} |

### Top categorias de despesa
${ctx.topCats || 'Nenhuma despesa registrada.'}

### Cartões e faturas
${cartoesTexto}

### Contas fixas
${contasTexto}

### Obrigações financeiras
- Total em faturas abertas: ${fmt(ctx.totalFaturasAbertas)}
- Total de contas fixas pendentes: ${fmt(ctx.totalContasFixasPendentes)}
- Total de contas fixas pagas: ${fmt(ctx.totalContasFixasPagas)}
- Total ainda a pagar no mês: ${fmt(ctx.totalAindaAPagarMes)}
- Compromisso futuro em cartões: ${fmt(ctx.totalCompromissoFuturo)}
- Saldo estimado após pagar obrigações do mês: ${fmt(ctx.saldoAposObrigacoes)}

## Regras de resposta
- Responda sempre em português brasileiro.
- Use obrigatoriamente os dados acima quando o usuário perguntar sobre dívidas, contas a pagar, plano mensal, saldo, cartões, faturas ou gastos.
- Separe claramente: já pago, pendente e futuro.
- Ao montar plano mensal, priorize:
  1. vencimentos mais próximos;
  2. maiores valores;
  3. risco de saldo negativo;
  4. redução de novos gastos no cartão.
- Nunca diga que não tem acesso aos dados se eles estiverem listados neste contexto.
- Não invente despesas, cartões ou contas fixas.
- Seja direto, objetivo e estratégico.
- Respostas curtas por padrão. Se o usuário pedir plano, pode estruturar em tópicos.
`;
}

let historico = [];

function adicionarAoHistorico(role, content) {
  historico.push({ role, content });

  if (historico.length > 40) {
    historico = historico.slice(historico.length - 40);
  }

  salvarHistorico(historico);
}

function criarBotaoCopiar(textoOriginal) {
  const btn = document.createElement('button');

  btn.className = 'btn-copiar-msg';
  btn.title = 'Copiar mensagem';

  btn.innerHTML = `
    <span>Copiar</span>
  `;

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textoOriginal);

      btn.innerHTML = `<span>Copiado!</span>`;
      btn.classList.add('btn-copiar-ok');

      setTimeout(() => {
        btn.innerHTML = `<span>Copiar</span>`;
        btn.classList.remove('btn-copiar-ok');
      }, 1600);
    } catch {
      btn.innerHTML = `<span>Erro</span>`;
    }
  });

  return btn;
}

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

async function chamarClaude(mensagemUsuario) {
  if (!getApiKey()) {
    throw new Error('SEM_CHAVE');
  }

  const ctx =
    montarContextoFinanceiro();

  const systemPrompt =
    montarSystemPrompt(ctx);

  adicionarAoHistorico('user', mensagemUsuario);

  const response =
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        system: systemPrompt,
        messages: historico
      })
    });

  if (!response.ok) {
    const erro =
      await response.json().catch(() => ({}));

    throw new Error(
      erro?.error?.message || `Erro ${response.status}`
    );
  }

  const data =
    await response.json();

  const resposta =
    data.content?.[0]?.text ||
    'Não consegui gerar uma resposta.';

  adicionarAoHistorico('assistant', resposta);

  return resposta;
}

async function enviarMensagem() {
  const input =
    document.getElementById('chat-input');

  const btnEnviar =
    document.getElementById('chat-enviar');

  const texto =
    input?.value?.trim();

  if (!texto) return;

  input.value = '';
  input.disabled = true;
  if (btnEnviar) btnEnviar.disabled = true;

  adicionarMensagem(texto, 'usuario');
  mostrarLoading();

  try {
    const resposta =
      await chamarClaude(texto);

    removerLoading();
    adicionarMensagem(resposta, 'assistente');
  } catch (err) {
    removerLoading();

    console.error('Erro na IA:', err);

    const msgErro =
      err.message?.includes('SEM_CHAVE')
        ? 'Configure sua chave de API clicando no ícone de chave.'
        : err.message?.includes('401')
          ? 'Chave de API inválida.'
          : err.message?.includes('429')
            ? 'Limite atingido. Tente novamente em instantes.'
            : 'Erro ao conectar com a IA.';

    adicionarMensagem(msgErro, 'assistente');
  } finally {
    input.disabled = false;
    if (btnEnviar) btnEnviar.disabled = false;
    input.focus();
  }
}

function renderizarHistoricoSalvo() {
  const chat =
    document.getElementById('chat-mensagens');

  if (!chat) return;

  chat.innerHTML = '';

  if (!historico.length) {
    chat.innerHTML = `
      <div class="msg msg-assistente">
        Olá! Estou pronto para analisar suas finanças. Pergunte qualquer coisa.
      </div>
    `;

    return;
  }

  historico.forEach(({ role, content }) => {
    adicionarMensagem(
      content,
      role === 'user' ? 'usuario' : 'assistente'
    );
  });

  chat.scrollTop = chat.scrollHeight;
}

export async function iniciarChat() {
  const btnEnviar =
    document.getElementById('chat-enviar');

  const input =
    document.getElementById('chat-input');

  if (!btnEnviar || !input) return;

  historico =
    await carregarHistorico();

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

  const chatMensagens =
    document.getElementById('chat-mensagens');

  const btnScroll =
    document.getElementById('btn-scroll-bottom');

  if (chatMensagens && btnScroll) {
    chatMensagens.addEventListener('scroll', () => {
      const distanciaDoFim =
        chatMensagens.scrollHeight -
        chatMensagens.scrollTop -
        chatMensagens.clientHeight;

      btnScroll.classList.toggle(
        'visible',
        distanciaDoFim > 100
      );
    });
  }
}

export async function limparHistoricoChat() {
  historico = [];

  await salvarHistorico([]);

  const chat =
    document.getElementById('chat-mensagens');

  if (chat) {
    chat.innerHTML = `
      <div class="msg msg-assistente">
        Olá! Conversa reiniciada. Como posso ajudar?
      </div>
    `;
  }
}