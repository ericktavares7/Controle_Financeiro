// state.js
export const CATS_LAZER = ['lazer', 'entretenimento', 'hobbies'];

export const state = {
  transactions: [],
  cards: [],
  regraFinanceira: {
    essencial: 70,
    reserva: 20,
    lazer: 10
  },
  categoriasCustom: {
    income: [],
    expense: [],
    goal: []
  },
  ordemCrescente: false,
  charts: {
    evolution: null
  }
};