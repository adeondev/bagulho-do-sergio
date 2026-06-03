import { MAP_H, MAP_W, TILE_H, TILE_W, CHUNK, ALDEIA_X, ALDEIA_Y } from "./config.js";
import {
  aleatorio, chaveTile, escolher, distanciaTiles, iso, telaParaTile,
  criarRng, ruidoFractal, ruido2d, capitalizar
} from "./utils.js";

const TIPO_TILE_NOME = {
  agua: "agua",
  areia: "margem",
  floresta: "floresta",
  campo: "campo",
  pedras: "pedras",
  colina: "colina",
  montanha: "montanha",
  deserto: "deserto",
  neve: "neve",
  terra: "trilha",
  grama: "grama"
};

// Heap minimo para o A* nao depender de sort() a cada passo (rapido em mapa grande).
class MinHeap {
  constructor() { this.itens = []; }
  get tamanho() { return this.itens.length; }
  inserir(no, prio) {
    this.itens.push({ no, prio });
    let i = this.itens.length - 1;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (this.itens[pai].prio <= this.itens[i].prio) break;
      [this.itens[pai], this.itens[i]] = [this.itens[i], this.itens[pai]];
      i = pai;
    }
  }
  remover() {
    const topo = this.itens[0];
    const ultimo = this.itens.pop();
    if (this.itens.length) {
      this.itens[0] = ultimo;
      let i = 0;
      const n = this.itens.length;
      while (true) {
        let menor = i;
        const e = 2 * i + 1;
        const d = 2 * i + 2;
        if (e < n && this.itens[e].prio < this.itens[menor].prio) menor = e;
        if (d < n && this.itens[d].prio < this.itens[menor].prio) menor = d;
        if (menor === i) break;
        [this.itens[menor], this.itens[i]] = [this.itens[i], this.itens[menor]];
        i = menor;
      }
    }
    return topo.no;
  }
}

export class Mundo {
  constructor(scene, seed = (Math.random() * 1e9) | 0) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.dia = 1;

    this.tipos = new Array(MAP_W * MAP_H);
    this.pontes = new Set();        // tiles atravessaveis sobre agua
    this.bloqueados = new Set();     // tiles ocupados por estruturas que bloqueiam
    this.chunks = [];
    this.riosPaths = [];

