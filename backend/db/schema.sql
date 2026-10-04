-- =========================================================
-- SIIE S.A. de C.V. - Esquema de base de datos
-- Servicios Integrales de Ingeniería El Salvador
-- =========================================================

-- Información general de la empresa (registro único)
CREATE TABLE IF NOT EXISTS empresa (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nombre TEXT NOT NULL,
  sitio_web TEXT,
  direccion TEXT,
  telefono TEXT,
  celular TEXT,
  registro_fiscal TEXT,
  nit TEXT,
  resena_historica TEXT,
  mision TEXT,
  vision TEXT
);

-- Valores institucionales
CREATE TABLE IF NOT EXISTS valores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT
);

-- Clientes principales (referencias)
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  telefono TEXT,
  contacto TEXT
);

-- Servicios realizados por cliente (bullets bajo cada cliente)
CREATE TABLE IF NOT EXISTS servicios_por_cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  orden INTEGER DEFAULT 0
);

-- "Otros clientes" (lista simple sin detalle de proyectos)
CREATE TABLE IF NOT EXISTS otros_clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

-- Categorías del catálogo de Productos y Servicios
-- (Soluciones Área Comercial, Área Industrial, Energía Renovable y Calidad,
--  Auditorías Energéticas, Mantenimiento de Infraestructura, etc.)
-- Son los "servicios" del sitio y del panel: nombre = título, descripcion = corta.
CREATE TABLE IF NOT EXISTS categorias_servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  descripcion_larga TEXT,               -- página de detalle (si falta, se usa la corta)
  orden INTEGER NOT NULL DEFAULT 0,
  publicado INTEGER NOT NULL DEFAULT 1, -- 0 = oculto en el sitio público
  fecha_actualizacion TEXT
);

-- Ítems de "Qué incluye" de cada servicio (categoría)
CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER REFERENCES categorias_servicios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER DEFAULT 0
);

-- Fotos de cada servicio, subidas desde el panel. Los archivos viven en
-- UPLOADS_DIR/servicios/<archivo>-<ancho>.webp (nombre generado por el servidor).
CREATE TABLE IF NOT EXISTS servicio_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER NOT NULL REFERENCES categorias_servicios(id) ON DELETE CASCADE,
  archivo TEXT NOT NULL UNIQUE,         -- identificador aleatorio, sin extensión ni ancho
  anchos TEXT NOT NULL,                 -- anchos generados, p. ej. '400,800'
  ancho INTEGER NOT NULL,               -- tamaño de la versión más grande
  alto INTEGER NOT NULL,
  alt TEXT NOT NULL,                    -- texto alternativo
  orden INTEGER NOT NULL DEFAULT 0,
  es_portada INTEGER NOT NULL DEFAULT 0,
  fecha_creacion TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_servicio_fotos_categoria ON servicio_fotos(categoria_id, orden);
-- Una sola portada por servicio
CREATE UNIQUE INDEX IF NOT EXISTS idx_servicio_fotos_portada ON servicio_fotos(categoria_id) WHERE es_portada = 1;

-- Contratos de mantenimiento (tabla del PDF)
CREATE TABLE IF NOT EXISTS contratos_mantenimiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_proyecto TEXT NOT NULL,
  ejecucion TEXT,
  descripcion TEXT
);

-- Proyectos destacados (tabla del PDF)
CREATE TABLE IF NOT EXISTS proyectos_destacados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_proyecto TEXT NOT NULL,
  ejecucion TEXT,
  descripcion TEXT
);

-- Marcas representadas / distribuidas
CREATE TABLE IF NOT EXISTS marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  funcion TEXT
);

-- Documentación legal (NIT, NRC, etc.)
CREATE TABLE IF NOT EXISTS documentacion_legal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,           -- ej: 'NIT', 'NRC/Registro de Contribuyentes'
  numero TEXT,
  fecha_expedicion TEXT,
  descripcion TEXT
);

-- Fotografías de proyectos (galería) - referencia a archivo/URL + descripción
CREATE TABLE IF NOT EXISTS fotografias_proyectos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descripcion TEXT NOT NULL,
  imagen_url TEXT,              -- ruta o URL de la imagen en el sitio
  orden INTEGER DEFAULT 0
);

-- Mensajes recibidos desde el formulario de contacto del sitio web
CREATE TABLE IF NOT EXISTS mensajes_contacto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT,
  telefono TEXT,
  empresa TEXT,
  mensaje TEXT NOT NULL,
  fecha_creacion TEXT DEFAULT (datetime('now')),
  -- Seguimiento en el panel (ver ESTADOS_SOLICITUD en db/index.js)
  estado TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (estado IN ('nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado')),
  notas TEXT,                           -- notas internas del equipo
  fecha_actualizacion TEXT              -- último cambio de estado o notas
);

-- Leads capturados por el chatbot de cotización del sitio web
CREATE TABLE IF NOT EXISTS leads_chatbot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_servicio TEXT,
  alcance TEXT,
  ubicacion TEXT,
  plazo TEXT,
  nombre TEXT NOT NULL,
  empresa TEXT,
  correo TEXT,
  telefono TEXT,
  origen TEXT DEFAULT 'chatbot',        -- 'chatbot' | 'whatsapp'
  correo_enviado INTEGER DEFAULT 0,     -- 1 si se logró notificar por email
  fecha_creacion TEXT DEFAULT (datetime('now')),
  estado TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (estado IN ('nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado')),
  notas TEXT,
  fecha_actualizacion TEXT
);

-- Usuarios del panel de administración. Se crean solo con `npm run crear-admin`
-- (no hay registro público ni usuarios por defecto en el seed).
CREATE TABLE IF NOT EXISTS admin_usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,          -- Argon2id (formato PHC: $argon2id$...)
  fecha_creacion TEXT DEFAULT (datetime('now'))
);

-- Sesiones del panel. Solo se guarda el SHA-256 del token: el token real vive
-- únicamente en la cookie HttpOnly del navegador. Cerrar sesión borra la fila.
CREATE TABLE IF NOT EXISTS admin_sesiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES admin_usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  creada TEXT DEFAULT (datetime('now')),
  expira TEXT NOT NULL                  -- datetime UTC, formato 'YYYY-MM-DD HH:MM:SS'
);
CREATE INDEX IF NOT EXISTS idx_admin_sesiones_usuario ON admin_sesiones(usuario_id);

