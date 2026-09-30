/**
 * Protecciones de la API sin dependencias externas:
 *  - requireAdmin: rutas administrativas (listados con datos personales)
 *  - rateLimit:    límite de envíos por IP para los formularios públicos
 *  - securityHeaders: cabeceras básicas para respuestas JSON
 *  - campoTexto:   normaliza y limita la longitud de los campos recibidos
 */
const crypto = require('node:crypto');
const { ADMIN_TOKEN } = require('../config');

/** @typedef {(req: any, res: any, next: (err?: unknown) => void) => void} Middleware */

/**
 * Exige `Authorization: Bearer <ADMIN_TOKEN>`.
 * Sin ADMIN_TOKEN configurado la ruta queda deshabilitada (404): nunca pública por defecto.
 * @type {Middleware}
 */
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(404).json({ error: 'Ruta no encontrada' });

  const recibido = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1] ?? '';
  // Se comparan los hashes: misma longitud siempre y comparación en tiempo constante.
  const hash = (/** @type {string} */ s) => crypto.createHash('sha256').update(s).digest();
  if (!recibido || !crypto.timingSafeEqual(hash(recibido), hash(ADMIN_TOKEN))) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

/**
 * Límite de peticiones por IP en una ventana de tiempo (en memoria: se reinicia
 * con el proceso; suficiente para una sola instancia).
 * @param {{ max: number, ventanaMs: number }} opciones
 * @returns {Middleware}
 */
function rateLimit({ max, ventanaMs }) {
  /** @type {Map<string, { n: number, desde: number }>} */
  const visitas = new Map();

  // Limpieza periódica para que el mapa no crezca sin límite.
  setInterval(() => {
    const ahora = Date.now();
    for (const [ip, v] of visitas) if (ahora - v.desde > ventanaMs) visitas.delete(ip);
  }, ventanaMs).unref();

  return (req, res, next) => {
    const ip = req.ip ?? 'desconocida';
    const ahora = Date.now();
    const v = visitas.get(ip);
    if (!v || ahora - v.desde > ventanaMs) {
      visitas.set(ip, { n: 1, desde: ahora });
      return next();
    }
    v.n += 1;
    if (v.n > max) {
      res.set('Retry-After', String(Math.ceil((v.desde + ventanaMs - ahora) / 1000)));
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' });
    }
    next();
  };
}

/** @type {Middleware} */
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-site',
  });
  next();
}

/**
 * Convierte un valor recibido en texto recortado; '' si no es texto.
 * Devuelve null si supera `max` caracteres (el llamador responde 400).
 * @param {unknown} valor
 * @param {number} max
 * @returns {string | null}
 */
function campoTexto(valor, max) {
  const s = typeof valor === 'string' ? valor.trim() : typeof valor === 'number' ? String(valor) : '';
  return s.length > max ? null : s;
}

module.exports = { requireAdmin, rateLimit, securityHeaders, campoTexto };
