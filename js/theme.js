(function () {
  const params = new URLSearchParams(window.location.search);
  let isDark = params.get("theme") === "dark";

  const nav = document.querySelector(".nav");
  if (nav && !nav.querySelector(".menu-theme")) {
    nav.insertAdjacentHTML("beforeend", `
      <div class="menu-theme">
        <span class="menu-theme__icon" aria-hidden="true">🌙</span>
        <span class="menu-theme__label">Modo Escuro</span>
        <button class="theme-switch" type="button" aria-label="Alternar modo escuro" aria-pressed="false">
          <span class="theme-switch__thumb"></span>
        </button>
      </div>
      <p class="menu-version">v1.0 · Colégio UNASP · 2026</p>
    `);
  }

  const switchButton = document.querySelector(".theme-switch");

  function updateInternalLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("//")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.endsWith(".html")) return;

      if (isDark) url.searchParams.set("theme", "dark");
      else url.searchParams.delete("theme");

      link.href = `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
    });
  }

  function applyTheme(updateAddress) {
    document.body.classList.toggle("theme-dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    switchButton?.setAttribute("aria-pressed", String(isDark));

    if (updateAddress) {
      const url = new URL(window.location.href);
      if (isDark) url.searchParams.set("theme", "dark");
      else url.searchParams.delete("theme");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    updateInternalLinks();
  }

  switchButton?.addEventListener("click", () => {
    isDark = !isDark;
    applyTheme(true);
  });

  applyTheme(false);
})();
