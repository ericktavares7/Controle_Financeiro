import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import './transactions.css';
import './auth.css';
import './responsive.css';

import Chart from 'chart.js/auto';

import {
  db,
  auth,
  addTransaction,
  login,
  register,
  addCreditCard,
  listenCreditCards,
  saveUserSettings,
  getUserSettings,
  updateCreditCard,
  deleteCreditCard,
  updateTransaction,
  deleteInstallmentGroup
} from './firebase.js';

import { deleteDoc, doc, Timestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";

/* ========================================
   ESTADO GLOBAL
======================================== */

window.cards = [];
window.transactions = [];

window.regraFinanceira = {
  essencial: 70,
  reserva: 20,
  lazer: 10
};

let ordemCrescente = false;
let isRegister = false;
let unsubscribeCards = null;

/* ========================================
   CATEGORIAS
======================================== */

const categoriasPorTipo = {
  income: [
    "Salário",
    "Freelance",
    "Investimentos",
    "Presente",
    "Venda",
    "Outros"
  ],

  expense: [
    "Alimentação",
    "Transporte",
    "Moradia",
    "Lazer",
    "Saúde",
    "Educação",
    "Outros"
  ],

  goal: [
    "Reserva de Emergência",
    "Meta de Compra",
    "Aposentadoria",
    "Viagem"
  ]
};

/* ========================================
   AUTH / LOGOUT
======================================== */

window.logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
};

window.updateUserHeader = (user) => {
  const userName = document.getElementById('header-user-name');

  if (!userName || !user) return;

  const nome =
    user.displayName ||
    user.email?.split('@')[0] ||
    'Usuário';

  userName.textContent = nome;
};

/* ========================================
   MENSAGENS AUTH
======================================== */

function showAuthMessage(message, type = 'error') {
  const container = document.getElementById('auth-message');

  if (!container) return;

  container.innerHTML = `
    <div class="auth-message ${type}">
      <span class="auth-message-icon">
        ${type === 'error' ? '⚠' : '✓'}
      </span>

      <span>
        ${message}
      </span>
    </div>
  `;

  setTimeout(() => {
    container.innerHTML = '';
  }, 4000);
}

/* ========================================
   HELPERS
======================================== */

const formatBRL = (v) =>
  Number(v || 0).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL'
    }
  );

const formatDate = (date) => {
  if (!date) return "--/--/--";

  const d =
    date.toDate
      ? date.toDate()
      : date instanceof Date
        ? date
        : new Date(date);

  return d.toLocaleDateString('pt-BR');
};

function calcularDataFatura(dataCompra, fechamento, vencimento) {
  const data = new Date(dataCompra);

  let ano = data.getFullYear();
  let mes = data.getMonth();

  if (data.getDate() > fechamento) {
    mes += 1;
  }

  return new Date(ano, mes, vencimento);
}

function getMesSelecionado() {
  const select = document.getElementById('filtro-mes');

  if (!select) {
    const hoje = new Date();

    return {
      ano: hoje.getFullYear(),
      mes: hoje.getMonth()
    };
  }

  const [ano, mes] = select.value.split('-').map(Number);

  return { ano, mes };
}

function calcularFaturaAtualDoCartao(cardId) {
  const { ano, mes } = getMesSelecionado();

  return (window.transactions || []).reduce((total, t) => {
    if (
      t.type !== 'expense' ||
      t.paymentMethod !== 'credit' ||
      t.cardId !== cardId
    ) {
      return total;
    }

    const data =
      t.createdAt?.toDate
        ? t.createdAt.toDate()
        : new Date(t.createdAt);

    const pertenceAoMes =
      data.getFullYear() === ano &&
      data.getMonth() === mes;

    if (!pertenceAoMes) return total;

    return total + (Number(t.val) || 0);
  }, 0);
}

function atualizarTextoMesSelecionado(ano, mes) {
  const headerDate = document.getElementById('header-date');

  if (!headerDate) return;

  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  headerDate.textContent = `${meses[mes]} ${ano} • dashboard pessoal`;
}

/* ========================================
   MODAIS
======================================== */

window.abrirModal = (tipo) => {
  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  const selectCat = document.getElementById('input-cat');
  const modalContent = modal?.querySelector('.modal-content');

  if (!modal || !inputTipo || !selectCat) return;

  window.fecharBottomPanels?.();

  document.body.style.overflow = 'hidden';

  inputTipo.value = tipo;

  if (modalContent) {
    modalContent.classList.remove(
      'borda-receita',
      'borda-despesa',
      'borda-caixinha'
    );

    const classeBorda =
      tipo === 'income'
        ? 'borda-receita'
        : tipo === 'expense'
          ? 'borda-despesa'
          : 'borda-caixinha';

    modalContent.classList.add(classeBorda);
  }

  selectCat.innerHTML = '';

  const lista = categoriasPorTipo[tipo] || [];

  lista.forEach(cat => {
    const option = document.createElement('option');

    option.value = cat;
    option.textContent = cat;

    selectCat.appendChild(option);
  });

  const paymentGroup = document.getElementById('payment-method-group');
  const creditCardGroup = document.getElementById('credit-card-group');
  const inputPayment = document.getElementById('input-payment');
  const inputCard = document.getElementById('input-card');

  if (tipo === 'expense') {
    paymentGroup?.classList.remove('hidden');
  } else {
    paymentGroup?.classList.add('hidden');
    creditCardGroup?.classList.add('hidden');

    if (inputPayment) inputPayment.value = 'debit';
    if (inputCard) inputCard.value = '';
  }

  modal.classList.add('active');
};

