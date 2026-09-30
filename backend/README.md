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
| `npm run db:seed` | Vacía y recarga las tablas de contenido. Idempotente y en una transacción; no toca `mensajes_contacto` ni `leads_chatbot` |
| `npm run typecheck` | `tsc` sobre el JS (JSDoc + `checkJs`) contra `../shared/api-types.ts` |

Variables de entorno: ver [`.env.example`](.env.example) (`PORT`, `NODE_ENV`, `DATABASE_PATH`, `CORS_ORIGIN`, `ADMIN_TOKEN`, `TRUST_PROXY`, `SMTP_*`).

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
│   ├── mailer.js       # Correo SMTP de los leads del chatbot
│   └── security.js     # ADMIN_TOKEN, límite de envíos, cabeceras, validación de campos
├── routes/             # Un archivo por recurso: /api/<recurso>
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
POST /api/contacto       Body: { nombre, correo?, telefono?, empresa?, mensaje }
POST /api/lead-chatbot   Body: ver docs/chatbot-flujo.md
```
- Límite: 5 envíos por IP cada 10 minutos (429 al superarlo).
- Longitud máxima por campo; 400 si se excede. Cuerpo máximo: 16 KB.
- CORS: solo los orígenes de `CORS_ORIGIN`.

### Rutas administrativas (datos personales)
```
GET /api/contacto       → mensajes del formulario
GET /api/lead-chatbot   → leads del chatbot
Header: Authorization: Bearer <ADMIN_TOKEN>
```
Sin `ADMIN_TOKEN` configurado responden 404 (deshabilitadas); con un token incorrecto, 401.

## Próximos pasos sugeridos

1. **Fotos de proyectos:** se dejó la tabla `fotografias_proyectos` lista en el esquema; hoy las fotos viven en `frontend/src/assets/img` y no se usa la tabla.
2. **Migrar a PostgreSQL:** si el sitio crecerá o necesitas backups gestionados, la estructura en `schema.sql` es fácilmente portable a Postgres/MySQL cuando quieras escalar.
