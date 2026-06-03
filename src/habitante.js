import { HABITANTE_TEXTURES } from "./assets.js";
import { aleatorio, chaveTile, escolher, clamp, distanciaTiles } from "./utils.js";

export class Habitante {
  constructor(scene, nome, x, y) {
    this.scene = scene;

    this.nome = nome;
    this.idade = aleatorio(16, 35);

    this.fome = aleatorio(10, 45);
    this.sede = aleatorio(10, 45);
    this.energia = aleatorio(60, 100);
    this.saude = 100;

    this.vivo = true;

    this.personalidade = escolher([
      "curioso e bondoso",
      "ambicioso e corajoso",
      "calmo e observador",
      "criativo e sociavel",
      "desconfiado e independente"
    ]);

    this.curiosidade = aleatorio(40, 100);
    this.coragem = aleatorio(30, 100);
    this.sociabilidade = aleatorio(20, 100);

    this.pensamento = "Estou comecando a entender este mundo.";
    this.objetivoAtual = "observar o ambiente";

    this.memorias = [];
    this.conhecimentos = [
      "agua reduz sede",
      "descansar recupera energia",
      "observar ajuda a aprender"
    ];

    this.mapaConhecido = ["aldeia_inicial"];
    this.tilesConhecidos = new Set();

    this.xTile = x;
    this.yTile = y;
    this.destinoTile = null;
    this.destinoLocalId = null;
    this.deveObservarDestino = false;
    this.chegadaPendente = false;
    this.caminho = [];

    this.velocidade = aleatorio(62, 84);
    this.tempoOcioso = 0;
    this.proximoPasseioEm = aleatorio(1600, 3800);
    this.cooldownConversa = aleatorio(1000, 4200);
    this.tempoConversa = 0;
    this.parConversa = "";
    this.bolha = null;

    this.textura = escolher(HABITANTE_TEXTURES);
    this.sprite = this.criarSprite(x, y);
    this.marcarTilesConhecidosAoRedor(x, y, 2);
  }

