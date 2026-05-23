import { formatBRL } from './utils.js';
import { renderListaTransacoes } from './transactions.js';
import { atualizarCartoesNaTela } from './cards.js';

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

  renderListaTransacoes(dadosExibicao);

  window.renderCategoriasGrafico?.(dadosExibicao);

  let rec = 0;
  let des = 0;
  let res = 0;
  let lazer = 0;

  const CATS_LAZER = ['lazer', 'entretenimento', 'hobbies'];

  dadosExibicao.forEach(t => {
    const valor = Number(t.val) || 0;
    const catNorm = String(t.cat || '').toLowerCase().trim();

    if (t.type === 'income') {
      rec += valor;
    } else if (t.type === 'expense') {
      des += valor;

      if (CATS_LAZER.includes(catNorm)) {
        lazer += valor;
      }
    } else if (t.type === 'goal') {
      res += valor;
    }
  });

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
  atualizarMetasIA(rec, des, res, lazer);
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

function atualizarMetasIA(
  receita,
  despesa = 0,
  reserva = 0,
  lazer = 0
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
              <span class="meta-pct-inline ${
                tipo === 'objetivo'
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

  container.innerHTML = `
    ${montarLinha({
      nome: 'Essenciais',
      percentual: regra.essencial,
      usado: essencialReal,
      ideal: essencialIdeal,
      cor: essencialReal > essencialIdeal ? '#FF6B35' : '#00FFB2',
      tipo: 'limite'
    })}

    ${montarLinha({
      nome: 'Reserva',
      percentual: regra.reserva,
      usado: reserva,
      ideal: reservaIdeal,
      cor: '#00D1FF',
      tipo: 'objetivo'
    })}

    ${montarLinha({
      nome: 'Lazer',
      percentual: regra.lazer,
      usado: lazer,
      ideal: lazerIdeal,
      cor: lazer > lazerIdeal ? '#FF6B35' : '#FFD700',
      tipo: 'limite'
    })}
  `;
}