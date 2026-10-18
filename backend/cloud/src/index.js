/**
 * SenseVision - Backend na nuvem (Cloudflare Worker)
 *
 *   Raspberry --POST /api/upload--> guarda a última foto (KV)
 *   Site      --GET  /api/status--> "tem foto nova?" (polling leve)
 *   Site      --POST /api/ocr-----> lê a conta da última foto com o Gemini
 *   Site      --/api/auth/*, /api/history--> contas e histórico por usuário (auth.js + store.js)
 *
 * A chave do Gemini fica só aqui (secret), nunca no navegador.
 */
import { handleAuthRoutes } from "./auth.js";

// Rápido primeiro; se falhar ou demorar, tenta o próximo
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
const MAX_BYTES = 5 * 1024 * 1024;

const PROMPT = `Você é um OCR especializado em exercícios matemáticos escolares.
Analise a imagem e leia a expressão matemática principal (manuscrita ou impressa).
Responda APENAS com a expressão em TEXTO SIMPLES, sem LaTeX, sem "$", sem "=" e sem o resultado.
Use somente: números, + - * / , ^ para potência, sqrt(x) para raiz quadrada e parênteses ( ).
Exemplos de resposta: 3 + 2 | (4 + 2) * 3 | sqrt(9) + 2^3 | ((1 - 1) + 2) / 2
Se houver várias contas, responda só a mais destacada ou a primeira.
Se não houver nenhuma expressão matemática clara, responda apenas: NENHUMA`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

async function handleUpload(req, env) {
  if (!env.UPLOAD_TOKEN || req.headers.get("X-Token") !== env.UPLOAD_TOKEN) {
    return json({ status: "error", message: "Token inválido" }, 401);
  }
  const body = await req.arrayBuffer();
  if (body.byteLength < 1000) return json({ status: "error", message: "Corpo vazio ou pequeno demais" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ status: "error", message: "Foto grande demais (máx 5 MB)" }, 413);

  const filename = (req.headers.get("X-Filename") || `captura_${Date.now()}.jpg`)
    .replace(/[^\w.\-]/g, "_")
    .slice(0, 80);
  const meta = { filename, timestamp: Date.now() / 1000, size: body.byteLength };

  await env.PHOTOS.put("latest", body);
  await env.PHOTOS.put("meta", JSON.stringify(meta)); // meta por último: só anuncia foto já gravada
  return json({ status: "ok", filename });
}

async function handleStatus(env) {
  const meta = await env.PHOTOS.get("meta", "json");
  return json({
    status: "ok",
    has_photo: !!meta,
    timestamp: meta?.timestamp ?? 0,
    filename: meta?.filename ?? null,
  });
}

async function handleOcr(env) {
  const photo = await env.PHOTOS.get("latest", "arrayBuffer");
  if (!photo) return json({ status: "empty", message: "Nenhuma foto disponível." }, 404);
  const apiKey = (env.GEMINI_API_KEY || "").trim(); // remove espaço/quebra de linha colados junto
  if (!apiKey) return json({ status: "error", message: "GEMINI_API_KEY não configurada" }, 500);

  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: "image/jpeg", data: toBase64(photo) } },
        { text: PROMPT },
      ],
    }],
    // Resposta curta: a tarefa é só ler "3 + 2" (folga de tokens p/ modelos que "pensam")
    generationConfig: { temperature: 0, maxOutputTokens: 256 },
  });

  // Uma tentativa por modelo (15s cada); 503/429/timeout/404 passam para o próximo
  const t0 = Date.now();
  let resp;
  let used = "";
  for (let tentativa = 1; tentativa <= MODELS.length; tentativa++) {
    const MODEL = MODELS[tentativa - 1];
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch (e) {
      console.error("Gemini timeout/erro de rede", tentativa, String(e));
      resp = null;
      continue;
    }
    used = MODEL;
    if (![503, 429, 404].includes(resp.status)) break;
  }

  if (!resp) {
    return json({ status: "error", message: "Gemini não respondeu a tempo", ms: Date.now() - t0 }, 504);
  }
  if (!resp.ok) {
    const detail = await resp.text();
    console.error("Gemini erro", resp.status, detail);
    return json({ status: "error", message: `Gemini respondeu ${resp.status}`, ms: Date.now() - t0, detail: detail.slice(0, 400) }, 502);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  return json({ status: "ok", text, model: used });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname } = url;
    try {
      const authResponse = await handleAuthRoutes(req, env, url);
      if (authResponse) return authResponse;
      if (req.method === "POST" && pathname === "/api/upload") return await handleUpload(req, env);
      if (req.method === "GET" && pathname === "/api/status") return await handleStatus(env);
      if (req.method === "POST" && pathname === "/api/ocr") return await handleOcr(env);
      return json({ status: "error", message: "Rota não encontrada" }, 404);
    } catch (e) {
      console.error(e);
      return json({ status: "error", message: String(e) }, 500);
    }
  },
};
