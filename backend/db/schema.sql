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
CREATE TABLE IF NOT EXISTS categorias_servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT
);

-- Servicios / capacidades específicas dentro de cada categoría
CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER REFERENCES categorias_servicios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER DEFAULT 0
);

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
  fecha_creacion TEXT DEFAULT (datetime('now'))
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
  fecha_creacion TEXT DEFAULT (datetime('now'))
);
