import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import './transactions.css';
import './auth.css';
import './responsive.css';
import Chart from 'chart.js/auto';
import {
  db,
  auth,
  addTransaction,
  login
} from './firebase.js';
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";

window.logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
};

const categoriasPorTipo = {
  income: ["Salário", "Freelance", "Investimentos", "Presente", "Venda", "Outros"],
  expense: ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Cartão de Crédito", "Outros"],
  goal: ["Reserva de Emergência", "Meta de Compra", "Aposentadoria", "Viagem"]
};

// --- FUNÇÕES GLOBAIS ---
window.abrirModal = (tipo) => {

  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  const selectCat = document.getElementById('input-cat');
  const modalContent = modal?.querySelector('.modal-content');

  if (!modal || !inputTipo || !selectCat) return;

  /* TRAVA SCROLL */
  document.body.style.overflow = 'hidden';

  /* DEFINE TIPO */
  inputTipo.value = tipo;

  /* REMOVE BORDAS */
  if (modalContent) {

    modalContent.classList.remove(
      'borda-receita',
      'borda-despesa',
      'borda-caixinha'
    );

    const classeBorda =
      tipo === 'income'
        ? 'borda-receita'
        : tipo === 'expense'
          ? 'borda-despesa'
          : 'borda-caixinha';

    modalContent.classList.add(classeBorda);
  }

  /* POPULA CATEGORIAS */
  selectCat.innerHTML = '';

  const lista = categoriasPorTipo[tipo] || [];

  lista.forEach(cat => {

    const option = document.createElement('option');

    option.value = cat;
    option.textContent = cat;

    selectCat.appendChild(option);

  });

  /* ABRE MODAL */
  modal.classList.add('active');
};

window.fecharModal = () => {

  const modal = document.getElementById('modal-registro');

  if (!modal) return;

  modal.classList.remove('active');

  /* LIBERA SCROLL */
  document.body.style.overflow = '';
};

// FECHAR AO CLICAR NO FUNDO ESCURO
document.addEventListener('click', (e) => {
  const modal = document.getElementById('modal-registro');
  if (e.target === modal) {
    window.fecharModal();
  }
});

window.deletarTransacao = async (id) => {
  if (confirm('Deseja realmente excluir?')) {
    try { await deleteDoc(doc(db, "transacoes", id)); }
    catch (e) { console.error("Erro:", e); }
  }
};

const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date) => {
  if (!date) return "--/--/--";
  const d = date.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
  return d.toLocaleDateString('pt-BR');
};

// --- CORE: ATUALIZAÇÃO DO DASHBOARD ---
window.atualizarDashboard = () => {
  const select = document.getElementById('filtro-mes');
  if (!select) return;

  const [anoFiltro, mesFiltro] = select.value.split('-').map(Number);

  const dadosExibicao = (window.transactions || []).filter(t => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : (t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt));
    return d.getFullYear() === anoFiltro && d.getMonth() === mesFiltro;
  });

  dadosExibicao.sort((a, b) => {
    return ordemCrescente ? a.val - b.val : b.val - a.val;
  });

  renderListaTransacoes(dadosExibicao);
  renderCategoriasGrafico(dadosExibicao);

  // (Certifique-se de que os IDs abaixo existem no seu HTML)
  let rec = 0, des = 0, res = 0;
  dadosExibicao.forEach(t => {
    if (t.type === 'income') rec += t.val;
    else if (t.type === 'expense') des += t.val;
    else if (t.type === 'goal') res += t.val;
  });

  document.getElementById('mes-receita').textContent = formatBRL(rec);
  document.getElementById('mes-despesa').textContent = formatBRL(des);
  document.getElementById('mes-saldo').textContent = formatBRL(rec - des - res);

  atualizarMetasIA(rec, des, res);
};

function atualizarMetasIA(receita, despesa = 0, reserva = 0, lazer = 0) {
  const container = document.getElementById('metas-container');

  receita = Number(receita) || 0;
  despesa = Number(despesa) || 0;
  reserva = Number(reserva) || 0;
  lazer = Number(lazer) || 0;

  if (!container || receita === 0) return;

  const pEssencial = ((despesa / receita) * 100).toFixed(1);
  const pReserva = ((reserva / receita) * 100).toFixed(1);
  const pLazer = ((lazer / receita) * 100).toFixed(1);

  container.innerHTML = `
    <div class="meta-item">
      <div class="meta-header">
        <span>Essencial (70%)</span>
        <span style="color:${pEssencial > 70 ? '#FF6B35' : '#00FFB2'}">${pEssencial}%</span>
      </div>
      <div class="progress-bar">
        <div style="width:${Math.min(pEssencial, 100)}%; background:${pEssencial > 70 ? '#FF6B35' : '#00FFB2'}"></div>
      </div>
    </div>

    <div class="meta-item">
      <div class="meta-header">
        <span>Reserva (20%)</span>
        <span style="color:#00D1FF">${pReserva}%</span>
      </div>
      <div class="progress-bar">
        <div style="width:${Math.min(pReserva, 100)}%; background:#00D1FF"></div>
      </div>
    </div>

    <div class="meta-item">
      <div class="meta-header">
        <span>Lazer (10%)</span>
        <span style="color:#FFD700">${pLazer}%</span>
      </div>
      <div class="progress-bar">
        <div style="width:${Math.min(pLazer, 100)}%; background:#FFD700"></div>
      </div>
    </div>
  `;
}

