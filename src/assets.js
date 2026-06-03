import { TILE_H, TILE_W } from "./config.js";

function svgData(svg) {
  const normalizado = svg.replace(/\s+/g, " ").trim();
  const base64 = typeof btoa === "function"
    ? btoa(normalizado)
    : Buffer.from(normalizado, "utf8").toString("base64");

  return `data:image/svg+xml;base64,${base64}`;
}

function tileSvg(id, colors, details = "") {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-52 -30 104 60">
      <defs>
        <linearGradient id="${id}-base" x1="-36" y1="-24" x2="38" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${colors.top}"/>
          <stop offset="0.58" stop-color="${colors.mid}"/>
          <stop offset="1" stop-color="${colors.bottom}"/>
        </linearGradient>
      </defs>
      <path d="M0 -24 48 0 0 24 -48 0Z" fill="url(#${id}-base)"/>
      <path d="M-48 0 0 24 48 0" fill="none" stroke="#161616" stroke-opacity=".18" stroke-width="1.4"/>
      <path d="M0 -24 48 0 0 24 -48 0Z" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>
      ${details}
    </svg>
  `;
}

function houseSvg(walls, roof) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-92 -116 184 140">
      <defs>
        <linearGradient id="wallA" x1="-70" y1="-58" x2="10" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${walls.light}"/>
          <stop offset="1" stop-color="${walls.mid}"/>
        </linearGradient>
        <linearGradient id="wallB" x1="0" y1="-48" x2="72" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${walls.mid}"/>
          <stop offset="1" stop-color="${walls.dark}"/>
        </linearGradient>
        <linearGradient id="roofA" x1="-52" y1="-112" x2="55" y2="-40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${roof.light}"/>
          <stop offset=".58" stop-color="${roof.mid}"/>
          <stop offset="1" stop-color="${roof.dark}"/>
        </linearGradient>
        <filter id="houseShadow" x="-25%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#0c0f10" flood-opacity=".42"/>
        </filter>
      </defs>
      <ellipse cx="0" cy="14" rx="70" ry="18" fill="#111" opacity=".2"/>
      <g filter="url(#houseShadow)">
        <path d="M-58 -56 0 -28 0 10 -58 -18Z" fill="url(#wallA)"/>
        <path d="M0 -28 62 -58 62 -18 0 10Z" fill="url(#wallB)"/>
        <path d="M-70 -62 0 -108 70 -62 0 -28Z" fill="url(#roofA)"/>
        <path d="M-70 -62 0 -28 70 -62 0 -16Z" fill="#5f2430" opacity=".2"/>
        <path d="M-64 -60 0 -100 64 -60 0 -35Z" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"/>
        <path d="M-18 -26 -2 -18 -2 2 -18 -6Z" fill="#4c2d20"/>
        <path d="M14 -40 34 -50 34 -33 14 -23Z" fill="#f9d989" opacity=".9"/>
        <path d="M-42 -47 -26 -39 -26 -24 -42 -32Z" fill="#f9d989" opacity=".85"/>
        <path d="M28 -88 43 -80 43 -61 28 -69Z" fill="#674130"/>
      </g>
    </svg>
  `;
}

function treeSvg(primary, secondary) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -122 116 140">
      <defs>
        <linearGradient id="trunk" x1="-12" y1="-50" x2="18" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#8d5a2f"/>
          <stop offset="1" stop-color="#4d2d19"/>
        </linearGradient>
        <radialGradient id="leafA" cx="34%" cy="24%" r="74%">
          <stop offset="0" stop-color="${secondary}"/>
          <stop offset=".72" stop-color="${primary}"/>
          <stop offset="1" stop-color="#173a25"/>
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="10" rx="38" ry="12" fill="#111" opacity=".2"/>
      <path d="M-11 -48 11 -48 17 8 -16 8Z" fill="url(#trunk)"/>
      <path d="M-2 -96 C-40 -92 -52 -58 -30 -42 -52 -28 -34 -2 -6 -14 12 2 47 -8 35 -34 60 -43 44 -78 15 -76 12 -91 5 -97 -2 -96Z" fill="url(#leafA)"/>
      <path d="M-28 -61 C-10 -79 20 -74 32 -51" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `;
}

function pineSvg(primary, secondary) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-46 -130 92 150">
      <defs>
        <linearGradient id="pineL" x1="0" y1="-120" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${secondary}"/>
          <stop offset="1" stop-color="${primary}"/>
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="12" rx="26" ry="9" fill="#111" opacity=".2"/>
      <path d="M-7 -34 7 -34 9 10 -9 10Z" fill="#5a3a22"/>
      <path d="M0 -120 26 -64 13 -64 30 -22 -30 -22 -13 -64 -26 -64Z" fill="url(#pineL)"/>
      <path d="M0 -120 14 -90 -14 -90Z" fill="#fff" fill-opacity=".14"/>
    </svg>
  `;
}

