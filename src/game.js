import { GAME_HEIGHT, GAME_WIDTH, NOMES, TRIBOS, BALANCE, ALDEIA_X, ALDEIA_Y } from "./config.js";
import { registrarAssets } from "./assets.js";
import { Mundo } from "./mundo.js";
import { Habitante } from "./habitante.js";
import { Estruturas } from "./estruturas.js";
import { Fauna } from "./fauna.js";
import { decidirAcaoComIA, decidirInteracaoComIA, executarEmLote } from "./ia.js";
import { ESTRUTURAS, FERRAMENTAS } from "./definicoes.js";
import { adicionarEvento, atualizarPainel, configurarPainel, setEstadoPausa } from "./ui.js";
import { aleatorio, distancia, distanciaTiles, escolher, iso } from "./utils.js";
import { nomeProvedor } from "./provedoresIa.js";
import { salvar, carregar, apagar, temSave } from "./persistencia.js";

let cena, mundo, estruturas, fauna;
let habitantes = [];
let habitanteSelecionado = null;

const estado = { era: 0, guerra: false, parGuerra: null };
let tempo = 0;
let relogioDia = 0;
let uiTimer = 0;
let interacaoTimer = 0;
let decisaoTimer = 0;
let autosaveTimer = 0;
let interacaoProcessando = false;
let decisaoProcessando = false;
let pausado = false;
let concorrencia = 5;
let ultimoCliqueHabitante = 0;
let controlesCamera;
let seguindoSelecionado = false;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#0f1a17",
  scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() { registrarAssets(this); }

function create() {
  cena = this;
  this.simVelocidade = 1;
  this.cameras.main.setZoom(0.8);

  const save = carregar();
  const seed = save ? save.seed : (Math.random() * 1e9) | 0;

  mundo = new Mundo(this, seed);
  this.mundo = mundo;
  mundo.desenhar();

  estruturas = new Estruturas(this, mundo);
  fauna = new Fauna(this, mundo);

  configurarCamera(this);

  if (save) {
    carregarMundoSalvo(save);
    adicionarEvento(mundo, `Mundo restaurado: dia ${mundo.dia}, era ${nomeEra(estado.era)}.`);
  } else {
    criarHabitantesNovos(this, 20);
    fauna.povoar(60);
    adicionarEvento(mundo, "Um novo mundo nasceu. As tribos comecam a explorar e sobreviver.");
  }

  configurarInterface();
  atualizarPainel(contextoPainel());

  // Handle de debug no console: window.MundoVivo.habitantes, .estruturas, .estado
  window.MundoVivo = {
    get habitantes() { return habitantes; },
    get estruturas() { return estruturas; },
    get fauna() { return fauna; },
    get estado() { return estado; },
    get mundo() { return mundo; }
  };
}

function update(time, delta) {
  atualizarCamera(delta);
  mundo.atualizarCulling(cena.cameras.main);
  if (pausado) return;

  const d = delta * (cena.simVelocidade || 1);
  tempo += d;
  relogioDia += d;
  uiTimer += delta;
  autosaveTimer += delta;

  const ctx = contextoIa();
  for (const h of habitantes) {
    const podeExplorarLivre = !decisaoProcessando && !h.acaoPendente && h.tempoConversa <= 0;
    h.mover(mundo, habitanteChegouNoDestino, delta, podeExplorarLivre);
    const ev = h.tickVida(d, ctx);
    if (ev) eventoHabitante(h, ev);
  }

  fauna.update(d, habitantes, (animal, presa) => {
    presa.receberDano(animal.def.ataque || 6, `ataque de ${animal.def.nome}`);
    if (Math.random() < 0.25) eventoHabitante(presa, `${animal.def.nome} atacou ${presa.nome}!`);
  });

  processarInteracoes(delta);
  processarDecisoes(delta);

  if (relogioDia > BALANCE.segundosPorDia * 1000) {
    relogioDia = 0;
    passarDia();
  }

  if (autosaveTimer > 20000) {
    autosaveTimer = 0;
    salvarMundo(false);
  }

  if (uiTimer > 480) {
    uiTimer = 0;
    atualizarPainel(contextoPainel());
  }
}

