import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, irAlInicio, iniciarSesion, postApi, unico, API, WEB } from './comun';
import { RAIZ } from '../qa/entorno.mjs';

const XSS = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script><svg onload="window.__xss=1">`;

test.describe('9 · Abuso y seguridad básica', () => {
  test('S01 el texto del usuario se muestra escapado (sitio y panel)', async ({ page, context, request }) => {
    const marca = unico('QAXSS');
    const nombre = `${marca} ${XSS}`.slice(0, 120);
    expect((await postApi(request, '/api/contacto', { nombre, correo: 'qa@example.com', mensaje: `Mensaje ${XSS}` })).status()).toBe(201);
    expect((await postApi(request, '/api/cotizaciones', { nombre, whatsapp: '70001234', tipo_proyecto: XSS.slice(0, 100), descripcion: `Descripción ${XSS}` })).status()).toBe(201);
    // Sitio público: buscador de servicios (repite lo escrito en el contador)
    await irAlInicio(page);
    await page.locator('#svc-q').fill(XSS);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as any).__xss), 'buscador').toBeUndefined();
    // Panel: lista y detalle de las dos solicitudes
    await iniciarSesion(context);
    await page.goto(`/admin/mensajes?q=${marca.split(' ')[1]}`);
    const filas = page.locator('[data-filas] tr');
    await expect(filas).toHaveCount(2);
    await expect(filas.first()).toContainText('<img src=x');
    for (let i = 0; i < 2; i++) {
      await filas.nth(i).getByRole('button', { name: /Ver solicitud/ }).click();
      await expect(page.locator('[data-detalle]')).toContainText('<script>');
      await page.keyboard.press('Escape');
    }
    expect(await page.evaluate(() => (window as any).__xss), 'panel').toBeUndefined();
    expect(await page.locator('[data-filas] img[src="x"], [data-detalle] img[src="x"], [data-detalle] svg[onload]').count(), 'etiquetas inyectadas en el DOM').toBe(0);
  });

  test('S02 envíos repetidos: el límite corta al sexto', async ({ request }) => {
    const ip = '10.250.250.250';
    const estados: number[] = [];
    for (let i = 0; i < 7; i++) estados.push((await postApi(request, '/api/contacto', {}, ip)).status());
    const estadosCot: number[] = [];
    for (let i = 0; i < 7; i++) estadosCot.push((await postApi(request, '/api/cotizaciones', {}, '10.250.250.251')).status());
    expect({ contacto: estados, cotizaciones: estadosCot }).toEqual({ contacto: [400, 400, 400, 400, 400, 429, 429], cotizaciones: [400, 400, 400, 400, 400, 429, 429] });
  });

  test('S03 el panel exige sesión', async ({ page, request }) => {
    const rutas = ['/api/admin/me', '/api/admin/solicitudes', '/api/admin/estadisticas', '/api/admin/avisos', '/api/admin/citas', '/api/admin/servicios', '/api/admin/solicitudes/formulario/1', '/api/admin/cotizaciones/1/conversacion'];
    const r: Record<string, number> = {};
    for (const ruta of rutas) r[ruta] = (await request.get(API + ruta, { headers: { origin: WEB } })).status();
    expect(Object.entries(r).filter(([, s]) => s !== 401).map(([k, s]) => `${k} → ${s}`), 'API sin sesión').toEqual([]);
    const mod = await request.patch(API + '/api/admin/solicitudes/formulario/1', { headers: { origin: WEB }, data: { estado: 'cerrado' } });
    expect(mod.status(), 'modificar sin sesión').toBe(401);
    for (const p of ['/admin/dashboard', '/admin/mensajes', '/admin/calendario', '/admin/servicios']) {
      await page.goto(p);
      await expect(page, `${p} sin sesión lleva al login`).toHaveURL(/\/admin\/login/, { timeout: 8000 });
    }
  });

  test('S04 sin claves ni tokens en lo que llega al navegador', async ({ page }) => {
    const env = readFileSync(path.join(RAIZ, 'backend/.env'), 'utf8');
    const valores = [...env.matchAll(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/gm)].filter(([, k, v]) => v && !/^(PORT|NODE_ENV|TRUST_PROXY)$/.test(k) && v.length >= 6).map(([, , v]) => v.replace(/^["']|["']$/g, ''));
    const patrones: [string, RegExp][] = [
      ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/], ['AWS', /AKIA[0-9A-Z]{16}/], ['GitHub', /gh[pousr]_[A-Za-z0-9]{30,}/],
      ['OpenAI/Anthropic', /\bsk-(ant-)?[A-Za-z0-9_-]{20,}/], ['Google', /AIza[0-9A-Za-z_-]{35}/], ['hash argon2', /\$argon2id\$/],
      ['variables del servidor', /SMTP_PASS|SMTP_USER|DATABASE_PATH|MAIL_TO_LEADS/], ['ruta local del equipo', /\/Users\/[a-z]+\/|C:\\\\Users\\\\/i],
    ];
    const hallazgos = new Set<string>();
    page.on('response', async (r) => {
      const t = r.headers()['content-type'] ?? '';
      if (!/javascript|html|json|css/.test(t)) return;
      const cuerpo = await r.text().catch(() => '');
      const url = r.url().replace(/^https?:\/\/[^/]+/, '');
      for (const [nombre, re] of patrones) if (re.test(cuerpo)) hallazgos.add(`${nombre} en ${url}`);
      for (const v of valores) if (cuerpo.includes(v)) hallazgos.add(`valor de backend/.env en ${url}`);
    });
    for (const p of ['/', '/servicios', '/proyectos', '/admin/login', '/admin/mensajes', '/no-existe']) { await irAlInicio(page, p); await page.waitForTimeout(500); }
    expect([...hallazgos]).toEqual([]);
  });
});
