import { saveUserSettings } from './services/settingsService.js';

export function aplicarTema(tema) {
  document.body.classList.toggle('light-mode', tema === 'light');
  localStorage.setItem('theme', tema);
}

export async function alternarTema() {
  const isLight =
    document.body.classList.contains('light-mode');

  const novoTema =
    isLight ? 'dark' : 'light';

  aplicarTema(novoTema);

  await saveUserSettings({
    theme: novoTema
  });

  window.showToast?.({
    type: 'success',
    title: 'Tema alterado',
    message:
      novoTema === 'light'
        ? 'Tema claro ativado.'
        : 'Tema escuro ativado.'
  });
}

export function carregarTemaLocal() {
  const temaSalvo =
    localStorage.getItem('theme') || 'dark';

  aplicarTema(temaSalvo);
}