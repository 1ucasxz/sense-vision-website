/**
 * SenseVision — Visual para Discalculia
 * Quantidades aparecem como frutas, blocos de dezena (barra) e centena (quadrado),
 * nunca como dígitos. Também converte números em palavras para a narração.
 */

const FRUIT_COLORS = {
  maca: "#e53935",
  banana: "#f9a825",
  laranja: "#fb8c00",
  morango: "#e91e63",
  uva: "#7e57c2"
};
const FV_PERSON = '<img class="fv-picture" src="assets/icons/person.svg" alt="amigo">';
const FV_BASKET = '<img class="fv-picture" src="assets/icons/basket.svg" alt="cesta">';
function fvFruit(fruit) {
  const names = { maca: 'fruit-apple', banana: 'banana', laranja: 'fruit-orange', morango: 'strawberry', uva: 'grapes' };
  return `<img class="fv-picture" src="assets/icons/${names[fruit.id]}.svg" alt="${fruit.name_singular}">`;
}

// ---------------------------------------------------------------------
// Números por extenso (usado só na narração)
// ---------------------------------------------------------------------
const W_UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const W_UN_F = W_UN.map((w, i) => (i === 1 ? "uma" : i === 2 ? "duas" : w));
const W_TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const W_HUND = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const W_HUND_F = W_HUND.map((w) => w.replace(/os$/, "as"));

function wordsPt(n, fem = false) {
  n = Math.round(n * 100) / 100;
  if (n < 0) return "menos " + wordsPt(-n, fem);
  if (!Number.isInteger(n)) {
    const [inteira, decimal] = n.toFixed(2).replace(/0+$/, "").split(".");
    return wordsPt(parseInt(inteira, 10), fem) + " vírgula " + decimal.split("").map((d) => W_UN[+d]).join(" ");
  }
  const un = fem ? W_UN_F : W_UN;
  if (n < 20) return un[n];
  if (n < 100) {
    const u = n % 10;
    return W_TENS[Math.floor(n / 10)] + (u ? " e " + un[u] : "");
  }
  if (n === 100) return "cem";
  if (n < 1000) {
    const r = n % 100;
    return (fem ? W_HUND_F : W_HUND)[Math.floor(n / 100)] + (r ? " e " + wordsPt(r, fem) : "");
  }
  if (n < 1e6) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const head = th === 1 ? "mil" : wordsPt(th, fem) + " mil";
    return head + (r ? (r < 100 || r % 100 === 0 ? " e " : " ") + wordsPt(r, fem) : "");
  }
  return String(n);
}

// ---------------------------------------------------------------------
// Quantidades visuais
// ---------------------------------------------------------------------
const fvOp = (sym) => `<span class="fv-op">${sym}</span>`;

// Frutas soltas, em linhas de cinco. "crossed" riscadas por último; "ghost" = todas apagadas.
function fvUnits(count, fruit, crossed = 0, ghost = false) {
  let h = '<span class="fv-units">';
  for (let i = 0; i < count; i++) {
    if (ghost || i >= count - crossed) {
      h += `<span class="fv-u fv-ghost"><i>${fvFruit(fruit)}</i><b>✖</b></span>`;
    } else {
      h += `<span class="fv-u">${fvFruit(fruit)}</span>`;
    }
  }
  return h + "</span>";
}

// Quantidade: até 20 = frutas; acima disso = centenas (quadrados), dezenas (barras) e frutas soltas.
function fvQty(n, fruit, opts = {}) {
  const color = FRUIT_COLORS[fruit.id] || "#f03c8a";

  if (n < 0) {
    return `<span class="fv-q fv-neg"><span class="fv-tag">faltam</span>${fvUnits(Math.min(Math.round(-n), 20), fruit, 0, true)}</span>`;
  }

  const whole = Math.floor(n + 1e-9);
  const frac = Math.round((n - whole) * 100) / 100;

  if (whole === 0 && frac === 0) {
    return `<span class="fv-q fv-empty"><span class="fv-basket">${FV_BASKET}</span><span class="fv-tag">vazia</span></span>`;
  }

  let h = '<span class="fv-q">';
  if (whole <= 20) {
    if (whole) h += fvUnits(whole, fruit, opts.crossed || 0);
  } else {
    const hundreds = Math.floor(whole / 100);
    const tens = Math.floor((whole % 100) / 10);
    const units = whole % 10;
    h += `<span class="fv-blocks" style="--c:${color}">`;
    for (let i = 0; i < Math.min(hundreds, 9); i++) h += '<span class="fv-hundred"></span>';
    if (hundreds > 9) h += '<span class="fv-more">⋯</span>';
    for (let i = 0; i < tens; i++) h += '<span class="fv-ten"></span>';
    h += "</span>";
    if (units) h += fvUnits(units, fruit);
  }
  if (frac > 0) h += `<span class="fv-pie" style="--p:${Math.round(frac * 100)}%;--c:${color}"></span>`;
  return h + "</span>";
}

// Grade de linhas x colunas (multiplicação, quadrado, raiz)
function fvArray(rows, cols, fruit) {
  let h = `<span class="fv-array" style="--cols:${cols}">`;
  for (let i = 0; i < rows * cols; i++) h += `<span>${fvFruit(fruit)}</span>`;
  return h + "</span>";
}

