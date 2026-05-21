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
  deleteInstallmentGroup,
  resetPassword
} from './firebase.js';

import { deleteDoc, doc, Timestamp } from "firebase/firestore";
import { signOut, updateProfile } from "firebase/auth";
import ChartDataLabels from 'chartjs-plugin-datalabels';
Chart.register(ChartDataLabels);

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
window.abrirEditarNome = () => {
  window.fecharBottomPanels?.();

  const modal = document.getElementById('modal-editar-nome');
  const input = document.getElementById('input-novo-nome');

  if (input) {
    input.value = auth.currentUser?.displayName || '';
  }

  requestAnimationFrame(() => {
    modal?.classList.add('active');
  });
};

window.fecharEditarNome = () => {
  document.getElementById('modal-editar-nome')?.classList.remove('active');
};

window.enviarResetSenha = async () => {

  try {

    const email =
      auth.currentUser?.email;

    if (!email) {
      alert('Usuário não encontrado.');
      return;
    }

    await resetPassword(email);

    window.showToast({
      type: 'success',
      title: 'E-mail enviado',
      message: `Link de redefinição enviado para ${email}`
    });

  } catch (e) {

    window.showToast({
      type: 'error',
      title: 'Erro',
      message: 'Não foi possível enviar o e-mail.'
    });

  }

};

window.aplicarTema = (tema) => {
  document.body.classList.toggle('light-mode', tema === 'light');
  localStorage.setItem('theme', tema);
};

window.alternarTema = async () => {
  const isLight = document.body.classList.contains('light-mode');
  const novoTema = isLight ? 'dark' : 'light';

  window.aplicarTema(novoTema);

  await saveUserSettings({
    theme: novoTema
  });

  window.showToast({
    type: 'success',
    title: 'Tema alterado',
    message: novoTema === 'light'
      ? 'Tema claro ativado.'
      : 'Tema escuro ativado.'
  });
};

window.abrirRegraFinanceira = () => {
  window.fecharBottomPanels?.();

  const panel = document.getElementById('metas-panel');

  if (!panel) {
    console.error('metas-panel não encontrado');
    return;
  }

  const regra = window.regraFinanceira || {
    essencial: 70,
    reserva: 20,
    lazer: 10
  };

  document.getElementById('meta-essencial').value = regra.essencial;
  document.getElementById('meta-reserva').value = regra.reserva;
  document.getElementById('meta-lazer').value = regra.lazer;

  requestAnimationFrame(() => {
    panel.classList.add('active');
  });
};

window.categoriasCustom = {
  income: [],
  expense: [],
  goal: []
};

window.abrirCategorias = () => {
  window.fecharBottomPanels?.();

  document.getElementById('modal-categorias')?.classList.add('active');
  window.renderCategoriasCustom?.();
};

window.fecharCategorias = () => {
  document.getElementById('modal-categorias')?.classList.remove('active');
};

window.renderCategoriasCustom = () => {
  const lista = document.getElementById('categorias-lista');
  if (!lista) return;

  const labels = {
    income: 'Receitas',
    expense: 'Despesas',
    goal: 'Caixinhas'
  };

  lista.innerHTML = Object.entries(window.categoriasCustom)
    .map(([tipo, categorias]) => `
      <div class="categoria-grupo">
        <h4>${labels[tipo]}</h4>

        <div class="categoria-tags">
          ${categorias.length
        ? categorias.map(cat => `
                <span class="cat-tag">
                  ${cat}
                  <button type="button" onclick="window.removerCategoria('${tipo}', '${cat}')">
                    ×
                  </button>
                </span>
              `).join('')
        : `<small>Nenhuma categoria criada.</small>`
      }
        </div>
      </div>
    `).join('');
};

window.removerCategoria = async (tipo, nome) => {
  window.categoriasCustom[tipo] =
    window.categoriasCustom[tipo].filter(c => c !== nome);

  await saveUserSettings({
    categoriasCustom: window.categoriasCustom
  });

  window.renderCategoriasCustom();
};

