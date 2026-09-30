// Verifica que la API responda antes de `astro build`: el sitio es estático y
// los datos se leen durante el build. Sin backend, el build publicaría los
// recuadros de error en lugar de los datos.
import { readFileSync } from 'node:fs';

function leerApiUrl() {
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL;
  try {
    const env = readFileSync(new URL('../frontend/.env', import.meta.url), 'utf8');
    const m = env.match(/^\s*PUBLIC_API_URL\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  } catch {
    // sin .env: valor por defecto
  }
  return 'http://localhost:3000';
}

const url = `${leerApiUrl().replace(/\/$/, '')}/api/health`;

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const health = await res.json();
  if (!res.ok || !health.ok) throw new Error(`HTTP ${res.status}, db.ok=${health?.db?.ok}`);
  const vacias = Object.entries(health.db?.conteos ?? {}).filter(([, n]) => n === 0).map(([t]) => t);
  console.log(`✅ API disponible en ${url}`);
  if (vacias.length) console.warn(`⚠️  Tablas sin datos (se mostrará el estado vacío): ${vacias.join(', ')}`);
} catch (err) {
  console.error(`❌ La API no responde en ${url}: ${err.message}`);
  console.error('   Levanta el backend (npm run backend) antes de construir el sitio.');
  process.exit(1);
}
