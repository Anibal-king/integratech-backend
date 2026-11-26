import type { Page } from '@playwright/test';
import { test, expect, consulta, unico, irAlInicio, iniciarSesion, postApi, WHATSAPP } from './comun';

async function abrirWhatsApp(page: Page) {
  await irAlInicio(page);
  await page.locator('.wa-fab').click();
  const d = page.locator('.wa-dialogo');
  await expect(d).toBeVisible();
  return d;
}
const contarPosts = (page: Page, ruta: string) => {
  const n = { v: 0 };
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes(ruta)) n.v++; });
  return n;
};

test.describe('4 · Cotización y WhatsApp', () => {
  test('F01 formularios vacíos no se envían', async ({ page }) => {
    const posts = contarPosts(page, '/api/');
    await irAlInicio(page);
    await page.locator('#contacto').scrollIntoViewIfNeeded();
    await page.locator('.cform button[type="submit"]').click();
    await expect(page.locator('.cform')).toContainText('obligatorios');
    const d = await abrirWhatsApp(page);
    await d.locator('.wa-enviar').click();
    await expect(d.locator('.wa-error')).toBeVisible();
    expect(posts.v, 'ningún POST a la API').toBe(0);
  });

  test('F02 correo y teléfono inválidos', async ({ page, request }) => {
    await irAlInicio(page);
    const f = page.locator('.cform');
    await f.scrollIntoViewIfNeeded();
    await f.locator('input[name="nombre"]').fill('Ana Prueba');
    await f.locator('textarea[name="mensaje"]').fill('Consulta de prueba de QA.');
    await f.locator('input[name="correo"]').fill('a@');
    await f.locator('button[type="submit"]').click();
    await expect(f).toContainText('formato válido');
    await f.locator('input[name="correo"]').fill('');
    await f.locator('input[name="telefono"]').fill('abc');
    await f.locator('button[type="submit"]').click();
    await expect(f).toContainText('7 dígitos');
    const d = await abrirWhatsApp(page);
    await d.locator('input[name="nombre"]').fill('Ana Prueba');
    await d.locator('input[name="whatsapp"]').fill('abc');
    await d.locator('textarea[name="descripcion"]').fill('Descripción de prueba de QA.');
    await d.locator('.wa-enviar').click();
    await expect(d.locator('.wa-error')).toBeVisible();
    // La API también los rechaza (si alguien se salta el navegador)
    expect((await postApi(request, '/api/contacto', { nombre: 'Ana', correo: 'a@', mensaje: 'Consulta de prueba' })).status()).toBe(400);
    expect((await postApi(request, '/api/cotizaciones', { nombre: 'Ana', whatsapp: 'abc', descripcion: 'Descripción de prueba' })).status()).toBe(400);
  });

  test('F03 textos muy largos se limitan sin romper nada', async ({ page, request }) => {
    await irAlInicio(page);
    const ta = page.locator('.cform textarea[name="mensaje"]');
    await ta.fill('x'.repeat(6000));
    expect((await ta.inputValue()).length, 'el campo corta en 5000').toBeLessThanOrEqual(5000);
    const r = [
      await postApi(request, '/api/contacto', { nombre: 'Ana', correo: 'qa@example.com', mensaje: 'x'.repeat(6000) }),
      await postApi(request, '/api/contacto', { nombre: 'N'.repeat(500), correo: 'qa@example.com', mensaje: 'Consulta de prueba' }),
      await postApi(request, '/api/cotizaciones', { nombre: 'Ana', whatsapp: '70001234', descripcion: 'x'.repeat(2500) }),
      await postApi(request, '/api/contacto', { nombre: 'Ana', correo: 'qa@example.com', mensaje: 'x'.repeat(20000) }), // > límite de 16 kB
    ];
    expect(r.map((x) => x.status())).toEqual([400, 400, 400, 413]);
  });

  test('F04 tildes y emojis llegan intactos al panel', async ({ page, context }) => {
    const nombre = unico('Ñandú José 🚀⚡ Güemes');
    const mensaje = 'Instalación eléctrica en Santa Ana — «urgente» ✅ ñ ü é 🏭';
    await irAlInicio(page);
    const f = page.locator('.cform');
    await f.locator('input[name="nombre"]').fill(nombre);
    await f.locator('input[name="correo"]').fill('qa@example.com');
    await f.locator('textarea[name="mensaje"]').fill(mensaje);
    await f.locator('button[type="submit"]').click();
    await expect(f).toContainText('Gracias');
    expect(consulta('SELECT nombre, mensaje FROM mensajes_contacto WHERE nombre = ?', nombre)).toEqual([{ nombre, mensaje }]);
    await iniciarSesion(context);
    await page.goto(`/admin/mensajes?q=${encodeURIComponent(nombre.split(' ').pop()!)}`);
    await expect(page.locator('[data-filas] tr').first()).toContainText(nombre);
    await page.locator('[data-filas] tr').first().getByRole('button', { name: /Ver solicitud/ }).click();
    await expect(page.locator('[data-detalle] [data-d="mensaje"]')).toHaveText(mensaje);
  });

  test('F05 doble clic en enviar crea un solo registro', async ({ page }) => {
    await irAlInicio(page);
    const n1 = unico('QA Doble contacto');
    const f = page.locator('.cform');
    await f.locator('input[name="nombre"]').fill(n1);
    await f.locator('input[name="correo"]').fill('qa@example.com');
    await f.locator('textarea[name="mensaje"]').fill('Doble clic de prueba.');
    await f.locator('button[type="submit"]').dblclick();
    await expect(f).toContainText('Gracias');
    await page.waitForTimeout(800);
    const n2 = unico('QA Doble WhatsApp');
    const d = await abrirWhatsApp(page);
    await d.locator('input[name="nombre"]').fill(n2);
    await d.locator('input[name="whatsapp"]').fill('70001234');
    await d.locator('textarea[name="descripcion"]').fill('Doble clic de prueba en cotización.');
    await d.locator('.wa-enviar').dblclick();
    await expect(d.locator('.wa-ticket')).toBeVisible();
    await page.waitForTimeout(800);
    expect({
      contacto: consulta('SELECT COUNT(*) n FROM mensajes_contacto WHERE nombre = ?', n1)[0].n,
      whatsapp: consulta('SELECT COUNT(*) n FROM leads_chatbot WHERE nombre = ?', n2)[0].n,
    }).toEqual({ contacto: 1, whatsapp: 1 });
  });

  test('F06 «Solicitar servicio personalizado» marca la solicitud de punta a punta', async ({ page, context }) => {
    await irAlInicio(page);
    await page.locator('[data-svc-personalizado]').click();
    await expect(page.locator('.cform__tipo')).toBeVisible();
    const nombre = unico('QA Marca');
    const f = page.locator('.cform');
    await f.locator('input[name="nombre"]').fill(nombre);
    await f.locator('input[name="telefono"]').fill('70001234');
    await f.locator('textarea[name="mensaje"]').fill('Necesito termografía de tableros.');
    const req = page.waitForRequest((r) => r.url().includes('/api/contacto') && r.method() === 'POST');
    await f.locator('button[type="submit"]').click();
    expect((await req).postDataJSON()).toMatchObject({ tipo: 'personalizado', nombre });
    await expect(f).toContainText('Gracias');
    await iniciarSesion(context);
    await page.goto(`/admin/mensajes?q=${encodeURIComponent(nombre.split(' ').pop()!)}`);
    await expect(page.locator('[data-filas] tr').first().locator('.marca-tipo')).toHaveText(/Servicio personalizado/i);
  });

  test('F07 el enlace de WhatsApp lleva el número y el mensaje correctos', async ({ page }) => {
    const d = await abrirWhatsApp(page);
    const nombre = unico('QA Enlace');
    await d.locator('input[name="nombre"]').fill(nombre);
    await d.locator('input[name="whatsapp"]').fill('70001234');
    const opciones = await d.locator('select[name="tipo_proyecto"] option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value).filter(Boolean));
    if (opciones.length) await d.locator('select[name="tipo_proyecto"]').selectOption(opciones[0]);
    await d.locator('textarea[name="descripcion"]').fill('Prueba del enlace de WhatsApp.');
    await d.locator('.wa-enviar').click();
    await expect(d.locator('.wa-ticket')).toBeVisible();
    const ticket = (await d.locator('.wa-ticket strong').textContent())!;
    const href = new URL((await d.locator('.wa-continuar').getAttribute('href'))!);
    expect(href.host + href.pathname).toBe(`wa.me/${WHATSAPP}`);
    const texto = href.searchParams.get('text') ?? '';
    expect(texto).toContain(ticket);
    expect(texto).toContain(nombre);
    if (opciones.length) expect(texto).toContain(opciones[0]);
    const directo = await abrirWhatsApp(page);
    expect(await directo.locator('a.wa-enlace').getAttribute('href')).toContain(`wa.me/${WHATSAPP}`);
  });

  test('F08 el ticket aparece en el panel con los datos correctos', async ({ page, context }) => {
    const d = await abrirWhatsApp(page);
    const nombre = unico('QA Ticket');
    await d.locator('input[name="nombre"]').fill(nombre);
    await d.locator('input[name="whatsapp"]').fill('7123 4567');
    await d.locator('textarea[name="descripcion"]').fill('Cotizar planta eléctrica de 100 kVA.');
    await d.locator('.wa-enviar').click();
    const ticket = (await d.locator('.wa-ticket strong').textContent())!;
    await iniciarSesion(context);
    await page.goto(`/admin/mensajes?q=${encodeURIComponent(nombre.split(' ').pop()!)}`);
    const fila = page.locator('[data-filas] tr').first();
    await expect(fila).toContainText(ticket);
    await expect(fila.locator('.marca-nueva')).toBeVisible();
    await fila.getByRole('button', { name: /Ver solicitud/ }).click();
    const det = page.locator('[data-detalle]');
    await expect(det.locator('[data-d="nombre"]')).toContainText(nombre);
    await expect(det.locator('[data-d="telefono"]')).toContainText(/7123\s?4567|71234567/);
    await expect(det.locator('[data-d="alcance"]')).toHaveText('Cotizar planta eléctrica de 100 kVA.');
    await expect(det).toContainText('Nuevo');
  });

  test('F09 enviar antes de que el formulario termine de cargar no pierde lo escrito', async ({ page }) => {
    // Conexión lenta: los scripts tardan 4 s, así el formulario todavía no está activo al enviar
    await page.route(/\.js(\?|$)/, async (r) => { await new Promise((ok) => setTimeout(ok, 4000)); await r.fallback(); });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const f = page.locator('.cform');
    await f.scrollIntoViewIfNeeded();
    const n = unico('QA Antes de cargar');
    await f.locator('input[name="nombre"]').fill(n);
    await f.locator('input[name="correo"]').fill('qa@example.com');
    await f.locator('textarea[name="mensaje"]').fill('Enviado antes de que cargue el formulario.');
    expect(await page.evaluate(() => document.querySelector('.cform')!.closest('astro-island')!.hasAttribute('ssr')), 'el formulario aún no estaba activo').toBe(true);
    await f.locator('button[type="submit"]').click();
    await expect(f.locator('input[name="nombre"]'), 'lo escrito sigue ahí').toHaveValue(n);
    await expect(f).toContainText('Gracias', { timeout: 20000 });
    expect(consulta('SELECT COUNT(*) n FROM mensajes_contacto WHERE nombre = ?', n)[0].n).toBe(1);
  });
});
