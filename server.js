/**
 * server.js
 * -----------------------------------------------------------------------
 * Endpoint principal:
 *   GET /exportar/:id  -> busca o relatório pelo ID em config/relatorios.json,
 *                         gera o PDF na hora e manda para download do
 *                         navegador de quem clicou (sem salvar em disco).
 *
 * GET /relatorios     -> lista os IDs disponíveis (útil para conferir se
 *                         o cadastro está certo antes de configurar o botão)
 * -----------------------------------------------------------------------
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { gerarPdfDoRelatorio } = require('./pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'config', 'relatorios.json');

function carregarRelatorios() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

app.get('/relatorios', (req, res) => {
  const relatorios = carregarRelatorios();
  res.json(
    relatorios.map((r) => ({ id: r.id, cliente: r.cliente, pilar: r.pilar }))
  );
});

app.get('/exportar/:id', async (req, res) => {
  const relatorios = carregarRelatorios();
  const relatorio = relatorios.find((r) => r.id === req.params.id);

  if (!relatorio) {
    return res.status(404).send(
      `Relatório "${req.params.id}" não encontrado em config/relatorios.json`
    );
  }

  try {
    console.log(`Gerando PDF para ${relatorio.cliente} - ${relatorio.pilar}...`);
    const pdfBuffer = await gerarPdfDoRelatorio(relatorio.url);

    const nomeArquivo = `${relatorio.cliente} - ${relatorio.pilar}.pdf`.replace(
      /[/\\?%*:|"<>]/g,
      '-'
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    res.status(500).send('Erro ao gerar o PDF. Tente novamente em instantes.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
