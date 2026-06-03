import { clamp } from "./utils.js";
import { carregarIaConfig, IA_PROVIDERS, nomeProvedor, provedorEstaPronto, salvarIaConfig } from "./provedoresIa.js";

let handlers = {};
let iaSaveTimer = null;

export function configurarPainel(h) {
  handlers = h || {};

  const lista = document.getElementById("lista-habitantes");
  lista.addEventListener("click", evento => {
    const botao = evento.target.closest("[data-habitante]");
    if (!botao || !handlers.aoSelecionarHabitante) return;
    handlers.aoSelecionarHabitante(botao.dataset.habitante);
  });

  configurarIaForm();
  configurarControles();
}

function configurarControles() {
  const velControls = document.getElementById("vel-controls");
  velControls?.addEventListener("click", e => {
    const btn = e.target.closest("[data-vel]");
    if (!btn) return;
    velControls.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("is-on"));
    btn.classList.add("is-on");
    handlers.aoMudarVelocidade?.(Number(btn.dataset.vel));
  });

  const conc = document.getElementById("ia-concorrencia");
  const concValor = document.getElementById("conc-valor");
  conc?.addEventListener("input", () => {
    if (concValor) concValor.textContent = conc.value;
    handlers.aoMudarConcorrencia?.(Number(conc.value));
  });

  document.getElementById("btn-salvar")?.addEventListener("click", () => handlers.aoSalvar?.());
  document.getElementById("btn-novo")?.addEventListener("click", () => {
    if (confirm("Apagar o mundo atual e comecar um novo?")) handlers.aoNovoMundo?.();
  });
}

export function atualizarPainel(ctx) {
  const { mundo, habitantes, selecionado } = ctx;
  document.getElementById("dia").textContent = mundo.dia;
  document.getElementById("populacao").textContent = habitantes.filter(h => h.vivo).length;
  document.getElementById("era").textContent = ctx.eraNome || "-";
  document.getElementById("status-simulacao").textContent = ctx.pausado ? "Pausado" : (ctx.guerra ? "Guerra" : "Rodando");
  atualizarStatusIa();

  renderizarTribos(ctx);
  renderizarEstruturas(ctx);
  renderizarListaHabitantes(ctx);
  if (selecionado) mostrarHabitante(selecionado, mundo);
}

function renderizarTribos(ctx) {
  const el = document.getElementById("lista-tribos");
  if (!el) return;
  el.innerHTML = (ctx.tribos || []).map(t => `
    <div class="tribo-row ${ctx.guerra ? "em-guerra" : ""}">
      <span class="tribo-dot" style="background:#${t.cor.toString(16).padStart(6, "0")}"></span>
      <span class="tribo-nome">${escaparHtml(t.nome)}</span>
      <span class="tribo-meta">${t.populacao} hab · ${t.estruturas} estr · moral ${t.moralMedia}</span>
    </div>
  `).join("");
}

function renderizarEstruturas(ctx) {
  const el = document.getElementById("estruturas-resumo");
  if (!el || !ctx.estruturas) return;
  const lista = ctx.estruturas.lista || [];
  if (!lista.length) { el.textContent = "Nenhuma estrutura construida ainda."; return; }
  const contagem = {};
  lista.forEach(e => { contagem[e.def.nome] = (contagem[e.def.nome] || 0) + 1; });
  el.innerHTML = Object.entries(contagem).map(([n, q]) => `<span class="chip">${escaparHtml(n)} ${q}</span>`).join(" ");
}

function renderizarListaHabitantes(ctx) {
  const lista = document.getElementById("lista-habitantes");
  lista.innerHTML = ctx.habitantes.map(h => `
    <button class="habitante-row ${ctx.selecionado === h ? "is-selected" : ""} ${h.vivo ? "" : "morto"}" data-habitante="${escaparAttr(h.nome)}" title="Clique para voar a camera ate ${escaparAttr(h.nome)}">
      <span class="row-main">
        <strong><span class="tribo-dot mini" style="background:#${h.corTribo().toString(16).padStart(6, "0")}"></span>${escaparHtml(h.nome)} ${h.acaoPendente ? (EMOJI_TAREFA[h.acaoPendente.tarefa] || "") : ""}</strong>
        <em>${escaparHtml(h.estadoAtual())}</em>
      </span>
      <span class="row-meta">
        <span>${escaparHtml(h.objetivoAtual)}</span>
        <span>${escaparHtml(h.descricaoLocal(ctx.mundo))} · M${h.inventario.madeira} P${h.inventario.pedra} C${h.inventario.comida}${h.ferramentas.size ? ` · ${h.ferramentas.size}🛠` : ""}</span>
      </span>
      <span class="mini-metricas">
        ${miniBar("F", h.fome, "necessidade")}
        ${miniBar("S", h.sede, "necessidade")}
        ${miniBar("E", h.energia, "vital")}
      </span>
    </button>
  `).join("");
}

