<?php
/**
 * Copie este arquivo como "config.php" DIRETO NO SERVIDOR e preencha lá.
 * Nunca coloque as senhas reais neste arquivo de exemplo nem envie config.php para o GitHub.
 */
return [
    // Host do MySQL. Teste primeiro 'localhost'; se o banco estiver em outro servidor,
    // use o host que a hospedagem informar (e libere o acesso remoto para o servidor do PHP).
    'db_host' => 'localhost',
    'db_name' => 'COLOQUE_O_NOME_DO_BANCO',
    'db_user' => 'COLOQUE_O_USUARIO',
    'db_pass' => 'COLOQUE_A_SENHA',

    // Senha longa e aleatória. A MESMA vai no Worker como secret DB_API_SECRET.
    'api_secret' => 'COLOQUE_UMA_CHAVE_LONGA_E_ALEATORIA',
];
