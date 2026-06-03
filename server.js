import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 4173);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POOLSIDE_BASE_URL = "https://inference.poolside.ai/v1";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"]
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (req.method === "POST" && url.pathname === "/api/poolside/chat") {
      await handlePoolsideChat(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (erro) {
    sendText(res, erro.statusCode || 500, erro.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mundo Vivo rodando em http://127.0.0.1:${PORT}/`);
});

async function handlePoolsideChat(req, res) {
  const body = await readJson(req);
  const apiKey = String(body.apiKey || process.env.POOLSIDE_API_KEY || "").trim();
  const model = String(body.model || "poolside/laguna-xs.2").trim();
  const prompt = String(body.prompt || "").trim();

  if (!apiKey) {
    sendText(res, 400, "Poolside API key ausente.");
    return;
  }

  if (!prompt) {
    sendText(res, 400, "Prompt ausente.");
    return;
  }

  const content = await requestPoolside({ apiKey, model, prompt, stream: true })
    .catch(async error => {
      if (!error.poolsideStreamVazio) throw error;
      return requestPoolside({ apiKey, model, prompt, stream: false });
    });

  sendJson(res, 200, { content });
}

async function requestPoolside({ apiKey, model, prompt, stream }) {
  const resposta = await fetch(`${POOLSIDE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.45,
      max_tokens: 800,
      response_format: { type: "json_object" },
      stream
    })
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    const error = new Error(`Poolside respondeu ${resposta.status}: ${texto.slice(0, 400)}`);
    error.statusCode = resposta.status;
    throw error;
  }

  const content = resposta.headers.get("content-type")?.includes("text/event-stream")
    ? await readPoolsideStream(resposta)
    : extractPoolsideContent(JSON.parse(await resposta.text()));

  if (!content.trim()) {
    const error = new Error("Poolside nao retornou conteudo.");
    error.poolsideStreamVazio = stream;
    throw error;
  }

  return content;
}

async function serveStatic(pathname, res) {
  let normalizedPath = decodeURIComponent(pathname);
  if (normalizedPath === "/") normalizedPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, normalizedPath));

  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }

  const bytes = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES.get(path.extname(filePath)) || "application/octet-stream"
  });
  res.end(bytes);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readPoolsideStream(response) {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let sample = "";

  const processEvent = (event) => {
    const dataLines = event
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .filter(Boolean);

    if (!dataLines.length) return;

    const data = dataLines.join("\n");
    if (data === "[DONE]") return;
    sample += `${data}\n`;

    try {
      const chunk = JSON.parse(data);
      content += extractPoolsideContent(chunk);
    } catch {
      // Ignore incomplete stream fragments.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const event of events) {
      processEvent(event);
    }
  }

  if (buffer.trim()) {
    processEvent(buffer);
  }

  if (!content.trim()) {
    const error = new Error(`Poolside stream nao retornou conteudo.${sample ? ` Amostra: ${sample.slice(0, 220)}` : ""}`);
    error.poolsideStreamVazio = true;
    throw error;
  }

  return content;
}

function extractPoolsideContent(payload) {
  const choice = payload.choices?.[0] || {};

  return textFromContent(choice.delta?.content)
    || textFromContent(choice.delta?.reasoning_content)
    || textFromContent(choice.message?.content)
    || textFromContent(choice.text)
    || textFromContent(payload.output_text)
    || textFromContent(payload.content)
    || textFromContent(payload.output?.[0]?.content)
    || "";
}

function textFromContent(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(part => textFromContent(part?.text || part?.content || part)).join("");
  }

  return textFromContent(value.text || value.content);
}
