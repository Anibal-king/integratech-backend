/**
 * Autenticación del panel de administración.
 *  - Contraseñas con Argon2id (paquete `argon2`).
 *  - Sesiones en SQLite: el navegador guarda un token aleatorio en una cookie
 *    HttpOnly; la base solo guarda su SHA-256. Cerrar sesión borra la fila, así
 *    que la cookie deja de servir de inmediato (a diferencia de un JWT).
 *  - requireAllowedOrigin: las rutas de administración solo aceptan peticiones
 *    del navegador desde los orígenes de CORS_ORIGIN (también frena CSRF).
 */
const crypto = require('node:crypto');
const argon2 = require('argon2');
const { db, get } = require('../db');
const { isProduction, CORS_ORIGINS } = require('../config');

const COOKIE = 'siie_admin';
// La cookie solo viaja a la API, nunca a las páginas del sitio.
const COOKIE_PATH = '/api';
const DURACION_MS = 8 * 60 * 60 * 1000;

/** @typedef {(req: any, res: any, next: (err?: unknown) => void) => void} Middleware */

// ---------- Contraseñas ----------

/** @param {string} password */
function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Hash de una contraseña que nadie conoce: si el correo no existe se verifica
// contra él para que la respuesta tarde lo mismo y no revele qué correos existen.
const hashFicticio = hashPassword(crypto.randomBytes(32).toString('hex'));

/**
 * Devuelve el usuario si correo y contraseña coinciden; null en cualquier otro caso.
 * @param {string} correo
 * @param {string} password
 * @returns {Promise<{ id: number, correo: string } | null>}
 */
async function verificarCredenciales(correo, password) {
  /** @type {{ id: number, correo: string, password_hash: string } | undefined} */
  const usuario = get('SELECT id, correo, password_hash FROM admin_usuarios WHERE correo = ?', correo);
  const hash = usuario?.password_hash ?? (await hashFicticio);
  let ok = false;
  try {
    ok = await argon2.verify(hash, password);
  } catch (err) {
    console.error('[auth] hash ilegible para', correo, err);
  }
  return ok && usuario ? { id: usuario.id, correo: usuario.correo } : null;
}

// ---------- Sesiones ----------

/** @param {string} token */
const sha256 = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Fecha en el formato de datetime('now') de SQLite (UTC), comparable como texto. */
const sqlDate = (/** @type {Date} */ d) => d.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Crea una sesión y devuelve el token en claro (solo para la cookie).
 * @param {number} usuarioId
 */
function crearSesion(usuarioId) {
  db.prepare("DELETE FROM admin_sesiones WHERE expira <= datetime('now')").run();
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO admin_sesiones (usuario_id, token_hash, expira) VALUES (?, ?, ?)').run(
    usuarioId,
    sha256(token),
    sqlDate(new Date(Date.now() + DURACION_MS))
  );
  return token;
}

/** @param {string} token */
function borrarSesion(token) {
  db.prepare('DELETE FROM admin_sesiones WHERE token_hash = ?').run(sha256(token));
}

/**
 * Usuario de una sesión vigente, o undefined.
 * @param {string} token
 * @returns {{ id: number, correo: string } | undefined}
 */
function usuarioDeSesion(token) {
  return get(
    `SELECT u.id, u.correo
       FROM admin_sesiones s JOIN admin_usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND s.expira > datetime('now')`,
    sha256(token)
  );
}

// ---------- Cookie ----------

/**
 * Lee la cookie de sesión del header Cookie (sin dependencias).
 * @param {any} req
 * @returns {string}
 */
function leerToken(req) {
  const header = req.get('cookie') ?? '';
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === COOKIE) return parte.slice(i + 1).trim();
  }
  return '';
}

/** @param {number} maxAgeMs */
function opcionesCookie(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: /** @type {const} */ ('lax'),
    secure: isProduction,
    path: COOKIE_PATH,
    maxAge: maxAgeMs,
  };
}

/** @param {any} res @param {string} token */
function enviarCookie(res, token) {
  res.cookie(COOKIE, token, opcionesCookie(DURACION_MS));
}

/** @param {any} res */
function limpiarCookie(res) {
  const { maxAge, ...opciones } = opcionesCookie(0);
  res.clearCookie(COOKIE, opciones);
}

// ---------- Middlewares ----------

/**
 * Exige un header Origin incluido en CORS_ORIGIN. Las rutas de administración
 * solo las llama el panel desde el navegador, que siempre envía Origin en una
 * petición entre orígenes; sin él (o con otro) se rechaza.
 * @type {Middleware}
 */
function requireAllowedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin || !CORS_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  next();
}

/**
 * Exige una sesión vigente (cookie). Deja el usuario en req.admin.
 * También valida el origen: es el único guardián de las rutas con datos personales.
 * @type {Middleware}
 */
function requireAdmin(req, res, next) {
  requireAllowedOrigin(req, res, () => {
    const token = leerToken(req);
    const usuario = token ? usuarioDeSesion(token) : undefined;
    if (!usuario) {
      if (token) limpiarCookie(res);
      return res.status(401).json({ error: 'Sesión no válida o expirada' });
    }
    req.admin = usuario;
    res.set('Cache-Control', 'no-store'); // datos personales: que ningún caché los guarde
    next();
  });
}

module.exports = {
  hashPassword,
  verificarCredenciales,
  crearSesion,
  borrarSesion,
  leerToken,
  enviarCookie,
  limpiarCookie,
  requireAllowedOrigin,
  requireAdmin,
};
