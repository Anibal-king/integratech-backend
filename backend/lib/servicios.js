/**
 * Lectura de servicios (tabla categorias_servicios + ítems + fotos), compartida
 * por la API pública (solo publicados) y la del panel (todos).
 */
const { all, get } = require('../db');
const { urlsFoto, leerAnchos } = require('./fotos');

/** @typedef {import('../../shared/api-types').ServicioAdmin} ServicioAdmin */
/** @typedef {import('../../shared/api-types').CategoriaServicio} CategoriaServicio */
/** @typedef {import('../../shared/api-types').ServicioFoto} ServicioFoto */

/**
 * @typedef {{ id: number, nombre: string, descripcion: string | null, descripcion_larga: string | null,
 *   orden: number, publicado: number, fecha_actualizacion: string | null }} FilaServicio
 * @typedef {{ id: number, categoria_id: number, archivo: string, anchos: string, ancho: number,
 *   alto: number, alt: string, orden: number, es_portada: number }} FilaFoto
 */

/** @param {FilaFoto} f @returns {ServicioFoto} */
function aFoto(f) {
  return { id: f.id, alt: f.alt, ...urlsFoto(f.archivo, leerAnchos(f.anchos)), ancho: f.ancho, alto: f.alto, es_portada: f.es_portada === 1 };
}

/**
 * Arma los servicios con sus ítems y fotos (3 consultas en total, no una por servicio).
 * @param {FilaServicio[]} filas
 * @returns {ServicioAdmin[]}
 */
function completar(filas) {
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);
  const marcas = ids.map(() => '?').join(',');
  /** @type {{ categoria_id: number, nombre: string }[]} */
  const items = all(`SELECT categoria_id, nombre FROM servicios WHERE categoria_id IN (${marcas}) ORDER BY orden, id`, ...ids);
  /** @type {FilaFoto[]} */
  const fotos = all(`SELECT * FROM servicio_fotos WHERE categoria_id IN (${marcas}) ORDER BY orden, id`, ...ids);

  return filas.map((f) => {
    const propias = fotos.filter((x) => x.categoria_id === f.id).map(aFoto);
    return {
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      descripcion_larga: f.descripcion_larga,
      items: items.filter((i) => i.categoria_id === f.id).map((i) => i.nombre),
      portada: propias.find((p) => p.es_portada) ?? propias[0] ?? null,
      fotos: propias,
      orden: f.orden,
      publicado: f.publicado === 1,
      fecha_actualizacion: f.fecha_actualizacion,
    };
  });
}

const COLUMNAS = 'id, nombre, descripcion, descripcion_larga, orden, publicado, fecha_actualizacion';

/**
 * @param {{ soloPublicados: boolean }} opciones
 * @returns {ServicioAdmin[]}
 */
function listarServicios({ soloPublicados }) {
  /** @type {FilaServicio[]} */
  const filas = all(`SELECT ${COLUMNAS} FROM categorias_servicios ${soloPublicados ? 'WHERE publicado = 1' : ''} ORDER BY orden, id`);
  return completar(filas);
}

/**
 * @param {number} id
 * @param {{ soloPublicados: boolean }} opciones
 * @returns {ServicioAdmin | null}
 */
function obtenerServicio(id, { soloPublicados }) {
  /** @type {FilaServicio | undefined} */
  const fila = get(`SELECT ${COLUMNAS} FROM categorias_servicios WHERE id = ? ${soloPublicados ? 'AND publicado = 1' : ''}`, id);
  return fila ? completar([fila])[0] : null;
}

/**
 * Versión pública: sin los campos internos del panel.
 * @param {ServicioAdmin} s
 * @returns {CategoriaServicio}
 */
function aPublico({ orden, publicado, fecha_actualizacion, ...s }) {
  return s;
}

module.exports = { listarServicios, obtenerServicio, aPublico };
