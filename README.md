# IntegraTech

Sitio web de **Servicios Integrales de Ingeniería El Salvador, S.A. de C.V. (SIIE)**.

Monorepo:

```
IntegraTech0.1/
├── backend/     API REST + base de datos (Node.js 22+ / Express 5 / SQLite nativo)
├── frontend/    Sitio web (Astro + React + TypeScript); integrations/ levanta la API local
├── shared/      Contrato de la API (api-types.ts), usado por backend y frontend
└── scripts/     dev.mjs (backend + frontend a la vez), check-api.mjs (comprobar la API)
```

## Requisitos

- Node.js **22.5 o superior** (`node --version`; el backend usa `node:sqlite`)
- npm 10+ (el gestor del proyecto es **npm**: los lockfiles versionados son `package-lock.json`)

## Arranque desde cero

```bash
npm run install:all                      # dependencias de backend y frontend
cp backend/.env.example backend/.env     # opcional: valores por defecto sirven en desarrollo
cp frontend/.env.example frontend/.env
npm run db:seed                          # crea backend/db/siie.db y carga los datos
npm run migrar-fotos-servicios           # fotos iniciales de los servicios → backend/storage/uploads
npm run dev                              # API en :3000 + sitio en :4321
```

**Trabajando solo en el frontend** basta con `npm run dev` dentro de `frontend/`
(o `npm run frontend`): si la API local no responde, Astro arranca
`backend/server.js` por su cuenta (logs con prefijo `[backend]`) y lo detiene al
cerrarse. Lo hace la integración `frontend/integrations/backend-local.mjs`; se
desactiva con `AUTO_BACKEND=false` en `frontend/.env`.

`npm run dev` desde la raíz levanta los dos procesos con prefijos `[backend]` /
`[frontend]` (el backend con `--watch`, útil si también lo estás editando);
Ctrl+C detiene ambos. Si ya hay otro `astro dev` corriendo, deténlo antes
(`npm --prefix frontend run astro -- dev stop`).

Comprobación rápida: <http://localhost:3000/api/health> debe responder `"ok": true`
y conteos mayores que cero en `db.conteos`.

## Scripts (raíz)

| Script | Qué hace |
|---|---|
| `npm run dev` | Backend (con `--watch`) + frontend a la vez |
| `npm run backend` / `npm run frontend` | Cada uno por separado |
| `npm run db:migrate` | Crea las tablas que falten; no toca los datos |
| `npm run db:seed` | Vacía y recarga las tablas de contenido con los datos de la empresa. Idempotente y en una transacción. No toca `mensajes_contacto`, `leads_chatbot` ni los usuarios del panel |
| `npm run crear-admin` | Crea un usuario del panel de administración (pide correo y contraseña) |
| `npm run cambiar-password` | Asigna una contraseña nueva a un usuario del panel (también si la olvidaste) y cierra sus sesiones |
| `npm run migrar-fotos-servicios` | Pasa las fotos iniciales de cada servicio al sistema de fotos del panel. Idempotente: se salta los servicios que ya tienen fotos |
| `npm run build` | `astro build` → `frontend/dist/` (servidor Node + archivos estáticos). No necesita la API encendida |
| `npm run start:backend` / `npm run start:frontend` | Producción: API y sitio ya compilado |
| `npm run check:api` | Comprueba `/api/health` en `PUBLIC_API_URL` y avisa de tablas vacías |
| `npm run typecheck` | `tsc` del backend (JSDoc + `checkJs` contra `shared/api-types.ts`) |

Si la base no existe o no tiene contenido, el backend ejecuta el seed al arrancar.

## Variables de entorno

**`backend/.env`** (ver `backend/.env.example`):

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `NODE_ENV` | — | `production` desactiva los orígenes CORS por defecto |
| `DATABASE_PATH` | `db/siie.db` | Ruta de SQLite. Si es relativa, se resuelve contra `backend/`, nunca contra la carpeta de arranque |
| `UPLOADS_DIR` | `storage/uploads` | Fotos subidas desde el panel (WebP). Relativa a `backend/`. Fuera de git: **respaldar junto con la base** |
| `CORS_ORIGIN` | `http://localhost:4321,http://127.0.0.1:4321` en desarrollo | Orígenes del navegador permitidos, separados por comas. Obligatorio en producción. También es la lista de orígenes aceptados por el panel de administración |
| `TRUST_PROXY` | `0` | Proxies delante del servidor en producción, para que el límite de envíos use la IP real |
| `SMTP_*`, `MAIL_FROM`, `MAIL_TO_LEADS` | — | Correo de los leads del chatbot y del formulario de contacto (opcional) |

**`frontend/.env`** (ver `frontend/.env.example`):

