import { GAME_HEIGHT, GAME_WIDTH, NOMES } from "./config.js";
import { registrarAssets } from "./assets.js";
import { Mundo } from "./mundo.js";
import { Habitante } from "./habitante.js";
import { decidirAcaoComIA, decidirInteracaoComIA, modoIaAutonomoAtivo } from "./ia.js";
import { adicionarEvento, atualizarPainel, configurarPainel, setEstadoPausa } from "./ui.js";
import { aleatorio, distancia } from "./utils.js";
import { nomeProvedor } from "./provedoresIa.js";

let cena;
let mundo;
let habitantes = [];
let habitanteSelecionado = null;
let tempo = 0;
let uiTimer = 0;
let interacaoTimer = 0;
let acaoLivreTimer = 0;
let interacaoProcessando = false;
let acaoLivreProcessando = false;
let processandoDia = false;
let pausado = false;
let ultimoCliqueHabitante = 0;
let controlesCamera;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#13201d",
  scene: {
    preload,
    create,
    update
  }
};

new Phaser.Game(config);

function preload() {
  registrarAssets(this);
}

function create() {
  cena = this;
  this.cameras.main.setZoom(0.82);

  mundo = new Mundo(this);
  this.mundo = mundo;
  mundo.desenhar();

  configurarCamera(this);
  criarHabitantes(this, 8);
  configurarInterface();

  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
  adicionarEvento(mundo, "O mundo cresceu. Os habitantes agora caminham por rotas livres e observam o terreno.");
}

function update(time, delta) {
  atualizarCamera(delta);

  if (pausado) return;

  tempo += delta;
  uiTimer += delta;
  acaoLivreTimer += delta;
  const iaAutonomaAtiva = modoIaAutonomoAtivo();

  habitantes.forEach(h => {
    h.mover(mundo, habitanteChegouNoDestino, delta, !iaAutonomaAtiva);
  });

  processarInteracoes(delta, iaAutonomaAtiva);
  processarAcoesLivres(iaAutonomaAtiva);

  if (tempo > 16000 && !processandoDia) {
    passarDia();
    tempo = 0;
  }

  if (uiTimer > 520) {
    atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
    uiTimer = 0;
  }
}

function configurarInterface() {
  configurarPainel({
    aoSelecionarHabitante: nome => {
      const habitante = habitantes.find(h => h.nome === nome);
      if (habitante) selecionarHabitante(habitante);
    },
    aoConfigIaMudou: config => {
      adicionarEvento(mundo, `Modo de IA alterado para ${nomeProvedor(config.provider)}.`);
      atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
    }
  });

  document.getElementById("btn-dia").addEventListener("click", async () => {
    await passarDia();
  });

  document.getElementById("btn-pause").addEventListener("click", alternarPausa);

  window.addEventListener("ia-error", evento => {
    const detail = evento.detail || {};
    adicionarEvento(mundo, `${detail.provider || "IA"} falhou: ${detail.message || "erro desconhecido"}`);
  });

  cena.input.keyboard.on("keydown-ESC", alternarPausa);

  cena.input.on("pointerdown", pointer => {
    if (!habitanteSelecionado || !habitanteSelecionado.vivo) return;
    if (performance.now() - ultimoCliqueHabitante < 120) return;
    if (pointer.rightButtonDown()) return;

    if (modoIaAutonomoAtivo()) {
      adicionarEvento(mundo, "Modo IA autonomo ativo: habitantes so se movem por decisao da IA.");
      return;
    }

    const tile = mundo.tilePorTela(pointer.worldX, pointer.worldY);

    if (!mundo.isWalkable(tile.x, tile.y)) {
      adicionarEvento(mundo, "Ponto bloqueado no mapa.");
      return;
    }

    const ok = habitanteSelecionado.definirDestinoTile(
      tile,
      mundo,
      `explorar ${mundo.descreverTile(tile.x, tile.y)}`,
      null,
      false
    );

    if (ok) {
      adicionarEvento(mundo, `${habitanteSelecionado.nome} decidiu explorar um ponto livre do mapa.`);
      atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
    }
  });
}

function configurarCamera(scene) {
  const limites = mundo.limitesMundo();

  scene.cameras.main.setBounds(limites.x, limites.y, limites.width, limites.height);
  scene.cameras.main.centerOn(650, 620);

  controlesCamera = {
    cursores: scene.input.keyboard.createCursorKeys(),
    teclas: scene.input.keyboard.addKeys({
      w: "W",
      a: "A",
      s: "S",
      d: "D"
    })
  };

  scene.input.mouse.disableContextMenu();
  scene.input.on("wheel", (pointer, objetos, deltaX, deltaY) => {
    const camera = scene.cameras.main;
    const zoom = Phaser.Math.Clamp(camera.zoom - deltaY * 0.0012, 0.58, 1.28);
    camera.setZoom(zoom);
  });

  scene.input.on("pointermove", pointer => {
    if (!pointer.rightButtonDown()) return;

    const camera = scene.cameras.main;
    const anterior = pointer.prevPosition || pointer.position;
    const dx = pointer.x - anterior.x;
    const dy = pointer.y - anterior.y;

    camera.scrollX -= dx / camera.zoom;
    camera.scrollY -= dy / camera.zoom;
  });
}