window.fecharModal = () => {
  const modal = document.getElementById('modal-registro');

  if (!modal) return;

  modal.classList.remove('active');

  document.body.style.overflow = '';
};

window.abrirModalCartao = () => {
  const modal = document.getElementById('modal-cartao');

  if (!modal) return;

  window.fecharBottomPanels?.();

  document.body.classList.add('modal-open');

  modal.classList.add('active');
};

window.fecharModalCartao = () => {
  const modal = document.getElementById('modal-cartao');

  if (!modal) return;

  modal.classList.remove('active');

  document.body.classList.remove('modal-open');
};

/* ========================================
   CLIQUE FORA DOS MODAIS
======================================== */

document.addEventListener('click', (e) => {
  const modalRegistro = document.getElementById('modal-registro');
  const modalCartao = document.getElementById('modal-cartao');

  if (e.target === modalRegistro) {
    window.fecharModal();
  }

  if (e.target === modalCartao) {
    window.fecharModalCartao();
  }
});

/* ========================================
   DELETAR TRANSAÇÃO
======================================== */

window.abrirConfirmacaoSimples = ({
  title = 'Confirmar ação?',
  text = 'Essa ação não poderá ser desfeita.',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm
}) => {
  const modal = document.getElementById('modal-confirmacao');
  const titleEl = document.getElementById('confirm-title');
  const textEl = document.getElementById('confirm-text');
  const btnPrimary = document.getElementById('confirm-primary');
  const btnSecondary = document.getElementById('confirm-secondary');

  if (!modal || !titleEl || !textEl || !btnPrimary || !btnSecondary) {
    console.error('Modal de confirmação não encontrado.');
    return;
  }

  titleEl.textContent = title;
  textEl.textContent = text;

  btnPrimary.textContent = confirmText;
  btnSecondary.textContent = cancelText;

  const btnCancelBottom = document.querySelector('.confirm-cancel');
  if (btnCancelBottom) btnCancelBottom.style.display = 'none';

  btnPrimary.onclick = async () => {
    await onConfirm?.();
    window.fecharConfirmacao();
  };

  btnSecondary.onclick = () => {
    window.fecharConfirmacao();
  };


  requestAnimationFrame(() => {
    modal.classList.add('active');
  });
};

window.fecharConfirmacao = () => {
  document
    .getElementById('modal-confirmacao')
    ?.classList.remove('active');
};

window.abrirConfirmacaoParcelas = ({
  onDeleteAll,
  onDeleteOne
}) => {
  const modal = document.getElementById('modal-confirmacao');
  const btnAll = document.getElementById('confirm-primary');
  const btnOne = document.getElementById('confirm-secondary');
  const btnCancelBottom = document.querySelector('.confirm-cancel');

  document.getElementById('confirm-title').textContent = 'Excluir dívida?';
  document.getElementById('confirm-text').textContent =
    'Essa despesa possui parcelas futuras.';

  btnOne.textContent = 'Apenas esta';
  btnAll.textContent = 'Excluir tudo';

  if (btnCancelBottom) btnCancelBottom.style.display = 'block';

  btnAll.onclick = async () => {
    await onDeleteAll?.();
    window.fecharConfirmacao();
  };

  btnOne.onclick = async () => {
    await onDeleteOne?.();
    window.fecharConfirmacao();
  };

  requestAnimationFrame(() => {
    modal?.classList.add('active');
  });
};

window.deletarTransacao = async (id) => {
  const tx = (window.transactions || []).find(t => t.id === id);

  if (!tx) {
    console.error('Transação não encontrada:', id);
    return;
  }

  try {
    if (tx.installmentGroupId) {
      window.abrirConfirmacaoParcelas({
        onDeleteAll: async () => {
          await deleteInstallmentGroup(tx.installmentGroupId);
        },

        onDeleteOne: async () => {
          await deleteDoc(doc(db, "transacoes", id));
        }
      });

      return;
    }

    window.abrirConfirmacaoSimples({
      title: 'Excluir transação?',
      text: 'Essa ação removerá este lançamento do seu histórico.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',

      onConfirm: async () => {
        await deleteDoc(doc(db, "transacoes", id));
      }
    });

  } catch (e) {
    console.error("Erro ao excluir:", e);
  }
};

/* ========================================
   CARTÕES
======================================== */

