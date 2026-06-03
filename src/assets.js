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
        <filter id="${id}-shadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#111" flood-opacity=".28"/>
        </filter>
      </defs>
      <path d="M0 -24 48 0 0 24 -48 0Z" fill="url(#${id}-base)" filter="url(#${id}-shadow)"/>
      <path d="M-48 0 0 24 48 0" fill="none" stroke="#161616" stroke-opacity=".18" stroke-width="1.4"/>
      <path d="M0 -24 48 0 0 24 -48 0Z" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/>
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
        <path d="M17 -41 31 -48 31 -36 17 -29Z" fill="#28444b" opacity=".55"/>
        <path d="M-42 -47 -26 -39 -26 -24 -42 -32Z" fill="#f9d989" opacity=".85"/>
        <path d="M-40 -46 -28 -40 -28 -29 -40 -35Z" fill="#28444b" opacity=".55"/>
        <path d="M28 -88 43 -80 43 -61 28 -69Z" fill="#674130"/>
        <path d="M25 -90 45 -80 43 -76 28 -85Z" fill="#a96e4c"/>
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
        <filter id="treeShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#0a1710" flood-opacity=".38"/>
        </filter>
      </defs>
      <ellipse cx="0" cy="10" rx="38" ry="12" fill="#111" opacity=".2"/>
      <g filter="url(#treeShadow)">
        <path d="M-11 -48 11 -48 17 8 -16 8Z" fill="url(#trunk)"/>
        <path d="M-2 -96 C-40 -92 -52 -58 -30 -42 -52 -28 -34 -2 -6 -14 12 2 47 -8 35 -34 60 -43 44 -78 15 -76 12 -91 5 -97 -2 -96Z" fill="url(#leafA)"/>
        <path d="M-28 -61 C-10 -79 20 -74 32 -51" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/>
        <path d="M-5 -44 C2 -34 11 -18 15 5" fill="none" stroke="#2f1b12" stroke-opacity=".32" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}

function rockSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -58 116 82">
      <defs>
        <linearGradient id="rockBody" x1="-45" y1="-48" x2="48" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#c0c6ca"/>
          <stop offset=".55" stop-color="#878f96"/>
          <stop offset="1" stop-color="#565f66"/>
        </linearGradient>
        <filter id="rockShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#111" flood-opacity=".35"/>
        </filter>
      </defs>
      <ellipse cx="0" cy="11" rx="42" ry="12" fill="#111" opacity=".18"/>
      <path d="M-46 -4 -31 -32 -4 -47 31 -33 48 -5 35 14 -16 18Z" fill="url(#rockBody)" filter="url(#rockShadow)"/>
      <path d="M-27 -29 -10 -6 0 -44" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="4" stroke-linecap="round"/>
      <path d="M8 -39 24 -10 40 -4" fill="none" stroke="#32393f" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>
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
        <path d="M-12 -72 C-4 -67 8 -67 16 -72" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}

const TILE_ASSETS = {
  "tile-grama": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("grass", { top: "#93df73", mid: "#5fb95f", bottom: "#348653" },
      `<path d="M-27 -4 C-17 -11 -6 -10 5 -4 17 2 28 0 36 -7" fill="none" stroke="#f4ffe6" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>`)
  },
  "tile-areia": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("sand", { top: "#f1dc91", mid: "#d5b961", bottom: "#a98442" },
      `<path d="M-29 6 C-13 -2 4 12 24 2" fill="none" stroke="#fff7c9" stroke-opacity=".32" stroke-width="2" stroke-linecap="round"/>`)
  },
  "tile-agua": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("water", { top: "#8ee7ff", mid: "#33aee2", bottom: "#1573ad" },
      `<path d="M-34 -5 C-24 -13 -12 -13 -2 -5 9 4 20 3 33 -7" fill="none" stroke="#e8fdff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
       <path d="M-22 9 C-8 3 9 12 25 4" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>`)
  },
  "tile-floresta": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("forest", { top: "#75cf66", mid: "#348f4e", bottom: "#1e663c" },
      `<path d="M-30 4 -20 -10 -10 4Z M2 5 12 -12 23 5Z" fill="#1f6b39" opacity=".55"/>`)
  },
  "tile-campo": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("field", { top: "#d6dd63", mid: "#9dbe4a", bottom: "#658d39" },
      `<path d="M-34 -1 C-18 8 -4 -9 12 0 23 7 31 3 39 -3" fill="none" stroke="#fff0a8" stroke-opacity=".34" stroke-width="3" stroke-linecap="round"/>`)
  },
  "tile-pedras": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("stones", { top: "#b9c1bf", mid: "#818b86", bottom: "#5b645f" },
      `<path d="M-28 -1 -16 -9 -4 -3 -12 8Z M10 -7 27 -3 18 9 2 5Z" fill="#d6dbd8" opacity=".25"/>`)
  },
  "tile-colina": {
    width: TILE_W,
    height: TILE_H,
    svg: tileSvg("hill", { top: "#b7cf7b", mid: "#7ba65d", bottom: "#4d774c" },
      `<path d="M-35 4 C-20 -16 0 -13 17 -4 27 1 35 0 43 -6" fill="none" stroke="#eef4c1" stroke-opacity=".32" stroke-width="3" stroke-linecap="round"/>`)
  }
};

const OBJECT_ASSETS = {
  "casa-a": { width: 184, height: 140, svg: houseSvg({ light: "#e1b574", mid: "#bd7f46", dark: "#8d5635" }, { light: "#fa8771", mid: "#c84d50", dark: "#7f2c3c" }) },
  "casa-b": { width: 184, height: 140, svg: houseSvg({ light: "#d9c186", mid: "#ad8653", dark: "#765338" }, { light: "#e6a94f", mid: "#b76339", dark: "#6d362e" }) },
  "arvore-a": { width: 116, height: 140, svg: treeSvg("#247d43", "#78e070") },
  "arvore-b": { width: 116, height: 140, svg: treeSvg("#1f694f", "#65cfa4") },
  "pedra-a": { width: 116, height: 82, svg: rockSvg() }
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
