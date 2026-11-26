import type { Page, TestInfo } from '@playwright/test';
import { test, expect, irAlInicio, esperarMaqueta, capaVisible, botonesHero, centro, prepararContexto } from './comun';

const tactil = (info: TestInfo) => !!info.project.use.hasTouch;

async function preparar(page: Page) {
  await irAlInicio(page);
  if (!(await esperarMaqueta(page))) test.skip(true, 'Sin WebGL en este navegador: la maqueta no se dibuja (el hero queda con su fondo).');
  await page.waitForTimeout(800); // termina la animación de entrada
  return { botones: await botonesHero(page), ids: await page.locator('.hero__hot').evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset.id!)) };
}

/** Un punto vacío del marco de la maqueta (sin íconos ni texto encima). */
async function puntoVacio(page: Page) {
  return page.evaluate(() => {
    const z = document.querySelector('.hero__zona')!.getBoundingClientRect();
    for (let fy = 0.15; fy < 0.95; fy += 0.1) for (let fx = 0.1; fx < 0.95; fx += 0.1) {
      const x = z.x + z.width * fx, y = z.y + z.height * fy;
      const e = document.elementFromPoint(x, y);
      if (e && !e.closest('.hero__hot, .hero__rotulo, .hero__franja, a, button') && e.closest('.hero')) return { x, y };
    }
    return null;
  });
}

async function sobre(page: Page, i: number) {
  const c = await centro(page, '.hero__hot', i);
  const tapado = await page.evaluate(({ x, y, i }) => { const e = document.elementFromPoint(x, y); const b = document.querySelectorAll('.hero__hot')[i]; return e && !b.contains(e) ? (e.className || e.tagName).toString().slice(0, 40) : null; }, { ...c, i });
  await page.mouse.move(c.x, c.y, { steps: 2 });
  return tapado;
}

