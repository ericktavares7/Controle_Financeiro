import { formatBRL } from './utils.js';

import {
  listenFixedBills,
  addFixedBill,
  updateFixedBill
} from './services/fixedBillService.js';

import { addTransaction, deleteTransaction } from './services/transactionService.js';

import { deleteField } from 'firebase/firestore';

window.fixedBills = window.fixedBills || [];

function parseMoneyBR(value) {
  return Number(
    String(value || '0')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
}

function formatInputMoney(value) {
  return String(value || '')
    .replace('.', ',');
}

export function abrirModalContaFixa() {
  document.body.classList.add('modal-open');

  document
    .getElementById('modal-conta-fixa')
    ?.classList.add('active');
}

export function fecharModalContaFixa() {
  document
    .getElementById('modal-conta-fixa')
    ?.classList.remove('active');

  document.body.classList.remove('modal-open');

  const form = document.getElementById('form-conta-fixa');
  const idInput = document.getElementById('fixed-bill-id');
  const title = document.getElementById('fixed-bill-modal-title');

  form?.reset();

  if (idInput) idInput.value = '';
  document.querySelector('#modal-conta-fixa .modal-header h2').textContent =
    'Nova Conta Fixa';
}

export function editarContaFixa(contaId) {
  const conta =
    (window.fixedBills || [])
      .find(c => c.id === contaId);

  if (!conta) return;

  // PASSO 2: Garante que ao editar uma conta antiga salva como "Aluguel", ela carregue como "Moradia"
  const categoriaTratada = conta.category === 'Aluguel' ? 'Moradia' : (conta.category || 'Outros');

  document.getElementById('fixed-bill-id').value = conta.id;
  document.getElementById('fixed-bill-name').value = conta.name || '';
  document.getElementById('fixed-bill-value').value = formatInputMoney(conta.value);
  document.getElementById('fixed-bill-due').value = conta.dueDay || '';
  document.getElementById('fixed-bill-category').value = categoriaTratada;
  document.getElementById('fixed-bill-financial-cat').value =
    conta.financialCategory || 'essencial';

  document.querySelector('#modal-conta-fixa .modal-header h2').textContent =
    'Editar Conta Fixa';

  abrirModalContaFixa();
}

export function renderContasFixas() {
  const list =
    document.getElementById('fixed-bills-list');

  if (!list) return;
  const monthKey = getSelectedMonthKey();

  const contas =
    window.fixedBills || [];

  list.innerHTML = contas.length
    ? contas.map(conta => {
      // PASSO 2: Tradução visual automática de "Aluguel" para "Moradia" na listagem
      const categoriaExibida = conta.category === 'Aluguel' ? 'Moradia' : (conta.category || 'Outros');

      const pagamentoMes =
        getPaidMonthInfo(conta, monthKey);

      const estaPaga =
        pagamentoMes?.paid === true;

      return `
          <div class="fixed-bill-item ${estaPaga ? 'paid' : ''}">
            <div>
              <strong>${conta.name || 'Conta sem nome'}</strong>
              <small>
                ${categoriaExibida}
                • Vence dia ${conta.dueDay || '--'}
              </small>
            </div>

            <span class="fixed-bill-value">
              ${formatBRL(conta.value)}
            </span>

            <div class="fixed-bill-actions">
              <button
                type="button"
                class="fixed-bill-edit"
                data-fixedbill-action="edit"
                data-fixedbill-id="${conta.id}"
              >
                Editar
              </button>

              ${estaPaga
          ? `
                  <span class="fixed-bill-paid">
                    <i class="ph ph-check-circle"></i>
                    Pago
                  </span>

                  <button
                    type="button"
                    class="fixed-bill-undo"
                    data-fixedbill-action="undo"
                    data-fixedbill-id="${conta.id}"
                    data-fixedbill-month="${monthKey}"
                  >
                    Desfazer
                  </button>
                `
          : `
                  <button
                    type="button"
                    class="fixed-bill-pay"
                    data-fixedbill-action="pay"
                    data-fixedbill-id="${conta.id}"
                    data-fixedbill-month="${monthKey}"
                  >
                    Marcar paga
                  </button>
                `
        }
            </div>
          </div>
        `;
    }).join('')
    : `
      <p class="msg-vazio">
        Nenhuma conta fixa cadastrada.
      </p>
    `;
}

export function iniciarContasFixas() {
  window.abrirModalContaFixa = abrirModalContaFixa;
  window.fecharModalContaFixa = fecharModalContaFixa;
  window.editarContaFixa = editarContaFixa;
  window.pagarContaFixa = pagarContaFixa;
  window.desfazerPagamentoContaFixa = desfazerPagamentoContaFixa;
  window.renderContasFixas = renderContasFixas;

  const form =
    document.getElementById('form-conta-fixa');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editingId =
      document.getElementById('fixed-bill-id')?.value;

    let categoriaSelecionada = document.getElementById('fixed-bill-category')?.value || 'Outros';
    // PASSO 2: Se por acaso ainda vier como Aluguel no formulário, força salvar como Moradia
    if (categoriaSelecionada === 'Aluguel') categoriaSelecionada = 'Moradia';

    const dadosConta = {
      name: document.getElementById('fixed-bill-name')?.value || '',
      value: parseMoneyBR(document.getElementById('fixed-bill-value')?.value),
      dueDay: Number(document.getElementById('fixed-bill-due')?.value),
      category: categoriaSelecionada,
      financialCategory:
        document.getElementById('fixed-bill-financial-cat')?.value || 'essencial'
    };

    if (editingId) {
      await updateFixedBill(editingId, dadosConta);
    } else {
      await addFixedBill(dadosConta);
    }

    fecharModalContaFixa();
    window.atualizarDashboard?.();
  });

  listenFixedBills((bills) => {
    window.fixedBills = bills;
    renderContasFixas();
  });

  const list = document.getElementById('fixed-bills-list');

  list?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-fixedbill-action]');
    if (!button || !list.contains(button)) return;

    const action = button.dataset.fixedbillAction;
    const contaId = button.dataset.fixedbillId;
    const monthKey = button.dataset.fixedbillMonth || getSelectedMonthKey();

    if (action === 'edit') {
      editarContaFixa(contaId);
      return;
    }

    if (action === 'pay') {
      await pagarContaFixa(contaId, monthKey);
      return;
    }

    if (action === 'undo') {
      await desfazerPagamentoContaFixa(contaId, monthKey);
    }
  });
}

