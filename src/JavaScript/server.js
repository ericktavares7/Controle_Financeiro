import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const dados = await resposta.json();
    res.json(dados);

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ error: 'Erro ao chamar a API' });
  }
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));