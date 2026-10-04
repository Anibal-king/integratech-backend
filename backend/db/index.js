const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { DATABASE_PATH } = require('../config');

const DB_PATH = DATABASE_PATH;
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

/** Estados de seguimiento de una solicitud (formulario o chatbot), en orden. */
const ESTADOS_SOLICITUD = /** @type {const} */ (['nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado']);

/**
 * Columnas añadidas después de la primera versión del esquema. schema.sql ya
 * las trae para bases nuevas; aquí se agregan a las bases existentes sin tocar
 * los datos (las filas existentes quedan en estado 'nuevo').
 */
const COLUMNAS_NUEVAS = {
  mensajes_contacto: {
    estado: `TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN (${ESTADOS_SOLICITUD.map((e) => `'${e}'`).join(', ')}))`,
    notas: 'TEXT',
    fecha_actualizacion: 'TEXT',
  },
  leads_chatbot: {
    estado: `TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN (${ESTADOS_SOLICITUD.map((e) => `'${e}'`).join(', ')}))`,
    notas: 'TEXT',
    fecha_actualizacion: 'TEXT',
  },
  categorias_servicios: {
    descripcion_larga: 'TEXT',
    orden: 'INTEGER NOT NULL DEFAULT 0',
    publicado: 'INTEGER NOT NULL DEFAULT 1',
    fecha_actualizacion: 'TEXT',
  },
};

/** Índices que dependen de columnas agregadas por la migración (sufijo del nombre → columna). */
const INDICES = {
  mensajes_contacto: { estado: 'estado', fecha: 'fecha_creacion' },
  leads_chatbot: { estado: 'estado', fecha: 'fecha_creacion' },
};

/**
 * Pasos de datos que corren una sola vez, justo cuando se agrega la columna.
 * @type {Record<string, () => void>}
 */
const AL_AGREGAR = {
  // Servicios existentes: conservan su orden actual (por id) y los textos largos
  // pasan a la descripción larga, dejando la primera oración como corta.
  'categorias_servicios.orden': () => db.exec('UPDATE categorias_servicios SET orden = id'),
  'categorias_servicios.descripcion_larga': () => {
    /** @type {{ id: number, nombre: string, descripcion: string }[]} */
    const filas = all('SELECT id, nombre, descripcion FROM categorias_servicios');
    const upd = db.prepare('UPDATE categorias_servicios SET descripcion = ?, descripcion_larga = ? WHERE id = ?');
    for (const s of filas) {
      const { corta, larga } = separarDescripcion(s.nombre, s.descripcion ?? '');
      if (larga) upd.run(corta, larga, s.id);
    }
  },
};

/**
 * Descripciones cortas de los servicios iniciales cuyo texto original es un
 * párrafo largo (este pasa a la descripción larga). Se editan en el panel.
 */
const DESCRIPCIONES_CORTAS = {
  'Auditorías Energéticas':
    'Estudios de calidad de energía según la norma IEC 61000-4-30 Clase A, con informe técnico y oportunidades de ahorro.',
  'Mantenimiento de Infraestructura':
    'Mantenimiento preventivo y correctivo de sistemas eléctricos, redes de voz y datos, aire acondicionado, UPS y plantas de emergencia.',
  'Asesoría para Ahorro Energético':
    'Recomendaciones y proyectos de ahorro de energía con análisis costo-beneficio.',
};

/**
 * Separa un texto de servicio en descripción corta y larga. Los textos de más de
 * 160 caracteres pasan a la larga; la corta sale de DESCRIPCIONES_CORTAS o, si no
 * está, del texto recortado en una palabra.
 * @param {string} nombre
 * @param {string} texto
 * @returns {{ corta: string, larga: string | null }}
 */
function separarDescripcion(nombre, texto) {
  if (texto.length <= 160) return { corta: texto, larga: null };
  const corta = /** @type {Record<string, string>} */ (DESCRIPCIONES_CORTAS)[nombre] ?? `${texto.slice(0, 150).replace(/\s+\S*$/, '')}…`;
  return { corta, larga: texto };
}

/** Agrega las columnas que falten (con sus pasos de datos) e índices. Idempotente. */
function migrar() {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    const existentes = new Set(db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => String(c.name)));
    for (const [columna, definicion] of Object.entries(columnas)) {
      if (existentes.has(columna)) continue;
      db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
      AL_AGREGAR[`${tabla}.${columna}`]?.();
    }
  }
  for (const [tabla, indices] of Object.entries(INDICES)) {
    for (const [sufijo, c] of Object.entries(indices)) db.exec(`CREATE INDEX IF NOT EXISTS idx_${tabla}_${sufijo} ON ${tabla}(${c})`);
  }
}

/** Crea las tablas que falten y aplica las migraciones (idempotente). */
function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  migrar();
}

/**
 * Ejecuta un SELECT y tipa las filas. node:sqlite devuelve filas genéricas;
 * el tipo lo fija quien llama con el contrato de shared/api-types.ts.
 * @template T
 * @param {string} sql
 * @param {...(string | number | null)} params
 * @returns {T[]}
 */
function all(sql, ...params) {
  return /** @type {T[]} */ (/** @type {unknown} */ (db.prepare(sql).all(...params)));
}

/**
 * Igual que all() pero para una sola fila (o undefined si no existe).
 * @template T
 * @param {string} sql
 * @param {...(string | number | null)} params
 * @returns {T | undefined}
 */
function get(sql, ...params) {
  return /** @type {T | undefined} */ (/** @type {unknown} */ (db.prepare(sql).get(...params)));
}

module.exports = { db, all, get, initSchema, DB_PATH, ESTADOS_SOLICITUD, separarDescripcion };
