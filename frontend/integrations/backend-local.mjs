/**
 * Integración de Astro: garantiza que la API local esté disponible mientras
 * corre `astro dev` (las páginas leen los datos en el servidor). El build ya no
 * la necesita: ninguna página prerenderizada usa la API.
 *
 * Si PUBLIC_API_URL apunta a esta máquina y la API no responde, arranca
 * backend/server.js con el mismo Node y lo detiene al cerrar Astro. Si la API
 * ya está corriendo (p. ej. con `npm run dev` desde la raíz), no hace nada.
 *
 * Desactivar: AUTO_BACKEND=false en frontend/.env o en el entorno.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BACKEND_DIR = fileURLToPath(new URL('../../backend/', import.meta.url));
const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Lee una variable de frontend/.env (Astro aún no la expone al cargar la config). */
function leerEnv(nombre) {
  if (process.env[nombre] !== undefined) return process.env[nombre];
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const m = env.match(new RegExp(`^\\s*${nombre}\\s*=\\s*(.*?)\\s*$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string} url */
async function responde(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** @returns {import('astro').AstroIntegration} */
export default function backendLocal() {
  /** @type {import('node:child_process').ChildProcess | null} */
  let hijo = null;

  const detener = () => {
    if (hijo && hijo.exitCode === null) hijo.kill();
    hijo = null;
  };

  /** @param {import('astro').AstroIntegrationLogger} logger */
  async function asegurarBackend(logger) {
    if (leerEnv('AUTO_BACKEND') === 'false') return;

    const api = new URL(leerEnv('PUBLIC_API_URL') || 'http://localhost:3000');
    const health = new URL('/api/health', api).href;
    if (!HOSTS_LOCALES.has(api.hostname)) return; // API remota: no es asunto nuestro
    if (await responde(health)) {
      logger.info(`API disponible en ${api.origin}`);
      return;
    }
    if (!existsSync(path.join(BACKEND_DIR, 'node_modules', 'express'))) {
      logger.warn('La API no responde y backend/ no tiene dependencias: ejecuta `npm --prefix ../backend install`.');
      return;
    }

    logger.info(`La API no responde en ${api.origin}: arrancando backend/server.js…`);
    hijo = spawn(process.execPath, ['server.js'], {
      cwd: BACKEND_DIR,
      // Siempre en modo desarrollo: este backend es solo local.
      env: { ...process.env, NODE_ENV: 'development', PORT: api.port || '3000' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const reenviar = (/** @type {Buffer} */ chunk, /** @type {'info' | 'error'} */ nivel) => {
      for (const linea of chunk.toString().split(/\r?\n/)) {
        if (linea.trim() && !linea.includes('ExperimentalWarning')) logger[nivel](`[backend] ${linea}`);
      }
    };
    hijo.stdout?.on('data', (c) => reenviar(c, 'info'));
    hijo.stderr?.on('data', (c) => reenviar(c, 'error'));
    hijo.on('exit', (code) => {
      if (code) logger.error(`[backend] terminó con código ${code}`);
      hijo = null;
    });
    process.once('exit', detener);

    // Espera a que responda (máx. ~10 s) antes de que Astro empiece a pedir datos.
    for (let i = 0; i < 20 && hijo; i++) {
      if (await responde(health)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    logger.warn('El backend no respondió a tiempo; las secciones mostrarán el estado de error.');
  }

  return {
    name: 'integratech:backend-local',
    hooks: {
      'astro:server:setup': ({ logger }) => asegurarBackend(logger),
      'astro:server:done': detener,
    },
  };
}