function atualizarCartoesNaTela(cards) {
  window.cards = cards;

  const selectCard = document.getElementById('input-card');
  const walletList = document.getElementById('wallet-cards-list');

  if (selectCard) {
    selectCard.innerHTML = `
      <option value="">Selecione um cartão</option>

      ${cards.map(card => `
        <option value="${card.id}">
          ${card.name || 'Cartão sem nome'}
        </option>
      `).join('')}
    `;
  }

  if (walletList) {
    walletList.innerHTML = cards.length
      ? cards.map((card, index) => `
    <div class="wallet-credit-card card-color-${card.colorIndex ?? index % 4}">

      <div class="wallet-card-top">

        <span>
          ${card.name || 'Cartão sem nome'}
        </span>

        <div class="wallet-card-actions">

          <i class="ph ph-credit-card"></i>

          <button
  type="button"
  class="wallet-card-config"
  data-card-id="${card.id}"
>
  <i class="ph ph-gear-six"></i>
</button> 

        </div>

      </div>

      <div class="wallet-card-invoice">
  <small>Fatura do mês</small>

  <strong>
    ${formatBRL(calcularFaturaAtualDoCartao(card.id))}
  </strong>
</div>

      <div class="wallet-card-footer">
        <small>
          Fecha dia ${card.closingDay || '--'}
        </small>

        <small>
          Vence dia ${card.dueDay || '--'}
        </small>
      </div>

    </div>
  `).join('')
      : `<p class="msg-vazio">Nenhum cartão cadastrado.</p>`;
  }
}

window.abrirEditorCartao = (cardId) => {
  const card = (window.cards || []).find(c => c.id === cardId);

  if (!card) {
    console.error('Cartão não encontrado:', cardId, window.cards);
    return;
  }

  const modal = document.getElementById('modal-editar-cartao');

  if (!modal) {
    console.error('Modal editar cartão não encontrado no HTML');
    return;
  }

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-name').value = card.name || '';
  document.getElementById('edit-card-closing').value = card.closingDay || '';
  document.getElementById('edit-card-due').value = card.dueDay || '';
  document.getElementById('edit-card-color').value = card.colorIndex ?? 0;

  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    modal.classList.add('active');
  });
};

window.fecharEditorCartao = () => {
  document.getElementById('modal-editar-cartao')?.classList.remove('active');
  document.body.classList.remove('modal-open');
};

window.removerCartaoAtual = async () => {
  const cardId = document.getElementById('edit-card-id')?.value;

  if (!cardId) return;

  const confirmar = confirm('Remover este cartão? As transações antigas continuarão salvas.');

  if (!confirmar) return;

  await deleteCreditCard(cardId);

  window.fecharEditorCartao();
};

window.initCardsListener = (uid) => {
  if (unsubscribeCards) {
    unsubscribeCards();
  }

  unsubscribeCards = listenCreditCards(
    uid,
    atualizarCartoesNaTela
  );
};

/* ========================================
   DASHBOARD
======================================== */

window.atualizarDashboard = () => {
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
    return ordemCrescente
      ? Number(a.val) - Number(b.val)
      : Number(b.val) - Number(a.val);
  });

  renderListaTransacoes(dadosExibicao);
  renderCategoriasGrafico(dadosExibicao);

  let rec = 0;
  let des = 0;
  let res = 0;
  let lazer = 0;

  dadosExibicao.forEach(t => {
    const valor = Number(t.val) || 0;

    if (t.type === 'income') {
      rec += valor;
    }

    else if (t.type === 'expense') {
      des += valor;

      if (String(t.cat).toLowerCase() === 'lazer') {
        lazer += valor;
      }
    }

    else if (t.type === 'goal') {
      res += valor;
    }
  });

  const mesReceita = document.getElementById('mes-receita');
  const mesDespesa = document.getElementById('mes-despesa');
  const mesSaldo = document.getElementById('mes-saldo');

  if (mesReceita) mesReceita.textContent = formatBRL(rec);
  if (mesDespesa) mesDespesa.textContent = formatBRL(des);
  if (mesSaldo) mesSaldo.textContent = formatBRL(rec - des - res);

  atualizarMetasIA(rec, des, res, lazer);
  atualizarCartoesNaTela(window.cards || []);
  atualizarPoupanca(rec, des, res);
};

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

function atualizarMetasIA(receita, despesa = 0, reserva = 0, lazer = 0) {
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

  const montarMeta = (nome, meta, atual, cor, alerta = false) => {
    const largura = Math.min(atual, 100);

    return `
      <div class="meta-item">
        <div class="meta-header">
          <span>${nome} (${meta}%)</span>
          <span style="color:${alerta ? '#FF6B35' : cor}">
            ${atual.toFixed(1)}%
          </span>
        </div>

        <div class="progress-bar">
          <div style="
            width:${largura}%;
            background:${alerta ? '#FF6B35' : cor};
          "></div>
        </div>
      </div>
    `;
  };

  if (receita === 0) {
    container.innerHTML = `
      ${montarMeta('Essencial', regra.essencial, 0, '#00FFB2')}
      ${montarMeta('Reserva', regra.reserva, 0, '#00D1FF')}
      ${montarMeta('Lazer', regra.lazer, 0, '#FFD700')}
    `;
    return;
  }

  const pEssencial = (despesa / receita) * 100;
  const pReserva = (reserva / receita) * 100;
  const pLazer = (lazer / receita) * 100;

  container.innerHTML = `
    ${montarMeta(
    'Essencial',
    regra.essencial,
    pEssencial,
    '#00FFB2',
    pEssencial > regra.essencial
  )}

    ${montarMeta(
    'Reserva',
    regra.reserva,
    pReserva,
    '#00D1FF',
    pReserva < regra.reserva
  )}

    ${montarMeta(
    'Lazer',
    regra.lazer,
    pLazer,
    '#FFD700',
    pLazer > regra.lazer
  )}
  `;
}
/* ========================================
   CATEGORIAS
======================================== */

