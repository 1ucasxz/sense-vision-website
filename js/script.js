// SenseVision — interações da página inicial
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  menuToggle?.setAttribute('aria-controls', 'nav');

  function closeMenu(restoreFocus = false) {
    header?.classList.remove('nav-open');
    menuToggle?.classList.remove('is-active');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Abrir menu');
    if (restoreFocus) menuToggle?.focus();
  }

  menuToggle?.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    menuToggle.classList.toggle('is-active', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });

  // Fecha o menu mobile ao clicar em um link
  document.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header?.classList.contains('nav-open')) closeMenu(true);
  });
  document.addEventListener('click', (event) => {
    if (header?.classList.contains('nav-open') && !nav?.contains(event.target) && !menuToggle?.contains(event.target)) closeMenu();
  });
  const desktop = window.matchMedia('(min-width: 769px)');
  desktop.addEventListener('change', () => closeMenu());
});
