document.querySelector('.contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const subject = encodeURIComponent(`Contato SenseVision — ${data.get('nome').trim()}`);
  const body = encodeURIComponent(`Nome: ${data.get('nome').trim()}\nE-mail: ${data.get('email').trim()}\n\n${data.get('mensagem').trim()}`);
  const status = form.querySelector('.form-status');
  if (status) status.textContent = 'Conclua o envio no seu aplicativo de e-mail. Se ele não abrir, envie a mensagem para lucas2008barboza@gmail.com. Os campos foram preservados.';
  window.location.href = `mailto:lucas2008barboza@gmail.com?subject=${subject}&body=${body}`;
});
