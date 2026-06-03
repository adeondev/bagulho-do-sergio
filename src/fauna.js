import { ANIMAIS } from "./definicoes.js";
import { iso, aleatorio, escolher, distanciaTiles, chaveTile } from "./utils.js";
import { MAP_W, MAP_H } from "./config.js";

export class Animal {
  constructor(scene, mundo, tipo, x, y) {
    this.scene = scene;
    this.mundo = mundo;
    this.tipo = tipo;
    this.def = ANIMAIS[tipo];
    this.xTile = x;
    this.yTile = y;
    this.saude = this.def.saude;
    this.vivo = true;
    this.alvo = null;
    this.proximoMover = aleatorio(400, 1800);
    this.fugindoDe = null;

    const pos = iso(x, y);
    this.sprite = scene.add.image(pos.x, pos.y - 8, this.def.textura);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(pos.y + 10000);
    this.escala = this.def.predador ? 1 : aleatorio(80, 105) / 100;
    this.sprite.setScale(this.escala);
  }

  tileBom(x, y) {
    if (!this.mundo.dentroMapa(x, y)) return false;
    if (this.def.aquatico) return this.mundo.tipoTile(x, y) === "agua";
    return this.mundo.isWalkable(x, y);
  }

  escolherAlvo(habitantes) {
    // Predador caca habitante proximo; medroso foge de habitante proximo.
    const vivos = habitantes.filter(h => h.vivo);
    let maisProx = null;
    let menor = Infinity;
    for (const h of vivos) {
      const d = distanciaTiles({ x: this.xTile, y: this.yTile }, h);
      if (d < menor) { menor = d; maisProx = h; }
    }

    if (this.def.predador && maisProx && menor < 7) {
      this.alvo = { x: maisProx.xTile, y: maisProx.yTile };
      this.presa = maisProx;
      return;
    }

    if (this.def.medroso && maisProx && menor < 4.5) {
      const dx = Math.sign(this.xTile - maisProx.xTile) || (Math.random() < 0.5 ? 1 : -1);
      const dy = Math.sign(this.yTile - maisProx.yTile) || (Math.random() < 0.5 ? 1 : -1);
      for (let r = 4; r >= 1; r--) {
        const nx = this.xTile + dx * r;
        const ny = this.yTile + dy * r;
        if (this.tileBom(nx, ny)) { this.alvo = { x: nx, y: ny }; return; }
      }
    }

    // Vagar.
    for (let t = 0; t < 8; t++) {
      const nx = this.xTile + aleatorio(-4, 4);
      const ny = this.yTile + aleatorio(-4, 4);
      if (this.tileBom(nx, ny)) { this.alvo = { x: nx, y: ny }; this.presa = null; return; }
    }
  }

  update(delta, habitantes, aoAtacar) {
    if (!this.vivo) return;
    this.proximoMover -= delta;
    if (!this.alvo || this.proximoMover <= 0) {
      this.escolherAlvo(habitantes);
      this.proximoMover = aleatorio(this.def.predador ? 300 : 700, this.def.predador ? 900 : 2400);
    }
    if (!this.alvo) return;

    const destino = iso(this.alvo.x, this.alvo.y);
    const dx = destino.x - this.sprite.x;
    const dy = (destino.y - 8) - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const passo = this.def.velocidade * (delta / 1000);

    if (dist <= passo) {
      this.sprite.x = destino.x;
      this.sprite.y = destino.y - 8;
      this.xTile = this.alvo.x;
      this.yTile = this.alvo.y;
      this.alvo = null;

      // Predador ataca presa adjacente.
      if (this.def.predador && this.presa?.vivo && distanciaTiles(this, this.presa) <= 1.6) {
        aoAtacar?.(this, this.presa);
      }
    } else {
      this.sprite.x += (dx / dist) * passo;
      this.sprite.y += (dy / dist) * passo;
      this.sprite.setScale(dx < 0 ? -this.escala : this.escala, this.escala);
    }
    this.sprite.setDepth(this.sprite.y + 10000);
  }

  receberDano(valor) {
    this.saude -= valor;
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.5, duration: 80, yoyo: true });
    if (this.saude <= 0) this.morrer();
    return !this.vivo;
  }

  morrer() {
    this.vivo = false;
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, scaleY: 0.2, duration: 400,
      onComplete: () => this.sprite.destroy()
    });
  }

  toJSON() {
    return { tipo: this.tipo, x: this.xTile, y: this.yTile, saude: this.saude };
  }
}

export class Fauna {
  constructor(scene, mundo) {
    this.scene = scene;
    this.mundo = mundo;
    this.animais = [];
  }

  povoar(quantidade = 46) {
    const tipos = Object.keys(ANIMAIS);
    let tentativas = 0;
    while (this.animais.length < quantidade && tentativas < quantidade * 30) {
      tentativas++;
      const tipo = escolher(tipos);
      const def = ANIMAIS[tipo];
      const x = aleatorio(2, MAP_W - 3);
      const y = aleatorio(2, MAP_H - 3);
      const tile = this.mundo.tipoTile(x, y);
      const ok = def.aquatico ? tile === "agua" : (this.mundo.isWalkable(x, y) && def.biomas.includes(tile));
      if (ok) this.animais.push(new Animal(this.scene, this.mundo, tipo, x, y));
    }
  }

  restaurar(lista = []) {
    lista.forEach(a => {
      if (!ANIMAIS[a.tipo]) return;
      const animal = new Animal(this.scene, this.mundo, a.tipo, a.x, a.y);
      animal.saude = a.saude;
      this.animais.push(animal);
    });
  }

  update(delta, habitantes, aoAtacar) {
    for (const a of this.animais) a.update(delta, habitantes, aoAtacar);
    // Repopula lentamente para o ecossistema nao zerar.
    if (this.animais.filter(a => a.vivo).length < 22 && Math.random() < 0.01) {
      this.povoar(this.animais.filter(a => a.vivo).length + 1);
    }
    if (this.animais.length > 120) {
      this.animais = this.animais.filter(a => a.vivo);
    }
  }

  animalCacavelPerto(x, y, raio = 1.8) {
    let melhor = null;
    let menor = Infinity;
    for (const a of this.animais) {
      if (!a.vivo || a.def.predador) continue;
      const d = distanciaTiles({ x, y }, a);
      if (d <= raio && d < menor) { menor = d; melhor = a; }
    }
    return melhor;
  }

  animalProximoPara(x, y, raio = 9) {
    let melhor = null;
    let menor = Infinity;
    for (const a of this.animais) {
      if (!a.vivo || a.def.predador) continue;
      const d = distanciaTiles({ x, y }, a);
      if (d <= raio && d < menor) { menor = d; melhor = a; }
    }
    return melhor;
  }

  toJSON() {
    return this.animais.filter(a => a.vivo).map(a => a.toJSON());
  }
}
