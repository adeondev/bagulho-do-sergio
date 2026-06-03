// Catalogo central do mundo: ferramentas, estruturas, eras e fauna.
// Mantem os dados separados da logica para o motor e a IA consultarem.

// ---- FERRAMENTAS / ARMAS -------------------------------------------------
// custo em recursos do inventario; bonus aplicados quando equipada/possuida.
export const FERRAMENTAS = {
  machado: {
    nome: "Machado",
    custo: { madeira: 2, pedra: 1 },
    eraMin: 1,
    bonusMadeira: 2,     // coleta extra de madeira
    bonusAtaque: 6,
    descricao: "corta arvores muito mais rapido"
  },
  picareta: {
    nome: "Picareta",
    custo: { madeira: 2, pedra: 2 },
    eraMin: 1,
    bonusPedra: 2,       // coleta extra de pedra
    bonusAtaque: 5,
    descricao: "quebra rochas e extrai mais pedra"
  },
  lanca: {
    nome: "Lanca",
    custo: { madeira: 3, pedra: 1 },
    eraMin: 1,
    bonusCaca: 2,        // coleta extra de carne ao cacar
    bonusAtaque: 11,
    descricao: "caca animais e fere a distancia"
  },
  espada: {
    nome: "Espada",
    custo: { madeira: 2, pedra: 4 },
    eraMin: 4,
    bonusAtaque: 22,
    descricao: "arma de guerra, dano alto em combate"
  }
};

// ---- ESTRUTURAS ----------------------------------------------------------
// bloqueia: ocupa o tile para caminhada (true) ou e atravessavel/usavel (false)
// efeito: tipo de beneficio que a estrutura concede quando alguem esta perto.
export const ESTRUTURAS = {
  fogueira: {
    nome: "Fogueira",
    custo: { madeira: 3 },
    eraMin: 0,
    bloqueia: false,
    raio: 2,
    efeito: "calor",
    temporaria: true,
    duracaoDias: 6,
    textura: "estr-fogueira",
    descricao: "aquece, cozinha e vira ponto de encontro"
  },
  cabana: {
    nome: "Cabana",
    custo: { madeira: 6 },
    eraMin: 2,
    bloqueia: true,
    raio: 2,
    efeito: "descanso",
    temporaria: true,
    duracaoDias: 14,
    textura: "estr-cabana",
    descricao: "abrigo temporario que recupera energia"
  },
  poco: {
    nome: "Poco de Agua",
    custo: { madeira: 3, pedra: 4 },
    eraMin: 2,
    bloqueia: false,
    raio: 3,
    efeito: "agua",
    textura: "estr-poco",
    descricao: "fornece agua longe dos rios"
  },
  casa: {
    nome: "Casa",
    custo: { madeira: 10, pedra: 6 },
    eraMin: 3,
    bloqueia: true,
    raio: 2,
    efeito: "descanso",
    textura: "estr-casa",
    descricao: "moradia permanente, descanso seguro"
  },
  deposito: {
    nome: "Deposito",
    custo: { madeira: 8, pedra: 3 },
    eraMin: 3,
    bloqueia: true,
    raio: 3,
    efeito: "estoque",
    textura: "estr-deposito",
    descricao: "guarda recursos da tribo"
  },
  fazenda: {
    nome: "Fazenda",
    custo: { madeira: 5, comida: 2 },
    eraMin: 3,
    bloqueia: false,
    raio: 2,
    efeito: "comida",
    textura: "estr-fazenda",
    descricao: "produz comida com o tempo"
  },
  oficina: {
    nome: "Oficina",
    custo: { madeira: 8, pedra: 6 },
    eraMin: 3,
    bloqueia: true,
    raio: 3,
    efeito: "ferramentas",
    textura: "estr-oficina",
    descricao: "permite forjar ferramentas melhores e espadas"
  },
  muralha: {
    nome: "Muralha",
    custo: { madeira: 2, pedra: 3 },
    eraMin: 4,
    bloqueia: true,
    raio: 0,
    efeito: "defesa",
    textura: "estr-muralha",
    descricao: "bloqueia passagem e protege a tribo"
  },
  totem: {
    nome: "Totem",
    custo: { madeira: 4, pedra: 2 },
    eraMin: 4,
    bloqueia: false,
    raio: 4,
    efeito: "moral",
    textura: "estr-totem",
    descricao: "marca o territorio e une a tribo"
  }
};