// ===================== SETUP ===========================================
function criarHabitantesNovos(scene, quantidade) {
  for (let i = 0; i < quantidade; i++) {
    const tribo = TRIBOS[i % TRIBOS.length].id;
    const ponto = mundo.escolherTileLivreProximo(ALDEIA_X, ALDEIA_Y, 5) || { x: ALDEIA_X, y: ALDEIA_Y };
    const h = new Habitante(scene, NOMES[i % NOMES.length] + (i >= NOMES.length ? " II" : ""), ponto.x, ponto.y, tribo);
    registrarCliqueHabitante(h);
    habitantes.push(h);
  }
  selecionarHabitante(habitantes[0]);
}

function carregarMundoSalvo(save) {
  mundo.dia = save.dia || 1;
  estado.era = save.era || 0;
  estado.guerra = Boolean(save.guerra);
  relogioDia = save.relogioDia || 0;

  (save.habitantes || []).forEach(d => {
    const h = new Habitante(cena, d.nome, d.xTile, d.yTile, d.tribo);
    if (d.textura) { h.textura = d.textura; h.visual.setTexture(d.textura); }
    h.aplicarEstado(d);
    const pos = mundo.posicaoHabitante(d.xTile, d.yTile);
    h.sprite.setPosition(pos.x, pos.y);
    registrarCliqueHabitante(h);
    habitantes.push(h);
  });

  estruturas.restaurar(save.estruturas || []);
  fauna.restaurar(save.animais || []);
  if (!fauna.animais.length) fauna.povoar(48);
  if (habitantes[0]) selecionarHabitante(habitantes[0]);
}

function registrarCliqueHabitante(h) {
  h.sprite.on("pointerdown", (pointer, lx, ly, event) => {
    ultimoCliqueHabitante = performance.now();
    if (event) event.stopPropagation();
    selecionarHabitante(h);
  });
}

function configurarInterface() {
  configurarPainel({
    aoSelecionarHabitante: nome => {
      const h = habitantes.find(x => x.nome === nome);
      if (h) selecionarHabitante(h);
    },
    aoConfigIaMudou: cfg => {
      adicionarEvento(mundo, `Modo de IA: ${nomeProvedor(cfg.provider)}.`);
      atualizarPainel(contextoPainel());
    },
    aoMudarVelocidade: v => { cena.simVelocidade = v; },
    aoMudarConcorrencia: v => { concorrencia = v; },
    aoSalvar: () => { salvarMundo(true); adicionarEvento(mundo, "Mundo salvo."); },
    aoNovoMundo: novoMundo,
    aoSeguirSelecionado: () => alternarSeguirSelecionado(),
    aoIrAldeia: () => focarAldeia(),
    aoClicarEvento: data => focarEvento(data),
    aoPainelMudou: () => setTimeout(() => cena.scale.resize(window.innerWidth - document.getElementById("painel").offsetWidth, window.innerHeight), 50)
  });

  document.getElementById("btn-dia")?.addEventListener("click", () => passarDia());
  document.getElementById("btn-pause")?.addEventListener("click", alternarPausa);

  window.addEventListener("ia-error", e => {
    const detail = e.detail || {};
    adicionarEvento(mundo, `${detail.provider || "IA"} falhou: ${detail.message || "erro"}. Usando instinto.`);
  });
  window.addEventListener("beforeunload", () => salvarMundo(false));

  cena.input.keyboard.on("keydown-ESC", alternarPausa);
  cena.input.on("pointerdown", pointer => {
    if (performance.now() - ultimoCliqueHabitante < 120) return;
    if (pointer.rightButtonDown()) return;
  });
}

function novoMundo() {
  apagar();
  window.location.reload();
}

// ===================== CAMERA ==========================================
function configurarCamera(scene) {
  const limites = mundo.limitesMundo();
  scene.cameras.main.setBounds(limites.x, limites.y, limites.width, limites.height);
  const centro = iso(ALDEIA_X, ALDEIA_Y);
  scene.cameras.main.centerOn(centro.x, centro.y);

  controlesCamera = {
    cursores: scene.input.keyboard.createCursorKeys(),
    teclas: scene.input.keyboard.addKeys({ w: "W", a: "A", s: "S", d: "D" })
  };

  scene.input.mouse.disableContextMenu();
  scene.input.on("wheel", (pointer, objetos, dX, dY) => {
    const cam = scene.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom - dY * 0.0012, 0.34, 1.3));
  });
  scene.input.on("pointermove", pointer => {
    if (!pointer.rightButtonDown()) return;
    pararSeguir(); // arrastar com o botao direito cancela o seguir
    const cam = scene.cameras.main;
    const ant = pointer.prevPosition || pointer.position;
    cam.scrollX -= (pointer.x - ant.x) / cam.zoom;
    cam.scrollY -= (pointer.y - ant.y) / cam.zoom;
  });
}

