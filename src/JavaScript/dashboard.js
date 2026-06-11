import { formatBRL } from './utils.js';
import { atualizarCartoesNaTela } from './cards.js';
import { CATS_LAZER } from './state.js';
import { renderListaTransacoes, getFiltroBloco } from './transactions.js';
import { atualizarGraficoDonut, atualizarComparativo } from './charts.js';
import { getMesSelecionado } from './utils.js';
import { isInvoicePaid } from './services/invoiceService.js';

const mesesTexto = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

function atualizarTextoMesSelecionado(ano, mes) {
  const headerDate = document.getElementById('header-date');
  if (!headerDate) return;
  headerDate.textContent = `${mesesTexto[mes]} ${ano} • dashboard pessoal`;
}

export function atualizarDashboard() {
  const select = document.getElementById('filtro-mes');
  if (!select) return;

  const [anoFiltro, mesFiltro] = select.value.split('-').map(Number);

  atualizarTextoMesSelecionado(anoFiltro, mesFiltro);

  const dadosExibicao = (window.transactions || []).filter(t => {
    const d = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : t.createdAt instanceof Date
        ? t.createdAt
        : new Date(t.createdAt);

    return d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro;
  });

  dadosExibicao.sort((a, b) =>
    window.ordemCrescente
      ? Number(a.val) - Number(b.val)
      : Number(b.val) - Number(a.val)
  );

  const bloco = getFiltroBloco();

  const dadosFiltrados = bloco === 'todos'
    ? dadosExibicao
    : dadosExibicao.filter(t => {
      if (t.type === 'income') return bloco === 'todos';
      const catNorm = String(t.cat || '').toLowerCase().trim();
      const blocoTx = t.financialCategory || (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');
      return blocoTx === bloco;
    });

  renderListaTransacoes(dadosFiltrados);
  window.renderCategoriasGrafico?.(dadosExibicao);

  let rec = 0, des = 0, desSaldo = 0, res = 0, lazer = 0, ajusteSaldo = 0;

  function getSaldoCaixinha(caixinha) {
  const totalGasto =
    (window.transactions || [])
      .filter(t =>
        t.type === 'expense' &&
        t.paymentMethod === 'goal' &&
        t.goalPaymentId === caixinha.id
      )
      .reduce((acc, t) => acc + (Number(t.val) || 0), 0);

  return (Number(caixinha.val) || 0) - totalGasto;
}

  dadosExibicao.forEach(t => {
    const valor = Number(t.val) || 0;
    const catNorm = String(t.cat || '').toLowerCase().trim();
    const bloco = t.financialCategory || (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (t.type === 'income') {
      rec += valor;
    } else if (t.type === 'expense') {
      des += valor;
      if (t.paymentMethod !== 'credit' && t.paymentMethod !== 'goal') {
        desSaldo += valor;
      }
      if (bloco === 'lazer') lazer += valor;
    } else if (t.type === 'goal') {
  res += getSaldoCaixinha(t);
} else if (t.type === 'adjustment') {
      ajusteSaldo += valor;
    }
  });

  const faturasPagas = (window.invoicePayments || [])
    .filter(p =>
      Number(p.invoiceYear) === anoFiltro &&
      Number(p.invoiceMonth) === mesFiltro &&
      p.status === 'paid'
    )
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const desImpactoSaldo = desSaldo + faturasPagas;
  const ajustePositivo = Math.max(ajusteSaldo, 0);
  const baseReceitaMetas = rec + ajustePositivo;
  const saldoReal = ajusteSaldo + rec - desImpactoSaldo - res;

  const mesAnterior = mesFiltro === 0 ? 11 : mesFiltro - 1;
  const anoAnterior = mesFiltro === 0 ? anoFiltro - 1 : anoFiltro;

  const faturasPagasAnt = (window.invoicePayments || [])
    .filter(p =>
      Number(p.invoiceYear) === anoAnterior &&
      Number(p.invoiceMonth) === mesAnterior &&
      p.status === 'paid'
    )
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  let recAnt = 0, desAnt = 0, resAnt = 0, lazerAnt = 0;

  (window.transactions || []).forEach(t => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    if (d.getFullYear() !== anoAnterior || d.getMonth() !== mesAnterior) return;

    const valor = Number(t.val) || 0;
    const catNorm = String(t.cat || '').toLowerCase().trim();
    const bloco = t.financialCategory || (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (t.type === 'income') {
      recAnt += valor;
    } else if (t.type === 'expense') {
      if (t.paymentMethod !== 'credit' && t.paymentMethod !== 'goal') desAnt += valor;
      if (bloco === 'lazer') lazerAnt += valor;
    }else if (t.type === 'goal') {
  resAnt += getSaldoCaixinha(t);
}
  });

  const desImpactoSaldoAnt = desAnt + faturasPagasAnt;

  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  atualizarComparativo(
    { rec, des: desImpactoSaldo, res, lazer },
    { rec: recAnt, des: desImpactoSaldoAnt, res: resAnt, lazer: lazerAnt },
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
  if (mesSaldo) mesSaldo.textContent = formatBRL(saldoReal);

  const headerSaldo = document.getElementById('header-saldo-badge');
  if (headerSaldo) {
    headerSaldo.innerHTML = `<span>◈ Saldo: </span> ${formatBRL(saldoReal)}`;
    headerSaldo.style.color = saldoReal >= 0 ? '#00FFB2' : '#FF6B35';
  }

  atualizarInsightSaldo(select, rec, desImpactoSaldo, res);
  atualizarInsightsTopo({ rec: baseReceitaMetas, desImpactoSaldo, res, lazer });
  atualizarMetasIA(baseReceitaMetas, des, res, lazer, dadosExibicao);
  atualizarCartoesNaTela(window.cards || []);
  atualizarPoupanca(baseReceitaMetas, des, res);
  window.atualizarBadgeEventos?.();
}

function atualizarInsightSaldo(select, rec, desImpactoSaldo, res) {
  const insightEl = document.getElementById('insight-saldo');
  if (!insightEl) return;

  const [anoFiltroN, mesFiltroN] = select.value.split('-').map(Number);
  const mesAnterior = mesFiltroN === 0 ? 11 : mesFiltroN - 1;
  const anoAnterior = mesFiltroN === 0 ? anoFiltroN - 1 : anoFiltroN;

  const txMesAnterior = (window.transactions || []).filter(t => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return d.getFullYear() === anoAnterior && d.getMonth() === mesAnterior;
  });

  let recAnt = 0, desAnt = 0, resAnt = 0;

  txMesAnterior.forEach(t => {
    const valor = Number(t.val) || 0;
    if (t.type === 'income') recAnt += valor;
    else if (t.type === 'expense') {
      if (t.paymentMethod !== 'credit' && t.paymentMethod !== 'goal') desAnt += valor;
    } else if (t.type === 'goal') resAnt += valor;
  });

  const faturasPagasAnt = (window.invoicePayments || [])
    .filter(p =>
      Number(p.invoiceYear) === anoAnterior &&
      Number(p.invoiceMonth) === mesAnterior &&
      p.status === 'paid'
    )
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const saldoAtual = rec - desImpactoSaldo - res;
  const saldoAnterior = recAnt - desAnt - resAnt - faturasPagasAnt;

  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  if (!txMesAnterior.length) {
    insightEl.textContent = '';
  } else if (saldoAtual > saldoAnterior) {
    const diff = Math.round(((saldoAtual - saldoAnterior) / Math.abs(saldoAnterior || 1)) * 100);
    insightEl.textContent = `↑ ${diff}% melhor que ${mesesNomes[mesAnterior]}`;
    insightEl.className = 'insight-saldo insight--positivo';
  } else if (saldoAtual < saldoAnterior) {
    const diff = Math.round(((saldoAnterior - saldoAtual) / Math.abs(saldoAnterior || 1)) * 100);
    insightEl.textContent = `↓ ${diff}% pior que ${mesesNomes[mesAnterior]}`;
    insightEl.className = 'insight-saldo insight--negativo';
  } else {
    insightEl.textContent = `= igual a ${mesesNomes[mesAnterior]}`;
    insightEl.className = 'insight-saldo insight--neutro';
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
    if (t.type !== 'expense' && t.type !== 'goal' && t.type !== 'adjustment') return;
    if (t.type === 'adjustment' && Number(t.val) > 0) return;

    const catNorm = String(t.cat || '').toLowerCase().trim();
    const bloco = t.financialCategory || (CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial');

    if (bloco !== blocoAlvo) return;
    if (t.type === 'goal' && blocoAlvo !== 'reserva') return;

    let valorSubcat = Number(t.val) || 0;

if (t.type === 'goal') {
  const totalGasto =
    (window.transactions || [])
      .filter(g =>
        g.type === 'expense' &&
        g.paymentMethod === 'goal' &&
        g.goalPaymentId === t.id
      )
      .reduce((acc, g) => acc + (Number(g.val) || 0), 0);

  valorSubcat -= totalGasto;
}

    const cat = t.cat || 'Outros';
    totais[cat] =
  (totais[cat] || 0) + valorSubcat;
  });

  const itens = Object.entries(totais).sort((a, b) => b[1] - a[1]);
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
  if (essencialReal <= essencialIdeal) pontos++;
  if (lazer <= lazerIdeal) pontos++;
  if (reserva >= reservaIdeal) pontos++;

  const config = {
    3: { label: '● Saudável', classe: 'saude--verde' },
    2: { label: '● Atenção', classe: 'saude--amarelo' },
    1: { label: '● Crítico', classe: 'saude--vermelho' },
    0: { label: '● Crítico', classe: 'saude--vermelho' }
  };

  const { label, classe } = config[pontos];
  badge.textContent = label;
  badge.className = `saude-badge ${classe}`;
}

function atualizarMetasIA(receita, despesa = 0, reserva = 0, lazer = 0, dadosExibicao = []) {
  const container = document.getElementById('metas-container');
  if (!container) return;

  receita = Number(receita) || 0;
  despesa = Number(despesa) || 0;
  reserva = Number(reserva) || 0;
  lazer = Number(lazer) || 0;

  const regra = window.regraFinanceira || { essencial: 70, reserva: 20, lazer: 10 };
  const essencialReal = despesa - lazer;
  const essencialIdeal = receita * (regra.essencial / 100);
  const reservaIdeal = receita * (regra.reserva / 100);
  const lazerIdeal = receita * (regra.lazer / 100);

  const tituloRegra = document.getElementById('titulo-regra-financeira');
  if (tituloRegra) tituloRegra.textContent = `Regra ${regra.essencial}/${regra.reserva}/${regra.lazer}`;

  const montarLinha = ({ nome, percentual, usado, ideal, cor, subcats = '', tipo }) => {
    const usadoPercentual = receita > 0 ? (usado / receita) * 100 : 0;
    const progresso = ideal > 0 ? Math.min((usado / ideal) * 100, 100) : 0;

    let status = '', statusClass = '';

    if (tipo === 'limite') {
      if (usado > ideal) {
        status = `Passou ${formatBRL(usado - ideal)} do recomendado`;
        statusClass = 'meta-status danger';
      } else {
        status = `Ainda pode usar ${formatBRL(ideal - usado)}`;
        statusClass = 'meta-status ok';
      }
    }

    if (tipo === 'objetivo') {
      if (usado >= ideal) {
        status = 'Meta atingida';
        statusClass = 'meta-status ok';
      } else {
        status = `Faltam ${formatBRL(ideal - usado)} para a meta`;
        statusClass = 'meta-status warning';
      }
    }

    return `
      <div class="meta-card-line">
        <div class="meta-line-top">
          <div>
            <strong>
              ${nome}
              <span class="meta-pct-inline ${tipo === 'objetivo' ? 'meta-pct-info' : usado > ideal ? 'meta-pct-warn' : 'meta-pct-ok'}">
                ${usadoPercentual.toFixed(0)}%
              </span>
            </strong>
            <span>${percentual}% da receita</span>
          </div>
          <b style="color:${cor}">${usadoPercentual.toFixed(1)}%</b>
        </div>
        <div class="meta-money-row">
          <span>Usado: <strong>${formatBRL(usado)}</strong></span>
          <span>Ideal: <strong>${formatBRL(ideal)}</strong></span>
        </div>
        <div class="progress-bar meta-progress">
          <div style="width:${progresso}%; background:${cor};"></div>
        </div>
        <p class="${statusClass}">${status}</p>
        ${subcats}
      </div>
    `;
  };

  if (receita === 0) {
    container.innerHTML = `<p class="meta-empty">Cadastre uma receita no mês para calcular sua regra financeira.</p>`;
    return;
  }

  atualizarSaudeFinanceira(essencialReal, essencialIdeal, lazer, lazerIdeal, reserva, reservaIdeal);

  container.innerHTML = `
    ${montarLinha({ nome: 'Essenciais', percentual: regra.essencial, usado: essencialReal, ideal: essencialIdeal, cor: essencialReal > essencialIdeal ? '#FF6B35' : '#00FFB2', tipo: 'limite', subcats: montarSubcategorias(dadosExibicao, 'essencial') })}
    ${montarLinha({ nome: 'Reserva', percentual: regra.reserva, usado: reserva, ideal: reservaIdeal, cor: '#00D1FF', tipo: 'objetivo', subcats: montarSubcategorias(dadosExibicao, 'reserva') })}
    ${montarLinha({ nome: 'Lazer', percentual: regra.lazer, usado: lazer, ideal: lazerIdeal, cor: lazer > lazerIdeal ? '#FF6B35' : '#FFD700', tipo: 'limite', subcats: montarSubcategorias(dadosExibicao, 'lazer') })}
  `;
}

function gerarProximosEventos(cards = []) {
  const hoje = new Date();
  const { ano, mes } = getMesSelecionado();

  return cards.flatMap(card => {
    const faturaPaga = isInvoicePaid({
      payments: window.invoicePayments || [],
      cardId: card.id,
      invoiceYear: ano,
      invoiceMonth: mes
    });

    let fechamento = new Date(hoje.getFullYear(), hoje.getMonth(), Number(card.closingDay));
    if (fechamento < hoje) fechamento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Number(card.closingDay));

    let vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), Number(card.dueDay));
    if (vencimento < hoje) vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Number(card.dueDay));

    const eventos = [{ tipo: 'fechamento', cardId: card.id, cardName: card.name, data: fechamento }];
    if (!faturaPaga) eventos.push({ tipo: 'vencimento', cardId: card.id, cardName: card.name, data: vencimento });

    return eventos;
  }).sort((a, b) => a.data - b.data);
}