function atualizarCamera(delta) {
  if (!controlesCamera || !cena) return;

  const camera = cena.cameras.main;
  const velocidade = 0.62 * delta / camera.zoom;
  const { cursores, teclas } = controlesCamera;

  if (cursores.left.isDown || teclas.a.isDown) camera.scrollX -= velocidade;
  if (cursores.right.isDown || teclas.d.isDown) camera.scrollX += velocidade;
  if (cursores.up.isDown || teclas.w.isDown) camera.scrollY -= velocidade;
  if (cursores.down.isDown || teclas.s.isDown) camera.scrollY += velocidade;
}

function criarHabitantes(scene, quantidade) {
  const pontos = [
    { x: 12, y: 14 }, { x: 11, y: 15 }, { x: 13, y: 15 }, { x: 12, y: 16 },
    { x: 10, y: 14 }, { x: 14, y: 14 }, { x: 11, y: 13 }, { x: 13, y: 13 }
  ];

  for (let i = 0; i < quantidade; i++) {
    const ponto = pontos[i] ?? mundo.escolherTileLivreProximo(12, 14, 4);
    const habitante = new Habitante(scene, NOMES[i], ponto.x, ponto.y);

    habitante.sprite.on("pointerdown", (pointer, localX, localY, event) => {
      ultimoCliqueHabitante = performance.now();
      if (event) event.stopPropagation();
      selecionarHabitante(habitante);
    });

    habitantes.push(habitante);
  }

  selecionarHabitante(habitantes[0]);
}

function selecionarHabitante(habitante) {
  habitanteSelecionado = habitante;

  habitantes.forEach(h => h.setSelecionado(h === habitante));
  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
}

async function passarDia() {
  if (processandoDia) return;

  processandoDia = true;
  mundo.dia++;

  for (const h of habitantes) {
    if (!h.vivo) continue;

    h.passarNecessidades();

    if (!h.vivo) {
      adicionarEvento(mundo, `${h.nome} morreu.`);
      continue;
    }

    const acao = await decidirAcaoComIA(h, mundo, habitantes);
    if (!acao) {
      adicionarEvento(mundo, `${h.nome} ficou aguardando a IA.`);
      continue;
    }

    executarAcaoAutonoma(h, acao);
  }

  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
  processandoDia = false;
}

function habitanteChegouNoDestino(habitante) {
  const local = mundo.buscarLocalPorId(habitante.destinoLocalId);
  const acao = habitante.acaoPendente;

  if (!local && !acao) return;

  let resultado = "";

  if (acao?.alvoHabitante) {
    const alvo = habitantes.find(h => h.nome === acao.alvoHabitante && h.vivo);
    if (alvo && distancia(habitante.sprite, alvo.sprite) <= 110) {
      resultado = executarInteracaoAutonoma(habitante, alvo, acao);
    }
  }

  if (!resultado) {
    resultado = acao
      ? executarAcaoNoLocal(habitante, local, acao)
      : habitante.observarLocal(local, mundo);
  }

  habitante.acaoPendente = null;

  if (resultado && !acao) {
    habitante.falar(resultado);
  }

  if (resultado) {
    adicionarEvento(mundo, `${habitante.nome}: ${resultado}.`);
  }

  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
}

function processarInteracoes(delta, iaAutonomaAtiva = modoIaAutonomoAtivo()) {
  interacaoTimer += delta;
  if (interacaoTimer < 1250 || interacaoProcessando) return;
  interacaoTimer = 0;

  for (let i = 0; i < habitantes.length; i++) {
    for (let j = i + 1; j < habitantes.length; j++) {
      const a = habitantes[i];
      const b = habitantes[j];

      if (!a.podeConversarCom(b)) continue;
      if (distancia(a.sprite, b.sprite) > 92) continue;
      if (Math.random() > (iaAutonomaAtiva ? 0.72 : 0.55)) continue;

      interacaoProcessando = true;
      executarInteracaoProxima(a, b).finally(() => {
        interacaoProcessando = false;
      });
      return;
    }
  }
}

