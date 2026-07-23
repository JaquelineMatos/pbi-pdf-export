# Exportar PDF sob demanda — vários relatórios Power BI (Publish to Web)

Este projeto atende o cenário de 150 clientes x vários pilares (~500
relatórios possíveis). Cada cliente/pilar tem seu próprio botão "Exportar
PDF" na página do site. Quando o visitante clica, o servidor gera o PDF
daquele relatório específico **na hora** e manda direto para a máquina dele
— nada fica pré-gerado ou guardado.

## Como funciona

1. Você cadastra cada relatório em `config/relatorios.json` (cliente, pilar,
   link do iframe, número de páginas).
2. Cada botão no site aponta para `GET /exportar/ID-DO-RELATORIO`.
3. O servidor abre aquele relatório com um navegador invisível, percorre as
   páginas e devolve o PDF pronto como download — sem salvar nada em disco.

Como são ~50 exportações por dia (não 500 simultâneas), isso funciona bem
gerando sob demanda, sem precisar de fila, banco de dados ou agendamento.

## Passo 1 — Cadastre os relatórios

Edite `config/relatorios.json` e adicione um item para cada cliente/pilar:

```json
{
  "id": "2b-automacao-comercial",
  "cliente": "2B Automação",
  "pilar": "Comercial",
  "url": "https://app.powerbi.com/view?r=SEU_LINK_AQUI"
}
```

- `id`: identificador único (sem espaços/acentos), usado na URL do botão.
- Não existe campo de "número de páginas" — o robô lê sozinho, toda vez
  que gera o PDF, o indicador "X de Y" que o próprio Power BI mostra no
  canto do relatório (o mesmo "1 de 12" do seu print). Se o relatório tiver
  11 páginas esse mês e 15 no mês que vem, não precisa atualizar nada aqui.

Você pode ter os 500 itens nesse mesmo arquivo — é só uma lista, e cada
item só precisa desses 4 campos (`id`, `cliente`, `pilar`, `url`).

## Passo 2 — Suba este projeto no GitHub

1. Crie uma conta gratuita em https://github.com (se ainda não tiver).
2. Crie um repositório (ex: `pbi-pdf-export`).
3. Faça upload de todos os arquivos desta pasta (arrastar e soltar em
   "Add file" → "Upload files" — não precisa de terminal).

## Passo 3 — Deploy no Render.com

1. Crie uma conta em https://render.com (dá para entrar com o GitHub).
2. **New +** → **Web Service** → escolha o repositório.
3. Configurações:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Recomendo o plano pago mais simples (Starter, ~US$7/mês) em vez do
   gratuito: no plano gratuito o serviço "dorme" e demora pra acordar,
   o que deixaria o primeiro clique do dia bem lento para o cliente.
5. Depois do deploy você terá uma URL, ex:
   `https://pbi-pdf-export.onrender.com`

## Passo 4 — Confira os relatórios cadastrados

Acesse:
```
https://SEU-SERVICO.onrender.com/relatorios
```
Isso lista todos os IDs cadastrados — confirme que o `id` que você vai usar
no botão bate com o que está aqui.

## Passo 5 — Coloque o botão no site

Ao lado do botão "Atualizar Comercial" que você já tem, adicione (trocando
o ID pelo do relatório daquela página):

```html
<button
  onclick="window.location.href='https://SEU-SERVICO.onrender.com/exportar/2b-automacao-comercial'"
  style="
    position:absolute;
    top:0;
    right:180px;
    background:#0078D4;
    color:white;
    padding:10px 20px;
    border:none;
    border-radius:6px;
    cursor:pointer;
  ">
  📄 Exportar PDF
</button>
```

Cada página/pilar do site vai ter o mesmo botão, só mudando o ID no final
da URL para bater com o relatório daquela página específica.

Como a geração leva ~1 minuto (o navegador invisível precisa carregar e
percorrer todas as páginas), é uma boa ideia trocar o texto do botão para
algo como "Gerando PDF..." enquanto isso acontece. Se quiser, posso te
passar uma versão do botão com esse feedback visual.

## Como ajustar o seletor do botão "próxima página" (se necessário)

O robô tenta clicar sozinho no botão de "próxima página" de cada relatório.
Se algum relatório específico não funcionar (aparece nos logs "Não
encontrei o botão de próxima página"):

1. Abra o link daquele relatório direto no Chrome.
2. Botão direito na seta de "próxima página" → **Inspecionar**.
3. Veja a classe (`class`) ou `aria-label` do elemento.
4. Adicione esse seletor na lista `NEXT_BUTTON_SELECTORS` no topo do arquivo
   `pdfGenerator.js`, suba no GitHub, e o Render atualiza sozinho.

Como você tem vários relatórios, é possível que layouts diferentes usem
nomes de classe ligeiramente diferentes — a lista de seletores já tenta
várias opções comuns antes de desistir.

## Notas importantes

- Isso gera uma "foto" do relatório no momento do clique, com os dados que
  estiverem carregados naquele instante — se o cliente clicar em "Atualizar
  Comercial" e na sequência em "Exportar PDF" rápido demais, pode pegar
  dados antigos. Vale um pequeno aviso na tela tipo "espere a atualização
  terminar antes de exportar".
- Cada exportação demora cerca de 1 minuto (depende do número de páginas e
  do peso dos gráficos) — é esperado, não é erro.
- O número de páginas é detectado automaticamente a cada exportação, lendo
  o indicador "X de Y" do relatório. Se um relatório específico não tiver
  esse indicador visível (layout customizado, por exemplo), o robô usa um
  modo alternativo: clica em "próxima página" até o botão desaparecer ou
  ficar desabilitado, com um limite de segurança de 40 páginas.
- Não há armazenamento de PDFs no servidor: cada clique gera do zero e
  entrega direto. Isso simplifica bastante, mas significa que dois cliques
  seguidos no mesmo relatório geram o PDF duas vezes (sem cache).