    this.gerarTerreno();
    this.gerarLocais();
  }

  idx(x, y) { return y * MAP_W + x; }

  // ---- GERACAO -----------------------------------------------------------
  gerarTerreno() {
    const rng = criarRng(this.seed);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const e = ruidoFractal(x * 0.05, y * 0.05, this.seed);
        const m = ruidoFractal((x + 240) * 0.045, (y + 240) * 0.045, this.seed + 777);
        this.tipos[this.idx(x, y)] = this.biomaDe(e, m, x, y);
      }
    }

    this.carvarRios(rng);
    this.aplicarMargens();
    this.limparAldeia();
    this.gerarPontes(rng);
  }

  biomaDe(e, m, x, y) {
    const temp = y / MAP_H; // 0 = norte (frio), 1 = sul (quente)

    if (e < 0.30) return "agua";
    if (e < 0.345) return "areia";
    if (e > 0.74) return temp < 0.32 ? "neve" : "montanha";
    if (e > 0.64) return "pedras";
    if (e > 0.57) return "colina";

    if (m < 0.34 && temp > 0.5) return "deserto";
    if (m > 0.60) return "floresta";
    if (m > 0.47) return "grama";
    if (m > 0.38) return "campo";
    return temp > 0.55 ? "deserto" : "grama";
  }

  carvarRios(rng) {
    const carvar = (x, y, raio) => {
      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (this.dentroMapa(nx, ny) && Math.abs(dx) + Math.abs(dy) <= raio) {
            this.tipos[this.idx(nx, ny)] = "agua";
          }
        }
      }
    };

    // Rio horizontal sinuoso.
    const yBase = MAP_H * (0.30 + rng() * 0.18);
    const pathH = [];
    for (let x = 0; x < MAP_W; x++) {
      const y = Math.round(yBase + Math.sin(x * 0.09) * 15 + Math.sin(x * 0.024 + 1.5) * 24);
      if (this.dentroMapa(x, y)) { carvar(x, y, 1); pathH.push({ x, y }); }
    }
    this.riosPaths.push(pathH);

    // Rio vertical sinuoso.
    const xBase = MAP_W * (0.42 + rng() * 0.16);
    const pathV = [];
    for (let y = 0; y < MAP_H; y++) {
      const x = Math.round(xBase + Math.sin(y * 0.08) * 17 + Math.cos(y * 0.03) * 22);
      if (this.dentroMapa(x, y)) { carvar(x, y, 1); pathV.push({ x, y }); }
    }
    this.riosPaths.push(pathV);

    // Lago grande perto do canto sudeste.
    const lx = MAP_W * 0.74;
    const ly = MAP_H * 0.72;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const d = ((x - lx) ** 2) / 220 + ((y - ly) ** 2) / 150;
        if (d < 1) this.tipos[this.idx(x, y)] = "agua";
      }
    }

    // Lago pequeno garantido perto da aldeia (sobrevivencia inicial).
    const px = ALDEIA_X + 9;
    const py = ALDEIA_Y - 3;
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        if (Math.abs(x) + Math.abs(y) <= 3 && this.dentroMapa(px + x, py + y)) {
          this.tipos[this.idx(px + x, py + y)] = "agua";
        }
      }
    }
    this.lagoAldeia = { x: px, y: py };
  }

  aplicarMargens() {
    const novos = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = this.tipos[this.idx(x, y)];
        if (t === "agua" || t === "areia") continue;
        const vizAgua = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => this.dentroMapa(x + dx, y + dy) && this.tipos[this.idx(x + dx, y + dy)] === "agua");
        if (vizAgua && t !== "montanha" && t !== "pedras") novos.push(this.idx(x, y));
      }
    }
    novos.forEach(i => { this.tipos[i] = "areia"; });
  }

  limparAldeia() {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const x = ALDEIA_X + dx;
        const y = ALDEIA_Y + dy;
        if (!this.dentroMapa(x, y)) continue;
        if (this.tipos[this.idx(x, y)] === "agua") continue;
        this.tipos[this.idx(x, y)] = Math.abs(dx) + Math.abs(dy) <= 2 ? "terra" : "grama";
      }
    }
  }

  gerarPontes(rng) {
    let total = 0;
    const maxPontes = 14;
    this.pontesSprites = [];

    for (const path of this.riosPaths) {
      for (let i = 10; i < path.length - 6 && total < maxPontes; i += 22) {
        const { x, y } = path[i];
        // marca um pequeno trecho atravessavel cobrindo a largura da agua
        let marcou = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (this.dentroMapa(nx, ny) && this.tipos[this.idx(nx, ny)] === "agua") {
              this.pontes.add(chaveTile(nx, ny));
              marcou = true;
            }
          }
        }
        if (marcou) {
          this.pontesSprites.push({ x, y });
          total++;
        }
      }
    }
  }

  // ---- LOCAIS ------------------------------------------------------------
  gerarLocais() {
    const nomeBioma = {
      floresta: ["Floresta", "Bosque", "Mata"],
      agua: ["Lago", "Rio", "Margem"],
      campo: ["Campo", "Planicie", "Prado"],
      pedras: ["Pedreira", "Rochedo"],
      montanha: ["Montanha", "Pico", "Serra"],
      colina: ["Colina", "Morro"],
      deserto: ["Deserto", "Dunas", "Oasis"],
      neve: ["Geleira", "Cume Gelado"],
      grama: ["Clareira", "Vale"]
    };

    this.locais = [{
      id: "aldeia_inicial",
      nome: "Aldeia Inicial",
      x: ALDEIA_X,
      y: ALDEIA_Y,
      tipo: "moradia",
      descricao: "casas protegidas onde os primeiros habitantes descansam"
    }];

    if (this.lagoAldeia) {
      const p = this.tileValidoMaisProximo(this.lagoAldeia.x + 4, this.lagoAldeia.y, 6) || this.lagoAldeia;
      this.locais.push({
        id: "lago_aldeia",
        nome: "Lago da Aldeia",
        x: this.lagoAldeia.x,
        y: this.lagoAldeia.y,
        tipo: "agua",
        descricao: "agua limpa logo ao lado da aldeia"
      });
    }

    const rng = criarRng(this.seed + 4242);
    const usados = new Set();
    for (let gy = 9; gy < MAP_H - 6; gy += 17) {
      for (let gx = 9; gx < MAP_W - 6; gx += 17) {
        const ox = gx + Math.floor((rng() - 0.5) * 8);
        const oy = gy + Math.floor((rng() - 0.5) * 8);
        if (!this.dentroMapa(ox, oy)) continue;
        if (distanciaTiles({ x: ox, y: oy }, { x: ALDEIA_X, y: ALDEIA_Y }) < 12) continue;

        const tipo = this.tipos[this.idx(ox, oy)];
        const nomes = nomeBioma[tipo];
        if (!nomes) continue;
        const key = chaveTile(Math.round(ox / 6), Math.round(oy / 6));
        if (usados.has(key)) continue;
        usados.add(key);

        const id = `local_${ox}_${oy}`;
        this.locais.push({
          id,
          nome: `${escolher(nomes)} ${this.locais.length}`,
          x: ox,
          y: oy,
          tipo,
          descricao: this.descricaoBioma(tipo)
        });
      }
    }

    // Algumas ruinas exploraveis espalhadas.
    for (let r = 0; r < 5; r++) {
      const x = aleatorioRng(rng, 8, MAP_W - 8);
      const y = aleatorioRng(rng, 8, MAP_H - 8);
      if (!this.isWalkable(x, y)) continue;
      this.locais.push({
        id: `ruina_${x}_${y}`,
        nome: `Ruinas Antigas ${r + 1}`,
        x, y,
        tipo: "ruinas",
        descricao: "restos de um povo antigo, talvez com conhecimento ou recursos"
      });
    }
  }

  descricaoBioma(tipo) {
    const desc = {
      floresta: "arvores altas, madeira, frutos e animais",
      agua: "fonte de agua para matar a sede",
      campo: "terra aberta com sementes e plantas baixas",
      pedras: "rochas expostas, boa fonte de pedra",
      montanha: "altitude com minerio e pedra dura",
      colina: "terreno alto, boa observacao",
      deserto: "areia seca, pouco recurso e muito calor",
      neve: "frio intenso, terreno dificil",
      grama: "campo aberto e seguro"
    };
    return desc[tipo] || "terreno a explorar";
  }

  // ---- RENDER (chunks com culling) --------------------------------------
  desenhar() {
    const cols = Math.ceil(MAP_W / CHUNK);
    const rows = Math.ceil(MAP_H / CHUNK);

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        this.desenharChunk(cx, cy);
      }
    }

    this.desenharCasasIniciais();
    this.desenharMarcadoresLocais();
  }

  desenharChunk(cx, cy) {
    const container = this.scene.add.container(0, 0);
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const x1 = Math.min(MAP_W, x0 + CHUNK);
    const y1 = Math.min(MAP_H, y0 + CHUNK);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let maxWorldY = -Infinity;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const pos = iso(x, y);
        const tipo = this.tipos[this.idx(x, y)];
        const tile = this.scene.add.image(pos.x, pos.y, `tile-${tipo}`);
        tile.setOrigin(0.5, 0.5);
        container.add(tile);
        if (pos.x < minX) minX = pos.x;
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.y > maxY) maxY = pos.y;
        if (pos.y > maxWorldY) maxWorldY = pos.y;
      }
    }

    // Decoracoes deterministicas (arvores, pedras) por cima dos tiles do chunk.
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const tipo = this.tipos[this.idx(x, y)];
        const r = ruido2d(x * 1.7, y * 1.3, this.seed + 31);
        const pos = iso(x, y);

        if (tipo === "floresta" && r < 0.42) {
          const tex = r < 0.16 ? "arvore-pinho" : (r < 0.3 ? "arvore-a" : "arvore-b");
          this.addDeco(container, pos.x, pos.y + 3, tex, 1);
        } else if (tipo === "neve" && r < 0.2) {
          this.addDeco(container, pos.x, pos.y + 3, "arvore-pinho", 0.9);
        } else if ((tipo === "pedras" || tipo === "montanha") && r < 0.34) {
          this.addDeco(container, pos.x, pos.y + 3, r < 0.12 ? "pedra-minerio" : "pedra-a", 0.95);
        } else if (tipo === "grama" && r < 0.05) {
          this.addDeco(container, pos.x, pos.y + 3, "arvore-a", 0.8);
        }
      }
    }

    // Pontes pertencem ao chao (cobrem a agua); ficam no chunk para nao sumir sob o terreno.
    for (const p of this.pontesSprites || []) {
      if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) {
        const pos = iso(p.x, p.y);
        const sprite = this.scene.add.image(pos.x, pos.y, "ponte");
        sprite.setOrigin(0.5, 0.5);
        container.add(sprite);
      }
    }

    // Chao: banda de profundidade baixa (sempre abaixo de personagens e estruturas).
    container.setDepth(maxWorldY);
    this.chunks.push({
      container,
      bbox: { minX: minX - TILE_W, maxX: maxX + TILE_W, minY: minY - 160, maxY: maxY + 60 }
    });
  }

  addDeco(container, x, y, textura, escalaBase) {
    const deco = this.scene.add.image(x, y - 2, textura);
    deco.setOrigin(0.5, 1);
    deco.setScale(escalaBase * aleatorio(86, 110) / 100);
    container.add(deco);
  }

  desenharCasasIniciais() {
    const casas = [
      { dx: -2, dy: -1, t: "casa-a" }, { dx: 1, dy: -1, t: "casa-b" },
      { dx: -1, dy: 1, t: "casa-a" }, { dx: 2, dy: 1, t: "casa-b" }
    ];
    casas.forEach(c => {
      const x = ALDEIA_X + c.dx;
      const y = ALDEIA_Y + c.dy;
      const pos = iso(x, y);
      const sprite = this.scene.add.image(pos.x, pos.y + 10, c.t);
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(pos.y + 10000);
      sprite.setScale(0.85);
    });
  }

  desenharMarcadoresLocais() {
    this.locais.forEach(local => {
      const pos = iso(local.x, local.y);
      const grupo = this.scene.add.container(pos.x, pos.y - 58);
      const texto = this.scene.add.text(0, 0, local.nome, {
        fontFamily: "Arial", fontSize: "12px", fontStyle: "700",
        color: "#f8f6e8", align: "center"
      });
      texto.setOrigin(0.5);
      texto.setShadow(0, 2, "#000000", 3, true, true);

      const largura = Math.max(80, texto.width + 20);
      const fundo = this.scene.add.graphics();
      fundo.fillStyle(0x111417, 0.72);
      fundo.fillRoundedRect(-largura / 2, -13, largura, 26, 8);
      fundo.lineStyle(1, 0xffffff, 0.16);
      fundo.strokeRoundedRect(-largura / 2, -13, largura, 26, 8);
      grupo.add([fundo, texto]);
      grupo.setDepth(pos.y + 20000);
      local._marcador = grupo;
    });
  }

  atualizarCulling(camera) {
    if (!camera) return;
    const view = camera.worldView;
    const pad = 80;
    for (const chunk of this.chunks) {
      const b = chunk.bbox;
      const visivel = b.maxX >= view.x - pad && b.minX <= view.right + pad
        && b.maxY >= view.y - pad && b.minY <= view.bottom + pad;
      if (chunk.container.visible !== visivel) chunk.container.setVisible(visivel);
    }
  }

  // ---- CONSULTAS ---------------------------------------------------------
  tipoTile(x, y) {
    if (!this.dentroMapa(x, y)) return "grama";
    return this.tipos[this.idx(x, y)];
  }

  buscarLocalPorId(id) {
    return this.locais.find(local => local.id === id);
  }

  locaisVisiveisPara(habitante) {
    return this.locais
      .filter(local => habitante.mapaConhecido.includes(local.id))
      .map(local => ({
        id: local.id, nome: local.nome, x: local.x, y: local.y,
        tipo: local.tipo, descricao: local.descricao
      }));
  }

  localMaisProximoDaTela(screenX, screenY) {
    let melhor = null;
    let menor = Infinity;
    this.locais.forEach(local => {
      const pos = iso(local.x, local.y);
      const dist = Math.hypot(pos.x - screenX, pos.y - screenY);
      if (dist < menor) { menor = dist; melhor = local; }
    });
    return menor < 64 ? melhor : null;
  }

  localMaisProximoTipo(x, y, tipos, conhecidosDe = null) {
    const lista = Array.isArray(tipos) ? tipos : [tipos];
    let melhor = null;
    let menor = Infinity;
    for (const local of this.locais) {
      if (!lista.includes(local.tipo)) continue;
      if (conhecidosDe && !conhecidosDe.mapaConhecido.includes(local.id)) continue;
      const d = distanciaTiles({ x, y }, local);
      if (d < menor) { menor = d; melhor = local; }
    }
    return melhor;
  }

  dentroMapa(x, y) {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  }

  ehAgua(x, y) {
    return this.tipoTile(x, y) === "agua" && !this.pontes.has(chaveTile(x, y));
  }

  aguaAoAlcance(x, y, raio = 1) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (this.ehAgua(x + dx, y + dy)) return true;
      }
    }
    return false;
  }

  isWalkable(x, y) {
    if (!this.dentroMapa(x, y)) return false;
    if (this.bloqueados.has(chaveTile(x, y))) return false;
    if (this.pontes.has(chaveTile(x, y))) return true;
    return this.tipos[this.idx(x, y)] !== "agua";
  }

  bloquear(x, y) { this.bloqueados.add(chaveTile(x, y)); }
  desbloquear(x, y) { this.bloqueados.delete(chaveTile(x, y)); }

  custoTile(x, y) {
    const tipo = this.tipoTile(x, y);
    const custos = {
      terra: 0.85, grama: 1, campo: 0.92, areia: 1.15,
      colina: 1.3, floresta: 1.4, pedras: 1.6,
      deserto: 1.5, montanha: 2.1, neve: 1.9
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
      .filter(v => {
        if (!this.isWalkable(v.x, v.y)) return false;
        if (v.diagonal) {
          const dx = v.x - tile.x;
          const dy = v.y - tile.y;
          return this.isWalkable(tile.x + dx, tile.y) && this.isWalkable(tile.x, tile.y + dy);
        }
        return true;
      });
  }

  encontrarCaminho(inicio, destino) {
    const partida = this.tileValidoMaisProximo(inicio.x, inicio.y, 4);
    const alvo = this.tileValidoMaisProximo(destino.x, destino.y, 8);
    if (!partida || !alvo) return [];

    const aberta = new MinHeap();
    const veioDe = new Map();
    const gScore = new Map();
    const fechada = new Set();
    const kPart = chaveTile(partida.x, partida.y);

    gScore.set(kPart, 0);
    aberta.inserir(partida, distanciaTiles(partida, alvo));

    let expansoes = 0;
    const maxExpansoes = 6000; // evita travar em destinos inalcancaveis

    while (aberta.tamanho) {
      const atual = aberta.remover();
      const atualKey = chaveTile(atual.x, atual.y);
      if (fechada.has(atualKey)) continue;

      if (atual.x === alvo.x && atual.y === alvo.y) {
        return this.reconstruirCaminho(veioDe, atual);
      }

      fechada.add(atualKey);
      if (++expansoes > maxExpansoes) return [];

      for (const v of this.vizinhos(atual)) {
        const vKey = chaveTile(v.x, v.y);
        if (fechada.has(vKey)) continue;
        const custoDiag = v.diagonal ? 1.4 : 1;
        const g = (gScore.get(atualKey) ?? Infinity) + this.custoTile(v.x, v.y) * custoDiag;
        if (g >= (gScore.get(vKey) ?? Infinity)) continue;
        veioDe.set(vKey, atual);
        gScore.set(vKey, g);
        aberta.inserir({ x: v.x, y: v.y }, g + distanciaTiles(v, alvo));
      }
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
        if (dist < menor) { menor = dist; melhor = { x: nx, y: ny }; }
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
        if (this.isWalkable(x, y)) candidatos.push({ x, y, dist: Math.abs(dx) + Math.abs(dy) });
      }
    }
    if (!candidatos.length) return this.tileValidoMaisProximo(local.x, local.y, 8);
    const proximos = candidatos.filter(c => c.dist <= 2).map(({ x, y }) => ({ x, y }));
    return escolher(proximos.length ? proximos : candidatos.map(({ x, y }) => ({ x, y })));
  }

  escolherTileLivreProximo(x, y, raio = 7) {
    const candidatos = [];
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isWalkable(nx, ny) && (dx !== 0 || dy !== 0)) candidatos.push({ x: nx, y: ny });
      }
    }
    return candidatos.length ? escolher(candidatos) : null;
  }

  escolherTileExploracao(habitante) {
    // Em mapa grande, explora numa direcao aleatoria a media distancia.
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const ang = Math.random() * Math.PI * 2;
      const raio = aleatorio(6, 16);
      const nx = Math.round(habitante.xTile + Math.cos(ang) * raio);
      const ny = Math.round(habitante.yTile + Math.sin(ang) * raio);
      if (this.isWalkable(nx, ny) && !habitante.tilesConhecidos.has(chaveTile(nx, ny))) {
        return { x: nx, y: ny };
      }
    }
    return this.escolherTileLivreProximo(habitante.xTile, habitante.yTile, aleatorio(5, 12));
  }

  recursoDoTile(x, y) {
    const tipo = this.tipoTile(x, y);
    if (tipo === "floresta") return "madeira";
    if (tipo === "pedras" || tipo === "montanha") return "pedra";
    if (tipo === "campo" || tipo === "grama") return "comida";
    return null;
  }

  posicaoHabitante(x, y) {
    const pos = iso(x, y);
    return { x: pos.x, y: pos.y - 20 };
  }

  tilePorTela(x, y) { return telaParaTile(x, y); }

  descreverTile(x, y) { return TIPO_TILE_NOME[this.tipoTile(x, y)] ?? "terreno"; }

  limitesMundo() {
    const cantos = [iso(0, 0), iso(MAP_W - 1, 0), iso(0, MAP_H - 1), iso(MAP_W - 1, MAP_H - 1)];
    const minX = Math.min(...cantos.map(p => p.x)) - TILE_W * 4;
    const maxX = Math.max(...cantos.map(p => p.x)) + TILE_W * 4;
    const minY = Math.min(...cantos.map(p => p.y)) - TILE_H * 4;
    const maxY = Math.max(...cantos.map(p => p.y)) + TILE_H * 8;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

function aleatorioRng(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
