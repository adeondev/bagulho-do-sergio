import { MAP_H, MAP_W, TILE_H, TILE_W } from "./config.js";
import { aleatorio, chaveTile, escolher, distanciaTiles, iso, telaParaTile } from "./utils.js";

const TIPO_TILE_NOME = {
  agua: "agua",
  areia: "margem",
  floresta: "floresta",
  campo: "campo",
  pedras: "pedras",
  colina: "colina",
  grama: "grama"
};

export class Mundo {
  constructor(scene) {
    this.scene = scene;
    this.dia = 1;
    this.tiles = new Map();

    this.locais = [
      {
        id: "aldeia_inicial",
        nome: "Aldeia Inicial",
        x: 12,
        y: 14,
        tipo: "moradia",
        descricao: "casas protegidas onde os primeiros habitantes descansam"
      },
      {
        id: "rio_oeste",
        nome: "Rio Oeste",
        x: 6,
        y: 16,
        tipo: "agua",
        descricao: "margem de rio com agua corrente"
      },
      {
        id: "floresta_norte",
        nome: "Floresta Norte",
        x: 24,
        y: 7,
        tipo: "floresta",
        descricao: "arvores altas, sombra, madeira, frutos e animais pequenos"
      },
      {
        id: "campo_sul",
        nome: "Campo Sul",
        x: 18,
        y: 22,
        tipo: "campo",
        descricao: "terra aberta com plantas baixas, sementes e boa visibilidade"
      },
      {
        id: "pedras_antigas",
        nome: "Pedras Antigas",
        x: 28,
        y: 17,
        tipo: "pedras",
        descricao: "rochas expostas que podem virar ferramentas ou abrigo"
      },
      {
        id: "colina_do_vento",
        nome: "Colina do Vento",
        x: 8,
        y: 7,
        tipo: "colina",
        descricao: "terreno alto onde da para observar o mapa de longe"
      },
      {
        id: "clareira_leste",
        nome: "Clareira Leste",
        x: 29,
        y: 10,
        tipo: "floresta",
        descricao: "abertura clara entre arvores densas"
      },
      {
        id: "lago_sul",
        nome: "Lago Sul",
        x: 23,
        y: 25,
        tipo: "agua",
        descricao: "agua calma cercada por margem segura"
      }
    ];
  }