export async function pagarContaFixa(
  contaId,
  monthKey = getSelectedMonthKey()
) {
  const conta =
    (window.fixedBills || [])
      .find(c => c.id === contaId);

  if (!conta) return;

  const pagamentoMes =
    getPaidMonthInfo(conta, monthKey);

  // Se já existe transação daquele mês, remove antes de recriar
  if (pagamentoMes?.paymentTxId) {
    await deleteTransaction(pagamentoMes.paymentTxId);
  }

  const [ano, mes] = monthKey.split('-').map(Number);
  const dataPagamento = new Date(ano, mes - 1, Number(conta.dueDay) || 1, 12, 0, 0);

  const categoriaTransacao =
    conta.category === 'Aluguel'
      ? 'Moradia'
      : conta.category;

  const transacao = {
    type: 'expense',
    desc: conta.name,
    val: Number(conta.value) || 0,
    cat: categoriaTransacao || 'Outros',
    financialCategory: conta.financialCategory || 'essencial',
    paymentMethod: 'debit',

    createdAt: dataPagamento,
    purchaseDate: dataPagamento,

    source: 'fixedBill',
    fixedBillId: conta.id,
    fixedBillMonth: monthKey
  };

  const docRef =
    await addTransaction(transacao);

  if (!docRef?.id) {
    throw new Error('Erro ao criar transação da conta fixa.');
  }

  const [year, month] = monthKey.split('-');
  const unpaddedKey = `${year}-${Number(month)}`;
  const updateData = {
    [`paidMonths.${monthKey}`]: {
      paid: true,
      paidAt: dataPagamento,
      paymentTxId: docRef.id
    }
  };

  if (unpaddedKey !== monthKey) {
    updateData[`paidMonths.${unpaddedKey}`] = deleteField();
  }

  await updateFixedBill(conta.id, updateData);

  if (!conta.paidMonths) conta.paidMonths = {};
  conta.paidMonths[monthKey] = {
    paid: true,
    paidAt: dataPagamento,
    paymentTxId: docRef.id
  };

  if (conta.paidMonths && unpaddedKey !== monthKey) {
    delete conta.paidMonths[unpaddedKey];
  }

  renderContasFixas();
  window.atualizarDashboard?.();
}

export async function desfazerPagamentoContaFixa(
  contaId,
  monthKey = getSelectedMonthKey()
) {
  const conta =
    (window.fixedBills || [])
      .find(c => c.id === contaId);

  if (!conta) return;

  const pagamentoMes =
    getPaidMonthInfo(conta, monthKey);

  if (pagamentoMes?.paymentTxId) {
    await deleteTransaction(pagamentoMes.paymentTxId);
  }

  const [year, month] = monthKey.split('-');
  const unpaddedKey = `${year}-${Number(month)}`;
  const deleteUpdates = {
    [`paidMonths.${monthKey}`]: deleteField()
  };

  if (unpaddedKey !== monthKey) {
    deleteUpdates[`paidMonths.${unpaddedKey}`] = deleteField();
  }

  await updateFixedBill(conta.id, deleteUpdates);

  if (conta.paidMonths) {
    delete conta.paidMonths[monthKey];

    if (unpaddedKey !== monthKey) {
      delete conta.paidMonths[unpaddedKey];
    }
  }

  renderContasFixas();
  window.atualizarDashboard?.();
}

function getSelectedMonthKey() {
  const select = document.getElementById('filtro-mes');

  if (select?.value) {
    const [ano, mes] = select.value.split('-').map(Number);
    return formatMonthKey(ano, mes);
  }

  const hoje = new Date();
  return formatMonthKey(hoje.getFullYear(), hoje.getMonth());
}

function getPaidMonthInfo(conta, monthKey) {
  if (!conta?.paidMonths) return undefined;

  const [year, month] = monthKey.split('-');
  const unpaddedKey = `${year}-${Number(month)}`;

  return conta.paidMonths[monthKey] || conta.paidMonths[unpaddedKey];
}

function formatMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}