import { devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, prepararContexto, consulta, unico, irAlInicio, sinScrollHorizontal, WHATSAPP } from './comun';

test.describe('1 · Usuarios', () => {
  test('U01 gerente de planta en celular pide cotización por WhatsApp', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    await prepararContexto(ctx);
    const page = await ctx.newPage();
    await irAlInicio(page);
    const nombre = unico('QA Gerente');
    await page.locator('.wa-fab').tap();
    const d = page.locator('.wa-dialogo');
    await expect(d).toBeVisible();
    await d.locator('input[name="nombre"]').fill(nombre);
    await d.locator('input[name="whatsapp"]').fill('7000 1234');
    await d.locator('textarea[name="descripcion"]').fill('Mantenimiento de subestación de 500 kVA en planta.');
    await d.locator('.wa-enviar').tap();
    await expect(d.locator('.wa-ticket')).toContainText('#');
    const ticket = Number((await d.locator('.wa-ticket strong').textContent())!.replace('#', ''));
    const href = await d.locator('.wa-continuar').getAttribute('href');
    expect(href).toContain(`https://wa.me/${WHATSAPP}`);
    const fila = consulta<{ nombre: string; telefono: string; origen: string }>('SELECT nombre, telefono, origen FROM leads_chatbot WHERE id = ?', ticket)[0];
    expect(fila).toMatchObject({ nombre, telefono: '50370001234', origen: 'whatsapp' });
    await ctx.close();
  });

  test('U02 ingeniero revisa servicios y marcas desde la laptop', async ({ page, errores }) => {
    await irAlInicio(page);
    await page.goto('/servicios');
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('.svc-card__enlace').first().click();
    await expect(page).toHaveURL(/\/servicios\/\d+/);
    await expect(page.locator('h1')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/servicios$/);
    await page.goto('/#marcas');
    await expect(page.locator('#marcas .marca').first()).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('U03 necesita un servicio que no está en la lista', async ({ page }) => {
    await irAlInicio(page);
    await page.locator('[data-svc-personalizado]').click();
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLTextAreaElement | null)?.name), { timeout: 8000 }).toBe('mensaje');
    await expect(page.locator('.cform__tipo')).toContainText('Otro / servicio personalizado');
    const nombre = unico('QA Personalizado');
    await page.locator('.cform input[name="nombre"]').fill(nombre);
    await page.locator('.cform input[name="correo"]').fill('qa@example.com');
    await page.locator('.cform textarea[name="mensaje"]').fill('Necesitamos un estudio de calidad de energía.');
    await page.locator('.cform button[type="submit"]').click();
    await expect(page.locator('.cform')).toContainText('Gracias');
    expect(consulta('SELECT tipo_servicio FROM mensajes_contacto WHERE nombre = ?', nombre)).toEqual([{ tipo_servicio: 'Servicio personalizado' }]);
  });

  test('U04 usuario que navega solo con teclado', async ({ page }) => {
    await irAlInicio(page);
    const vistos: string[] = [];
    const invisibles: string[] = [];
    let llegoAlMensaje = false, llegoAlFooter = false;
    for (let i = 0; i < 260; i++) {
      await page.keyboard.press('Tab');
      const a = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        const desc = `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''}「${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)}」`;
        return { desc, invisible: r.width < 1 || r.height < 1 || !!e.closest('[aria-hidden="true"]'), mensaje: (e as HTMLTextAreaElement).name === 'mensaje' && !!e.closest('#contacto'), footer: !!e.closest('footer') };
      });
      if (!a) continue;
      vistos.push(a.desc);
      if (a.invisible && !a.desc.startsWith('a.saltar')) invisibles.push(a.desc);
      llegoAlMensaje ||= a.mensaje;
      llegoAlFooter ||= a.footer;
      if (llegoAlFooter) break;
    }
    test.info().annotations.push({ type: 'recorrido', description: `${vistos.length} paradas` });
    expect(vistos[0], 'primera parada: enlace «Saltar al contenido»').toContain('Saltar');
    expect(llegoAlMensaje, 'llega al mensaje del formulario de contacto').toBe(true);
    expect(llegoAlFooter, 'llega al footer (no hay trampa de foco)').toBe(true);
    expect(invisibles, 'paradas de foco invisibles u ocultas a lectores').toEqual([]);
  });

  test('U05 usuario con lector de pantalla (árbol de accesibilidad)', async ({ page }) => {
    await irAlInicio(page);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('.hero__anuncio[aria-live]')).toHaveCount(1);
    const r = await new AxeBuilder({ page })
      .withRules(['button-name', 'link-name', 'image-alt', 'label', 'aria-hidden-focus', 'aria-allowed-attr', 'aria-required-children', 'list', 'listitem', 'document-title', 'html-has-lang', 'region'])
      .analyze();
    expect(r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });

  test('U07 persona mayor con zoom al 200 %', async ({ browser }) => {
    // Zoom 200 % en una laptop de 1366×768 = ventana CSS de 683×384 a escala 2
    const ctx = await browser.newContext({ viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 });
    await prepararContexto(ctx);
    const page = await ctx.newPage();
    const problemas: string[] = [];
    for (const ruta of ['/', '/servicios', '/proyectos']) {
      await irAlInicio(page, ruta);
      if (!(await sinScrollHorizontal(page))) problemas.push(`${ruta}: scroll horizontal`);
      const cortados = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, .btn')].filter((e) => {
        const s = getComputedStyle(e); return e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && s.overflow !== 'visible';
      }).map((e) => `${e.tagName}「${e.textContent!.trim().slice(0, 30)}」`));
      if (cortados.length) problemas.push(`${ruta}: texto cortado ${cortados.join(', ')}`);
    }
    await irAlInicio(page);
    const btn = page.locator('.hero__acciones .btn').first();
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeInViewport();
    await test.info().attach('zoom-200', { body: await page.screenshot(), contentType: 'image/png' });
    await ctx.close();
    expect(problemas).toEqual([]);
  });

  test('U08 internet lento (3G) y celular de gama baja', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    await prepararContexto(ctx);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    // «3G rápido» de Lighthouse: 562,5 ms de latencia, 1,6 Mbps de bajada
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      (window as any).__largas = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as any).__largas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    });
    const t0 = Date.now();
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.hero__acciones .btn').first()).toBeVisible({ timeout: 30_000 });
    const tBotones = Date.now() - t0;
    await page.waitForLoadState('load', { timeout: 60_000 });
    await page.evaluate(() => ((window as any).__largas = []));
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
    const largas: number[] = await page.evaluate(() => (window as any).__largas);
    const max = Math.max(0, ...largas);
    test.info().annotations.push({ type: 'medición', description: `titular y botones visibles en ${tBotones} ms; tarea más larga al hacer scroll: ${max} ms (${largas.length} tareas > 50 ms)` });
    await ctx.close();
    expect(tBotones, 'titular y botones en menos de 4 s').toBeLessThan(4000);
    expect(max, 'ninguna tarea bloquea más de 200 ms durante el scroll').toBeLessThan(200);
  });
});
