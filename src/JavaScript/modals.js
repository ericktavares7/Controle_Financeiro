import { obterCategoriasDoTipo } from './categories.js';
import { CATS_LAZER } from './state.js';

export function abrirModalTransacao(tipo) {
  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  const selectCat = document.getElementById('input-cat');
  const modalContent = modal?.querySelector('.modal-content');

  if (!modal || !inputTipo || !selectCat) return;

  window.fecharBottomPanels?.();

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

  const lista = obterCategoriasDoTipo(tipo);

  lista.forEach(cat => {
    const option = document.createElement('option');

    option.value = cat;
    option.textContent = cat;

    selectCat.appendChild(option);
  });

  const paymentGroup = document.getElementById('payment-method-group');
  const creditCardGroup = document.getElementById('credit-card-group');
  const inputPayment = document.getElementById('input-payment');
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
  const financialGroup = document.getElementById('financial-category-group');
  const financialCatInput = document.getElementById('input-financial-cat');

  if (tipo === 'expense') {
    financialGroup?.classList.remove('hidden');
    if (financialCatInput) financialCatInput.value = 'essencial';
  } else if (tipo === 'goal') {
    financialGroup?.classList.remove('hidden');
    if (financialCatInput) financialCatInput.value = 'reserva';
  } else {
    financialGroup?.classList.add('hidden');
  }
  document.body.classList.add('modal-open');
  modal.classList.add('active');
}

export function fecharModalTransacao() {
  const modal = document.getElementById('modal-registro');

  if (!modal) return;

  modal.classList.remove('active');
  document.body.classList.remove('modal-open');
}

export function abrirModalCartao() {
  const modal = document.getElementById('modal-cartao');

  if (!modal) return;

  window.fecharBottomPanels?.();

  document.body.classList.add('modal-open');

  modal.classList.add('active');
}

export function fecharModalCartao() {
  const modal = document.getElementById('modal-cartao');

  if (!modal) return;

  modal.classList.remove('active');

  document.body.classList.remove('modal-open');
}

export function iniciarModaisBase() {
  document.addEventListener('click', (e) => {
    const modalRegistro = document.getElementById('modal-registro');
    const modalCartao = document.getElementById('modal-cartao');
    const modalCategorias = document.getElementById('modal-categorias');
    const modalNome = document.getElementById('modal-editar-nome');

    if (e.target === modalRegistro) {
      fecharModalTransacao();
    }

    if (e.target === modalCartao) {
      fecharModalCartao();
    }

    if (e.target === modalCategorias) {
      window.fecharCategorias?.();
    }

    if (e.target === modalNome) {
      window.fecharEditarNome?.();
    }
  });
}