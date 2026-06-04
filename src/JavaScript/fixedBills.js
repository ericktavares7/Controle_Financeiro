import { formatBRL } from './utils.js';

import {
  listenFixedBills,
  addFixedBill,
  updateFixedBill
} from './services/fixedBillService.js';

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

  document.getElementById('fixed-bill-id').value = conta.id;
  document.getElementById('fixed-bill-name').value = conta.name || '';
  document.getElementById('fixed-bill-value').value = formatInputMoney(conta.value);
  document.getElementById('fixed-bill-due').value = conta.dueDay || '';
  document.getElementById('fixed-bill-category').value = conta.category || 'Outros';
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

  const contas =
    window.fixedBills || [];

  list.innerHTML = contas.length
    ? contas.map(conta => `
      <div class="fixed-bill-item ${conta.paid ? 'paid' : ''}">

        <div>
          <strong>${conta.name || 'Conta sem nome'}</strong>

          <small>
            ${conta.category || 'Outros'}
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
            onclick="window.editarContaFixa('${conta.id}')"
          >
            Editar
          </button>

          ${conta.paid
        ? `
              <span class="fixed-bill-paid">
                <i class="ph ph-check-circle"></i>
                Pago
              </span>

              <button
                type="button"
                class="fixed-bill-undo"
                onclick="window.desfazerPagamentoContaFixa('${conta.id}')"
              >
                Desfazer
              </button>
            `
        : `
              <button
                type="button"
                class="fixed-bill-pay"
                onclick="window.pagarContaFixa('${conta.id}')"
              >
                Marcar paga
              </button>
            `
      }

        </div>

      </div>
    `).join('')
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

  const form =
    document.getElementById('form-conta-fixa');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editingId =
      document.getElementById('fixed-bill-id')?.value;

    const dadosConta = {
      name: document.getElementById('fixed-bill-name')?.value || '',
      value: parseMoneyBR(document.getElementById('fixed-bill-value')?.value),
      dueDay: Number(document.getElementById('fixed-bill-due')?.value),
      category: document.getElementById('fixed-bill-category')?.value || 'Outros',
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
  
}

export async function pagarContaFixa(contaId) {
  const conta =
    (window.fixedBills || [])
      .find(c => c.id === contaId);

  if (!conta || conta.paid) return;

  const hoje = new Date();

  const transacao = {
    id: crypto.randomUUID(),
    type: 'expense',
    desc: conta.name,
    val: conta.value,
    cat: conta.category,
    financialCategory: conta.financialCategory,
    paymentMethod: 'debit',
    createdAt: hoje,
    source: 'fixedBill',
    fixedBillId: conta.id
  };

  window.transactions =
    window.transactions || [];

  window.transactions.push(transacao);

  conta.paid = true;
  conta.paidAt = hoje;
  conta.paymentTxId = transacao.id;

  renderContasFixas();

  window.atualizarDashboard?.();
}

export async function desfazerPagamentoContaFixa(contaId) {
  const conta =
    (window.fixedBills || [])
      .find(c => c.id === contaId);

  if (!conta) return;

  if (conta.paymentTxId) {
    window.transactions =
      (window.transactions || [])
        .filter(t => t.id !== conta.paymentTxId);
  }

  conta.paid = false;
  conta.paidAt = null;
  conta.paymentTxId = null;

  renderContasFixas();

  window.atualizarDashboard?.();
}