function processarAcoesLivres(iaAutonomaAtiva = modoIaAutonomoAtivo()) {
  if (!iaAutonomaAtiva) return;
  if (processandoDia || acaoLivreProcessando || acaoLivreTimer < 2600) return;

  acaoLivreTimer = 0;

  const candidato = habitantes
    .filter(h => h.vivo && !h.caminho.length && !h.acaoPendente && h.tempoOcioso > h.proximoPasseioEm)
    .sort((a, b) => b.tempoOcioso - a.tempoOcioso)[0];

  if (!candidato) return;

  acaoLivreProcessando = true;
  decidirAcaoComIA(candidato, mundo, habitantes)
    .then(acao => {
      if (acao) {
        executarAcaoAutonoma(candidato, acao);
      } else {
        adicionarEvento(mundo, `${candidato.nome} ficou parado aguardando a IA.`);
      }
    })
    .catch(erro => {
      console.warn("Acao livre por IA falhou:", erro);
    })
    .finally(() => {
      acaoLivreProcessando = false;
    });
}

function alternarPausa() {
  pausado = !pausado;
  setEstadoPausa(pausado);

  if (cena) {
    if (pausado) {
      cena.tweens.pauseAll();
    } else {
      cena.tweens.resumeAll();
    }
  }

  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
}

function executarAcaoAutonoma(habitante, acao) {
  if (!acao) return;

  const alvo = acao.alvoHabitante
    ? habitantes.find(h => h.nome === acao.alvoHabitante && h.vivo)
    : null;
  const local = acao.destinoLocalId ? mundo.buscarLocalPorId(acao.destinoLocalId) : null;
  const destinoTile = acao.destinoTile;

  habitante.acaoPendente = acao;
  habitante.objetivoAtual = acao.acao;
  habitante.pensamento = acao.motivo;
  habitante.registrarAcao({ ...acao, dia: mundo.dia });
  habitante.lembrar(`Decidi: ${acao.acao}. Motivo: ${acao.motivo}`);

  if (acao.fala) {
    habitante.falar(acao.fala);
  }

  if (alvo && distancia(habitante.sprite, alvo.sprite) <= 100) {
    const resultado = executarInteracaoAutonoma(habitante, alvo, acao);
    habitante.acaoPendente = null;
    adicionarEvento(mundo, resultado);
    atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
    return;
  }

  if (alvo) {
    const destino = mundo.tileValidoMaisProximo(alvo.xTile, alvo.yTile, 4);
    const ok = destino && habitante.definirDestinoTile(destino, mundo, acao.acao, null, false);

    if (ok) {
      adicionarEvento(mundo, `${habitante.nome} decidiu: ${acao.acao}, mirando ${alvo.nome}.`);
      return;
    }
  }

  if (destinoTile) {
    const ok = habitante.definirDestinoTile(destinoTile, mundo, acao.acao, null, false);

    if (ok) {
      adicionarEvento(mundo, `${habitante.nome} decidiu: ${acao.acao}, indo para (${destinoTile.x}, ${destinoTile.y}).`);
      return;
    }
  }

  if (local) {
    const ok = habitante.definirDestino(local, mundo);

    if (ok) {
      habitante.objetivoAtual = acao.acao;
      adicionarEvento(mundo, `${habitante.nome} decidiu: ${acao.acao} em ${local.nome}.`);
      return;
    }
  }

  const resultado = executarAcaoNoLocal(habitante, null, acao);
  habitante.acaoPendente = null;
  adicionarEvento(mundo, `${habitante.nome}: ${resultado}.`);
}

function executarAcaoNoLocal(habitante, local, acao) {
  const texto = `${acao.categoria} ${acao.acao} ${acao.efeitoEsperado}`.toLowerCase();
  let resultado = `${acao.acao}: ${acao.efeitoEsperado}`;

  if (local && !habitante.mapaConhecido.includes(local.id)) {
    habitante.mapaConhecido.push(local.id);
  }

  if (local?.tipo === "agua" && menciona(texto, ["agua", "beber", "sede", "lago", "rio"])) {
    habitante.ajustarNecessidade("sede", -55);
    resultado = `${acao.acao}; a sede diminuiu`;
    habitante.adicionarConhecimento(`${local.nome} fornece agua`);
  } else if (local?.tipo === "moradia" && menciona(texto, ["descans", "dorm", "segur", "recuper"])) {
    habitante.ajustarNecessidade("energia", 38);
    resultado = `${acao.acao}; recuperou energia`;
    habitante.adicionarConhecimento(`${local.nome} ajuda a descansar`);
  } else if (local && ["floresta", "campo"].includes(local.tipo) && menciona(texto, ["com", "frut", "caca", "alimento", "fome", "colet"])) {
    const comida = aleatorio(1, 3);
    habitante.inventario.comida += comida;
    habitante.ajustarNecessidade("fome", -18 * comida);
    resultado = `${acao.acao}; encontrou ${comida} alimento(s)`;
    habitante.adicionarConhecimento(`${local.nome} pode sustentar comida`);
  } else if (local?.tipo === "floresta" && menciona(texto, ["madeira", "galho", "abrigo", "colet"])) {
    habitante.inventario.madeira += aleatorio(1, 2);
    resultado = `${acao.acao}; juntou madeira`;
    habitante.adicionarConhecimento("floresta fornece madeira");
  } else if (local?.tipo === "pedras" && menciona(texto, ["pedra", "ferrament", "rocha", "colet"])) {
    habitante.inventario.pedra += aleatorio(1, 2);
    resultado = `${acao.acao}; juntou pedra`;
    habitante.adicionarConhecimento("pedras podem virar ferramentas");
  } else if (acao.categoria === "hostil") {
    habitante.ajustarNecessidade("energia", -12);
    resultado = `${acao.acao}; a tensao aumentou`;
  } else if (acao.categoria === "criativa") {
    habitante.ajustarNecessidade("energia", -5);
    habitante.curiosidade = Math.min(100, habitante.curiosidade + 3);
    resultado = `${acao.acao}; criou uma nova ideia`;
  } else {
    habitante.ajustarNecessidade("energia", -4);
  }

  habitante.pensamento = `${acao.motivo} Resultado: ${resultado}.`;
  habitante.objetivoAtual = acao.acao;
  habitante.lembrar(resultado);
  habitante.registrarAcao({ ...acao, motivo: resultado, dia: mundo.dia });

  return resultado;
}

