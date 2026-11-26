import { test, expect, irAlInicio, WEB } from './comun';

test.describe('10 · Navegación', () => {
  test('N01 todos los enlaces internos y anclas funcionan', async ({ page, request }) => {
    const enlaces = new Set<string>();
    for (const p of ['/', '/servicios', '/proyectos', '/no-existe']) {
      await irAlInicio(page, p);
      for (const h of await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
        const u = new URL(h);
        if (u.origin === WEB && !(p === '/no-existe' && u.pathname === p)) enlaces.add(u.pathname + u.hash);
      }
    }
    const rotos: string[] = [];
    const paginas = new Map<string, string>();
    for (const e of enlaces) {
      const [ruta, ancla] = e.split('#');
      if (!paginas.has(ruta)) {
        const r = await request.get(WEB + ruta);
        paginas.set(ruta, r.ok() ? await r.text() : '');
        if (!r.ok()) rotos.push(`${ruta} → ${r.status()}`);
      }
      if (ancla && paginas.get(ruta) && !new RegExp(`id=["']?${ancla}["'\\s>]`).test(paginas.get(ruta)!)) rotos.push(`${e}: el ancla no existe`);
    }
    test.info().annotations.push({ type: 'enlaces', description: `${enlaces.size} enlaces internos revisados` });
    expect(rotos).toEqual([]);
  });

  test('N02 página 404 propia', async ({ page }) => {
    const r = await page.goto('/esta-pagina-no-existe');
    expect(r!.status()).toBe(404);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('main a[href="/"]').first()).toBeVisible();
  });

  test('N03 el botón atrás vuelve al mismo lugar @multi', async ({ page, errores }) => {
    await irAlInicio(page);
    // Dentro de la sección (no en su inicio): la URL queda en #servicios y así se
    // comprueba que «atrás» no lleva al inicio de la sección en vez de donde se estaba.
    const enlace = page.locator('.svc-card__enlace').first();
    await enlace.scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy({ top: 120, behavior: 'instant' }));
    await page.waitForTimeout(600);
    // Posición en el instante del clic (Playwright puede desplazar para hacer clic si el
    // encabezado fijo tapa el enlace). El router de Astro conserva el contexto JS.
    await page.evaluate(() => addEventListener('click', () => { (window as any).__yClic = scrollY; }, { capture: true, once: true }));
    await enlace.click();
    const y = await page.evaluate(() => (window as any).__yClic as number);
    await expect(page).toHaveURL(/\/servicios\/\d+/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${WEB}/?(#.*)?$`));
    // El router restaura la posición cuando llega la página: se espera a que se asiente
    await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000, message: `vuelve a ${y}` }).toBeGreaterThan(y - 200);
    await page.waitForTimeout(800); // y que nada lo mueva después (p. ej. un salto al ancla)
    const y2 = await page.evaluate(() => scrollY);
    expect(Math.abs(y2 - y), `vuelve a ${y} (quedó en ${y2})`).toBeLessThan(200);
    expect(errores).toEqual([]);
  });
});
