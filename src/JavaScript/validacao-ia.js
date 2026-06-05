const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

function getApiKey() {
  return localStorage.getItem('finance_api_key') || '';
}

function extrairJSON(texto) {
  if (!texto) {
    return {
      aprovado: true,
      motivo: '',
      categoriaSugerida: '',
      financialCategorySugerida: '',
      alertas: []
    };
  }

  const limpo =
    texto
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');

    if (inicio >= 0 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch {
        return {
          aprovado: true,
          motivo: '',
          categoriaSugerida: '',
          financialCategorySugerida: '',
          alertas: []
        };
      }
    }

    return {
      aprovado: true,
      motivo: '',
      categoriaSugerida: '',
      financialCategorySugerida: '',
      alertas: []
    };
  }
}

function validarLocalmente(transacao) {
  const valor =
    Number(transacao.valor) || 0;

  const descricao =
    String(transacao.descricao || '').trim();

  const tipo =
    transacao.tipo;

  if (
    (tipo === 'expense' || tipo === 'income') &&
    valor <= 0
  ) {
    return {
      aprovado: false,
      motivo: 'O valor precisa ser maior que zero.',
      categoriaSugerida: '',
      financialCategorySugerida: '',
      alertas: []
    };
  }

  if (
    !descricao ||
    descricao.length < 2 ||
    ['aaa', 'xxx', 'teste', 'asdf'].includes(descricao.toLowerCase())
  ) {
    return {
      aprovado: false,
      motivo: 'A descrição da transação está vazia ou sem sentido.',
      categoriaSugerida: '',
      financialCategorySugerida: '',
      alertas: []
    };
  }

  return null;
}

export async function validarTransacao(transacao, acao = 'adicionar') {
  const erroLocal =
    validarLocalmente(transacao);

  if (erroLocal) {
    return erroLocal;
  }

  if (!getApiKey()) {
    return {
      aprovado: true,
      motivo: '',
      categoriaSugerida: '',
      financialCategorySugerida: '',
      alertas: []
    };
  }

  try {
    const response =
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getApiKey(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 350,
          system: `
Você é um validador de transações financeiras do app Finance Simplefy.

Analise a transação enviada e responda SOMENTE com JSON válido.

Formato obrigatório:

{
  "aprovado": true,
  "motivo": "",
  "categoriaSugerida": "",
  "financialCategorySugerida": "",
  "alertas": []
}

Regras:

Bloqueie com "aprovado": false se:
- Valor zero ou negativo para receita/despesa.
- Descrição vazia ou claramente sem sentido.
- Categoria totalmente incompatível com a descrição.
  Exemplo: "Netflix" em "Alimentação".
  Exemplo: "Aluguel" em "Lazer".

Não bloqueie apenas por valor alto.
Nesse caso, aprove e adicione alerta.

Use "alertas" quando:
- Valor for muito alto para uma despesa comum.
- Categoria parecer genérica demais.
- A transação parecer fora do padrão.
- Descrição sugerir assinatura, aluguel, financiamento ou conta recorrente.

Sugira:
- "categoriaSugerida" quando a categoria atual parecer ruim.
- "financialCategorySugerida" com uma destas opções:
  "essencial", "lazer" ou "reserva".

Classificação padrão:
- Moradia, mercado, saúde, transporte, água, energia, internet → essencial.
- Streaming, restaurante, viagem, festa, jogos, delivery → lazer.
- Investimento, caixinha, poupança, reserva → reserva.

Responda apenas JSON. Nenhum texto antes ou depois.
          `.trim(),
          messages: [
            {
              role: 'user',
              content: JSON.stringify({
                acao,
                transacao
              })
            }
          ]
        })
      });

    if (!response.ok) {
      return {
        aprovado: true,
        motivo: '',
        categoriaSugerida: '',
        financialCategorySugerida: '',
        alertas: [
          'Não foi possível validar com IA. A transação foi liberada.'
        ]
      };
    }

    const data =
      await response.json();

    const texto =
      data.content?.[0]?.text || '';

    const resultado =
      extrairJSON(texto);

    return {
      aprovado:
        resultado.aprovado !== false,

      motivo:
        resultado.motivo || '',

      categoriaSugerida:
        resultado.categoriaSugerida || '',

      financialCategorySugerida:
        resultado.financialCategorySugerida || '',

      alertas:
        Array.isArray(resultado.alertas)
          ? resultado.alertas
          : []
    };
  } catch (error) {
    console.warn('Erro na validação IA:', error);

    return {
      aprovado: true,
      motivo: '',
      categoriaSugerida: '',
      financialCategorySugerida: '',
      alertas: [
        'Não foi possível validar com IA. A transação foi liberada.'
      ]
    };
  }
}