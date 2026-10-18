/**
 * Camada de armazenamento de contas, sessões e histórico.
 *
 * Dois modos, escolhidos automaticamente:
 *   - Com o secret DB_API_URL definido: usa o MySQL da hospedagem, via a API em PHP (db-api/).
 *   - Sem ele: guarda no Cloudflare KV (o mesmo namespace PHOTOS), só para funcionar já.
 * Para trocar por outro banco no futuro, reescreva as funções mantendo os mesmos nomes e retornos.
 * Nenhum outro arquivo (auth.js, index.js, site) precisa mudar.
 *
 * Contrato:
 *   getUserByEmail(email)            -> { id, email, name, salt, hash, iters, createdAt } | null
 *   createUser(user)                 -> void
 *   createSession(tokenHash, data, ttlSeconds)
 *   getSession(tokenHash)            -> { uid, email, name } | null
 *   deleteSession(tokenHash)
 *   addHistory(uid, entry)           -> entry salvo (com id e ts)
 *   listHistory(uid, limit)          -> [entry] do mais novo para o mais antigo
 *   deleteHistory(uid, id)
 *   clearHistory(uid)
 *   getFailures(email) / setFailures(email, count, ttlSeconds) / clearFailures(email)
 */
export function createStore(env) {
  return env.DB_API_URL ? createHttpStore(env) : createKvStore(env);
}

// ---------------------------------------------------------------------
// MySQL (Hostinger) via API em PHP. O Worker manda o secret DB_API_SECRET.
// ---------------------------------------------------------------------
function createHttpStore(env) {
  async function call(action, payload = {}) {
    // trim(): espaço ou quebra de linha colados junto com o valor não podem quebrar a chamada
    const resp = await fetch(env.DB_API_URL.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Secret": (env.DB_API_SECRET || "").trim() },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(8000),
    });
    if (resp.status === 409) throw new Error("duplicate");
    if (!resp.ok) throw new Error(`DB API ${action}: ${resp.status}`); // detalhe só no log do Worker
    return (await resp.json()).result;
  }

  return {
    getUserByEmail: (email) => call("user_get", { email }),
    createUser: (user) => call("user_create", { user }),
    createSession: (tokenHash, data, ttl) => call("session_create", { tokenHash, data, ttl }),
    getSession: (tokenHash) => call("session_get", { tokenHash }),
    deleteSession: (tokenHash) => call("session_delete", { tokenHash }),
    addHistory: (uid, entry) => call("history_add", { uid, entry }),
    listHistory: (uid, limit = 100) => call("history_list", { uid, limit }),
    deleteHistory: (uid, id) => call("history_delete", { uid, id }),
    clearHistory: (uid) => call("history_clear", { uid }),
    getFailures: (email) => call("fail_get", { email }),
    setFailures: (email, count, ttl) => call("fail_set", { email, count, ttl }),
    clearFailures: (email) => call("fail_clear", { email }),
  };
}

// ---------------------------------------------------------------------
// Cloudflare KV (modo inicial / reserva)
// ---------------------------------------------------------------------
function createKvStore(env) {
  const kv = env.PHOTOS;
  const REVERSE_MAX = 9999999999999;

  return {
    async getUserByEmail(email) {
      return kv.get(`user:${email}`, "json");
    },
    async createUser(user) {
      await kv.put(`user:${user.email}`, JSON.stringify(user));
    },

    async createSession(tokenHash, data, ttlSeconds) {
      await kv.put(`sess:${tokenHash}`, JSON.stringify(data), { expirationTtl: ttlSeconds });
    },
    async getSession(tokenHash) {
      return kv.get(`sess:${tokenHash}`, "json");
    },
    async deleteSession(tokenHash) {
      await kv.delete(`sess:${tokenHash}`);
    },

    // A chave usa o tempo invertido: o KV lista em ordem crescente, então o mais novo vem primeiro
    async addHistory(uid, entry) {
      const ts = Date.now();
      const id = `${String(REVERSE_MAX - ts).padStart(13, "0")}${crypto.randomUUID().slice(0, 6)}`;
      const saved = { ...entry, id, ts };
      await kv.put(`hist:${uid}:${id}`, JSON.stringify(saved));
      return saved;
    },
    async listHistory(uid, limit = 100) {
      const listed = await kv.list({ prefix: `hist:${uid}:`, limit });
      const items = await Promise.all(listed.keys.map((k) => kv.get(k.name, "json")));
      return items.filter(Boolean);
    },
    async deleteHistory(uid, id) {
      await kv.delete(`hist:${uid}:${id}`);
    },
    async clearHistory(uid) {
      const listed = await kv.list({ prefix: `hist:${uid}:`, limit: 1000 });
      await Promise.all(listed.keys.map((k) => kv.delete(k.name)));
    },

    async getFailures(email) {
      return (await kv.get(`fail:${email}`, "json")) || 0;
    },
    async setFailures(email, count, ttlSeconds) {
      await kv.put(`fail:${email}`, JSON.stringify(count), { expirationTtl: ttlSeconds });
    },
    async clearFailures(email) {
      await kv.delete(`fail:${email}`);
    },
  };
}
