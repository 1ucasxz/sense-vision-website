// Publish only public frontend assets; never expose backend or local secrets.
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../dist/', import.meta.url));
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'instrucoes.html', 'produto.html', 'equipe.html',
  'referencias.html', 'jogo.html', 'simulador.html', 'historico.html', 'jogar.html',
  'parte2.js', 'css', 'js', 'assets', 'game']) {
  await cp(root + name, out + name, { recursive: true });
}
console.log('Frontend preparado em dist/; backend e segredos não incluídos.');