window.toggleEventosCartao = function () {
  const drawer = document.getElementById('eventsDrawer');
  const lista = document.getElementById('eventsList');
  const backdrop =
    document.getElementById('eventsBackdrop');

  document.getElementById('alertDrawer')?.classList.remove('open');
  document.getElementById('alertBackdrop')?.classList.remove('active');
  document.getElementById('alertDrawer')?.setAttribute('aria-hidden', 'true');
  alertDrawerOpen = false;

  if (!drawer || !lista) return;

  const isOpen = drawer.classList.contains('active');

  if (isOpen) {
    window.fecharEventosCartao?.();
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const eventos =
    gerarProximosEventos(window.cards || [])
      .filter(evento => evento.data >= hoje);

  _syncEventsBadge(eventos.length);

  lista.innerHTML = eventos.slice(0, 5).length
    ? eventos.slice(0, 5).map(evento => {
      const diasRestantes =
        Math.ceil((evento.data - hoje) / (1000 * 60 * 60 * 24));

      const descricao =
        evento.tipo === 'fechamento'
          ? diasRestantes <= 0
            ? 'Fecha hoje'
            : diasRestantes === 1
              ? 'Fecha amanhã'
              : `Fecha em ${diasRestantes} dias`
          : diasRestantes <= 0
            ? 'Vence hoje'
            : diasRestantes === 1
              ? 'Vence amanhã'
              : `Vence em ${diasRestantes} dias`;

      return `
        <div class="event-item">
          <div>
            <strong>${evento.cardName}</strong>
            <div class="event-date">${descricao}</div>
          </div>

          <span class="event-type ${evento.tipo}">
            ${evento.tipo === 'fechamento' ? 'Fecha' : 'Vence'}
          </span>
        </div>
      `;
    }).join('')
    : `
      <div class="alert-empty">
        <i class="ph ph-check-circle"></i>
        Nenhum evento próximo
      </div>
    `;

  drawer.classList.add('active');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop?.classList.add('active');
};

window.fecharEventosCartao = function () {
  const drawer = document.getElementById('eventsDrawer');
  const backdrop = document.getElementById('eventsBackdrop');

  drawer?.classList.remove('active');
  drawer?.setAttribute('aria-hidden', 'true');
  backdrop?.classList.remove('active');
};

document.getElementById('eventsBackdrop')?.addEventListener('click', () => {
  window.fecharEventosCartao?.();
});

const alertasDismissed = new Set();
let alertDrawerOpen = false;

window.toggleAlertDrawer = function () {
  const wrap = document.getElementById('alertDrawer');
  const btn = document.getElementById('bellBtn');
  const backdrop = document.getElementById('alertBackdrop');

  const eventsDrawer = document.getElementById('eventsDrawer');

  if (!wrap || !btn) return;

  // fecha eventos antes de abrir alertas
  eventsDrawer?.classList.remove('active');
  eventsDrawer?.setAttribute('aria-hidden', 'true');

  alertDrawerOpen = !alertDrawerOpen;

  wrap.classList.toggle('open', alertDrawerOpen);
  backdrop?.classList.toggle('active', alertDrawerOpen);

  btn.setAttribute('aria-expanded', String(alertDrawerOpen));
  wrap.setAttribute('aria-hidden', String(!alertDrawerOpen));
};
window.fecharAlertDrawer = function () {
  const wrap = document.getElementById('alertDrawer');
  const btn = document.getElementById('bellBtn');
  const backdrop = document.getElementById('alertBackdrop');

  alertDrawerOpen = false;

  wrap?.classList.remove('open');
  backdrop?.classList.remove('active');

  btn?.setAttribute('aria-expanded', 'false');
  wrap?.setAttribute('aria-hidden', 'true');
};

document.getElementById('alertBackdrop')?.addEventListener('click', () => {
  window.fecharAlertDrawer?.();
});

window.clearAllAlerts = function () {
  const list =
    document.getElementById('alertList');

  if (!list) return;

  list
    .querySelectorAll('.alert-item')
    .forEach(el => {
      alertasDismissed.add(el.dataset.id);
      _dismissItem(el);
    });

  _syncBadge(0);
};

function _dismissItem(el) {
  el.style.opacity = '0';
  el.style.maxHeight = `${el.offsetHeight}px`;

  requestAnimationFrame(() => {
    el.style.maxHeight = '0';
    el.style.paddingTop = '0';
    el.style.paddingBottom = '0';
  });

  setTimeout(() => {
    el.remove();

    const list =
      document.getElementById('alertList');

    const count =
      list ? list.querySelectorAll('.alert-item').length : 0;

    _syncBadge(count);
  }, 260);
}

function _syncBadge(count) {
  const badge =
    document.getElementById('alertBadge');

  const label =
    document.getElementById('alertDrawerLabel');

  const empty =
    document.getElementById('alertEmpty');

  const list =
    document.getElementById('alertList');

  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  if (label) {
    label.textContent =
      count > 0
        ? `${count} alerta${count > 1 ? 's' : ''} ativo${count > 1 ? 's' : ''}`
        : 'Sem alertas';
  }

  if (empty && list) {
    const temItens =
      list.querySelectorAll('.alert-item').length > 0;

    empty.style.display =
      temItens ? 'none' : 'flex';
  }
}

function _getUpcomingEventsCount() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return gerarProximosEventos(window.cards || [])
    .filter(evento => evento.data >= hoje)
    .length;
}

