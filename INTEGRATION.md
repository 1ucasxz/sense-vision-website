# Integração das funções SenseVision

Origem: https://github.com/kao04/sensevision, revisão 92ef9a9.

Foram incorporados simulador matemático, representações visuais com frutas, voz e sons, acesso de conta, histórico, conexão com câmera/OCR e jogo embarcado. A apresentação reaproveita o layout atual e a paleta ciano/rosa. Os arquivos gerados do jogo foram preservados.

## Desenvolvimento

Com Node 24 instalado, execute `npm install` e `npm run dev`. Abra http://127.0.0.1:5174. Esse servidor oferece o site e a API Worker com armazenamento local, separado da produção. Após alterar arquivos públicos, execute `npm run build` e recarregue o navegador.

Teste de integração: `node scripts/test-integration.mjs`, com o servidor local ativo. O teste cria uma conta sintética local e verifica operações matemáticas, cadastro, login, sessão e salvar/listar/excluir histórico. Não usa credenciais reais.

## Publicação e dependências externas

- A configuração Vercel publica somente `dist`, sem arquivos privados ou código PHP. Ela não executa o Worker Cloudflare: login, histórico e câmera precisam da API hospedada/configurada antes de funcionar em produção.
- O backend original está em `backend/cloud`; suas rotas e regras foram preservadas. Configure os recursos e segredos necessários no ambiente de publicação, nunca no JavaScript público. O MySQL opcional e sua configuração estão documentados em `backend/db-api/LEIA-ME.md`.
- Câmera/OCR dependem de equipamento conectado e configuração real do serviço; os testes locais verificam apenas a resposta sem imagem disponível.
- O formulário usa FormSubmit para `lucas2008barboza@gmail.com`. O destinatário precisa ativar o serviço. Nenhuma mensagem real foi enviada durante os testes.
- Nenhuma publicação ou envio ao GitHub foi realizado nesta integração.