// ---- ERAS / PROGRESSAO ---------------------------------------------------
// O mundo avanca de era conforme marcos globais sao atingidos.
export const ERAS = [
  {
    id: 0,
    nome: "Sobrevivencia",
    descricao: "Beber, comer e nao morrer.",
    desbloqueio: { tools: 0, estruturas: 0 }
  },
  {
    id: 1,
    nome: "Ferramentas",
    descricao: "Primeiras ferramentas de pedra e madeira.",
    desbloqueio: { madeiraTotal: 12, pedraTotal: 6 }
  },
  {
    id: 2,
    nome: "Assentamento",
    descricao: "Fogueiras, cabanas e pocos.",
    desbloqueio: { tools: 2 }
  },
  {
    id: 3,
    nome: "Construcao",
    descricao: "Casas, fazendas, depositos e oficinas.",
    desbloqueio: { estruturas: 4 }
  },
  {
    id: 4,
    nome: "Sociedade",
    descricao: "Tribos, totens e muralhas.",
    desbloqueio: { estruturas: 8, tools: 5 }
  },
  {
    id: 5,
    nome: "Conflito",
    descricao: "Espadas e guerras por territorio.",
    desbloqueio: { estruturas: 12, odioMax: 60 }
  }
];

// ---- FAUNA ---------------------------------------------------------------
export const ANIMAIS = {
  coelho: {
    nome: "Coelho",
    textura: "animal-coelho",
    velocidade: 70,
    carne: 1,
    medroso: true,
    predador: false,
    biomas: ["grama", "campo", "colina"],
    saude: 8
  },
  veado: {
    nome: "Veado",
    textura: "animal-veado",
    velocidade: 90,
    carne: 3,
    medroso: true,
    predador: false,
    biomas: ["floresta", "grama", "campo"],
    saude: 18
  },
  peixe: {
    nome: "Peixe",
    textura: "animal-peixe",
    velocidade: 40,
    carne: 2,
    medroso: true,
    predador: false,
    aquatico: true,
    biomas: ["agua"],
    saude: 6
  },
  passaro: {
    nome: "Passaro",
    textura: "animal-passaro",
    velocidade: 110,
    carne: 1,
    medroso: true,
    predador: false,
    biomas: ["floresta", "grama", "colina", "montanha"],
    saude: 4
  },
  lobo: {
    nome: "Lobo",
    textura: "animal-lobo",
    velocidade: 95,
    carne: 2,
    medroso: false,
    predador: true,
    ataque: 9,
    biomas: ["floresta", "montanha", "colina"],
    saude: 26
  }
};

export function eraPorId(id) {
  return ERAS.find(e => e.id === id) || ERAS[0];
}

export function ferramentasDaEra(era) {
  return Object.entries(FERRAMENTAS)
    .filter(([, f]) => f.eraMin <= era)
    .map(([id]) => id);
}

export function estruturasDaEra(era) {
  return Object.entries(ESTRUTURAS)
    .filter(([, e]) => e.eraMin <= era)
    .map(([id]) => id);
}

export function podePagar(inventario, custo) {
  return Object.entries(custo).every(([rec, qtd]) => (inventario[rec] || 0) >= qtd);
}

export function pagar(inventario, custo) {
  Object.entries(custo).forEach(([rec, qtd]) => {
    inventario[rec] = (inventario[rec] || 0) - qtd;
  });
}
