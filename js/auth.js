/**
 * SenseVision — Conta do usuário (pop-ups de cadastro e login + histórico)
 * Fala com /api/auth/* e /api/history. Expõe window.SVAuth para as outras páginas.
 */
(function () {
  const state = { user: null };
  const listeners = [];

  async function api(path, options = {}) {
    const resp = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...options
    });
    let data = {};
    try { data = await resp.json(); } catch (e) { /* resposta sem corpo */ }
    return { ok: resp.ok, status: resp.status, data };
  }

  function notify() { listeners.forEach((fn) => { try { fn(state.user); } catch (e) { console.error(e); } }); }

  async function refresh() {
    try {
      const r = await api("/api/auth/me");
      state.user = r.ok ? r.data.user : null;
    } catch (e) {
      state.user = null;
    }
    renderHeader();
    notify();
    return state.user;
  }

  // ------------------------------------------------------------ cabeçalho
  function renderHeader() {
    const inner = document.querySelector(".header__inner");
    if (!inner) return;
    // Agrupa os controles da direita (Entrar, modo escuro, Jogar) num só contêiner,
    // para o layout do cabeçalho não depender de posições soltas.
    let actions = inner.querySelector(".header__actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "header__actions";
      inner.insertBefore(actions, inner.querySelector(".menu-toggle") || null);
      const slotEl = document.createElement("div");
      slotEl.className = "auth-slot";
      actions.appendChild(slotEl);
      const theme = inner.querySelector(".desktop-theme-switch");
      const cta = inner.querySelector(".header__cta");
      if (theme) actions.appendChild(theme);
      if (cta) actions.appendChild(cta);
    }
    const slot = actions.querySelector(".auth-slot");
    if (state.user) {
      const first = escapeHtml(state.user.name.split(" ")[0]);
      slot.innerHTML = `
        <button type="button" class="auth-btn auth-btn--user" aria-haspopup="true" aria-expanded="false"><span class="icon icon--users" aria-hidden="true"></span> ${first}</button>
        <div class="auth-menu" hidden>
          <a href="historico.html">Meu histórico</a>
          <button type="button" data-act="logout">Sair</button>
        </div>`;
      const btn = slot.querySelector(".auth-btn");
      const menu = slot.querySelector(".auth-menu");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = menu.hidden;
        menu.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
      });
      slot.querySelector('[data-act="logout"]').addEventListener("click", logout);
    } else {
      slot.innerHTML = `<button type="button" class="auth-btn" data-act="open-login">Entrar</button>`;
      slot.querySelector("button").addEventListener("click", () => open("login"));
    }
  }
  document.addEventListener("click", () => {
    const menu = document.querySelector(".auth-menu");
    if (menu) menu.hidden = true;
  });

  // ------------------------------------------------------------ pop-up
  let overlay = null;
  let previousFocus = null;

  function buildModal() {
    overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button type="button" class="auth-close" aria-label="Fechar">×</button>
        <div class="auth-tabs" role="tablist">
          <button type="button" role="tab" data-mode="login">Entrar</button>
          <button type="button" role="tab" data-mode="register">Criar conta</button>
        </div>
        <h2 id="authTitle"></h2>
        <p class="auth-sub"></p>

        <form class="auth-form" data-form="login" novalidate>
          <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
          <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
          <p class="auth-error" role="alert"></p>
          <button type="submit" class="auth-submit">Entrar</button>
          <p class="auth-switch">Ainda não tem conta? <a href="#" data-mode="register">Criar conta</a></p>
        </form>

        <form class="auth-form" data-form="register" novalidate>
          <label>Nome<input name="name" type="text" autocomplete="name" maxlength="60" required></label>
          <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
          <label>Senha <small>(mínimo 8 caracteres)</small><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
          <label>Repita a senha<input name="password2" type="password" autocomplete="new-password" required></label>
          <p class="auth-error" role="alert"></p>
          <button type="submit" class="auth-submit">Criar conta</button>
          <p class="auth-switch">Já tem conta? <a href="#" data-mode="login">Entrar</a></p>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".auth-close").addEventListener("click", close);
    overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const items = [...overlay.querySelectorAll('button, input, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    overlay.querySelectorAll("[data-mode]").forEach((el) => {
      el.addEventListener("click", (e) => { e.preventDefault(); setMode(el.dataset.mode); });
    });
    overlay.querySelector('[data-form="login"]').addEventListener("submit", onLogin);
    overlay.querySelector('[data-form="register"]').addEventListener("submit", onRegister);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });
  }

  function setMode(mode, notice) {
    overlay.dataset.mode = mode;
    overlay.querySelectorAll(".auth-tabs button").forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    overlay.querySelectorAll(".auth-form").forEach((f) => { f.hidden = f.dataset.form !== mode; });
    overlay.querySelector("#authTitle").textContent = mode === "login" ? "Entrar na sua conta" : "Criar sua conta";
    overlay.querySelector(".auth-sub").textContent = notice
      || (mode === "login" ? "Veja o histórico das suas contas em qualquer aparelho." : "Leva menos de um minuto. Depois você entra com seu e-mail e senha.");
    overlay.querySelectorAll(".auth-error").forEach((p) => { p.textContent = ""; });
    const firstInput = overlay.querySelector(`[data-form="${mode}"] input`);
    if (firstInput) setTimeout(() => firstInput.focus(), 30);
  }

  function open(mode = "login", notice) {
    if (!overlay) buildModal();
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("auth-open");
    setMode(mode, notice);
  }
  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("auth-open");
    previousFocus?.focus();
  }

  function setBusy(form, busy) {
    const b = form.querySelector(".auth-submit");
    b.disabled = busy;
    b.dataset.label = b.dataset.label || b.textContent;
    b.textContent = busy ? "Aguarde..." : b.dataset.label;
  }
  const showError = (form, msg) => { form.querySelector(".auth-error").textContent = msg; };

  async function onRegister(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (!f.name.trim()) return showError(form, "Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return showError(form, "Digite um e-mail válido.");
    if (f.password.length < 8) return showError(form, "A senha precisa ter pelo menos 8 caracteres.");
    if (f.password !== f.password2) return showError(form, "As senhas não são iguais.");

    setBusy(form, true);
    try {
      const r = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: f.name, email: f.email, password: f.password })
      });
      if (!r.ok) return showError(form, r.data.error || "Não foi possível criar a conta.");
      // Conta criada: agora a pessoa entra pelo login
      const loginForm = overlay.querySelector('[data-form="login"]');
      loginForm.elements.email.value = f.email.trim();
      loginForm.elements.password.value = "";
      form.reset();
      setMode("login", "Conta criada! Agora entre com seu e-mail e senha.");
      loginForm.elements.password.focus();
    } catch (err) {
      showError(form, "Sem conexão. Verifique a internet e tente de novo.");
    } finally {
      setBusy(form, false);
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    if (!f.email.trim() || !f.password) return showError(form, "Informe e-mail e senha.");

    setBusy(form, true);
    try {
      const r = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: f.email, password: f.password })
      });
      if (!r.ok) return showError(form, r.data.error || "Não foi possível entrar.");
      form.reset();
      close();
      await refresh();
    } catch (err) {
      showError(form, "Sem conexão. Verifique a internet e tente de novo.");
    } finally {
      setBusy(form, false);
    }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch (e) { /* segue */ }
    state.user = null;
    renderHeader();
    notify();
  }

  // ------------------------------------------------------------ histórico
  async function saveHistory(entry) {
    if (!state.user) return null;
    try {
      const r = await api("/api/history", { method: "POST", body: JSON.stringify(entry) });
      return r.ok ? r.data.entry : null;
    } catch (e) {
      return null;
    }
  }
  async function listHistory() {
    const r = await api("/api/history");
    if (!r.ok) throw new Error(r.status === 401 ? "login" : "erro");
    return r.data.items || [];
  }
  async function deleteHistory(id) {
    return (await api("/api/history/" + encodeURIComponent(id), { method: "DELETE" })).ok;
  }
  async function clearHistory() {
    return (await api("/api/history", { method: "DELETE" })).ok;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.SVAuth = {
    get user() { return state.user; },
    ready: null,
    open, close, logout, refresh,
    onChange(fn) { listeners.push(fn); },
    saveHistory, listHistory, deleteHistory, clearHistory
  };

  function init() { window.SVAuth.ready = refresh(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
