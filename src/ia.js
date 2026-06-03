import { escolher } from "./utils.js";

export async function decidirDestinoComIA(habitante, mundo) {
  const puterClient = globalThis.puter;

  if (!puterClient?.ai?.chat) {
    return decidirPorInstinto(habitante, mundo);
  }

  puterClient.quiet = true;

  const locais = mundo.locaisVisiveisPara(habitante);

  const prompt = `
Voce e ${habitante.nome}, um ser primitivo vivendo em um mundo novo.

Voce NAO deve escolher acoes prontas como "comer", "dormir" ou "coletar".
Voce escolhe uma regiao do mapa para visitar, e depois caminhara livremente pelo terreno.

Voce tem curiosidade propria, memorias, necessidades e uma pequena nocao dos lugares ja descobertos.
Voce pode visitar lugares conhecidos por necessidade ou explorar lugares desconhecidos por curiosidade.

Conhecimento basico:
${habitante.conhecimentos.map(c => `- ${c}`).join("\n")}

Seu estado:
- Fome: ${habitante.fome}
- Sede: ${habitante.sede}
- Energia: ${habitante.energia}
- Saude: ${habitante.saude}
- Curiosidade: ${habitante.curiosidade}
- Coragem: ${habitante.coragem}
- Sociabilidade: ${habitante.sociabilidade}
- Personalidade: ${habitante.personalidade}

Memorias recentes:
${habitante.memorias.length ? habitante.memorias.slice(-6).map(m => `- ${m}`).join("\n") : "- nenhuma"}

Lugares do mundo:
${locais.map(l => `- id: ${l.id}, nome: ${l.nome}, posicao: (${l.x}, ${l.y}), tipo: ${l.tipo}, descricao: ${l.descricao}`).join("\n")}

Regras:
- Se estiver com muita sede, provavelmente busque agua se conhecer algum lugar.
- Se estiver com fome, procure lugares que talvez tenham comida.
- Se estiver curioso, explore uma regiao desconhecida.
- Se estiver cansado, volte para uma moradia.
- Voce pode escolher qualquer local listado.

Responda SOMENTE com JSON valido:

{
  "destinoId": "id_do_local",
  "motivo": "motivo curto em primeira pessoa",
  "curiosidade": "o que quero observar nesse lugar"
}
`;

  try {
    const resposta = await puterClient.ai.chat(prompt, {
      model: "gpt-5-nano"
    });

    const texto = resposta.message.content
      .replace("```json", "")
      .replace("```", "")
      .trim();

    const decisao = JSON.parse(texto);

    if (!mundo.buscarLocalPorId(decisao.destinoId)) {
      return decidirPorInstinto(habitante, mundo);
    }

    return decisao;
  } catch (erro) {
    console.warn("IA falhou, usando instinto:", erro);
    return decidirPorInstinto(habitante, mundo);
  }
}

export function decidirPorInstinto(habitante, mundo) {
  const conhecidos = mundo.locais.filter(l => habitante.mapaConhecido.includes(l.id));

  if (habitante.sede > 70) {
    const agua = conhecidos.find(l => l.tipo === "agua") || mundo.locais.find(l => l.tipo === "agua");

    return {
      destinoId: agua.id,
      motivo: "Estou com sede e preciso encontrar agua.",
      curiosidade: "qualidade da agua"
    };
  }

  if (habitante.fome > 70) {
    const floresta = conhecidos.find(l => l.tipo === "floresta") || mundo.locais.find(l => l.tipo === "floresta");

    return {
      destinoId: floresta.id,
      motivo: "Estou com fome e quero procurar algo para comer.",
      curiosidade: "frutos ou animais"
    };
  }

  if (habitante.energia < 30) {
    const aldeia = mundo.locais.find(l => l.tipo === "moradia");

    return {
      destinoId: aldeia.id,
      motivo: "Estou cansado e quero voltar para um lugar seguro.",
      curiosidade: "descanso"
    };
  }

  const desconhecidos = mundo.locais.filter(l => !habitante.mapaConhecido.includes(l.id));

  if (desconhecidos.length && habitante.curiosidade > 50) {
    const local = escolher(desconhecidos);

    return {
      destinoId: local.id,
      motivo: "Sinto curiosidade por uma regiao que ainda nao conheco.",
      curiosidade: "descobrir o que existe ali"
    };
  }

  const local = escolher(mundo.locais);

  return {
    destinoId: local.id,
    motivo: "Quero continuar observando o mundo.",
    curiosidade: "entender melhor o ambiente"
  };
}
