import {
  auth
} from './firebase.js';

import {
  login,
  register,
  observeAuthState
} from './services/authService.js';

import {
  listenTransactions
} from './services/transactionService.js';

import {
  listenInvoicePayments
} from './services/invoiceService.js';

import {
  signOut
} from 'firebase/auth';

let unsubscribeTransactions = null;
let unsubscribeInvoicePayments = null;


function showAuthMessage(message, type = 'error') {
  const container = document.getElementById('auth-message');

  if (!container) return;

  container.innerHTML = `
    <div class="auth-message ${type}">
      <span class="auth-message-icon">
        ${type === 'error' ? '⚠' : '✓'}
      </span>

      <span>${message}</span>
    </div>
  `;

  setTimeout(() => {
    container.innerHTML = '';
  }, 4000);
}

export function updateUserHeader(user) {
  const userName = document.getElementById('header-user-name');

  if (!userName || !user) return;

  const nome =
    user.displayName ||
    user.email?.split('@')[0] ||
    'Usuário';

  userName.textContent = nome;
}

export function iniciarAuth() {
  let isRegister = false;

  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const toggleText = document.getElementById('toggle-auth-text');
  const authExtras = document.querySelectorAll('.auth-extra');
  const authButton = document.getElementById('btn-auth-primary');

  const loginForm = document.getElementById('auth-form');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const senha = document.getElementById('auth-password').value;
    const nome = document.getElementById('auth-name')?.value || '';
    const sobrenome = document.getElementById('auth-lastname')?.value || '';
    const btn = document.getElementById('btn-auth-primary');

    btn.disabled = true;

    btn.innerHTML = `
      <span class="auth-loader"></span>
    `;

    try {
      if (isRegister) {
        await register(nome, sobrenome, email, senha);
      } else {
        await login(email, senha);
      }
    } catch (err) {
      console.error(err);

      let msg = 'Erro ao autenticar.';

      switch (err.code) {
        case 'auth/invalid-credential':
          msg = 'E-mail ou senha incorretos.';
          break;
        case 'auth/user-not-found':
          msg = 'Usuário não encontrado.';
          break;
        case 'auth/wrong-password':
          msg = 'Senha incorreta.';
          break;
        case 'auth/email-already-in-use':
          msg = 'Esse e-mail já está cadastrado.';
          break;
        case 'auth/weak-password':
          msg = 'A senha precisa ter no mínimo 6 caracteres.';
          break;
        case 'auth/invalid-email':
          msg = 'Digite um e-mail válido.';
          break;
        case 'auth/network-request-failed':
          msg = 'Você está sem internet.';
          break;
        case 'auth/too-many-requests':
          msg = 'Muitas tentativas. Aguarde alguns minutos.';
          break;
      }

      showAuthMessage(msg, 'error');
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = isRegister ? 'Criar Conta' : 'Entrar';
      }, 700);
    }
  });

  function setAuthMode(registerMode, pushState = true) {
    isRegister = registerMode;

    if (isRegister) {
      authTitle.textContent = 'Criar conta';
      authSubtitle.textContent =
        'Comece agora a organizar sua vida financeira';
      authButton.innerHTML = 'Criar Conta';

      toggleText.innerHTML = `
        Já possui uma conta?
        <a href="#" id="toggle-auth-link">Voltar para login</a>
      `;

      authExtras.forEach(el => {
        el.classList.remove('hidden');
        el.classList.add('show');
      });

      if (pushState) {
        history.pushState(
          { authMode: 'register' },
          '',
          '#cadastro'
        );
      }
    } else {
      authTitle.textContent = 'Bem-vindo de volta';
      authSubtitle.textContent =
        'Acesse sua conta para gerenciar suas finanças';
      authButton.innerHTML = 'Entrar';

      toggleText.innerHTML = `
        Não tem uma conta?
        <a href="#" id="toggle-auth-link">Criar conta grátis</a>
      `;

      authExtras.forEach(el => {
        el.classList.remove('show');
        el.classList.add('hidden');
      });

      if (pushState) {
        history.pushState(
          { authMode: 'login' },
          '',
          '#login'
        );
      }
    }

    bindToggleAuthLink();
  }

  function bindToggleAuthLink() {
    const link = document.getElementById('toggle-auth-link');

    link?.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthMode(!isRegister);
    });
  }

  bindToggleAuthLink();

  history.replaceState(
    { authMode: 'login' },
    '',
    '#login'
  );

  window.addEventListener('popstate', async () => {
    const authContainer = document.getElementById('auth-container');
    const app = document.getElementById('app');

    const modalRegistroAberto =
      document
        .getElementById('modal-registro')
        ?.classList.contains('active');

    const modalCartaoAberto =
      document
        .getElementById('modal-cartao')
        ?.classList.contains('active');

    const bottomAberto =
      document.querySelector('.bottom-panel.active');

    if (bottomAberto) {
      window.fecharBottomPanels?.();

      history.pushState(
        { app: true },
        '',
        '#app'
      );

      return;
    }

    if (modalRegistroAberto || modalCartaoAberto) {
      window.fecharModal?.();
      window.fecharModalCartao?.();

      history.pushState(
        { app: true },
        '',
        '#app'
      );

      return;
    }

    const estaNaTelaCadastro = isRegister;

    const estaLogado =
      document.body.classList.contains('logged-in');

    if (
      estaNaTelaCadastro &&
      authContainer?.style.display !== 'none'
    ) {
      setAuthMode(false, false);
      return;
    }

    if (
      estaLogado &&
      app?.style.display !== 'none'
    ) {
      window.abrirConfirmacaoSimples?.({
        title: 'Sair da conta?',
        text: 'Você será desconectado do app.',
        confirmText: 'Sair',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          await window.logOut?.();
        }
      });
    }
  });
}
export async function logOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro ao sair:', error);

    window.showToast?.({
      type: 'error',
      title: 'Erro ao sair',
      message: 'Não foi possível encerrar sua sessão.'
    });
  }
}


