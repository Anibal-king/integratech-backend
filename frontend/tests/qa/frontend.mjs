/** Compila el sitio para QA (si hace falta) y lo sirve en :4400 (API de QA) y :4401 (API apagada). */
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { RAIZ, API, WHATSAPP_QA, PUERTO_WEB, PUERTO_WEB_SIN_API, PUERTO_API_MUERTA } from './entorno.mjs';

const FRONT = path.join(RAIZ, 'frontend');
// Dentro del proyecto: el servidor compilado resuelve sus paquetes en frontend/node_modules
const BUILD = path.join(FRONT, 'tests/resultados');
const astro = path.join(FRONT, 'node_modules/astro/bin/astro.mjs');
const destinos = [
  { dir: path.join(BUILD, 'dist'), api: API, puerto: PUERTO_WEB },
  { dir: path.join(BUILD, 'dist-sin-api'), api: `http://localhost:${PUERTO_API_MUERTA}`, puerto: PUERTO_WEB_SIN_API },
];
for (const d of destinos) {
  if (process.env.QA_REUSAR_BUILD === '1' && existsSync(path.join(d.dir, 'server/entry.mjs'))) continue;
  const r = spawnSync(process.execPath, [astro, 'build', '--outDir', d.dir], {
    cwd: FRONT, stdio: 'inherit',
    env: { ...process.env, PUBLIC_API_URL: d.api, PUBLIC_WHATSAPP_NUMBER: WHATSAPP_QA, AUTO_BACKEND: 'false' },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const hijos = destinos.map((d) =>
  spawn(process.execPath, [path.join(d.dir, 'server/entry.mjs')], { stdio: 'inherit', env: { ...process.env, HOST: 'localhost', PORT: String(d.puerto) } })
);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => hijos.forEach((h) => h.kill(s)));
