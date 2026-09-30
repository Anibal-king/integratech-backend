// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import backendLocal from './integrations/backend-local.mjs';

// https://astro.build/config
export default defineConfig({
  // backendLocal: levanta la API local si no está corriendo (dev y build) para que siempre haya datos.
  integrations: [react(), backendLocal()],
  // Las secciones viven en la landing: las rutas antiguas redirigen a su ancla.
  // /proyectos se mantiene como página de detalle (galería completa).
  redirects: {
    '/servicios': '/#servicios',
    '/clientes': '/#clientes',
    '/nosotros': '/#nosotros',
    '/contacto': '/#contacto',
  },
});
