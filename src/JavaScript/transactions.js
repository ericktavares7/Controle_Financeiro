import {
  updateTransaction,
  deleteInstallmentGroup,
  addTransaction,
  deleteTransaction
} from './services/transactionService.js';

import { Timestamp } from 'firebase/firestore';

import {
  formatBRL,
  formatDate,
  calcularDataFatura
} from './utils.js';

import { CATS_LAZER } from './state.js';

let filtroBloco = 'todos';


function criarDataLocal(value) {
  if (!value) return new Date();

  const [ano, mes, dia] = value.split('-').map(Number);

  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

function adicionarMeses(data, qtd) {
  return new Date(
    data.getFullYear(),
    data.getMonth() + qtd,
    data.getDate(),
    12,
    0,
    0
  );
}

function calcularDadosFaturaCartao(dataCompra, cartao) {
  const closingDay = Number(cartao.closingDay);
  const dueDay = Number(cartao.dueDay);

  let anoFechamento = dataCompra.getFullYear();
  let mesFechamento = dataCompra.getMonth();

  if (dataCompra.getDate() > closingDay) {
    mesFechamento++;

    if (mesFechamento > 11) {
      mesFechamento = 0;
      anoFechamento++;
    }
  }

  let anoVencimento = anoFechamento;
  let mesVencimento = mesFechamento;

  if (dueDay <= closingDay) {
    mesVencimento++;

    if (mesVencimento > 11) {
      mesVencimento = 0;
      anoVencimento++;
    }
  }

  const invoiceDueDate = new Date(
    anoVencimento,
    mesVencimento,
    dueDay,
    12,
    0,
    0
  );

  return {
    invoiceYear: invoiceDueDate.getFullYear(),
    invoiceMonth: invoiceDueDate.getMonth(),
    invoiceDueDate: Timestamp.fromDate(invoiceDueDate),
    cardClosingDay: closingDay,
    cardDueDay: dueDay
  };
}

export function getFiltroBloco() {
  return filtroBloco;
}

export function iniciarFiltroBlocos() {
  document.querySelectorAll('.filtro-bloco-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro-bloco-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      filtroBloco = btn.dataset.bloco;

      window.atualizarDashboard?.();
    });
  });
}

export function renderListaTransacoes(lista) {
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
          <span class="tx-desc">${t.desc}</span>

          <span class="tx-meta">
            ${t.cat || 'Geral'}${paymentInfo} • ${formatDate(t.createdAt)}
          </span>
        </div>

        <div class="tx-right">
          <span class="tx-val ${income
        ? 'tx-val--income'
        : goal
          ? 'tx-val--goal'
          : 'tx-val--expense'
      }">
            ${sinal} ${formatBRL(t.val)}
          </span>

<button
  type="button"
  class="btn-edit-tx"
  data-tx-id="${t.id}"
  aria-label="Editar transação"
>
  <i class="ph ph-pencil-simple"></i>
</button>

<button
  type="button"
  class="tx-delete"
  onclick="window.deletarTransacao('${t.id}')"
  aria-label="Remover transação"
>
  <i class="ph ph-trash"></i>