window.destacarCategoria = (nomeCat) => {
  const btnTransacoes =
    document.querySelector('[data-tab="transacoes"]');

  if (btnTransacoes) {
    btnTransacoes.click();
  }

  setTimeout(() => {
    const classeBusca =
      `.cat-${nomeCat.replace(/\s+/g, '-')}`;

    const itens =
      document.querySelectorAll(classeBusca);

    if (!itens.length) return;

    itens.forEach(item => {
      item.classList.add('tx-highlight-soft');
    });

    itens[0].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    setTimeout(() => {
      itens.forEach(item => {
        item.classList.remove('tx-highlight-soft');
      });
    }, 2000);
  }, 150);
};

function renderCategoriasGrafico(lista) {
  const containers = [
    document.getElementById('categoryList'),
    document.getElementById('mes-categorias')
  ].filter(Boolean);

  if (!containers.length) return;

  const totais = {};

  lista.forEach(t => {
    const cat = t.cat || 'Geral';

    if (!totais[cat]) {
      totais[cat] = {
        valor: 0,
        tipo: t.type
      };
    }

    totais[cat].valor += Number(t.val) || 0;
  });

  const categoriasArray =
    Object.entries(totais)
      .sort((a, b) => b[1].valor - a[1].valor);

  const maiorValor =
    Math.max(
      ...categoriasArray.map(c => c[1].valor),
      0
    );

  const html =
    categoriasArray.length
      ? categoriasArray.map(([cat, info]) => {
        const porc =
          maiorValor > 0
            ? (info.valor / maiorValor) * 100
            : 0;

        const cor =
          info.tipo === 'income'
            ? '#00FFB2'
            : info.tipo === 'goal'
              ? '#00D1FF'
              : '#FF6B35';

        return `
          <div class="category-bar-item" onclick="window.destacarCategoria('${cat}')">
            <div class="bar-info">
              <span>${cat}</span>
              <b>${formatBRL(info.valor)}</b>
            </div>

            <div class="bar-bg">
              <div class="bar-fill" style="width:${porc}%; background:${cor};"></div>
            </div>
          </div>
        `;
      }).join('')
      : `<p class="msg-vazio">Nenhuma categoria registrada ainda.</p>`;

  containers.forEach(container => {
    container.innerHTML = html;
  });
}

/* ========================================
   LISTA DE TRANSAÇÕES
======================================== */

function renderListaTransacoes(lista) {
  const cRec = document.getElementById('lista-receitas-historico');
  const cDes = document.getElementById('lista-despesas-historico');

  if (!cRec || !cDes) return;

  const template = (t) => {
    const categoriaClasse =
      `cat-${(t.cat || 'Geral').replace(/\s+/g, '-')}`;

    const income = t.type === 'income';
    const goal = t.type === 'goal';

    const sinal =
      income
        ? '+'
        : goal
          ? '◆'
          : '-';

    const paymentInfo =
      t.paymentMethod === 'credit'
        ? ' • Cartão'
        : t.paymentMethod === 'debit'
          ? ' • Débito/Pix'
          : '';

    return `
      <div class="tx-item ${categoriaClasse}" id="tx-${t.id}">
        <div class="tx-info">
          <span class="tx-desc">
            ${t.desc}
          </span>

          <span class="tx-meta">
            ${t.cat || 'Geral'}${paymentInfo} • ${formatDate(t.createdAt)}
          </span>
        </div>

        <div class="tx-right">
          <span class="tx-val ${income ? 'tx-val--income' : goal ? 'tx-val--goal' : 'tx-val--expense'}">
             ${sinal} ${formatBRL(t.val)}
           </span>

          <button
             class="btn-edit-tx"
             data-tx-id="${t.id}"
             >
            <i class="ph ph-pencil-simple"></i>
          </button>

          <button
            class="tx-delete"
            onclick="window.deletarTransacao('${t.id}')"
          >
            ✕
          </button>
        </div>
      </div>
    `;
  };

  const receitas =
    lista.filter(t => t.type === 'income');

  const despesas =
    lista.filter(t => t.type !== 'income');

  cRec.innerHTML =
    receitas.length
      ? receitas.map(template).join('')
      : `<p class="msg-vazio">Sem receitas</p>`;

  cDes.innerHTML =
    despesas.length
      ? despesas.map(template).join('')
      : `<p class="msg-vazio">Sem despesas</p>`;
}

/* ========================================
   GRÁFICO EVOLUÇÃO
======================================== */