window.showToast = ({
  type = 'success',
  title = 'Sucesso',
  message = ''
}) => {

  const container =
    document.getElementById('toast-container');

  if (!container) return;

  const toast =
    document.createElement('div');

  toast.className =
    `toast toast-${type}`;

  toast.innerHTML = `
    <div class="toast-icon">
      <i class="ph ${type === 'success'
      ? 'ph-check-circle'
      : 'ph-warning-circle'
    }"></i>
    </div>

    <div class="toast-content">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {

    toast.classList.remove('show');

    setTimeout(() => {
      toast.remove();
    }, 280);

  }, 4000);

};


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

  const lista = [
    ...(categoriasPorTipo[tipo] || []),
    ...(window.categoriasCustom?.[tipo] || [])
  ];

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

  const fixedExpenseGroup = document.getElementById('fixed-expense-group');
  const fixedMonthsGroup = document.getElementById('fixed-months-group');

  if (tipo === 'expense') {
    paymentGroup?.classList.remove('hidden');
    fixedExpenseGroup?.classList.remove('hidden');
  } else {
    paymentGroup?.classList.add('hidden');
    creditCardGroup?.classList.add('hidden');
    fixedExpenseGroup?.classList.add('hidden');
    fixedMonthsGroup?.classList.add('hidden');

    if (inputPayment) inputPayment.value = 'debit';
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

  const headerSaldo = document.getElementById('header-saldo-badge');
  if (headerSaldo) {
    const saldo = rec - des - res;
    headerSaldo.innerHTML = `<span>◈ Saldo: </span> ${formatBRL(saldo)}`;
    headerSaldo.style.color = saldo >= 0 ? '#00FFB2' : '#FF6B35';
  }

  const insightEl = document.getElementById('insight-saldo');
  if (insightEl) {
    const [anoFiltroN, mesFiltroN] = select.value.split('-').map(Number);
    const mesAnterior = mesFiltroN === 0 ? 11 : mesFiltroN - 1;
    const anoAnterior = mesFiltroN === 0 ? anoFiltroN - 1 : anoFiltroN;

    const txMesAnterior = (window.transactions || []).filter(t => {
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      return d.getFullYear() === anoAnterior && d.getMonth() === mesAnterior;
    });

    let recAnt = 0, desAnt = 0, resAnt = 0;
    txMesAnterior.forEach(t => {
      const v = Number(t.val) || 0;
      if (t.type === 'income') recAnt += v;
      else if (t.type === 'expense') desAnt += v;
      else if (t.type === 'goal') resAnt += v;
    });

    const saldoAtual = rec - des - res;
    const saldoAnterior = recAnt - desAnt - resAnt;

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

  const tituloRegra = document.getElementById('titulo-regra-financeira');

  if (tituloRegra) {
    tituloRegra.textContent =
      `Regra ${regra.essencial}/${regra.reserva}/${regra.lazer}`;
  }

  const essencialIdeal = receita * (regra.essencial / 100);
  const reservaIdeal = receita * (regra.reserva / 100);
  const lazerIdeal = receita * (regra.lazer / 100);

  const montarLinha = ({ nome, percentual, usado, ideal, cor, tipo }) => {
    const usadoPercentual = receita > 0 ? (usado / receita) * 100 : 0;
    const progresso = ideal > 0 ? Math.min((usado / ideal) * 100, 100) : 0;

    let status = '';
    let statusClass = '';

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
        status = `Meta atingida`;
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
            <strong>${nome}</strong>
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
    usado: despesa,
    ideal: essencialIdeal,
    cor: despesa > essencialIdeal ? '#FF6B35' : '#00FFB2',
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
    chart.data.datasets.forEach(dataset => dataset.data = []);
    chart.update();
    return;
  }

  const mesesNomes = [
    'Jan', 'Fev', 'Mar', 'Abr',
    'Mai', 'Jun', 'Jul', 'Ago',
    'Set', 'Out', 'Nov', 'Dez'
  ];

  const hoje = new Date();
  const limite = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);

  let mesesChaves = [
    ...new Set(
      todasTransactions.map(t => {
        const d = t.createdAt?.toDate
          ? t.createdAt.toDate()
          : new Date(t.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    )
  ].sort((a, b) => {
    const [anoA, mesA] = a.split('-').map(Number);
    const [anoB, mesB] = b.split('-').map(Number);
    return new Date(anoA, mesA) - new Date(anoB, mesB);
  }).filter(chave => {
    const [ano, mes] = chave.split('-').map(Number);
    return new Date(ano, mes, 1) <= limite;
  });

  const labels = [];
  const receitasData = [];
  const despesasData = [];
  const caixinhasData = [];

  mesesChaves.forEach(chave => {
    const [ano, mes] = chave.split('-').map(Number);
    labels.push(`${mesesNomes[mes]}/${ano.toString().slice(-2)}`);

    let receitas = 0;
    let despesas = 0;
    let caixinhas = 0;

    todasTransactions.forEach(t => {
      const d = t.createdAt?.toDate
        ? t.createdAt.toDate()
        : new Date(t.createdAt);

      if (d.getFullYear() === ano && d.getMonth() === mes) {
        if (t.type === 'income') receitas += Number(t.val) || 0;
        if (t.type === 'expense') despesas += Number(t.val) || 0;
        if (t.type === 'goal') caixinhas += Number(t.val) || 0;
      }
    });

    receitasData.push(receitas);
    despesasData.push(-despesas);
    caixinhasData.push(-caixinhas);
  });

  const totalMeses = labels.length;
  const isMobile = window.innerWidth < 768;

  chart.data.labels = labels;
  chart.data.datasets[0].data = receitasData;
  chart.data.datasets[1].data = despesasData;
  chart.data.datasets[2].data = caixinhasData;

  if (isMobile) {
    const wrapper = document.querySelector('.chart-card.evolution .canvas-wrapper');
    const canvas = document.getElementById('mainEvolutionChart');

    if (wrapper && canvas) {
      const largura = Math.max(totalMeses * 70, wrapper.clientWidth);
      chart.canvas.style.width = largura + 'px';
      chart.canvas.width = largura;
      chart.options.responsive = false;
      chart.resize(largura, 280);
    }
  } else {
    chart.options.responsive = true;
    chart.resize();
  }

  chart.update();

  if (isMobile) {
    const wrapper = document.querySelector('.chart-card.evolution .canvas-wrapper');
    if (wrapper) {
      const filtroVal = document.getElementById('filtro-mes')?.value || '';
      const [anoFiltro, mesFiltro] = filtroVal.split('-').map(Number);
      const mesLabel = `${mesesNomes[mesFiltro]}/${String(anoFiltro).slice(-2)}`;
      const idxAtual = labels.indexOf(mesLabel);
      const idx = idxAtual !== -1 ? idxAtual : labels.length - 1;
      const barWidth = wrapper.scrollWidth / totalMeses;
      wrapper.scrollLeft = Math.max(0, (idx - 2) * barWidth);
    }
  }
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
  const temaSalvo = localStorage.getItem('theme') || 'dark';
  window.aplicarTema(temaSalvo);

  popularSelectMeses();

  const mesesPicker = [
    'Jan', 'Fev', 'Mar',
    'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set',
    'Out', 'Nov', 'Dez'
  ];

  let pickerYear = new Date().getFullYear();

  const filtroMes = document.getElementById('filtro-mes');
  const btnMonthPicker = document.getElementById('btn-open-month-picker');
  const monthModal = document.getElementById('month-picker-modal');
  const monthsGrid = document.getElementById('months-grid');
  const monthYearLabel = document.getElementById('month-picker-year');
  const prevYearBtn = document.getElementById('prev-year');
  const nextYearBtn = document.getElementById('next-year');

  function atualizarTextoBotaoMes() {
    if (!filtroMes || !btnMonthPicker) return;

    const [ano, mes] = filtroMes.value.split('-').map(Number);

    btnMonthPicker.innerHTML = `
    ${mesesPicker[mes]} ${ano}
    <i class="ph ph-caret-down"></i>
  `;
  }

  function renderMonthPicker() {
    if (!filtroMes || !monthsGrid || !monthYearLabel) return;

    monthYearLabel.textContent = pickerYear;

    const valorAtual = filtroMes.value;

    monthsGrid.innerHTML = mesesPicker.map((nome, index) => {
      const value = `${pickerYear}-${index}`;

      return `
      <button
        type="button"
        class="month-item ${value === valorAtual ? 'active' : ''}"
        data-value="${value}"
      >
        ${nome}
      </button>
    `;
    }).join('');
  }

  if (filtroMes && btnMonthPicker && monthModal && monthsGrid) {
    const [anoAtual] = filtroMes.value.split('-').map(Number);
    pickerYear = anoAtual;

    atualizarTextoBotaoMes();
    renderMonthPicker();

    btnMonthPicker.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      monthModal.classList.toggle('active');
      renderMonthPicker();
    });

    prevYearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      pickerYear--;
      renderMonthPicker();
    });

    nextYearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      pickerYear++;
      renderMonthPicker();
    });

    monthsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.month-item');
      if (!btn) return;

      filtroMes.value = btn.dataset.value;

      atualizarTextoBotaoMes();
      window.atualizarDashboard?.();

      monthModal.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.month-picker-wrapper')) {
        monthModal.classList.remove('active');
      }
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

  document.getElementById('form-editar-nome')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const novoNome = document.getElementById('input-novo-nome')?.value.trim();

    if (!novoNome) return;

    await updateProfile(auth.currentUser, {
      displayName: novoNome
    });

    await saveUserSettings({
      displayName: novoNome
    });

    window.updateUserHeader(auth.currentUser);

    window.showToast({
      type: 'success',
      title: 'Nome atualizado',
      message: 'Seu nome foi alterado com sucesso.'
    });

    window.fecharEditarNome();
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

  document.getElementById('form-editar-transacao')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-tx-id').value;

    const tx = (window.transactions || []).find(t => t.id === id);

    if (!tx) {
      console.error('Transação não encontrada para edição:', id);
      return;
    }

    const desc = document.getElementById('edit-tx-desc').value;
    const val = Number(document.getElementById('edit-tx-val').value) || 0;
    const paymentMethod = document.getElementById('edit-tx-payment').value;
    const cardId = document.getElementById('edit-tx-card').value || null;

    const fixedExpense =
      document.getElementById('edit-tx-fixed')?.value === 'yes';

    const fixedDuration =
      document.getElementById('edit-tx-fixed-duration')?.value || 'limited';

    const fixedMonths =
      fixedDuration === 'indefinite'
        ? 24
        : Number(document.getElementById('edit-tx-fixed-months')?.value || 1);

    await updateTransaction(id, {
      desc,
      val,
      paymentMethod,
      cardId,
      fixedExpense,
      fixedDuration: fixedExpense ? fixedDuration : null,
      fixedIndefinite: fixedExpense && fixedDuration === 'indefinite',
      totalFixedMonths:
        fixedExpense && fixedDuration !== 'indefinite'
          ? fixedMonths
          : null
    });

    if (fixedExpense && !tx.fixedGroupId) {
      const fixedGroupId = crypto.randomUUID();

      await updateTransaction(id, {
        fixedGroupId,
        fixedNumber: 1
      });

      const baseDate =
        tx.createdAt?.toDate
          ? tx.createdAt.toDate()
          : new Date(tx.createdAt);

      for (let i = 1; i < fixedMonths; i++) {
        const dataFixa = new Date(baseDate);
        dataFixa.setMonth(baseDate.getMonth() + i);

        await addTransaction({
          desc:
            fixedDuration === 'indefinite'
              ? `${desc} (fixa)`
              : `${desc} (${i + 1}/${fixedMonths})`,

          val,
          type: tx.type,
          cat: tx.cat,

          paymentMethod,
          cardId,

          purchaseDate: Timestamp.fromDate(dataFixa),
          createdAt: Timestamp.fromDate(dataFixa),

          fixedExpense: true,
          fixedDuration,
          fixedIndefinite: fixedDuration === 'indefinite',
          fixedGroupId,
          fixedNumber: i + 1,
          totalFixedMonths:
            fixedDuration === 'indefinite'
              ? null
              : fixedMonths
        });
      }
    }

    window.fecharModalEditarTx();
  });

  document.getElementById('input-fixed-expense')?.addEventListener('change', (e) => {
    const fixedMonthsGroup = document.getElementById('fixed-months-group');

    if (e.target.value === 'yes') {
      fixedMonthsGroup?.classList.remove('hidden');
    } else {
      fixedMonthsGroup?.classList.add('hidden');
    }
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
            backgroundColor: '#00FFB2',
            borderRadius: 6,
            stack: 'financeiro'
          },
          {
            label: 'Despesas',
            data: [],
            backgroundColor: '#FF6B35',
            borderRadius: 6,
            stack: 'financeiro'
          },
          {
            label: 'Caixinhas',
            data: [],
            backgroundColor: '#00D1FF',
            borderRadius: 6,
            stack: 'financeiro'
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          datalabels: {
            display: (context) => {
              const value = Math.abs(context.dataset.data[context.dataIndex] || 0);
              if (!value) return false;

              const receitasDataset = context.chart.data.datasets[0];
              const receita = Math.abs(receitasDataset.data[context.dataIndex] || 0);
              if (!receita) return false;

              const perc = Math.round((value / receita) * 100);
              return perc >= 8;
            },
            color: (context) => {
              const label = context.dataset.label;
              if (label === 'Receitas') return '#003d2b';
              if (label === 'Despesas') return '#4a1800';
              return '#003d4a';
            },
            font: {
              size: 10,
              weight: '700'
            },
            formatter: (value, context) => {
              const receitasDataset = context.chart.data.datasets[0];
              const receita = Math.abs(receitasDataset.data[context.dataIndex] || 0);
              if (!receita) return '';
              const perc = Math.round((Math.abs(value) / receita) * 100);
              return `${perc}%`;
            },
            anchor: 'center',
            align: 'center',
            clamp: true,
            clip: true
          },
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              padding: 14,
              font: { size: 11, weight: '600' }
            }
          },

          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',
            borderColor: '#1e2d40',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const value = Math.abs(Number(context.raw || 0));
                return `${context.dataset.label}: ${value.toLocaleString('pt-BR', {
                  style: 'currency', currency: 'BRL'
                })}`;
              }
            }
          }
        },

        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              maxRotation: 0,
              minRotation: 0,
              font: { size: 10 }
            }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              autoSkip: false,
              maxRotation: 0,
              font: { size: 10, weight: '600' },
              callback: (value) => {
                const abs = Math.abs(value);
                if (abs >= 1000) return `${value < 0 ? '-' : ''}${abs / 1000}k`;
                return value;
              }
            }
          }
        }
      }
    });
  }

  /* FILTRO MÊS */

  document
    .getElementById('filtro-mes')
    ?.addEventListener('change', () => {
      window.atualizarDashboard();
      if (window.meuGrafico && window.transactions?.length) {
        window.atualizarGrafico(window.meuGrafico, window.transactions);
      }
    });

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

        dataCompra = new Date(ano, mes - 1, dia);
      }

      const tipo =
        document.getElementById('input-tipo').value;

      const categoria =
        document.getElementById('input-cat').value;

      const paymentMethod =
        document.getElementById('input-payment')?.value || 'debit';

      const cardId =
        document.getElementById('input-card')?.value || null;

      const cartao =
        (window.cards || []).find(card => card.id === cardId);

      const valor =
        Number(document.getElementById('input-val').value) || 0;

      const descricao =
        document.getElementById('input-desc').value;

      const recurrence =
        document.getElementById('input-recurrence')?.value || 'single';

      const installments =
        Number(document.getElementById('input-installments')?.value || 1);

      const fixedExpense =
        document.getElementById('input-fixed-expense')?.value === 'yes';

      const fixedDuration =
        document.getElementById('input-fixed-duration')?.value || 'limited';

      const fixedMonths =
        fixedDuration === 'indefinite'
          ? 24
          : Number(document.getElementById('input-fixed-months')?.value || 1);

      let dataLancamento = dataCompra;

      if (
        tipo === 'expense' &&
        paymentMethod === 'credit'
      ) {
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
        desc: descricao,
        val: valor,
        type: tipo,
        cat: categoria,

        paymentMethod,
        cardId,

        purchaseDate: Timestamp.fromDate(dataCompra),
        createdAt: Timestamp.fromDate(dataLancamento)
      };

      /*
        1. PARCELAMENTO NO CARTÃO
      */
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

            desc: `${descricao} (${i + 1}/${installments})`,
            val: valor / installments,

            purchaseDate: Timestamp.fromDate(dataParcela),
            createdAt: Timestamp.fromDate(dataFaturaParcela),

            installmentGroupId: groupId,
            installmentNumber: i + 1,
            totalInstallments: installments
          });
        }
      }

      /*
        2. DESPESA FIXA NORMAL
        Funciona para débito, pix, dinheiro e também crédito NÃO parcelado.
      */
      else if (
        tipo === 'expense' &&
        fixedExpense
      ) {
        const fixedGroupId = crypto.randomUUID();

        for (let i = 0; i < fixedMonths; i++) {
          const dataFixa = new Date(dataCompra);
          dataFixa.setMonth(dataCompra.getMonth() + i);

          let dataFaturaFixa = dataFixa;

          if (paymentMethod === 'credit') {
            dataFaturaFixa = calcularDataFatura(
              dataFixa,
              Number(cartao.closingDay),
              Number(cartao.dueDay)
            );
          }

          await addTransaction({
            ...nova,

            desc:
              fixedDuration === 'indefinite'
                ? `${descricao} (fixa)`
                : `${descricao} (${i + 1}/${fixedMonths})`,

            val: valor,

            purchaseDate: Timestamp.fromDate(dataFixa),
            createdAt: Timestamp.fromDate(dataFaturaFixa),

            fixedExpense: true,
            fixedDuration,
            fixedIndefinite: fixedDuration === 'indefinite',
            fixedGroupId,
            fixedNumber: i + 1,
            totalFixedMonths:
              fixedDuration === 'indefinite'
                ? null
                : fixedMonths
          });
        }
      }

      /*
        3. TRANSAÇÃO NORMAL
      */
      else {
        await addTransaction(nova);
      }

      e.target.reset();

      document.getElementById('input-payment').value = 'debit';
      document.getElementById('input-card').value = '';

      document
        .getElementById('credit-card-group')
        ?.classList.add('hidden');

      document
        .getElementById('recurrence-group')
        ?.classList.add('hidden');

      document
        .getElementById('installments-group')
        ?.classList.add('hidden');

      document
        .getElementById('fixed-expense-group')
        ?.classList.add('hidden');

      document
        .getElementById('fixed-duration-group')
        ?.classList.add('hidden');

      document
        .getElementById('fixed-months-group')
        ?.classList.add('hidden');

      const recurrenceInput =
        document.getElementById('input-recurrence');

      const installmentsInput =
        document.getElementById('input-installments');

      const fixedExpenseInput =
        document.getElementById('input-fixed-expense');

      const fixedDurationInput =
        document.getElementById('input-fixed-duration');

      const fixedMonthsInput =
        document.getElementById('input-fixed-months');

      if (recurrenceInput) recurrenceInput.value = 'single';
      if (installmentsInput) installmentsInput.value = 2;
      if (fixedExpenseInput) fixedExpenseInput.value = 'no';
      if (fixedDurationInput) fixedDurationInput.value = 'limited';
      if (fixedMonthsInput) fixedMonthsInput.value = 12;

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
    const painel = e.target.closest('.bottom-panel');
    const botao = e.target.closest('.bottom-nav-btn, .action-menu');

    if (!painel && !botao) {
      window.fecharBottomPanels();
    }

    if (
      e.target.id === 'menu-panel' &&
      e.target.classList.contains('active')
    ) {
      window.fecharBottomPanels();
    }
  });


  document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tipo = document.getElementById('categoria-tipo').value;
    const nome = document.getElementById('categoria-nome').value.trim();

    if (!nome) return;

    if (!window.categoriasCustom[tipo].includes(nome)) {
      window.categoriasCustom[tipo].push(nome);
    }

    await saveUserSettings({
      categoriasCustom: window.categoriasCustom
    });

    document.getElementById('categoria-nome').value = '';

    window.renderCategoriasCustom();

    window.showToast({
      type: 'success',
      title: 'Categoria criada',
      message: `${nome} foi adicionada.`
    });
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

  document.getElementById('edit-tx-fixed')?.addEventListener('change', (e) => {
    const durationGroup = document.getElementById('edit-fixed-duration-group');
    const monthsGroup = document.getElementById('edit-fixed-months-group');

    if (e.target.value === 'yes') {
      durationGroup?.classList.remove('hidden');

      const duration =
        document.getElementById('edit-tx-fixed-duration')?.value || 'limited';

      if (duration === 'limited') {
        monthsGroup?.classList.remove('hidden');
      }
    } else {
      durationGroup?.classList.add('hidden');
      monthsGroup?.classList.add('hidden');
    }
  });

  document.getElementById('edit-tx-fixed-duration')?.addEventListener('change', (e) => {
    const monthsGroup = document.getElementById('edit-fixed-months-group');

    if (e.target.value === 'limited') {
      monthsGroup?.classList.remove('hidden');
    } else {
      monthsGroup?.classList.add('hidden');
    }
  });
});

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

  const editFixed = document.getElementById('edit-tx-fixed');
  const editDurationGroup = document.getElementById('edit-fixed-duration-group');
  const editMonthsGroup = document.getElementById('edit-fixed-months-group');
  const editDuration = document.getElementById('edit-tx-fixed-duration');
  const editMonths = document.getElementById('edit-tx-fixed-months');

  if (editFixed) {
    editFixed.value = tx.fixedExpense ? 'yes' : 'no';
  }

  if (editDuration) {
    editDuration.value = tx.fixedDuration || 'limited';
  }

  if (editMonths) {
    editMonths.value = tx.totalFixedMonths || 12;
  }

  if (tx.fixedExpense) {
    editDurationGroup?.classList.remove('hidden');

    if ((tx.fixedDuration || 'limited') === 'limited') {
      editMonthsGroup?.classList.remove('hidden');
    } else {
      editMonthsGroup?.classList.add('hidden');
    }
  } else {
    editDurationGroup?.classList.add('hidden');
    editMonthsGroup?.classList.add('hidden');
  }

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

const MONTHS = [
  'Jan', 'Fev', 'Mar',
  'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set',
  'Out', 'Nov', 'Dez'
];

window.currentPickerYear =
  new Date().getFullYear();



window.abrirMenuConfig = (secao) => {
  const modal = document.getElementById('modal-config');
  if (!modal) return;

  document.querySelectorAll('.config-section').forEach(s => s.classList.add('hidden'));

  const alvo = document.getElementById(`config-${secao}`);
  if (alvo) alvo.classList.remove('hidden');

  if (secao === 'regras') {
    document.getElementById('config-meta-essencial').value = window.regraFinanceira.essencial;
    document.getElementById('config-meta-reserva').value = window.regraFinanceira.reserva;
    document.getElementById('config-meta-lazer').value = window.regraFinanceira.lazer;
  }

  if (secao === 'categorias') {
    window.renderCategoriasConfig();
  }

  if (secao === 'tema') {
    const temaAtual = document.body.classList.contains('tema-claro') ? 'light' : 'dark';
    document.querySelectorAll('.tema-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tema-btn[onclick*="${temaAtual}"]`)?.classList.add('active');
  }

  window.fecharBottomPanels();
  requestAnimationFrame(() => modal.classList.add('active'));
};