// Cada operação vira um quadro visual + uma frase curta (sem números na tela)
function fvStep(st, fruit) {
  const q = (v, o) => fvQty(v, fruit, o);
  const isInt = (v) => Number.isInteger(v) && v >= 0;
  let html = "";
  let caption = "";

  if (st.kind === "+") {
    html = `<div class="fv-row">${q(st.a)}${fvOp("+")}${q(st.b)}${fvOp("=")}${q(st.r)}</div>`;
    caption = "Juntamos os dois grupos numa cesta só.";

  } else if (st.kind === "-") {
    const canCross = isInt(st.a) && isInt(st.b) && st.a <= 20 && st.b <= st.a;
    html = `<div class="fv-row">${q(st.a, canCross ? { crossed: st.b } : {})}${canCross ? "" : fvOp("−") + q(st.b)}${fvOp("=")}${q(st.r)}</div>`;
    caption = canCross
      ? "Riscamos as frutas que saem. As que ficam sem risco são as que sobram."
      : "Tiramos o segundo grupo do primeiro e vemos o que sobra.";

  } else if (st.kind === "*") {
    if (isInt(st.a) && isInt(st.b) && st.a >= 1 && st.b >= 1 && st.a <= 10 && st.b <= 10) {
      html = `<div class="fv-row">${fvArray(st.a, st.b, fruit)}${fvOp("=")}${q(st.r)}</div>`;
      caption = "Montamos linhas iguais. Cada linha é um grupo. Juntando todas as linhas, temos o total.";
    } else if (isInt(st.a) && isInt(st.b) && st.a >= 1 && st.b >= 1) {
      // Fatores grandes: várias cestas iguais, e o que cabe em uma delas
      const baskets = Math.min(st.a, st.b);
      const inside = Math.max(st.a, st.b);
      const shown = Math.min(baskets, 12);
      const row = FV_BASKET.repeat(shown) + (baskets > 12 ? '<span class="fv-more">⋯</span>' : "");
      html = `<div class="fv-row"><span class="fv-baskets">${row}</span><span class="fv-tag">cada uma com</span>${q(inside)}</div><div class="fv-row">${fvOp("=")}${q(st.r)}</div>`;
      caption = "Temos várias cestas iguais. Juntando tudo o que tem dentro delas, chegamos ao total.";
    } else {
      html = `<div class="fv-row">${q(st.r)}</div>`;
      caption = "Repetimos o mesmo grupo várias vezes e juntamos tudo.";
    }

  } else if (st.kind === "/") {
    if (isInt(st.a) && isInt(st.b) && st.b >= 1 && st.b <= 8) {
      const share = Math.floor(st.a / st.b);
      const rest = st.a - share * st.b;
      let people = "";
      for (let i = 0; i < st.b; i++) people += `<span class="fv-person"><span class="fv-face">${FV_PERSON}</span>${q(share)}</span>`;
      if (rest > 0) people += `<span class="fv-person fv-rem"><span class="fv-face">${FV_BASKET}</span>${q(rest)}<span class="fv-tag">sobra</span></span>`;
      const faces = FV_PERSON.repeat(st.b);
      html = `<div class="fv-row">${q(st.a)}${fvOp("÷")}<span class="fv-faces">${faces}</span></div><div class="fv-row">${people}</div>`;
      caption = rest > 0
        ? "Repartimos as frutas igualmente entre os amigos. O que não dá para repartir fica na cesta."
        : "Repartimos as frutas igualmente entre os amigos. Todos ficam com o mesmo tanto.";
    } else {
      html = `<div class="fv-row">${q(st.a)}${fvOp("÷")}${fvOp("▦")}${fvOp("=")}${q(st.r)}</div>`;
      caption = "Dividimos o grupo em partes iguais. Uma parte é a resposta deste passo.";
    }

  } else if (st.kind === "^") {
    if (st.b === 2 && isInt(st.a) && st.a >= 1 && st.a <= 10) {
      html = `<div class="fv-row">${fvArray(st.a, st.a, fruit)}${fvOp("=")}${q(st.r)}</div>`;
      caption = "Fazemos um quadrado: o mesmo tanto de linhas e de colunas. Contamos tudo que cabe nele.";
    } else {
      html = `<div class="fv-row">${q(st.r)}</div>`;
      caption = "Multiplicamos o mesmo grupo por ele mesmo, várias vezes.";
    }

  } else if (st.kind === "sqrt") {
    if (isInt(st.r) && st.r >= 1 && st.r <= 10 && st.r * st.r === st.a) {
      html = `<div class="fv-row">${q(st.a)}${fvOp("→")}${fvArray(st.r, st.r, fruit)}${fvOp("=")}${q(st.r)}</div>`;
      caption = "Arrumamos as frutas num quadrado perfeito. O tamanho do lado do quadrado é a raiz.";
    } else {
      html = `<div class="fv-row">${q(st.a)}${fvOp("→")}${q(st.r)}</div>`;
      caption = "A raiz é o lado de um quadrado com essa quantidade. Aqui ela fica um pouco quebrada.";
    }
  }

  return { html, caption };
}
