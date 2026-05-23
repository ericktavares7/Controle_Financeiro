import { auth } from './firebase.js';

import { resetPassword } from './services/authService.js';

import {
  saveUserSettings,
  getUserSettings
} from './services/settingsService.js';

import { updateProfile } from 'firebase/auth';

export function abrirEditarNome() {
  window.fecharBottomPanels?.();

  const modal = document.getElementById('modal-editar-nome');
  const input = document.getElementById('input-novo-nome');

  if (input) {
    input.value = auth.currentUser?.displayName || '';
  }

  requestAnimationFrame(() => {
    modal?.classList.add('active');
  });
}

export function fecharEditarNome() {
  document
    .getElementById('modal-editar-nome')
    ?.classList.remove('active');
}

export async function salvarNomeUsuario() {
  const novoNome =
    document.getElementById('input-novo-nome')?.value.trim();

  if (!novoNome) return;

  await updateProfile(auth.currentUser, {
    displayName: novoNome
  });

  await saveUserSettings({
    displayName: novoNome
  });

  window.updateUserHeader?.(auth.currentUser);

  window.showToast?.({
    type: 'success',
    title: 'Nome atualizado',
    message: 'Seu nome foi alterado com sucesso.'
  });

  fecharEditarNome();
}

export async function enviarResetSenha() {
  try {
    const email = auth.currentUser?.email;

    if (!email) {
      window.showToast?.({
        type: 'error',
        title: 'Usuário não encontrado',
        message: 'Não foi possível identificar seu e-mail.'
      });

      return;
    }

    await resetPassword(email);

    window.showToast?.({
      type: 'success',
      title: 'E-mail enviado',
      message: `Link de redefinição enviado para ${email}`
    });

  } catch (e) {
    console.error(e);

    window.showToast?.({
      type: 'error',
      title: 'Erro',
      message: 'Não foi possível enviar o e-mail.'
    });
  }
}

export function abrirRegraFinanceira() {
  window.fecharBottomPanels?.();

  const panel = document.getElementById('metas-panel');

  if (!panel) {
    console.error('metas-panel não encontrado');
    return;
  }

  const regra = window.regraFinanceira || {
    essencial: 70,
    reserva: 20,
    lazer: 10
  };

  document.getElementById('meta-essencial').value = regra.essencial;
  document.getElementById('meta-reserva').value = regra.reserva;
  document.getElementById('meta-lazer').value = regra.lazer;

  requestAnimationFrame(() => {
    panel.classList.add('active');
  });
}

export async function salvarRegraFinanceira() {
  const essencial =
    Number(document.getElementById('meta-essencial')?.value || 70);

  const reserva =
    Number(document.getElementById('meta-reserva')?.value || 20);

  const lazer =
    Number(document.getElementById('meta-lazer')?.value || 10);

  const total = essencial + reserva + lazer;

  if (total !== 100) {
    window.showToast?.({
      type: 'error',
      title: 'Regra inválida',
      message: 'A soma das metas precisa ser exatamente 100%.'
    });

    return;
  }

  window.regraFinanceira = {
    essencial,
    reserva,
    lazer
  };

  await saveUserSettings({
    regraFinanceira: window.regraFinanceira
  });

  window.atualizarDashboard?.();
  window.fecharBottomPanels?.();

  window.showToast?.({
    type: 'success',
    title: 'Regra atualizada',
    message: `Nova estratégia: ${essencial}/${reserva}/${lazer}.`
  });
}

export async function carregarConfiguracoesUsuario(uid) {
  const settings = await getUserSettings(uid);

  if (!settings) return;

  if (settings.regraFinanceira) {
    window.regraFinanceira = {
      essencial: Number(settings.regraFinanceira.essencial) || 70,
      reserva: Number(settings.regraFinanceira.reserva) || 20,
      lazer: Number(settings.regraFinanceira.lazer) || 10
    };
  }

  if (settings.categoriasCustom) {
    window.categoriasCustom = {
      income: settings.categoriasCustom.income || [],
      expense: settings.categoriasCustom.expense || [],
      goal: settings.categoriasCustom.goal || []
    };
  }

  if (settings.theme && window.aplicarTema) {
    window.aplicarTema(settings.theme);
  }

  window.atualizarDashboard?.();
}