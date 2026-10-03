# SIIE Backend

API REST + base de datos para el sitio web de **Servicios Integrales de Ingeniería El Salvador, S.A. de C.V. (SIIE)**.

- **Stack:** Node.js 22.5+ + Express 5 (JavaScript con tipos verificados por `tsc` vía JSDoc)
- **Base de datos:** SQLite, usando el módulo nativo `node:sqlite` (no requiere instalar `sqlite3` ni compilar nada). El archivo vive en `db/siie.db` (o en `DATABASE_PATH`) y se crea automáticamente.
- Toda la información viene extraída de la ficha "Información de la empresa" (reseña, misión, visión, valores, clientes, catálogo de servicios, contratos de mantenimiento, proyectos destacados, marcas y documentación legal).

## Requisitos

- Node.js **22.5 o superior** (usa `node --version` para verificar). El módulo `node:sqlite` es experimental pero estable para este uso.

## Instalación y arranque

```bash
npm install            # express, cors y nodemailer (+ typescript/@types/node solo para typecheck)
cp .env.example .env   # opcional en desarrollo
npm run db:seed        # crea db/siie.db y carga los datos de la empresa
npm start              # servidor en http://localhost:3000  (npm run dev: con --watch)
```

Si la base no existe o está sin contenido, `npm start` ejecuta el seed automáticamente.

| Script | Qué hace |
|---|---|
| `npm run db:migrate` | Crea las tablas que falten; no toca los datos |
| `npm run db:seed` | Vacía y recarga las tablas de contenido. Idempotente y en una transacción; no toca `mensajes_contacto`, `leads_chatbot` ni `admin_*` |
| `npm run crear-admin` | Crea un usuario del panel (pide correo y contraseña; mínimo 12 caracteres) |
| `npm run typecheck` | `tsc` sobre el JS (JSDoc + `checkJs`) contra `../shared/api-types.ts` |

Variables de entorno: ver [`.env.example`](.env.example) (`PORT`, `NODE_ENV`, `DATABASE_PATH`, `CORS_ORIGIN`, `TRUST_PROXY`, `SMTP_*`).

## Estructura del proyecto

```
backend/
├── config.js           # Carga .env y centraliza la configuración
├── db/
│   ├── schema.sql      # Definición de tablas
│   ├── index.js        # Conexión a SQLite (ruta absoluta) + helpers tipados all/get
│   ├── migrate.js      # Aplica el esquema
│   ├── seed.js         # Carga los datos de la empresa
│   └── siie.db         # (generado, ignorado por git)
├── lib/
│   ├── auth.js         # Panel: Argon2id, sesiones en SQLite, cookie, requireAdmin, origen
│   ├── mailer.js       # Correo SMTP (chatbot y formulario de contacto)
│   └── security.js     # Límite de envíos, cabeceras, validación de campos
├── routes/             # Un archivo por recurso: /api/<recurso> (admin.js: /api/admin)
├── scripts/
│   └── crear-admin.js  # npm run crear-admin
├── server.js           # Punto de entrada de Express
└── tsconfig.json       # Solo verificación de tipos (no compila)
```

El formato de cada respuesta está definido en [`../shared/api-types.ts`](../shared/api-types.ts),
el mismo archivo que usa el frontend.

## Modelo de datos (tablas principales)

| Tabla                     | Contenido                                                            |
|---------------------------|-----------------------------------------------------------------------|
| `empresa`                 | Nombre, contacto, NIT/NRC, reseña histórica, misión, visión           |
| `valores`                 | Responsabilidad, Honestidad, Cooperación                              |
| `clientes`                | Clientes principales (Avícola Salvadoreña, Banco Hipotecario, etc.)   |
| `servicios_por_cliente`   | Bullets de servicios realizados para cada cliente                     |
| `otros_clientes`          | Lista simple de clientes adicionales (SIGET, Pollo Campero, etc.)     |
| `categorias_servicios`    | Categorías del catálogo (Área Comercial, Industrial, Energía, etc.)   |
| `servicios`               | Ítems específicos dentro de cada categoría                            |
| `contratos_mantenimiento` | Contratos de mantenimiento recurrentes con fechas de ejecución        |
| `proyectos_destacados`    | Proyectos relevantes (data centers, subestaciones, iluminación, etc.) |
| `marcas`                  | Marcas representadas (AKSA, Tripp-Lite, Loxone, ABB, etc.)            |
| `documentacion_legal`     | NIT, NRC y otros datos legales                                        |
| `mensajes_contacto`       | Mensajes enviados desde el formulario de contacto del sitio           |
| `leads_chatbot`           | Solicitudes de cotización capturadas por el chatbot                  |

## Endpoints de la API

Todas las rutas responden JSON y están montadas bajo `/api`.