window.atualizarGrafico = (chart, todasTransactions) => {
  if (!chart) return;

  if (!todasTransactions || todasTransactions.length === 0) {
    chart.data.labels = [];

    chart.data.datasets.forEach(dataset => {
      dataset.data = [];
    });

    chart.update();

    return;
  }

  const mesesNomes = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez'
  ];

  const mesesChaves = [
    ...new Set(
      todasTransactions.map(t => {
        const d =
          t.createdAt?.toDate
            ? t.createdAt.toDate()
            : new Date(t.createdAt);

        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    )
  ].sort();

  const labels = [];
  const ganhos = [];
  const gastos = [];
  const caixinhas = [];

  mesesChaves.forEach(chave => {
    const [ano, mes] =
      chave.split('-').map(Number);

    labels.push(
      `${mesesNomes[mes]}/${ano.toString().slice(-2)}`
    );

    let receitas = 0;
    let despesas = 0;
    let reservas = 0;

    todasTransactions.forEach(t => {
      const d =
        t.createdAt?.toDate
          ? t.createdAt.toDate()
          : new Date(t.createdAt);

      if (
        d.getFullYear() === ano &&
        d.getMonth() === mes
      ) {
        if (t.type === 'income') {
          receitas += Number(t.val) || 0;
        }

        if (t.type === 'expense') {
          despesas += Number(t.val) || 0;
        }

        if (t.type === 'goal') {
          reservas += Number(t.val) || 0;
        }
      }
    });

    ganhos.push(receitas);
    gastos.push(despesas);
    caixinhas.push(reservas);
  });

  chart.data.labels = labels;

  chart.data.datasets[0].data = ganhos;
  chart.data.datasets[1].data = gastos;
  chart.data.datasets[2].data = caixinhas;

  chart.update();
};

/* ========================================
   FILTRO ORDEM
======================================== */

window.alternarOrdemFiltro = () => {
  ordemCrescente = !ordemCrescente;

  const btn = document.getElementById('btn-ordem');

  if (btn) {
    btn.innerHTML = ordemCrescente ? '▲' : '▼';
  }

  try {
    window.atualizarDashboard();
  } catch (e) {
    console.error(e);
  }
};

window.salvarRegraFinanceira = async () => {
  const essencial = Number(document.getElementById('meta-essencial')?.value || 70);
  const reserva = Number(document.getElementById('meta-reserva')?.value || 20);
  const lazer = Number(document.getElementById('meta-lazer')?.value || 10);

  const total = essencial + reserva + lazer;

  if (total !== 100) {
    alert('A soma das metas precisa ser 100%.');
    return;
  }

  window.regraFinanceira = {
    essencial,
    reserva,
    lazer
  };

  await saveUserSettings({
    regraFinanceira: window.regraFinanceira
  });

  window.atualizarDashboard?.();

  window.fecharBottomPanels();
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.wallet-card-config');

  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const cardId = btn.dataset.cardId;

  console.log('Clicou na engrenagem:', cardId);

  window.abrirEditorCartao(cardId);
});

/* ========================================
   DOM READY
======================================== */

const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const toggleText = document.getElementById('toggle-auth-text');
const authExtras = document.querySelectorAll('.auth-extra');
const authButton = document.getElementById('btn-auth-primary');