function atualizarCamera(delta) {
  if (!controlesCamera || !cena) return;
  const cam = cena.cameras.main;
  const vel = 0.85 * delta / cam.zoom;
  const { cursores, teclas } = controlesCamera;
  const esq = cursores.left.isDown || teclas.a.isDown;
  const dir = cursores.right.isDown || teclas.d.isDown;
  const cima = cursores.up.isDown || teclas.w.isDown;
  const baixo = cursores.down.isDown || teclas.s.isDown;
  if (esq || dir || cima || baixo) pararSeguir(); // controle manual cancela o seguir
  if (esq) cam.scrollX -= vel;
  if (dir) cam.scrollX += vel;
  if (cima) cam.scrollY -= vel;
  if (baixo) cam.scrollY += vel;
}

function selecionarHabitante(h, voar = true) {
  habitanteSelecionado = h;
  habitantes.forEach(x => x.setSelecionado(x === h));

  // Teleporta a camera ate o habitante e passa a segui-lo.
  if (h && h.vivo && cena && voar) {
    const cam = cena.cameras.main;
    cam.stopFollow();
    cam.centerOn(h.sprite.x, h.sprite.y);
    cam.startFollow(h.sprite, true, 0.12, 0.12);
    seguindoSelecionado = true;
    cam.flash(180, 246, 220, 140, true);
  }
  atualizarPainel(contextoPainel());
}

function pararSeguir() {
  seguindoSelecionado = false;
  cena?.cameras?.main?.stopFollow();
}

function alternarSeguirSelecionado() {
  if (!habitanteSelecionado || !habitanteSelecionado.vivo || !cena) return;
  if (seguindoSelecionado) {
    pararSeguir();
    return;
  }
  selecionarHabitante(habitanteSelecionado, true);
}

function focarAldeia() {
  if (!cena) return;
  pararSeguir();
  const pos = iso(ALDEIA_X, ALDEIA_Y);
  cena.cameras.main.pan(pos.x, pos.y, 420, "Sine.easeInOut");
  cena.cameras.main.flash(120, 143, 209, 106, true);
}

function focarEvento(data = {}) {
  if (data.habitante) {
    const h = habitantes.find(x => x.nome === data.habitante);
    if (h) { selecionarHabitante(h, true); return; }
  }
  if (Number.isInteger(data.x) && Number.isInteger(data.y)) {
    pararSeguir();
    const pos = mundo.posicaoHabitante(data.x, data.y);
    cena.cameras.main.pan(pos.x, pos.y, 420, "Sine.easeInOut");
    cena.cameras.main.flash(120, 114, 209, 214, true);
  }
}

// ===================== CONTEXTO ========================================
function contextoIa() {
  return { mundo, estruturas, fauna, era: estado.era, guerra: estado.guerra };
}

function eventoHabitante(h, texto) {
  adicionarEvento(mundo, texto, { habitante: h.nome, x: h.xTile, y: h.yTile });
}

const EMOJI_TAREFA = {
  beber: "💧", comer: "🍖", coletar: "🪵", construir: "🏠", craftar: "🛠️",
  cacar: "🏹", atacar: "⚔️", descansar: "😴", socializar: "💬", explorar: "🧭", observar: "👁️"
};

function emojiDaTarefa(tarefa) {
  return EMOJI_TAREFA[tarefa] || "✨";
}

function contextoPainel() {
  return {
    mundo, habitantes, estruturas, fauna,
    selecionado: habitanteSelecionado, pausado,
    era: estado.era, eraNome: nomeEra(estado.era), guerra: estado.guerra,
    tribos: resumoTribos(), concorrencia, velocidade: cena?.simVelocidade || 1
  };
}

function nomeEra(i) {
  return ["Sobrevivencia", "Ferramentas", "Assentamento", "Construcao", "Sociedade", "Conflito"][i] || "?";
}

