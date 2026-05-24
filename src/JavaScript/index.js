import '../Styles/global.css';
import '../Styles/header.css';
import '../Styles/section.css';
import '../Styles/charts.css';
import '../Styles/chat.css';
import '../Styles/transactions.css';
import '../Styles/auth.css';
import '../Styles/responsive.css';

import { auth } from './firebase.js';

import {
  login,
  register,
  resetPassword,
  observeAuthState
} from './services/authService.js';

import { deleteDoc, doc, Timestamp } from "firebase/firestore";
import { signOut, updateProfile } from "firebase/auth";

import { state } from './state.js';

import {
  formatBRL,
  formatDate,
  calcularDataFatura,
  getMesSelecionado
} from './utils.js';

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
  categoriasPorTipo,
  abrirCategorias,
  fecharCategorias,
  renderCategoriasCustom,
  removerCategoria,
  obterCategoriasDoTipo,
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
  salvarNomeUsuario,
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
  iniciarCamposTransacao
} from './transactions.js';

import { atualizarDashboard } from './dashboard.js';

import {
  criarGraficoDonut,
  atualizarComparativo
} from './charts.js';

import {
  iniciarAuth,
  updateUserHeader,
  logOut,
  iniciarAuthStateObserver
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

import { iniciarFiltroBlocos } from './transactions.js';

import { iniciarChat, toggleConfigIA, salvarApiKey, limparHistoricoChat } from './chat.js';


window.cards = state.cards;
window.transactions = state.transactions;
window.regraFinanceira = state.regraFinanceira;
window.categoriasCustom = state.categoriasCustom;

window.ordemCrescente = false;

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


window.ordemCrescente = false;

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


window.alternarOrdemFiltro = () => {
  window.ordemCrescente = !window.ordemCrescente;

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

const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const toggleText = document.getElementById('toggle-auth-text');
const authExtras = document.querySelectorAll('.auth-extra');
const authButton = document.getElementById('btn-auth-primary');

document.addEventListener('DOMContentLoaded', () => {
  carregarTemaLocal();

  popularSelectMeses();

  iniciarMonthPicker();
  iniciarAuth();
  iniciarTabs();

  iniciarEventosCartoes();
  iniciarEdicaoTransacoes();
  iniciarFormularioTransacao();
  iniciarCamposTransacao();
  iniciarFormularioCategoria();
  iniciarBottomNav();

  iniciarFormularioCartao();
  iniciarEscape();
  iniciarAuth();
  iniciarAuthStateObserver();

  iniciarModaisBase();
  iniciarConfirmacao();
  iniciarFiltroBlocos();
  criarGraficoDonut();
  iniciarChat();

  document.getElementById('filtro-mes')
    ?.addEventListener('change', () => {
      window.atualizarDashboard();
    });

});

function iniciarTabs() {
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
}

window.fecharBottomPanels = function () {
  document.querySelectorAll('.bottom-panel').forEach((panel) => {
    panel.classList.remove('active');
  });

  document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
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