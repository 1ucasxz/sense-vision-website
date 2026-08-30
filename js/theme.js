(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("theme") !== "dark") return;

  document.body.classList.add("theme-dark");
  document.documentElement.style.colorScheme = "dark";

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.includes(":") || href.startsWith("//")) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.endsWith(".html")) return;
    url.searchParams.set("theme", "dark");
    link.href = `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
  });
})();