function rockSvg(claro = "#c0c6ca", medio = "#878f96", escuro = "#565f66") {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -58 116 82">
      <defs>
        <linearGradient id="rockBody" x1="-45" y1="-48" x2="48" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${claro}"/>
          <stop offset=".55" stop-color="${medio}"/>
          <stop offset="1" stop-color="${escuro}"/>
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="11" rx="42" ry="12" fill="#111" opacity=".18"/>
      <path d="M-46 -4 -31 -32 -4 -47 31 -33 48 -5 35 14 -16 18Z" fill="url(#rockBody)"/>
      <path d="M-27 -29 -10 -6 0 -44" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `;
}

function villagerSvg(cloth, hair, skin) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -122 116 136">
      <defs>
        <linearGradient id="cloth" x1="-18" y1="-70" x2="24" y2="-12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${cloth.light}"/>
          <stop offset=".72" stop-color="${cloth.mid}"/>
          <stop offset="1" stop-color="${cloth.dark}"/>
        </linearGradient>
        <radialGradient id="skin" cx="38%" cy="30%" r="72%">
          <stop offset="0" stop-color="${skin.light}"/>
          <stop offset="1" stop-color="${skin.mid}"/>
        </radialGradient>
        <filter id="personShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#111" flood-opacity=".32"/>
        </filter>
      </defs>
      <ellipse cx="0" cy="5" rx="31" ry="10" fill="#111" opacity=".22"/>
      <g filter="url(#personShadow)">
        <path d="M-18 -36 -30 -2 -17 0 -7 -30Z" fill="#26292c"/>
        <path d="M18 -36 30 -2 17 0 7 -30Z" fill="#202327"/>
        <path d="M-26 -68 C-18 -82 18 -82 27 -68 L20 -25 C8 -15 -9 -15 -21 -25Z" fill="url(#cloth)"/>
        <path d="M-26 -64 -42 -42 -35 -34 -19 -51Z" fill="url(#cloth)" opacity=".9"/>
        <path d="M26 -64 42 -42 35 -34 19 -51Z" fill="url(#cloth)" opacity=".86"/>
        <circle cx="0" cy="-94" r="22" fill="url(#skin)"/>
        <path d="M-22 -97 C-20 -119 19 -122 25 -96 15 -104 4 -101 -7 -107 -12 -101 -18 -99 -22 -97Z" fill="${hair}"/>
        <path d="M-8 -95 h3 M9 -95 h3" stroke="#251b18" stroke-width="3" stroke-linecap="round"/>
        <path d="M-8 -84 C-2 -79 8 -80 13 -84" fill="none" stroke="#7d3e2f" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}

// ---- PONTE ---------------------------------------------------------------
function bridgeSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-52 -34 104 64">
      <path d="M0 -22 46 0 0 22 -46 0Z" fill="#9c6a3c"/>
      <path d="M0 -22 46 0 0 22 -46 0Z" fill="none" stroke="#5e3b1d" stroke-width="2"/>
      <path d="M-30 -8 16 14 M-16 -16 30 6 M-2 -22 44 0" stroke="#6f4424" stroke-width="3" opacity=".7"/>
      <path d="M-46 0 -40 -8 6 -30 12 -22Z" fill="#7c5230"/>
      <path d="M46 0 40 -8 -6 -30 -12 -22Z" fill="#86592f"/>
    </svg>
  `;
}

