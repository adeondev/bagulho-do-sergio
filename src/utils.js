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
