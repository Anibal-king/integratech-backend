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
| `npm run db:seed` | Vacía y recarga las tablas de contenido. Idempotente y en una transacción; no toca `mensajes_contacto`, `leads_chatbot`, `admin_*` ni los servicios (solo los crea si no hay ninguno) |
| `npm run crear-admin` | Crea un usuario del panel (pide correo y contraseña; mínimo 12 caracteres) |
| `npm run cambiar-password` | Contraseña nueva para un usuario del panel (sirve si se olvidó); cierra sus sesiones |
| `npm run migrar-fotos-servicios` | Fotos iniciales de los servicios → `UPLOADS_DIR` (idempotente) |
| `npm run typecheck` | `tsc` sobre el JS (JSDoc + `checkJs`) contra `../shared/api-types.ts` |

Variables de entorno: ver [`.env.example`](.env.example) (`PORT`, `NODE_ENV`, `DATABASE_PATH`, `UPLOADS_DIR`, `CORS_ORIGIN`, `TRUST_PROXY`, `SMTP_*`).

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
│   ├── fotos.js        # Fotos: validación del contenido, versiones WebP, archivos en UPLOADS_DIR
│   ├── mailer.js       # Correo SMTP (chatbot y formulario de contacto)
│   ├── security.js     # Límite de envíos, cabeceras, validación de campos
│   ├── servicios.js    # Lectura de servicios con ítems y fotos (API pública y panel)
│   └── zona.js         # Hora de El Salvador (UTC-6) ↔ UTC de la base
├── routes/             # Un archivo por recurso: /api/<recurso> (admin.js: /api/admin)
├── scripts/
│   ├── crear-admin.js       # npm run crear-admin
│   ├── cambiar-password.js  # npm run cambiar-password
│   ├── migrar-fotos-servicios.js  # npm run migrar-fotos-servicios
│   └── lector.js            # entrada por terminal (contraseña oculta)
├── storage/uploads/    # (generado, ignorado por git) fotos subidas: respaldar con la base
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
| `categorias_servicios`    | Servicios del sitio: título (`nombre`), descripción corta y larga, orden, publicado. Se administran en el panel; el seed solo los crea si no hay ninguno |
| `servicios`               | Ítems de «Qué incluye» de cada servicio                               |
| `servicio_fotos`          | Fotos de cada servicio: archivo generado, anchos, alt, orden, portada |
| `citas`                   | Calendario del panel: título, cliente, contacto, servicio y solicitud de origen (opcionales), inicio/fin en UTC, lugar, notas, estado |
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
GET /api/servicios        → servicios publicados, en el orden del panel, con ítems, portada y fotos
GET /api/servicios/:id    → un servicio publicado (404 si no existe o está oculto)
```
Las fotos traen `src` y `srcset` relativos (`/media/servicios/<archivo>-<ancho>.webp`):
el frontend antepone la URL de la API.

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

GET   /api/admin/solicitudes?estado=&origen=&q=&pagina=1&por_pagina=20
      → { items, total, pagina, por_pagina }  formulario + chatbot, más recientes primero
GET   /api/admin/solicitudes/:origen/:id      → una solicitud (origen: formulario | chatbot)
PATCH /api/admin/solicitudes/:origen/:id      Body: { estado?, notas? } → solicitud actualizada
GET   /api/admin/estadisticas
      → { total, sin_atender, mes_actual, por_mes (6 meses × origen), por_estado }
```
#### Servicios y fotos
```
GET    /api/admin/servicios                       → todos (incluidos los ocultos)
GET    /api/admin/servicios/:id
POST   /api/admin/servicios                       Body: { nombre, descripcion, descripcion_larga?, items[], publicado }
PUT    /api/admin/servicios/:id                   (mismo cuerpo)
PUT    /api/admin/servicios/orden                 Body: { ids: [...] } con todos los servicios
DELETE /api/admin/servicios/:id                   → 204; borra ítems, fotos y sus archivos
POST   /api/admin/servicios/:id/fotos             multipart, campo "fotos" (hasta 20 por envío)
PATCH  /api/admin/servicios/:id/fotos/:fotoId     Body: { alt?, es_portada?: true }
PUT    /api/admin/servicios/:id/fotos/orden       Body: { ids: [...] } con todas sus fotos
DELETE /api/admin/servicios/:id/fotos/:fotoId     (si era la portada, pasa a serlo la siguiente)
```
- **Validación:** 400 con `{ error, campos: { nombre?, descripcion?, ... } }`; título repetido → 409.
- **Fotos:** máximo 8 MB. El tipo se decide por el contenido (sharp), no por la extensión
  ni el Content-Type: solo JPEG, PNG y WebP. Se corrige la orientación, se quitan los
  metadatos (EXIF/GPS) y se generan WebP de 400, 800 y 1600 px (y el ancho original si es
  menor), sin agrandar. Los nombres son aleatorios; se sirven en `/media` con caché de un año.
  Si en un envío algunas fotos fallan, las válidas se guardan y las otras vienen en `errores`.

