-- SenseVision: tabelas de contas, sessões e histórico.
-- Execute no phpMyAdmin (aba SQL) do banco do projeto.

CREATE TABLE IF NOT EXISTS users (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  salt        VARCHAR(64)  NOT NULL,
  hash        VARCHAR(64)  NOT NULL,
  iters       INT          NOT NULL,
  created_at  BIGINT       NOT NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  CHAR(64)     NOT NULL PRIMARY KEY,
  uid         CHAR(36)     NOT NULL,
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  expires_at  BIGINT       NOT NULL,
  KEY idx_sessions_exp (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS history (
  id          VARCHAR(40)  NOT NULL PRIMARY KEY,
  uid         CHAR(36)     NOT NULL,
  display     VARCHAR(200) NOT NULL,
  expr        VARCHAR(200) NOT NULL,
  source      VARCHAR(10)  NOT NULL,
  ts          BIGINT       NOT NULL,
  KEY idx_history_user_ts (uid, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_failures (
  email       VARCHAR(255) NOT NULL PRIMARY KEY,
  fails       INT          NOT NULL,
  expires_at  BIGINT       NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
