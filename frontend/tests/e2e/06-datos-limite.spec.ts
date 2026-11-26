/**
 * Datos límite (equivalente a «break-ui», que no está disponible): modifica la COPIA
 * de QA de la base y la deja como estaba al terminar. Corre sola, al final (@datos).
 */
import { test, expect, bd, consulta, irAlInicio, sinScrollHorizontal, esperarMaqueta, centro, WEB_SIN_API } from './comun';

test.describe.configure({ mode: 'serial' });

const primerServicio = () => consulta<{ id: number; nombre: string }>('SELECT id, nombre FROM categorias_servicios WHERE publicado = 1 ORDER BY orden, id LIMIT 1')[0];

test.describe('6 · Datos límite', () => {
  test('B01 título de servicio de 120 caracteres @datos', async ({ page }) => {
    const s = primerServicio();
    const largo = 'Mantenimiento preventivo y correctivo de subestaciones eléctricas de media y alta tensión con termografía infrarroja certif'.slice(0, 120);
    const db = bd();
    db.prepare('UPDATE categorias_servicios SET nombre = ? WHERE id = ?').run(largo, s.id);
    db.close();
    try {
      await irAlInicio(page);
      const problemas: string[] = [];
      if (!(await sinScrollHorizontal(page))) problemas.push('scroll horizontal en el inicio');
      const tarjeta = await page.evaluate((id) => {
        const a = document.querySelector<HTMLElement>(`.svc-card__enlace[href="/servicios/${id}"]`)!;
        const card = a.closest<HTMLElement>('.svc-card')!;
        return { desborda: card.scrollWidth > card.clientWidth + 1 || a.scrollWidth > a.clientWidth + 1 };
      }, s.id);
      if (tarjeta.desborda) problemas.push('la tarjeta se desborda');
      if (await esperarMaqueta(page)) {
        const i = await page.locator('.hero__hot').evaluateAll((bs, id) => bs.findIndex((b) => (b as HTMLElement).dataset.id === String(id)), s.id);
        if (i >= 0) {
          const c = await centro(page, '.hero__hot', i);
          await page.mouse.click(c.x, c.y);
          await page.waitForTimeout(500);
          const r = await page.evaluate((id) => {
            const capa = document.querySelector<HTMLElement>(`.hero__capa[data-capa="${id}"]`)!.getBoundingClientRect();
            const acc = document.querySelector('.hero__acciones')!.getBoundingClientRect();
            const t = document.querySelector<HTMLElement>(`.hero__capa[data-capa="${id}"] .hero__titulo`)!;
            return { solapa: capa.bottom > acc.top + 1, cortado: t.scrollWidth > t.clientWidth + 1 };
          }, s.id);
          if (r.solapa) problemas.push('el panel del servicio en el hero se monta sobre los botones');
          if (r.cortado) problemas.push('el titular del hero se corta');
          await test.info().attach('hero-titulo-largo', { body: await page.screenshot(), contentType: 'image/png' });
        }
      }
      expect(problemas).toEqual([]);
    } finally {
      const db2 = bd(); db2.prepare('UPDATE categorias_servicios SET nombre = ? WHERE id = ?').run(s.nombre, s.id); db2.close();
    }
  });

  test('B02 servicio sin fotos @datos', async ({ page }) => {
    const s = primerServicio();
    const db = bd();
    db.exec('PRAGMA foreign_keys = OFF'); // se esconden las fotos con un id negativo y luego se restauran
    db.prepare('UPDATE servicio_fotos SET categoria_id = -categoria_id WHERE categoria_id = ?').run(s.id);
    db.close();
    try {
      await irAlInicio(page);
      const r = await page.evaluate((id) => {
        const card = document.querySelector(`.svc-card__enlace[href="/servicios/${id}"]`)!.closest('.svc-card')!;
        const otras = [...document.querySelectorAll('.svc-card:not([hidden])')].filter((c) => c !== card);
        return {
          tieneRespaldo: !!card.querySelector('.svc-card__media, [class*="placeholder"], [class*="respaldo"]'),
          rotas: [...card.querySelectorAll('img')].filter((i) => !i.getAttribute('src')).length,
          alto: Math.round(card.getBoundingClientRect().height),
          altoOtras: Math.round(otras[0]?.getBoundingClientRect().height ?? 0),
        };
      }, s.id);
      await test.info().attach('servicio-sin-fotos', { body: await page.locator('#servicios').screenshot(), contentType: 'image/png' });
      expect(r.rotas, 'sin <img> vacías').toBe(0);
      expect(r.tieneRespaldo, 'la tarjeta muestra un respaldo visual en lugar de la foto').toBe(true);
    } finally {
      const db2 = bd(); db2.exec('PRAGMA foreign_keys = OFF'); db2.prepare('UPDATE servicio_fotos SET categoria_id = -categoria_id WHERE categoria_id = ?').run(-s.id); db2.close();
    }
  });

  test('B03 fotos que no cargan @datos', async ({ page, context }) => {
    await context.route(/\.(webp|jpe?g|png|avif)(\?|$)|\/media\//, (r) => r.fulfill({ status: 404, body: '' }));
    await irAlInicio(page);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const filas = new Map<number, number[]>();
      document.querySelectorAll<HTMLElement>('.svc-card:not([hidden])').forEach((c) => { const b = c.getBoundingClientRect(); const k = Math.round(b.top + scrollY); filas.set(k, [...(filas.get(k) ?? []), Math.round(b.height)]); });
      return {
        alturasDesiguales: [...filas.values()].filter((h) => Math.max(...h) - Math.min(...h) > 2).length,
        rotasConAltTextoDesbordado: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0 && i.getClientRects().length && (i.parentElement!.scrollWidth > i.parentElement!.clientWidth + 1)).length,
        scrollH: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    await test.info().attach('fotos-rotas', { body: await page.screenshot(), contentType: 'image/png' });
    expect(r).toEqual({ alturasDesiguales: 0, rotasConAltTextoDesbordado: 0, scrollH: false });
  });

  test('B04 la API no responde @datos', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    const res = await page.goto(WEB_SIN_API + '/');
    expect(res!.status(), 'la página responde (no 500)').toBeLessThan(500);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.hero__acciones .btn').first()).toBeVisible();
    const aviso = await page.locator('body').innerText();
    await test.info().attach('sin-api', { body: await page.screenshot(), contentType: 'image/png' });
    expect(aviso, 'muestra un aviso amable').toMatch(/no (pudimos|se pudo|está disponible)|intent(a|e) (de nuevo|más tarde)|temporalmente/i);
    expect(errores).toEqual([]);
    const det = await page.goto(WEB_SIN_API + '/servicios');
    expect(det!.status()).toBeLessThan(500);
  });
});
