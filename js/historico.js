// Página "Meu histórico": lista as contas salvas do usuário logado
(function () {
  const box = document.getElementById("histBox");
  const clearBtn = document.getElementById("histClear");
  const subtitle = document.getElementById("histSub");

  function emptyState(title, text, withLogin) {
    box.innerHTML = "";
    const div = document.createElement("div");
    div.className = "hist-empty";
    const strong = document.createElement("strong");
    strong.textContent = title;
    div.appendChild(strong);
    div.appendChild(document.createTextNode(text));
    if (withLogin) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "auth-submit";
      b.textContent = "Entrar ou criar conta";
      b.addEventListener("click", () => SVAuth.open("login"));
      div.appendChild(document.createElement("br"));
      div.appendChild(b);
    } else {
      const a = document.createElement("a");
      a.href = "simulador.html";
      a.className = "auth-submit";
      a.style.cssText = "display:inline-block;margin-top:14px;padding:12px 22px;text-decoration:none";
      a.textContent = "Ir para o simulador";
      div.appendChild(document.createElement("br"));
      div.appendChild(a);
    }
    box.appendChild(div);
    clearBtn.hidden = true;
  }

  function row(item) {
    const li = document.createElement("li");
    li.className = "hist-item";

    const icon = document.createElement("div");
    icon.className = "hist-icon";
    icon.innerHTML = `<span class="icon icon--${item.source === "foto" ? "camera" : "book"}" aria-hidden="true"></span>`;
    icon.title = item.source === "foto" ? "Lida pela câmera dos óculos" : "Digitada no simulador";

    const body = document.createElement("div");
    body.className = "hist-body";
    const expr = document.createElement("div");
    expr.className = "hist-expr";
    expr.textContent = item.display;
    const meta = document.createElement("div");
    meta.className = "hist-meta";
    meta.textContent = new Date(item.ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      + (item.source === "foto" ? " · câmera" : " · teclado");
    body.append(expr, meta);

    const actions = document.createElement("div");
    actions.className = "hist-actions";
    const redo = document.createElement("a");
    redo.className = "hist-redo";
    redo.href = "simulador.html?conta=" + encodeURIComponent(item.expr);
    redo.textContent = "Ver em frutas";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "hist-del";
    del.setAttribute("aria-label", "Apagar esta conta");
    del.textContent = "×";
    del.addEventListener("click", async () => {
      del.disabled = true;
      if (await SVAuth.deleteHistory(item.id)) {
        li.remove();
        if (!box.querySelector(".hist-item")) load();
      } else {
        del.disabled = false;
      }
    });
    actions.append(redo, del);

    li.append(icon, body, actions);
    return li;
  }

  async function load() {
    await SVAuth.ready;
    if (!SVAuth.user) {
      subtitle.textContent = "Entre na sua conta para ver as contas que você já resolveu.";
      emptyState("Você ainda não entrou", "O histórico fica guardado na sua conta, e não neste aparelho.", true);
      return;
    }
    subtitle.textContent = "Olá, " + SVAuth.user.name.split(" ")[0] + "! Estas são as contas que você já resolveu.";
    box.textContent = "Carregando...";
    try {
      const items = await SVAuth.listHistory();
      if (!items.length) {
        emptyState("Nada por aqui ainda", "Resolva uma conta no simulador, digitando ou pela câmera dos óculos, e ela aparece aqui.", false);
        return;
      }
      const ul = document.createElement("ul");
      ul.className = "hist-list";
      items.forEach((it) => ul.appendChild(row(it)));
      box.innerHTML = "";
      box.appendChild(ul);
      clearBtn.hidden = false;
    } catch (e) {
      emptyState("Não foi possível carregar", "Verifique a internet e recarregue a página.", false);
    }
  }

  clearBtn.addEventListener("click", async () => {
    if (!confirm("Apagar todo o histórico? Isso não pode ser desfeito.")) return;
    if (await SVAuth.clearHistory()) load();
  });

  SVAuth.onChange(load);
  document.addEventListener("DOMContentLoaded", load);
  if (document.readyState !== "loading") load();
})();
