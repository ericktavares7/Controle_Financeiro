import '../Styles/global.css';
import '../Styles/header.css';
import '../Styles/section.css';
import '../Styles/charts.css';
import '../Styles/chat.css';
import '../Styles/transactions.css';
import '../Styles/auth.css';
import '../Styles/responsive.css';

import { state } from './state.js';
import { formatBRL } from './utils.js';
import { showToast } from './toast.js';

import {
  aplicarTema,
  alternarTema,
  carregarTemaLocal
} from './theme.js';

import {
  abrirModalTransacao,
  fecharModalTransacao,
  abrirModalCartao,
  fecharModalCartao,
  iniciarModaisBase
} from './modals.js';

import {
  abrirCategorias,
  fecharCategorias,
  renderCategoriasCustom,
  removerCategoria,
  iniciarFormularioCategoria
} from './categories.js';

import {
  fecharBottomPanels,
  toggleQuickActions,
  toggleMetasPanel,
  toggleMenuPanel,
  iniciarBottomNav
} from './bottomNav.js';

import {
  abrirEditarNome,
  fecharEditarNome,
  enviarResetSenha,
  abrirRegraFinanceira,
  salvarRegraFinanceira,
  carregarConfiguracoesUsuario
} from './settings.js';

import {
  atualizarCartoesNaTela,
  abrirEditorCartao,
  fecharEditorCartao,
  removerCartaoAtual,
  initCardsListener,
  iniciarEventosCartoes,
  iniciarFormularioCartao
} from './cards.js';

import {
  renderListaTransacoes,
  deletarTransacao,
  fecharModalEditarTx,
  iniciarEdicaoTransacoes,
  iniciarFormularioTransacao,
  iniciarCamposTransacao,
  iniciarFiltroBlocos
} from './transactions.js';

import { atualizarDashboard } from './dashboard.js';

import {
  criarGraficoDonut
} from './charts.js';

import {
  iniciarAuth,
  updateUserHeader,
  logOut,
} from './auth.js';

import {
  abrirConfirmacaoSimples,
  abrirConfirmacaoParcelas,
  fecharConfirmacao,
  iniciarConfirmacao
} from './confirm.js';

import {
  popularSelectMeses,
  iniciarMonthPicker
} from './monthPicker.js';

import {
  iniciarChat,
  toggleConfigIA,
  salvarApiKey,
  limparHistoricoChat
} from './chat.js';

/* ========================================
   ESTADO GLOBAL TEMPORÁRIO
======================================== */

window.cards = state.cards;
window.transactions = state.transactions;
window.invoicePayments = state.invoicePayments;
window.regraFinanceira = state.regraFinanceira;
window.categoriasCustom = state.categoriasCustom;
window.ordemCrescente = false;

/* ========================================
   EXPOSIÇÃO TEMPORÁRIA NO WINDOW
======================================== */

window.showToast = showToast;

window.aplicarTema = aplicarTema;
window.alternarTema = alternarTema;

window.abrirCategorias = abrirCategorias;
window.fecharCategorias = fecharCategorias;
window.renderCategoriasCustom = renderCategoriasCustom;
window.removerCategoria = removerCategoria;

window.fecharBottomPanels = fecharBottomPanels;
window.toggleQuickActions = toggleQuickActions;
window.toggleMetasPanel = toggleMetasPanel;
window.toggleMenuPanel = toggleMenuPanel;

window.abrirEditarNome = abrirEditarNome;
window.fecharEditarNome = fecharEditarNome;
window.enviarResetSenha = enviarResetSenha;
window.abrirRegraFinanceira = abrirRegraFinanceira;
window.salvarRegraFinanceira = salvarRegraFinanceira;
window.carregarConfiguracoesUsuario = carregarConfiguracoesUsuario;

window.atualizarCartoesNaTela = atualizarCartoesNaTela;
window.abrirEditorCartao = abrirEditorCartao;
window.fecharEditorCartao = fecharEditorCartao;
window.removerCartaoAtual = removerCartaoAtual;
window.initCardsListener = initCardsListener;

window.renderListaTransacoes = renderListaTransacoes;
window.deletarTransacao = deletarTransacao;
window.fecharModalEditarTx = fecharModalEditarTx;

window.atualizarDashboard = atualizarDashboard;
window.updateUserHeader = updateUserHeader;
window.logOut = logOut;

window.abrirModal = abrirModalTransacao;
window.fecharModal = fecharModalTransacao;
window.abrirModalCartao = abrirModalCartao;
window.fecharModalCartao = fecharModalCartao;

window.abrirConfirmacaoSimples = abrirConfirmacaoSimples;
window.abrirConfirmacaoParcelas = abrirConfirmacaoParcelas;
window.fecharConfirmacao = fecharConfirmacao;

window.toggleConfigIA = toggleConfigIA;
window.salvarApiKey = salvarApiKey;
window.limparHistoricoChat = limparHistoricoChat;

/* ========================================
   CATEGORIAS / DISTRIBUIÇÃO
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

window.renderCategoriasGrafico = renderCategoriasGrafico;

/* ========================================
   FILTRO DE ORDEM
======================================== */

