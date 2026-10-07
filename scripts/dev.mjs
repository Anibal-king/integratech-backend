// npm run dev (desde la raíz): levanta backend y frontend a la vez.
// Sin dependencias: lanza ambos procesos con el mismo Node (no pasa por npm ni
// por la shell, así evita el error `spawn ... ENOENT` por ComSpec en Windows).
// Ctrl+C detiene los dos; si uno termina, se detiene el otro.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const procesos = [
  { nombre: 'backend ', cwd: path.join(root, 'backend'), args: ['--watch', 'server.js'], color: 36 },
  {
    nombre: 'frontend',
    cwd: path.join(root, 'frontend'),
    args: [path.join('node_modules', 'astro', 'bin', 'astro.mjs'), 'dev'],
    color: 35,
    // Astro 7 se pasa solo a segundo plano si detecta un agente de IA (Claude Code,
    // Cursor...) y el comando termina al instante, lo que aquí apagaría el backend.
    // Con esta variable corre en primer plano: este script ya gestiona su ciclo de vida.
    env: { ASTRO_DEV_BACKGROUND: '1' },
  },
];

const hijos = procesos.map(({ nombre, cwd, args, color, env }) => {
  const prefijo = `\x1b[${color}m[${nombre}]\x1b[0m `;
  const hijo = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env } });
  const reenviar = (destino) => (chunk) =>
    destino.write(
      chunk
        .toString()
        .split(/\r?\n/)
        .filter((l, i, a) => l || i < a.length - 1)
        .map((l) => prefijo + l)
        .join('\n') + '\n'
    );
  hijo.stdout.on('data', reenviar(process.stdout));
  hijo.stderr.on('data', reenviar(process.stderr));
  hijo.on('exit', (code) => {
    console.log(`${prefijo}terminó (código ${code ?? 'señal'})`);
    detener(code ?? 0);
  });
  return hijo;
});

let deteniendo = false;
function detener(code = 0) {
  if (deteniendo) return;
  deteniendo = true;
  for (const h of hijos) if (h.exitCode === null) h.kill();
  process.exitCode = code;
}

process.on('SIGINT', () => detener(0));
process.on('SIGTERM', () => detener(0));