document.addEventListener('DOMContentLoaded', () => {
  popularSelectMeses();

  const filtroMes = document.getElementById('filtro-mes');
  const filtroMesHeader = document.getElementById('filtro-mes-header');

  if (filtroMes && filtroMesHeader) {
    filtroMesHeader.innerHTML = filtroMes.innerHTML;
    filtroMesHeader.value = filtroMes.value;

    filtroMesHeader.addEventListener('change', () => {
      filtroMes.value = filtroMesHeader.value;
      window.atualizarDashboard?.();
    });

    filtroMes.addEventListener('change', () => {
      filtroMesHeader.value = filtroMes.value;
    });
  }
  /* AUTH FORM */

  const loginForm = document.getElementById('auth-form');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email =
      document.getElementById('auth-email').value;

    const senha =
      document.getElementById('auth-password').value;

    const nome =
      document.getElementById('auth-name')?.value || '';

    const sobrenome =
      document.getElementById('auth-lastname')?.value || '';

    const btn =
      document.getElementById('btn-auth-primary');

    btn.disabled = true;

    btn.innerHTML = `
      <span class="auth-loader"></span>
    `;

    try {
      if (isRegister) {
        await register(
          nome,
          sobrenome,
          email,
          senha
        );
      } else {
        await login(email, senha);
      }
    }

    catch (err) {
      console.error(err);

      let msg = 'Erro ao autenticar.';

      switch (err.code) {
        case 'auth/invalid-credential':
          msg = 'E-mail ou senha incorretos.';
          break;

        case 'auth/user-not-found':
          msg = 'Usuário não encontrado.';
          break;

        case 'auth/wrong-password':
          msg = 'Senha incorreta.';
          break;

        case 'auth/email-already-in-use':
          msg = 'Esse e-mail já está cadastrado.';
          break;

        case 'auth/weak-password':
          msg = 'A senha precisa ter no mínimo 6 caracteres.';
          break;

        case 'auth/invalid-email':
          msg = 'Digite um e-mail válido.';
          break;

        case 'auth/network-request-failed':
          msg = 'Você está sem internet.';
          break;

        case 'auth/too-many-requests':
          msg = 'Muitas tentativas. Aguarde alguns minutos.';
          break;
      }

      showAuthMessage(msg, 'error');
    }

    finally {
      setTimeout(() => {
        btn.disabled = false;

        btn.innerHTML =
          isRegister
            ? 'Criar Conta'
            : 'Entrar';
      }, 700);
    }
  });

  /* TOGGLE LOGIN / REGISTER */

  function setAuthMode(registerMode, pushState = true) {
    isRegister = registerMode;

    if (isRegister) {
      authTitle.textContent = 'Criar conta';
      authSubtitle.textContent = 'Comece agora a organizar sua vida financeira';
      authButton.innerHTML = 'Criar Conta';

      toggleText.innerHTML = `
        Já possui uma conta?
        <a href="#" id="toggle-auth-link">Voltar para login</a>
      `;

      authExtras.forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('show');
      });

      if (pushState) {
        history.pushState(
          { authMode: 'register' },
          '',
          '#cadastro'
        );
      }
    }

    else {
      authTitle.textContent = 'Bem-vindo de volta';
      authSubtitle.textContent = 'Acesse sua conta para gerenciar suas finanças';
      authButton.innerHTML = 'Entrar';

      toggleText.innerHTML = `
        Não tem uma conta?
        <a href="#" id="toggle-auth-link">Criar conta grátis</a>
      `;

      authExtras.forEach(el => {
        el.classList.remove('show');
        el.classList.add('hidden');
      });

      if (pushState) {
        history.pushState(
          { authMode: 'login' },
          '',
          '#login'
        );
      }
    }

    bindToggleAuthLink();
  }

  function bindToggleAuthLink() {
    const link =
      document.getElementById('toggle-auth-link');

    link?.addEventListener('click', (e) => {
      e.preventDefault();

      setAuthMode(!isRegister);
    });
  }

  bindToggleAuthLink();

  history.replaceState(
    { authMode: 'login' },
    '',
    '#login'
  );

  window.addEventListener('popstate', async () => {
    const authContainer =
      document.getElementById('auth-container');

    const app =
      document.getElementById('app');

    const modalRegistroAberto =
      document
        .getElementById('modal-registro')
        ?.classList.contains('active');

    const modalCartaoAberto =
      document
        .getElementById('modal-cartao')
        ?.classList.contains('active');

    const bottomAberto =
      document.querySelector('.bottom-panel.active');

    if (bottomAberto) {
      window.fecharBottomPanels();

      history.pushState(
        { app: true },
        '',
        '#app'
      );

      return;
    }

    if (modalRegistroAberto || modalCartaoAberto) {
      window.fecharModal?.();
      window.fecharModalCartao?.();

      history.pushState(
        { app: true },
        '',
        '#app'
      );

      return;
    }

    const estaNaTelaCadastro = isRegister;

    const estaLogado =
      document.body.classList.contains('logged-in');

    if (
      estaNaTelaCadastro &&
      authContainer?.style.display !== 'none'
    ) {
      setAuthMode(false, false);
      return;
    }

    if (
      estaLogado &&
      app?.style.display !== 'none'
    ) {
      const confirmar =
        confirm('Deseja realmente sair da sua conta?');

      if (confirmar) {
        await window.logOut();
      } else {
        history.pushState(
          { app: true },
          '',
          '#app'
        );
      }
    }
  });

  document.getElementById('form-editar-cartao')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cardId = document.getElementById('edit-card-id').value;

    await updateCreditCard(cardId, {
      name: document.getElementById('edit-card-name').value,
      closingDay: Number(document.getElementById('edit-card-closing').value),
      dueDay: Number(document.getElementById('edit-card-due').value),
      colorIndex: Number(document.getElementById('edit-card-color').value)
    });

    window.fecharEditorCartao();
  });

  document
    .getElementById('form-editar-transacao')
    ?.addEventListener('submit', async (e) => {

      e.preventDefault();

      const id =
        document.getElementById('edit-tx-id').value;

      const paymentMethod =
        document.getElementById('edit-tx-payment').value;

      const cardId =
        document.getElementById('edit-tx-card').value || null;

      await updateTransaction(id, {
        desc:
          document.getElementById('edit-tx-desc').value,

        val:
          Number(
            document.getElementById('edit-tx-val').value
          ),

        paymentMethod,
        cardId
      });

      window.fecharModalEditarTx();
    });

  /* TABS */

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.fecharBottomPanels?.();

      const target = btn.dataset.tab;

      document
        .querySelectorAll('.tab-section, .tab-btn')
        .forEach(el => el.classList.remove('active'));

      document
        .getElementById(`tab-${target}`)
        ?.classList.add('active');

      btn.classList.add('active');
    });
  });

  /* CHART */

  const ctx =
    document.getElementById('mainEvolutionChart');

  if (ctx) {
    window.meuGrafico = new Chart(ctx, {
      type: 'bar',

      data: {
        labels: [],

        datasets: [
          {
            label: 'Receitas',
            data: [],
            backgroundColor: 'rgba(0, 255, 178, 0.65)',
            borderColor: '#00FFB2',
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 42
          },

          {
            label: 'Despesas',
            data: [],
            backgroundColor: 'rgba(255, 107, 53, 0.65)',
            borderColor: '#FF6B35',
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 42
          },

          {
            label: 'Caixinhas',
            data: [],
            backgroundColor: 'rgba(0, 209, 255, 0.65)',
            borderColor: '#00D1FF',
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 42
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: true,

            labels: {
              color: '#94a3b8',
              usePointStyle: true,
              pointStyle: 'circle'
            }
          }
        },

        scales: {
          x: {
            grid: {
              display: false
            },

            ticks: {
              color: '#94a3b8'
            }
          },

          y: {
            beginAtZero: true,

            grid: {
              color: 'rgba(255,255,255,0.05)'
            },

            ticks: {
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }

  /* FILTRO MÊS */

  document
    .getElementById('filtro-mes')
    ?.addEventListener(
      'change',
      window.atualizarDashboard
    );

  /* FORM TRANSAÇÃO */

  document
    .getElementById('form-transacao')
    ?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const inputDataStr =
        document.getElementById('input-data')?.value;

      let dataCompra = new Date();

      if (inputDataStr) {
        const [ano, mes, dia] =
          inputDataStr.split('-').map(Number);

        dataCompra =
          new Date(ano, mes - 1, dia);
      }

      const tipo =
        document.getElementById('input-tipo').value;

      const categoria =
        document.getElementById('input-cat').value;

      const paymentMethod =
        document.getElementById('input-payment')?.value ||
        'debit';

      const cardId =
        document.getElementById('input-card')?.value ||
        null;

      const cartao =
        (window.cards || []).find(card => card.id === cardId);

      let dataLancamento = dataCompra;

      if (
        tipo === 'expense' &&
        paymentMethod === 'credit'
      ) {
        const cartao =
          (window.cards || [])
            .find(card => card.id === cardId);

        if (!cartao) {
          alert('Selecione um cartão de crédito.');
          return;
        }

        dataLancamento = calcularDataFatura(
          dataCompra,
          Number(cartao.closingDay),
          Number(cartao.dueDay)
        );
      }

      const nova = {
        desc:
          document.getElementById('input-desc').value,

        val:
          parseFloat(
            document.getElementById('input-val').value
          ),

        type: tipo,
        cat: categoria,

        paymentMethod,
        cardId,

        purchaseDate:
          Timestamp.fromDate(dataCompra),

        createdAt:
          Timestamp.fromDate(dataLancamento)
      };

      const recurrence =
        document.getElementById('input-recurrence')?.value || 'single';

      const installments =
        Number(document.getElementById('input-installments')?.value || 1);

      if (
        tipo === 'expense' &&
        paymentMethod === 'credit' &&
        recurrence === 'installment'
      ) {
        const groupId = crypto.randomUUID();

        for (let i = 0; i < installments; i++) {
          const dataParcela = new Date(dataCompra);
          dataParcela.setMonth(dataCompra.getMonth() + i);

          const dataFaturaParcela = calcularDataFatura(
            dataParcela,
            Number(cartao.closingDay),
            Number(cartao.dueDay)
          );

          await addTransaction({
            ...nova,
            desc: `${nova.desc} (${i + 1}/${installments})`,
            val: Number(nova.val) / installments,
            purchaseDate: Timestamp.fromDate(dataParcela),
            createdAt: Timestamp.fromDate(dataFaturaParcela),
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            totalInstallments: installments
          });
        }
      } else {
        await addTransaction(nova);
      }

      e.target.reset();

      document.getElementById('input-payment').value = 'debit';
      document.getElementById('input-card').value = '';

      document
        .getElementById('credit-card-group')
        ?.classList.add('hidden');

      window.fecharModal();
    });

  /* FORM CARTÃO */


  document.getElementById('input-recurrence')?.addEventListener('change', (e) => {
    const installmentsGroup = document.getElementById('installments-group');

    if (e.target.value === 'installment') {
      installmentsGroup?.classList.remove('hidden');
    } else {
      installmentsGroup?.classList.add('hidden');
    }
  });

  const formCartao =
    document.getElementById('form-cartao');

  formCartao?.addEventListener('submit', async (e) => {
    e.preventDefault();

    await addCreditCard({
      name:
        document.getElementById('card-name').value,

      closingDay:
        Number(
          document.getElementById('card-closing').value
        ),

      dueDay:
        Number(
          document.getElementById('card-due').value
        ),

      colorIndex: 0
    });

    formCartao.reset();

    window.fecharModalCartao();
  });

  /* PAYMENT METHOD */

  const inputPayment =
    document.getElementById('input-payment');

  const creditCardGroup =
    document.getElementById('credit-card-group');

  inputPayment?.addEventListener('change', () => {
    const recurrenceGroup = document.getElementById('recurrence-group');
    const installmentsGroup = document.getElementById('installments-group');

    if (inputPayment.value === 'credit') {
      creditCardGroup?.classList.remove('hidden');
      recurrenceGroup?.classList.remove('hidden');
    } else {
      creditCardGroup?.classList.add('hidden');
      recurrenceGroup?.classList.add('hidden');
      installmentsGroup?.classList.add('hidden');
    }
  });

  document.getElementById('recurrence-group')?.classList.add('hidden');
  document.getElementById('installments-group')?.classList.add('hidden');

  const recurrenceInput = document.getElementById('input-recurrence');
  const installmentsInput = document.getElementById('input-installments');

  if (recurrenceInput) recurrenceInput.value = 'single';
  if (installmentsInput) installmentsInput.value = 2;

  /* ESC */

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    const modalRegistro =
      document
        .getElementById('modal-registro')
        ?.classList.contains('active');

    const modalCartao =
      document
        .getElementById('modal-cartao')
        ?.classList.contains('active');

    const bottomPanel =
      document.querySelector('.bottom-panel.active');

    if (bottomPanel) {
      window.fecharBottomPanels();
      return;
    }

    if (modalRegistro) {
      window.fecharModal();
      return;
    }

    if (modalCartao) {
      window.fecharModalCartao();
    }
  });

  /* FECHAR BOTTOM PANEL AO CLICAR FORA */

  document.addEventListener('click', (e) => {
    const clicouPainel =
      e.target.closest('.bottom-panel');

    const clicouBotao =
      e.target.closest('.bottom-nav-btn');

    if (!clicouPainel && !clicouBotao) {
      window.fecharBottomPanels();
    }
  });


  /* PREVINE ZOOM IOS */

  document.querySelectorAll('input, select').forEach(el => {
    el.style.fontSize = '16px';
  });

  document.getElementById('btn-bottom-actions')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    window.toggleQuickActions();
  });

  document.getElementById('btn-bottom-metas')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    window.toggleMetasPanel();
  });

  document.getElementById('btn-bottom-menu')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    window.toggleMenuPanel();
  });
});

