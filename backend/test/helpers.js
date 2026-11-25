/**
 * Utilidades de los tests: base SQLite temporal, app en un puerto aleatorio,
 * sesión de administrador y un generador de .zip mínimo.
 * Cada archivo de test corre en su propio proceso (node --test), con su propia base.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const ORIGEN = 'http://panel.test';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'siie-test-'));

// Antes de cargar config.js (process.loadEnvFile no pisa variables ya definidas).
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_PATH: path.join(tmp, 'test.db'),
  UPLOADS_DIR: path.join(tmp, 'uploads'),
  CONVERSACIONES_DIR: path.join(tmp, 'conversaciones'),
  CORS_ORIGIN: ORIGEN,
  TRUST_PROXY: '1', // permite simular IPs distintas con X-Forwarded-For
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: '',
});

/** Levanta la app y devuelve la URL base y una función para cerrarla. */
async function iniciar() {
  const app = require('../server');
  const servidor = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s));
  });
  const { port } = /** @type {import('node:net').AddressInfo} */ (servidor.address());
  return {
    url: `http://127.0.0.1:${port}`,
    cerrar: () => {
      servidor.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

/** Crea un administrador y devuelve la cookie de su sesión. */
function cookieAdmin() {
  const { db } = require('../db');
  const { crearSesion } = require('../lib/auth');
  const info = db.prepare("INSERT INTO admin_usuarios (correo, password_hash) VALUES (?, 'x')").run(`admin${Date.now()}@test.local`);
  return `siie_admin=${crearSesion(Number(info.lastInsertRowid))}`;
}

/**
 * Zip mínimo (deflate) con las entradas dadas.
 * @param {Record<string, string | Buffer>} archivos
 */
function crearZip(archivos) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const datos = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8');
    const comprimido = zlib.deflateRawSync(datos);
    const n = Buffer.from(nombre, 'utf8');
    const crc = zlib.crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locales.push(local, n, comprimido);
    centrales.push(central, n);
    offset += 30 + n.length + comprimido.length;
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(centrales.length / 2, 8);
  fin.writeUInt16LE(centrales.length / 2, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, dir, fin]);
}

module.exports = { ORIGEN, iniciar, cookieAdmin, crearZip };