observeAuthState((user) => {

  const authContainer = document.getElementById('auth-container');
  const app = document.getElementById('app');

  if (user) {

    console.log("Usuário logado:", user.email);

    if (window.updateUserHeader) {
      window.updateUserHeader(user);
    }

    /* ESCONDE LOGIN */
    if (authContainer) {
      authContainer?.classList.add('fade-out');

      setTimeout(() => {

        authContainer.style.display = 'none';

      }, 300);
    }

    /* MOSTRA APP */
    if (app) {
      app.style.display = 'block';
    }

    document.body.classList.add('logged-in');

    if (location.hash !== '#app') {
      history.pushState({ app: true }, '', '#app');
    }

    /* REMOVE LISTENER ANTIGO */
    if (unsubscribeTransactions) {
      unsubscribeTransactions();
      unsubscribeTransactions = null;
    }

    if (unsubscribeInvoicePayments) {
      unsubscribeInvoicePayments();
      unsubscribeInvoicePayments = null;
    }
    
    unsubscribeTransactions = listenTransactions(user.uid, (txs) => {
      window.transactions = txs;

      window.atualizarDashboard?.();

      if (window.cards?.length) {
        window.atualizarCartoesNaTela?.(window.cards);
      }

      if (window.meuGrafico && window.atualizarGrafico) {
        window.atualizarGrafico(
          window.meuGrafico,
          txs
        );
      }
    });

    unsubscribeInvoicePayments = listenInvoicePayments(
      user.uid,
      (payments) => {

        window.invoicePayments = payments;

        window.atualizarDashboard?.();

        if (window.cards?.length) {
          window.atualizarCartoesNaTela?.(
            window.cards
          );
        }
      }
    );

    window.initCardsListener?.(user.uid);
    window.carregarConfiguracoesUsuario?.(user.uid);

    if (window.carregarConfiguracoesUsuario) {
      window.carregarConfiguracoesUsuario(user.uid);
    }

  } else {

    console.log("Nenhum usuário logado.");

    /* REMOVE O FADE */
    if (authContainer) {

      authContainer.classList.remove('fade-out');

      authContainer.style.display = 'flex';
    }

    /* ESCONDE APP */
    if (app) {
      app.style.display = 'none';
    }

    document.body.classList.remove('logged-in');

    window.transactions = [];
    window.invoicePayments = [];

    /* REMOVE LISTENER */
    if (unsubscribeTransactions) {

      unsubscribeTransactions();
      unsubscribeTransactions = null;
    }

    if (unsubscribeInvoicePayments) {
      unsubscribeInvoicePayments();
      unsubscribeInvoicePayments = null;
    }
  }
});