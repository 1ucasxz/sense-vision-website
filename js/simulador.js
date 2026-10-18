/**
 * SenseVision - Motor Pedagógico do Simulador Interativo
 * Converte expressões matemáticas escritas OU fotos do Raspberry Pi
 * em representações visuais com frutas (Modo Câmera Ao Vivo).
 */

// =====================================================================
// CONFIGURAÇÃO - API na nuvem (Cloudflare Worker, mesma origem do site)
// A chave do Gemini fica no servidor; o navegador nunca a vê.
// =====================================================================
const API_BASE = "";

// Catálogo de Frutas Pedagógicas
const FRUITS_CATALOG = [
  { id: "maca", name_singular: "maçã", name_plural: "maçãs", emoji: "🍎", gender: "f" },
  { id: "banana", name_singular: "banana", name_plural: "bananas", emoji: "🍌", gender: "f" },
  { id: "laranja", name_singular: "laranja", name_plural: "laranjas", emoji: "🍊", gender: "f" },
  { id: "morango", name_singular: "morango", name_plural: "morangos", emoji: "🍓", gender: "m" },
  { id: "uva", name_singular: "uva", name_plural: "uvas", emoji: "🍇", gender: "f" }
];

// Estado da aplicação
let currentFruitId  = "auto";  // auto ou id específico
let lastResult      = null;
let audioCtx        = null;

// Estado do modo câmera ao vivo
let _liveMode          = false;   // true quando o botão está ativo
let _lastSeenTimestamp = 0;       // evita processar a mesma foto duas vezes
let _pollInterval      = null;    // referência do setInterval de polling

// Inicializa Web Audio API para simular o Buzzer do Raspberry Pi
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Emite bip do buzzer (frequência piezo típica de 2000Hz)
function playBuzzer(type = "single") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (type === "single") {
      // 1 bip curto de 80ms (disparo do comando)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(2200, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "success") {
      // 2 bips rápidos de 60ms (confirmação de sucesso)
      const now = ctx.currentTime;
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(2400, now + offset);
        gain.gain.setValueAtTime(0.08, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.06);
      });
    }
  } catch (e) {
    console.warn("Áudio do buzzer indisponível:", e);
  }
}

// Seleciona fruta
function getActiveFruit() {
  if (currentFruitId === "auto" || !currentFruitId) {
    return FRUITS_CATALOG[Math.floor(Math.random() * FRUITS_CATALOG.length)];
  }
  return FRUITS_CATALOG.find(f => f.id === currentFruitId) || FRUITS_CATALOG[0];
}

// =====================================================================
// EXPRESSÕES COMPOSTAS — parênteses, várias operações, potência e raiz
// =====================================================================

// Normaliza texto digitado ou lido pela IA (inclui LaTeX) para uma forma simples
function normalizeExpression(str) {
  let s = String(str).toLowerCase();
  s = s.replace(/\$/g, "").replace(/\\left|\\right/g, "");
  s = s.replace(/\\times|\\cdot|×|·/g, "*").replace(/\\div|÷|:/g, "/");
  for (let i = 0; i < 5; i++) s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
  for (let i = 0; i < 5; i++) s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
  s = s.replace(/\\sqrt\s*(\d+)/g, "sqrt($1)");
  s = s.replace(/raiz(\s*quadrada)?(\s*de)?/g, "sqrt");
  s = s.replace(/\^\s*\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/²/g, "^2").replace(/³/g, "^3");
  s = s.replace(/\*\*/g, "^");
  s = s.replace(/[\[{]/g, "(").replace(/[\]}]/g, ")");
  s = s.replace(/,/g, ".");
  s = s.replace(/(\d|\))\s*x\s*(\d|\()/g, "$1*$2");
  if (s.includes("=")) {
    const parts = s.split("=");
    s = parts[0].trim() ? parts[0] : parts[parts.length - 1];
  }
  return s.replace(/\s+/g, "");
}

