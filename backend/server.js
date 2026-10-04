const config = require('./config'); // primero: carga backend/.env
const express = require('express');
const cors = require('cors');
const { DB_PATH, initSchema, get } = require('./db');
const { seed } = require('./db/seed');
const { securityHeaders } = require('./lib/security');
const { URL_MEDIA } = require('./lib/fotos');

/** @typedef {import('../shared/api-types').Health} Health */

const empresaRoutes = require('./routes/empresa');
const clientesRoutes = require('./routes/clientes');
const serviciosRoutes = require('./routes/servicios');
const proyectosRoutes = require('./routes/proyectos');
const marcasRoutes = require('./routes/marcas');
const legalRoutes = require('./routes/legal');
const contactoRoutes = require('./routes/contacto');
const leadChatbotRoutes = require('./routes/lead-chatbot');
const adminRoutes = require('./routes/admin');

// db/index.js ya abrió (y por tanto creó) el archivo: se decide por el contenido.
const TABLAS_PRINCIPALES = ['empresa', 'categorias_servicios', 'servicios', 'clientes', 'otros_clientes', 'proyectos_destacados', 'marcas'];

initSchema(); // crea las tablas que falten (idempotente)
const vacia = !get('SELECT 1 AS x FROM categorias_servicios LIMIT 1') && !get('SELECT 1 AS x FROM empresa LIMIT 1');
if (vacia) {
  console.log('Base de datos sin contenido: poblando (seed) por primera vez...');
  seed();
}

const app = express();
app.disable('x-powered-by');
// Detrás de un proxy (Nginx, Render, etc.) indica cuántos saltos hay para que req.ip sea la IP real.
if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY);
app.use(securityHeaders);

// CORS: lo usan los POST del navegador (formulario y chatbot) y el panel de administración,
// que envía la cookie de sesión (credentials). Los GET públicos los hace Astro en el servidor.
// Con credentials solo se reflejan los orígenes de la lista, nunca "*".
if (config.CORS_ORIGINS.length === 0) {
  console.warn('⚠️  CORS_ORIGIN no está definido: el navegador no podrá llamar a la API desde otro origen.');
}
app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: '16kb' }));

// Fotos subidas desde el panel. Los nombres son aleatorios y nunca se reutilizan:
// se pueden cachear sin límite. Cross-origin: el sitio puede estar en otro dominio.
app.use(
  URL_MEDIA,
  express.static(config.UPLOADS_DIR, {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    immutable: true,
    maxAge: '365d',
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

app.get('/api/health', (req, res) => {
  /** @type {Health} */
  const health = { ok: true, servicio: 'SIIE API', version: '1.0.0', db: { ok: true } };
  try {
    /** @type {Record<string, number>} */
    const conteos = {};
    for (const tabla of TABLAS_PRINCIPALES) {
      /** @type {{ n: number } | undefined} */
      const fila = get(`SELECT COUNT(*) AS n FROM ${tabla}`);
      conteos[tabla] = fila?.n ?? 0;
    }
    health.db.conteos = conteos;
  } catch (err) {
    console.error('[health] la base de datos no responde:', err);
    health.ok = false;
    health.db.ok = false;
  }
  res.status(health.ok ? 200 : 503).json(health);
});

app.use('/api/empresa', empresaRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/marcas', marcasRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/lead-chatbot', leadChatbotRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejador de errores centralizado: el detalle va al log, nunca a la respuesta.
// Express 5 también enruta aquí las excepciones y promesas rechazadas de los handlers
// (lo reconoce como manejador de errores por sus 4 parámetros).
app.use((err, req, res, next) => {
  // Errores del cliente (JSON mal formado, cuerpo demasiado grande): 4xx con mensaje genérico.
  const status = Number(err?.status);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: 'Solicitud inválida' });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.PORT, () => {
  console.log(`🚀 API de SIIE corriendo en http://localhost:${config.PORT}`);
  console.log(`   Base de datos: ${DB_PATH}`);
  console.log(`   Fotos subidas: ${config.UPLOADS_DIR}`);
  console.log(`   CORS: ${config.CORS_ORIGINS.join(', ') || '(ninguno)'}`);
  console.log(`   Prueba: http://localhost:${config.PORT}/api/health`);
});
