import { HABITANTE_TEXTURES } from "./assets.js";
import { aleatorio, chaveTile, escolher, clamp, distanciaTiles } from "./utils.js";
import { BALANCE, TRIBOS } from "./config.js";
import { FERRAMENTAS, podePagar, pagar } from "./definicoes.js";

export class Habitante {
  constructor(scene, nome, x, y, tribo = "vale") {
    this.scene = scene;
    this.nome = nome;
    this.tribo = tribo;
    this.idade = aleatorio(16, 38);

    this.fome = aleatorio(8, 30);
    this.sede = aleatorio(8, 30);
    this.energia = aleatorio(65, 100);
    this.saude = 100;
    this.moral = aleatorio(50, 80);
    this.vivo = true;

    this.personalidade = escolher([
      "curioso e bondoso",
      "ambicioso e corajoso",
      "calmo e observador",
      "criativo e sociavel",
      "desconfiado e independente",
      "leal e protetor",
      "agressivo e territorial"
    ]);

    this.curiosidade = aleatorio(40, 100);
    this.coragem = aleatorio(30, 100);
    this.sociabilidade = aleatorio(20, 100);
    this.agressividade = aleatorio(10, 90);

    this.pensamento = "Estou comecando a entender este mundo.";
    this.objetivoAtual = "observar o ambiente";

    this.memorias = [];
    this.historicoAcoes = [];
    this.relacoes = {};
    this.inventario = { comida: 0, madeira: 0, pedra: 0 };
    this.ferramentas = new Set();
    this.conhecimentos = [
      "agua reduz sede",
      "descansar recupera energia",
      "observar ajuda a aprender"
    ];

    this.mapaConhecido = ["aldeia_inicial", "lago_aldeia"];
    this.tilesConhecidos = new Set();

    this.xTile = x;
    this.yTile = y;
    this.destinoTile = null;
    this.destinoLocalId = null;
    this.deveObservarDestino = false;
    this.chegadaPendente = false;
    this.caminho = [];
    this.acaoPendente = null;
    this.limparMarcadorDestino();

    this.velocidade = aleatorio(92, 132);
    this.tempoOcioso = 0;
    this.proximoPasseioEm = aleatorio(1400, 3400);
    this.cooldownConversa = aleatorio(800, 3600);
    this.tempoConversa = 0;
    this.parConversa = "";
    this.beberCd = 0;
    this.comerCd = 0;
    this.bolha = null;
    this.marcadorDestino = null;
    this._statusIconAtual = "";

    this.textura = escolher(HABITANTE_TEXTURES);
    this.sprite = this.criarSprite(x, y);
    this.marcarTilesConhecidosAoRedor(x, y, 2);
  }

  corTribo() {
    return (TRIBOS.find(t => t.id === this.tribo) || TRIBOS[0]).cor;
  }

  nomeTribo() {
    return (TRIBOS.find(t => t.id === this.tribo) || TRIBOS[0]).nome;
  }

