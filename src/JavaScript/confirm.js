export function abrirConfirmacaoSimples({
  title = 'Confirmar ação?',
  text = 'Essa ação não poderá ser desfeita.',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm
}) {
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

  if (btnCancelBottom) {
    btnCancelBottom.style.display = 'none';
  }

  btnPrimary.onclick = async () => {
    await onConfirm?.();
    fecharConfirmacao();
  };

  btnSecondary.onclick = () => {
    fecharConfirmacao();
  };

  requestAnimationFrame(() => {
    modal.classList.add('active');
  });
}

export function abrirConfirmacaoParcelas({
  onDeleteAll,
  onDeleteOne
}) {
  const modal = document.getElementById('modal-confirmacao');
  const btnAll = document.getElementById('confirm-primary');
  const btnOne = document.getElementById('confirm-secondary');
  const btnCancelBottom = document.querySelector('.confirm-cancel');

  const title = document.getElementById('confirm-title');
  const text = document.getElementById('confirm-text');

  if (!modal || !btnAll || !btnOne || !title || !text) {
    console.error('Modal de confirmação não encontrado.');
    return;
  }

  title.textContent = 'Excluir dívida?';
  text.textContent = 'Essa despesa possui parcelas futuras.';

  btnOne.textContent = 'Apenas esta';
  btnAll.textContent = 'Excluir tudo';

  if (btnCancelBottom) {
    btnCancelBottom.style.display = 'block';
  }

  btnAll.onclick = async () => {
    await onDeleteAll?.();
    fecharConfirmacao();
  };

  btnOne.onclick = async () => {
    await onDeleteOne?.();
    fecharConfirmacao();
  };

  requestAnimationFrame(() => {
    modal.classList.add('active');
  });
}

export function fecharConfirmacao() {
  document
    .getElementById('modal-confirmacao')
    ?.classList.remove('active');
}

export function iniciarConfirmacao() {
  const modal = document.getElementById('modal-confirmacao');

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      fecharConfirmacao();
    }
  });
}