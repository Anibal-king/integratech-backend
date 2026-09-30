const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { DATABASE_PATH } = require('../config');

const DB_PATH = DATABASE_PATH;
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

/** Crea las tablas que falten (idempotente: el esquema usa IF NOT EXISTS). */
function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
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

module.exports = { db, all, get, initSchema, DB_PATH };
