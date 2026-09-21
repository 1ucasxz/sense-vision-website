document.querySelector('.contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const status = event.currentTarget.querySelector('.form-status');
  if (status) status.textContent = 'Mensagem preparada com sucesso!';
  event.currentTarget.reset();
});