window.destacarCategoria = (nomeCat) => {
  // 1. Muda para a aba de transações automaticamente
  const btnTransacoes = document.querySelector('[data-tab="transactions"]');
  if (btnTransacoes) btnTransacoes.click();

  // 2. Espera um pouquinho a aba carregar e procura os itens
  setTimeout(() => {
    const classeBusca = `.cat-${nomeCat.replace(/\s+/g, '-')}`;
    const itens = document.querySelectorAll(classeBusca);

    if (itens.length > 0) {
      itens.forEach(item => {
        item.classList.add('destaque-temp'); // Adiciona o efeito
        item.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Rola até o item

        // Remove após 2 segundos
        setTimeout(() => item.classList.remove('destaque-temp'), 2000);
      });
    }
  }, 100);
};

// AJUSTE NA RENDERIZAÇÃO: Adicione o onclick na barra
function renderCategoriasGrafico(lista) {
  // Tenta encontrar o container da aba transações OU o da visão geral
  const container = document.getElementById('mes-categorias') || document.getElementById('categoryList');
  if (!container) return;

  const totais = {};
  lista.forEach(t => {
    if (!totais[t.cat]) totais[t.cat] = { valor: 0, tipo: t.type };
    totais[t.cat].valor += t.val;
  });

  const categoriasArray = Object.entries(totais).sort((a, b) => b[1].valor - a[1].valor);
  const maiorValor = Math.max(...categoriasArray.map(c => c[1].valor), 0);

  container.innerHTML = categoriasArray.map(([cat, info]) => {
    const porc = maiorValor > 0 ? (info.valor / maiorValor) * 100 : 0;
    const cor = info.tipo === 'income' ? '#00FFB2' : '#FF6B35';

    return `
            <div class="category-bar-item" onclick="window.destacarCategoria('${cat}')" style="cursor: pointer; margin-bottom: 15px;">
                <div class="bar-info" style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                   <span class="bar-label">${cat}</span>
                    <b style="color: #fff;">${formatBRL(info.valor)}</b>
                </div>
                <div class="bar-bg" style="background: rgba(255,255,255,0.05); height: 8px; border-radius: 10px; overflow: hidden;">
                    <div class="bar-fill" style="width:${porc}%; background:${cor}; height: 100%; transition: width 0.5s ease;"></div>
                </div>
            </div>`;
  }).join('');
}

function renderListaTransacoes(lista) {

  const cRec = document.getElementById('lista-receitas-historico');
  const cDes = document.getElementById('lista-despesas-historico');

  if (!cRec || !cDes) return;

  const template = (t) => {

    const categoriaClasse =
      `cat-${(t.cat || 'Geral').replace(/\s+/g, '-')}`;

    const income = t.type === 'income';

    return `
      <div class="tx-item ${categoriaClasse}" id="tx-${t.id}">

        <div class="tx-info">

          <span class="tx-desc">
            ${t.desc}
          </span>

          <span class="tx-meta">
            ${t.cat || 'Geral'} • ${formatDate(t.createdAt)}
          </span>

        </div>

        <div class="tx-right">

          <span class="tx-val ${income ? 'tx-val--income' : 'tx-val--expense'}">

            ${income ? '+' : '-'}
            ${formatBRL(t.val)}

          </span>

          <button
            class="tx-delete"
            onclick="window.deletarTransacao('${t.id}')"
          >
            ✕
          </button>

        </div>

      </div>
    `;
  };

  const receitas = lista.filter(t => t.type === 'income');

  const despesas = lista.filter(t => t.type !== 'income');

  cRec.innerHTML =
    receitas.length
      ? receitas.map(template).join('')
      : `<p class="msg-vazio">Sem receitas</p>`;

  cDes.innerHTML =
    despesas.length
      ? despesas.map(template).join('')
      : `<p class="msg-vazio">Sem despesas</p>`;
}

window.atualizarGrafico = (chart, todasTransactions) => {

  if (!chart) return;

  if (!todasTransactions || todasTransactions.length === 0) {

    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];

    chart.update();

    return;
  }

  const mesesNomes = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez'
  ];

  const mesesChaves = [
    ...new Set(
      todasTransactions.map(t => {

        const d =
          t.createdAt?.toDate
            ? t.createdAt.toDate()
            : new Date(t.createdAt);

        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    )
  ].sort();

  const labels = [];
  const ganhos = [];
  const gastos = [];

  mesesChaves.forEach(chave => {

    const [ano, mes] = chave.split('-').map(Number);

    labels.push(
      `${mesesNomes[mes]}/${ano.toString().slice(-2)}`
    );

    let receitas = 0;
    let despesas = 0;

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
          receitas += Number(t.val);
        }

        if (t.type === 'expense') {
          despesas += Number(t.val);
        }
      }
    });

    ganhos.push(receitas);
    gastos.push(despesas);

  });

  chart.data.labels = labels;

  chart.data.datasets[0].data = ganhos;
  chart.data.datasets[1].data = gastos;

  chart.update();
};