// ---- ESTRUTURAS ----------------------------------------------------------
function fogueiraSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-44 -64 88 84">
      <ellipse cx="0" cy="10" rx="30" ry="9" fill="#111" opacity=".25"/>
      <path d="M-22 8 22 -6 M-22 -6 22 8" stroke="#6b4427" stroke-width="7" stroke-linecap="round"/>
      <path d="M0 -44 C12 -28 18 -20 8 -8 C20 -14 18 -32 0 -44Z" fill="#ffb03a"/>
      <path d="M0 -34 C8 -22 10 -16 3 -7 C12 -12 11 -24 0 -34Z" fill="#ff5b2e"/>
      <path d="M0 -22 C5 -14 5 -10 1 -5 C7 -9 6 -16 0 -22Z" fill="#ffe07a"/>
    </svg>
  `;
}

function cabanaSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -86 140 110">
      <ellipse cx="0" cy="14" rx="56" ry="15" fill="#111" opacity=".22"/>
      <path d="M-44 -34 0 -16 0 12 -44 -6Z" fill="#a87b4a"/>
      <path d="M0 -16 46 -34 46 -6 0 12Z" fill="#8a6038"/>
      <path d="M-52 -38 0 -74 52 -38 0 -10Z" fill="#6f4a28"/>
      <path d="M-50 -38 0 -70 50 -38" fill="none" stroke="#d8b277" stroke-width="3" opacity=".5"/>
      <path d="M-16 -16 -3 -10 -3 8 -16 2Z" fill="#3c2a1a"/>
    </svg>
  `;
}

function pocoSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-46 -78 92 100">
      <ellipse cx="0" cy="14" rx="38" ry="11" fill="#111" opacity=".24"/>
      <path d="M-32 0 0 16 32 0 0 -16Z" fill="#7d8489"/>
      <path d="M-32 0 0 16 32 0 32 -10 0 -26 -32 -10Z" fill="#5f676c"/>
      <path d="M-24 -8 0 4 24 -8 0 -20Z" fill="#2a7fb0"/>
      <path d="M-22 -8 0 2 22 -8" fill="none" stroke="#bdeaff" stroke-width="2" opacity=".6"/>
      <path d="M-26 -12 -26 -52 26 -52 26 -12" fill="none" stroke="#6f4a28" stroke-width="6"/>
      <path d="M-30 -50 30 -50 0 -70Z" fill="#7a4f2c"/>
    </svg>
  `;
}

function depositoSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -78 116 100">
      <ellipse cx="0" cy="14" rx="48" ry="13" fill="#111" opacity=".22"/>
      <path d="M-40 -22 0 -4 0 14 -40 -4Z" fill="#9a7b4f"/>
      <path d="M0 -4 40 -22 40 -4 0 14Z" fill="#7a5d39"/>
      <path d="M-46 -26 0 -52 46 -26 0 0Z" fill="#caa86a"/>
      <path d="M-24 -16 -10 -10 -10 6 -24 0Z" fill="#caa400" opacity=".8"/>
      <path d="M8 -12 22 -18 22 -2 8 4Z" fill="#caa400" opacity=".7"/>
    </svg>
  `;
}

function fazendaSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-56 -52 112 72">
      <path d="M0 -20 48 4 0 28 -48 4Z" fill="#7d5a32"/>
      <path d="M0 -20 48 4 0 28 -48 4Z" fill="none" stroke="#5b3f22" stroke-width="2"/>
      <g fill="#7ed957">
        <path d="M-20 0 -16 -12 -12 0Z"/><path d="M-4 6 0 -8 4 6Z"/><path d="M12 0 16 -12 20 0Z"/>
        <path d="M-12 12 -8 0 -4 12Z"/><path d="M4 14 8 2 12 14Z"/>
      </g>
    </svg>
  `;
}

function oficinaSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-64 -92 128 116">
      <ellipse cx="0" cy="16" rx="52" ry="14" fill="#111" opacity=".24"/>
      <path d="M-44 -30 0 -10 0 16 -44 -4Z" fill="#6d6f73"/>
      <path d="M0 -10 46 -30 46 -4 0 16Z" fill="#54565a"/>
      <path d="M-52 -34 0 -64 52 -34 0 -6Z" fill="#3f4145"/>
      <path d="M16 -78 24 -78 24 -40 16 -40Z" fill="#2c2e31"/>
      <circle cx="20" cy="-82" r="6" fill="#ff7a3a"/>
      <path d="M-22 -16 -8 -10 -8 8 -22 2Z" fill="#26282b"/>
      <path d="M6 -42 18 -36 12 -28 0 -34Z" fill="#caa400"/>
    </svg>
  `;
}

function muralhaSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -68 80 92">
      <path d="M-30 -2 0 14 30 -2 0 -18Z" fill="#8a8f8c"/>
      <path d="M-30 -2 0 14 0 -38 -30 -54Z" fill="#6c726e"/>
      <path d="M0 14 30 -2 30 -54 0 -38Z" fill="#565b58"/>
      <path d="M-30 -54 -30 -64 -18 -58 -18 -48 -6 -54 -6 -44" fill="#6c726e"/>
      <path d="M30 -54 30 -64 18 -58 18 -48 6 -54 6 -44" fill="#565b58"/>
    </svg>
  `;
}

function totemSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -98 60 122">
      <ellipse cx="0" cy="16" rx="22" ry="7" fill="#111" opacity=".25"/>
      <path d="M-12 14 -12 -70 12 -70 12 14Z" fill="#8a5a30"/>
      <path d="M-12 -70 12 -70 12 14 -12 14Z" fill="none" stroke="#5d3a1d" stroke-width="2"/>
      <circle cx="0" cy="-54" r="9" fill="#ffd23f"/>
      <path d="M-12 -36 12 -36 6 -24 -6 -24Z" fill="#e0483f"/>
      <path d="M-16 -76 0 -90 16 -76Z" fill="#3ba0c9"/>
      <circle cx="-4" cy="-54" r="2" fill="#3a2a18"/><circle cx="4" cy="-54" r="2" fill="#3a2a18"/>
    </svg>
  `;
}

// ---- ANIMAIS -------------------------------------------------------------
function coelhoSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -40 52 52">
      <ellipse cx="0" cy="8" rx="16" ry="5" fill="#111" opacity=".22"/>
      <ellipse cx="-2" cy="-4" rx="13" ry="9" fill="#d9ccc0"/>
      <circle cx="10" cy="-10" r="6" fill="#d9ccc0"/>
      <path d="M8 -16 6 -30 11 -16Z" fill="#cdbfb2"/>
      <path d="M12 -16 14 -30 16 -16Z" fill="#cdbfb2"/>
      <circle cx="12" cy="-11" r="1.4" fill="#222"/>
      <circle cx="-13" cy="-4" r="3.5" fill="#fff"/>
    </svg>
  `;
}

function veadoSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-34 -56 68 72">
      <ellipse cx="0" cy="12" rx="22" ry="6" fill="#111" opacity=".22"/>
      <path d="M-18 8 -16 -10 16 -10 18 8" fill="#b07a44"/>
      <ellipse cx="-2" cy="-12" rx="16" ry="10" fill="#bd854c"/>
      <path d="M14 -16 20 -34 24 -16Z" fill="#a96f3c"/>
      <path d="M18 -30 26 -36 M18 -28 12 -36" stroke="#7c4f28" stroke-width="2"/>
      <circle cx="18" cy="-16" r="2" fill="#241a12"/>
      <path d="M-16 8 -16 16 M-6 8 -6 16 M6 8 6 16 M16 8 16 16" stroke="#8a5e32" stroke-width="3"/>
    </svg>
  `;
}

function peixeSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -18 48 32">
      <path d="M-14 0 C-6 -10 8 -10 16 0 8 10 -6 10 -14 0Z" fill="#5fb6d6"/>
      <path d="M16 0 24 -7 24 7Z" fill="#3f93b4"/>
      <circle cx="-6" cy="-1" r="2" fill="#16323c"/>
      <path d="M-2 -6 6 -2 -2 2" fill="none" stroke="#bfeefc" stroke-width="1.5"/>
    </svg>
  `;
}

function passaroSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -26 44 40">
      <ellipse cx="0" cy="10" rx="10" ry="3" fill="#111" opacity=".2"/>
      <ellipse cx="0" cy="-4" rx="9" ry="7" fill="#e0764a"/>
      <circle cx="7" cy="-10" r="5" fill="#e88a5e"/>
      <path d="M11 -10 18 -12 12 -7Z" fill="#f4c542"/>
      <circle cx="8" cy="-11" r="1.2" fill="#201006"/>
      <path d="M-8 -6 -18 -12 -6 -2Z" fill="#c45f38"/>
    </svg>
  `;
}

function loboSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-34 -44 68 60">
      <ellipse cx="0" cy="12" rx="22" ry="6" fill="#111" opacity=".24"/>
      <path d="M-18 10 -16 -8 16 -8 18 10" fill="#6b7176"/>
      <ellipse cx="-2" cy="-10" rx="15" ry="10" fill="#7c8186"/>
      <path d="M-16 -16 -12 -28 -6 -16Z" fill="#6b7176"/>
      <path d="M12 -28 18 -10 6 -14Z" fill="#838a8f"/>
      <path d="M16 -14 26 -12 16 -7Z" fill="#5b6166"/>
      <circle cx="18" cy="-14" r="2" fill="#ffd23f"/>
      <path d="M-16 10 -16 16 M-6 10 -6 16 M6 10 6 16 M16 10 16 16" stroke="#5b6166" stroke-width="3"/>
    </svg>
  `;
}

const TILE_ASSETS = {
  "tile-grama": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("grass", { top: "#93df73", mid: "#5fb95f", bottom: "#348653" },
      `<path d="M-27 -4 C-17 -11 -6 -10 5 -4 17 2 28 0 36 -7" fill="none" stroke="#f4ffe6" stroke-opacity=".16" stroke-width="3" stroke-linecap="round"/>`)
  },
  "tile-areia": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("sand", { top: "#f1dc91", mid: "#d5b961", bottom: "#a98442" },
      `<path d="M-29 6 C-13 -2 4 12 24 2" fill="none" stroke="#fff7c9" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>`)
  },
  "tile-agua": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("water", { top: "#8ee7ff", mid: "#33aee2", bottom: "#1573ad" },
      `<path d="M-34 -5 C-24 -13 -12 -13 -2 -5 9 4 20 3 33 -7" fill="none" stroke="#e8fdff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`)
  },
  "tile-floresta": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("forest", { top: "#75cf66", mid: "#348f4e", bottom: "#1e663c" },
      `<path d="M-30 4 -20 -10 -10 4Z M2 5 12 -12 23 5Z" fill="#1f6b39" opacity=".5"/>`)
  },
  "tile-campo": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("field", { top: "#d6dd63", mid: "#9dbe4a", bottom: "#658d39" },
      `<path d="M-34 -1 C-18 8 -4 -9 12 0 23 7 31 3 39 -3" fill="none" stroke="#fff0a8" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>`)
  },
  "tile-pedras": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("stones", { top: "#b9c1bf", mid: "#818b86", bottom: "#5b645f" },
      `<path d="M-28 -1 -16 -9 -4 -3 -12 8Z M10 -7 27 -3 18 9 2 5Z" fill="#d6dbd8" opacity=".22"/>`)
  },
  "tile-colina": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("hill", { top: "#b7cf7b", mid: "#7ba65d", bottom: "#4d774c" },
      `<path d="M-35 4 C-20 -16 0 -13 17 -4 27 1 35 0 43 -6" fill="none" stroke="#eef4c1" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>`)
  },
  "tile-montanha": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("mountain", { top: "#9aa0a4", mid: "#6c7176", bottom: "#474c50" },
      `<path d="M-20 6 -4 -16 10 6Z" fill="#cfd4d6" opacity=".5"/><path d="M-4 -16 0 -8 8 -10" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`)
  },
  "tile-deserto": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("desert", { top: "#f6e2a6", mid: "#e6c879", bottom: "#caa455" },
      `<path d="M-30 4 C-14 -4 4 8 26 -2" fill="none" stroke="#fff3cf" stroke-opacity=".34" stroke-width="2"/>`)
  },
  "tile-neve": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("snow", { top: "#ffffff", mid: "#dfeaf2", bottom: "#b6c7d6" },
      `<circle cx="-12" cy="-2" r="2" fill="#fff"/><circle cx="8" cy="2" r="2" fill="#fff"/><circle cx="0" cy="-8" r="1.6" fill="#fff"/>`)
  },
  "tile-terra": {
    width: TILE_W, height: TILE_H,
    svg: tileSvg("dirt", { top: "#b78a5a", mid: "#946b40", bottom: "#6f4e2c" }, "")
  }
};