// Analisador recursivo: gramática com precedência (^ > * / > + -)
function parseTree(s) {
  let i = 0;
  const peek = () => s[i];
  const fail = (m) => { throw new Error(m); };

  function number() {
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) fail("número esperado");
    i += m[0].length;
    return { t: "num", v: parseFloat(m[0]) };
  }
  function primary() {
    if (s.startsWith("sqrt", i)) { i += 4; return { t: "sqrt", x: primary() }; }
    if (peek() === "√") { i++; return { t: "sqrt", x: primary() }; }
    if (peek() === "(") {
      i++;
      const e = expr();
      if (peek() !== ")") fail("parêntese não fechado");
      i++;
      return { t: "grp", x: e };
    }
    return number();
  }
  function power() {
    const base = primary();
    if (peek() === "^") { i++; return { t: "bin", op: "^", a: base, b: unary() }; }
    return base;
  }
  function unary() {
    if (peek() === "-") { i++; return { t: "neg", x: unary() }; }
    if (peek() === "+") { i++; return unary(); }
    return power();
  }
  function term() {
    let left = unary();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      left = { t: "bin", op, a: left, b: unary() };
    }
    return left;
  }
  function expr() {
    let left = term();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      left = { t: "bin", op, a: left, b: term() };
    }
    return left;
  }

  const tree = expr();
  if (i < s.length) fail("sobrou texto: " + s.slice(i));
  return tree;
}

const round2 = (v) => Math.round(v * 100) / 100;
const fmtNum = (v) => String(round2(v)).replace(".", ",");

// Avalia a árvore registrando cada operação como um passo (ordem correta de resolução)
function evalTree(node, steps) {
  switch (node.t) {
    case "num": return node.v;
    case "grp": return evalTree(node.x, steps);
    case "neg": return -evalTree(node.x, steps);
    case "sqrt": {
      const a = evalTree(node.x, steps);
      if (a < 0) throw new Error("Não existe raiz quadrada de número negativo.");
      const r = round2(Math.sqrt(a));
      steps.push({ kind: "sqrt", a, r });
      return r;
    }
    case "bin": {
      const a = evalTree(node.a, steps);
      const b = evalTree(node.b, steps);
      let r;
      if (node.op === "+") r = a + b;
      else if (node.op === "-") r = a - b;
      else if (node.op === "*") r = a * b;
      else if (node.op === "/") {
        if (b === 0) throw new Error("Não é possível dividir por zero.");
        r = a / b;
      } else {
        if (Math.abs(b) > 10) throw new Error("Expoente muito grande para visualizar.");
        r = Math.pow(a, b);
      }
      if (!isFinite(r) || Math.abs(r) > 1e6) throw new Error("Resultado grande demais para visualizar.");
      r = round2(r);
      steps.push({ kind: node.op, a, b, r });
      return r;
    }
  }
  return 0;
}

// Texto legível da expressão (mantém os parênteses originais)
function fmtTree(node) {
  switch (node.t) {
    case "num": return fmtNum(node.v);
    case "grp": return node.x.t === "num" ? fmtTree(node.x) : "(" + fmtTree(node.x) + ")";
    case "neg": return "-" + fmtTree(node.x);
    case "sqrt": return "√" + (node.x.t === "num" || node.x.t === "grp" ? fmtTree(node.x) : "(" + fmtTree(node.x) + ")");
    case "bin": {
      const sym = { "*": "×", "/": "÷" }[node.op] || node.op;
      if (node.op === "^") return fmtTree(node.a) + "^" + fmtTree(node.b);
      return fmtTree(node.a) + " " + sym + " " + fmtTree(node.b);
    }
  }
  return "";
}

// Converte uma expressão (simples ou composta) em quadros visuais, passo a passo
const STEP_ORDINALS = ["Primeiro", "Depois", "Em seguida", "Então", "Agora", "Também", "Mais um passo", "Continuando"];