window.fecharModalConfig = () => {
  document.getElementById('modal-config')?.classList.remove('active');
};

window.salvarNome = async () => {
  const novoNome = document.getElementById('input-novo-nome')?.value?.trim();
  if (!novoNome) return;

  try {
    await updateProfile(auth.currentUser, { displayName: novoNome });
    window.updateUserHeader(auth.currentUser);
    window.fecharModalConfig();
  } catch (e) {
    console.error('Erro ao salvar nome:', e);
  }
};

window.salvarRegrasConfig = async () => {
  const essencial = Number(document.getElementById('config-meta-essencial')?.value || 70);
  const reserva = Number(document.getElementById('config-meta-reserva')?.value || 20);
  const lazer = Number(document.getElementById('config-meta-lazer')?.value || 10);

  if (essencial + reserva + lazer !== 100) {
    alert('A soma precisa ser 100%.');
    return;
  }

  window.regraFinanceira = { essencial, reserva, lazer };

  await saveUserSettings({ regraFinanceira: window.regraFinanceira });

  window.atualizarDashboard?.();
  window.fecharModalConfig();
};

window.setTema = async (tema) => {
  if (tema === 'light') {
    document.body.classList.add('tema-claro');
  } else {
    document.body.classList.remove('tema-claro');
  }

  document.querySelectorAll('.tema-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tema-btn[onclick*="${tema}"]`)?.classList.add('active');

  await saveUserSettings({ tema });
};

window.salvarCategoria = async () => {
  const tipo = document.getElementById('config-cat-tipo')?.value;
  const nome = document.getElementById('config-cat-nome')?.value?.trim();

  if (!nome) return;

  if (!categoriasPorTipo[tipo].includes(nome)) {
    categoriasPorTipo[tipo].push(nome);
  }

  await saveUserSettings({ categorias: categoriasPorTipo });

  document.getElementById('config-cat-nome').value = '';
  window.renderCategoriasConfig();
};

window.removerCategoria = async (tipo, nome) => {
  categoriasPorTipo[tipo] = categoriasPorTipo[tipo].filter(c => c !== nome);
  await saveUserSettings({ categorias: categoriasPorTipo });
  window.renderCategoriasConfig();
};

window.renderCategoriasConfig = () => {
  const lista = document.getElementById('config-cat-lista');
  if (!lista) return;

  const tipos = { expense: 'Despesas', income: 'Receitas', goal: 'Caixinhas' };

  lista.innerHTML = Object.entries(categoriasPorTipo).map(([tipo, cats]) => `
    <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:12px 0 6px;">${tipos[tipo]}</p>
    <div>
      ${cats.map(cat => `
        <span class="cat-tag">
          ${cat}
          <button onclick="window.removerCategoria('${tipo}', '${cat}')">✕</button>
        </span>
      `).join('')}
    </div>
  `).join('');
};

window.carregarConfiguracoesUsuario = async (uid) => {
  const settings = await getUserSettings(uid);

  if (!settings) return;

  if (settings.regraFinanceira) {
    window.regraFinanceira = settings.regraFinanceira;
    const metaEssencial = document.getElementById('meta-essencial');
    const metaReserva = document.getElementById('meta-reserva');
    const metaLazer = document.getElementById('meta-lazer');
    if (metaEssencial) metaEssencial.value = window.regraFinanceira.essencial;
    if (metaReserva) metaReserva.value = window.regraFinanceira.reserva;
    if (metaLazer) metaLazer.value = window.regraFinanceira.lazer;
  }

  if (settings.tema === 'light') {
    document.body.classList.add('tema-claro');
  }

  if (settings.categorias) {
    Object.entries(settings.categorias).forEach(([tipo, cats]) => {
      categoriasPorTipo[tipo] = cats;
    });
  }

  if (settings?.categoriasCustom) {
    window.categoriasCustom = {
      income: settings.categoriasCustom.income || [],
      expense: settings.categoriasCustom.expense || [],
      goal: settings.categoriasCustom.goal || []
    };
  }

  window.atualizarDashboard?.();
};

window.renderMonthPicker = () => {
  const grid =
    document.getElementById('months-grid');

  const yearLabel =
    document.getElementById('month-picker-year');

  if (!grid || !yearLabel) return;

  yearLabel.textContent =
    window.currentPickerYear;

  const filtro =
    document.getElementById('filtro-mes');

  const valorAtual =
    filtro?.value || '';

  grid.innerHTML = MONTHS.map((mes, index) => {

    const value =
      `${window.currentPickerYear}-${String(index + 1).padStart(2, '0')}`;

    const active =
      value === valorAtual;

    return `
      <button
        type="button"
        class="month-item ${active ? 'active' : ''}"
        data-value="${value}"
      >
        ${mes}
      </button>
    `;
  }).join('');
};