const OBJECT_ASSETS = {
  "casa-a": { width: 184, height: 140, svg: houseSvg({ light: "#e1b574", mid: "#bd7f46", dark: "#8d5635" }, { light: "#fa8771", mid: "#c84d50", dark: "#7f2c3c" }) },
  "casa-b": { width: 184, height: 140, svg: houseSvg({ light: "#d9c186", mid: "#ad8653", dark: "#765338" }, { light: "#e6a94f", mid: "#b76339", dark: "#6d362e" }) },
  "arvore-a": { width: 116, height: 140, svg: treeSvg("#247d43", "#78e070") },
  "arvore-b": { width: 116, height: 140, svg: treeSvg("#1f694f", "#65cfa4") },
  "arvore-pinho": { width: 92, height: 150, svg: pineSvg("#1f5a3a", "#3f8a5a") },
  "pedra-a": { width: 116, height: 82, svg: rockSvg() },
  "pedra-minerio": { width: 116, height: 82, svg: rockSvg("#cdb88a", "#9c8456", "#6e5a36") },
  "ponte": { width: 104, height: 64, svg: bridgeSvg() },
  "estr-fogueira": { width: 88, height: 84, svg: fogueiraSvg() },
  "estr-cabana": { width: 140, height: 110, svg: cabanaSvg() },
  "estr-poco": { width: 92, height: 100, svg: pocoSvg() },
  "estr-casa": { width: 184, height: 140, svg: houseSvg({ light: "#cfd6da", mid: "#9aa4ab", dark: "#6c757c" }, { light: "#7ec6e8", mid: "#3f8fc0", dark: "#2a5f86" }) },
  "estr-deposito": { width: 116, height: 100, svg: depositoSvg() },
  "estr-fazenda": { width: 112, height: 72, svg: fazendaSvg() },
  "estr-oficina": { width: 128, height: 116, svg: oficinaSvg() },
  "estr-muralha": { width: 80, height: 92, svg: muralhaSvg() },
  "estr-totem": { width: 60, height: 122, svg: totemSvg() },
  "animal-coelho": { width: 52, height: 52, svg: coelhoSvg() },
  "animal-veado": { width: 68, height: 72, svg: veadoSvg() },
  "animal-peixe": { width: 48, height: 32, svg: peixeSvg() },
  "animal-passaro": { width: 44, height: 40, svg: passaroSvg() },
  "animal-lobo": { width: 68, height: 60, svg: loboSvg() }
};

const VILLAGER_ASSETS = [
  villagerSvg({ light: "#8bd3ff", mid: "#397de2", dark: "#224d98" }, "#2e2119", { light: "#ffd8ac", mid: "#d89764" }),
  villagerSvg({ light: "#ffad9b", mid: "#e45e58", dark: "#96333d" }, "#442516", { light: "#f4c08b", mid: "#b97245" }),
  villagerSvg({ light: "#ffe38a", mid: "#e1aa31", dark: "#8f6620" }, "#35231a", { light: "#ffd3a0", mid: "#c98655" }),
  villagerSvg({ light: "#c5a9ff", mid: "#7a5be0", dark: "#4d3899" }, "#201b28", { light: "#f0b486", mid: "#9f5f41" }),
  villagerSvg({ light: "#94f2b8", mid: "#32ad70", dark: "#1d7051" }, "#5a3420", { light: "#ffcf94", mid: "#c77b4b" }),
  villagerSvg({ light: "#f6f3e9", mid: "#b9c2bd", dark: "#68756f" }, "#251c17", { light: "#e9a876", mid: "#9d5e3f" })
];

export const HABITANTE_TEXTURES = VILLAGER_ASSETS.map((_, index) => `habitante-${index}`);

export function registrarAssets(scene) {
  Object.entries({ ...TILE_ASSETS, ...OBJECT_ASSETS }).forEach(([key, asset]) => {
    scene.load.svg(key, svgData(asset.svg), { width: asset.width, height: asset.height });
  });

  VILLAGER_ASSETS.forEach((svg, index) => {
    scene.load.svg(`habitante-${index}`, svgData(svg), { width: 116, height: 136 });
  });
}