function convertComplex(raw) {
  const normalized = normalizeExpression(raw);
  if (!/\d/.test(normalized)) return null;

  let tree;
  try { tree = parseTree(normalized); } catch (e) { return null; }

  const steps = [];
  let result;
  try {
    result = evalTree(tree, steps);
  } catch (e) {
    return { success: false, error: e.message, speechText: e.message };
  }
  if (steps.length > 8) {
    return { success: false, error: "Conta muito longa. Use até 8 operações.", speechText: "Essa conta é muito longa. Tente uma conta menor." };
  }

  const fruit = getActiveFruit();
  const fem = fruit.gender === "f";
  const q = (v) => `${wordsPt(v, fem)} ${v === 1 ? fruit.name_singular : fruit.name_plural}`;
  const w = (v) => wordsPt(v);

  const cards = [];
  const speech = [];
  if (steps.length > 1) speech.push("Vamos resolver uma operação de cada vez.");

  steps.forEach((st, idx) => {
    const { html, caption } = fvStep(st, fruit);
    cards.push({
      label: steps.length > 1 && idx === steps.length - 1 ? "Por fim" : STEP_ORDINALS[idx],
      html,
      caption
    });

    if (st.kind === "+") {
      speech.push(`Juntando ${q(st.a)} com ${q(st.b)}, ficamos com ${q(st.r)}.`);
    } else if (st.kind === "-") {
      speech.push(st.r >= 0
        ? `Tirando ${q(st.b)} de ${q(st.a)}, sobram ${q(st.r)}.`
        : `Tirando ${q(st.b)} de ${q(st.a)}, faltam ${q(-st.r)}.`);
    } else if (st.kind === "*") {
      speech.push(`${w(st.a)} grupos com ${q(st.b)} em cada um dão ${q(st.r)}.`);
    } else if (st.kind === "/") {
      speech.push(`Repartindo ${q(st.a)} entre ${w(st.b)} amigos, cada amigo fica com ${q(st.r)}.`);
    } else if (st.kind === "^") {
      speech.push(st.b === 2 ? `${w(st.a)} ao quadrado dá ${q(st.r)}.`
        : st.b === 3 ? `${w(st.a)} ao cubo dá ${q(st.r)}.`
        : `${w(st.a)} elevado a ${w(st.b)} dá ${q(st.r)}.`);
    } else {
      speech.push(Number.isInteger(st.r) && st.r * st.r === st.a
        ? `A raiz quadrada de ${w(st.a)} é ${w(st.r)}, porque ${w(st.r)} vezes ${w(st.r)} dá ${w(st.a)}.`
        : `A raiz quadrada de ${w(st.a)} é, aproximadamente, ${w(st.r)}.`);
    }
  });

  if (steps.length === 0) {
    cards.push({
      label: "Quantidade",
      html: `<div class="fv-row">${fvQty(result, fruit)}</div>`,
      caption: "Esta é a quantidade da conta."
    });
  }
  speech.push(`A resposta é ${q(result)}.`);

  return {
    success: true,
    displayExpr: `${fmtTree(tree)} = ${fmtNum(result)}`,
    result,
    fruit,
    steps: cards,
    answerHtml: fvQty(result, fruit),
    explanationSpeech: speech.join(" ")
  };
}

// Origem da conta atual: "teclado" (padrão) ou "foto" (câmera dos óculos)
let _calcSource = "teclado";

// Guarda a conta no histórico da pessoa logada e avisa embaixo da resposta
async function saveToHistory(data, originalExpr) {
  const note = document.getElementById("historyNote");
  if (!window.SVAuth) return;
  await SVAuth.ready;
  if (!SVAuth.user) {
    if (note) {
      note.innerHTML = 'Quer guardar suas contas? <a href="#entrar" id="historyLogin">Entre na sua conta</a>.';
      document.getElementById("historyLogin").addEventListener("click", (event) => { event.preventDefault(); SVAuth.open("login"); });
    }
    return;
  }
  const saved = await SVAuth.saveHistory({
    display: data.displayExpr,
    expr: String(originalExpr).trim(),
    source: _calcSource
  });
  if (note) note.innerHTML = saved ? 'Salvo no seu <a href="historico.html">histórico</a>.' : "Não foi possível salvar no histórico agora.";
}

