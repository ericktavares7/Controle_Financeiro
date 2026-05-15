import './global.css';
import './header.css';
import './section.css';
import './charts.css';
import './chat.css';
import './transactions.css';
import './responsive.css';
import Chart from 'chart.js/auto';
import { db, auth, addTransaction } from './firebase.js';
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";

const categoriasPorTipo = {
  income: ["Salário", "Freelance", "Investimentos", "Presente", "Venda", "Outros"],
  expense: ["Alimentação", "Transporte", "Aluguel", "Lazer", "Saúde", "Educação", "Cartão de Crédito", "Outros"],
  goal: ["Reserva de Emergência", "Meta de Compra", "Aposentadoria", "Viagem"]
};

// --- FUNÇÕES GLOBAIS ---
window.abrirModal = (tipo) => {
  const modal = document.getElementById('modal-registro');
  const inputTipo = document.getElementById('input-tipo');
  const selectCat = document.getElementById('input-cat');
  const modalContent = modal?.querySelector('.modal-content');

  if (modal && inputTipo && selectCat) {
    inputTipo.value = tipo;
    if (modalContent) {
      modalContent.classList.remove('borda-receita', 'borda-despesa', 'borda-caixinha');
      if (tipo === 'income') modalContent.classList.add('borda-receita');
      else if (tipo === 'expense') modalContent.classList.add('borda-despesa');
      else if (tipo === 'goal') modalContent.classList.add('borda-caixinha');
    }
    selectCat.innerHTML = '';
    const lista = categoriasPorTipo[tipo] || [];
    lista.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      selectCat.appendChild(option);
    });
    modal.classList.add('active');
  }
};

window.fecharModal = () => document.getElementById('modal-registro')?.classList.remove('active');

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

function atualizarMetasIA(receita, despesa, reserva) {
  const container = document.getElementById('metas-container');
  if (!container || receita === 0) return;
  const pEssencial = ((despesa / receita) * 100).toFixed(1);
  const pReserva = ((reserva / receita) * 100).toFixed(1);

  container.innerHTML = `
    <div class="meta-item">
      <div class="meta-header"><span>Essencial (70%)</span><span style="color:${pEssencial > 70 ? '#FF6B35' : '#00FFB2'}">${pEssencial}%</span></div>
      <div class="progress-bar"><div style="width:${Math.min(pEssencial, 100)}%; background:${pEssencial > 70 ? '#FF6B35' : '#00FFB2'}"></div></div>
    </div>
    <div class="meta-item">
      <div class="meta-header"><span>Reserva (20%)</span><span style="color:#00D1FF">${pReserva}%</span></div>
      <div class="progress-bar"><div style="width:${Math.min(pReserva, 100)}%; background:#00D1FF"></div></div>
    </div>
  `;
}

function renderCategoriasGrafico(lista) {
  const container = document.getElementById('categoryList');
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
      <div class="category-bar-item">
        <div class="bar-info"><span>${cat}</span><b>${formatBRL(info.valor)}</b></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${porc}%; background:${cor}"></div></div>
      </div>`;
  }).join('');
}

function renderListaTransacoes(lista) {
  const cRec = document.getElementById('lista-receitas-historico');
  const cDes = document.getElementById('lista-despesas-historico');
  if (!cRec || !cDes) return;

  const template = (t) => `
    <div class="tx-item">
      <div class="tx-info">
        <span class="tx-desc">${t.desc}</span>
        <span class="tx-meta" style="color:rgba(255,255,255,0.4)">${t.cat || 'Geral'} · ${formatDate(t.createdAt)}</span>
      </div>
      <div class="tx-right">
        <span class="tx-val" style="color:${t.type === 'income' ? '#00FFB2' : '#FF6B35'}">
          ${t.type === 'income' ? '+' : '-'}${formatBRL(t.val)}
        </span>
        <button class="tx-delete" onclick="window.deletarTransacao('${t.id}')">✕</button>
      </div>
    </div>`;

  cRec.innerHTML = lista.filter(t => t.type === 'income').map(template).join('') || '<p>Sem receitas</p>';
  cDes.innerHTML = lista.filter(t => t.type !== 'income').map(template).join('') || '<p>Sem despesas</p>';
}

window.atualizarGrafico = (chart, todasTransactions) => {
  if (!chart || !todasTransactions.length) return;
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Extrai meses únicos ordenados
  const mesesChaves = [...new Set(todasTransactions.map(t => {
    const d = t.createdAt?.toDate ? t.createdAt.toDate() : (t.createdAt instanceof Date ? t.createdAt : null);
    return d ? `${d.getFullYear()}-${d.getMonth()}` : null;
  }))].filter(Boolean).sort();

  const labels = [], ganhos = [], gastos = [];
  mesesChaves.forEach(chave => {
    const [ano, mes] = chave.split('-').map(Number);
    labels.push(`${mesesNomes[mes]}/${ano.toString().slice(-2)}`);
    const soma = todasTransactions.reduce((acc, t) => {
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : (t.createdAt instanceof Date ? t.createdAt : null);
      if (d && d.getFullYear() === ano && d.getMonth() === mes) {
        if (t.type === 'income') acc.i += Number(t.val);
        else if (t.type === 'expense') acc.e += Number(t.val);
      }
      return acc;
    }, { i: 0, e: 0 });
    ganhos.push(soma.i); gastos.push(soma.e);
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

  // Chama a atualização do dashboard que agora vai usar essa ordem
  window.atualizarDashboard();
};

document.addEventListener('DOMContentLoaded', () => {
  popularSelectMeses();

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
          { label: 'Receitas', data: [], borderColor: '#00FFB2', backgroundColor: 'rgba(0, 255, 178, 0.1)', fill: true, tension: 0.4 },
          { label: 'Despesas', data: [], borderColor: '#FF6B35', backgroundColor: 'rgba(255, 107, 53, 0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
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
      createdAt: dataFinal
    };
    await addTransaction(nova);
    e.target.reset();
    window.fecharModal();
  });
});

function popularSelectMeses() {
  const select = document.getElementById('filtro-mes');
  if (!select) return;
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const d = new Date();
  select.innerHTML = meses.map((n, i) => `<option value="${d.getFullYear()}-${i}" ${i === d.getMonth() ? 'selected' : ''}>${n} ${d.getFullYear()}</option>`).join('');
}