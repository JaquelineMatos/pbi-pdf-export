const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "data", "fila.json");

function garantirArquivo() {
    if (!fs.existsSync(path.dirname(FILE))) {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
    }

    if (!fs.existsSync(FILE)) {
        fs.writeFileSync(FILE, "[]");
    }
}

function lerFila() {
    garantirArquivo();
    return JSON.parse(fs.readFileSync(FILE));
}

function salvarFila(fila) {
    fs.writeFileSync(FILE, JSON.stringify(fila, null, 2));
}

function adicionar(relatorio) {

    const fila = lerFila();

    fila.push({
        id: Date.now(),
        relatorio,
        status: "PENDENTE",
        criado: new Date()
    });

    salvarFila(fila);

}

function proximo() {

    const fila = lerFila();

    return fila.find(x => x.status === "PENDENTE");

}

function finalizar(id) {

    const fila = lerFila();

    const item = fila.find(x => x.id === id);

    if(item){

        item.status="CONCLUIDO";

    }

    salvarFila(fila);

}

module.exports={
    adicionar,
    proximo,
    finalizar
}