test.describe('3 · Hero interactivo', () => {
  test('H01 hover en cada ícono cambia el titular @multi', async ({ page }, info) => {
    test.skip(tactil(info), 'Sin cursor en pantallas táctiles (ver H06).');
    const { ids, botones } = await preparar(page);
    const fallos: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const tapado = await sobre(page, i);
      await page.waitForTimeout(250);
      const capa = await capaVisible(page);
      if (tapado) fallos.push(`ícono ${ids[i]} tapado por ${tapado}`);
      else if (!capa.includes(ids[i])) fallos.push(`ícono ${ids[i]}: muestra ${capa.join(',')}`);
    }
    expect(await botonesHero(page), 'los botones no se mueven').toBe(botones);
    expect(fallos).toEqual([]);
  });

  test('H02 clic en un ícono fija el servicio @multi', async ({ page }, info) => {
    test.skip(tactil(info), 'Táctil: ver H06.');
    const { ids, botones } = await preparar(page);
    const c = await centro(page, '.hero__hot', 0);
    await page.mouse.click(c.x, c.y);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(600);
    await expect(page.locator('.hero__hot').first()).toHaveAttribute('aria-pressed', 'true');
    expect(await capaVisible(page)).toEqual([ids[0]]);
    expect(await botonesHero(page)).toBe(botones);
  });

  test('H03 Esc y clic fuera sueltan el servicio @multi', async ({ page }, info) => {
    test.skip(tactil(info), 'Táctil: ver H06.');
    const { botones } = await preparar(page);
    let c = await centro(page, '.hero__hot', 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Escape');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    expect(await capaVisible(page), 'Esc suelta').toEqual(['inicio']);
    c = await centro(page, '.hero__hot', 1);
    await page.mouse.click(c.x, c.y);
    const v = await puntoVacio(page);
    expect(v, 'hay un punto vacío en la maqueta').not.toBeNull();
    await page.mouse.click(v!.x, v!.y);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    expect(await capaVisible(page), 'clic fuera suelta').toEqual(['inicio']);
    expect(await botonesHero(page)).toBe(botones);
  });

  test('H04 pasar rápido entre íconos no deja textos mezclados @multi', async ({ page }, info) => {
    test.skip(tactil(info), 'Táctil: ver H06.');
    const { ids, botones } = await preparar(page);
    for (let vuelta = 0; vuelta < 2; vuelta++) for (let i = 0; i < ids.length; i++) { await sobre(page, i); await page.waitForTimeout(40); }
    const ultimo = ids.length - 1;
    await sobre(page, ultimo);
    await page.waitForTimeout(700);
    expect(await capaVisible(page)).toEqual([ids[ultimo]]);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(900);
    expect(await capaVisible(page), 'al salir vuelve el titular').toEqual(['inicio']);
    expect(await botonesHero(page)).toBe(botones);
  });

  test('H05 arrastrar gira la maqueta y no cuenta como clic @multi', async ({ page }, info) => {
    test.skip(tactil(info), 'Táctil: ver H06.');
    const { ids, botones } = await preparar(page);
    const c = await centro(page, '.hero__hot', 0);
    await page.mouse.click(c.x, c.y);
    const v = (await puntoVacio(page))!;
    const antes = await centro(page, '.hero__hot', 0);
    await page.mouse.move(v.x, v.y);
    await page.mouse.down();
    await page.mouse.move(v.x + 140, v.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const despues = await centro(page, '.hero__hot', 0);
    expect(Math.abs(despues.x - antes.x) + Math.abs(despues.y - antes.y), 'la maqueta giró').toBeGreaterThan(5);
    expect(await capaVisible(page), 'el arrastre no suelta el servicio fijado').toEqual([ids[0]]);
    expect(await botonesHero(page)).toBe(botones);
  });

  test('H06 toque en celular fija y toque fuera suelta @multi', async ({ page }, info) => {
    test.skip(!tactil(info), 'Solo pantallas táctiles.');
    const { ids, botones } = await preparar(page);
    // touchscreen.tap no desplaza: la maqueta queda bajo el borde en celulares
    await page.evaluate(() => document.querySelector('.hero__hot')!.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const c = await centro(page, '.hero__hot', 0);
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(500);
    await expect(page.locator('.hero__hot').first()).toHaveAttribute('aria-pressed', 'true');
    expect(await capaVisible(page)).toEqual([ids[0]]);
    const v = (await puntoVacio(page))!;
    await page.touchscreen.tap(v.x, v.y);
    await page.waitForTimeout(500);
    await expect(page.locator('.hero__hot').first()).toHaveAttribute('aria-pressed', 'false');
    expect(await capaVisible(page)).toEqual(['inicio']);
    expect(await botonesHero(page)).toBe(botones);
  });

  test('H07 teclado: Tab muestra, Enter fija, Esc suelta @multi', async ({ page }, info) => {
    test.skip(tactil(info), 'Sin teclado físico en táctiles.');
    const { botones } = await preparar(page);
    await page.locator('.hero__acciones .btn--secondary').focus();
    let llegó = false;
    // Los íconos van antes de los botones: se retrocede con Shift+Tab
    for (let i = 0; i < 40 && !llegó; i++) { await page.keyboard.press('Shift+Tab'); llegó = await page.evaluate(() => !!document.activeElement?.matches('.hero__hot')); }
    expect(llegó, 'el Tab llega a los íconos').toBe(true);
    const id = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.id);
    const foco = await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; });
    expect(foco, 'foco visible en el ícono').toBe(true);
    await page.waitForTimeout(300);
    expect(await capaVisible(page), 'Tab muestra el servicio').toEqual([id]);
    await page.keyboard.press('Enter');
    await expect(page.locator(`.hero__hot[data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator(`.hero__hot[data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'false');
    expect(await botonesHero(page)).toBe(botones);
  });

  test('H08 con movimiento reducido la maqueta no gira sola @multi', async ({ browser }, info) => {
    const u = info.project.use;
    const ctx = await browser.newContext({ viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, userAgent: u.userAgent, reducedMotion: 'reduce' });
    await prepararContexto(ctx);
    const page = await ctx.newPage();
    await irAlInicio(page);
    if (!(await esperarMaqueta(page))) { await ctx.close(); test.skip(true, 'Sin WebGL.'); }
    await page.waitForTimeout(500);
    const a = await centro(page, '.hero__hot', 0);
    await page.waitForTimeout(1500);
    const b = await centro(page, '.hero__hot', 0);
    const animando = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running' && (x as CSSAnimation).effect && ((x.effect as KeyframeEffect).target as Element | null)?.closest?.('.hero')).length);
    await ctx.close();
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 'la maqueta quieta').toBeLessThan(1);
    expect(animando, 'animaciones corriendo en el hero').toBe(0);
  });

  test('H09 los botones del hero nunca se mueven (secuencia completa) @multi', async ({ page }, info) => {
    const { ids, botones } = await preparar(page);
    const medidas = new Set([botones]);
    for (let i = 0; i < ids.length; i++) {
      const c = await centro(page, '.hero__hot', i);
      if (tactil(info)) await page.touchscreen.tap(c.x, c.y); else { await page.mouse.move(c.x, c.y); await page.mouse.click(c.x, c.y); }
      await page.waitForTimeout(350);
      medidas.add(await botonesHero(page));
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(150);
      medidas.add(await botonesHero(page));
    }
    expect([...medidas]).toEqual([botones]);
  });
});
