/** Prepara la copia de la base + usuario de prueba y arranca el backend de QA. */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { RAIZ, QA_DIR, DB_QA, ADMIN_QA, PUERTO_API, PUERTO_WEB } from './entorno.mjs';

const BACKEND = path.join(RAIZ, 'backend');
rmSync(path.join(QA_DIR, 'uploads'), { recursive: true, force: true });
rmSync(path.join(QA_DIR, 'conversaciones'), { recursive: true, force: true });
for (const f of [DB_QA, DB_QA + '-wal', DB_QA + '-shm']) rmSync(f, { force: true });
mkdirSync(QA_DIR, { recursive: true });

// Copia consistente de la base real (solo lectura sobre el original)
const original = new DatabaseSync(path.join(BACKEND, 'db/siie.db'), { readOnly: true });
original.exec(`VACUUM INTO '${DB_QA.replaceAll("'", "''")}'`);
original.close();
const uploads = path.join(BACKEND, 'storage/uploads');
if (existsSync(uploads)) cpSync(uploads, path.join(QA_DIR, 'uploads'), { recursive: true });
mkdirSync(path.join(QA_DIR, 'conversaciones'), { recursive: true });

// Usuario del panel SOLO en la copia
const argon2 = createRequire(path.join(BACKEND, 'package.json'))('argon2');
const correo = 'qa@integratech.test';
const password = randomBytes(18).toString('base64url');
const db = new DatabaseSync(DB_QA);
db.prepare('DELETE FROM admin_sesiones').run();
db.prepare('DELETE FROM admin_usuarios WHERE correo = ?').run(correo);
db.prepare('INSERT INTO admin_usuarios (correo, password_hash) VALUES (?, ?)').run(correo, await argon2.hash(password, { type: argon2.argon2id }));
db.close();
writeFileSync(ADMIN_QA, JSON.stringify({ correo, password }));

const hijo = spawn(process.execPath, ['server.js'], {
  cwd: BACKEND,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(PUERTO_API),
    DATABASE_PATH: DB_QA,
    UPLOADS_DIR: path.join(QA_DIR, 'uploads'),
    CONVERSACIONES_DIR: path.join(QA_DIR, 'conversaciones'),
    CORS_ORIGIN: `http://localhost:${PUERTO_WEB},http://localhost:4401`,
    TRUST_PROXY: '1', // cada prueba manda su propia IP (X-Forwarded-For) para no chocar con el límite de envíos
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', MAIL_TO_LEADS: '', MAIL_TO_COTIZACIONES: '',
    NODE_ENV: 'development',
  },
});
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => hijo.kill(s));
hijo.on('exit', (c) => process.exit(c ?? 0));
