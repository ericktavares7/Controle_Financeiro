export function popularSelectMeses() {
  const select = document.getElementById('filtro-mes');

  if (!select) return;

  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  const d = new Date();

  select.innerHTML =
    meses.map((nome, index) => `
      <option
        value="${d.getFullYear()}-${index}"
        ${index === d.getMonth() ? 'selected' : ''}
      >
        ${nome} ${d.getFullYear()}
      </option>
    `).join('');
}

export function iniciarMonthPicker() {


  const mesesPicker = [
    'Jan', 'Fev', 'Mar',
    'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set',
    'Out', 'Nov', 'Dez'
  ];

  let pickerYear = new Date().getFullYear();

  const filtroMes = document.getElementById('filtro-mes');
  const btnMonthPicker = document.getElementById('btn-open-month-picker');
  const monthModal = document.getElementById('month-picker-modal');
  const monthsGrid = document.getElementById('months-grid');
  const monthYearLabel = document.getElementById('month-picker-year');
  const prevYearBtn = document.getElementById('prev-year');
  const nextYearBtn = document.getElementById('next-year');

  if (!filtroMes || !btnMonthPicker || !monthModal || !monthsGrid) {
    return;
  }

  const [anoAtual] = filtroMes.value.split('-').map(Number);
  pickerYear = anoAtual;

  function atualizarTextoBotaoMes() {
    const [ano, mes] = filtroMes.value.split('-').map(Number);

    btnMonthPicker.innerHTML = `
      ${mesesPicker[mes]} ${ano}
      <i class="ph ph-caret-down"></i>
    `;
  }

  function renderMonthPicker() {
    if (!monthYearLabel) return;

    monthYearLabel.textContent = pickerYear;

    const valorAtual = filtroMes.value;

    monthsGrid.innerHTML = mesesPicker.map((nome, index) => {
      const value = `${pickerYear}-${index}`;

      return `
        <button
          type="button"
          class="month-item ${value === valorAtual ? 'active' : ''}"
          data-value="${value}"
        >
          ${nome}
        </button>
      `;
    }).join('');
  }

  atualizarTextoBotaoMes();
  renderMonthPicker();

  btnMonthPicker.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isActive = monthModal.classList.contains('active');
    monthModal.classList.toggle('active');

    if (!isActive) {
      requestAnimationFrame(() => {
        monthModal.classList.add('active');
        renderMonthPicker();
      });
    }
  });

  prevYearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    pickerYear--;
    renderMonthPicker();
  });

  nextYearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    pickerYear++;
    renderMonthPicker();
  });

  monthsGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.month-item');
    if (!btn) return;

    const value = btn.dataset.value;

    if (!Array.from(filtroMes.options).some(o => o.value === value)) {
      const [ano, mes] = value.split('-').map(Number);
      const nomeMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mes];
      const option = new Option(`${nomeMes} ${ano}`, value);
      filtroMes.appendChild(option);
    }

    filtroMes.value = value;
    atualizarTextoBotaoMes();

    filtroMes.dispatchEvent(new Event('change'));

    if (window.meuGrafico && window.transactions?.length) {
      window.atualizarGrafico(window.meuGrafico, window.transactions);
    }

    monthModal.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.month-picker-wrapper')) {
      monthModal.classList.remove('active');
    }
  });
}