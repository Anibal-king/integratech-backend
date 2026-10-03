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
};

/** Agrega las columnas que falten e índices que dependen de ellas. Idempotente. */
function migrar() {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    const existentes = new Set(db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => String(c.name)));
    for (const [columna, definicion] of Object.entries(columnas)) {
      if (!existentes.has(columna)) db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tabla}_estado ON ${tabla}(estado)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tabla}_fecha ON ${tabla}(fecha_creacion)`);
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

module.exports = { db, all, get, initSchema, DB_PATH, ESTADOS_SOLICITUD };
