// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';
import backendLocal from './integrations/backend-local.mjs';

// https://astro.build/config
export default defineConfig({
  // Sitio estático por defecto. Las páginas con `export const prerender = false`
  // (inicio, /servicios/[id] y /proyectos) se renderizan en cada visita con el
  // servidor Node: muestran siempre los servicios y fotos actuales del panel.
  // Producción: `npm run build` y luego `node dist/server/entry.mjs` (HOST/PORT).
  adapter: node({ mode: 'standalone' }),
  // backendLocal: en `astro dev` levanta la API local si no está corriendo.
  integrations: [react(), backendLocal()],
  // Las secciones viven en la landing: las rutas antiguas redirigen a su ancla.
  // /proyectos se mantiene como página de detalle (galería completa).
  redirects: {
    '/servicios': '/#servicios',
    '/clientes': '/#clientes',
    '/nosotros': '/#nosotros',
    '/contacto': '/#contacto',
    // Panel de administración (no enlazado desde el sitio público).
    '/admin': '/admin/dashboard',
  },
});
