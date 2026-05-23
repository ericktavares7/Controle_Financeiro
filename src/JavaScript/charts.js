import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ChartDataLabels);

export function criarGraficoEvolucao() {
  const ctx =
    document.getElementById('mainEvolutionChart');

  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',

    data: {
      labels: [],
      datasets: [
        {
          label: 'Receitas',
          data: [],
          backgroundColor: '#00FFB2',
          borderRadius: 6,
          stack: 'financeiro'
        },
        {
          label: 'Despesas',
          data: [],
          backgroundColor: '#FF6B35',
          borderRadius: 6,
          stack: 'financeiro'
        },
        {
          label: 'Caixinhas',
          data: [],
          backgroundColor: '#00D1FF',
          borderRadius: 6,
          stack: 'financeiro'
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        datalabels: {
          display: (context) => {
            const value =
              Math.abs(context.dataset.data[context.dataIndex] || 0);

            if (!value) return false;

            const receitasDataset =
              context.chart.data.datasets[0];

            const receita =
              Math.abs(receitasDataset.data[context.dataIndex] || 0);

            if (!receita) return false;

            const perc =
              Math.round((value / receita) * 100);

            return perc >= 8;
          },

          color: (context) => {
            const label = context.dataset.label;

            if (label === 'Receitas') return '#003d2b';
            if (label === 'Despesas') return '#4a1800';

            return '#003d4a';
          },

          font: {
            size: 10,
            weight: '700'
          },

          formatter: (value, context) => {
            const receitasDataset =
              context.chart.data.datasets[0];

            const receita =
              Math.abs(receitasDataset.data[context.dataIndex] || 0);

            if (!receita) return '';

            const perc =
              Math.round((Math.abs(value) / receita) * 100);

            return `${perc}%`;
          },

          anchor: 'center',
          align: 'center',
          clamp: true,
          clip: true
        },

        legend: {
          position: 'top',
          labels: {
            color: '#94a3b8',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
            font: {
              size: 11,
              weight: '600'
            }
          }
        },

        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#cbd5e1',
          borderColor: '#1e2d40',
          borderWidth: 1,
          padding: 12,

          callbacks: {
            label: (context) => {
              const value =
                Math.abs(Number(context.raw || 0));

              return `${context.dataset.label}: ${value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}`;
            }
          }
        }
      },

      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            maxRotation: 0,
            minRotation: 0,
            font: {
              size: 10
            }
          }
        },

        y: {
          stacked: true,
          grid: {
            color: 'rgba(255,255,255,0.05)'
          },
          ticks: {
            color: '#94a3b8',
            autoSkip: false,
            maxRotation: 0,
            font: {
              size: 10,
              weight: '600'
            },
            callback: (value) => {
              const abs = Math.abs(value);

              if (abs >= 1000) {
                return `${value < 0 ? '-' : ''}${abs / 1000}k`;
              }

              return value;
            }
          }
        }
      }
    }
  });
}

export function atualizarGrafico(chart, todasTransactions) {
  if (!chart) return;

  if (!todasTransactions || todasTransactions.length === 0) {
    chart.data.labels = [];

    chart.data.datasets.forEach(dataset => {
      dataset.data = [];
    });

    chart.update();
    return;
  }

  const mesesNomes = [
    'Jan', 'Fev', 'Mar', 'Abr',
    'Mai', 'Jun', 'Jul', 'Ago',
    'Set', 'Out', 'Nov', 'Dez'
  ];

  const hoje = new Date();

  const limite =
    new Date(
      hoje.getFullYear(),
      hoje.getMonth() + 12,
      1
    );

  let mesesChaves = [
    ...new Set(
      todasTransactions.map(t => {
        const d =
          t.createdAt?.toDate
            ? t.createdAt.toDate()
            : new Date(t.createdAt);

        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    )
  ]
    .sort((a, b) => {
      const [anoA, mesA] =
        a.split('-').map(Number);

      const [anoB, mesB] =
        b.split('-').map(Number);

      return new Date(anoA, mesA) -
        new Date(anoB, mesB);
    })
    .filter(chave => {
      const [ano, mes] =
        chave.split('-').map(Number);

      return new Date(ano, mes, 1) <= limite;
    });

  const labels = [];
  const receitasData = [];
  const despesasData = [];
  const caixinhasData = [];

  mesesChaves.forEach(chave => {
    const [ano, mes] =
      chave.split('-').map(Number);

    labels.push(
      `${mesesNomes[mes]}/${ano.toString().slice(-2)}`
    );

    let receitas = 0;
    let despesas = 0;
    let caixinhas = 0;

    todasTransactions.forEach(t => {
      const d =
        t.createdAt?.toDate
          ? t.createdAt.toDate()
          : new Date(t.createdAt);

      if (
        d.getFullYear() === ano &&
        d.getMonth() === mes
      ) {
        if (t.type === 'income') {
          receitas += Number(t.val) || 0;
        }

        if (t.type === 'expense') {
          despesas += Number(t.val) || 0;
        }

        if (t.type === 'goal') {
          caixinhas += Number(t.val) || 0;
        }
      }
    });

    receitasData.push(receitas);
    despesasData.push(-despesas);
    caixinhasData.push(-caixinhas);
  });

  const totalMeses = labels.length;
  const isMobile = window.innerWidth < 768;

  chart.data.labels = labels;
  chart.data.datasets[0].data = receitasData;
  chart.data.datasets[1].data = despesasData;
  chart.data.datasets[2].data = caixinhasData;

  if (isMobile) {
    const wrapper =
      document.querySelector(
        '.chart-card.evolution .canvas-wrapper'
      );

    const canvas =
      document.getElementById('mainEvolutionChart');

    if (wrapper && canvas) {
      const largura =
        Math.max(totalMeses * 70, wrapper.clientWidth);

      chart.canvas.style.width = `${largura}px`;
      chart.canvas.width = largura;

      chart.options.responsive = false;
      chart.resize(largura, 280);
    }
  } else {
    chart.options.responsive = true;
    chart.resize();
  }

  chart.update();

  if (isMobile) {
    const wrapper =
      document.querySelector(
        '.chart-card.evolution .canvas-wrapper'
      );

    if (wrapper && totalMeses > 0) {
      const filtroVal =
        document.getElementById('filtro-mes')?.value || '';

      const [anoFiltro, mesFiltro] =
        filtroVal.split('-').map(Number);

      const mesLabel =
        `${mesesNomes[mesFiltro]}/${String(anoFiltro).slice(-2)}`;

      const idxAtual =
        labels.indexOf(mesLabel);

      const idx =
        idxAtual !== -1
          ? idxAtual
          : labels.length - 1;

      const barWidth =
        wrapper.scrollWidth / totalMeses;

      wrapper.scrollLeft =
        Math.max(0, (idx - 2) * barWidth);
    }
  }
}