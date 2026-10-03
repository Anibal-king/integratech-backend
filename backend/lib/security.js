/**
 * Protecciones de la API sin dependencias externas
 * (la sesión del panel de administración está en lib/auth.js):
 *  - rateLimit:    límite de envíos por IP para los formularios públicos
 *  - securityHeaders: cabeceras básicas para respuestas JSON
 *  - campoTexto:   normaliza y limita la longitud de los campos recibidos
 */

/** @typedef {(req: any, res: any, next: (err?: unknown) => void) => void} Middleware */

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

module.exports = { rateLimit, securityHeaders, campoTexto };
