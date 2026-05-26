import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

let donutBlocoChart = null;

export function criarGraficoDonut() {
  const ctx = document.getElementById('donutBlocoChart');
  if (!ctx) return null;

  donutBlocoChart = new Chart(ctx, {
    type: 'doughnut',

    data: {
      labels: ['Essenciais', 'Lazer', 'Reserva'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#00FFB2', '#FFD700', '#00D1FF'],
        borderColor: '#0f172a',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',

      plugins: {
        datalabels: { display: false },

        legend: { display: false },

        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#1e2d40',
          borderWidth: 1,
          padding: 12,

          callbacks: {
            label: (context) => {
              const value = Number(context.raw || 0);
              return ` ${value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}`;
            }
          }
        }
      }
    }
  });

  return donutBlocoChart;
}

export function atualizarGraficoDonut(essencial, lazer, reserva) {
  const chart = donutBlocoChart;
  if (!chart) return;

  const total = essencial + lazer + reserva;

  chart.data.datasets[0].data = [essencial, lazer, reserva];
  chart.update();

  const legenda = document.getElementById('donut-legenda');
  if (!legenda) return;

  const itens = [
    { label: 'Essenciais', valor: essencial, cor: '#00FFB2' },
    { label: 'Lazer', valor: lazer, cor: '#FFD700' },
    { label: 'Reserva', valor: reserva, cor: '#00D1FF' },
  ];

  legenda.innerHTML = itens.map(({ label, valor, cor }) => {
    const perc = total > 0 ? ((valor / total) * 100).toFixed(0) : 0;

    return `
      <div class="donut-legenda-item">
        <span class="donut-legenda-dot" style="background:${cor}"></span>
        <span class="donut-legenda-nome">${label}</span>
        <span class="donut-legenda-val">${valor.toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    })}</span>
        <span class="donut-legenda-perc">${perc}%</span>
      </div>
    `;
  }).join('');
}

export function atualizarComparativo(dadosMesAtual, dadosMesAnterior, nomeMesAtual, nomeMesAnterior) {
  const container = document.getElementById('comparativo-container');
  const legenda = document.getElementById('comparativo-legenda');

  if (!container) return;

  if (legenda) {
    legenda.textContent = `${nomeMesAnterior} vs ${nomeMesAtual}`;
  }

  const itens = [
    { label: 'Receita', atual: dadosMesAtual.rec, anterior: dadosMesAnterior.rec, cor: '#00FFB2' },
    { label: 'Despesas', atual: dadosMesAtual.des, anterior: dadosMesAnterior.des, cor: '#FF6B35' },
    { label: 'Reserva', atual: dadosMesAtual.res, anterior: dadosMesAnterior.res, cor: '#00D1FF' },
    { label: 'Lazer', atual: dadosMesAtual.lazer, anterior: dadosMesAnterior.lazer, cor: '#FFD700' },
  ];

  const maiorValor = Math.max(
    ...itens.map(i => Math.max(i.atual, i.anterior)), 1
  );

  container.innerHTML = itens.map(({ label, atual, anterior, cor }) => {
    const porcAtual = ((atual / maiorValor) * 100).toFixed(1);
    const porcAnterior = ((anterior / maiorValor) * 100).toFixed(1);

    const diff = anterior > 0
      ? Math.round(((atual - anterior) / anterior) * 100)
      : null;

    const diffHtml = diff !== null
      ? `<span class="comp-diff ${diff > 0 ? 'comp-diff--up' : diff < 0 ? 'comp-diff--down' : 'comp-diff--eq'}">
          ${diff > 0 ? '↑' : diff < 0 ? '↓' : '='} ${Math.abs(diff)}%
        </span>`
      : '';

    return `
      <div class="comp-row">
        <div class="comp-label-group">
          <span class="comp-label">${label}</span>
          ${diffHtml}
        </div>

        <div class="comp-bars">
          <div class="comp-bar-group">
            <span class="comp-bar-hint">${nomeMesAnterior}</span>
            <div class="comp-bar-track">
             <div class="comp-bar-fill comp-bar-anterior"
  style="
  width:${porcAnterior}%;
  background: ${cor}55;
">
</div>
            </div>
            <span class="comp-bar-val">${anterior.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>

          <div class="comp-bar-group">
            <span class="comp-bar-hint">${nomeMesAtual}</span>
            <div class="comp-bar-track">
              <div class="comp-bar-fill"
                style="width:${porcAtual}%; background:${cor}">
              </div>
            </div>
            <span class="comp-bar-val">${atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}