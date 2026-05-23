import { saveUserSettings } from './services/settingsService.js';

export const categoriasPorTipo = {
  income: [
    'Salário',
    'Freelance',
    'Investimentos',
    'Presente',
    'Venda',
    'Outros'
  ],

  expense: [
    'Alimentação',
    'Transporte',
    'Moradia',
    'Lazer',
    'Saúde',
    'Educação',
    'Entretenimento',
    'Outros'
  ],

  goal: [
    'Reserva de Emergência',
    'Meta de Compra',
    'Aposentadoria',
    'Viagem'
  ]
};

export function abrirCategorias() {
  window.fecharBottomPanels?.();

  document
    .getElementById('modal-categorias')
    ?.classList.add('active');

  renderCategoriasCustom();
}

export function fecharCategorias() {
  document
    .getElementById('modal-categorias')
    ?.classList.remove('active');
}

export function renderCategoriasCustom() {
  const lista = document.getElementById('categorias-lista');

  if (!lista) return;

  const labels = {
    income: 'Receitas',
    expense: 'Despesas',
    goal: 'Caixinhas'
  };

  lista.innerHTML = Object
    .entries(window.categoriasCustom)
    .map(([tipo, categorias]) => `
      <div class="categoria-grupo">
        <h4>${labels[tipo]}</h4>

        <div class="categoria-tags">
          ${categorias.length
        ? categorias.map(cat => `
                  <span class="cat-tag">
                    ${cat}
                    <button
                      type="button"
                      onclick="window.removerCategoria('${tipo}', '${cat}')"
                    >
                      ×
                    </button>
                  </span>
                `).join('')
        : `<small>Nenhuma categoria criada.</small>`
      }
        </div>
      </div>
    `).join('');
}

export async function removerCategoria(tipo, nome) {
  window.categoriasCustom[tipo] =
    window.categoriasCustom[tipo]
      .filter(c => c !== nome);

  await saveUserSettings({
    categoriasCustom: window.categoriasCustom
  });

  renderCategoriasCustom();
}

export function obterCategoriasDoTipo(tipo) {
  return [
    ...(categoriasPorTipo[tipo] || []),
    ...(window.categoriasCustom?.[tipo] || [])
  ];
}

export function iniciarFormularioCategoria() {
  document
    .getElementById('form-categoria')
    ?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const tipo =
        document.getElementById('categoria-tipo')?.value;

      const input =
        document.getElementById('categoria-nome');

      const nomeOriginal =
        input?.value.trim();

      if (!tipo || !nomeOriginal) return;

      const nome =
        nomeOriginal.charAt(0).toUpperCase() +
        nomeOriginal.slice(1);

      const existe =
        window.categoriasCustom[tipo]
          .some(cat =>
            cat.toLowerCase() === nome.toLowerCase()
          );

      if (!existe) {
        window.categoriasCustom[tipo].push(nome);
      }

      await saveUserSettings({
        categoriasCustom: window.categoriasCustom
      });

      if (input) input.value = '';

      renderCategoriasCustom();

      window.showToast?.({
        type: 'success',
        title: existe
          ? 'Categoria já existe'
          : 'Categoria criada',
        message: existe
          ? `${nome} já estava cadastrada.`
          : `${nome} foi adicionada.`
      });
    });
}