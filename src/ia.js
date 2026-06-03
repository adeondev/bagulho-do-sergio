import { escolher } from "./utils.js";
import { completarComProvedor, carregarIaConfig, IA_PROVIDERS, nomeProvedor, provedorEstaPronto } from "./provedoresIa.js";

const CATEGORIAS = ["sobrevivencia", "exploracao", "social", "descanso", "coleta", "hostil", "criativa"];

export async function decidirAcaoComIA(habitante, mundo, habitantes) {
  const config = carregarIaConfig();

  if (config.provider === IA_PROVIDERS.INSTINTO) {
    return decidirPorInstinto(habitante, mundo);
  }

  if (!provedorEstaPronto(config)) {
    habitante.pensamento = `${nomeProvedor(config.provider)} nao esta configurado. Vou aguardar.`;
    habitante.objetivoAtual = "aguardando IA";
    return null;
  }

  const prompt = montarPromptAcao(habitante, mundo, habitantes);

  try {
    const decisao = normalizarAcao(parseJsonSeguro(await completarComProvedor(prompt)), mundo, habitantes);
    decisao.provedor = nomeProvedor(config.provider);
    return decisao;
  } catch (erro) {
    console.warn(`${nomeProvedor(config.provider)} falhou; ${habitante.nome} vai aguardar:`, erro);
    habitante.pensamento = `${nomeProvedor(config.provider)} nao respondeu. Vou aguardar.`;
    habitante.objetivoAtual = "aguardando IA";
    habitante.lembrar(habitante.pensamento);
    return null;
  }
}

export async function decidirInteracaoComIA(habitante, outro, mundo) {
  const config = carregarIaConfig();

  if (config.provider === IA_PROVIDERS.INSTINTO) {
    return decidirInteracaoPorInstinto(habitante, outro, mundo);
  }

  if (!provedorEstaPronto(config)) {
    return null;
  }

  const prompt = `
Voce controla ${habitante.nome} em uma simulacao social autonoma.
${outro.nome} esta muito perto. Decida espontaneamente o que ${habitante.nome} faz ou fala.

Estado de ${habitante.nome}:
- Fome: ${habitante.fome}
- Sede: ${habitante.sede}
- Energia: ${habitante.energia}
- Saude: ${habitante.saude}
- Personalidade: ${habitante.personalidade}
- Objetivo atual: ${habitante.objetivoAtual}
- Pensamento: ${habitante.pensamento}
- Memorias recentes: ${habitante.memorias.slice(-5).join(" | ") || "nenhuma"}
- Relacao com ${outro.nome}: ${habitante.relacaoCom(outro.nome)}

Estado de ${outro.nome}:
- Fome: ${outro.fome}
- Sede: ${outro.sede}
- Energia: ${outro.energia}
- Saude: ${outro.saude}
- Personalidade: ${outro.personalidade}
- Objetivo atual: ${outro.objetivoAtual}
- Pensamento: ${outro.pensamento}

Terreno atual: ${mundo.descreverTile(habitante.xTile, habitante.yTile)}

Nao use falas prontas. Voce pode cooperar, mentir, negociar, pedir ajuda, ignorar, provocar, ameacar, roubar recurso ficticio, atacar de forma abstrata ou inventar outra atitude da simulacao.
Conflitos devem ser descritos de forma curta e nao grafica. Nao forneca instrucoes reais de crime ou violencia.

Responda SOMENTE com JSON valido:
{
  "categoria": "social|hostil|criativa|sobrevivencia|coleta",
  "acao": "acao livre e curta",
  "fala": "fala curta em primeira pessoa ou string vazia",
  "motivo": "motivo curto",
  "efeitoEsperado": "o que ${habitante.nome} espera que aconteca",
  "intensidade": 0
}
`;

  try {
    const decisao = parseJsonSeguro(await completarComProvedor(prompt));
    return normalizarInteracao(decisao);
  } catch (erro) {
    console.warn(`${nomeProvedor(config.provider)} falhou na interacao; ${habitante.nome} ficou em silencio:`, erro);
    return null;
  }
}

export function modoIaAutonomoAtivo() {
  const config = carregarIaConfig();
  return config.provider !== IA_PROVIDERS.INSTINTO;
}