const EMOJI_TAREFA = {
  beber: "💧", comer: "🍖", coletar: "🪵", construir: "🏠", craftar: "🛠️",
  cacar: "🏹", atacar: "⚔️", descansar: "😴", socializar: "💬", explorar: "🧭", observar: "👁️"
};

const EMOJI_FERRAMENTA = { machado: "🪓", picareta: "⛏️", lanca: "🔱", espada: "🗡️" };

function descreverAgora(h, mundo) {
  if (!h.vivo) return "💀 <b>Morreu.</b> Faz parte do passado deste mundo.";

  const acao = h.acaoPendente;
  const emoji = EMOJI_TAREFA[acao?.tarefa] || "•";
  const oQueFaz = acao
    ? `${emoji} <b>${escaparHtml(acao.acao)}</b>`
    : `${EMOJI_TAREFA[h.caminho.length ? "explorar" : "observar"]} <b>${escaparHtml(h.objetivoAtual)}</b>`;

  let destino = "";
  if (acao?.alvoHabitante) destino = `mirando <b>${escaparHtml(acao.alvoHabitante)}</b>`;
  else if (acao?.destinoLocalId) destino = `indo até <b>${escaparHtml(mundo.buscarLocalPorId(acao.destinoLocalId)?.nome || acao.destinoLocalId)}</b>`;
  else if (acao?.destinoTile) destino = `indo até (${acao.destinoTile.x}, ${acao.destinoTile.y})`;

  const rota = h.caminho.length ? `🚶 ${h.caminho.length} tiles restantes` : "📍 parado";
  return [
    oQueFaz + (destino ? ` — ${destino}` : ""),
    rota,
    `💭 <i>${escaparHtml(h.pensamento)}</i>`
  ].join("<br>");
}

function listaRelacoes(h) {
  const ent = Object.entries(h.relacoes).filter(([, v]) => Math.abs(v) >= 8);
  ent.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (!ent.length) return `<span class="rel-vazio">Ainda nao formou lacos fortes.</span>`;
  return ent.slice(0, 7).map(([nome, v]) => {
    const tipo = v >= 45 ? "ama" : v >= 8 ? "gosta" : v <= -45 ? "odeia" : "evita";
    const icone = v >= 45 ? "❤️" : v >= 8 ? "🙂" : v <= -45 ? "💢" : "😠";
    return `<span class="rel-tag ${v >= 0 ? "pos" : "neg"}">${icone} ${escaparHtml(nome)} <em>${v > 0 ? "+" : ""}${Math.round(v)}</em> <small>${tipo}</small></span>`;
  }).join("");
}

export function mostrarHabitante(h, mundo) {
  const detalhe = document.getElementById("info-habitante");
  if (!h) { detalhe.innerHTML = `<div class="empty-state">Clique em um habitante para voar a camera ate ele.</div>`; return; }

  const ferramentas = [...h.ferramentas].map(f => `${EMOJI_FERRAMENTA[f] || "🛠️"} ${f}`).join("  ") || "nenhuma";
  const acoes = (h.historicoAcoes || []).slice(-5).reverse()
    .map(a => `<li>${escaparHtml(a.acao)}${a.motivo ? ` <small>— ${escaparHtml(String(a.motivo).slice(0, 70))}</small>` : ""}</li>`).join("");

  detalhe.innerHTML = `
    <div class="habitante-detalhe">
      <div class="detalhe-topo">
        <div>
          <h3><span class="tribo-dot mini" style="background:#${h.corTribo().toString(16).padStart(6, "0")}"></span>${escaparHtml(h.nome)}</h3>
          <p>${escaparHtml(h.nomeTribo())} · ${h.idade} anos · ${escaparHtml(h.personalidade)}</p>
        </div>
        <span class="badge ${h.vivo ? "" : "badge-morto"}">${h.vivo ? h.estadoAtual() : "morto"}</span>
      </div>

      <div class="agora">${descreverAgora(h, mundo)}</div>

      <div class="metricas">
        ${barra("Fome", h.fome, "necessidade")}
        ${barra("Sede", h.sede, "necessidade")}
        ${barra("Energia", h.energia, "vital")}
        ${barra("Saude", h.saude, "vital")}
        ${barra("Moral", h.moral, "vital")}
      </div>

      <div class="inv-grid">
        <span title="Madeira">🪵 ${h.inventario.madeira}</span>
        <span title="Pedra">🪨 ${h.inventario.pedra}</span>
        <span title="Comida">🍖 ${h.inventario.comida}</span>
        <span title="Posicao">📌 ${h.xTile},${h.yTile}</span>
      </div>

      <div class="subsecao">
        <h4>Ferramentas</h4>
        <p>${ferramentas}</p>
      </div>

      <div class="subsecao">
        <h4>Relacoes (amor / odio)</h4>
        <div class="rel-lista">${listaRelacoes(h)}</div>
      </div>

      <div class="subsecao">
        <h4>Ultimas acoes</h4>
        <ul class="acoes-lista">${acoes || "<li>Nenhuma ainda.</li>"}</ul>
      </div>

      <div class="subsecao">
        <h4>Memorias recentes</h4>
        <p>${h.memorias.slice(-5).map(escaparHtml).join("<br>") || "Nenhuma"}</p>
      </div>

      <div class="subsecao">
        <h4>Conhecimentos</h4>
        <p>${h.conhecimentos.slice(-8).map(escaparHtml).join("<br>")}</p>
      </div>
    </div>
  `;
}

