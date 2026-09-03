# SIIE Backend

API REST + base de datos para el sitio web de **Servicios Integrales de Ingeniería El Salvador, S.A. de C.V. (SIIE)**.

- **Stack:** Node.js 22 + Express 5
- **Base de datos:** SQLite, usando el módulo nativo `node:sqlite` (no requiere instalar `sqlite3` ni compilar nada). El archivo vive en `db/siie.db` y se crea automáticamente.
- Toda la información viene extraída de la ficha "Información de la empresa" (reseña, misión, visión, valores, clientes, catálogo de servicios, contratos de mantenimiento, proyectos destacados, marcas y documentación legal).

## Requisitos

- Node.js **22 o superior** (usa `node --version` para verificar). El módulo `node:sqlite` es experimental pero estable para este uso.

## Instalación y arranque

```bash
npm install        # instala express y cors (únicas dependencias)
npm run seed        # crea db/siie.db y la llena con los datos del PDF (opcional, se hace solo si no existe)
npm start            # levanta el servidor en http://localhost:3000
```

La primera vez que corras `npm start` sin haber hecho `npm run seed`, el servidor detecta que no existe `db/siie.db` y la crea/puebla automáticamente.

Para reiniciar los datos desde cero:
```bash
rm db/siie.db
npm run seed
```

## Estructura del proyecto

```
siie-backend/
├── db/
│   ├── schema.sql      # Definición de tablas
│   ├── index.js        # Conexión a SQLite
│   ├── seed.js         # Carga los datos del PDF a la base
│   └── siie.db         # (generado) archivo de base de datos
├── routes/
│   ├── empresa.js
│   ├── clientes.js
│   ├── servicios.js
│   ├── proyectos.js
│   ├── marcas.js
│   ├── legal.js
│   └── contacto.js
├── server.js           # Punto de entrada de Express
└── package.json
```

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

## Endpoints de la API

Todas las rutas responden JSON y están montadas bajo `/api`.

### Salud del servicio
```
GET /api/health
```

### Empresa
```
GET /api/empresa
```
Devuelve datos generales + arreglo `valores`.

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

### Contacto (formulario del sitio web)
```
POST /api/contacto
Body JSON: { "nombre": "...", "correo": "...", "telefono": "...", "empresa": "...", "mensaje": "..." }

GET /api/contacto   → (uso administrativo) lista los mensajes recibidos
```

## Próximos pasos sugeridos

1. **Fotos de proyectos:** el PDF incluye ~30 fotografías de proyectos con su descripción. Se dejó la tabla `fotografias_proyectos` lista en el esquema; solo falta subir las imágenes (a `/public/images` o a un bucket) y poblar la tabla con las rutas/URLs.
2. **Autenticación:** si vas a exponer `GET /api/contacto` (mensajes del formulario) en producción, protégelo con autenticación (por ejemplo, un JWT de administrador), ya que ahora mismo es público.
3. **CORS:** actualmente `cors()` permite cualquier origen; en producción limita `origin` al dominio de tu sitio (`www.sii.com.sv`).
4. **Migrar a PostgreSQL:** si el sitio crecerá o necesitas backups gestionados, la estructura en `schema.sql` es fácilmente portable a Postgres/MySQL cuando quieras escalar.
