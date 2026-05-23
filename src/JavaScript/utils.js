export const formatBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

export const formatDate = (date) => {
  if (!date) return '--/--/--';

  const d =
    date?.toDate
      ? date.toDate()
      : date instanceof Date
        ? date
        : new Date(date);

  return d.toLocaleDateString('pt-BR');
};

export function calcularDataFatura(dataCompra, fechamento, vencimento) {
  const data = new Date(dataCompra);

  let ano = data.getFullYear();
  let mes = data.getMonth();

  if (data.getDate() > fechamento) {
    mes += 1;
  }

  return new Date(ano, mes, vencimento);
}

export function getMesSelecionado() {
  const select = document.getElementById('filtro-mes');

  if (!select) {
    const hoje = new Date();

    return {
      ano: hoje.getFullYear(),
      mes: hoje.getMonth()
    };
  }

  const [ano, mes] = select.value.split('-').map(Number);

  return { ano, mes };
}