import { chromium } from '@playwright/test';
import { test, expect, irAlInicio, WEB } from './comun';

test.describe('8 · Rendimiento', () => {
  test('R01 Lighthouse móvil del inicio', async () => {
    test.setTimeout(180_000);
    const { default: lighthouse } = await import('lighthouse');
    const chromeLauncher = await import('chrome-launcher');
    const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    try {
      const r = await lighthouse(WEB + '/', { port: chrome.port, output: 'html', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], logLevel: 'error' });
      const lhr = r!.lhr;
      const c = lhr.categories;
      const a = lhr.audits;
      const datos = {
        rendimiento: Math.round(c.performance.score! * 100), accesibilidad: Math.round(c.accessibility.score! * 100),
        buenasPracticas: Math.round(c['best-practices'].score! * 100), seo: Math.round(c.seo.score! * 100),
        LCP_ms: Math.round(a['largest-contentful-paint'].numericValue!), TBT_ms: Math.round(a['total-blocking-time'].numericValue!),
        CLS: Number(a['cumulative-layout-shift'].numericValue!.toFixed(3)), pesoTotal_KB: Math.round(a['total-byte-weight'].numericValue! / 1024),
      };
      test.info().annotations.push({ type: 'lighthouse', description: JSON.stringify(datos) });
      await test.info().attach('lighthouse.html', { body: r!.report as string, contentType: 'text/html' });
      expect(datos.rendimiento, 'rendimiento ≥ 70').toBeGreaterThanOrEqual(70);
      expect(datos.LCP_ms, 'LCP < 4 s').toBeLessThan(4000);
    } finally {
      await chrome.kill();
    }
  });

  test('R02 peso y formato de las imágenes', async ({ page }) => {
    const imgs: { url: string; kb: number; tipo: string }[] = [];
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'image') return;
      const b = await r.body().catch(() => null);
      if (b) imgs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 70), kb: Math.round(b.length / 1024), tipo: r.headers()['content-type'] ?? '' });
    });
    await irAlInicio(page);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } });
    await page.waitForTimeout(1500);
    const total = imgs.reduce((s, i) => s + i.kb, 0);
    test.info().annotations.push({ type: 'imágenes', description: `${imgs.length} imágenes, ${total} KB en total` });
    expect(imgs.filter((i) => i.kb > 300).map((i) => `${i.url} ${i.kb} KB`), 'imágenes de más de 300 KB').toEqual([]);
    expect(imgs.filter((i) => /jpe?g|png|gif|bmp/.test(i.tipo) && i.kb > 50).map((i) => `${i.url} ${i.tipo} ${i.kb} KB`), 'formatos antiguos de más de 50 KB').toEqual([]);
  });

  test('R03 la maqueta 3D con CPU 6× más lenta no bloquea la página', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await page.addInitScript(() => {
      (window as any).__largas = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as any).__largas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    });
    await irAlInicio(page);
    await page.locator('.hero__hot').first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(() => ((window as any).__largas = []));
    await page.mouse.move(900, 400);
    await page.waitForTimeout(4000);
    const largas: number[] = await page.evaluate(() => (window as any).__largas);
    test.info().annotations.push({ type: 'medición', description: `con la maqueta en pantalla (4 s): ${largas.length} tareas > 50 ms, la más larga ${Math.max(0, ...largas)} ms` });
    expect(Math.max(0, ...largas), 'ninguna tarea > 200 ms').toBeLessThan(200);
  });
});