// ===================== DECISOES (IA paralela) ==========================
function processarDecisoes(delta) {
  decisaoTimer += delta;
  if (decisaoProcessando || decisaoTimer < 550) return;
  decisaoTimer = 0;

  const ociosos = habitantes.filter(h =>
    h.vivo && !h.caminho.length && !h.acaoPendente && h.tempoConversa <= 0 && h.tempoOcioso > h.proximoPasseioEm
  );
  if (!ociosos.length) return;

  ociosos.sort((a, b) => b.tempoOcioso - a.tempoOcioso);
  const lote = ociosos.slice(0, Math.max(1, concorrencia));
  lote.forEach(h => { h.tempoOcioso = 0; });

  decisaoProcessando = true;
  const ctx = contextoIa();
  executarEmLote(lote, concorrencia, async (h) => {
    if (!h.vivo) return;
    const acao = await decidirAcaoComIA(h, mundo, habitantes, ctx);
    if (acao) executarAcaoAutonoma(h, acao);
  }).catch(e => console.warn("Decisoes:", e)).finally(() => { decisaoProcessando = false; });
}

function executarAcaoAutonoma(h, acao) {
  if (!h.vivo || !acao) return;
  h.acaoPendente = acao;
  h.objetivoAtual = acao.acao;
  h.pensamento = acao.motivo;
  h.registrarAcao({ ...acao, dia: mundo.dia });
  if (acao.fala) h.falar(acao.fala);
  else if ((acao.intensidade || 0) >= 55 || Math.random() < 0.08) {
    h.falar(acao.motivo || acao.acao, 2200);
  }

  const alvo = acao.alvoHabitante ? habitantes.find(x => x.nome === acao.alvoHabitante && x.vivo) : null;

  if (alvo && distancia(h.sprite, alvo.sprite) <= 80) {
    resolverComAlvo(h, alvo, acao);
    h.acaoPendente = null;
    return;
  }

  // Tarefas imediatas (sem deslocamento).
  if (!alvo && !acao.destinoTile && !acao.destinoLocalId) {
    const r = resolverTarefa(h, null, acao);
    h.acaoPendente = null;
    if (r) eventoHabitante(h, `${h.nome}: ${r}.`);
    return;
  }

  let ok = false;
  if (alvo) {
    const destino = mundo.tileValidoMaisProximo(alvo.xTile, alvo.yTile, 4);
    ok = destino && h.definirDestinoTile(destino, mundo, acao.acao, null, false);
  } else if (acao.destinoTile) {
    ok = h.definirDestinoTile(acao.destinoTile, mundo, acao.acao, null, false);
  } else if (acao.destinoLocalId) {
    const local = mundo.buscarLocalPorId(acao.destinoLocalId);
    ok = local && h.definirDestino(local, mundo);
  }

  if (!ok) {
    const r = resolverTarefa(h, null, acao);
    h.acaoPendente = null;
    if (r) eventoHabitante(h, `${h.nome}: ${r}.`);
  }
}

function habitanteChegouNoDestino(h) {
  const acao = h.acaoPendente;
  if (!acao) {
    const local = mundo.buscarLocalPorId(h.destinoLocalId);
    if (local) {
      const r = h.observarLocal(local);
      if (r) { h.falar(r); eventoHabitante(h, `${h.nome}: ${r}.`); }
    }
    return;
  }

  const alvo = acao.alvoHabitante ? habitantes.find(x => x.nome === acao.alvoHabitante && x.vivo) : null;
  let resultado = "";
  if (alvo && distancia(h.sprite, alvo.sprite) <= 130) {
    resultado = resolverComAlvo(h, alvo, acao);
  } else {
    const local = acao.destinoLocalId ? mundo.buscarLocalPorId(acao.destinoLocalId) : null;
    resultado = resolverTarefa(h, local, acao);
  }

  h.acaoPendente = null;
  if (resultado) {
    h.falar(resultado, 2300);
    h.mostrarPulso?.(emojiDaTarefa(acao.tarefa));
    eventoHabitante(h, `${h.nome}: ${resultado}.`);
  }
  atualizarPainel(contextoPainel());
}