#### Citas (calendario)
```
GET  /api/admin/citas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   → citas que tocan esos días locales (máx. 62 días)
GET  /api/admin/citas/proximas?limite=5                  → { proximos_7_dias, items } (solo programadas)
GET  /api/admin/citas/:id
POST /api/admin/citas          Body: { titulo, inicio_local, fin_local, cliente?, telefono?, correo?,
                                       servicio_id?, solicitud?: { origen, id }, lugar?, notas?, estado?,
                                       confirmar_traslape? }
PUT  /api/admin/citas/:id      (mismo cuerpo; reemplaza todos los campos)
POST /api/admin/citas/:id/cancelar   (no se borra: queda como cancelada)
```
- **Zona horaria:** las fechas viajan en hora de El Salvador (`'2026-10-05T09:00'`, como un
  `<input type="datetime-local">`) y se guardan en UTC. Las respuestas traen también ISO con
  desplazamiento (`'2026-10-05T09:00:00-06:00'`). El Salvador no tiene horario de verano.
- **Traslapes:** si la cita se cruza con otra **programada** (las canceladas y completadas no
  cuentan; una que empieza justo cuando otra termina tampoco), responde 409 con
  `{ error, traslapes: [...] }`. Se guarda igual reenviando con `confirmar_traslape: true`.
- **Validación:** 400 con `campos`; fin posterior al inicio, máximo 14 días de duración.

- **Estados:** `nuevo` (por defecto), `contactado`, `cotizado`, `cerrado`, `descartado`.
  Columnas `estado`, `notas` y `fecha_actualizacion` en `mensajes_contacto` y
  `leads_chatbot`; `db/index.js` las agrega a bases existentes al arrancar (o con
  `npm run db:migrate`) sin tocar los datos.
- **Búsqueda (`q`):** texto literal en nombre, empresa, correo, teléfono, mensaje,
  respuestas del chatbot y notas. **Meses:** se cuentan en hora de El Salvador (UTC-6).
- **Origen:** todas exigen un header `Origin` incluido en `CORS_ORIGIN`; si falta o no
  coincide, 403. El navegador lo envía siempre porque el panel y la API están en
  orígenes distintos. Con `curl` hay que añadirlo: `-H "Origin: http://localhost:4321"`.
- **Login:** el mismo mensaje (401) si falla el correo o la contraseña, con un tiempo de
  respuesta similar en ambos casos. Límite: 10 intentos por IP cada 15 minutos (429).
- **Sesión:** token aleatorio de 32 bytes en una cookie `HttpOnly; SameSite=Lax; Path=/api`
  (más `Secure` con `NODE_ENV=production`), válida 8 horas. En la base (`admin_sesiones`)
  solo se guarda su SHA-256. Sin sesión válida: 401.
- **Contraseñas:** Argon2id (`admin_usuarios.password_hash`). Usuarios solo por
  `npm run crear-admin`; contraseña olvidada: `npm run cambiar-password`. No hay registro
  público, recuperación por correo ni roles.

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
