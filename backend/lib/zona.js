/**
 * Hora de El Salvador ↔ UTC. El Salvador usa UTC-6 todo el año (sin horario de
 * verano), así que la conversión es un desplazamiento fijo, sin base de zonas.
 *
 * - En la base: UTC 'YYYY-MM-DD HH:MM:SS' (mismo formato que datetime('now')).
 * - En la API:  hora local 'YYYY-MM-DDTHH:MM' (lo que da un <input type="datetime-local">)
 *               y, en las respuestas, también ISO con desplazamiento ('…T09:00:00-06:00').
 */
const DESPLAZAMIENTO_MS = -6 * 60 * 60 * 1000;
const SUFIJO = '-06:00';

const RE_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date UTC → 'YYYY-MM-DD HH:MM:SS' @param {Date} d */
const aSql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

/**
 * 'YYYY-MM-DDTHH:MM' (El Salvador) → UTC para la base, o null si no es una fecha válida.
 * @param {unknown} v
 * @returns {string | null}
 */
function localAUtc(v) {
  const m = typeof v === 'string' ? RE_LOCAL.exec(v) : null;
  if (!m) return null;
  const [, a, me, d, h, mi] = m.map(Number);
  const utc = Date.UTC(a, me - 1, d, h, mi) - DESPLAZAMIENTO_MS;
  const comprobacion = new Date(utc + DESPLAZAMIENTO_MS);
  // Rechaza fechas imposibles (31 de febrero, 25:00…): Date.UTC las desborda al día siguiente.
  if (comprobacion.getUTCDate() !== d || comprobacion.getUTCHours() !== h || comprobacion.getUTCMonth() !== me - 1) return null;
  return aSql(new Date(utc));
}

/**
 * 'YYYY-MM-DD' (día local) → UTC de su medianoche local, o null.
 * @param {unknown} v
 */
function fechaAUtc(v) {
  return typeof v === 'string' && RE_FECHA.test(v) ? localAUtc(`${v}T00:00`) : null;
}

/** UTC de la base → { iso con -06:00, local 'YYYY-MM-DDTHH:MM' } @param {string} sql */
function utcALocal(sql) {
  const local = new Date(new Date(`${sql.replace(' ', 'T')}Z`).getTime() + DESPLAZAMIENTO_MS).toISOString();
  return { iso: `${local.slice(0, 19)}${SUFIJO}`, local: local.slice(0, 16) };
}

/** Ahora, en UTC para la base. */
const ahoraUtc = () => aSql(new Date());

/** Suma días a un UTC de la base. @param {string} sql @param {number} dias */
const sumarDias = (sql, dias) => aSql(new Date(new Date(`${sql.replace(' ', 'T')}Z`).getTime() + dias * 86_400_000));

module.exports = { localAUtc, fechaAUtc, utcALocal, ahoraUtc, sumarDias };