// ===================== RESOLUCAO DE TAREFAS ============================
function resolverTarefa(h, local, acao) {
  switch (acao.tarefa) {
    case "beber":
      if (local && local.tipo === "agua") return h.observarLocal(local);
      h.sede = Math.max(0, h.sede - 30);
      return "bebeu agua";

    case "comer": {
      const fazenda = estruturas.efeitoPerto(h.xTile, h.yTile, "comida");
      if (fazenda) { const q = fazenda.colher(); if (q) { h.inventario.comida += q; h.fome = Math.max(0, h.fome - 20); return `colheu ${q} comida na fazenda`; } }
      if (local) return h.observarLocal(local);
      return h.coletarNoTile(mundo) || "procurou comida";
    }

    case "coletar":
    case "observar":
      if (local) return h.observarLocal(local);
      return h.coletarNoTile(mundo) || "observou o terreno";

    case "descansar":
      if (local && local.tipo === "moradia") return h.observarLocal(local);
      h.energia = Math.min(100, h.energia + 20);
      return "descansou um pouco";

    case "construir": {
      const tipo = acao.tipoConstrucao;
      if (!tipo || !ESTRUTURAS[tipo]) return "tentou construir mas nao sabia o que";
      const e = estruturas.construir(h, tipo, h.xTile, h.yTile);
      if (e) {
        h.adicionarConhecimento(`construi ${ESTRUTURAS[tipo].nome.toLowerCase()}`);
        verificarEra();
        return `construiu ${ESTRUTURAS[tipo].nome} (${e.x},${e.y})`;
      }
      return `nao conseguiu construir ${ESTRUTURAS[tipo].nome.toLowerCase()} (faltou material ou espaco)`;
    }

    case "craftar": {
      const id = acao.tipoFerramenta;
      if (!id || !FERRAMENTAS[id]) return "tentou fabricar algo desconhecido";
      if (id === "espada" && !estruturas.efeitoPerto(h.xTile, h.yTile, "ferramentas")) {
        return "precisa de uma oficina para forjar a espada";
      }
      if (h.craftar(id)) { verificarEra(); return `fabricou ${FERRAMENTAS[id].nome}`; }
      return `nao conseguiu fabricar ${FERRAMENTAS[id].nome.toLowerCase()}`;
    }

    case "cacar": {
      const animal = fauna.animalCacavelPerto(h.xTile, h.yTile, 2.4);
      if (!animal) return "nao achou animal para cacar";
      const dano = 8 + h.bonusAtaque() + aleatorio(0, 6);
      const morreu = animal.receberDano(dano);
      h.energia = Math.max(0, h.energia - 4);
      if (morreu) {
        const carne = (animal.def.carne || 1) + h.bonusColeta("comida");
        h.inventario.comida += carne;
        h.fome = Math.max(0, h.fome - 14);
        h.adicionarConhecimento("caca rende carne");
        return `cacou um ${animal.def.nome.toLowerCase()} e ganhou ${carne} carne`;
      }
      return `feriu um ${animal.def.nome.toLowerCase()}`;
    }

    case "socializar":
      return "procurou companhia";

    case "atacar":
      return "procurou um alvo, mas ele sumiu";

    default:
      if (local) return h.observarLocal(local);
      return "observou ao redor";
  }
}

function resolverComAlvo(h, alvo, acao) {
  const hostil = acao.categoria === "hostil" || acao.tarefa === "atacar";

  if (hostil) {
    const dano = h.atacar(alvo, acao.acao);
    let extra = "";
    // Roubo de recurso.
    if (/roub|tomar|saque|comida/i.test(acao.acao)) {
      const rec = ["comida", "madeira", "pedra"].find(r => alvo.inventario[r] > 0);
      if (rec) { alvo.inventario[rec] -= 1; h.inventario[rec] += 1; extra = ` e roubou ${rec}`; }
    }
    // Contra-ataque.
    if (alvo.vivo && (alvo.coragem > 40 || alvo.temArma()) && Math.random() < 0.7) {
      alvo.atacar(h, "defesa");
    }
    registrarTensaoTribo(h, alvo);
    if (!alvo.vivo) adicionarEvento(mundo, `${alvo.nome} foi derrotado por ${h.nome}.`);
    return `atacou ${alvo.nome} causando ${dano} de dano${extra}`;
  }

  // Cooperacao / conversa.
  if (h.inventario.comida > 0 && alvo.fome > h.fome + 12) {
    h.inventario.comida -= 1;
    alvo.inventario.comida += 1;
    alvo.fome = Math.max(0, alvo.fome - 16);
    h.ajustarRelacao(alvo.nome, 10);
    alvo.ajustarRelacao(h.nome, 12);
    h.moral = Math.min(100, h.moral + 2);
    return `deu comida para ${alvo.nome}`;
  }

  h.conversarCom(alvo, acao.fala || "Vamos seguir juntos.");
  alvo.ajustarRelacao(h.nome, 4);
  if (h.tribo === alvo.tribo) { h.ajustarRelacao(alvo.nome, 2); }
  return `conversou com ${alvo.nome}`;
}

