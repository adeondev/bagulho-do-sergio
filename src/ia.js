import { escolher, distanciaTiles, clamp } from "./utils.js";
import { completarComProvedor, carregarIaConfig, IA_PROVIDERS, nomeProvedor, provedorEstaPronto } from "./provedoresIa.js";
import { FERRAMENTAS, ESTRUTURAS, ferramentasDaEra, estruturasDaEra, podePagar } from "./definicoes.js";

const CATEGORIAS = ["sobrevivencia", "exploracao", "social", "descanso", "coleta", "construcao", "crafting", "caca", "hostil", "criativa"];
const TAREFAS = ["beber", "comer", "coletar", "construir", "craftar", "cacar", "atacar", "descansar", "socializar", "explorar", "observar"];

// Executa funcoes assincronas em lote com limite de concorrencia (varias IAs ao mesmo tempo).
export async function executarEmLote(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let indice = 0;
  const trabalhadores = new Array(Math.min(limite, itens.length)).fill(0).map(async () => {
    while (indice < itens.length) {
      const i = indice++;
      resultados[i] = await fn(itens[i], i);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

export async function decidirAcaoComIA(habitante, mundo, habitantes, ctx = {}) {
  const config = carregarIaConfig();

  if (config.provider === IA_PROVIDERS.INSTINTO) {
    return decidirPorInstinto(habitante, mundo, habitantes, ctx);
  }

  if (!provedorEstaPronto(config)) {
    // Sem provedor configurado, cai no instinto para o mundo nao congelar.
    return decidirPorInstinto(habitante, mundo, habitantes, ctx);
  }

  const prompt = montarPromptAcao(habitante, mundo, habitantes, ctx);
  try {
    const decisao = normalizarAcao(parseJsonSeguro(await completarComProvedor(prompt)), mundo, habitantes, ctx);
    decisao.provedor = nomeProvedor(config.provider);
    return decisao;
  } catch (erro) {
    console.warn(`${nomeProvedor(config.provider)} falhou; ${habitante.nome} usa instinto:`, erro);
    return decidirPorInstinto(habitante, mundo, habitantes, ctx);
  }
}

export async function decidirInteracaoComIA(habitante, outro, mundo, ctx = {}) {
  const config = carregarIaConfig();
  if (config.provider === IA_PROVIDERS.INSTINTO || !provedorEstaPronto(config)) {
    return decidirInteracaoPorInstinto(habitante, outro, mundo, ctx);
  }

  const prompt = montarPromptInteracao(habitante, outro, mundo, ctx);
  try {
    return normalizarInteracao(parseJsonSeguro(await completarComProvedor(prompt)));
  } catch (erro) {
    console.warn(`${nomeProvedor(config.provider)} falhou na interacao; usa instinto:`, erro);
    return decidirInteracaoPorInstinto(habitante, outro, mundo, ctx);
  }
}

export function modoIaAutonomoAtivo() {
  const config = carregarIaConfig();
  return config.provider !== IA_PROVIDERS.INSTINTO;
}

// ===================== INSTINTO (cerebro autonomo) =======================
function acao(base) {
  return {
    categoria: "exploracao", acao: "agir", destinoLocalId: null, destinoTile: null,
    alvoHabitante: null, tipoConstrucao: null, tipoFerramenta: null, tarefa: "explorar",
    fala: "", motivo: "Decidi por mim mesmo.", efeitoEsperado: "ver o que acontece",
    intensidade: 30, provedor: "Instinto", ...base
  };
}

export function decidirPorInstinto(habitante, mundo, habitantes = [], ctx = {}) {
  const estruturas = ctx.estruturas;
  const fauna = ctx.fauna;
  const era = ctx.era ?? 0;
  const vivos = habitantes.filter(h => h.vivo && h !== habitante);

  // 1) SEDE — prioridade maxima.
  if (habitante.sede > 52) {
    const poco = estruturas?.maisProximoComEfeito(habitante.xTile, habitante.yTile, "agua");
    const lago = mundo.localMaisProximoTipo(habitante.xTile, habitante.yTile, "agua");
    const alvo = poco && lago
      ? (distanciaTiles(habitante, poco) < distanciaTiles(habitante, lago) ? { tile: { x: poco.x, y: poco.y } } : { local: lago })
      : (poco ? { tile: { x: poco.x, y: poco.y } } : (lago ? { local: lago } : null));
    if (alvo) {
      return acao({
        categoria: "sobrevivencia", acao: "procurar agua", tarefa: "beber",
        destinoLocalId: alvo.local?.id || null, destinoTile: alvo.tile || null,
        motivo: "Estou com sede e preciso beber.", efeitoEsperado: "matar a sede", intensidade: 90
      });
    }
  }

  // 2) FOME.
  if (habitante.fome > 56 && habitante.inventario.comida <= 0) {
    const animal = fauna?.animalProximoPara(habitante.xTile, habitante.yTile, 8);
    if (animal && (habitante.coragem > 40 || habitante.temArma())) {
      return acao({
        categoria: "caca", acao: `cacar ${animal.def.nome.toLowerCase()}`, tarefa: "cacar",
        destinoTile: { x: animal.xTile, y: animal.yTile },
        motivo: "Estou com fome, vou cacar.", efeitoEsperado: "conseguir carne", intensidade: 78
      });
    }
    const fazenda = estruturas?.maisProximoComEfeito(habitante.xTile, habitante.yTile, "comida");
    const comidaLocal = mundo.localMaisProximoTipo(habitante.xTile, habitante.yTile, ["campo", "floresta"]);
    if (fazenda && (!comidaLocal || distanciaTiles(habitante, fazenda) < distanciaTiles(habitante, comidaLocal))) {
      return acao({
        categoria: "coleta", acao: "colher na fazenda", tarefa: "comer",
        destinoTile: { x: fazenda.x, y: fazenda.y },
        motivo: "Vou pegar comida da fazenda.", efeitoEsperado: "comer", intensidade: 72
      });
    }
    if (comidaLocal) {
      return acao({
        categoria: "coleta", acao: "procurar comida", tarefa: "comer", destinoLocalId: comidaLocal.id,
        motivo: "Estou com fome, vou procurar comida.", efeitoEsperado: "encontrar alimento", intensidade: 74
      });
    }
  }

  // 3) ENERGIA.
  if (habitante.energia < 28) {
    const abrigo = estruturas?.maisProximoComEfeito(habitante.xTile, habitante.yTile, "descanso");
    const aldeia = mundo.buscarLocalPorId("aldeia_inicial");
    if (abrigo) {
      return acao({
        categoria: "descanso", acao: "descansar no abrigo", tarefa: "descansar",
        destinoTile: { x: abrigo.x, y: abrigo.y },
        motivo: "Estou exausto, vou descansar.", efeitoEsperado: "recuperar energia", intensidade: 65
      });
    }
    return acao({
      categoria: "descanso", acao: "voltar para a aldeia", tarefa: "descansar",
      destinoLocalId: aldeia.id, motivo: "Preciso descansar em lugar seguro.",
      efeitoEsperado: "recuperar energia", intensidade: 60
    });
  }

  // 4) GUERRA / DISPUTA — quando avancado, armado e com inimigo por perto.
  const inimigos = vivos.filter(o => o.tribo !== habitante.tribo && habitante.relacaoCom(o.nome) <= -30);
  if ((era >= 4 || ctx.guerra) && habitante.temArma() && habitante.agressividade > 45 && habitante.saude > 45) {
    const alvo = inimigos
      .map(o => ({ o, d: distanciaTiles(habitante, o) }))
      .filter(x => x.d < 10)
      .sort((a, b) => a.d - b.d)[0];
    if (alvo) {
      return acao({
        categoria: "hostil", acao: `atacar ${alvo.o.nome}`, tarefa: "atacar", alvoHabitante: alvo.o.nome,
        destinoTile: { x: alvo.o.xTile, y: alvo.o.yTile },
        fala: "Esse territorio e nosso!", motivo: `Odeio ${alvo.o.nome} e quero dominar.`,
        efeitoEsperado: "vencer o inimigo", intensidade: 88
      });
    }
  }
  // Saque por desespero: faminto, sem comida, vizinho desafeto com recursos.
  if (habitante.fome > 80 && habitante.inventario.comida <= 0 && habitante.coragem > 50) {
    const presa = vivos
      .filter(o => distanciaTiles(habitante, o) < 6 && o.inventario.comida > 0 && habitante.relacaoCom(o.nome) < 10)
      .sort((a, b) => b.inventario.comida - a.inventario.comida)[0];
    if (presa) {
      return acao({
        categoria: "hostil", acao: `roubar comida de ${presa.nome}`, tarefa: "atacar", alvoHabitante: presa.nome,
        destinoTile: { x: presa.xTile, y: presa.yTile },
        motivo: "Estou desesperado de fome.", efeitoEsperado: "tomar comida", intensidade: 70
      });
    }
  }

  // 5) PROGRESSAO: craftar ferramentas.
  if (era >= 1) {
    const ferramentasPossiveis = ferramentasDaEra(era).filter(id => habitante.podeCraftar(id));
    if (ferramentasPossiveis.length) {
      const id = escolher(ferramentasPossiveis);
      const precisaOficina = id === "espada";
      if (precisaOficina) {
        const oficina = ctx.estruturas?.maisProximoComEfeito(habitante.xTile, habitante.yTile, "ferramentas");
        if (!oficina) {
          // sem oficina: tenta construir uma se puder, senao ignora espada.
        } else {
          return acao({
            categoria: "crafting", acao: "forjar espada", tarefa: "craftar", tipoFerramenta: id,
            destinoTile: { x: oficina.x, y: oficina.y },
            motivo: "Vou forjar uma arma na oficina.", efeitoEsperado: "ter uma espada", intensidade: 60
          });
        }
      } else {
        return acao({
          categoria: "crafting", acao: `fabricar ${FERRAMENTAS[id].nome.toLowerCase()}`, tarefa: "craftar",
          tipoFerramenta: id, motivo: "Quero uma ferramenta melhor.",
          efeitoEsperado: FERRAMENTAS[id].descricao, intensidade: 50
        });
      }
    }
  }

  // 6) PROGRESSAO: construir o que a tribo precisa.
  if (era >= 2) {
    const construir = escolherConstrucao(habitante, era, estruturas, mundo);
    if (construir) {
      return acao({
        categoria: "construcao", acao: `construir ${ESTRUTURAS[construir].nome.toLowerCase()}`,
        tarefa: "construir", tipoConstrucao: construir,
        motivo: "Vou erguer algo util para todos.", efeitoEsperado: ESTRUTURAS[construir].descricao, intensidade: 55
      });
    }
  }

  // 7) Juntar recursos para progredir (madeira/pedra baixos).
  const precisaMadeira = habitante.inventario.madeira < 8;
  const precisaPedra = habitante.inventario.pedra < 6;
  if ((precisaMadeira || precisaPedra) && Math.random() < 0.7) {
    const querPedra = precisaPedra && (!precisaMadeira || Math.random() < 0.5);
    const tipos = querPedra ? ["pedras", "montanha"] : ["floresta"];
    const local = mundo.localMaisProximoTipo(habitante.xTile, habitante.yTile, tipos);
    if (local) {
      return acao({
        categoria: "coleta", acao: `coletar ${querPedra ? "pedra" : "madeira"}`, tarefa: "coletar",
        destinoLocalId: local.id, motivo: "Preciso de materiais.",
        efeitoEsperado: "juntar recursos", intensidade: 45
      });
    }
  }

  // 8) SOCIAL: aproximar de alguem se for sociavel e estiver de bem.
  if (habitante.sociabilidade > 55 && habitante.cooldownConversa <= 0 && Math.random() < 0.5) {
    const amigo = vivos
      .filter(o => distanciaTiles(habitante, o) < 14)
      .sort((a, b) => distanciaTiles(habitante, a) - distanciaTiles(habitante, b))[0];
    if (amigo) {
      return acao({
        categoria: "social", acao: `procurar ${amigo.nome}`, tarefa: "socializar", alvoHabitante: amigo.nome,
        destinoTile: { x: amigo.xTile, y: amigo.yTile },
        motivo: "Quero companhia.", efeitoEsperado: "conversar", intensidade: 35
      });
    }
  }

  // 9) EXPLORAR.
  const desconhecidos = mundo.locais.filter(l => !habitante.mapaConhecido.includes(l.id));
  const local = desconhecidos.length && habitante.curiosidade > 45 ? escolher(desconhecidos) : null;
  if (local) {
    return acao({
      categoria: "exploracao", acao: "explorar uma regiao nova", tarefa: "observar", destinoLocalId: local.id,
      motivo: "Quero conhecer o mundo.", efeitoEsperado: "descobrir um lugar", intensidade: 40
    });
  }
  const tile = mundo.escolherTileExploracao(habitante);
  return acao({
    categoria: "exploracao", acao: "circular pelo terreno", tarefa: "explorar",
    destinoTile: tile || null, motivo: "Vou andar e observar.", efeitoEsperado: "entender o ambiente", intensidade: 30
  });
}

function escolherConstrucao(habitante, era, estruturas, mundo) {
  if (!estruturas) return null;
  // Limites por tipo para nao encher o mapa.
  const limites = { fogueira: 8, cabana: 10, poco: 8, casa: 16, deposito: 4, fazenda: 8, oficina: 3, muralha: 30, totem: 4 };
  const ordem = estruturasDaEra(era);
  // Prioriza o que ainda falta e o que da para pagar.
  const candidatos = ordem.filter(tipo => {
    const def = ESTRUTURAS[tipo];
    if (!podePagar(habitante.inventario, def.custo)) return false;
    if (estruturas.contar(tipo) >= (limites[tipo] || 99)) return false;
    return true;
  });
  if (!candidatos.length) return null;
  // Pesos: estruturas mais basicas/uteis primeiro.
  const peso = { poco: 5, fogueira: 4, fazenda: 4, cabana: 3, casa: 3, oficina: 3, deposito: 2, totem: 2, muralha: 1 };
  candidatos.sort((a, b) => (peso[b] || 1) - (peso[a] || 1));
  return candidatos[0];
}

export function decidirInteracaoPorInstinto(habitante, outro, mundo, ctx = {}) {
  const rel = habitante.relacaoCom(outro.nome);
  const mesmaTribo = habitante.tribo === outro.tribo;
  const era = ctx.era ?? 0;

  // Hostil: tribo inimiga + relacao ruim + coragem; ou guerra declarada.
  if ((!mesmaTribo && rel < -20 || ctx.guerra) && habitante.agressividade > 50 && habitante.coragem > 40 && habitante.saude > 40) {
    return {
      categoria: "hostil", acao: `enfrentar ${outro.nome}`, tarefa: "atacar",
      fala: escolher(["Saia do nosso caminho!", "Esse lugar e nosso!", ""]),
      motivo: "Rivalidade entre tribos.", efeitoEsperado: "afastar o rival", intensidade: 70
    };
  }

  // Cooperar: mesma tribo / boa relacao, dividir comida com quem tem mais fome.
  if ((mesmaTribo || rel > 20) && habitante.inventario.comida > 0 && outro.fome > habitante.fome + 14) {
    return {
      categoria: "social", acao: `dar comida para ${outro.nome}`, tarefa: "socializar",
      fala: "Toma, voce precisa mais que eu.", motivo: "Ajudar a tribo.", efeitoEsperado: "fortalecer lacos", intensidade: 20
    };
  }

  // Conversa neutra.
  return {
    categoria: "social", acao: `conversar com ${outro.nome}`, tarefa: "socializar",
    fala: escolher(["Como vai a caca?", "Vamos construir algo juntos?", "Viu agua por perto?", "Cuidado com os lobos.", ""]),
    motivo: "Trocar ideia.", efeitoEsperado: "melhorar relacao", intensidade: 15
  };
}

// ===================== PROMPTS PROVEDOR ==================================
function montarPromptAcao(habitante, mundo, habitantes, ctx = {}) {
  const era = ctx.era ?? 0;
  const locais = mundo.locaisVisiveisPara(habitante).slice(0, 14);
  const outros = habitantes
    .filter(o => o !== habitante && o.vivo)
    .slice(0, 8)
    .map(o => ({
      nome: o.nome, tribo: o.tribo,
      distancia: Math.round(distanciaTiles(o, habitante) * 10) / 10,
      estado: o.estadoAtual(), relacao: habitante.relacaoCom(o.nome)
    }));
  const animais = ctx.fauna?.animalProximoPara(habitante.xTile, habitante.yTile, 10);
  const ferramentasOk = ferramentasDaEra(era).filter(id => !habitante.ferramentas.has(id));
  const estruturasOk = estruturasDaEra(era);

  return `
Voce controla ${habitante.nome}, habitante autonomo da tribo "${habitante.nomeTribo()}" num mundo vivo.
Era atual do mundo: ${era} (${["Sobrevivencia", "Ferramentas", "Assentamento", "Construcao", "Sociedade", "Conflito"][era]}).

Decida UMA acao completa. A simulacao limita o resultado pela fisica do mundo.
Voce pode: sobreviver (beber/comer), coletar recursos, fabricar ferramentas, construir estruturas, cacar animais, socializar, cooperar, enganar, disputar recursos ou entrar em conflito/guerra abstrato (nao grafico, sem instrucoes reais de violencia).

Estado:
- Fome ${Math.round(habitante.fome)}, Sede ${Math.round(habitante.sede)}, Energia ${Math.round(habitante.energia)}, Saude ${Math.round(habitante.saude)}
- Personalidade: ${habitante.personalidade}; coragem ${habitante.coragem}, agressividade ${habitante.agressividade}, sociabilidade ${habitante.sociabilidade}
- Posicao (${habitante.xTile}, ${habitante.yTile}) em ${mundo.descreverTile(habitante.xTile, habitante.yTile)}
- Inventario: ${JSON.stringify(habitante.inventario)}; Ferramentas: ${[...habitante.ferramentas].join(", ") || "nenhuma"}
- Memorias: ${habitante.memorias.slice(-6).join(" | ") || "nenhuma"}

Lugares conhecidos:
${locais.map(l => `- ${l.id} | ${l.nome} (${l.x},${l.y}) ${l.tipo}`).join("\n") || "- nenhum"}
Outros: ${outros.map(o => `${o.nome}[${o.tribo} d${o.distancia} rel${o.relacao} ${o.estado}]`).join("; ") || "ninguem perto"}
Animal cacavel perto: ${animais ? `${animais.def.nome} em (${animais.xTile},${animais.yTile})` : "nenhum"}
Ferramentas que pode fabricar: ${ferramentasOk.join(", ") || "nenhuma nova"}
Estruturas liberadas: ${estruturasOk.join(", ")}

Responda SOMENTE JSON valido:
{
  "categoria": "${CATEGORIAS.join("|")}",
  "tarefa": "${TAREFAS.join("|")}",
  "acao": "acao curta e especifica",
  "destinoLocalId": null,
  "destinoX": null,
  "destinoY": null,
  "alvoHabitante": null,
  "tipoConstrucao": null,
  "tipoFerramenta": null,
  "fala": "",
  "motivo": "motivo curto",
  "efeitoEsperado": "o que espera",
  "intensidade": 0
}
`;
}

function montarPromptInteracao(habitante, outro, mundo, ctx = {}) {
  return `
Voce controla ${habitante.nome} (tribo ${habitante.nomeTribo()}). ${outro.nome} (tribo ${outro.nomeTribo()}) esta perto.
Relacao atual: ${habitante.relacaoCom(outro.nome)} (-100 odio, +100 amor). Era ${ctx.era ?? 0}.
Estado de ${habitante.nome}: fome ${Math.round(habitante.fome)}, sede ${Math.round(habitante.sede)}, saude ${Math.round(habitante.saude)}, agressividade ${habitante.agressividade}.
Decida espontaneamente: cooperar, conversar, negociar, provocar, ameacar, roubar recurso ficticio ou atacar (abstrato, nao grafico).

Responda SOMENTE JSON valido:
{
  "categoria": "social|hostil|criativa|sobrevivencia|coleta",
  "tarefa": "socializar|atacar",
  "acao": "acao curta",
  "fala": "fala curta ou vazia",
  "motivo": "motivo curto",
  "efeitoEsperado": "o que espera",
  "intensidade": 0
}
`;
}

// ===================== PARSE / NORMALIZACAO =============================
function limparRespostaJson(texto) {
  const limpo = String(texto).replace(/```json/g, "").replace(/```/g, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  return inicio >= 0 && fim > inicio ? limpo.slice(inicio, fim + 1) : limpo;
}

function parseJsonSeguro(texto) {
  const limpo = limparRespostaJson(texto);
  try { return JSON.parse(limpo); }
  catch { return JSON.parse(sanitizarJsonComQuebras(limpo)); }
}

function sanitizarJsonComQuebras(texto) {
  let saida = "", dentroString = false, escapado = false;
  for (const char of texto) {
    if (escapado) { saida += char; escapado = false; continue; }
    if (char === "\\") { saida += char; escapado = true; continue; }
    if (char === "\"") { dentroString = !dentroString; saida += char; continue; }
    if (dentroString && (char === "\n" || char === "\r")) { saida += " "; continue; }
    saida += char;
  }
  return saida;
}

function normalizarAcao(decisao, mundo, habitantes, ctx = {}) {
  const era = ctx.era ?? 0;
  const categoria = CATEGORIAS.includes(decisao.categoria) ? decisao.categoria : "exploracao";
  const tarefa = TAREFAS.includes(decisao.tarefa) ? decisao.tarefa : "explorar";
  const destinoExiste = decisao.destinoLocalId && mundo.buscarLocalPorId(decisao.destinoLocalId);
  const dx = Number.isInteger(decisao.destinoX) ? decisao.destinoX : null;
  const dy = Number.isInteger(decisao.destinoY) ? decisao.destinoY : null;
  const destinoTile = dx !== null && dy !== null && mundo.isWalkable(dx, dy) ? { x: dx, y: dy } : null;
  const alvoExiste = decisao.alvoHabitante && habitantes.some(h => h.nome === decisao.alvoHabitante && h.vivo);
  const tipoConstrucao = decisao.tipoConstrucao && ESTRUTURAS[decisao.tipoConstrucao] && ESTRUTURAS[decisao.tipoConstrucao].eraMin <= era
    ? decisao.tipoConstrucao : null;
  const tipoFerramenta = decisao.tipoFerramenta && FERRAMENTAS[decisao.tipoFerramenta] && FERRAMENTAS[decisao.tipoFerramenta].eraMin <= era
    ? decisao.tipoFerramenta : null;

  return {
    categoria, tarefa,
    acao: textoCurto(decisao.acao, "agir por conta propria"),
    destinoLocalId: destinoExiste ? decisao.destinoLocalId : null,
    destinoTile,
    alvoHabitante: alvoExiste ? decisao.alvoHabitante : null,
    tipoConstrucao, tipoFerramenta,
    fala: textoCurto(decisao.fala, ""),
    motivo: textoCurto(decisao.motivo, "Quero decidir por mim."),
    efeitoEsperado: textoCurto(decisao.efeitoEsperado, "entender o que acontece"),
    intensidade: clampNumero(decisao.intensidade, 0, 100)
  };
}

function normalizarInteracao(decisao) {
  return {
    categoria: CATEGORIAS.includes(decisao.categoria) ? decisao.categoria : "social",
    tarefa: decisao.tarefa === "atacar" ? "atacar" : "socializar",
    acao: textoCurto(decisao.acao, "interagir"),
    fala: textoCurto(decisao.fala, ""),
    motivo: textoCurto(decisao.motivo, "reagir ao outro"),
    efeitoEsperado: textoCurto(decisao.efeitoEsperado, "mudar a relacao"),
    intensidade: clampNumero(decisao.intensidade, 0, 100)
  };
}

function textoCurto(valor, fallback) {
  const texto = String(valor || "").trim();
  return (texto || fallback).slice(0, 180);
}

function clampNumero(valor, min, max) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return min;
  return clamp(Math.round(numero), min, max);
}
