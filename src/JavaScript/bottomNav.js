export function fecharBottomPanels() {
  document.querySelectorAll('.bottom-panel').forEach((panel) => {
    panel.classList.remove('active');
  });

  document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
}

export function toggleQuickActions() {
  const panel = document.getElementById('quick-actions-panel');
  const btn = document.querySelector('[data-bottom="actions"]');

  if (!panel) {
    console.error('quick-actions-panel não encontrado');
    return;
  }

  const isOpen = panel.classList.contains('active');

  fecharBottomPanels();

  if (!isOpen) {
    panel.classList.add('active');
    btn?.classList.add('active');
  }
}

export function toggleMetasPanel() {
  const panel = document.getElementById('metas-panel');
  const btn = document.querySelector('[data-bottom="metas"]');

  if (!panel) {
    console.error('metas-panel não encontrado');
    return;
  }

  const isOpen = panel.classList.contains('active');

  fecharBottomPanels();

  if (!isOpen) {
    panel.classList.add('active');
    btn?.classList.add('active');
  }
}

export function toggleMenuPanel() {
  const panel = document.getElementById('menu-panel');
  const btn = document.querySelector('[data-bottom="menu"]');

  if (!panel) {
    console.error('menu-panel não encontrado');
    return;
  }

  const isOpen = panel.classList.contains('active');

  fecharBottomPanels();

  if (!isOpen) {
    panel.classList.add('active');
    btn?.classList.add('active');
  }
}

export function iniciarBottomNav() {
  document.getElementById('btn-bottom-actions')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleQuickActions();
  });

  document.getElementById('btn-bottom-metas')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMetasPanel();
  });

  document.getElementById('btn-bottom-menu')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenuPanel();
  });

  document.addEventListener('click', (e) => {
    const painel = e.target.closest('.bottom-panel');
    const botao = e.target.closest('.bottom-nav-btn, .action-menu');

    if (!painel && !botao) {
      fecharBottomPanels();
    }

    if (
      e.target.id === 'menu-panel' &&
      e.target.classList.contains('active')
    ) {
      fecharBottomPanels();
    }

    if (
      e.target.id === 'metas-panel' &&
      e.target.classList.contains('active')
    ) {
      fecharBottomPanels();
    }
  });
}