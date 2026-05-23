import { formatBRL } from './utils.js';
import { atualizarCartoesNaTela } from './cards.js';
import { CATS_LAZER } from './state.js';
import { renderListaTransacoes, getFiltroBloco } from './transactions.js';
import { criarGraficoDonut, atualizarGraficoDonut, atualizarComparativo } from './charts.js';

const mesesTexto = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

function atualizarTextoMesSelecionado(ano, mes) {
  const headerDate = document.getElementById('header-date');

  if (!headerDate) return;

  headerDate.textContent =
    `${mesesTexto[mes]} ${ano} • dashboard pessoal`;
}

export function atualizarDashboard() {
  const select = document.getElementById('filtro-mes');

  if (!select) return;

  const [anoFiltro, mesFiltro] =
    select.value.split('-').map(Number);

  atualizarTextoMesSelecionado(anoFiltro, mesFiltro);

  const dadosExibicao =
    (window.transactions || []).filter(t => {
      const d =
        t.createdAt?.toDate
          ? t.createdAt.toDate()
          : t.createdAt instanceof Date
            ? t.createdAt
            : new Date(t.createdAt);

      return (
        d.getFullYear() === anoFiltro &&
        d.getMonth() === mesFiltro
      );
    });

  dadosExibicao.sort((a, b) => {
    return window.ordemCrescente
      ? Number(a.val) - Number(b.val)
      : Number(b.val) - Number(a.val);
  });

  const bloco = getFiltroBloco();

  const dadosFiltrados = bloco === 'todos'
    ? dadosExibicao
    : dadosExibicao.filter(t => {
      if (t.type === 'income') return bloco === 'todos';
      const catNorm = String(t.cat || '').toLowerCase().trim();
      const blocoTx = t.financialCategory ||
        (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');
      return blocoTx === bloco;
    });

  renderListaTransacoes(dadosFiltrados);


  window.renderCategoriasGrafico?.(dadosExibicao);

  let rec = 0;
  let des = 0;
  let res = 0;
  let lazer = 0;

  dadosExibicao.forEach(t => {
    const valor = Number(t.val) || 0;
    const catNorm = String(t.cat || '').toLowerCase().trim();

    const bloco = t.financialCategory ||
      (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (t.type === 'income') {
      rec += valor;
    } else if (t.type === 'expense') {
      des += valor;
      if (bloco === 'lazer') lazer += valor;
    } else if (t.type === 'goal') {
      res += valor;
    }
  });

  const mesAnterior = mesFiltro === 0 ? 11 : mesFiltro - 1;
  const anoAnterior = mesFiltro === 0 ? anoFiltro - 1 : anoFiltro;

  let recAnt = 0, desAnt = 0, resAnt = 0, lazerAnt = 0;

  (window.transactions || []).forEach(t => {
    const d = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);

    if (d.getFullYear() !== anoAnterior || d.getMonth() !== mesAnterior) return;

    const valor = Number(t.val) || 0;
    const catNorm = String(t.cat || '').toLowerCase().trim();
    const bloco = t.financialCategory ||
      (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (t.type === 'income') recAnt += valor;
    else if (t.type === 'expense') {
      desAnt += valor;
      if (bloco === 'lazer') lazerAnt += valor;
    }
    else if (t.type === 'goal') resAnt += valor;
  });

  const mesesNomes = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  atualizarComparativo(
    { rec, des, res, lazer },
    { rec: recAnt, des: desAnt, res: resAnt, lazer: lazerAnt },
    mesesNomes[mesFiltro],
    mesesNomes[mesAnterior]
  );

  const essencialReal = des - lazer;
  atualizarGraficoDonut(essencialReal, lazer, res);

  const mesReceita = document.getElementById('mes-receita');
  const mesDespesa = document.getElementById('mes-despesa');
  const mesSaldo = document.getElementById('mes-saldo');

  if (mesReceita) mesReceita.textContent = formatBRL(rec);
  if (mesDespesa) mesDespesa.textContent = formatBRL(des);
  if (mesSaldo) mesSaldo.textContent = formatBRL(rec - des - res);

  const headerSaldo = document.getElementById('header-saldo-badge');

  if (headerSaldo) {
    const saldo = rec - des - res;

    headerSaldo.innerHTML =
      `<span>◈ Saldo: </span> ${formatBRL(saldo)}`;

    headerSaldo.style.color =
      saldo >= 0 ? '#00FFB2' : '#FF6B35';
  }

  atualizarInsightSaldo(select, rec, des, res);

  atualizarMetasIA(rec, des, res, lazer, dadosExibicao);
  atualizarCartoesNaTela(window.cards || []);
  atualizarPoupanca(rec, des, res);
}

function atualizarInsightSaldo(select, rec, des, res) {
  const insightEl = document.getElementById('insight-saldo');

  if (!insightEl) return;

  const [anoFiltroN, mesFiltroN] =
    select.value.split('-').map(Number);

  const mesAnterior =
    mesFiltroN === 0 ? 11 : mesFiltroN - 1;

  const anoAnterior =
    mesFiltroN === 0 ? anoFiltroN - 1 : anoFiltroN;

  const txMesAnterior =
    (window.transactions || []).filter(t => {
      const d =
        t.createdAt?.toDate
          ? t.createdAt.toDate()
          : new Date(t.createdAt);

      return (
        d.getFullYear() === anoAnterior &&
        d.getMonth() === mesAnterior
      );
    });

  let recAnt = 0;
  let desAnt = 0;
  let resAnt = 0;

  txMesAnterior.forEach(t => {
    const v = Number(t.val) || 0;

    if (t.type === 'income') recAnt += v;
    else if (t.type === 'expense') desAnt += v;
    else if (t.type === 'goal') resAnt += v;
  });

  const saldoAtual = rec - des - res;
  const saldoAnterior = recAnt - desAnt - resAnt;

  const mesesNomes = [
    'Jan', 'Fev', 'Mar', 'Abr',
    'Mai', 'Jun', 'Jul', 'Ago',
    'Set', 'Out', 'Nov', 'Dez'
  ];

  if (!txMesAnterior.length) {
    insightEl.textContent = '';
  } else if (saldoAtual > saldoAnterior) {
    const diff =
      Math.round(
        ((saldoAtual - saldoAnterior) /
          Math.abs(saldoAnterior || 1)) * 100
      );

    insightEl.textContent =
      `↑ ${diff}% melhor que ${mesesNomes[mesAnterior]}`;

    insightEl.className =
      'insight-saldo insight--positivo';
  } else if (saldoAtual < saldoAnterior) {
    const diff =
      Math.round(
        ((saldoAnterior - saldoAtual) /
          Math.abs(saldoAnterior || 1)) * 100
      );

    insightEl.textContent =
      `↓ ${diff}% pior que ${mesesNomes[mesAnterior]}`;

    insightEl.className =
      'insight-saldo insight--negativo';
  } else {
    insightEl.textContent =
      `= igual a ${mesesNomes[mesAnterior]}`;

    insightEl.className =
      'insight-saldo insight--neutro';
  }
}

function atualizarPoupanca(receita, despesa, reserva) {
  const display = document.getElementById('display-poupanca');
  const msg = document.getElementById('msg-poupanca');

  if (!display) return;

  if (!receita) {
    display.textContent = '0%';

    if (msg) {
      msg.textContent = 'Sem receita registrada neste mês.';
      msg.className = 'poupanca-msg poupanca-msg--alerta';
    }

    return;
  }

  const taxa = ((reserva / receita) * 100).toFixed(1);

  display.textContent = `${taxa}%`;

  if (!msg) return;

  if (Number(taxa) >= window.regraFinanceira.reserva) {
    msg.textContent = 'Meta de reserva dentro do planejado.';
    msg.className = 'poupanca-msg poupanca-msg--sucesso';
  } else {
    msg.textContent = 'Reserva abaixo da meta definida.';
    msg.className = 'poupanca-msg poupanca-msg--critico';
  }
}

function montarSubcategorias(dadosExibicao, blocoAlvo) {
  const totais = {};

  dadosExibicao.forEach(t => {
    if (t.type !== 'expense' && t.type !== 'goal') return;

    const catNorm = String(t.cat || '').toLowerCase().trim();
    const bloco = t.financialCategory ||
      (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (bloco !== blocoAlvo) return;
    if (t.type === 'goal' && blocoAlvo !== 'reserva') return;

    const cat = t.cat || 'Outros';
    totais[cat] = (totais[cat] || 0) + (Number(t.val) || 0);
  });

  const itens = Object.entries(totais)
    .sort((a, b) => b[1] - a[1]);

  if (!itens.length) return '';

  return `
    <div class="meta-subcats">
      ${itens.map(([cat, val]) => `
        <div class="meta-subcat-row">
          <span class="meta-subcat-nome">${cat}</span>
          <span class="meta-subcat-val">${formatBRL(val)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function atualizarSaudeFinanceira(essencialReal, essencialIdeal, lazer, lazerIdeal, reserva, reservaIdeal) {
  const badge = document.getElementById('saude-financeira-badge');
  if (!badge) return;

  let pontos = 0;

  // Essenciais dentro do limite
  if (essencialReal <= essencialIdeal) pontos++;

  // Lazer dentro do limite
  if (lazer <= lazerIdeal) pontos++;

  // Reserva sendo feita
  if (reserva >= reservaIdeal) pontos++;

  const config = {
    3: { label: '● Saudável', classe: 'saude--verde' },
    2: { label: '● Atenção', classe: 'saude--amarelo' },
    1: { label: '● Crítico', classe: 'saude--vermelho' },
    0: { label: '● Crítico', classe: 'saude--vermelho' },
  };

  const { label, classe } = config[pontos];

  badge.textContent = label;
  badge.className = `saude-badge ${classe}`;
}

function atualizarMetasIA(
  receita,
  despesa = 0,
  reserva = 0,
  lazer = 0,
  dadosExibicao = []
) {
  const container = document.getElementById('metas-container');

  if (!container) return;

  receita = Number(receita) || 0;
  despesa = Number(despesa) || 0;
  reserva = Number(reserva) || 0;
  lazer = Number(lazer) || 0;

  const regra = window.regraFinanceira || {
    essencial: 70,
    reserva: 20,
    lazer: 10
  };

  const essencialReal = despesa - lazer;

  const essencialIdeal =
    receita * (regra.essencial / 100);

  const reservaIdeal =
    receita * (regra.reserva / 100);

  const lazerIdeal =
    receita * (regra.lazer / 100);

  const tituloRegra =
    document.getElementById('titulo-regra-financeira');

  if (tituloRegra) {
    tituloRegra.textContent =
      `Regra ${regra.essencial}/${regra.reserva}/${regra.lazer}`;
  }

  const montarLinha = ({
    nome,
    percentual,
    usado,
    ideal,
    cor,
    subcats = '',
    tipo
  }) => {
    const usadoPercentual =
      receita > 0 ? (usado / receita) * 100 : 0;

    const progresso =
      ideal > 0 ? Math.min((usado / ideal) * 100, 100) : 0;

    let status = '';
    let statusClass = '';

    if (tipo === 'limite') {
      if (usado > ideal) {
        status =
          `Passou ${formatBRL(usado - ideal)} do recomendado`;

        statusClass = 'meta-status danger';
      } else {
        status =
          `Ainda pode usar ${formatBRL(ideal - usado)}`;

        statusClass = 'meta-status ok';
      }
    }

    if (tipo === 'objetivo') {
      if (usado >= ideal) {
        status = 'Meta atingida';
        statusClass = 'meta-status ok';
      } else {
        status =
          `Faltam ${formatBRL(ideal - usado)} para a meta`;

        statusClass = 'meta-status warning';
      }
    }

    return `
      <div class="meta-card-line">
        <div class="meta-line-top">
          <div>
            <strong>
              ${nome}
              <span class="meta-pct-inline ${tipo === 'objetivo'
        ? 'meta-pct-info'
        : usado > ideal
          ? 'meta-pct-warn'
          : 'meta-pct-ok'
      }">
                ${usadoPercentual.toFixed(0)}%
              </span>
            </strong>

            <span>${percentual}% da receita</span>
          </div>

          <b style="color:${cor}">
            ${usadoPercentual.toFixed(1)}%
          </b>
        </div>

        <div class="meta-money-row">
          <span>Usado: <strong>${formatBRL(usado)}</strong></span>
          <span>Ideal: <strong>${formatBRL(ideal)}</strong></span>
        </div>

        <div class="progress-bar meta-progress">
          <div style="width:${progresso}%; background:${cor};"></div>
        </div>

        <p class="${statusClass}">
          ${status}
        </p>

        ${subcats}

      </div>
    `;
  };

  if (receita === 0) {
    container.innerHTML = `
      <p class="meta-empty">
        Cadastre uma receita no mês para calcular sua regra financeira.
      </p>
    `;
    return;
  }

  atualizarSaudeFinanceira(
    essencialReal, essencialIdeal,
    lazer, lazerIdeal,
    reserva, reservaIdeal
  );

  container.innerHTML = `
  ${montarLinha({
    nome: 'Essenciais',
    percentual: regra.essencial,
    usado: essencialReal,
    ideal: essencialIdeal,
    cor: essencialReal > essencialIdeal ? '#FF6B35' : '#00FFB2',
    tipo: 'limite',
    subcats: montarSubcategorias(dadosExibicao, 'essencial')
  })}

  ${montarLinha({
    nome: 'Reserva',
    percentual: regra.reserva,
    usado: reserva,
    ideal: reservaIdeal,
    cor: '#00D1FF',
    tipo: 'objetivo',
    subcats: montarSubcategorias(dadosExibicao, 'reserva')
  })}

  ${montarLinha({
    nome: 'Lazer',
    percentual: regra.lazer,
    usado: lazer,
    ideal: lazerIdeal,
    cor: lazer > lazerIdeal ? '#FF6B35' : '#FFD700',
    tipo: 'limite',
    subcats: montarSubcategorias(dadosExibicao, 'lazer')
  })}
`;
}