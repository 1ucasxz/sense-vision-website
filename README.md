# SenseVision

Óculos inteligentes que capturam exercícios matemáticos e os transformam em representações visuais simples para pessoas com Discalculia.

Projeto de TCC (3º Ano) — frontend estático, sem frameworks.

## Estrutura

```
index.html        # Apresentação
instrucoes.html   # Instruções
produto.html      # Produto e custos
equipe.html       # Fotos, nomes, redes sociais e formulário
referencias.html  # Referências científicas e técnicas
jogo.html         # História, contexto e acesso ao jogo
css/style.css     # Layout e classes compartilhados da etapa 1
css/responsive.css # Responsividade compartilhada das seis páginas
parte2.css        # Componentes específicos da etapa 2
js/script.js      # Menu mobile compartilhado
js/theme.js       # Alternância de tema compartilhada
```

## Rodando localmente

```bash
python3 -m http.server 5173
```

Depois acesse `http://localhost:5173`.

## Publicação

Repositório: https://github.com/1ucasxz/sense-vision-website

O repositório já possui integração de produção com a Vercel. É um site estático,
sem instalação de dependências ou etapa de compilação. Preservar a raiz do
projeto como diretório de publicação.

## Pendências da etapa 2

- Receber o vídeo real do jogo e verificar duração máxima de 40 segundos.
- Confirmar com a equipe o destino GDevelop; o botão preserva o endereço do
  jogo solicitado anteriormente: https://maxxagenciadigital.com.br/matf/.
- O formulário abre o aplicativo de e-mail com uma mensagem para
  lucas2008barboza@gmail.com. O usuário precisa concluir o envio nesse aplicativo;
  não existe envio automático nem backend. Os campos não são apagados.
- Confirmar os dados de identificação e fotos já fornecidos pela equipe.
- O histórico deve conter somente commits reais. A distribuição ao longo de
  duas semanas depende do trabalho realizado nas datas efetivas e não pode
  ser criada retroativamente.
