import { ESTRUTURAS, podePagar, pagar } from "./definicoes.js";
import { iso, chaveTile, distanciaTiles } from "./utils.js";

export class Estrutura {
  constructor(scene, mundo, tipo, x, y, tribo) {
    this.scene = scene;
    this.mundo = mundo;
    this.tipo = tipo;
    this.def = ESTRUTURAS[tipo];
    this.x = x;
    this.y = y;
    this.tribo = tribo || null;
    this.diasRestantes = this.def.temporaria ? this.def.duracaoDias : Infinity;
    this.estoque = this.def.efeito === "estoque" ? { madeira: 0, pedra: 0, comida: 0 } : null;
    this.producao = 0;

    const pos = iso(x, y);
    const ground = this.def.efeito === "comida" || this.def.efeito === "calor";
    this.sprite = scene.add.image(pos.x, pos.y + (ground ? 6 : 12), this.def.textura);
    this.sprite.setOrigin(0.5, ground ? 0.82 : 1);
    this.sprite.setDepth(pos.y + 10000 + (ground ? 0 : 40));

    if (this.def.bloqueia) this.mundo.bloquear(x, y);

    if (this.def.efeito === "calor") {
      scene.tweens.add({
        targets: this.sprite, scaleY: { from: 0.94, to: 1.06 },
        duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut"
      });
    }
  }

  efeitoAlcanca(x, y) {
    return distanciaTiles({ x, y }, this) <= this.def.raio + 0.5;
  }

  atualizarDia() {
    if (this.def.temporaria) this.diasRestantes -= 1;
    if (this.def.efeito === "comida") this.producao = Math.min(8, this.producao + 2);
    return this.diasRestantes > 0;
  }

  // Fazenda entrega comida acumulada para quem colhe.
  colher() {
    if (this.def.efeito !== "comida" || this.producao <= 0) return 0;
    const q = Math.min(2, this.producao);
    this.producao -= q;
    return q;
  }

  remover() {
    if (this.def.bloqueia) this.mundo.desbloquear(this.x, this.y);
    this.scene.tweens.add({
      targets: this.sprite, alpha: 0, duration: 350,
      onComplete: () => this.sprite.destroy()
    });
  }

  toJSON() {
    return {
      tipo: this.tipo, x: this.x, y: this.y, tribo: this.tribo,
      diasRestantes: this.diasRestantes === Infinity ? null : this.diasRestantes,
      estoque: this.estoque, producao: this.producao
    };
  }
}

export class Estruturas {
  constructor(scene, mundo) {
    this.scene = scene;
    this.mundo = mundo;
    this.lista = [];
  }

  get total() { return this.lista.length; }

  contar(tipo) { return this.lista.filter(e => e.tipo === tipo).length; }

  // Evita "um dentro do outro": exige espaco minimo de outras estruturas.
  podeColocar(x, y, espaco = 2) {
    if (!this.mundo.dentroMapa(x, y)) return false;
    if (!this.mundo.isWalkable(x, y)) return false;
    if (this.mundo.tipoTile(x, y) === "agua") return false;
    for (const e of this.lista) {
      if (Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) < espaco) return false;
    }
    return true;
  }

  encontrarLocal(x, y, tipo) {
    // Poco precisa de agua por perto; fazenda prefere campo/grama.
    const def = ESTRUTURAS[tipo];
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!this.podeColocar(nx, ny)) continue;
          if (def.efeito === "agua" && !this.mundo.aguaAoAlcance(nx, ny, 6)) continue;
          return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  construir(habitante, tipo, x, y) {
    const def = ESTRUTURAS[tipo];
    if (!def) return null;
    if (!this.podeColocar(x, y)) {
      const alt = this.encontrarLocal(x, y, tipo);
      if (!alt) return null;
      x = alt.x; y = alt.y;
    }
    if (!podePagar(habitante.inventario, def.custo)) return null;
    pagar(habitante.inventario, def.custo);

    const estrutura = new Estrutura(this.scene, this.mundo, tipo, x, y, habitante.tribo);
    this.lista.push(estrutura);
    return estrutura;
  }

  restaurar(lista = []) {
    lista.forEach(d => {
      if (!ESTRUTURAS[d.tipo]) return;
      const e = new Estrutura(this.scene, this.mundo, d.tipo, d.x, d.y, d.tribo);
      e.diasRestantes = d.diasRestantes == null ? Infinity : d.diasRestantes;
      if (d.estoque) e.estoque = d.estoque;
      e.producao = d.producao || 0;
      this.lista.push(e);
    });
  }

  efeitoPerto(x, y, efeito) {
    let melhor = null;
    let menor = Infinity;
    for (const e of this.lista) {
      if (e.def.efeito !== efeito) continue;
      const d = distanciaTiles({ x, y }, e);
      if (d <= e.def.raio + 0.5 && d < menor) { menor = d; melhor = e; }
    }
    return melhor;
  }

  maisProximoComEfeito(x, y, efeito) {
    let melhor = null;
    let menor = Infinity;
    for (const e of this.lista) {
      if (e.def.efeito !== efeito) continue;
      const d = distanciaTiles({ x, y }, e);
      if (d < menor) { menor = d; melhor = e; }
    }
    return melhor;
  }

  atualizarDia(aoRemover) {
    const sobreviventes = [];
    for (const e of this.lista) {
      if (e.atualizarDia()) {
        sobreviventes.push(e);
      } else {
        e.remover();
        aoRemover?.(e);
      }
    }
    this.lista = sobreviventes;
  }

  toJSON() {
    return this.lista.map(e => e.toJSON());
  }
}
