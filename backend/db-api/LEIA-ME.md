# Ligar o banco de dados (MySQL do Hostinger)

O site (Cloudflare) fala com um PHP que roda no Hostinger; o PHP fala com o MySQL.
Enquanto os passos abaixo não forem feitos, as contas ficam no KV da Cloudflare e tudo funciona.

## 1. Criar as tabelas
1. Abra o phpMyAdmin pelo link do e-mail da escola e entre com o usuário e senha do banco.
2. Escolha o banco do projeto, vá na aba **SQL**, cole o conteúdo de `schema.sql` e clique em **Executar**.

## 2. Enviar o PHP
1. No Hostinger, abra o **Gerenciador de Arquivos** (ou use o FTP) e entre na pasta `public_html`.
2. Crie a pasta `sensevision-api` e envie para dentro dela os arquivos de `db-api/api/`:
   `index.php`, `config.example.php` e `.htaccess`.
3. Dentro dessa pasta, copie `config.example.php` para **`config.php`** e edite **lá no servidor**:
   - `db_host`: `localhost`
   - `db_name`, `db_user`, `db_pass`: os dados do banco
   - `api_secret`: uma chave longa e aleatória (guarde, vai no passo 3)
4. Confira que `https://SEU-DOMINIO/sensevision-api/config.php` NÃO abre no navegador (deve dar erro 403).

## 3. Ligar o Worker ao PHP (no PowerShell do PC)
```powershell
cd C:\Users\Usuario\Documents\PESSOAL\TCC\cloud
npx.cmd wrangler secret put DB_API_URL      # https://SEU-DOMINIO/sensevision-api/index.php
npx.cmd wrangler secret put DB_API_SECRET   # a mesma chave do config.php
```
Cada comando pede o valor (cole só no prompt). Não precisa de novo deploy.

## 4. Testar
Crie uma conta no site, entre, resolva uma conta e veja a linha nova na tabela `history` no phpMyAdmin.

## Voltar ao KV
Para desligar o banco, apague o secret: `npx.cmd wrangler secret delete DB_API_URL`.