function montarPromptAcao(habitante, mundo, habitantes) {
  const locais = mundo.locaisVisiveisPara(habitante);
  const outros = habitantes
    .filter(outro => outro !== habitante && outro.vivo)
    .map(outro => ({
      nome: outro.nome,
      distanciaTiles: Math.round(Math.hypot(outro.xTile - habitante.xTile, outro.yTile - habitante.yTile) * 10) / 10,
      estado: outro.estadoAtual(),
      relacao: habitante.relacaoCom(outro.nome),
      pensamento: outro.pensamento
    }));

  return `
Voce controla ${habitante.nome}, um habitante autonomo em um mundo vivo.

Objetivo do experimento:
- Voce decide TUDO que ${habitante.nome} tenta fazer.
- Nao escolha apenas um destino. Escolha uma acao completa, com intencao, fala, alvo opcional e lugar opcional.
- Nao use lista pronta de acoes. "acao" deve ser livre e especifica.
- A simulacao vai limitar o resultado pelo mundo fisico: terreno, proximidade, fome, sede, energia e outros habitantes.
- Voce pode cooperar, explorar, descansar, procurar recursos, socializar, enganar, roubar recurso ficticio ou entrar em conflito abstrato.
- Conflitos devem ser nao graficos e sem instrucoes reais de violencia/crime.

Estado interno:
- Nome: ${habitante.nome}
- Idade: ${habitante.idade}
- Personalidade: ${habitante.personalidade}
- Fome: ${habitante.fome}
- Sede: ${habitante.sede}
- Energia: ${habitante.energia}
- Saude: ${habitante.saude}
- Curiosidade: ${habitante.curiosidade}
- Coragem: ${habitante.coragem}
- Sociabilidade: ${habitante.sociabilidade}
- Posicao: (${habitante.xTile}, ${habitante.yTile}) em ${mundo.descreverTile(habitante.xTile, habitante.yTile)}
- Inventario: ${JSON.stringify(habitante.inventario)}
- Objetivo atual: ${habitante.objetivoAtual}
- Pensamento atual: ${habitante.pensamento}
- Conhecimentos: ${habitante.conhecimentos.join(" | ")}
- Memorias recentes: ${habitante.memorias.slice(-8).join(" | ") || "nenhuma"}

Lugares percebidos:
${locais.map(l => `- id: ${l.id}, nome: ${l.nome}, posicao: (${l.x}, ${l.y}), tipo: ${l.tipo}, descricao: ${l.descricao}`).join("\n")}

Outros habitantes:
${outros.length ? outros.map(o => `- ${o.nome}: distancia ${o.distanciaTiles}, estado ${o.estado}, relacao ${o.relacao}, pensamento "${o.pensamento}"`).join("\n") : "- nenhum"}

Campos obrigatorios:
- categoria deve ser uma destas categorias de motor: ${CATEGORIAS.join(", ")}.
- destinoLocalId pode ser null ou um id de lugar listado.
- destinoX e destinoY podem ser null ou coordenadas inteiras do mapa. Use quando quiser andar para um ponto livre especifico.
- alvoHabitante pode ser null ou o nome de outro habitante listado.
- intensidade vai de 0 a 100 e indica risco/forca/urgencia.
- fala pode ser "" se a acao nao envolve fala.

Responda SOMENTE com JSON valido:
{
  "categoria": "uma categoria de motor",
  "acao": "acao livre e especifica que ${habitante.nome} tentara executar",
  "destinoLocalId": null,
  "destinoX": null,
  "destinoY": null,
  "alvoHabitante": null,
  "fala": "fala curta em primeira pessoa ou string vazia",
  "motivo": "motivo curto em primeira pessoa",
  "efeitoEsperado": "resultado que ${habitante.nome} espera",
  "intensidade": 0
}
`;
}

function limparRespostaJson(texto) {
  const limpo = String(texto)
    .replace("```json", "")
    .replace("```", "")
    .trim();

  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");

  if (inicio >= 0 && fim > inicio) {
    return limpo.slice(inicio, fim + 1);
  }

  return limpo;
}

function parseJsonSeguro(texto) {
  const limpo = limparRespostaJson(texto);

  try {
    return JSON.parse(limpo);
  } catch {
    return JSON.parse(sanitizarJsonComQuebras(limpo));
  }
}

function sanitizarJsonComQuebras(texto) {
  let saida = "";
  let dentroString = false;
  let escapado = false;

  for (const char of texto) {
    if (escapado) {
      saida += char;
      escapado = false;
      continue;
    }

    if (char === "\\") {
      saida += char;
      escapado = true;
      continue;
    }

    if (char === "\"") {
      dentroString = !dentroString;
      saida += char;
      continue;
    }

    if (dentroString && (char === "\n" || char === "\r")) {
      saida += " ";
      continue;
    }

    saida += char;
  }

  return saida;
}

