# IntegraTech

Sitio web de **Servicios Integrales de Ingeniería El Salvador, S.A. de C.V. (SIIE)**.

Monorepo:

```
IntegraTech0.1/
├── backend/     API REST + base de datos (Node.js 22+ / Express 5 / SQLite nativo)
├── frontend/    Sitio web (Astro + React + TypeScript)
├── shared/      Contrato de la API (api-types.ts), usado por backend y frontend
└── scripts/     dev.mjs (backend + frontend a la vez), check-api.mjs (previo al build)
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
npm run dev                              # API en :3000 + sitio en :4321
```

`npm run dev` levanta los dos procesos con prefijos `[backend]` / `[frontend]`;
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
| `npm run db:seed` | Vacía y recarga las tablas de contenido con los datos de la empresa. Idempotente y en una transacción. No toca `mensajes_contacto` ni `leads_chatbot` |
| `npm run build` | Verifica que la API responda y luego hace `astro build` |
| `npm run typecheck` | `tsc` del backend (JSDoc + `checkJs` contra `shared/api-types.ts`) |

Si la base no existe o no tiene contenido, el backend ejecuta el seed al arrancar.

## Variables de entorno

**`backend/.env`** (ver `backend/.env.example`):

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto de la API |
| `NODE_ENV` | — | `production` desactiva los orígenes CORS por defecto |
| `DATABASE_PATH` | `db/siie.db` | Ruta de SQLite. Si es relativa, se resuelve contra `backend/`, nunca contra la carpeta de arranque |
| `CORS_ORIGIN` | `http://localhost:4321,http://127.0.0.1:4321` en desarrollo | Orígenes del navegador permitidos, separados por comas. Obligatorio en producción |
| `ADMIN_TOKEN` | vacío | Habilita `GET /api/contacto` y `GET /api/lead-chatbot` (datos personales) con `Authorization: Bearer <token>`. Vacío = deshabilitadas |
| `TRUST_PROXY` | `0` | Proxies delante del servidor en producción, para que el límite de envíos use la IP real |
| `SMTP_*`, `MAIL_FROM`, `MAIL_TO_LEADS` | — | Correo de los leads del chatbot (opcional) |

**`frontend/.env`** (ver `frontend/.env.example`):

| Variable | Uso |
|---|---|
| `PUBLIC_API_URL` | URL del backend (por defecto `http://localhost:3000`) |
| `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_WHATSAPP_MESSAGE` | Derivación a WhatsApp del chatbot |

## Cómo se obtienen los datos

- El sitio es **estático**: Astro lee la API en el frontmatter durante `astro build`
  (y en cada petición con `astro dev`). **El backend debe estar corriendo al construir**;
  `npm run build` lo verifica y se detiene si no responde.
- Solo el formulario de contacto y el chatbot llaman a la API desde el navegador
  (POST); por eso CORS solo afecta a esos dos.
- Formato de respuesta: listas como arreglo directo (`[]` con 200 si no hay datos),
  recursos individuales como objeto (404 si no existen), `/api/empresa` como objeto o
  `null`, y errores como `{ "error": "..." }` con mensaje genérico (el detalle va al log).
- El frontend distingue: error de red, error HTTP, formato inválido y vacío. El vacío
  muestra un mensaje amable, no un error. El detalle técnico solo aparece con `astro dev`.

> Nota: si `npm run` falla con `spawn ... ENOENT`, es por la variable de entorno
> `ComSpec` apuntando a una ruta inválida. Corrígela a `C:\Windows\System32\cmd.exe`
> o ejecuta los scripts con `node` directamente (p. ej. `node scripts/dev.mjs`).

## Documentación

- API y modelo de datos: [`backend/README.md`](backend/README.md)
