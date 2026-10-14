# SenseVision — redesign das seis páginas

Atualização posterior: a pedido do usuário, as cores originais foram restauradas
em css/design.css (ciano #00d9d6, rosa #f03c8a, fundo #f6f7fb e tema escuro
#101018/#181822), mantendo o layout responsivo do redesign. Esta decisão
substitui a direção cromática descrita abaixo.

## Direção visual
Redesign autorizado com liberdade em relação ao Figma. Mantidos HTML, CSS e
JavaScript, conteúdo principal, nomes, fotos, perfis e links existentes.
As skills design, ui-ux-pro-max e design-system orientaram hierarquia,
componentes reutilizáveis e tokens; ui-styling orientou responsividade sem
introduzir frameworks.

A primeira pesquisa sugeriu claymorphism, inadequado aos dois temas. A segunda
consulta, “education accessibility minimal”, orientou uma composição limpa,
com grid, contraste e hierarquia. Preservada a família turquesa da marca, com
tons escuros para texto no tema claro e menta no tema escuro.

## Implementação
- css/design.css é a base compartilhada de layout. Arquivos antigos preservados,
  mas não carregados; css/icons.css continua fornecendo os ícones SVG locais.
- Tokens primitivos, semânticos e de componentes, com aliases no tema escuro.
- Container máximo de 1280px, margens fluidas, header e footer comuns.
- Navegação centralizada, estado ativo sublinhado e menu mobile em fluxo.
- Início: duas colunas, demonstração visual e benefícios.
- Instruções: seis passos em grid e fluxo legível.
- Produto: custos alinhados em desktop e cards rotulados no celular. Atributos
  data-mobile legados não alteram mais os preços conforme a largura.
- Equipe: fotos em destaque, perfis preservados e formulário com labels.
- Referências: categorias, cards legíveis e links sublinhados.
- Jogo: história, aviso de vídeo pendente, passos e link existente.
- Foco visível, atalho ao conteúdo, movimento reduzido e campos com fonte 16px.

## Validação
- 72 combinações: seis páginas × claro/escuro × 320, 375, 768, 1024, 1440 e 1920px.
- Sem transbordamento horizontal ou imagens quebradas; um h1 por página.
- Header com altura consistente entre páginas em cada largura. Ajuste adicional
  de 320px testado: 81px de altura, sem quebra dos controles.
- Inspeção visual das seis páginas em desktop e celular, incluindo tema escuro.
- Controles de tema desktop/mobile funcionando e links internos mantendo o tema.
- Escape fecha o menu e devolve foco ao botão.
- Não representa certificação WCAG nem teste em todos os navegadores.

## Pendências fora do redesign
- Vídeos reais de até 40 segundos ainda não fornecidos.
- Formulário abre o aplicativo de e-mail; não envia diretamente pelo site.
- Textos técnicos e valores preservados. Menções distintas a Raspberry Pi/ESP32
  precisam de confirmação do grupo, não de decisão visual.
- Redesign local, não enviado ao GitHub ou publicado na Vercel nesta revisão.