window.alternarOrdemFiltro = () => {
  window.ordemCrescente = !window.ordemCrescente;

  const btn = document.getElementById('btn-ordem');

  if (btn) {
    btn.innerHTML = window.ordemCrescente ? '▲' : '▼';
  }

  window.atualizarDashboard?.();
};

function iniciarSwipeTabsMobile() {
  if (window.innerWidth > 768) return;

  const tabs = ['overview', 'transacoes', 'ia'];

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let dragging = false;
  let isHorizontal = null;

  const tabSections = document.querySelectorAll('.tab-section');

  function resetTabsTransition() {
    tabSections.forEach(section => {
      section.style.transition =
        'transform 0.28s cubic-bezier(.2,.8,.2,1), opacity 0.28s';
    });
  }

  function resetActiveSection() {
    tabSections.forEach(section => {
      section.style.transform = '';
      section.style.opacity = '';
    });
  }

  document.addEventListener('touchstart', (e) => {
    const touchTarget = e.target;

    const insideHorizontalScroll = touchTarget.closest(
      '.wallet-cards-list, .canvas-wrapper'
    );

    if (insideHorizontalScroll) {
      dragging = false;
      return;
    }

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    dragging = true;
    isHorizontal = null;

    tabSections.forEach(section => {
      section.style.transition = 'none';
    });

  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;

    currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const diffX = currentX - startX;
    const diffY = currentY - startY;

    if (isHorizontal === null) {
      if (Math.abs(diffX) > Math.abs(diffY) + 5) {
        isHorizontal = true;
      } else if (Math.abs(diffY) > Math.abs(diffX) + 5) {
        isHorizontal = false;
        dragging = false;
        resetTabsTransition();
        resetActiveSection();
        return;
      } else {
        return;
      }
    }

    if (!isHorizontal) return;

    tabSections.forEach(section => {
      if (!section.classList.contains('active')) return;

      section.style.transform = `translateX(${diffX * 0.22}px)`;
      section.style.opacity = `${1 - Math.min(Math.abs(diffX) / 300, 0.35)}`;
    });

  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!dragging) return;

    const diffX = currentX - startX;

    resetTabsTransition();
    resetActiveSection();

    dragging = false;

    if (!isHorizontal || Math.abs(diffX) < 80) return;

    const activeBtn = document.querySelector('.tab-btn.active');
    const activeTab = activeBtn?.dataset.tab;
    const currentIndex = tabs.indexOf(activeTab);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    if (diffX < 0) {
      nextIndex = Math.min(currentIndex + 1, tabs.length - 1);
    } else {
      nextIndex = Math.max(currentIndex - 1, 0);
    }

    if (nextIndex === currentIndex) return;

    const currentSection = document.querySelector('.tab-section.active');

    currentSection?.classList.add(
      diffX < 0 ? 'swipe-out-left' : 'swipe-out-right'
    );

    setTimeout(() => {
      currentSection?.classList.remove('swipe-out-left', 'swipe-out-right');
      currentSection.style.transform = '';
      currentSection.style.opacity = '';

      document.querySelector(`[data-tab="${tabs[nextIndex]}"]`)?.click();
    }, 120);

  }, { passive: true });
}

/* ========================================
   DOM READY
======================================== */

window.addEventListener('load', () => {
  carregarTemaLocal();

  popularSelectMeses();

  iniciarAuth();
  iniciarMonthPicker();

  iniciarTabs();

  iniciarEventosCartoes();
  iniciarFormularioCartao();

  iniciarEdicaoTransacoes();
  iniciarFormularioTransacao();
  iniciarCamposTransacao();
  iniciarFiltroBlocos();

  iniciarFormularioCategoria();

  iniciarBottomNav();
  iniciarModaisBase();
  iniciarConfirmacao();

  criarGraficoDonut();

  iniciarChat();

  iniciarFiltroMes();
  iniciarEscape();
  iniciarSwipeTabsMobile();
});

function iniciarTabs() {
  const botoes = document.querySelectorAll('.tab-btn');
  const secoes = document.querySelectorAll('.tab-section');

  botoes.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      if (!target) return;

      window.fecharBottomPanels?.();

      botoes.forEach(b => b.classList.remove('active'));

      secoes.forEach(sec => {
        sec.classList.remove('active');
        sec.style.transform = '';
        sec.style.opacity = '';
        sec.classList.remove('swipe-out-left', 'swipe-out-right');
      });

      btn.classList.add('active');

      const secao = document.getElementById(`tab-${target}`);
      if (!secao) return;

      secao.classList.add('active');

      if (target === 'transacoes') {
        window.atualizarDashboard?.();
      }
    });
  });
}

function iniciarFiltroMes() {
  document
    .getElementById('filtro-mes')
    ?.addEventListener('change', () => {
      window.atualizarDashboard?.();
      window.renderContasFixas?.();
    });
}

function iniciarEscape() {
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
      window.fecharBottomPanels?.();
      return;
    }

    if (modalRegistro) {
      window.fecharModal?.();
      return;
    }

    if (modalCartao) {
      window.fecharModalCartao?.();
    }
  });
}