import { test, expect, irAlInicio, sinScrollHorizontal } from './comun';

// D01 iphone-safari · D03 android-chrome · D04 tablet-ipad · D05 chromium-1366
// D06 chromium-1920 · D07 firefox-1366 · D08 movil-horizontal
test.describe('2 · Dispositivos y navegadores', () => {
  test('D carga, diseño y menú en cada dispositivo @multi', async ({ page, errores }, info) => {
    const problemas: string[] = [];
    for (const ruta of ['/servicios', '/proyectos', '/']) {
      await irAlInicio(page, ruta);
      if (!(await sinScrollHorizontal(page))) problemas.push(`${ruta}: scroll horizontal`);
    }
    // Los dos botones del hero, visibles en la primera pantalla
    const fuera = await page.evaluate(() => [...document.querySelectorAll('.hero__acciones .btn')].filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > innerHeight || r.right > innerWidth || r.width === 0; }).map((b) => b.textContent!.trim()));
    if (fuera.length) problemas.push(`botones del hero fuera de la primera pantalla: ${fuera.join(', ')}`);
    // Menú: en pantallas angostas, el botón abre la navegación
    const toggle = page.locator('.mnav__toggle');
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator('.mnav__panel')).toBeVisible();
      await expect(page.locator('.mnav__panel a').first()).toBeVisible();
      await toggle.click();
    } else {
      await expect(page.locator('header nav a').first()).toBeVisible();
    }
    await info.attach(`inicio-${info.project.name}`, { body: await page.screenshot(), contentType: 'image/png' });
    expect(errores, 'errores de JavaScript').toEqual([]);
    expect(problemas).toEqual([]);
  });
});