| Variable | Uso |
|---|---|
| `PUBLIC_API_URL` | URL del backend (por defecto `http://localhost:3000`) |
| `AUTO_BACKEND` | `false` desactiva el arranque automático de la API local en `astro dev` |
| `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_WHATSAPP_MESSAGE` | Derivación a WhatsApp del chatbot |

## Cómo se obtienen los datos

- **Inicio, `/servicios/[id]` y `/proyectos` se renderizan en cada visita** (adaptador
  `@astrojs/node`, `export const prerender = false`): muestran siempre los servicios y
  fotos actuales del panel, sin recompilar. Un servicio oculto o inexistente responde 404.
  Si la API no responde, solo las secciones con datos muestran un aviso; el resto de la
  página carga normal.
- El resto (panel, redirecciones) es estático. En `astro dev`, si `PUBLIC_API_URL` es
  local y no responde, Astro arranca el backend automáticamente.
- Las fotos de los servicios las sirve el backend en `/media/...` (WebP en 400, 800 y
  1600 px, sin agrandar la original); el HTML usa `srcset`.
- Desde el navegador solo llaman a la API el formulario de contacto, el chatbot (POST)
  y el panel de administración; por eso CORS solo afecta a esos tres.
- Formato de respuesta: listas como arreglo directo (`[]` con 200 si no hay datos),
  recursos individuales como objeto (404 si no existen), `/api/empresa` como objeto o
  `null`, y errores como `{ "error": "..." }` con mensaje genérico (el detalle va al log).
- El frontend distingue: error de red, error HTTP, formato inválido y vacío. El vacío
  muestra un mensaje amable, no un error. El detalle técnico solo aparece con `astro dev`.

## Panel de administración

`/admin/login` y las páginas del panel (no enlazadas desde el sitio, con `noindex`):

- **Resumen** (`/admin/dashboard`): cifras clave, solicitudes por mes, conteo por estado y recientes.
- **Mensajes** (`/admin/mensajes`): todas las solicitudes del formulario y del chatbot con
  búsqueda, filtros y paginación; en el detalle se cambia el estado, se escriben notas
  internas y se responde por correo, teléfono o WhatsApp.
- **Servicios** (`/admin/servicios`): crear, editar, ocultar, ordenar y eliminar los
  servicios del sitio; galería por servicio con subida de fotos, portada, orden y texto
  alternativo.
- **Calendario**: próximamente.

Las gráficas usan Chart.js, que solo carga la página del Resumen.

- **Primer usuario:** con el backend instalado, `npm run crear-admin` y responde
  correo y contraseña (mínimo 12 caracteres). No hay registro público ni usuarios por defecto.
- **Contraseña olvidada:** `npm run cambiar-password` (requiere acceso al servidor; si el
  correo no existe, el script muestra los usuarios registrados).
- **Seguridad:** el HTML de estas páginas es estático y no contiene datos. El navegador
  pide los datos a la API, que exige una sesión válida (cookie HttpOnly, 8 horas,
  guardada en SQLite como hash). Cerrar sesión la invalida en la base.
- **Producción:** el frontend y la API deben compartir sitio (p. ej. `www.dominio.com`
  y `api.dominio.com`), la API debe ir por HTTPS con `NODE_ENV=production`, y
  `CORS_ORIGIN` debe contener el origen exacto del frontend. Detalle en `backend/README.md`.

## Publicación (producción)

Dos procesos Node, cada uno en su puerto, detrás de un proxy con HTTPS:

```bash
npm run install:all
npm run build                            # compila frontend/dist (no necesita la API)
npm run db:migrate                       # aplica cambios de esquema (también lo hace la API al arrancar)
npm run start:backend                    # API: node backend/server.js            (PORT, por defecto 3000)
npm run start:frontend                   # sitio: node frontend/dist/server/entry.mjs (HOST y PORT, por defecto 4321)
```

- **Conservar y respaldar** (no están en git): la base SQLite (`DATABASE_PATH`, por
  defecto `backend/db/siie.db`) y la carpeta de fotos (`UPLOADS_DIR`, por defecto
  `backend/storage/uploads/`). Respáldalas juntas: la base referencia los archivos.
- Un despliegue nuevo reemplaza `frontend/dist/` completo; no guardes nada ahí.
- Primera vez con una base que ya tenía servicios: `npm run migrar-fotos-servicios`.

> Nota: si `npm run` falla con `spawn ... ENOENT`, es por la variable de entorno
> `ComSpec` apuntando a una ruta inválida. Corrígela a `C:\Windows\System32\cmd.exe`
> o ejecuta los scripts con `node` directamente (p. ej. `node scripts/dev.mjs`).

## Documentación

- API y modelo de datos: [`backend/README.md`](backend/README.md)
