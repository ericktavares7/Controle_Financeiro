import { marked } from 'marked';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

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

function montarContextoFinanceiro() {
  const select = document.getElementById('filtro-mes');
  if (!select?.value) return null;

  const [ano, mes] = select.value.split('-').map(Number);

  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const txMes = (window.transactions || []).filter(t => {
    const d = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);
    return d.getFullYear() === ano && d.getMonth() === mes;
  });

  let receita = 0, despesa = 0, reserva = 0, lazer = 0;
  const categorias = {};

  const CATS_LAZER = ['lazer', 'entretenimento', 'festa', 'viagem', 'streaming'];

  txMes.forEach(t => {
    const valor = Number(t.val) || 0;
    const catNorm = String(t.cat || '').toLowerCase().trim();
    const bloco = t.financialCategory ||
      (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (t.type === 'income') {
      receita += valor;
    } else if (t.type === 'expense') {
      despesa += valor;
      if (bloco === 'lazer') lazer += valor;
      categorias[t.cat || 'Outros'] = (categorias[t.cat || 'Outros'] || 0) + valor;
    } else if (t.type === 'goal') {
      reserva += valor;
    }
  });

  const essencial = despesa - lazer;
  const saldo = receita - despesa - reserva;
  const regra = window.regraFinanceira || { essencial: 70, reserva: 20, lazer: 10 };

  const essencialIdeal = receita * (regra.essencial / 100);
  const reservaIdeal = receita * (regra.reserva / 100);
  const lazerIdeal = receita * (regra.lazer / 100);

  let pontos = 0;
  if (essencial <= essencialIdeal) pontos++;
  if (lazer <= lazerIdeal) pontos++;
  if (reserva >= reservaIdeal) pontos++;
  const saude = pontos === 3 ? 'Saudável' : pontos === 2 ? 'Atenção' : 'Crítico';

  const topCats = Object.entries(categorias)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, val]) => `  - ${cat}: R$ ${val.toFixed(2)}`)
    .join('\n');

  return {
    mes: `${mesesNomes[mes]} ${ano}`,
    receita, despesa, reserva, lazer, essencial, saldo,
    essencialIdeal, reservaIdeal, lazerIdeal,
    regra, saude, topCats,
    totalTransacoes: txMes.length,
    nomeUsuario: document.getElementById('header-user-name')?.textContent || 'usuário'
  };
}

function montarSystemPrompt(ctx) {
  if (!ctx) {
    return `Você é um assistente financeiro pessoal inteligente e direto. 
O usuário ainda não tem dados financeiros registrados neste mês. 
Seja útil, incentive o cadastro de transações e responda perguntas gerais sobre finanças pessoais.
Responda sempre em português brasileiro, de forma clara e objetiva.`;
  }

  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
  const pct = (v, base) => base > 0 ? `${((v / base) * 100).toFixed(1)}%` : '0%';

  return `Você é um assistente financeiro pessoal do app Finance Simplefy.
Seu papel é analisar os dados reais do usuário e dar conselhos práticos, diretos e personalizados.

## Dados financeiros de ${ctx.mes} — ${ctx.nomeUsuario}

**Resumo geral:**
- Receita total: ${fmt(ctx.receita)}
- Despesas totais: ${fmt(ctx.despesa)}
- Reserva (caixinhas): ${fmt(ctx.reserva)}
- Saldo disponível: ${fmt(ctx.saldo)}
- Saúde financeira: ${ctx.saude}
- Total de transações: ${ctx.totalTransacoes}

**Regra financeira configurada: ${ctx.regra.essencial}/${ctx.regra.reserva}/${ctx.regra.lazer}**

| Bloco | Usado | Ideal | Status |
|-------|-------|-------|--------|
| Essenciais | ${fmt(ctx.essencial)} (${pct(ctx.essencial, ctx.receita)}) | ${fmt(ctx.essencialIdeal)} | ${ctx.essencial > ctx.essencialIdeal ? '⚠️ Acima do limite' : '✅ Dentro do limite'} |
| Reserva    | ${fmt(ctx.reserva)} (${pct(ctx.reserva, ctx.receita)}) | ${fmt(ctx.reservaIdeal)} | ${ctx.reserva >= ctx.reservaIdeal ? '✅ Meta atingida' : '⚠️ Abaixo da meta'} |
| Lazer      | ${fmt(ctx.lazer)} (${pct(ctx.lazer, ctx.receita)}) | ${fmt(ctx.lazerIdeal)} | ${ctx.lazer > ctx.lazerIdeal ? '⚠️ Acima do limite' : '✅ Dentro do limite'} |

**Top categorias de despesa:**
${ctx.topCats || '  Nenhuma despesa registrada'}

## Instruções de comportamento
- Responda SEMPRE em português brasileiro
- Seja direto, prático e use os números reais acima nas respostas
- Quando o usuário perguntar sobre gastos, saldo ou metas, use os dados fornecidos
- Dê conselhos concretos baseados na situação real (não genéricos)
- Seja encorajador quando a situação for boa, honesto e construtivo quando não for
- Respostas curtas e objetivas — máximo 3 parágrafos salvo se pedir detalhes
- Não invente dados que não estão acima`;
}

const HISTORICO_KEY = 'finance_chat_historico';

function carregarHistorico() {
  try {
    const salvo = localStorage.getItem(HISTORICO_KEY);
    return salvo ? JSON.parse(salvo) : [];
  } catch {
    return [];
  }
}

function salvarHistorico(hist) {
  try {
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(hist));
  } catch {
    console.warn('Não foi possível salvar histórico.');
  }
}

let historico = carregarHistorico();

function adicionarAoHistorico(role, content) {
  historico.push({ role, content });
  if (historico.length > 40) {
    historico = historico.slice(historico.length - 40);
  }
  salvarHistorico(historico);
}

// Cria o botão de copiar e adiciona ao card da IA
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

function adicionarMensagem(texto, tipo) {
  const chat = document.getElementById('chat-mensagens');
  if (!chat) return;

  const div = document.createElement('div');
  div.className = `msg msg-${tipo}`;

  if (tipo === 'assistente') {
    div.innerHTML = marked.parse(texto);
    // Adiciona botão de copiar abaixo do conteúdo
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

export function iniciarChat() {
  const btnEnviar = document.getElementById('chat-enviar');
  const input = document.getElementById('chat-input');

  if (!btnEnviar || !input) return;

  renderizarHistoricoSalvo();

  btnEnviar.addEventListener('click', enviarMensagem);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  });

  function renderizarHistoricoSalvo() {
    const chat = document.getElementById('chat-mensagens');
    if (!chat || !historico.length) return;

    chat.innerHTML = '';

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

  const observer = new MutationObserver(() => {
    const nome = document.getElementById('header-user-name')?.textContent;
    const bemVindo = document.querySelector('#chat-mensagens .msg-assistente');
    if (nome && nome !== 'Finance Simplefy' && bemVindo) {
      bemVindo.textContent = `Olá, ${nome.split(' ')[0]}! Analisei suas finanças e estou pronto para ajudar. Pergunte qualquer coisa!`;
      observer.disconnect();
    }
  });

  const headerNome = document.getElementById('header-user-name');
  if (headerNome) observer.observe(headerNome, { childList: true, subtree: true, characterData: true });
}

export function limparHistoricoChat() {
  historico = [];
  salvarHistorico([]);

  const chat = document.getElementById('chat-mensagens');
  if (chat) {
    chat.innerHTML = `
      <div class="msg msg-assistente">
        Olá! Conversa reiniciada. Como posso ajudar?
      </div>
    `;
  }
}