// Atualiza a interface com o resultado
function renderResult(data, originalExpr, silent = false) {
  stopNarration();
  lastResult = data;
  if (!silent) playBuzzer("success");

  const eqOriginalEl = document.getElementById("equationOriginal");
  const fruitsDisplayEl = document.getElementById("fruitsDisplay");
  const narrationTextEl = document.getElementById("narrationText");
  const stepsListEl = document.getElementById("stepsList");

  if (!data.success) {
    eqOriginalEl.textContent = originalExpr;
    fruitsDisplayEl.innerHTML = `<span class="fv-error">${data.error}</span>`;
    narrationTextEl.textContent = data.speechText || "Não foi possível calcular.";
    stepsListEl.innerHTML = `<li class="fv-step"><p class="fv-step__caption">Tente uma conta como 3 + 2, (4 + 2) × 3, 2^3 ou raiz(9).</p></li>`;
    return;
  }

  eqOriginalEl.textContent = data.displayExpr;
  if (!silent) saveToHistory(data, originalExpr);
  fruitsDisplayEl.innerHTML = data.answerHtml;
  narrationTextEl.textContent = data.explanationSpeech;

  stepsListEl.innerHTML = data.steps.map((step) => `
    <li class="fv-step">
      <div class="fv-step__head"><span class="fv-step__dot"></span><strong>${step.label}</strong></div>
      ${step.html}
      <p class="fv-step__caption">${step.caption}</p>
    </li>
  `).join("");
}

// Executa cálculo
function runCalculation(silent = false) {
  const inputEl = document.getElementById("mathInput");
  const val = inputEl.value;

  if (!val.trim()) {
    inputEl.focus();
    return;
  }

  if (!silent) playBuzzer("single");

  const result = convertComplex(val) || {
    success: false,
    error: "Formato inválido. Tente 3 + 2, (4 + 2) × 3, 2^3 ou raiz(9).",
    speechText: "Formato inválido. Tente digitar uma conta como três mais dois."
  };
  renderResult(result, val, silent);
}

// =====================================================================
// MODO CÂMERA AO VIVO — Polling + Gemini Vision OCR
// =====================================================================

/**
 * Pede ao servidor (Worker) para ler a equação da última foto recebida.
 * O Gemini é chamado no servidor, com a chave escondida.
 * Retorna a string da equação (ex: "3 + 2") ou null se não encontrar.
 */