async function executarInteracaoProxima(a, b) {
  const acaoA = await decidirInteracaoComIA(a, b, mundo);
  if (!acaoA) return;

  const resultadoA = executarInteracaoAutonoma(a, b, acaoA);

  let resultadoB = "";
  if (b.vivo && a.vivo && Math.random() < 0.75) {
    const acaoB = await decidirInteracaoComIA(b, a, mundo);
    if (acaoB) {
      resultadoB = executarInteracaoAutonoma(b, a, acaoB);
    }
  }

  adicionarEvento(mundo, resultadoB ? `${resultadoA} ${resultadoB}` : resultadoA);
  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
}

function executarInteracaoAutonoma(ator, alvo, acao) {
  if (!acao) return "";

  ator.cooldownConversa = aleatorio(6500, 11500);
  ator.tempoConversa = 3200;
  ator.parConversa = alvo.nome;
  ator.pensamento = `${acao.acao}: ${acao.motivo}`;
  ator.lembrar(`${acao.acao}: ${acao.motivo}`);
  ator.ajustarRelacao(alvo.nome, 2);

  if (acao.fala) {
    ator.falar(acao.fala);
  }

  ator.registrarAcao({ ...acao, dia: mundo.dia });

  if (acao.categoria === "hostil" || menciona(`${acao.acao} ${acao.efeitoEsperado}`, ["atac", "roub", "ameac", "empurr", "ferir", "conflito"])) {
    const dano = Math.max(1, Math.round(acao.intensidade / 9));
    alvo.receberDano(dano, acao.acao);
    ator.ajustarRelacao(alvo.nome, -12 - Math.round(acao.intensidade / 8));
    alvo.ajustarRelacao(ator.nome, -18 - Math.round(acao.intensidade / 6));
    ator.ajustarNecessidade("energia", -8);

    if (menciona(acao.acao, ["roub", "tomar", "pegar"])) {
      transferirRecurso(alvo, ator);
    }

    return `${ator.nome} teve uma acao hostil com ${alvo.nome}: ${acao.acao}.`;
  }

  if (menciona(`${acao.acao} ${acao.efeitoEsperado}`, ["dar", "compart", "ajud", "oferec"])) {
    compartilharRecurso(ator, alvo);
    ator.ajustarRelacao(alvo.nome, 10);
    alvo.ajustarRelacao(ator.nome, 8);
    return `${ator.nome} tentou cooperar com ${alvo.nome}: ${acao.acao}.`;
  }

  ator.ajustarRelacao(alvo.nome, 5);
  alvo.ajustarRelacao(ator.nome, 3);
  return `${ator.nome} interagiu com ${alvo.nome}: ${acao.acao}.`;
}

function compartilharRecurso(origem, destino) {
  if (origem.inventario.comida > 0 && destino.fome > origem.fome) {
    origem.inventario.comida -= 1;
    destino.inventario.comida += 1;
    destino.ajustarNecessidade("fome", -16);
  }
}

function transferirRecurso(origem, destino) {
  const recurso = ["comida", "madeira", "pedra"].find(item => origem.inventario[item] > 0);
  if (!recurso) return;

  origem.inventario[recurso] -= 1;
  destino.inventario[recurso] += 1;
}

function menciona(texto, termos) {
  const base = String(texto || "").toLowerCase();
  return termos.some(termo => base.includes(termo));
}