function normalizarAcao(decisao, mundo, habitantes) {
  const categoria = CATEGORIAS.includes(decisao.categoria) ? decisao.categoria : "exploracao";
  const destinoExiste = decisao.destinoLocalId && mundo.buscarLocalPorId(decisao.destinoLocalId);
  const destinoX = Number.isInteger(decisao.destinoX) ? decisao.destinoX : null;
  const destinoY = Number.isInteger(decisao.destinoY) ? decisao.destinoY : null;
  const destinoTile = destinoX !== null && destinoY !== null && mundo.isWalkable(destinoX, destinoY)
    ? { x: destinoX, y: destinoY }
    : null;
  const alvoExiste = decisao.alvoHabitante && habitantes.some(h => h.nome === decisao.alvoHabitante && h.vivo);

  return {
    categoria,
    acao: textoCurto(decisao.acao, "agir por conta propria"),
    destinoLocalId: destinoExiste ? decisao.destinoLocalId : null,
    destinoTile,
    alvoHabitante: alvoExiste ? decisao.alvoHabitante : null,
    fala: textoCurto(decisao.fala, ""),
    motivo: textoCurto(decisao.motivo, "Quero decidir por mim mesmo."),
    efeitoEsperado: textoCurto(decisao.efeitoEsperado, "entender o que acontece"),
    intensidade: clampNumero(decisao.intensidade, 0, 100)
  };
}

function normalizarInteracao(decisao) {
  return {
    categoria: CATEGORIAS.includes(decisao.categoria) ? decisao.categoria : "social",
    acao: textoCurto(decisao.acao, "interagir"),
    fala: textoCurto(decisao.fala, ""),
    motivo: textoCurto(decisao.motivo, "reagir ao outro"),
    efeitoEsperado: textoCurto(decisao.efeitoEsperado, "mudar a relacao"),
    intensidade: clampNumero(decisao.intensidade, 0, 100)
  };
}

export function decidirPorInstinto(habitante, mundo) {
  const conhecidos = mundo.locais.filter(l => habitante.mapaConhecido.includes(l.id));

  if (habitante.sede > 70) {
    const agua = conhecidos.find(l => l.tipo === "agua") || mundo.locais.find(l => l.tipo === "agua");

    return {
      categoria: "sobrevivencia",
      acao: "procurar agua",
      destinoLocalId: agua.id,
      alvoHabitante: null,
      fala: "",
      motivo: "Estou com sede e preciso encontrar agua.",
      efeitoEsperado: "beber e reduzir minha sede",
      intensidade: 80,
      provedor: nomeProvedor(IA_PROVIDERS.INSTINTO)
    };
  }

  if (habitante.fome > 70) {
    const floresta = conhecidos.find(l => l.tipo === "floresta") || mundo.locais.find(l => l.tipo === "floresta");

    return {
      categoria: "sobrevivencia",
      acao: "procurar comida",
      destinoLocalId: floresta.id,
      alvoHabitante: null,
      fala: "",
      motivo: "Estou com fome e quero procurar algo para comer.",
      efeitoEsperado: "encontrar alimento",
      intensidade: 75,
      provedor: nomeProvedor(IA_PROVIDERS.INSTINTO)
    };
  }

  if (habitante.energia < 30) {
    const aldeia = mundo.locais.find(l => l.tipo === "moradia");

    return {
      categoria: "descanso",
      acao: "voltar para descansar",
      destinoLocalId: aldeia.id,
      alvoHabitante: null,
      fala: "",
      motivo: "Estou cansado e quero voltar para um lugar seguro.",
      efeitoEsperado: "recuperar energia",
      intensidade: 70,
      provedor: nomeProvedor(IA_PROVIDERS.INSTINTO)
    };
  }

  const desconhecidos = mundo.locais.filter(l => !habitante.mapaConhecido.includes(l.id));
  const local = desconhecidos.length && habitante.curiosidade > 50
    ? escolher(desconhecidos)
    : escolher(mundo.locais);

  return {
    categoria: "exploracao",
    acao: "explorar uma regiao",
    destinoLocalId: local.id,
    alvoHabitante: null,
    fala: "",
    motivo: "Quero continuar observando o mundo.",
    efeitoEsperado: "entender melhor o ambiente",
    intensidade: 45,
    provedor: nomeProvedor(IA_PROVIDERS.INSTINTO)
  };
}

function decidirInteracaoPorInstinto(habitante, outro, mundo) {
  return null;
}

function textoCurto(valor, fallback) {
  const texto = String(valor || "").trim();
  return (texto || fallback).slice(0, 180);
}

function clampNumero(valor, min, max) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return min;
  return Math.max(min, Math.min(max, Math.round(numero)));
}
