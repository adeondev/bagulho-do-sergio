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
    sendText(res, 500, erro.message);
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
      stream: true
    })
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    sendText(res, resposta.status, texto.slice(0, 400));
    return;
  }

  const content = resposta.headers.get("content-type")?.includes("text/event-stream")
    ? await readPoolsideStream(resposta)
    : extractPoolsideContent(JSON.parse(await resposta.text()));

  sendJson(res, 200, { content });
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data);
        content += chunk.choices?.[0]?.delta?.content || "";
      } catch {
        // Ignore incomplete stream fragments.
      }
    }
  }

  return content;
}

function extractPoolsideContent(payload) {
  return payload.choices?.[0]?.message?.content
    || payload.choices?.[0]?.text
    || payload.output_text
    || payload.output?.[0]?.content?.[0]?.text
    || "";
}