// ===================== INTERACOES POR PROXIMIDADE ======================
function processarInteracoes(delta) {
  interacaoTimer += delta;
  if (interacaoTimer < 1100 || interacaoProcessando) return;
  interacaoTimer = 0;

  for (let i = 0; i < habitantes.length; i++) {
    for (let j = i + 1; j < habitantes.length; j++) {
      const a = habitantes[i];
      const b = habitantes[j];
      if (!a.vivo || !b.vivo) continue;
      if (a.acaoPendente || b.acaoPendente) continue;
      if (distancia(a.sprite, b.sprite) > 86) continue;

      const inimigos = a.tribo !== b.tribo && (estado.guerra || a.relacaoCom(b.nome) < -25);
      const podem = a.podeConversarCom(b) || inimigos;
      if (!podem) continue;
      if (Math.random() > 0.6) continue;

      interacaoProcessando = true;
      executarInteracaoProxima(a, b).finally(() => { interacaoProcessando = false; });
      return;
    }
  }
}

async function executarInteracaoProxima(a, b) {
  const ctx = contextoIa();
  const acaoA = await decidirInteracaoComIA(a, b, mundo, ctx);
  if (!acaoA) return;
  const rA = executarInteracaoAutonoma(a, b, acaoA);

  let rB = "";
  if (a.vivo && b.vivo && Math.random() < 0.7) {
    const acaoB = await decidirInteracaoComIA(b, a, mundo, ctx);
    if (acaoB) rB = executarInteracaoAutonoma(b, a, acaoB);
  }
  adicionarEvento(mundo, rB ? `${rA} ${rB}` : rA);
  atualizarPainel(contextoPainel());
}

function executarInteracaoAutonoma(ator, alvo, acao) {
  if (!acao || !ator.vivo || !alvo.vivo) return "";
  ator.cooldownConversa = aleatorio(5000, 9500);
  ator.tempoConversa = 3000;
  ator.parConversa = alvo.nome;
  if (acao.fala) ator.falar(acao.fala);
  ator.registrarAcao({ ...acao, dia: mundo.dia });

  if (acao.categoria === "hostil" || acao.tarefa === "atacar") {
    const dano = ator.atacar(alvo, acao.acao);
    if (alvo.vivo && (alvo.coragem > 45 || alvo.temArma()) && Math.random() < 0.6) alvo.atacar(ator, "defesa");
    registrarTensaoTribo(ator, alvo);
    if (!alvo.vivo) adicionarEvento(mundo, `${alvo.nome} caiu em combate.`);
    return `${ator.nome} atacou ${alvo.nome} (${dano} dano).`;
  }

  if (/dar|compart|ajud|oferec/i.test(`${acao.acao} ${acao.efeitoEsperado}`) && ator.inventario.comida > 0) {
    ator.inventario.comida -= 1;
    alvo.inventario.comida += 1;
    alvo.fome = Math.max(0, alvo.fome - 16);
    ator.ajustarRelacao(alvo.nome, 10);
    alvo.ajustarRelacao(ator.nome, 10);
    return `${ator.nome} ajudou ${alvo.nome}.`;
  }

  const ganho = ator.tribo === alvo.tribo ? 6 : 3;
  ator.ajustarRelacao(alvo.nome, ganho);
  alvo.ajustarRelacao(ator.nome, ganho - 1);
  return `${ator.nome} conversou com ${alvo.nome}.`;
}

function registrarTensaoTribo(a, b) {
  if (a.tribo === b.tribo) return;
  // Espalha um pouco de tensao entre as tribos envolvidas.
  habitantes.forEach(h => {
    if (h.tribo === a.tribo) h.ajustarRelacao(b.nome, -2);
    if (h.tribo === b.tribo) h.ajustarRelacao(a.nome, -2);
  });
}

