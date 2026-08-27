// SenseVision — interações da página inicial
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');

  menuToggle?.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    menuToggle.classList.toggle('is-active', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Fecha o menu mobile ao clicar em um link
  document.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('nav-open');
      menuToggle?.classList.remove('is-active');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
  });
});
