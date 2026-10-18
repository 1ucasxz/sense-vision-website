// Formulário de contato: envia a mensagem por e-mail (FormSubmit) para a equipe
const CONTACT_EMAIL = "lucas2008barboza@gmail.com";

document.querySelector('.contact-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const show = (msg, ok) => {
    if (!status) return;
    status.textContent = msg;
    status.style.color = ok ? 'var(--color-text)' : '#ef4444';
    status.classList.add('is-visible');
  };

  if (!form.checkValidity()) {
    show('Preencha nome, e-mail válido e mensagem.', false);
    return;
  }
  if (form.elements._honey?.value) return; // anti-spam: robôs preenchem este campo oculto

  const data = new FormData(form);
  button.disabled = true;
  show('Enviando...', true);

  try {
    const resp = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Novo contato pelo site SenseVision',
        _captcha: 'false',
        _replyto: data.get('email'),
        Nome: data.get('nome'),
        Email: data.get('email'),
        Mensagem: data.get('mensagem'),
      }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok || result.success === 'false' || result.success === false) throw new Error(result.message || resp.status);
    show('Mensagem enviada! Responderemos em breve.', true);
    form.reset();
  } catch (e) {
    console.error('Falha ao enviar contato:', e);
    show('Não foi possível enviar agora. Tente novamente em instantes.', false);
  } finally {
    button.disabled = false;
  }
});
