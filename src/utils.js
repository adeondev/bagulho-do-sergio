import { ISO_ORIGIN_X, ISO_ORIGIN_Y, TILE_W, TILE_H } from "./config.js";

export function iso(x, y) {
  return {
    x: ISO_ORIGIN_X + (x - y) * TILE_W / 2,
    y: ISO_ORIGIN_Y + (x + y) * TILE_H / 2
  };
}

export function telaParaTile(screenX, screenY) {
  const dx = (screenX - ISO_ORIGIN_X) / (TILE_W / 2);
  const dy = (screenY - ISO_ORIGIN_Y) / (TILE_H / 2);

  return {
    x: Math.round((dy + dx) / 2),
    y: Math.round((dy - dx) / 2)
  };
}

export function distancia(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanciaTiles(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function aleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function escolher(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

export function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

export function chaveTile(x, y) {
  return `${x},${y}`;
}

// ---- PRNG deterministico (mulberry32) usado para gerar o mapa a partir de uma seed.
// Garante que ao salvar/carregar a seed o mundo seja reproduzido identico.
export function criarRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido de valor suave e deterministico (para biomas).
export function ruido2d(x, y, seed = 1337) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.137) * 43758.5453;
  return n - Math.floor(n);
}

// Ruido fractal (varias oitavas) para terreno mais organico.
export function ruidoFractal(x, y, seed = 1337) {
  let valor = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    const xi = x * freq;
    const yi = y * freq;
    const x0 = Math.floor(xi);
    const y0 = Math.floor(yi);
    const fx = xi - x0;
    const fy = yi - y0;
    const s = (t) => t * t * (3 - 2 * t);
    const a = ruido2d(x0, y0, seed + i);
    const b = ruido2d(x0 + 1, y0, seed + i);
    const c = ruido2d(x0, y0 + 1, seed + i);
    const d = ruido2d(x0 + 1, y0 + 1, seed + i);
    const top = a + (b - a) * s(fx);
    const bot = c + (d - c) * s(fx);
    valor += (top + (bot - top) * s(fy)) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return valor;
}

export function capitalizar(texto) {
  const t = String(texto || "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