async function extractEquationFromImage() {
  try {
    // Limite de 45s: se a IA travar, o painel não fica preso em "Analisando"
    const resp = await fetch(`${API_BASE}/api/ocr`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(45000)
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("OCR erro:", resp.status, err);
      return null;
    }

    const data = await resp.json();
    const text = (data.text || "").trim();
    console.log("[Gemini OCR] Resposta:", text);

    if (!text || text.toUpperCase().includes("NENHUMA")) return null;

    // Usa só a primeira linha, sem cercas de código nem "= resultado"
    const line = text.replace(/```[a-z]*/gi, "").split("\n").map(l => l.trim()).find(Boolean) || "";
    const expr = line.split("=")[0].trim() || line;
    return /\d/.test(expr) ? expr : null;

  } catch (e) {
    console.error("Erro ao chamar o servidor de OCR:", e);
    if (e && e.name === "TimeoutError") setLiveStatus("⏱ A IA demorou demais. Tire outra foto.", "error");
    return null;
  }
}

/**
 * Atualiza o painel de status da câmera ao vivo na interface.
 */
function setLiveStatus(msg, type = "info") {
  const el = document.getElementById("liveStatus");
  if (!el) return;
  el.dataset.status = type;
  el.textContent = msg;
  el.style.color = "var(--color-text)";
}

/**
 * Processa uma nova foto recebida: manda para Gemini, converte e exibe.
 */
async function processNewPhoto(filename) {
  setLiveStatus(`Analisando foto "${filename}" com IA...`, "processing");

  const equation = await extractEquationFromImage();

  if (!equation) {
    const el = document.getElementById("liveStatus");
    if (!el || !el.textContent.startsWith("⏱")) {
      setLiveStatus("Não encontrei equação na foto. Aguardando próxima...", "error");
    }
    return;
  }

  setLiveStatus(`Equação encontrada: ${equation}`, "success");

  // Preenche o campo de texto e dispara o cálculo igual ao modo manual
  const inputEl = document.getElementById("mathInput");
  if (inputEl) {
    inputEl.value = equation;
  }
  _calcSource = "foto";
  runCalculation();
  _calcSource = "teclado";
}

/**
 * Faz polling leve no /api/status a cada 2s.
 * Se detectar foto nova, pede a leitura (OCR) ao servidor e processa.
 */
async function pollReceiver() {
  if (!_liveMode) return;

  try {
    const resp = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
    if (!resp.ok) {
      setLiveStatus("Servidor não respondeu. Tentando de novo...", "error");
      return;
    }

    const status = await resp.json();

    // Primeira consulta após ligar: marca a foto atual como "já vista" (ignora fotos antigas)
    if (_lastSeenTimestamp === null) {
      _lastSeenTimestamp = status.timestamp;
      setLiveStatus("Aguardando foto da câmera do Raspberry Pi...", "waiting");
      return;
    }

    if (status.has_photo && status.timestamp > _lastSeenTimestamp) {
      _lastSeenTimestamp = status.timestamp;
      await processNewPhoto(status.filename);
    }

  } catch (e) {
    setLiveStatus("Sem conexão com o servidor. Verifique a internet.", "error");
  }
}

/**
 * Liga / desliga o modo câmera ao vivo.
 */
function toggleLiveMode() {
  _liveMode = !_liveMode;
  const btn = document.getElementById("btnLiveMode");
  const panel = document.getElementById("livePanel");

  if (_liveMode) {
    _lastSeenTimestamp = null; // na 1ª consulta, ignora a foto que já existe
    _pollInterval = setInterval(pollReceiver, 2000);
    pollReceiver(); // executa imediatamente
    if (btn) {
      btn.textContent = "Câmera Ao Vivo — ATIVA (clique para parar)";
      btn.classList.add("live-active");
      btn.setAttribute("aria-pressed", "true");
    }
    if (panel) panel.style.display = "block";
    setLiveStatus("Aguardando foto da câmera do Raspberry Pi...", "waiting");
  } else {
    clearInterval(_pollInterval);
    _pollInterval = null;
    if (btn) {
      btn.textContent = "Câmera Ao Vivo (Raspberry Pi)";
      btn.classList.remove("live-active");
      btn.setAttribute("aria-pressed", "false");
    }
    if (panel) panel.style.display = "none";
  }
}

// =====================================================================
// NARRADOR — fala só quando o botão é clicado; clicar de novo interrompe
// =====================================================================
const SPEEDS = [
  { rate: 0.9, label: "Velocidade: 0.9x (Didática)" },
  { rate: 1.2, label: "Velocidade: 1.2x (Normal)" },
  { rate: 0.7, label: "Velocidade: 0.7x (Lenta)" }
];
let speedIndex = 0;
let narrating = false;

function setSpeakUi(speaking) {
  narrating = speaking;
  const label = document.getElementById("speakLabel");
  const btn = document.getElementById("btnSpeak");
  if (label) label.textContent = speaking ? "Parar narração" : "Ouvir narração";
  if (btn) btn.classList.toggle("is-speaking", speaking);
}

function stopNarration() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  setSpeakUi(false);
}

// Escolhe uma voz em português (pt-BR de preferência). Retorna null se o sistema não tiver nenhuma.
function pickPortugueseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === "pt-BR")
      || voices.find(v => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("pt"))
      || null;
}

function speakNow(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-BR";
  utter.rate = SPEEDS[speedIndex].rate;
  const voice = pickPortugueseVoice();
  if (voice) utter.voice = voice;
  utter.onend = utter.onerror = () => setSpeakUi(false);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  setSpeakUi(true);
}

function toggleNarration() {
  if (!("speechSynthesis" in window)) {
    alert("Seu navegador não suporta narração por voz.");
    return;
  }
  if (narrating) {
    stopNarration();
    return;
  }
  const text = (document.getElementById("narrationText")?.textContent || "").trim();
  if (!text) return;

  // As vozes carregam de forma assíncrona: na 1ª vez a lista pode vir vazia
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", () => speakNow(text), { once: true });
    setTimeout(() => { if (!narrating) speakNow(text); }, 600);
    return;
  }
  if (!pickPortugueseVoice()) {
    console.warn("Nenhuma voz em português instalada neste dispositivo.");
  }
  speakNow(text);
}

// Inicialização dos eventos no DOM
document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("mathInput");
  const btnCalc = document.getElementById("btnCalc");
  const testBuzzerBtn = document.getElementById("testBuzzerBtn");

  // Exemplo inicial (sem som): mostra como o resultado aparece
  const pedida = new URLSearchParams(location.search).get("conta");
  if (pedida) inputEl.value = pedida;
  else if (!inputEl.value.trim()) inputEl.value = "3 + 2";
  runCalculation(true);

  // Vindo do histórico: leva direto ao passo a passo (a calculadora fica para trás)
  if (pedida) {
    // Espera o layout assentar (fontes/imagens) antes de rolar; repete uma vez se a página ainda mexeu
    const irParaPassos = () => {
      const box = document.querySelector(".steps-box");
      if (box && box.getBoundingClientRect().top > 40) box.scrollIntoView({ behavior: "instant", block: "start" });
    };
    setTimeout(irParaPassos, 400);
    setTimeout(irParaPassos, 1400);
  }

  // Gatilho via teclado: Enter
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCalculation();
    }
  });

  // Botão calcular
  btnCalc.addEventListener("click", () => {
    runCalculation();
  });

  // Chips de exemplos rápidos
  document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      inputEl.value = chip.dataset.expr;
      runCalculation();
    });
  });

  // Seletor de Frutas
  document.querySelectorAll(".fruit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fruit-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".fruit-btn").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      currentFruitId = btn.dataset.fruit;
      // Recalcula se já houver algo digitado
      if (inputEl.value.trim()) {
        runCalculation();
      }
    });
  });

  // Teclado virtual auxiliar
  document.querySelectorAll(".key-btn").forEach(key => {
    key.addEventListener("click", () => {
      const action = key.dataset.key;
      if (action === "C") {
        inputEl.value = "";
        inputEl.focus();
      } else if (action === "backspace") {
        inputEl.value = inputEl.value.slice(0, -1);
        inputEl.focus();
      } else {
        inputEl.value += action;
        inputEl.focus();
      }
    });
  });

  // Narrador (só fala ao clicar; clicar de novo para)
  document.getElementById("btnSpeak")?.addEventListener("click", toggleNarration);
  document.getElementById("speedToggle")?.addEventListener("click", (e) => {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    e.currentTarget.textContent = SPEEDS[speedIndex].label;
    if (narrating) { stopNarration(); toggleNarration(); }
  });

  // Botão de testar som do buzzer do Raspberry Pi
  if (testBuzzerBtn) {
    testBuzzerBtn.addEventListener("click", () => {
      playBuzzer("success");
    });
  }

  // Botão Câmera Ao Vivo — liga/desliga o polling do Raspberry Pi
  const btnLiveMode = document.getElementById("btnLiveMode");
  if (btnLiveMode) {
    btnLiveMode.addEventListener("click", () => {
      toggleLiveMode();
    });
  }

});
