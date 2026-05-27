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
      t.invoiceYear != null &&
      t.invoiceMonth != null
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

  if (selectCard) selectCard.innerHTML = optionsHtml;
  if (editSelectCard) editSelectCard.innerHTML = optionsHtml;
  if (!walletList) return;

  const cardsComFatura = cards.map((card, index) => ({
    ...card,
    index,
    invoiceValue: calcularFaturaAtualDoCartao(card.id)
  }));

  const totalFaturas = cardsComFatura.reduce(
    (acc, card) => acc + card.invoiceValue,
    0
  );

  const maiorFatura = cardsComFatura.reduce(
    (maior, card) =>
      card.invoiceValue > (maior?.invoiceValue || 0) ? card : maior,
    null
  );

  const proximoVencimento = cardsComFatura
    .filter(card => Number(card.dueDay))
    .sort((a, b) => Number(a.dueDay) - Number(b.dueDay))[0];

  walletList.innerHTML = cards.length
    ? `
      <div class="wallet-desktop-layout">

        <div class="wallet-cards-row">
          ${cardsComFatura.map(card => `
            <div class="wallet-credit-card card-color-${card.colorIndex ?? card.index % 4}">
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
                <strong>${formatBRL(card.invoiceValue)}</strong>
              </div>

              <div class="wallet-card-footer">
                <small>Fecha dia ${card.closingDay || '--'}</small>
                <small>Vence dia ${card.dueDay || '--'}</small>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="wallet-kpi-grid">
          <div class="wallet-kpi-box">
            <small><i class="ph ph-receipt"></i> Total a pagar</small>
            <strong class="wallet-kpi-danger">${formatBRL(totalFaturas)}</strong>
            <span>${cards.length} faturas em aberto</span>
          </div>

          <div class="wallet-kpi-box">
            <small><i class="ph ph-warning"></i> Próximo venc.</small>
            <strong class="wallet-kpi-warning">
              ${proximoVencimento ? `Dia ${proximoVencimento.dueDay}` : '--'}
            </strong>
            <span>${proximoVencimento?.name || 'Nenhum cartão'}</span>
          </div>

          <div class="wallet-kpi-box">
            <small><i class="ph ph-trend-up"></i> Maior fatura</small>
            <strong class="wallet-kpi-success">
              ${maiorFatura && totalFaturas > 0
      ? `${((maiorFatura.invoiceValue / totalFaturas) * 100).toFixed(1)}%`
      : '0%'}
            </strong>
            <span>${maiorFatura?.name || 'Nenhum'} do total</span>
          </div>

          <div class="wallet-kpi-box">
            <small><i class="ph ph-calendar"></i> Próximo fechamento</small>
            <strong>
              ${proximoVencimento ? `Dia ${proximoVencimento.closingDay || '--'}` : '--'}
            </strong>
            <span>${proximoVencimento?.name || 'Nenhum cartão'}</span>
          </div>
        </div>

        <div class="wallet-extra-grid">
          <div class="wallet-panel">
            <div class="wallet-panel-header">
              <h4>Distribuição das faturas</h4>
              <span>${formatBRL(totalFaturas)}</span>
            </div>

            <div class="wallet-bars">
              ${cardsComFatura.map(card => {
        const pct = totalFaturas > 0
          ? (card.invoiceValue / totalFaturas) * 100
          : 0;

        return `
                  <div class="wallet-bar-line">
                    <span>${card.name || 'Cartão'}</span>

                    <div class="wallet-bar-track">
                      <div
                        class="wallet-bar-fill card-bar-${card.colorIndex ?? card.index % 4}"
                        style="width:${pct}%"
                      ></div>
                    </div>

                    <strong>${pct.toFixed(1)}%</strong>
                  </div>
                `;
      }).join('')}
            </div>
          </div>

          <div class="wallet-panel">
            <div class="wallet-panel-header">
              <h4>Calendário de vencimentos</h4>
            </div>

            <div class="wallet-due-list">
              ${cardsComFatura
      .filter(card => Number(card.dueDay))
      .sort((a, b) => Number(a.dueDay) - Number(b.dueDay))
      .map(card => `
                  <div class="wallet-due-item">
                    <span class="wallet-due-dot card-dot-${card.colorIndex ?? card.index % 4}"></span>

                    <div>
                      <strong>${card.name || 'Cartão'}</strong>
                      <small>Vence dia ${card.dueDay}</small>
                    </div>

                    <b>${formatBRL(card.invoiceValue)}</b>
                  </div>
                `).join('')}
            </div>
          </div>
        </div>

      </div>
    `
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