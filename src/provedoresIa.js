const STORAGE_KEY = "mundo_vivo_ia_config";
const LEGACY_POOLSIDE_KEY = "mundo_vivo_poolside_config";

export const IA_PROVIDERS = {
  POOLSIDE: "poolside",
  PUTER: "puter",
  INSTINTO: "instinto"
};

export const DEFAULT_POOLSIDE_MODEL = "poolside/laguna-xs.2";
export const DEFAULT_PUTER_MODEL = "gpt-5-nano";
export const POOLSIDE_BASE_URL = "https://inference.poolside.ai/v1";

let puterLoadPromise = null;

export function carregarIaConfig() {
  const fallback = {
    provider: IA_PROVIDERS.POOLSIDE,
    poolsideApiKey: "",
    poolsideModel: DEFAULT_POOLSIDE_MODEL,
    puterModel: DEFAULT_PUTER_MODEL
  };

  try {
    const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (salvo) {
      return normalizarConfig({ ...fallback, ...salvo });
    }

    const legado = JSON.parse(localStorage.getItem(LEGACY_POOLSIDE_KEY) || "null");
    if (legado) {
      return normalizarConfig({
        ...fallback,
        provider: legado.enabled === false ? IA_PROVIDERS.INSTINTO : IA_PROVIDERS.POOLSIDE,
        poolsideApiKey: legado.apiKey || "",
        poolsideModel: legado.model || DEFAULT_POOLSIDE_MODEL
      });
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function salvarIaConfig(config) {
  const normalizado = normalizarConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizado));
  return normalizado;
}

export function provedorEstaPronto(config = carregarIaConfig()) {
  if (config.provider === IA_PROVIDERS.INSTINTO) return true;
  if (config.provider === IA_PROVIDERS.PUTER) return Boolean(config.puterModel);
  if (config.provider === IA_PROVIDERS.POOLSIDE) {
    return Boolean(config.poolsideApiKey && config.poolsideModel);
  }

  return false;
}

export function nomeProvedor(provider = carregarIaConfig().provider) {
  const nomes = {
    [IA_PROVIDERS.POOLSIDE]: "Poolside Laguna",
    [IA_PROVIDERS.PUTER]: "Puter GPT",
    [IA_PROVIDERS.INSTINTO]: "Instinto local"
  };

  return nomes[provider] || nomes[IA_PROVIDERS.INSTINTO];
}

export async function completarComProvedor(prompt) {
  const config = carregarIaConfig();

  if (config.provider === IA_PROVIDERS.POOLSIDE) {
    return completarComPoolside(prompt, config);
  }

  if (config.provider === IA_PROVIDERS.PUTER) {
    return completarComPuter(prompt, config);
  }

  throw new Error("Instinto local selecionado.");
}

function normalizarConfig(config) {
  const provider = Object.values(IA_PROVIDERS).includes(config.provider)
    ? config.provider
    : IA_PROVIDERS.POOLSIDE;

  return {
    provider,
    poolsideApiKey: String(config.poolsideApiKey || config.apiKey || "").trim(),
    poolsideModel: String(config.poolsideModel || config.model || DEFAULT_POOLSIDE_MODEL).trim() || DEFAULT_POOLSIDE_MODEL,
    puterModel: String(config.puterModel || DEFAULT_PUTER_MODEL).trim() || DEFAULT_PUTER_MODEL
  };
}

async function completarComPoolside(prompt, config) {
  if (!config.poolsideApiKey) {
    throw new Error("Poolside sem API key.");
  }

  if (deveTentarProxyLocal()) {
    try {
      return await completarComPoolsideViaProxy(prompt, config);
    } catch (erroProxy) {
      if (!erroProxy.usarFallbackDireto) {
        notificarErroIa("Poolside", erroProxy.message);
        throw erroProxy;
      }
    }
  }

  try {
    return await completarComPoolsideDireto(prompt, config);
  } catch (erroDireto) {
    notificarErroIa("Poolside", erroDireto.message);
    throw erroDireto;
  }
}

async function completarComPoolsideViaProxy(prompt, config) {
  const resposta = await fetch("/api/poolside/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apiKey: config.poolsideApiKey,
      model: config.poolsideModel,
      prompt
    })
  });

  if (resposta.status === 404 || resposta.status === 405) {
    const erro = new Error("Proxy local nao encontrado.");
    erro.usarFallbackDireto = true;
    throw erro;
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`Proxy Poolside respondeu ${resposta.status}: ${detalhe.slice(0, 180)}`);
  }

  const payload = await resposta.json();

  if (!payload.content) {
    throw new Error("Proxy Poolside nao retornou conteudo.");
  }

  return payload.content;
}

