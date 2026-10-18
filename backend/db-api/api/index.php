<?php
/**
 * SenseVision — API do banco de dados (roda no Hostinger, junto do MySQL).
 * Só o Worker da Cloudflare chama este arquivo, com o cabeçalho X-Api-Secret.
 * O navegador nunca fala direto com ele.
 *
 * Todas as ações usam consultas preparadas (sem SQL montado com texto do usuário).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$cfgFile = __DIR__ . '/config.php';
if (!is_file($cfgFile)) { http_response_code(500); echo '{"error":"config.php ausente"}'; exit; }
$cfg = require $cfgFile;

function out($data): void { echo json_encode(['result' => $data], JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code, string $detail = ''): void { http_response_code($code); echo json_encode(['error' => $msg, 'detail' => $detail]); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('method', 405);
if (!hash_equals((string)$cfg['api_secret'], (string)($_SERVER['HTTP_X_API_SECRET'] ?? ''))) fail('forbidden', 403);

$raw = file_get_contents('php://input', false, null, 0, 16384);
$in = json_decode($raw ?: '', true);
if (!is_array($in) || !isset($in['action'])) fail('bad request', 400);

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_name']),
        $cfg['db_user'],
        $cfg['db_pass'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (Throwable $e) {
    error_log('SenseVision DB connect: ' . $e->getMessage());
    fail('db connect', 500);
}

$str = static fn($v, int $max): string => mb_substr((string)$v, 0, $max);

try {
    switch ($in['action']) {

        case 'user_get': {
            $st = $pdo->prepare('SELECT id, email, name, salt, hash, iters, created_at FROM users WHERE email = ?');
            $st->execute([$str($in['email'] ?? '', 255)]);
            $u = $st->fetch();
            out($u ? [
                'id' => $u['id'], 'email' => $u['email'], 'name' => $u['name'],
                'salt' => $u['salt'], 'hash' => $u['hash'],
                'iters' => (int)$u['iters'], 'createdAt' => (int)$u['created_at'],
            ] : null);
        }

        case 'user_create': {
            $u = $in['user'] ?? [];
            try {
                $st = $pdo->prepare('INSERT INTO users (id, email, name, salt, hash, iters, created_at) VALUES (?,?,?,?,?,?,?)');
                $st->execute([
                    $str($u['id'] ?? '', 36), $str($u['email'] ?? '', 255), $str($u['name'] ?? '', 60),
                    $str($u['salt'] ?? '', 64), $str($u['hash'] ?? '', 64),
                    (int)($u['iters'] ?? 0), (int)($u['createdAt'] ?? 0),
                ]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') fail('duplicate', 409);
                throw $e;
            }
            out(true);
        }

        case 'session_create': {
            $pdo->prepare('DELETE FROM sessions WHERE expires_at < ?')->execute([time()]); // limpeza
            $d = $in['data'] ?? [];
            $st = $pdo->prepare('REPLACE INTO sessions (token_hash, uid, email, name, expires_at) VALUES (?,?,?,?,?)');
            $st->execute([
                $str($in['tokenHash'] ?? '', 64), $str($d['uid'] ?? '', 36),
                $str($d['email'] ?? '', 255), $str($d['name'] ?? '', 60),
                time() + max(60, (int)($in['ttl'] ?? 3600)),
            ]);
            out(true);
        }

        case 'session_get': {
            $st = $pdo->prepare('SELECT uid, email, name FROM sessions WHERE token_hash = ? AND expires_at > ?');
            $st->execute([$str($in['tokenHash'] ?? '', 64), time()]);
            out($st->fetch() ?: null);
        }

        case 'session_delete': {
            $pdo->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$str($in['tokenHash'] ?? '', 64)]);
            out(true);
        }

        case 'history_add': {
            $e = $in['entry'] ?? [];
            $id = bin2hex(random_bytes(8));
            $ts = (int)floor(microtime(true) * 1000);
            $source = ($e['source'] ?? '') === 'foto' ? 'foto' : 'teclado';
            $display = $str($e['display'] ?? '', 200);
            $expr = $str($e['expr'] ?? '', 200);
            $pdo->prepare('INSERT INTO history (id, uid, display, expr, source, ts) VALUES (?,?,?,?,?,?)')
                ->execute([$id, $str($in['uid'] ?? '', 36), $display, $expr, $source, $ts]);
            out(['display' => $display, 'expr' => $expr, 'source' => $source, 'id' => $id, 'ts' => $ts]);
        }

        case 'history_list': {
            $limit = max(1, min(200, (int)($in['limit'] ?? 100)));
            $st = $pdo->prepare("SELECT id, display, expr, source, ts FROM history WHERE uid = ? ORDER BY ts DESC LIMIT $limit");
            $st->execute([$str($in['uid'] ?? '', 36)]);
            $rows = $st->fetchAll();
            foreach ($rows as &$r) { $r['ts'] = (int)$r['ts']; }
            out($rows);
        }

        case 'history_delete': {
            $pdo->prepare('DELETE FROM history WHERE uid = ? AND id = ?')
                ->execute([$str($in['uid'] ?? '', 36), $str($in['id'] ?? '', 40)]);
            out(true);
        }

        case 'history_clear': {
            $pdo->prepare('DELETE FROM history WHERE uid = ?')->execute([$str($in['uid'] ?? '', 36)]);
            out(true);
        }

        case 'fail_get': {
            $st = $pdo->prepare('SELECT fails FROM login_failures WHERE email = ? AND expires_at > ?');
            $st->execute([$str($in['email'] ?? '', 255), time()]);
            $row = $st->fetch();
            out($row ? (int)$row['fails'] : 0);
        }

        case 'fail_set': {
            $pdo->prepare('REPLACE INTO login_failures (email, fails, expires_at) VALUES (?,?,?)')
                ->execute([$str($in['email'] ?? '', 255), (int)($in['count'] ?? 0), time() + max(60, (int)($in['ttl'] ?? 900))]);
            out(true);
        }

        case 'fail_clear': {
            $pdo->prepare('DELETE FROM login_failures WHERE email = ?')->execute([$str($in['email'] ?? '', 255)]);
            out(true);
        }

        default:
            fail('unknown action', 400);
    }
} catch (Throwable $e) {
    error_log('SenseVision DB: ' . $e->getMessage());
    fail('db error', 500);
}
