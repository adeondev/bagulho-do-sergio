import { GAME_HEIGHT, GAME_WIDTH, NOMES } from "./config.js";
import { registrarAssets } from "./assets.js";
import { Mundo } from "./mundo.js";
import { Habitante } from "./habitante.js";
import { decidirDestinoComIA } from "./ia.js";
import { adicionarEvento, atualizarPainel, configurarPainel, setEstadoPausa } from "./ui.js";
import { aleatorio, distancia, escolher } from "./utils.js";

let cena;
let mundo;
let habitantes = [];
let habitanteSelecionado = null;
let tempo = 0;
let uiTimer = 0;
let interacaoTimer = 0;
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

  habitantes.forEach(h => {
    h.mover(mundo, habitanteChegouNoDestino, delta);
  });

  processarInteracoes(delta);

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
    }
  });

  document.getElementById("btn-dia").addEventListener("click", async () => {
    await passarDia();
  });

  document.getElementById("btn-pause").addEventListener("click", alternarPausa);

  cena.input.keyboard.on("keydown-ESC", alternarPausa);

  cena.input.on("pointerdown", pointer => {
    if (!habitanteSelecionado || !habitanteSelecionado.vivo) return;
    if (performance.now() - ultimoCliqueHabitante < 120) return;
    if (pointer.rightButtonDown()) return;

    const tile = mundo.tilePorTela(pointer.worldX, pointer.worldY);

    if (!mundo.isWalkable(tile.x, tile.y)) {
      habitanteSelecionado.falar("Nao consigo passar por ali.");
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
      habitanteSelecionado.falar("Vou ate la.");
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

    const decisao = await decidirDestinoComIA(h, mundo);
    const local = mundo.buscarLocalPorId(decisao.destinoId);

    if (!local) continue;

    const ok = h.definirDestino(local, mundo);
    h.pensamento = decisao.motivo;
    h.lembrar(`Decidi ir ate ${local.nome}: ${decisao.motivo}`);

    if (ok) {
      h.falar(decisao.curiosidade || decisao.motivo);
      adicionarEvento(
        mundo,
        `${h.nome} decidiu ir ate ${local.nome}: "${decisao.motivo}"`
      );
    } else {
      adicionarEvento(mundo, `${h.nome} queria ir ate ${local.nome}, mas nao encontrou uma rota segura.`);
    }
  }

  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
  processandoDia = false;
}

function habitanteChegouNoDestino(habitante) {
  const local = mundo.buscarLocalPorId(habitante.destinoLocalId);

  if (!local) return;

  const resultado = habitante.observarLocal(local, mundo);

  if (resultado) {
    habitante.falar(resultado);
    adicionarEvento(mundo, `${habitante.nome}: ${resultado}.`);
  }

  atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
}

function processarInteracoes(delta) {
  interacaoTimer += delta;
  if (interacaoTimer < 760) return;
  interacaoTimer = 0;

  for (let i = 0; i < habitantes.length; i++) {
    for (let j = i + 1; j < habitantes.length; j++) {
      const a = habitantes[i];
      const b = habitantes[j];

      if (!a.podeConversarCom(b)) continue;
      if (distancia(a.sprite, b.sprite) > 92) continue;
      if (Math.random() > 0.55) continue;

      const falaA = criarFala(a, b);
      const falaB = criarFala(b, a);

      a.conversarCom(b, falaA);
      b.conversarCom(a, falaB);

      adicionarEvento(mundo, `${a.nome} e ${b.nome} trocaram informacoes enquanto estavam perto.`);
      atualizarPainel(mundo, habitantes, { selecionado: habitanteSelecionado, pausado });
      return;
    }
  }
}

function criarFala(habitante, outro) {
  if (habitante.sede > 72) return "Voce viu agua por perto?";
  if (habitante.fome > 72) return "Se achar comida, me avisa.";
  if (habitante.energia < 30) return "Estou pensando em voltar para descansar.";
  if (habitante.mapaConhecido.length < outro.mapaConhecido.length) return "Quero comparar nossos mapas.";

  const terreno = mundo.descreverTile(habitante.xTile, habitante.yTile);
  return escolher([
    `Este terreno de ${terreno} parece importante.`,
    "Acho que descobri uma rota melhor.",
    "Vamos observar antes de seguir.",
    "Se ficarmos perto, aprendemos mais rapido."
  ]);
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
