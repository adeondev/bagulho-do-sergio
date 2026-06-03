export const TILE_W = 96;
export const TILE_H = 48;

// Mapa cerca de 15x maior que o original (34x30 = 1020 tiles).
// 128 x 120 = 15360 tiles (~15x).
export const MAP_W = 128;
export const MAP_H = 120;

// Tamanho do chunk usado para culling de renderizacao (so renderiza o que esta perto da camera).
export const CHUNK = 12;

export const PANEL_W = 390;
export const GAME_WIDTH = Math.max(760, window.innerWidth - PANEL_W);
export const GAME_HEIGHT = window.innerHeight;

export const ISO_ORIGIN_X = 930;
export const ISO_ORIGIN_Y = 120;

// Ponto inicial da aldeia (centro aproximado do mundo).
export const ALDEIA_X = 64;
export const ALDEIA_Y = 60;

export const NOMES = [
  "Ana", "Joao", "Pedro", "Maria", "Davi",
  "Clara", "Luna", "Miguel", "Sofia", "Lucas",
  "Bruno", "Helena", "Caio", "Iris", "Rafa",
  "Nina", "Theo", "Liz", "Gael", "Cora",
  "Vitor", "Aurora", "Enzo", "Bia"
];

// Tribos iniciais: cada habitante entra em uma delas. Cor usada no anel do sprite.
export const TRIBOS = [
  { id: "vale", nome: "Povo do Vale", cor: 0x6fc2ff },
  { id: "brasa", nome: "Filhos da Brasa", cor: 0xff8a5c },
  { id: "folha", nome: "Guardioes da Folha", cor: 0x8fe27a }
];

// Balanceamento de sobrevivencia (por segundo de simulacao).
export const BALANCE = {
  sedePorSeg: 0.62,
  fomePorSeg: 0.42,
  energiaPorSeg: 0.30,
  // Saude cai so quando fome/sede estouram; regenera quando esta tudo ok.
  saudeRegenPorSeg: 1.1,
  saudeDanoPorSeg: 1.4,
  // Limiares onde o habitante busca recurso por instinto.
  buscarAguaEm: 52,
  buscarComidaEm: 56,
  descansarEm: 28,
  // Reflexo automatico: bebe/come quando o recurso esta ao alcance.
  beberSe: 26,
  comerSe: 42,
  // Quantos segundos duram um "dia" no relogio do mundo.
  segundosPorDia: 45
};
