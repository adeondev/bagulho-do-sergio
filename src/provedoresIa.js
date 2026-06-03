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
  const resposta = await fetch(`${POOLSIDE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.poolsideApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(criarPayloadPoolside(prompt, config.poolsideModel))
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

function criarPayloadPoolside(prompt, model) {
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
    stream: true
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() || "";

    for (const linha of linhas) {
      const trimmed = linha.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data);
        content += chunk.choices?.[0]?.delta?.content || "";
      } catch {
        // Chunk parcial ou keep-alive invalido; o proximo pacote completa.
      }
    }
  }

  if (!content.trim()) {
    throw new Error("Poolside stream nao retornou conteudo.");
  }

  return content;
}

function extrairConteudoPoolside(payload) {
  return payload.choices?.[0]?.message?.content
    || payload.choices?.[0]?.text
    || payload.output_text
    || payload.output?.[0]?.content?.[0]?.text
    || "";
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