  criarSprite(x, y) {
    const pos = this.posicaoInicial(x, y);
    const container = this.scene.add.container(pos.x, pos.y);

    this.selecao = this.scene.add.graphics();
    this.selecao.lineStyle(3, 0xf3d56b, 0.95);
    this.selecao.strokeEllipse(0, -6, 58, 23);
    this.selecao.setVisible(false);

    this.visualBaseScale = 0.72;
    this.visual = this.scene.add.image(0, 0, this.textura);
    this.visual.setOrigin(0.5, 1);
    this.visual.setScale(this.visualBaseScale);

    this.nomeLabel = this.scene.add.text(0, -76, this.nome, {
      fontFamily: "Arial",
      fontSize: "12px",
      fontStyle: "700",
      color: "#fff8df",
      align: "center"
    });
    this.nomeLabel.setOrigin(0.5);
    this.nomeLabel.setShadow(0, 2, "#000000", 3, true, true);

    container.add([this.selecao, this.visual, this.nomeLabel]);
    container.setSize(58, 92);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-29, -92, 58, 98),
      Phaser.Geom.Rectangle.Contains
    );
    container.setDepth(pos.y + 110);

    this.scene.tweens.add({
      targets: this.visual,
      y: { from: 0, to: -4 },
      duration: aleatorio(760, 1040),
      delay: aleatorio(0, 400),
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut"
    });

    return container;
  }

  posicaoInicial(x, y) {
    return this.scene.mundo?.posicaoHabitante(x, y) ?? { x: 0, y: 0 };
  }

  mover(mundo, aoChegar, delta) {
    if (!this.vivo) return;

    this.atualizarRelogios(delta);

    if (this.chegadaPendente) {
      this.chegadaPendente = false;
      if (this.deveObservarDestino) {
        this.deveObservarDestino = false;
        aoChegar(this);
      }
      return;
    }

    if (!this.caminho.length) {
      this.tempoOcioso += delta;

      if (this.tempoOcioso > this.proximoPasseioEm) {
        this.iniciarExploracaoLivre(mundo);
      }

      return;
    }

    const proximo = this.caminho[0];
    const alvo = mundo.posicaoHabitante(proximo.x, proximo.y);
    const dx = alvo.x - this.sprite.x;
    const dy = alvo.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const passo = this.velocidade * (delta / 1000);

    this.tempoOcioso = 0;

    if (dist <= passo) {
      this.sprite.x = alvo.x;
      this.sprite.y = alvo.y;
      this.xTile = proximo.x;
      this.yTile = proximo.y;
      this.caminho.shift();
      this.explorarAoRedor(mundo);

      if (!this.caminho.length) {
        this.finalizarMovimento(aoChegar);
      }
    } else {
      this.sprite.x += (dx / dist) * passo;
      this.sprite.y += (dy / dist) * passo;
      this.visual.setScale(dx < 0 ? -this.visualBaseScale : this.visualBaseScale, this.visualBaseScale);
    }

    this.sprite.setDepth(this.sprite.y + 120);
  }

  atualizarRelogios(delta) {
    this.cooldownConversa = Math.max(0, this.cooldownConversa - delta);
    this.tempoConversa = Math.max(0, this.tempoConversa - delta);

    if (this.tempoConversa === 0) {
      this.parConversa = "";
    }
  }

  finalizarMovimento(aoChegar) {
    this.destinoTile = null;
    this.proximoPasseioEm = aleatorio(1400, 4200);

    if (this.deveObservarDestino) {
      this.deveObservarDestino = false;
      aoChegar(this);
      return;
    }

    this.objetivoAtual = "observando o terreno";
    this.pensamento = "Estou olhando ao redor antes de escolher outro caminho.";
  }

  iniciarExploracaoLivre(mundo) {
    const alvo = this.curiosidade > 58
      ? mundo.escolherTileExploracao(this)
      : mundo.escolherTileLivreProximo(this.xTile, this.yTile, aleatorio(3, 9));

    if (!alvo) return;

    const tipo = mundo.descreverTile(alvo.x, alvo.y);
    this.definirDestinoTile(alvo, mundo, `explorar ${tipo}`, null, false);
    this.pensamento = `Quero circular livremente e entender melhor o terreno de ${tipo}.`;
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
      this.lembrar(this.pensamento);
      return false;
    }

    this.caminho = caminho.slice(1);
    this.destinoTile = tile;
    this.destinoLocalId = localId;
    this.deveObservarDestino = deveObservar;
    this.objetivoAtual = objetivo;
    this.tempoOcioso = 0;
    this.proximoPasseioEm = aleatorio(1800, 4200);

    if (!this.caminho.length) {
      this.chegadaPendente = true;
    }

    return true;
  }

  passarNecessidades() {
    this.fome = clamp(this.fome + aleatorio(5, 12), 0, 120);
    this.sede = clamp(this.sede + aleatorio(5, 12), 0, 120);
    this.energia = clamp(this.energia - aleatorio(4, 10), 0, 100);

    if (this.fome > 95) {
      this.saude -= 10;
      this.lembrar("Senti dor por causa da fome.");
    }

    if (this.sede > 95) {
      this.saude -= 12;
      this.lembrar("Senti fraqueza por causa da sede.");
    }

    if (this.energia <= 0) {
      this.saude -= 5;
    }

    if (this.saude <= 0) {
      this.morrer();
    }
  }

  observarLocal(local) {
    if (!local) return null;

    if (!this.mapaConhecido.includes(local.id)) {
      this.mapaConhecido.push(local.id);
    }

    let resultado = "";

    if (local.tipo === "agua") {
      this.sede = Math.max(0, this.sede - 45);
      resultado = "aprendi que esta agua mata minha sede";
      this.adicionarConhecimento("rio e lago fornecem agua");
    }

    if (local.tipo === "floresta") {
      if (Math.random() < 0.55) {
        this.fome = Math.max(0, this.fome - 25);
        resultado = "encontrei frutos na floresta";
        this.adicionarConhecimento("floresta pode ter comida");
      } else {
        resultado = "percebi que arvores podem fornecer madeira";
        this.adicionarConhecimento("arvores fornecem madeira");
      }
    }

    if (local.tipo === "moradia") {
      this.energia = Math.min(100, this.energia + 35);
      resultado = "percebi que a aldeia e segura para descansar";
      this.adicionarConhecimento("aldeia e segura");
    }

    if (local.tipo === "campo") {
      resultado = "observei plantas crescendo na terra";
      this.adicionarConhecimento("plantas crescem na terra");
    }

    if (local.tipo === "pedras") {
      resultado = "percebi que pedras podem virar ferramentas";
      this.adicionarConhecimento("pedras podem virar ferramentas");
    }

    if (local.tipo === "colina") {
      resultado = "vi o terreno de longe e entendi melhor o mapa";
      this.adicionarConhecimento("colinas ajudam a observar rotas");
    }

    this.pensamento = resultado;
    this.objetivoAtual = `observar ${local.nome}`;
    this.lembrar(resultado);

    return resultado;
  }

  explorarAoRedor(mundo) {
    this.marcarTilesConhecidosAoRedor(this.xTile, this.yTile, 2);

    mundo.locais.forEach(local => {
      const perto = distanciaTiles({ x: this.xTile, y: this.yTile }, local) <= 3.2;

      if (perto && !this.mapaConhecido.includes(local.id)) {
        this.mapaConhecido.push(local.id);
        this.lembrar(`Descobri ${local.nome} ao explorar perto.`);
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

  conversarCom(outro, fala) {
    this.cooldownConversa = aleatorio(6500, 11500);
    this.tempoConversa = 3200;
    this.parConversa = outro.nome;
    this.pensamento = `Conversei com ${outro.nome}: ${fala}`;
    this.lembrar(`Conversei com ${outro.nome}: ${fala}`);
    this.falar(fala);
  }

  falar(texto, duracao = 3400) {
    if (this.bolha) {
      this.bolha.destroy();
      this.bolha = null;
    }

    const bolha = this.scene.add.container(0, -96);
    const label = this.scene.add.text(0, 0, texto, {
      fontFamily: "Arial",
      fontSize: "12px",
      fontStyle: "700",
      color: "#202018",
      align: "center",
      wordWrap: { width: 154 }
    });

    label.setOrigin(0.5);

    const largura = Math.max(94, Math.min(176, label.width + 24));
    const altura = Math.max(34, label.height + 18);
    const fundo = this.scene.add.graphics();

    fundo.fillStyle(0xfff4c0, 0.96);
    fundo.fillRoundedRect(-largura / 2, -altura / 2, largura, altura, 8);
    fundo.fillStyle(0xfff4c0, 0.96);
    fundo.fillTriangle(-9, altura / 2 - 2, 10, altura / 2 - 2, 0, altura / 2 + 10);
    fundo.lineStyle(1, 0x2c2a20, 0.16);
    fundo.strokeRoundedRect(-largura / 2, -altura / 2, largura, altura, 8);

    bolha.add([fundo, label]);
    bolha.alpha = 0;
    this.sprite.add(bolha);
    this.bolha = bolha;

    this.scene.tweens.add({
      targets: bolha,
      alpha: 1,
      y: -104,
      duration: 220,
      ease: "Sine.out"
    });

    this.scene.time.delayedCall(duracao, () => {
      if (this.bolha !== bolha) return;

      this.scene.tweens.add({
        targets: bolha,
        alpha: 0,
        y: -114,
        duration: 260,
        ease: "Sine.in",
        onComplete: () => {
          bolha.destroy();
          if (this.bolha === bolha) this.bolha = null;
        }
      });
    });
  }

  podeConversarCom(outro) {
    return this.vivo
      && outro.vivo
      && this.cooldownConversa <= 0
      && outro.cooldownConversa <= 0
      && (this.sociabilidade + outro.sociabilidade) > 75;
  }

  estadoAtual() {
    if (!this.vivo) return "Morto";
    if (this.tempoConversa > 0 && this.parConversa) return `Conversando com ${this.parConversa}`;
    if (this.caminho.length) return "Caminhando";
    if (this.sede > 82) return "Precisa de agua";
    if (this.fome > 82) return "Procurando comida";
    if (this.energia < 28) return "Quer descansar";
    return "Observando";
  }

  descricaoLocal(mundo) {
    return mundo.descreverTile(this.xTile, this.yTile);
  }

  adicionarConhecimento(conhecimento) {
    if (!this.conhecimentos.includes(conhecimento)) {
      this.conhecimentos.push(conhecimento);
    }
  }

  lembrar(texto) {
    this.memorias.push(texto);

    if (this.memorias.length > 14) {
      this.memorias.shift();
    }
  }

  setSelecionado(selecionado) {
    this.selecao.setVisible(selecionado);
    this.nomeLabel.setColor(selecionado ? "#f6dc7c" : "#fff8df");
  }

  morrer() {
    this.vivo = false;
    this.sprite.setAlpha(0.28);
    this.pensamento = "Morreu.";
    this.objetivoAtual = "sem atividade";
  }
}
