/**
 * pdfGenerator.js
 * -----------------------------------------------------------------------
 * Função reutilizável: recebe só o link de um relatório Power BI
 * "Publish to Web" e devolve os bytes de um PDF com TODAS as páginas.
 *
 * O número de páginas NÃO precisa ser configurado manualmente: o robô lê
 * o indicador "X de Y" / "X of Y" que o próprio Power BI mostra no canto
 * do relatório (o mesmo "1 de 12" do seu print) e usa isso para saber
 * quando parar. Se o relatório mudar de 12 para 15 páginas mês que vem,
 * não precisa mexer em nada.
 * -----------------------------------------------------------------------
 */

const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

// Tempo de espera para o relatório renderizar os gráficos (ms).
const WAIT_RENDER_MS = 4000;

// Se por algum motivo não conseguirmos ler o indicador "X de Y", usamos
// esse limite de segurança para não ficar em loop infinito clicando.
const MAX_PAGINAS_SEGURANCA = 40;

// Possíveis seletores do botão "próxima página" dentro do embed público.
const NEXT_BUTTON_SELECTORS = [
  'button[title="Next Page"]',
  'button[aria-label="Next Page"]',
  '.navigationArrow.right',
  '.next-page',
  'div.arrow.right',
];

async function findAndClickNext(page) {
  for (const selector of NEXT_BUTTON_SELECTORS) {
    const el = await page.$(selector);
    if (el) {
      const desabilitado = await page.evaluate((elemento) => {
        return (
          elemento.disabled === true ||
          elemento.getAttribute('aria-disabled') === 'true' ||
          elemento.classList.contains('disabled')
        );
      }, el);
      if (desabilitado) return false;

      await el.click();
      return true;
    }
  }
  return false;
}

/**
 * Lê o indicador de páginas do relatório, tipo "3 de 12" ou "3 of 12".
 * Procura em todos os textos da página até achar um que combine.
 * @returns {Promise<{atual: number, total: number} | null>}
 */
async function lerIndicadorDePaginas(page) {
  return page.evaluate(() => {
    const regex = /(\d+)\s*(de|of)\s*(\d+)/i;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const texto = node.textContent.trim();
      if (!texto) continue;
      const match = texto.match(regex);
      if (match) {
        const atual = parseInt(match[1], 10);
        const total = parseInt(match[3], 10);
        if (total > 0 && total < 200) {
          return { atual, total };
        }
      }
    }
    return null;
  });
}

/**
 * Gera o PDF de um relatório Power BI publicado na web.
 * @param {string} url - link do iframe (Publish to Web)
 * @returns {Promise<Buffer>} bytes do PDF final
 */
async function gerarPdfDoRelatorio(url) {
  console.log('Abrindo navegador para:', url);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 576 });

    // Bloqueia recursos que pesam na memória mas não afetam o visual dos
    // gráficos (fontes web, vídeo, mídia). Mantém imagens, scripts e CSS.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const tipo = req.resourceType();
      if (tipo === 'media' || tipo === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, WAIT_RENDER_MS));

    const indicador = await lerIndicadorDePaginas(page);
    const totalPaginas = indicador ? indicador.total : MAX_PAGINAS_SEGURANCA;

    if (indicador) {
      console.log(`Indicador encontrado: relatório tem ${totalPaginas} página(s).`);
    } else {
      console.warn(
        `Não consegui ler o indicador "X de Y" de páginas. ` +
        `Vou tentar clicar em "próxima página" até não haver mais próxima ` +
        `(limite de segurança: ${MAX_PAGINAS_SEGURANCA}).`
      );
    }

    const pdfDoc = await PDFDocument.create();

    for (let i = 1; i <= totalPaginas; i++) {
      console.log(`Capturando página ${i}${indicador ? ` de ${totalPaginas}` : ''}...`);

      const pageBytes = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const singlePageDoc = await PDFDocument.load(pageBytes);
      const [copiedPage] = await pdfDoc.copyPages(singlePageDoc, [0]);
      pdfDoc.addPage(copiedPage);

      if (indicador && i >= totalPaginas) break;

      const clicked = await findAndClickNext(page);
      if (!clicked) {
        if (!indicador) {
          console.log('Não há mais botão de "próxima página" — relatório concluído.');
        } else {
          console.warn(
            'Não encontrei o botão de próxima página antes do esperado. ' +
            'Parando nesta página. Veja o README.md ("Como ajustar o seletor").'
          );
        }
        break;
      }
      await new Promise((r) => setTimeout(r, WAIT_RENDER_MS));
    }

    const finalPdfBytes = await pdfDoc.save();
    return Buffer.from(finalPdfBytes);
  } finally {
    await browser.close();
  }
}

module.exports = { gerarPdfDoRelatorio };