/* ========================================
   POPULAR SELECT MESES
======================================== */

function popularSelectMeses() {
  const select =
    document.getElementById('filtro-mes');

  if (!select) return;

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  const d = new Date();

  select.innerHTML =
    meses.map((n, i) => `
      <option
        value="${d.getFullYear()}-${i}"
        ${i === d.getMonth() ? 'selected' : ''}
      >
        ${n} ${d.getFullYear()}
      </option>
    `).join('');
}



window.fecharBottomPanels = function () {
  document.querySelectorAll('.bottom-panel').forEach((panel) => {
    panel.classList.remove('active');
  });

  document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
};

window.toggleQuickActions = function () {
  const panel = document.getElementById('quick-actions-panel');
  const btn = document.querySelector('[data-bottom="actions"]');

  if (!panel) {
    console.error('quick-actions-panel não encontrado');
    return;
  }

  const isOpen = panel.classList.contains('active');

  window.fecharBottomPanels();

  if (!isOpen) {
    panel.classList.add('active');
    btn?.classList.add('active');
  }
};

window.toggleMetasPanel = function () {
  const panel = document.getElementById('metas-panel');
  const btn = document.querySelector('[data-bottom="metas"]');

  if (!panel) {
    console.error('metas-panel não encontrado');
    return;
  }

  const isOpen = panel.classList.contains('active');

  window.fecharBottomPanels();

  if (!isOpen) {
    panel.classList.add('active');
    btn?.classList.add('active');
  }
};

