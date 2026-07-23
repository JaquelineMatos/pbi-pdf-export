const fs = require("fs");
const path = require("path");

const {proximo, finalizar} = require("./queue");
const {gerarPdfDoRelatorio} = require("./pdfGenerator");

const relatorios = require("./config/relatorios.json");

async function processar(){

    const pedido = proximo();

    if(!pedido){

        return;

    }

    console.log("Gerando",pedido.relatorio);

    const relatorio=relatorios.find(r=>r.id==pedido.relatorio);

    if(!relatorio){

        finalizar(pedido.id);

        return;

    }

    const pdf=await gerarPdfDoRelatorio(relatorio.url);

    if(!fs.existsSync("./pdfs")){

        fs.mkdirSync("./pdfs");

    }

    fs.writeFileSync(

        path.join("./pdfs",`${relatorio.id}.pdf`),

        pdf

    );

    finalizar(pedido.id);

    console.log("Concluído");

}

setInterval(processar,5000);