function _syncEventsBadge(count) {
  const badge = document.getElementById('eventsBadge');
  if (!badge) return;

  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

window.atualizarBadgeEventos = function () {
  _syncEventsBadge(_getUpcomingEventsCount());
};

function _renderAlertItem({ id, texto, severity }) {
  const list =
    document.getElementById('alertList');

  if (!list) return;

  if (alertasDismissed.has(id)) return;

  const existing =
    list.querySelector(`[data-id="${id}"]`);

  if (existing) {
    const textEl =
      existing.querySelector('.alert-item-text');

    if (textEl) textEl.textContent = texto;

    return;
  }

  const chipClass =
    severity === 'danger' ? 'danger' : 'warn';

  const chipLabel =
    severity === 'danger' ? 'Crítico' : 'Atenção';

  const div =
    document.createElement('div');

  div.className = 'alert-item';
  div.dataset.id = id;

  div.innerHTML = `
    <span class="alert-dot ${chipClass}"></span>

    <span class="alert-item-text">
      ${texto}
    </span>

    <span class="alert-chip ${chipClass}">
      ${chipLabel}
    </span>

    <button
      type="button"
      class="alert-dismiss-btn"
      aria-label="Dispensar alerta"
    >
      <i class="ph ph-x"></i>
    </button>
  `;

  div
    .querySelector('.alert-dismiss-btn')
    ?.addEventListener('click', () => {
      alertasDismissed.add(id);
      _dismissItem(div);
    });

  const empty =
    document.getElementById('alertEmpty');

  if (empty) empty.style.display = 'none';

  list.appendChild(div);
}

export function atualizarInsightsTopo(dadosMesAtual = {}) {
  const receitas =
    Number(dadosMesAtual.rec) || 0;

  const desImpactoSaldo =
    Number(dadosMesAtual.desImpactoSaldo) || 0;

  const lazer =
    Number(dadosMesAtual.lazer) || 0;

  const reserva =
    Number(dadosMesAtual.res) || 0;

  const saldo =
    receitas - desImpactoSaldo - reserva;

  const alertasAtivos = [];

  if (saldo < 0) {
    alertasAtivos.push({
      id: 'saldo-negativo',
      texto: `Despesas superam receitas em ${formatBRL(Math.abs(saldo))}`,
      severity: 'danger'
    });
  }

  if (receitas > 0 && reserva / receitas < 0.1) {
    alertasAtivos.push({
      id: 'reserva-baixa',
      texto: 'Reserva está abaixo dos 10% recomendados.',
      severity: 'warn'
    });
  }

  if (receitas > 0 && lazer / receitas > 0.1) {
    alertasAtivos.push({
      id: 'lazer-alto',
      texto: 'Lazer passou de 10% da receita.',
      severity: 'warn'
    });
  }

  const list =
    document.getElementById('alertList');

  if (list) {
    list
      .querySelectorAll('.alert-item')
      .forEach(el => {
        const ativo =
          alertasAtivos.find(a => a.id === el.dataset.id);

        if (!ativo) {
          alertasDismissed.delete(el.dataset.id);
          _dismissItem(el);
        }
      });
  }

  const visiveis =
    alertasAtivos.filter(a => !alertasDismissed.has(a.id));

  visiveis.forEach(_renderAlertItem);

  setTimeout(() => {
    const count =
      list ? list.querySelectorAll('.alert-item').length : 0;

    _syncBadge(count);
  }, 50);
}

