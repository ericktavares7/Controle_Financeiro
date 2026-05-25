import {
  listenCreditCards,
  updateCreditCard,
  deleteCreditCard,
  addCreditCard
} from './services/cardService.js';

import { formatBRL, getMesSelecionado } from './utils.js';

let unsubscribeCards = null;

export function calcularFaturaAtualDoCartao(cardId) {
  const { ano, mes } = getMesSelecionado();

  return (window.transactions || []).reduce((total, t) => {
    if (
      t.type !== 'expense' ||
      t.paymentMethod !== 'credit' ||
      t.cardId !== cardId
    ) {
      return total;
    }

    if (
      t.invoiceYear !== undefined &&
      t.invoiceMonth !== undefined
    ) {
      return Number(t.invoiceYear) === ano &&
        Number(t.invoiceMonth) === mes
        ? total + (Number(t.val) || 0)
        : total;
    }

    const data = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);

    return data.getFullYear() === ano &&
      data.getMonth() === mes
      ? total + (Number(t.val) || 0)
      : total;
  }, 0);
}

export function atualizarCartoesNaTela(cards = []) {
  window.cards = cards;

  const selectCard = document.getElementById('input-card');
  const editSelectCard = document.getElementById('edit-tx-card');
  const walletList = document.getElementById('wallet-cards-list');

  const optionsHtml = `
    <option value="">Selecione um cartão</option>
    ${cards.map(card => `
      <option value="${card.id}">
        ${card.name || 'Cartão sem nome'}
      </option>
    `).join('')}
  `;

  if (selectCard) {
    selectCard.innerHTML = optionsHtml;
  }

  if (editSelectCard) {
    editSelectCard.innerHTML = optionsHtml;
  }

  if (!walletList) return;

  walletList.innerHTML = cards.length
    ? cards.map((card, index) => `
        <div class="wallet-credit-card card-color-${card.colorIndex ?? index % 4}">
          <div class="wallet-card-top">
            <span>${card.name || 'Cartão sem nome'}</span>

            <div class="wallet-card-actions">
              <i class="ph ph-credit-card"></i>

              <button
                type="button"
                class="wallet-card-config"
                data-card-id="${card.id}"
                aria-label="Configurar cartão"
              >
                <i class="ph ph-gear-six"></i>
              </button>
            </div>
          </div>

          <div class="wallet-card-invoice">
            <small>Fatura do mês</small>
            <strong>${formatBRL(calcularFaturaAtualDoCartao(card.id))}</strong>
          </div>

          <div class="wallet-card-footer">
            <small>Fecha dia ${card.closingDay || '--'}</small>
            <small>Vence dia ${card.dueDay || '--'}</small>
          </div>
        </div>
      `).join('')
    : `<p class="msg-vazio">Nenhum cartão cadastrado.</p>`;
}

export function abrirEditorCartao(cardId) {
  const card = (window.cards || []).find(c => c.id === cardId);

  if (!card) return;

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-name').value = card.name || '';
  document.getElementById('edit-card-closing').value = card.closingDay || '';
  document.getElementById('edit-card-due').value = card.dueDay || '';
  document.getElementById('edit-card-color').value = card.colorIndex ?? 0;

  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    document.getElementById('modal-editar-cartao')?.classList.add('active');
  });
}

export function fecharEditorCartao() {
  document.getElementById('modal-editar-cartao')?.classList.remove('active');
  document.body.classList.remove('modal-open');
}

export async function removerCartaoAtual() {
  const cardId = document.getElementById('edit-card-id')?.value;

  if (!cardId) return;

  window.abrirConfirmacaoSimples?.({
    title: 'Remover cartão?',
    text: 'As transações antigas continuarão salvas.',
    confirmText: 'Remover',
    cancelText: 'Cancelar',
    onConfirm: async () => {
      await deleteCreditCard(cardId);
      fecharEditorCartao();
    }
  });
}

export function initCardsListener(uid) {
  if (unsubscribeCards) {
    unsubscribeCards();
  }

  unsubscribeCards = listenCreditCards(uid, atualizarCartoesNaTela);
}

export function iniciarEventosCartoes() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.wallet-card-config');

    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    abrirEditorCartao(btn.dataset.cardId);
  });

  document
    .getElementById('form-editar-cartao')
    ?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const cardId = document.getElementById('edit-card-id')?.value;

      if (!cardId) return;

      await updateCreditCard(cardId, {
        name: document.getElementById('edit-card-name')?.value || '',
        closingDay: Number(document.getElementById('edit-card-closing')?.value),
        dueDay: Number(document.getElementById('edit-card-due')?.value),
        colorIndex: Number(document.getElementById('edit-card-color')?.value)
      });

      fecharEditorCartao();
    });
}

export function iniciarFormularioCartao() {
  const formCartao = document.getElementById('form-cartao');

  formCartao?.addEventListener('submit', async (e) => {
    e.preventDefault();

    await addCreditCard({
      name: document.getElementById('card-name')?.value || '',
      closingDay: Number(document.getElementById('card-closing')?.value),
      dueDay: Number(document.getElementById('card-due')?.value),
      colorIndex: 0
    });

    formCartao.reset();

    window.fecharModalCartao?.();

    window.showToast?.({
      type: 'success',
      title: 'Cartão adicionado',
      message: 'Seu cartão foi salvo com sucesso.'
    });
  });
}