**Formato:** listas como arreglo directo (`[]` con 200 si no hay datos); recursos individuales
(`/:id`) como objeto, o 404 si no existen; errores como `{ "error": "..." }` con mensaje genérico
(el detalle va al log del servidor).

### Salud del servicio
```
GET /api/health   → { ok, servicio, version, db: { ok, conteos: { tabla: filas } } }   (503 si la base no responde)
```

### Empresa
```
GET /api/empresa
```
Devuelve datos generales + arreglo `valores`, o `null` (200) si aún no está configurada.

### Clientes
```
GET /api/clientes                → lista de clientes principales con sus servicios
GET /api/clientes/:id             → detalle de un cliente
GET /api/clientes/otros/lista     → lista de "otros clientes"
```

### Catálogo de servicios
```
GET /api/servicios        → categorías con sus ítems
GET /api/servicios/:id    → detalle de una categoría
```

### Proyectos
```
GET /api/proyectos                          → proyectos destacados
GET /api/proyectos?anio=2024                → filtra por año (coincidencia parcial en "ejecución")
GET /api/proyectos/:id                       → detalle de un proyecto
GET /api/proyectos/contratos-mantenimiento   → contratos de mantenimiento
```

### Marcas
```
GET /api/marcas
```

### Documentación legal
```
GET /api/legal
```

### Formularios públicos (desde el navegador)
```
POST /api/contacto       Body: { nombre, correo?, telefono?, empresa?, mensaje }  (correo o teléfono obligatorio)
POST /api/lead-chatbot   Body: ver docs/chatbot-flujo.md
```
- Ambos guardan en la base y notifican por correo a `MAIL_TO_LEADS` si SMTP está configurado
  (`emailSent` en la respuesta). Sin SMTP el envío igual se guarda.
- Límite: 5 envíos por IP cada 10 minutos (429 al superarlo).
- Longitud máxima por campo; 400 si se excede. Cuerpo máximo: 16 KB.
- CORS: solo los orígenes de `CORS_ORIGIN`.

### Panel de administración (sesión por cookie)
```
POST /api/admin/login    Body: { correo, password }  → { correo } + cookie siie_admin
POST /api/admin/logout   → 204, borra la sesión de la base y la cookie
GET  /api/admin/me       → { correo } o 401
GET  /api/contacto       → mensajes del formulario (requiere sesión)
GET  /api/lead-chatbot   → leads del chatbot (requiere sesión)
```
- **Origen:** todas exigen un header `Origin` incluido en `CORS_ORIGIN`; si falta o no
  coincide, 403. El navegador lo envía siempre porque el panel y la API están en
  orígenes distintos. Con `curl` hay que añadirlo: `-H "Origin: http://localhost:4321"`.
- **Login:** el mismo mensaje (401) si falla el correo o la contraseña, con un tiempo de
  respuesta similar en ambos casos. Límite: 10 intentos por IP cada 15 minutos (429).
- **Sesión:** token aleatorio de 32 bytes en una cookie `HttpOnly; SameSite=Lax; Path=/api`
  (más `Secure` con `NODE_ENV=production`), válida 8 horas. En la base (`admin_sesiones`)
  solo se guarda su SHA-256. Sin sesión válida: 401.
- **Contraseñas:** Argon2id (`admin_usuarios.password_hash`). Usuarios solo por
  `npm run crear-admin`; no hay registro público, recuperación de contraseña ni roles.

#### Cookie en producción
1. **Mismo sitio:** el frontend y la API deben compartir el dominio registrable, por
   ejemplo `www.sii.com.sv` y `api.sii.com.sv`. Con SameSite=Lax el navegador **no**
   envía la cookie entre sitios distintos (p. ej. `x.netlify.app` → `y.onrender.com`).
   Si no pueden compartir dominio, hay que servir la API bajo el mismo dominio con un
   proxy (p. ej. `www.sii.com.sv/api` → backend).
2. **HTTPS y `NODE_ENV=production`** en la API: la cookie lleva `Secure`.
3. **`CORS_ORIGIN`** con el origen exacto del frontend (`https://www.sii.com.sv`, sin
   barra final; añade también la variante sin `www` si se usa).
4. **`PUBLIC_API_URL`** del frontend apuntando a la URL pública de la API.
5. **`TRUST_PROXY`** según los proxies delante de la API, para que el límite de intentos
   use la IP real.

## Próximos pasos sugeridos

1. **Fotos de proyectos:** se dejó la tabla `fotografias_proyectos` lista en el esquema; hoy las fotos viven en `frontend/src/assets/img` y no se usa la tabla.
2. **Migrar a PostgreSQL:** si el sitio crecerá o necesitas backups gestionados, la estructura en `schema.sql` es fácilmente portable a Postgres/MySQL cuando quieras escalar.
