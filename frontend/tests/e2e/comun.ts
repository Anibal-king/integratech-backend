/**
 * Utilidades comunes de las pruebas de QA.
 *  - Bloquea wa.me / api.whatsapp.com: ningún WhatsApp real se abre.
 *  - Cada prueba envía su propia IP (X-Forwarded-For) a la API de QA, para que el
 *    límite de 5 envíos por IP no mezcle pruebas (la prueba de abuso usa una fija).
 *  - Junta errores de consola y de página.
 */
import { test as base, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { API, WEB, WEB_SIN_API, DB_QA, ADMIN_QA, WHATSAPP_QA } from '../qa/entorno.mjs';

export { expect, API, WEB, WEB_SIN_API };
export const WHATSAPP = WHATSAPP_QA;

let contadorIp = 0;
export const ipNueva = () => `10.${(process.pid % 200) + 1}.${(contadorIp = (contadorIp + 1) % 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

/** Ruido que no es un fallo del sitio (avisos del motor WebGL por software, etc.) */
const RUIDO = /GPU stall|WebGL|swiftshader|GroupMarkerNotSet|Automatic fallback to software|favicon/i;

export async function prepararContexto(context: BrowserContext, ip = ipNueva()) {
  await context.route(/https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//, (r) => r.abort());
  await context.route(`${API}/api/**`, (r) => r.continue({ headers: { ...r.request().headers(), 'x-forwarded-for': ip } }));
}

type Fixtures = { errores: string[] };
export const test = base.extend<Fixtures>({
  errores: async ({ page, context }, use) => {
    await prepararContexto(context);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !RUIDO.test(m.text())) errores.push(`console: ${m.text()}`); });
    await use(errores);
  },
});

export function bd() {
  return new DatabaseSync(DB_QA);
}
export function consulta<T = Record<string, unknown>>(sql: string, ...p: unknown[]): T[] {
  const db = bd();
  try { return db.prepare(sql).all(...(p as [])) as T[]; } finally { db.close(); }
}

export const unico = (pref: string) => `${pref} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Inicia sesión en el panel (usuario de QA) dentro del contexto del navegador. */
export async function iniciarSesion(context: BrowserContext) {
  const { correo, password } = JSON.parse(readFileSync(ADMIN_QA, 'utf8'));
  const r = await context.request.post(`${API}/api/admin/login`, {
    data: { correo, password },
    headers: { origin: WEB, 'x-forwarded-for': ipNueva() },
  });
  expect(r.status(), 'login de QA').toBeLessThan(300);
}

/** POST a la API de QA con IP propia. */
export async function postApi(request: APIRequestContext, ruta: string, data: unknown, ip = ipNueva()) {
  return request.post(`${API}${ruta}`, { data, headers: { origin: WEB, 'x-forwarded-for': ip } });
}

export async function irAlInicio(page: Page, ruta = '/') {
  const r = await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  return r;
}

/** La página no se desborda en horizontal. */
export async function sinScrollHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

/** Espera a que la maqueta 3D pinte sus íconos. Devuelve false si no hay WebGL. */
export async function esperarMaqueta(page: Page) {
  try {
    await page.locator('.hero__hot').first().waitFor({ state: 'attached', timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
}

export async function capaVisible(page: Page) {
  const capas = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.hero__capa[data-fase="dentro"]')].map((c) => c.dataset.capa));
  // En celular la franja repite las mismas capas que el rótulo: se cuentan una vez
  return [...new Set(capas)];
}

export async function botonesHero(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('.hero__acciones .btn')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.x * 10) / 10, Math.round((r.y + scrollY) * 10) / 10, Math.round(r.width), Math.round(r.height)].join(','); }).join(' | '));
}

/** Centro de un elemento en pantalla (los íconos de la maqueta giran: no esperar a que estén quietos). */
export async function centro(page: Page, selector: string, i = 0) {
  const b = await page.locator(selector).nth(i).boundingBox();
  if (!b) throw new Error(`sin caja: ${selector}[${i}]`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
