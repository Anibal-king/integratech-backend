// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // Las secciones viven en la landing: las rutas antiguas redirigen a su ancla.
  // /proyectos y /servicios (catálogo completo) son páginas propias.
  redirects: {
    '/clientes': '/#clientes',
    '/nosotros': '/#nosotros',
    '/contacto': '/#contacto',
  },
});
