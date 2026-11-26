import type { Page } from '@playwright/test';
import { test, expect, irAlInicio, prepararContexto } from './comun';

const pos = (page: Page, sel: string) => page.evaluate((s) => new DOMMatrix(getComputedStyle(document.querySelector(s)!).transform).m41, sel);
async function semueve(page: Page, sel: string) { const a = await pos(page, sel); await page.waitForTimeout(600); return Math.abs((await pos(page, sel)) - a) > 0.5; }
const T = '.trust .carrusel__lista', M = '#marcas .carrusel__lista';

test.describe('5 · Carruseles', () => {
  test('C01 cursor: «Han confiado» se pausa; «Marcas» nunca se detiene @multi', async ({ page }, info) => {
    test.skip(!!info.project.use.hasTouch, 'Sin cursor.');
    await irAlInicio(page);
    await page.locator('.trust').scrollIntoViewIfNeeded();
    await page.locator('.trust .carrusel').hover({ force: true });
    expect(await semueve(page, T), '«Han confiado» en pausa con el cursor').toBe(false);
    await page.locator('#marcas').scrollIntoViewIfNeeded();
    await page.locator('#marcas .carrusel').hover({ force: true });
    expect(await semueve(page, M), '«Marcas» sigue con el cursor encima').toBe(true);
  });

  test('C02 teclado y toque: «Marcas» sigue en movimiento @multi', async ({ page }, info) => {
    await irAlInicio(page);
    await page.locator('#marcas').scrollIntoViewIfNeeded();
    if (info.project.use.hasTouch) {
      const b = (await page.locator('#marcas .carrusel').boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      expect(await semueve(page, M), 'tras tocar').toBe(true);
    } else {
      await page.locator('#marcas-title').click();
      let llegó = false;
      for (let i = 0; i < 40 && !llegó; i++) { await page.keyboard.press('Tab'); llegó = await page.evaluate(() => !!document.activeElement?.matches('#marcas .carrusel')); }
      expect(llegó, 'la franja de marcas recibe el foco con Tab').toBe(true);
      expect(await semueve(page, M), 'con foco de teclado').toBe(true);
    }
  });

  test('C03 bucle sin saltos (empalme de 0 px) @multi', async ({ page }) => {
    await irAlInicio(page);
    const empalmes = await page.evaluate(() => [...document.querySelectorAll('.carrusel')].map((c) => {
      const [a, b] = c.querySelectorAll('.carrusel__lista');
      return Math.round((b.getBoundingClientRect().left - a.getBoundingClientRect().right) * 100) / 100;
    }));
    expect(empalmes.map((n) => Math.abs(n))).toEqual(empalmes.map(() => 0));
    // La animación recorre exactamente el ancho de una lista
    const ok = await page.evaluate(() => [...document.querySelectorAll('.carrusel__lista')].every((l) => getComputedStyle(l).animationName !== 'none'));
    expect(ok).toBe(true);
  });

  test('C04 movimiento reducido: quietos y «Marcas» se desliza a mano @multi', async ({ browser }, info) => {
    const u = info.project.use;
    const ctx = await browser.newContext({ viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, userAgent: u.userAgent, reducedMotion: 'reduce' });
    await prepararContexto(ctx);
    const page = await ctx.newPage();
    await irAlInicio(page);
    const r = await page.evaluate(() => {
      const m = document.querySelector<HTMLElement>('#marcas .carrusel')!;
      return {
        animadas: [...document.querySelectorAll('.carrusel__lista')].filter((l) => getComputedStyle(l).animationName !== 'none').length,
        copiasVisibles: [...document.querySelectorAll('.carrusel__lista[aria-hidden]')].filter((l) => l.getClientRects().length > 0).length,
        marcasDesliza: getComputedStyle(m).overflowX === 'auto' && m.scrollWidth > m.clientWidth,
      };
    });
    const m = page.locator('#marcas .carrusel');
    await m.evaluate((e) => e.scrollBy({ left: 400 }));
    await page.waitForTimeout(300);
    const scroll = await m.evaluate((e) => e.scrollLeft);
    await ctx.close();
    expect(r).toEqual({ animadas: 0, copiasVisibles: 0, marcasDesliza: true });
    expect(scroll).toBeGreaterThan(0);
  });

  test('C05 el lector de pantalla no lee las copias del bucle @multi', async ({ page }) => {
    await irAlInicio(page);
    const marcas = await page.locator('#marcas .carrusel__lista:not([aria-hidden]) .marca').count();
    expect(marcas).toBeGreaterThan(0);
    expect(await page.locator('#marcas').getByRole('listitem').count(), 'marcas leídas').toBe(marcas);
    const nombresTrust = await page.locator('.trust .carrusel__lista:not([aria-hidden]) li').count();
    expect(await page.locator('.trust').getByRole('listitem').count(), 'clientes leídos').toBe(nombresTrust);
  });
});
