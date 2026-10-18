/**
 * Cadastro, login e histórico por usuário.
 * Senhas: PBKDF2-SHA256 com sal aleatório (nunca em texto). Sessão: cookie HttpOnly.
 * O armazenamento vem de store.js (trocável por um banco de dados).
 */
import { createStore } from "./store.js";

const COOKIE = "sv_session";
const SESSION_TTL = 7 * 24 * 3600;
const PBKDF2_ITERS = 100000; // máximo aceito pelo Workers
const MAX_FAILS = 8;
const FAIL_WINDOW = 15 * 60;
const MAX_HISTORY_TEXT = 200;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function pbkdf2(password, salt, iters) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iters }, key, 256);
  return new Uint8Array(bits);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(req, name) {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const sessionCookie = (token, maxAge) =>
  `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

async function readBody(req) {
  const text = await req.text();
  if (text.length > 4096) throw new Error("Corpo grande demais");
  try { return JSON.parse(text || "{}"); } catch { throw new Error("JSON inválido"); }
}

// Bloqueia pedidos vindos de outro site (proteção CSRF)
function sameOrigin(req, url) {
  const origin = req.headers.get("Origin");
  return !origin || origin === url.origin;
}

const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

async function currentUser(req, store) {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const session = await store.getSession(await sha256Hex(token));
  return session ? { id: session.uid, email: session.email, name: session.name } : null;
}

async function startSession(store, user) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await store.createSession(await sha256Hex(token), { uid: user.id, email: user.email, name: user.name }, SESSION_TTL);
  return sessionCookie(token, SESSION_TTL);
}

async function register(req, store) {
  const body = await readBody(req);
  const name = String(body.name || "").trim().slice(0, 60);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name) return json({ error: "Informe seu nome." }, 400);
  if (!validEmail(email)) return json({ error: "E-mail inválido." }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "A senha precisa ter de 8 a 128 caracteres." }, 400);
  if (await store.getUserByEmail(email)) return json({ error: "Este e-mail já tem cadastro. Entre na sua conta." }, 409);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
  const user = { id: crypto.randomUUID(), email, name, salt: b64(salt), hash: b64(hash), iters: PBKDF2_ITERS, createdAt: Date.now() };
  try {
    await store.createUser(user);
  } catch (e) {
    if (String(e.message).includes("duplicate")) return json({ error: "Este e-mail já tem cadastro. Entre na sua conta." }, 409);
    throw e;
  }

  // Após criar a conta, a pessoa precisa entrar (login) — não abrimos sessão automaticamente
  return json({ ok: true });
}

async function login(req, store) {
  const body = await readBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const generic = { error: "E-mail ou senha incorretos." };

  if (!validEmail(email) || !password) return json(generic, 401);
  if ((await store.getFailures(email)) >= MAX_FAILS) {
    return json({ error: "Muitas tentativas. Tente de novo em 15 minutos." }, 429);
  }

  const user = await store.getUserByEmail(email);
  // Com usuário inexistente, faz o hash mesmo assim para o tempo de resposta não revelar o cadastro
  const salt = user ? unb64(user.salt) : new Uint8Array(16);
  const hash = await pbkdf2(password, salt, user ? user.iters : PBKDF2_ITERS);
  if (!user || !safeEqual(hash, unb64(user.hash))) {
    await store.setFailures(email, (await store.getFailures(email)) + 1, FAIL_WINDOW);
    return json(generic, 401);
  }

  await store.clearFailures(email);
  const cookie = await startSession(store, user);
  return json({ user: { name: user.name, email: user.email } }, 200, { "Set-Cookie": cookie });
}

async function logout(req, store) {
  const token = getCookie(req, COOKIE);
  if (token) await store.deleteSession(await sha256Hex(token));
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}

async function addHistory(req, store, user) {
  const body = await readBody(req);
  const entry = {
    display: String(body.display || "").slice(0, MAX_HISTORY_TEXT),   // ex.: "√9 + 2^3 = 11"
    expr: String(body.expr || "").slice(0, MAX_HISTORY_TEXT),         // o que foi digitado/lido
    source: body.source === "foto" ? "foto" : "teclado",
  };
  if (!entry.display || !entry.expr) return json({ error: "Conta vazia." }, 400);
  return json({ entry: await store.addHistory(user.id, entry) });
}

export async function handleAuthRoutes(req, env, url) {
  const p = url.pathname;
  if (!p.startsWith("/api/auth/") && !p.startsWith("/api/history")) return null;

  const store = createStore(env);
  const isWrite = req.method !== "GET";
  if (isWrite && !sameOrigin(req, url)) return json({ error: "Origem não permitida." }, 403);

  try {
    if (req.method === "POST" && p === "/api/auth/register") return await register(req, store);
    if (req.method === "POST" && p === "/api/auth/login") return await login(req, store);
    if (req.method === "POST" && p === "/api/auth/logout") return await logout(req, store);

    const user = await currentUser(req, store);
    if (req.method === "GET" && p === "/api/auth/me") {
      return user ? json({ user: { name: user.name, email: user.email } }) : json({ user: null }, 401);
    }

    if (p.startsWith("/api/history")) {
      if (!user) return json({ error: "Entre na sua conta." }, 401);
      if (req.method === "GET" && p === "/api/history") return json({ items: await store.listHistory(user.id, 100) });
      if (req.method === "POST" && p === "/api/history") return await addHistory(req, store, user);
      if (req.method === "DELETE" && p === "/api/history") {
        await store.clearHistory(user.id);
        return json({ ok: true });
      }
      if (req.method === "DELETE" && p.startsWith("/api/history/")) {
        await store.deleteHistory(user.id, decodeURIComponent(p.slice("/api/history/".length)));
        return json({ ok: true });
      }
    }
    return json({ error: "Rota não encontrada." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível concluir. Tente de novo." }, 400);
  }
}