let ordemCrescente = false;

window.alternarOrdemFiltro = () => {
  ordemCrescente = !ordemCrescente;
  const btn = document.getElementById('btn-ordem');

  // Muda o ícone do botão para dar feedback visual
  if (btn) btn.innerHTML = ordemCrescente ? '▲' : '▼';

  try {
    atualizarDashboard();
  } catch (e) {
    console.error(e);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  popularSelectMeses();

  /* ========================================
     LOGIN
  ======================================== */

  const loginForm =
    document.getElementById('login-form');

  if (loginForm) {

    loginForm.addEventListener(
      'submit',
      async (e) => {

        e.preventDefault();

        const email =
          document.getElementById('login-email').value;

        const senha =
          document.getElementById('login-password').value;

        console.log("Tentando login...");

        const btn =
          document.getElementById('btn-auth-primary');

        btn.classList.add('loading');

        try {

          await login(email, senha);

        } finally {

          setTimeout(() => {
            btn.classList.remove('loading');
          }, 700);

        }

      }
    );
  }

  /* ========================================
    TOGGLE LOGIN / CADASTRO
 ======================================== */

  let modoCadastro = false;

  const titulo =
    document.getElementById('auth-title');

  const subtitulo =
    document.getElementById('auth-subtitle');

  const botao =
    document.getElementById('btn-auth-primary');

  const toggleText =
    document.getElementById('toggle-auth-text');

  const toggleLink =
    document.getElementById('toggle-auth-link');

  toggleLink?.addEventListener('click', (e) => {

    e.preventDefault();

    modoCadastro = !modoCadastro;

    if (modoCadastro) {

      titulo.textContent =
        'Criar conta';

      subtitulo.textContent =
        'Comece a organizar sua vida financeira';

      botao.textContent =
        'Criar conta';

      toggleText.innerHTML =
        `Já possui conta?
         <a href="#" id="toggle-auth-link">
           Entrar
         </a>`;

    } else {

      titulo.textContent =
        'Bem-vindo de volta';

      subtitulo.textContent =
        'Acesse sua conta para gerenciar suas finanças';

      botao.textContent =
        'Entrar';

      toggleText.innerHTML =
        `Não tem uma conta?
         <a href="#" id="toggle-auth-link">
           Criar conta grátis
         </a>`;
    }
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-section, .tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(`tab-${target}`)?.classList.add('active');
      btn.classList.add('active');
    });
  });

  // Gráfico de Linha (Ondas)
  const ctx = document.getElementById('mainEvolutionChart');
  if (ctx) {
    window.meuGrafico = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Receitas',
            data: [],
            borderColor: '#00FFB2',
            backgroundColor: 'rgba(0, 255, 178, 0.1)',
            fill: true,
            tension: 0.4, // Isso cria a onda
            borderWidth: 3,
            pointRadius: 0 // Deixa a linha limpa
          },
          {
            label: 'Despesas',
            data: [],
            borderColor: '#FF6B35',
            backgroundColor: 'rgba(255, 107, 53, 0.1)',
            fill: true,
            tension: 0.4, // Isso cria a onda
            borderWidth: 3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  document.getElementById('filtro-mes')?.addEventListener('change', window.atualizarDashboard);

  document.getElementById('form-transacao')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputDataStr = document.getElementById('input-data')?.value;
    let dataFinal = new Date();
    if (inputDataStr) {
      const [ano, mes, dia] = inputDataStr.split('-').map(Number);
      dataFinal = new Date(ano, mes - 1, dia);
    }

    const nova = {
      desc: document.getElementById('input-desc').value,
      val: parseFloat(document.getElementById('input-val').value),
      type: document.getElementById('input-tipo').value,
      cat: document.getElementById('input-cat').value,
      createdAt: Timestamp.fromDate(dataFinal)
    };
    await addTransaction(nova);
    e.target.reset();
    window.fecharModal();
  });

  document.addEventListener('keydown', (e) => {

    if (e.key === 'Escape') {

      const modal = document.getElementById('modal-registro');

      if (modal?.classList.contains('active')) {
        window.fecharModal();
      }
    }
  });

  /* ========================================
     PREVINE ZOOM IOS
  ======================================== */

  document.querySelectorAll('input, select').forEach(el => {
    el.style.fontSize = '16px';
  });
});



function popularSelectMeses() {
  const select = document.getElementById('filtro-mes');
  if (!select) return;
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const d = new Date();
  select.innerHTML = meses.map((n, i) => `<option value="${d.getFullYear()}-${i}" ${i === d.getMonth() ? 'selected' : ''}>${n} ${d.getFullYear()}</option>`).join('');
}