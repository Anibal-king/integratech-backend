const path = require('node:path');

// Carga backend/.env si existe (opcional). Node 22.5+ trae process.loadEnvFile.
// Vive aquí (y no en server.js) para que seed.js y migrate.js también lo lean.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // Sin archivo .env: se usan solo las variables del entorno.
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Ruta de la base SQLite. Siempre absoluta: un DATABASE_PATH relativo se resuelve
 * contra backend/, nunca contra el directorio desde donde se arranca el proceso.
 */
const DATABASE_PATH = process.env.DATABASE_PATH
  ? path.resolve(__dirname, process.env.DATABASE_PATH)
  : path.join(__dirname, 'db', 'siie.db');

/** Orígenes permitidos por CORS (lista separada por comas). */
const DEV_ORIGINS = ['http://localhost:4321', 'http://127.0.0.1:4321'];
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

module.exports = {
  isProduction,
  /** Token de las rutas administrativas (GET de mensajes y leads). Vacío = rutas deshabilitadas. */
  ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? '',
  /** Número de proxies delante del servidor (para que req.ip sea la IP real). */
  TRUST_PROXY: Number(process.env.TRUST_PROXY) || 0,
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_PATH,
  CORS_ORIGINS: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : isProduction ? [] : DEV_ORIGINS,
};