  desenhar() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        this.desenharTile(x, y);
      }
    }

    this.desenharCasas();
    this.desenharMarcadoresLocais();
  }

  tipoTile(x, y) {
    const lagoSul = ((x - 23) ** 2) / 18 + ((y - 26) ** 2) / 9;
    const rioX = 4 + Math.floor(y / 5);
    const pertoRio = Math.abs(x - rioX);

    if (y > 20 && lagoSul < 1) return "agua";
    if (y > 19 && lagoSul < 1.45) return "areia";

    if (y > 4 && y < 24 && pertoRio === 0) return "agua";
    if (y > 4 && y < 24 && pertoRio === 1) return "areia";

    if (x > 21 && y < 13) return "floresta";
    if (x > 26 && y < 18) return "floresta";
    if (x > 14 && x < 23 && y > 18 && y < 25) return "campo";
    if (x > 25 && y > 14 && y < 22) return "pedras";
    if (x < 12 && y < 10) return "colina";

    return "grama";
  }

  desenharTile(x, y) {
    const pos = iso(x, y);
    const tipo = this.tipoTile(x, y);
    const tile = this.scene.add.image(pos.x, pos.y, `tile-${tipo}`);

    tile.setOrigin(0.5, 0.5);
    tile.setDepth(pos.y);
    this.tiles.set(chaveTile(x, y), { x, y, tipo, walkable: this.isWalkable(x, y) });

    if (tipo === "agua" && Math.random() < 0.45) {
      this.scene.tweens.add({
        targets: tile,
        alpha: { from: 0.78, to: 1 },
        duration: aleatorio(1200, 2200),
        delay: aleatorio(0, 1200),
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut"
      });
    }

    if (tipo === "floresta" && Math.random() < 0.5) {
      this.criarArvore(pos.x, pos.y + 3, Math.random() < 0.5 ? "arvore-a" : "arvore-b");
    }

    if (tipo === "pedras" && Math.random() < 0.38) {
      this.criarPedra(pos.x, pos.y + 3);
    }
  }

  criarArvore(x, y, textura) {
    const arvore = this.scene.add.image(x, y - 2, textura);

    arvore.setOrigin(0.5, 1);
    arvore.setDepth(y + 80);
    arvore.setScale(aleatorio(86, 112) / 100);

    this.scene.tweens.add({
      targets: arvore,
      rotation: { from: -0.018, to: 0.018 },
      duration: aleatorio(1800, 3200),
      delay: aleatorio(0, 1600),
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut"
    });
  }

  criarPedra(x, y) {
    const pedra = this.scene.add.image(x, y - 1, "pedra-a");

    pedra.setOrigin(0.5, 0.92);
    pedra.setDepth(y + 52);
    pedra.setScale(aleatorio(72, 104) / 100);
  }

  desenharCasas() {
    const casas = [
      { x: 11, y: 14, textura: "casa-a" },
      { x: 13, y: 14, textura: "casa-b" },
      { x: 12, y: 15, textura: "casa-a" },
      { x: 10, y: 15, textura: "casa-b" },
      { x: 14, y: 15, textura: "casa-a" }
    ];

    casas.forEach(casa => {
      const pos = iso(casa.x, casa.y);
      const sprite = this.scene.add.image(pos.x, pos.y + 10, casa.textura);

      sprite.setOrigin(0.5, 1);
      sprite.setDepth(pos.y + 95);
      sprite.setScale(0.9);
    });
  }

  desenharMarcadoresLocais() {
    this.locais.forEach(local => {
      const pos = iso(local.x, local.y);
      const grupo = this.scene.add.container(pos.x, pos.y - 62);
      const texto = this.scene.add.text(0, 0, local.nome, {
        fontFamily: "Arial",
        fontSize: "12px",
        fontStyle: "700",
        color: "#f8f6e8",
        align: "center"
      });

      texto.setOrigin(0.5);
      texto.setShadow(0, 2, "#000000", 3, true, true);

      const largura = Math.max(80, texto.width + 20);
      const fundo = this.scene.add.graphics();

      fundo.fillStyle(0x111417, 0.78);
      fundo.fillRoundedRect(-largura / 2, -13, largura, 26, 8);
      fundo.lineStyle(1, 0xffffff, 0.18);
      fundo.strokeRoundedRect(-largura / 2, -13, largura, 26, 8);
      grupo.add([fundo, texto]);
      grupo.setDepth(pos.y + 170);
    });
  }

  buscarLocalPorId(id) {
    return this.locais.find(local => local.id === id);
  }

  locaisVisiveisPara(habitante) {
    return this.locais.map(local => {
      const conhecido = habitante.mapaConhecido.includes(local.id);

      return {
        id: local.id,
        nome: conhecido ? local.nome : "Lugar desconhecido",
        x: local.x,
        y: local.y,
        tipo: conhecido ? local.tipo : "desconhecido",
        descricao: conhecido ? local.descricao : "local ainda nao compreendido"
      };
    });
  }

  localMaisProximoDaTela(screenX, screenY) {
    let melhor = null;
    let menor = Infinity;

    this.locais.forEach(local => {
      const pos = iso(local.x, local.y);
      const dx = pos.x - screenX;
      const dy = pos.y - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < menor) {
        menor = dist;
        melhor = local;
      }
    });

    return menor < 64 ? melhor : null;
  }

  dentroMapa(x, y) {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  }

  isWalkable(x, y) {
    if (!this.dentroMapa(x, y)) return false;
    return this.tipoTile(x, y) !== "agua";
  }

  custoTile(x, y) {
    const tipo = this.tipoTile(x, y);
    const custos = {
      grama: 1,
      areia: 1.15,
      campo: 0.92,
      colina: 1.3,
      floresta: 1.48,
      pedras: 1.7
    };

    return custos[tipo] ?? 1;
  }

  vizinhos(tile) {
    const direcoes = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ];

    return direcoes
      .map(dir => ({ x: tile.x + dir.x, y: tile.y + dir.y, diagonal: Math.abs(dir.x) + Math.abs(dir.y) === 2 }))
      .filter(vizinho => {
        if (!this.isWalkable(vizinho.x, vizinho.y)) return false;

        if (vizinho.diagonal) {
          const dx = vizinho.x - tile.x;
          const dy = vizinho.y - tile.y;
          return this.isWalkable(tile.x + dx, tile.y) && this.isWalkable(tile.x, tile.y + dy);
        }

        return true;
      });
  }

  encontrarCaminho(inicio, destino) {
    const partida = this.tileValidoMaisProximo(inicio.x, inicio.y, 4);
    const alvo = this.tileValidoMaisProximo(destino.x, destino.y, 7);

    if (!partida || !alvo) return [];

    const aberta = [partida];
    const veioDe = new Map();
    const gScore = new Map([[chaveTile(partida.x, partida.y), 0]]);
    const fScore = new Map([[chaveTile(partida.x, partida.y), distanciaTiles(partida, alvo)]]);
    const fechada = new Set();

    while (aberta.length) {
      aberta.sort((a, b) => {
        const fa = fScore.get(chaveTile(a.x, a.y)) ?? Infinity;
        const fb = fScore.get(chaveTile(b.x, b.y)) ?? Infinity;
        return fa - fb;
      });

      const atual = aberta.shift();
      const atualKey = chaveTile(atual.x, atual.y);

      if (atual.x === alvo.x && atual.y === alvo.y) {
        return this.reconstruirCaminho(veioDe, atual);
      }

      fechada.add(atualKey);

      this.vizinhos(atual).forEach(vizinho => {
        const vizinhoKey = chaveTile(vizinho.x, vizinho.y);
        if (fechada.has(vizinhoKey)) return;

        const custoDiagonal = vizinho.diagonal ? 1.4 : 1;
        const gTentativo = (gScore.get(atualKey) ?? Infinity) + this.custoTile(vizinho.x, vizinho.y) * custoDiagonal;

        if (gTentativo >= (gScore.get(vizinhoKey) ?? Infinity)) return;

        veioDe.set(vizinhoKey, atual);
        gScore.set(vizinhoKey, gTentativo);
        fScore.set(vizinhoKey, gTentativo + distanciaTiles(vizinho, alvo));

        if (!aberta.some(item => item.x === vizinho.x && item.y === vizinho.y)) {
          aberta.push({ x: vizinho.x, y: vizinho.y });
        }
      });
    }

    return [];
  }

  reconstruirCaminho(veioDe, atual) {
    const caminho = [atual];
    let atualKey = chaveTile(atual.x, atual.y);

    while (veioDe.has(atualKey)) {
      atual = veioDe.get(atualKey);
      caminho.unshift(atual);
      atualKey = chaveTile(atual.x, atual.y);
    }

    return caminho;
  }

  tileValidoMaisProximo(x, y, raio = 5) {
    if (this.isWalkable(x, y)) return { x, y };

    let melhor = null;
    let menor = Infinity;

    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (!this.isWalkable(nx, ny)) continue;

        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < menor) {
          menor = dist;
          melhor = { x: nx, y: ny };
        }
      }
    }

    return melhor;
  }

  escolherTileAoRedorLocal(local, raio = 3) {
    const candidatos = [];

    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        const x = local.x + dx;
        const y = local.y + dy;

        if (this.isWalkable(x, y)) {
          candidatos.push({ x, y, dist: Math.abs(dx) + Math.abs(dy) });
        }
      }
    }

    if (!candidatos.length) return this.tileValidoMaisProximo(local.x, local.y, 8);

    const proximos = candidatos
      .filter(candidato => candidato.dist <= 2)
      .map(({ x, y }) => ({ x, y }));

    return escolher(proximos.length ? proximos : candidatos.map(({ x, y }) => ({ x, y })));
  }

  escolherTileLivreProximo(x, y, raio = 7) {
    const candidatos = [];

    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (this.isWalkable(nx, ny) && (dx !== 0 || dy !== 0)) {
          candidatos.push({ x: nx, y: ny });
        }
      }
    }

    return candidatos.length ? escolher(candidatos) : null;
  }

  escolherTileExploracao(habitante) {
    const desconhecidos = [];

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const key = chaveTile(x, y);
        if (this.isWalkable(x, y) && !habitante.tilesConhecidos.has(key)) {
          desconhecidos.push({ x, y });
        }
      }
    }

    if (!desconhecidos.length) {
      return this.escolherTileLivreProximo(habitante.xTile, habitante.yTile, aleatorio(4, 10));
    }

    const origem = { x: habitante.xTile, y: habitante.yTile };
    desconhecidos.sort((a, b) => distanciaTiles(a, origem) - distanciaTiles(b, origem));
    return escolher(desconhecidos.slice(0, Math.min(14, desconhecidos.length)));
  }

  posicaoHabitante(x, y) {
    const pos = iso(x, y);
    return { x: pos.x, y: pos.y - 20 };
  }

  tilePorTela(x, y) {
    return telaParaTile(x, y);
  }

  descreverTile(x, y) {
    return TIPO_TILE_NOME[this.tipoTile(x, y)] ?? "terreno";
  }

  limitesMundo() {
    const cantos = [
      iso(0, 0),
      iso(MAP_W - 1, 0),
      iso(0, MAP_H - 1),
      iso(MAP_W - 1, MAP_H - 1)
    ];

    const minX = Math.min(...cantos.map(p => p.x)) - TILE_W * 5;
    const maxX = Math.max(...cantos.map(p => p.x)) + TILE_W * 5;
    const minY = Math.min(...cantos.map(p => p.y)) - TILE_H * 5;
    const maxY = Math.max(...cantos.map(p => p.y)) + TILE_H * 7;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}