// ===================== DIA / PROGRESSAO / GUERRA =======================
function passarDia() {
  mundo.dia++;
  estruturas.atualizarDia(e => adicionarEvento(mundo, `Uma ${e.def.nome.toLowerCase()} se desfez com o tempo.`));
  verificarEra();
  avaliarGuerra();
  salvarMundo(false);
  atualizarPainel(contextoPainel());
}

function somaInventarios(rec) {
  return habitantes.filter(h => h.vivo).reduce((s, h) => s + (h.inventario[rec] || 0), 0);
}

function totalFerramentas() {
  return habitantes.filter(h => h.vivo).reduce((s, h) => s + h.ferramentas.size, 0);
}

function maiorOdioEntreTribos() {
  let pior = 0;
  for (const a of habitantes) {
    for (const b of habitantes) {
      if (a === b || a.tribo === b.tribo) continue;
      pior = Math.max(pior, -a.relacaoCom(b.nome));
    }
  }
  return pior;
}

function verificarEra() {
  const tools = totalFerramentas();
  const estr = estruturas.total;
  const madeira = somaInventarios("madeira");
  const pedra = somaInventarios("pedra");
  const odio = maiorOdioEntreTribos();

  const condicoes = {
    1: tools >= 1 || (madeira >= 12 && pedra >= 6),
    2: tools >= 2,
    3: estr >= 4,
    4: estr >= 8 && tools >= 5,
    5: estr >= 12 && odio >= 55
  };

  while (estado.era < 5 && condicoes[estado.era + 1]) {
    estado.era++;
    adicionarEvento(mundo, `🌅 O mundo avancou para a era "${nomeEra(estado.era)}".`);
  }
}

function avaliarGuerra() {
  // Media de relacao entre cada par de tribos; guerra se odio profundo na era de conflito.
  const piores = {};
  for (const a of habitantes) {
    for (const b of habitantes) {
      if (a === b || a.tribo === b.tribo) continue;
      const par = [a.tribo, b.tribo].sort().join("-");
      piores[par] = Math.min(piores[par] ?? 0, a.relacaoCom(b.nome));
    }
  }
  const parPior = Object.entries(piores).sort((x, y) => x[1] - y[1])[0];
  const emGuerra = estado.era >= 5 && parPior && parPior[1] <= -45;

  if (emGuerra && !estado.guerra) {
    estado.guerra = true;
    estado.parGuerra = parPior[0];
    const [t1, t2] = parPior[0].split("-");
    adicionarEvento(mundo, `⚔️ GUERRA declarada entre ${nomeTribo(t1)} e ${nomeTribo(t2)}!`);
  } else if (!emGuerra && estado.guerra) {
    estado.guerra = false;
    estado.parGuerra = null;
    adicionarEvento(mundo, "🕊️ A paz voltou entre as tribos.");
  }
}

function nomeTribo(id) {
  return (TRIBOS.find(t => t.id === id) || {}).nome || id;
}

function resumoTribos() {
  return TRIBOS.map(t => {
    const membros = habitantes.filter(h => h.vivo && h.tribo === t.id);
    return {
      id: t.id, nome: t.nome, cor: t.cor,
      populacao: membros.length,
      estruturas: estruturas.lista.filter(e => e.tribo === t.id).length,
      moralMedia: membros.length ? Math.round(membros.reduce((s, h) => s + h.moral, 0) / membros.length) : 0
    };
  });
}

// ===================== SAVE ============================================
function buildEstado() {
  return {
    versao: 2,
    seed: mundo.seed,
    dia: mundo.dia,
    era: estado.era,
    guerra: estado.guerra,
    relogioDia,
    habitantes: habitantes.map(h => h.toJSON()),
    estruturas: estruturas.toJSON(),
    animais: fauna.toJSON()
  };
}

function salvarMundo(forcar) {
  salvar(buildEstado());
}

function alternarPausa() {
  pausado = !pausado;
  setEstadoPausa(pausado);
  if (cena) {
    if (pausado) cena.tweens.pauseAll();
    else cena.tweens.resumeAll();
  }
  atualizarPainel(contextoPainel());
}