window.toggleMenuPanel = function () {
  const panel = document.getElementById('menu-panel');
  const btn = document.querySelector('[data-bottom="menu"]');

  if (!panel) {
    console.error('menu-panel não encontrado');
    return;
  }

  const isOpen = panel.classList.contains('active');

  window.fecharBottomPanels();

  if (!isOpen) {
    panel.classList.add('active');
    btn?.classList.add('active');
  }
};

window.carregarConfiguracoesUsuario = async (uid) => {
  const settings = await getUserSettings(uid);

  if (!settings?.regraFinanceira) return;

  window.regraFinanceira = settings.regraFinanceira;

  const metaEssencial = document.getElementById('meta-essencial');
  const metaReserva = document.getElementById('meta-reserva');
  const metaLazer = document.getElementById('meta-lazer');

  if (metaEssencial) metaEssencial.value = window.regraFinanceira.essencial;
  if (metaReserva) metaReserva.value = window.regraFinanceira.reserva;
  if (metaLazer) metaLazer.value = window.regraFinanceira.lazer;

  window.atualizarDashboard?.();
};

window.fecharModalEditarTx = () => {
  document
    .getElementById('modal-editar-transacao')
    ?.classList.remove('active');
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-edit-tx');

  if (!btn) return;

  const txId = btn.dataset.txId;

  const tx = (window.transactions || [])
    .find(t => t.id === txId);

  if (!tx) return;

  document.getElementById('edit-tx-id').value = tx.id;
  document.getElementById('edit-tx-desc').value = tx.desc || '';
  document.getElementById('edit-tx-val').value = tx.val || '';

  document.getElementById('edit-tx-payment').value =
    tx.paymentMethod || 'debit';

  const selectCard =
    document.getElementById('edit-tx-card');

  selectCard.innerHTML = `
    <option value="">Selecione</option>

    ${(window.cards || []).map(card => `
      <option
        value="${card.id}"
        ${tx.cardId === card.id ? 'selected' : ''}
      >
        ${card.name}
      </option>
    `).join('')}
  `;
  const modal =
    document.getElementById('modal-editar-transacao');

  requestAnimationFrame(() => {
    modal?.classList.add('active');
  });
});