  criarSprite(x, y) {
    const pos = this.posicaoInicial(x, y);
    const container = this.scene.add.container(pos.x, pos.y);

    this.anelTribo = this.scene.add.graphics();
    this.anelTribo.lineStyle(3, this.corTribo(), 0.85);
    this.anelTribo.strokeEllipse(0, -4, 46, 18);

    this.selecao = this.scene.add.graphics();
    this.selecao.lineStyle(3, 0xf3d56b, 0.95);
    this.selecao.strokeEllipse(0, -6, 58, 23);
    this.selecao.setVisible(false);

    this.visualBaseScale = 0.7;
    this.visual = this.scene.add.image(0, 0, this.textura);
    this.visual.setOrigin(0.5, 1);
    this.visual.setScale(this.visualBaseScale);

    this.statusIcon = this.scene.add.text(0, -94, "👁️", {
      fontFamily: "Arial", fontSize: "17px", fontStyle: "700",
      color: "#fff8df", align: "center",
      backgroundColor: "rgba(16, 24, 32, 0.72)",
      padding: { x: 5, y: 2 }
    });
    this.statusIcon.setOrigin(0.5);

    this.nomeLabel = this.scene.add.text(0, -74, this.nome, {
      fontFamily: "Arial", fontSize: "12px", fontStyle: "700",
      color: "#fff8df", align: "center"
    });
    this.nomeLabel.setOrigin(0.5);
    this.nomeLabel.setShadow(0, 2, "#000000", 3, true, true);

    container.add([this.anelTribo, this.selecao, this.visual, this.statusIcon, this.nomeLabel]);
    container.setSize(58, 92);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-29, -92, 58, 98),
      Phaser.Geom.Rectangle.Contains
    );
    container.setDepth(pos.y + 10000);

    this.scene.tweens.add({
      targets: this.visual,
      y: { from: 0, to: -4 },
      duration: aleatorio(760, 1040),
      delay: aleatorio(0, 400),
      yoyo: true, repeat: -1, ease: "Sine.inOut"
    });

    return container;
  }

  posicaoInicial(x, y) {
    return this.scene.mundo?.posicaoHabitante(x, y) ?? { x: 0, y: 0 };
  }

  // ---- MOVIMENTO ---------------------------------------------------------
  mover(mundo, aoChegar, delta, permitirExploracaoLivre = true) {
    if (!this.vivo) return;
    this.atualizarRelogios(delta);
    this.atualizarIndicadores();

    if (this.chegadaPendente) {
      this.chegadaPendente = false;
      if (this.deveObservarDestino || this.acaoPendente) {
        this.deveObservarDestino = false;
        aoChegar(this);
      }
      return;
    }

    if (!this.caminho.length) {
      this.tempoOcioso += delta;
      if (permitirExploracaoLivre && !this.acaoPendente && this.tempoConversa <= 0 && this.tempoOcioso > this.proximoPasseioEm * 2.2) {
        this.iniciarExploracaoLivre(mundo);
      }
      return;
    }

    const proximo = this.caminho[0];
    const alvo = mundo.posicaoHabitante(proximo.x, proximo.y);
    const dx = alvo.x - this.sprite.x;
    const dy = alvo.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const velSim = this.scene.simVelocidade || 1;
    const passo = this.velocidade * (delta / 1000) * velSim;

    this.tempoOcioso = 0;

    if (dist <= passo) {
      this.sprite.x = alvo.x;
      this.sprite.y = alvo.y;
      this.xTile = proximo.x;
      this.yTile = proximo.y;
      this.caminho.shift();
      this.explorarAoRedor(mundo);
      if (!this.caminho.length) this.finalizarMovimento(aoChegar);
    } else {
      this.sprite.x += (dx / dist) * passo;
      this.sprite.y += (dy / dist) * passo;
      this.visual.setScale(dx < 0 ? -this.visualBaseScale : this.visualBaseScale, this.visualBaseScale);
    }
    this.sprite.setDepth(this.sprite.y + 10000);
    this.atualizarIndicadores();
  }

  atualizarRelogios(delta) {
    this.cooldownConversa = Math.max(0, this.cooldownConversa - delta);
    this.tempoConversa = Math.max(0, this.tempoConversa - delta);
    this.beberCd = Math.max(0, this.beberCd - delta);
    this.comerCd = Math.max(0, this.comerCd - delta);
    if (this.tempoConversa === 0) this.parConversa = "";
  }

  finalizarMovimento(aoChegar) {
    this.limparMarcadorDestino();
    this.destinoTile = null;
    this.proximoPasseioEm = aleatorio(1200, 3600);
    if (this.deveObservarDestino || this.acaoPendente) {
      this.deveObservarDestino = false;
      aoChegar(this);
      return;
    }
    this.objetivoAtual = "observando o terreno";
  }

  iniciarExploracaoLivre(mundo) {
    const alvo = this.curiosidade > 50
      ? mundo.escolherTileExploracao(this)
      : mundo.escolherTileLivreProximo(this.xTile, this.yTile, aleatorio(4, 12));
    if (!alvo) return;
    const tipo = mundo.descreverTile(alvo.x, alvo.y);
    this.definirDestinoTile(alvo, mundo, `explorar ${tipo}`, null, false);
    this.pensamento = `Quero circular e entender melhor o terreno de ${tipo}.`;
    if (Math.random() < 0.18) this.falar("Vou explorar.", 1500);
  }

  definirDestino(local, mundo) {
    const alvo = mundo.escolherTileAoRedorLocal(local);
    if (!alvo) return false;
    return this.definirDestinoTile(alvo, mundo, `ir ate ${local.nome}`, local.id, true);
  }

  definirDestinoTile(tile, mundo, objetivo, localId = null, deveObservar = false) {
    const caminho = mundo.encontrarCaminho({ x: this.xTile, y: this.yTile }, tile);
    if (!caminho.length) {
      this.pensamento = "Nao encontrei uma rota segura ate esse ponto.";
      return false;
    }
    this.caminho = caminho.slice(1);
    this.destinoTile = tile;
    this.destinoLocalId = localId;
    this.deveObservarDestino = deveObservar;
    this.objetivoAtual = objetivo;
    this.tempoOcioso = 0;
    this.proximoPasseioEm = aleatorio(1600, 4000);
    this.mostrarMarcadorDestino(tile, mundo);
    this.atualizarIndicadores();
    if (!this.caminho.length) this.chegadaPendente = true;
    return true;
  }

  // ---- VIDA: necessidades continuas + reflexos de sobrevivencia ----------
  tickVida(delta, ctx) {
    if (!this.vivo) return null;
    const seg = delta / 1000;
    const parado = this.caminho.length === 0;

    this.fome = clamp(this.fome + BALANCE.fomePorSeg * seg, 0, 130);
    this.sede = clamp(this.sede + BALANCE.sedePorSeg * seg, 0, 130);
    if (!parado) this.energia = clamp(this.energia - BALANCE.energiaPorSeg * seg, 0, 100);

    let evento = null;

    // Beber: agua natural ao lado ou poco proximo.
    if (this.sede > BALANCE.beberSe && this.beberCd <= 0) {
      const temPoco = ctx.estruturas?.efeitoPerto(this.xTile, this.yTile, "agua");
      if (ctx.mundo.aguaAoAlcance(this.xTile, this.yTile, 1) || temPoco) {
        this.sede = clamp(this.sede - 42, 0, 130);
        this.beberCd = 1400;
        this.moral = clamp(this.moral + 1, 0, 100);
      }
    }

    // Comer: usa comida do inventario quando faminto.
    if (this.fome > BALANCE.comerSe && this.comerCd <= 0 && this.inventario.comida > 0) {
      this.inventario.comida -= 1;
      this.fome = clamp(this.fome - 38, 0, 130);
      this.comerCd = 1600;
    }
    // Forrageio de emergencia em vegetacao.
    if (this.fome > 84 && this.comerCd <= 0) {
      const t = ctx.mundo.tipoTile(this.xTile, this.yTile);
      if (["campo", "grama", "floresta"].includes(t)) {
        this.fome = clamp(this.fome - 14, 0, 130);
        this.comerCd = 2200;
      }
    }
    // Colher de fazenda proxima.
    const fazenda = ctx.estruturas?.efeitoPerto(this.xTile, this.yTile, "comida");
    if (fazenda && this.fome > 50 && this.comerCd <= 0) {
      const q = fazenda.colher();
      if (q > 0) { this.inventario.comida += q; this.comerCd = 1800; }
    }

    // Descanso: parado perto de abrigo recupera energia.
    if (parado) {
      const abrigo = ctx.estruturas?.efeitoPerto(this.xTile, this.yTile, "descanso");
      const fogo = ctx.estruturas?.efeitoPerto(this.xTile, this.yTile, "calor");
      const naAldeia = distanciaTiles(this, { x: 64, y: 60 }) < 6;
      const ganho = abrigo ? 9 : (naAldeia || fogo ? 6 : 2.4);
      this.energia = clamp(this.energia + ganho * seg, 0, 100);
    }

    // Saude: dano quando estoura, regenera quando tudo ok.
    if (this.fome >= 100 || this.sede >= 100) {
      const fator = (this.fome >= 100 ? 1 : 0) + (this.sede >= 100 ? 1 : 0);
      this.saude = clamp(this.saude - BALANCE.saudeDanoPorSeg * fator * seg, 0, 100);
      if (!this._avisouFraqueza) {
        this.lembrar(this.sede >= 100 ? "Estou desidratando." : "Estou passando fome.");
        this._avisouFraqueza = true;
      }
    } else {
      this._avisouFraqueza = false;
      if (this.fome < 72 && this.sede < 72 && this.energia > 14) {
        this.saude = clamp(this.saude + BALANCE.saudeRegenPorSeg * seg, 0, 100);
      }
    }

    if (this.saude <= 0) { this.morrer(); evento = `${this.nome} nao resistiu e morreu.`; }
    return evento;
  }

  // ---- CRAFTING ----------------------------------------------------------
  podeCraftar(toolId) {
    const f = FERRAMENTAS[toolId];
    return f && !this.ferramentas.has(toolId) && podePagar(this.inventario, f.custo);
  }

  craftar(toolId) {
    const f = FERRAMENTAS[toolId];
    if (!f || this.ferramentas.has(toolId) || !podePagar(this.inventario, f.custo)) return false;
    pagar(this.inventario, f.custo);
    this.ferramentas.add(toolId);
    this.adicionarConhecimento(`sei fabricar ${f.nome.toLowerCase()}`);
    return true;
  }

  bonusColeta(recurso) {
    let b = 0;
    for (const id of this.ferramentas) {
      const f = FERRAMENTAS[id];
      if (recurso === "madeira") b += f.bonusMadeira || 0;
      if (recurso === "pedra") b += f.bonusPedra || 0;
      if (recurso === "comida") b += f.bonusCaca || 0;
    }
    return b;
  }

  bonusAtaque() {
    let melhor = 0;
    for (const id of this.ferramentas) {
      melhor = Math.max(melhor, FERRAMENTAS[id].bonusAtaque || 0);
    }
    return melhor;
  }

  temArma() {
    return [...this.ferramentas].some(id => (FERRAMENTAS[id].bonusAtaque || 0) >= 10);
  }

  // ---- COMBATE -----------------------------------------------------------
  forcaCombate() {
    return this.saude * 0.4 + this.energia * 0.2 + this.coragem * 0.15 + this.bonusAtaque() + this.agressividade * 0.1;
  }

  atacar(alvo, motivo = "disputa") {
    const dano = clamp(Math.round(6 + this.bonusAtaque() + this.agressividade * 0.12 + aleatorio(0, 6)), 4, 60);
    alvo.receberDano(dano, `ataque de ${this.nome}`);
    this.ajustarRelacao(alvo.nome, -16);
    alvo.ajustarRelacao(this.nome, -24);
    this.energia = clamp(this.energia - 6, 0, 100);
    this.lembrar(`Ataquei ${alvo.nome} (${motivo}).`);
    this.scene.tweens.add({ targets: this.sprite, x: this.sprite.x + (alvo.sprite.x > this.sprite.x ? 8 : -8), duration: 90, yoyo: true });
    return dano;
  }

  // ---- OBSERVACAO / COLETA ----------------------------------------------
  observarLocal(local) {
    if (!local) return null;
    if (!this.mapaConhecido.includes(local.id)) this.mapaConhecido.push(local.id);

    let resultado = "";
    switch (local.tipo) {
      case "agua":
        this.sede = Math.max(0, this.sede - 50);
        resultado = "bebi e matei minha sede";
        this.adicionarConhecimento("rios e lagos fornecem agua");
        break;
      case "floresta": {
        const mad = aleatorio(1, 2) + this.bonusColeta("madeira");
        this.inventario.madeira += mad;
        if (Math.random() < 0.5) { this.inventario.comida += 1; this.fome = Math.max(0, this.fome - 16); }
        resultado = `juntei ${mad} madeira na floresta`;
        this.adicionarConhecimento("floresta da madeira e frutos");
        break;
      }
      case "moradia":
        this.energia = Math.min(100, this.energia + 30);
        resultado = "descansei na aldeia segura";
        this.adicionarConhecimento("aldeia e segura para descansar");
        break;
      case "campo": {
        const c = aleatorio(1, 2) + this.bonusColeta("comida");
        this.inventario.comida += c;
        this.fome = Math.max(0, this.fome - 12);
        resultado = `colhi ${c} comida no campo`;
        this.adicionarConhecimento("campos tem sementes e plantas");
        break;
      }
      case "pedras": {
        const p = aleatorio(1, 2) + this.bonusColeta("pedra");
        this.inventario.pedra += p;
        resultado = `extrai ${p} pedra`;
        this.adicionarConhecimento("pedreiras dao pedra");
        break;
      }
      case "montanha": {
        const p = aleatorio(2, 3) + this.bonusColeta("pedra");
        this.inventario.pedra += p;
        resultado = `minerei ${p} pedra na montanha`;
        this.adicionarConhecimento("montanhas tem minerio e pedra");
        break;
      }
      case "colina":
        resultado = "observei o terreno do alto";
        this.adicionarConhecimento("colinas ajudam a ver rotas");
        break;
      case "deserto":
        this.sede = Math.min(130, this.sede + 6);
        resultado = "o deserto e seco e quase sem recursos";
        this.adicionarConhecimento("desertos sao perigosos e secos");
        break;
      case "neve":
        this.energia = Math.max(0, this.energia - 6);
        resultado = "o frio da neve cansa";
        break;
      case "ruinas": {
        const r = escolher(["madeira", "pedra", "comida"]);
        this.inventario[r] += aleatorio(1, 3);
        resultado = `vasculhei ruinas e achei ${r}`;
        this.adicionarConhecimento("ruinas escondem recursos antigos");
        break;
      }
      default:
        resultado = "observei o ambiente";
    }

    this.pensamento = resultado;
    this.objetivoAtual = `observar ${local.nome}`;
    this.lembrar(resultado);
    this.registrarAcao({ categoria: "exploracao", acao: `observei ${local.nome}`, motivo: resultado });
    return resultado;
  }

  coletarNoTile(mundo) {
    const recurso = mundo.recursoDoTile(this.xTile, this.yTile);
    if (!recurso) return null;
    const q = aleatorio(1, 2) + this.bonusColeta(recurso);
    this.inventario[recurso] += q;
    if (recurso === "comida") this.fome = Math.max(0, this.fome - 10);
    const txt = `coletei ${q} ${recurso}`;
    this.lembrar(txt);
    return txt;
  }

  explorarAoRedor(mundo) {
    this.marcarTilesConhecidosAoRedor(this.xTile, this.yTile, 2);
    mundo.locais.forEach(local => {
      const perto = distanciaTiles({ x: this.xTile, y: this.yTile }, local) <= 3.4;
      if (perto && !this.mapaConhecido.includes(local.id)) {
        this.mapaConhecido.push(local.id);
        this.lembrar(`Descobri ${local.nome}.`);
        this.pensamento = `Descobri ${local.nome}.`;
      }
    });
  }

  marcarTilesConhecidosAoRedor(x, y, raio) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        this.tilesConhecidos.add(chaveTile(x + dx, y + dy));
      }
    }
  }

  // ---- SOCIAL ------------------------------------------------------------
  conversarCom(outro, fala) {
    this.cooldownConversa = aleatorio(5000, 9500);
    this.tempoConversa = 3000;
    this.parConversa = outro.nome;
    this.pensamento = `Conversei com ${outro.nome}: ${fala}`;
    this.lembrar(`Conversei com ${outro.nome}: ${fala}`);
    this.ajustarRelacao(outro.nome, 4);
    this.falar(fala);
  }

  registrarAcao(acao) {
    this.historicoAcoes.push({
      categoria: acao.categoria || "acao",
      acao: acao.acao || "agir",
      motivo: acao.motivo || "",
      dia: acao.dia || null
    });
    if (this.historicoAcoes.length > 18) this.historicoAcoes.shift();
  }

  relacaoCom(nome) { return this.relacoes[nome] ?? 0; }
  ajustarRelacao(nome, delta) { this.relacoes[nome] = clamp(this.relacaoCom(nome) + delta, -100, 100); }
  amaMais() {
    return Object.entries(this.relacoes).filter(([, v]) => v >= 45).map(([n]) => n);
  }
  odiaMais() {
    return Object.entries(this.relacoes).filter(([, v]) => v <= -45).map(([n]) => n);
  }

  receberDano(valor, motivo = "conflito") {
    this.saude = clamp(this.saude - Math.max(0, valor), 0, 100);
    this.pensamento = `Sofri dano de ${motivo}.`;
    this.lembrar(this.pensamento);
    this.scene.tweens.add({ targets: this.visual, alpha: 0.4, duration: 90, yoyo: true });
    if (this.saude <= 0) this.morrer();
  }

  ajustarNecessidade(chave, delta) {
    if (!["fome", "sede", "energia", "saude", "moral"].includes(chave)) return;
    const max = chave === "saude" || chave === "energia" || chave === "moral" ? 100 : 130;
    this[chave] = clamp(this[chave] + delta, 0, max);
  }

  falar(texto, duracao = 3200) {
    if (this.bolha) { this.bolha.destroy(); this.bolha = null; }
    const bolha = this.scene.add.container(0, -94);
    const label = this.scene.add.text(0, 0, texto, {
      fontFamily: "Arial", fontSize: "12px", fontStyle: "700",
      color: "#202018", align: "center", wordWrap: { width: 154 }
    });
    label.setOrigin(0.5);
    const largura = Math.max(94, Math.min(176, label.width + 24));
    const altura = Math.max(34, label.height + 18);
    const fundo = this.scene.add.graphics();
    fundo.fillStyle(0xfff4c0, 0.96);
    fundo.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 8);
    fundo.fillTriangle(-9, altura / 2 - 2, 10, altura / 2 - 2, 0, altura / 2 + 10);
    fundo.lineStyle(1, 0x2c2a20, 0.16);
    fundo.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 8);
    bolha.add([fundo, label]);
    bolha.alpha = 0;
    this.sprite.add(bolha);
    this.bolha = bolha;
    this.scene.tweens.add({ targets: bolha, alpha: 1, y: -102, duration: 200, ease: "Sine.out" });
    this.scene.time.delayedCall(duracao, () => {
      if (this.bolha !== bolha) return;
      this.scene.tweens.add({
        targets: bolha, alpha: 0, y: -112, duration: 240, ease: "Sine.in",
        onComplete: () => { bolha.destroy(); if (this.bolha === bolha) this.bolha = null; }
      });
    });
  }


  emojiEstado() {
    if (!this.vivo) return "💀";
    if (this.acaoPendente?.tarefa) {
      const mapa = {
        beber: "💧", comer: "🍖", coletar: "🪵", construir: "🏠", craftar: "🛠️",
        cacar: "🏹", atacar: "⚔️", descansar: "😴", socializar: "💬", explorar: "🧭", observar: "👁️"
      };
      return mapa[this.acaoPendente.tarefa] || "✨";
    }
    if (this.tempoConversa > 0) return "💬";
    if (this.sede > 76) return "💧";
    if (this.fome > 76) return "🍖";
    if (this.energia < 30) return "😴";
    if (this.caminho.length) return "🚶";
    return "👁️";
  }

  atualizarIndicadores() {
    if (!this.statusIcon) return;
    const emoji = this.emojiEstado();
    if (emoji === this._statusIconAtual) return;
    this._statusIconAtual = emoji;
    this.statusIcon.setText(emoji);
  }

  mostrarPulso(emoji = "✨") {
    if (!this.vivo) return;
    const pulso = this.scene.add.text(0, -118, emoji, {
      fontFamily: "Arial", fontSize: "24px", color: "#fff8df"
    });
    pulso.setOrigin(0.5);
    this.sprite.add(pulso);
    this.scene.tweens.add({
      targets: pulso, y: -142, alpha: 0, scale: 1.35,
      duration: 850, ease: "Sine.out",
      onComplete: () => pulso.destroy()
    });
  }

  mostrarMarcadorDestino(tile, mundo) {
    this.limparMarcadorDestino();
    if (!tile || !mundo) return;
    const pos = mundo.posicaoHabitante(tile.x, tile.y);
    const g = this.scene.add.graphics();
    g.lineStyle(3, this.corTribo(), 0.68);
    g.strokeEllipse(pos.x, pos.y - 4, 54, 22);
    g.setDepth(pos.y + 9990);
    this.marcadorDestino = g;
    this.scene.tweens.add({
      targets: g, alpha: { from: 0.25, to: 0.95 },
      duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut"
    });
  }

  limparMarcadorDestino() {
    if (!this.marcadorDestino) return;
    this.marcadorDestino.destroy();
    this.marcadorDestino = null;
  }

  podeConversarCom(outro) {
    return this.vivo && outro.vivo
      && this.cooldownConversa <= 0 && outro.cooldownConversa <= 0
      && (this.sociabilidade + outro.sociabilidade) > 70;
  }

  estadoAtual() {
    if (!this.vivo) return "Morto";
    if (this.acaoPendente?.acao) return this.acaoPendente.acao;
    if (this.tempoConversa > 0 && this.parConversa) return `Conversando com ${this.parConversa}`;
    if (this.caminho.length) return "Caminhando";
    if (this.sede > 80) return "Com sede";
    if (this.fome > 80) return "Com fome";
    if (this.energia < 26) return "Exausto";
    return "Observando";
  }

  descricaoLocal(mundo) { return mundo.descreverTile(this.xTile, this.yTile); }

  adicionarConhecimento(conhecimento) {
    if (!this.conhecimentos.includes(conhecimento)) this.conhecimentos.push(conhecimento);
    if (this.conhecimentos.length > 22) this.conhecimentos.shift();
  }

  lembrar(texto) {
    this.memorias.push(texto);
    if (this.memorias.length > 16) this.memorias.shift();
  }

  setSelecionado(selecionado) {
    this.selecao.setVisible(selecionado);
    this.nomeLabel.setColor(selecionado ? "#f6dc7c" : "#fff8df");
  }

  morrer() {
    if (!this.vivo) return;
    this.vivo = false;
    this.sprite.setAlpha(0.28);
    this.caminho = [];
    this.acaoPendente = null;
    this.limparMarcadorDestino();
    this.pensamento = "Morreu.";
    this.objetivoAtual = "sem atividade";
  }

  // ---- SAVE --------------------------------------------------------------
  toJSON() {
    return {
      nome: this.nome, tribo: this.tribo, idade: this.idade, textura: this.textura,
      fome: this.fome, sede: this.sede, energia: this.energia, saude: this.saude, moral: this.moral,
      vivo: this.vivo, personalidade: this.personalidade,
      curiosidade: this.curiosidade, coragem: this.coragem,
      sociabilidade: this.sociabilidade, agressividade: this.agressividade,
      xTile: this.xTile, yTile: this.yTile,
      inventario: this.inventario, ferramentas: [...this.ferramentas],
      relacoes: this.relacoes, conhecimentos: this.conhecimentos,
      mapaConhecido: this.mapaConhecido, memorias: this.memorias,
      pensamento: this.pensamento, objetivoAtual: this.objetivoAtual
    };
  }

  aplicarEstado(d) {
    Object.assign(this, {
      idade: d.idade, fome: d.fome, sede: d.sede, energia: d.energia, saude: d.saude,
      moral: d.moral ?? 60, personalidade: d.personalidade,
      curiosidade: d.curiosidade, coragem: d.coragem, sociabilidade: d.sociabilidade,
      agressividade: d.agressividade ?? 40,
      inventario: d.inventario || this.inventario,
      relacoes: d.relacoes || {}, conhecimentos: d.conhecimentos || this.conhecimentos,
      mapaConhecido: d.mapaConhecido || this.mapaConhecido, memorias: d.memorias || [],
      pensamento: d.pensamento || this.pensamento, objetivoAtual: d.objetivoAtual || this.objetivoAtual
    });
    this.ferramentas = new Set(d.ferramentas || []);
    if (d.vivo === false) this.morrer();
  }
}