// ---- IA form -------------------------------------------------------------
function configurarIaForm() {
  const config = carregarIaConfig();
  const provider = document.getElementById("ia-provider");
  const poolsideApiKey = document.getElementById("poolside-api-key");
  const poolsideModel = document.getElementById("poolside-model");
  const puterModel = document.getElementById("puter-model");
  const save = document.getElementById("btn-save-ia");

  provider.value = config.provider;
  poolsideApiKey.value = config.poolsideApiKey;
  poolsideModel.value = config.poolsideModel;
  puterModel.value = config.puterModel;
  atualizarCamposIa(config.provider);
  atualizarStatusIa();

  provider.addEventListener("change", () => {
    const atualizado = salvarIaConfig({ ...lerIaForm(), provider: provider.value });
    atualizarCamposIa(atualizado.provider);
    atualizarStatusIa();
    handlers.aoConfigIaMudou?.(atualizado);
  });

  [poolsideApiKey, poolsideModel, puterModel].forEach(input => {
    input.addEventListener("input", salvarIaFormComDebounce);
    input.addEventListener("change", () => {
      const atualizado = salvarIaConfig(lerIaForm());
      atualizarStatusIa();
      handlers.aoConfigIaMudou?.(atualizado);
    });
  });

  save.addEventListener("click", () => {
    const atualizado = salvarIaConfig(lerIaForm());
    atualizarCamposIa(atualizado.provider);
    atualizarStatusIa();
    handlers.aoConfigIaMudou?.(atualizado);
  });
}

function salvarIaFormComDebounce() {
  clearTimeout(iaSaveTimer);
  iaSaveTimer = setTimeout(() => { salvarIaConfig(lerIaForm()); atualizarStatusIa(); }, 450);
}

function lerIaForm() {
  return {
    provider: document.getElementById("ia-provider").value,
    poolsideApiKey: document.getElementById("poolside-api-key").value,
    poolsideModel: document.getElementById("poolside-model").value,
    puterModel: document.getElementById("puter-model").value
  };
}

function atualizarCamposIa(provider) {
  document.getElementById("poolside-fields").classList.toggle("is-hidden", provider !== IA_PROVIDERS.POOLSIDE);
  document.getElementById("puter-fields").classList.toggle("is-hidden", provider !== IA_PROVIDERS.PUTER);
}

function atualizarStatusIa() {
  const config = carregarIaConfig();
  const status = document.getElementById("ia-status");
  if (!status) return;
  const pronto = provedorEstaPronto(config);
  if (config.provider === IA_PROVIDERS.INSTINTO) {
    status.textContent = "Instinto local: o mundo roda sem chamadas externas.";
    return;
  }
  status.textContent = pronto
    ? `${nomeProvedor(config.provider)} pronto. Varias IAs decidem ao mesmo tempo.`
    : `${nomeProvedor(config.provider)} precisa de config. Enquanto isso, instinto assume.`;
}

export function setEstadoPausa(pausado) {
  const botao = document.getElementById("btn-pause");
  botao.textContent = pausado ? "Retomar" : "Pausar";
  document.body.classList.toggle("is-paused", pausado);
}

export function adicionarEvento(mundo, texto) {
  const div = document.getElementById("eventos");
  const evento = document.createElement("div");
  evento.className = "evento";
  evento.innerHTML = `<span>Dia ${mundo.dia}</span>${escaparHtml(texto)}`;
  div.prepend(evento);
  while (div.children.length > 46) div.lastElementChild.remove();
}

// ---- helpers -------------------------------------------------------------
function barra(label, valor, tipo) {
  const v = clamp(Math.round(valor), 0, 100);
  const alerta = tipo === "necessidade" ? v > 72 : v < 34;
  return `
    <div class="barra ${alerta ? "is-alert" : ""}">
      <span><b>${label}</b><em>${v}</em></span>
      <i><u style="width:${v}%"></u></i>
    </div>
  `;
}

function miniBar(label, valor, tipo) {
  const v = clamp(Math.round(valor), 0, 100);
  const alerta = tipo === "necessidade" ? v > 72 : v < 34;
  return `
    <span class="mini-bar ${alerta ? "is-alert" : ""}" title="${label}: ${v}">
      <b>${label}</b><i><u style="width:${v}%"></u></i>
    </span>
  `;
}

function escaparHtml(valor) {
  return String(valor)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escaparAttr(valor) {
  return escaparHtml(valor).replace(/`/g, "&#096;");
}
