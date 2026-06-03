import { clamp } from "./utils.js";
import { carregarIaConfig, IA_PROVIDERS, nomeProvedor, provedorEstaPronto, salvarIaConfig } from "./provedoresIa.js";

let handlers = {
  aoSelecionarHabitante: null,
  aoConfigIaMudou: null
};
let iaSaveTimer = null;

export function configurarPainel({ aoSelecionarHabitante, aoConfigIaMudou }) {
  handlers.aoSelecionarHabitante = aoSelecionarHabitante;
  handlers.aoConfigIaMudou = aoConfigIaMudou;

  const lista = document.getElementById("lista-habitantes");
  lista.addEventListener("click", evento => {
    const botao = evento.target.closest("[data-habitante]");
    if (!botao || !handlers.aoSelecionarHabitante) return;
    handlers.aoSelecionarHabitante(botao.dataset.habitante);
  });

  configurarIaForm();
}

export function atualizarPainel(mundo, habitantes, estado = {}) {
  document.getElementById("dia").textContent = mundo.dia;
  document.getElementById("populacao").textContent = habitantes.filter(h => h.vivo).length;
  document.getElementById("status-simulacao").textContent = estado.pausado ? "Pausado" : "Rodando";
  atualizarStatusIa();

  renderizarListaHabitantes(mundo, habitantes, estado.selecionado);

  if (estado.selecionado) {
    mostrarHabitante(estado.selecionado, mundo);
  }
}

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
    const atualizado = salvarIaConfig({
      ...lerIaForm(),
      provider: provider.value
    });
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
  iaSaveTimer = setTimeout(() => {
    salvarIaConfig(lerIaForm());
    atualizarStatusIa();
  }, 450);
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
  const pronto = provedorEstaPronto(config);

  if (config.provider === IA_PROVIDERS.INSTINTO) {
    status.textContent = "Instinto local: sem chamada externa.";
    return;
  }

  status.textContent = pronto
    ? `${nomeProvedor(config.provider)} pronto. Use npm start para proxy local se o navegador bloquear CORS.`
    : `${nomeProvedor(config.provider)} precisa de configuracao. NPCs aguardam sem instinto.`;
}

export function setEstadoPausa(pausado) {
  const botao = document.getElementById("btn-pause");
  botao.textContent = pausado ? "Retomar" : "Pausar";
  botao.setAttribute("aria-label", pausado ? "Retomar simulacao" : "Pausar simulacao");
  document.body.classList.toggle("is-paused", pausado);
}

export function adicionarEvento(mundo, texto) {
  const div = document.getElementById("eventos");
  const evento = document.createElement("div");

  evento.className = "evento";
  evento.innerHTML = `<span>Dia ${mundo.dia}</span>${escaparHtml(texto)}`;
  div.prepend(evento);

  while (div.children.length > 42) {
    div.lastElementChild.remove();
  }
}

export function mostrarHabitante(h, mundo) {
  const detalhe = document.getElementById("info-habitante");

  if (!h) {
    detalhe.innerHTML = `<div class="empty-state">Clique em um habitante.</div>`;
    return;
  }

  const locaisConhecidos = h.mapaConhecido
    .map(id => mundo?.buscarLocalPorId(id)?.nome ?? id)
    .join("<br>");

  detalhe.innerHTML = `
    <div class="habitante-detalhe">
      <div class="detalhe-topo">
        <div>
          <h3>${escaparHtml(h.nome)}</h3>
          <p>${escaparHtml(h.estadoAtual())} em ${escaparHtml(h.descricaoLocal(mundo))}</p>
        </div>
        <span class="badge">${h.caminho.length ? `${h.caminho.length} tiles` : "livre"}</span>
      </div>

      <div class="metricas">
        ${barra("Fome", h.fome, "necessidade")}
        ${barra("Sede", h.sede, "necessidade")}
        ${barra("Energia", h.energia, "vital")}
        ${barra("Saude", h.saude, "vital")}
      </div>

      <dl class="ficha">
        <dt>Idade</dt><dd>${h.idade}</dd>
        <dt>Personalidade</dt><dd>${escaparHtml(h.personalidade)}</dd>
        <dt>Objetivo</dt><dd>${escaparHtml(h.objetivoAtual)}</dd>
        <dt>Pensamento</dt><dd>${escaparHtml(h.pensamento)}</dd>
        <dt>Mapa mental</dt><dd>${h.tilesConhecidos.size} tiles vistos</dd>
      </dl>

      <div class="subsecao">
        <h4>Lugares conhecidos</h4>
        <p>${locaisConhecidos || "Nenhum"}</p>
      </div>

      <div class="subsecao">
        <h4>Conhecimentos</h4>
        <p>${h.conhecimentos.map(escaparHtml).join("<br>")}</p>
      </div>

      <div class="subsecao">
        <h4>Memorias recentes</h4>
        <p>${h.memorias.slice(-6).map(escaparHtml).join("<br>") || "Nenhuma"}</p>
      </div>
    </div>
  `;
}

function renderizarListaHabitantes(mundo, habitantes, selecionado) {
  const lista = document.getElementById("lista-habitantes");

  lista.innerHTML = habitantes.map(h => `
    <button class="habitante-row ${selecionado === h ? "is-selected" : ""}" data-habitante="${escaparAttr(h.nome)}">
      <span class="row-main">
        <strong>${escaparHtml(h.nome)}</strong>
        <em>${escaparHtml(h.estadoAtual())}</em>
      </span>
      <span class="row-meta">
        <span>${escaparHtml(h.objetivoAtual)}</span>
        <span>${escaparHtml(h.descricaoLocal(mundo))} ${h.caminho.length ? `| rota ${h.caminho.length}` : "| sem rota"}</span>
      </span>
      <span class="mini-metricas">
        ${miniBar("F", h.fome, "necessidade")}
        ${miniBar("S", h.sede, "necessidade")}
        ${miniBar("E", h.energia, "vital")}
      </span>
    </button>
  `).join("");
}

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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escaparAttr(valor) {
  return escaparHtml(valor).replace(/`/g, "&#096;");
}