</button>
        </div>
      </div>
    `;
  };

  const receitas =
    lista.filter(t => t.type === 'income');

  const despesas =
    lista.filter(t => t.type !== 'income');

  const totalReceitas = receitas.reduce(
    (acc, t) => acc + (Number(t.val) || 0),
    0
  );

  const totalDespesas = despesas.reduce(
    (acc, t) => acc + (Number(t.val) || 0),
    0
  );

  const totalReceitasEl = document.getElementById('total-receitas-lista');
  const totalDespesasEl = document.getElementById('total-despesas-lista');

  if (totalReceitasEl) {
    totalReceitasEl.textContent = `+ ${formatBRL(totalReceitas)}`;
  }

  if (totalDespesasEl) {
    totalDespesasEl.textContent = `- ${formatBRL(totalDespesas)}`;
  }

  cRec.innerHTML =
    receitas.length
      ? receitas.map(template).join('')
      : `<p class="msg-vazio">Sem receitas</p>`;

  cDes.innerHTML =
    despesas.length
      ? despesas.map(template).join('')
      : `<p class="msg-vazio">Sem despesas</p>`;
}

export async function deletarTransacao(id) {
  const tx = (window.transactions || []).find(t => t.id === id);

  if (!tx) {
    console.error('Transação não encontrada:', id);
    return;
  }

  try {
    if (tx.installmentGroupId) {
      window.abrirConfirmacaoParcelas?.({
        onDeleteAll: async () => {
          await deleteInstallmentGroup(tx.installmentGroupId);
        },

        onDeleteOne: async () => {
          await deleteTransaction(id);
        }
      });

      return;
    }

    window.abrirConfirmacaoSimples?.({
      title: 'Excluir transação?',
      text: 'Essa ação removerá este lançamento do seu histórico.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',

      onConfirm: async () => {
        await deleteTransaction(id);
      }
    });

  } catch (e) {
    console.error('Erro ao excluir:', e);
  }
}

export function fecharModalEditarTx() {
  document
    .getElementById('modal-editar-transacao')
    ?.classList.remove('active');
}

export function iniciarEdicaoTransacoes() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-edit-tx');

    if (!btn) return;

    const txId = btn.dataset.txId;

    const tx =
      (window.transactions || [])
        .find(t => t.id === txId);

    if (!tx) return;

    document.getElementById('edit-tx-id').value = tx.id;
    document.getElementById('edit-tx-desc').value = tx.desc || '';
    document.getElementById('edit-tx-val').value = tx.val || '';

    const dataTx =
      tx.purchaseDate?.toDate
        ? tx.purchaseDate.toDate()
        : tx.createdAt?.toDate
          ? tx.createdAt.toDate()
          : new Date(tx.createdAt);

    document.getElementById('edit-tx-date').value =
      dataTx.toISOString().split('T')[0];

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

    const editFinCat = document.getElementById('edit-tx-financial-cat');
    if (editFinCat) {
      editFinCat.value = tx.financialCategory ||
        (CATS_LAZER.includes(String(tx.cat || '').toLowerCase()) ? 'lazer' : 'essencial');
    }

    document
      .getElementById('modal-editar-transacao')
      ?.classList.add('active');
  });

  document
    .getElementById('form-editar-transacao')
    ?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('edit-tx-id').value;

      const tx =
        (window.transactions || [])
          .find(t => t.id === id);

      if (!tx) {
        console.error('Transação não encontrada para edição:', id);
        return;
      }

      const desc = document.getElementById('edit-tx-desc').value;
      const val = Number(
        document.getElementById('edit-tx-val').value
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0;
      
      const dataEditada =
        criarDataLocal(document.getElementById('edit-tx-date')?.value);
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


      const financialCategory =
        document.getElementById('edit-tx-financial-cat')?.value || 'essencial';


      const cartaoEditado =
        (window.cards || []).find(c => c.id === cardId);

      const dadosFatura =
        paymentMethod === 'credit' && cartaoEditado
          ? calcularDadosFaturaCartao(dataEditada, cartaoEditado)
          : {
            invoiceYear: null,
            invoiceMonth: null,
            invoiceDueDate: null,
            cardClosingDay: null,
            cardDueDay: null
          };

      await updateTransaction(id, {
        desc,
        val,
        paymentMethod,
        cardId,
        financialCategory,

        purchaseDate: Timestamp.fromDate(dataEditada),
        createdAt: Timestamp.fromDate(dataEditada),

        ...dadosFatura,

        fixedExpense,
        fixedDuration: fixedExpense ? fixedDuration : null,

        fixedIndefinite: fixedExpense && fixedDuration === 'indefinite',

        totalFixedMonths:
          fixedExpense && fixedDuration !== 'indefinite' ? fixedMonths : null
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
            financialCategory,

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

      fecharModalEditarTx();
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
}

export function iniciarFormularioTransacao() {

  const form = document.getElementById('form-transacao');

  if (!form) return;

  if (form.dataset.listenerAttached === 'true') return;

  form.dataset.listenerAttached = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const inputDataStr =
      document.getElementById('input-data')?.value;

    const dataCompra = criarDataLocal(inputDataStr);

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
      Number(
        document.getElementById('input-val').value
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0

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

    const financialCategory =
      document.getElementById('input-financial-cat')?.value || 'essencial';


    if (
      tipo === 'expense' &&
      paymentMethod === 'credit' &&
      !cartao
    ) {
      window.showToast?.({
        type: 'error',
        title: 'Cartão obrigatório',
        message: 'Selecione um cartão de crédito.'
      });

      return;
    }

    const dadosFatura =
      tipo === 'expense' &&
        paymentMethod === 'credit' &&
        cartao
        ? calcularDadosFaturaCartao(dataCompra, cartao)
        : {};

    const nova = {
      desc: descricao,
      val: valor,
      type: tipo,
      cat: categoria,
      financialCategory,
      paymentMethod,
      cardId,

      purchaseDate: Timestamp.fromDate(dataCompra),

      createdAt: Timestamp.fromDate(dataCompra),

      ...dadosFatura
    };

    if (
      tipo === 'expense' &&
      paymentMethod === 'credit' &&
      recurrence === 'installment'
    ) {
      const groupId = crypto.randomUUID();

      for (let i = 0; i < installments; i++) {
        const dataParcela =
          adicionarMeses(dataCompra, i);

        const dadosFaturaParcela =
          calcularDadosFaturaCartao(
            dataParcela,
            cartao
          );

        await addTransaction({
          ...nova,
          ...dadosFaturaParcela,

          desc: `${descricao} (${i + 1}/${installments})`,
          val: valor / installments,

          purchaseDate: Timestamp.fromDate(dataParcela),
          createdAt: Timestamp.fromDate(dataParcela),

          installmentGroupId: groupId,
          installmentNumber: i + 1,
          totalInstallments: installments
        });
      }
    }

    else if (
      tipo === 'expense' &&
      fixedExpense
    ) {
      const fixedGroupId = crypto.randomUUID();

      for (let i = 0; i < fixedMonths; i++) {
        const dataFixa = adicionarMeses(dataCompra, i);

        const dadosFaturaFixa =
          paymentMethod === 'credit'
            ? calcularDadosFaturaCartao(dataFixa, cartao)
            : {};

        await addTransaction({
          ...nova,
          ...dadosFaturaFixa,

          desc:
            fixedDuration === 'indefinite'
              ? `${descricao} (fixa)`
              : `${descricao} (${i + 1}/${fixedMonths})`,

          val: valor,

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

    else {
      await addTransaction(nova);
    }

    e.target.reset();

    document.getElementById('input-payment').value = 'debit';
    document.getElementById('input-card').value = '';

    document.getElementById('credit-card-group')?.classList.add('hidden');
    document.getElementById('recurrence-group')?.classList.add('hidden');
    document.getElementById('installments-group')?.classList.add('hidden');
    document.getElementById('fixed-expense-group')?.classList.add('hidden');
    document.getElementById('fixed-duration-group')?.classList.add('hidden');
    document.getElementById('fixed-months-group')?.classList.add('hidden');

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

    window.fecharModal?.();
  });
}

export function iniciarCamposTransacao() {
  const inputPayment = document.getElementById('input-payment');
  const creditCardGroup = document.getElementById('credit-card-group');

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

  document.getElementById('input-cat')?.addEventListener('change', (e) => {
    const catNorm = e.target.value.toLowerCase().trim();
    const financialCatInput = document.getElementById('input-financial-cat');
    if (!financialCatInput) return;

    financialCatInput.value = CATS_LAZER.includes(catNorm) ? 'lazer' : 'essencial';
  });

  document.getElementById('input-recurrence')?.addEventListener('change', (e) => {
    const installmentsGroup = document.getElementById('installments-group');

    if (e.target.value === 'installment') {
      installmentsGroup?.classList.remove('hidden');
    } else {
      installmentsGroup?.classList.add('hidden');
    }
  });

  document.getElementById('input-fixed-expense')?.addEventListener('change', (e) => {
    const fixedDurationGroup = document.getElementById('fixed-duration-group');
    const fixedMonthsGroup = document.getElementById('fixed-months-group');

    if (e.target.value === 'yes') {
      fixedDurationGroup?.classList.remove('hidden');

      const duration =
        document.getElementById('input-fixed-duration')?.value || 'limited';

      if (duration === 'limited') {
        fixedMonthsGroup?.classList.remove('hidden');
      }
    } else {
      fixedDurationGroup?.classList.add('hidden');
      fixedMonthsGroup?.classList.add('hidden');
    }
  });

  document.getElementById('input-fixed-duration')?.addEventListener('change', (e) => {
    const fixedMonthsGroup = document.getElementById('fixed-months-group');

    if (e.target.value === 'limited') {
      fixedMonthsGroup?.classList.remove('hidden');
    } else {
      fixedMonthsGroup?.classList.add('hidden');
    }
  });

  document.getElementById('recurrence-group')?.classList.add('hidden');
  document.getElementById('installments-group')?.classList.add('hidden');

  const recurrenceInput = document.getElementById('input-recurrence');
  const installmentsInput = document.getElementById('input-installments');

  if (recurrenceInput) recurrenceInput.value = 'single';
  if (installmentsInput) installmentsInput.value = 2;
}