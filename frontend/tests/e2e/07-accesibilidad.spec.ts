import AxeBuilder from '@axe-core/playwright';
import { test, expect, irAlInicio, consulta } from './comun';

const paginas = () => ['/', '/servicios', `/servicios/${consulta<{ id: number }>('SELECT id FROM categorias_servicios WHERE publicado = 1 ORDER BY orden, id LIMIT 1')[0].id}`, '/proyectos', '/no-existe', '/admin/login'];
const resumen = (v: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[]) => v.map((x) => `${x.impact} · ${x.id} (${x.nodes.length}): ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

test.describe('7 · Accesibilidad', () => {
  test('A01 axe sin fallas críticas ni graves', async ({ page }) => {
    const fallas: string[] = [];
    for (const ruta of paginas()) {
      await irAlInicio(page, ruta);
      await page.waitForTimeout(600);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).disableRules(['color-contrast']).analyze();
      fallas.push(...resumen(r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).map((f) => `${ruta} → ${f}`));
    }
    expect(fallas).toEqual([]);
  });

  test('A02 contraste AA', async ({ page }) => {
    const fallas: string[] = [];
    for (const ruta of paginas()) {
      await irAlInicio(page, ruta);
      await page.waitForTimeout(600);
      const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      fallas.push(...resumen(r.violations).map((f) => `${ruta} → ${f}`));
    }
    expect(fallas).toEqual([]);
  });

  test('A03 foco visible en todo lo que se alcanza con Tab', async ({ page }) => {
    await irAlInicio(page);
    const sinFoco: string[] = [];
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || e === document.body) return null;
        const s = getComputedStyle(e);
        const ps = [getComputedStyle(e, '::after'), getComputedStyle(e, '::before')];
        const visible = ps.some((x) => x.content !== 'none' && x.outlineStyle !== 'none' && parseFloat(x.outlineWidth) > 0) || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== 'none' && s.boxShadow !== '');
        return { visible, d: `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}「${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}」`, footer: !!e.closest('footer') };
      });
      if (!r) continue;
      if (!r.visible) sinFoco.push(r.d);
      if (r.footer) break;
    }
    expect([...new Set(sinFoco)]).toEqual([]);
  });

  test('A04 textos alternativos y orden de títulos', async ({ page }) => {
    const fallas: string[] = [];
    for (const ruta of paginas()) {
      await irAlInicio(page, ruta);
      const r = await page.evaluate(() => {
        const sinAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src')?.slice(-40));
        const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !h.closest('[aria-hidden="true"], [hidden], template') && h.getClientRects().length);
        const saltos: string[] = [];
        let prev = 0;
        for (const h of hs) { const n = Number(h.tagName[1]); if (prev && n > prev + 1) saltos.push(`h${prev}→h${n}「${h.textContent!.trim().slice(0, 30)}」`); prev = n; }
        return { sinAlt, h1: hs.filter((h) => h.tagName === 'H1').length, saltos, primero: hs[0]?.tagName };
      });
      if (r.sinAlt.length) fallas.push(`${ruta}: imágenes sin alt ${r.sinAlt.join(', ')}`);
      if (r.h1 !== 1) fallas.push(`${ruta}: ${r.h1} h1`);
      if (r.primero && r.primero !== 'H1') fallas.push(`${ruta}: el primer título es ${r.primero}`);
      if (r.saltos.length) fallas.push(`${ruta}: salta niveles ${r.saltos.join(', ')}`);
    }
    expect(fallas).toEqual([]);
  });
});