async function completarComPoolsideDireto(prompt, config) {
  try {
    return await requisitarPoolsideDireto(prompt, config, true);
  } catch (erroStream) {
    if (!erroStream.poolsideStreamVazio) {
      throw erroStream;
    }
  }

  return requisitarPoolsideDireto(prompt, config, false);
}

async function requisitarPoolsideDireto(prompt, config, stream) {
  const resposta = await fetch(`${POOLSIDE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.poolsideApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(criarPayloadPoolside(prompt, config.poolsideModel, stream))
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`Poolside respondeu ${resposta.status}: ${detalhe.slice(0, 180)}`);
  }

  if (resposta.headers.get("content-type")?.includes("text/event-stream")) {
    return lerStreamPoolside(resposta);
  }

  const payload = await resposta.json();
  const texto = extrairConteudoPoolside(payload);

  if (!texto) {
    throw new Error("Poolside nao retornou conteudo.");
  }

  return texto;
}

function criarPayloadPoolside(prompt, model, stream = true) {
  return {
    model,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.45,
    max_tokens: 800,
    response_format: { type: "json_object" },
    stream
  };
}

async function lerStreamPoolside(resposta) {
  const reader = resposta.body?.getReader();
  if (!reader) {
    throw new Error("Poolside abriu stream sem reader.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let amostra = "";

  const processarEvento = (evento) => {
    const dados = evento
      .split(/\r?\n/)
      .map(linha => linha.trim())
      .filter(linha => linha.startsWith("data:"))
      .map(linha => linha.slice(5).trim())
      .filter(Boolean);

    if (!dados.length) return;

    const data = dados.join("\n");
    if (data === "[DONE]") return;
    amostra += `${data}\n`;

    try {
      const chunk = JSON.parse(data);
      content += extrairConteudoPoolside(chunk);
    } catch {
      // Alguns servidores enviam keep-alive ou fragmentos incompletos.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const eventos = buffer.split(/\r?\n\r?\n/);
    buffer = eventos.pop() || "";

    for (const evento of eventos) {
      processarEvento(evento);
    }
  }

  if (buffer.trim()) {
    processarEvento(buffer);
  }

  if (!content.trim()) {
    const erro = new Error(`Poolside stream nao retornou conteudo. Tentando sem stream.${amostra ? ` Amostra: ${amostra.slice(0, 220)}` : ""}`);
    erro.poolsideStreamVazio = true;
    throw erro;
  }

  return content;
}

function extrairConteudoPoolside(payload) {
  const escolha = payload.choices?.[0] || {};

  return textoDeConteudo(escolha.delta?.content)
    || textoDeConteudo(escolha.delta?.reasoning_content)
    || textoDeConteudo(escolha.message?.content)
    || textoDeConteudo(escolha.text)
    || textoDeConteudo(payload.output_text)
    || textoDeConteudo(payload.content)
    || textoDeConteudo(payload.output?.[0]?.content)
    || "";
}

function textoDeConteudo(valor) {
  if (!valor) return "";
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) {
    return valor.map(parte => textoDeConteudo(parte?.text || parte?.content || parte)).join("");
  }

  return textoDeConteudo(valor.text || valor.content);
}

function deveTentarProxyLocal() {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;

  return (hostname === "127.0.0.1" || hostname === "localhost") && port === "4173";
}

async function completarComPuter(prompt, config) {
  const puterClient = await carregarPuter();

  puterClient.quiet = true;

  const resposta = await puterClient.ai.chat(prompt, {
    model: config.puterModel
  });

  const texto = resposta?.message?.content;

  if (!texto) {
    const erro = new Error("Puter nao retornou conteudo.");
    notificarErroIa("Puter", erro.message);
    throw erro;
  }

  return texto;
}

async function carregarPuter() {
  if (globalThis.puter?.ai?.chat) {
    globalThis.puter.quiet = true;
    return globalThis.puter;
  }

  if (puterLoadPromise) return puterLoadPromise;

  puterLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => {
      if (globalThis.puter?.ai?.chat) {
        globalThis.puter.quiet = true;
        resolve(globalThis.puter);
      } else {
        reject(new Error("Puter carregou sem cliente de IA."));
      }
    };
    script.onerror = () => reject(new Error("Nao foi possivel carregar Puter."));
    document.head.appendChild(script);
  });

  return puterLoadPromise;
}

function notificarErroIa(provider, message) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;

  window.dispatchEvent(new CustomEvent("ia-error", {
    detail: {
      provider,
      message
    }
  }));
}
