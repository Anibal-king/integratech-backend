/**
 * Calendario de citas del panel (/api/admin/citas). Requiere sesión.
 * Se monta dentro de routes/admin.js, que ya valida el Origin.
 *
 * Las fechas viajan en hora de El Salvador ('YYYY-MM-DDTHH:MM') y se guardan en
 * UTC (lib/zona.js). Un traslape con otra cita programada no se guarda salvo que
 * el cliente lo confirme (confirmar_traslape: true): responde 409 con las citas
 * que se cruzan para que el panel muestre la advertencia.
 */
const express = require('express');
const { db, all, get } = require('../db');
const { requireAdmin } = require('../lib/auth');
const { localAUtc, fechaAUtc, utcALocal, ahoraUtc, sumarDias } = require('../lib/zona');

/** @typedef {import('../../shared/api-types').Cita} Cita */
/** @typedef {import('../../shared/api-types').EstadoCita} EstadoCita */

const router = express.Router();
router.use(requireAdmin);

const ESTADOS = /** @type {EstadoCita[]} */ (['programada', 'completada', 'cancelada']);
const TABLA_SOLICITUD = /** @type {const} */ ({ formulario: 'mensajes_contacto', chatbot: 'leads_chatbot' });
/** Duración máxima de una cita (instalaciones de varios días, pero no meses). */
const MAX_DIAS = 14;

const SELECT = `
  SELECT c.*, s.nombre AS servicio_nombre,
         CASE c.solicitud_origen
           WHEN 'formulario' THEN (SELECT nombre FROM mensajes_contacto WHERE id = c.solicitud_id)
           WHEN 'chatbot' THEN (SELECT nombre FROM leads_chatbot WHERE id = c.solicitud_id)
         END AS solicitud_nombre
    FROM citas c LEFT JOIN categorias_servicios s ON s.id = c.categoria_id`;

/**
 * @typedef {{ id: number, titulo: string, cliente: string | null, telefono: string | null, correo: string | null,
 *   categoria_id: number | null, servicio_nombre: string | null, solicitud_origen: 'formulario' | 'chatbot' | null,
 *   solicitud_id: number | null, solicitud_nombre: string | null, inicio: string, fin: string, lugar: string | null,
 *   notas: string | null, estado: EstadoCita, fecha_actualizacion: string | null }} FilaCita
 */

/** @param {FilaCita} f @returns {Cita} */
function aCita(f) {
  const ini = utcALocal(f.inicio);
  const fin = utcALocal(f.fin);
  return {
    id: f.id,
    titulo: f.titulo,
    cliente: f.cliente,
    telefono: f.telefono,
    correo: f.correo,
    servicio: f.categoria_id && f.servicio_nombre ? { id: f.categoria_id, nombre: f.servicio_nombre } : null,
    solicitud: f.solicitud_origen && f.solicitud_id ? { origen: f.solicitud_origen, id: f.solicitud_id, nombre: f.solicitud_nombre } : null,
    inicio: ini.iso,
    fin: fin.iso,
    inicio_local: ini.local,
    fin_local: fin.local,
    lugar: f.lugar,
    notas: f.notas,
    estado: f.estado,
    fecha_actualizacion: f.fecha_actualizacion,
  };
}

/** @param {number} id */
function buscar(id) {
  /** @type {FilaCita | undefined} */
  const f = get(`${SELECT} WHERE c.id = ?`, id);
  return f ? aCita(f) : null;
}

/** @param {unknown} v @param {number} max @returns {string | null | false} null = vacío, false = demasiado largo */
function opcional(v, max) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return t.length > max ? false : t || null;
}

/**
 * Valida el cuerpo de crear/editar.
 * @param {any} b
 * @param {{ estadoActual?: EstadoCita }} [opciones]
 */
function validar(b, { estadoActual } = {}) {
  /** @type {Record<string, string>} */
  const campos = {};
  const titulo = typeof b?.titulo === 'string' ? b.titulo.trim() : '';
  if (!titulo) campos.titulo = 'Escribe un título para la cita.';
  else if (titulo.length > 150) campos.titulo = 'El título no puede superar los 150 caracteres.';

  const cliente = opcional(b?.cliente, 150);
  if (cliente === false) campos.cliente = 'Máximo 150 caracteres.';
  const telefono = opcional(b?.telefono, 40);
  if (telefono === false) campos.telefono = 'Máximo 40 caracteres.';
  const correo = opcional(b?.correo, 200);
  if (correo === false) campos.correo = 'Máximo 200 caracteres.';
  else if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) campos.correo = 'El correo no tiene un formato válido.';
  const lugar = opcional(b?.lugar, 200);
  if (lugar === false) campos.lugar = 'Máximo 200 caracteres.';
  const notas = opcional(b?.notas, 5000);
  if (notas === false) campos.notas = 'Máximo 5000 caracteres.';

  const inicio = localAUtc(b?.inicio_local);
  const fin = localAUtc(b?.fin_local);
  if (!inicio) campos.inicio_local = 'Indica una fecha y hora de inicio válidas.';
  if (!fin) campos.fin_local = 'Indica una fecha y hora de fin válidas.';
  else if (inicio && fin <= inicio) campos.fin_local = 'La hora de fin debe ser posterior a la de inicio.';
  else if (inicio && fin > sumarDias(inicio, MAX_DIAS)) campos.fin_local = `Una cita no puede durar más de ${MAX_DIAS} días.`;

  let servicioId = null;
  if (b?.servicio_id !== undefined && b?.servicio_id !== null && b?.servicio_id !== '') {
    servicioId = Number(b.servicio_id);
    if (!Number.isInteger(servicioId) || !get('SELECT 1 AS x FROM categorias_servicios WHERE id = ?', servicioId)) {
      campos.servicio_id = 'El servicio seleccionado no existe.';
    }
  }

  /** @type {{ origen: 'formulario' | 'chatbot', id: number } | null} */
  let solicitud = null;
  if (b?.solicitud) {
    const origen = b.solicitud.origen;
    const id = Number(b.solicitud.id);
    if (!(origen in TABLA_SOLICITUD) || !Number.isInteger(id) || !get(`SELECT 1 AS x FROM ${TABLA_SOLICITUD[/** @type {'formulario' | 'chatbot'} */ (origen)]} WHERE id = ?`, id)) {
      campos.solicitud = 'La solicitud de origen no existe.';
    } else solicitud = { origen, id };
  }

  const estado = b?.estado ?? estadoActual ?? 'programada';
  if (!ESTADOS.includes(estado)) campos.estado = 'Estado no válido.';

  if (Object.keys(campos).length) return { campos };
  return {
    datos: {
      titulo,
      // Si alguno fuera false (demasiado largo) ya habría un error en `campos`.
      cliente: /** @type {string | null} */ (cliente),
      telefono: /** @type {string | null} */ (telefono),
      correo: /** @type {string | null} */ (correo),
      lugar: /** @type {string | null} */ (lugar),
      notas: /** @type {string | null} */ (notas),
      inicio: /** @type {string} */ (inicio),
      fin: /** @type {string} */ (fin),
      servicioId,
      solicitud,
      estado: /** @type {EstadoCita} */ (estado),
    },
  };
}

/**
 * Citas programadas que se cruzan con [inicio, fin) (las canceladas y completadas no cuentan).
 * @param {string} inicio @param {string} fin @param {number} [excluirId]
 */
function traslapes(inicio, fin, excluirId = 0) {
  /** @type {FilaCita[]} */
  const filas = all(
    `${SELECT} WHERE c.estado = 'programada' AND c.inicio < ? AND c.fin > ? AND c.id <> ? ORDER BY c.inicio`,
    fin,
    inicio,
    excluirId
  );
  return filas.map(aCita);
}

/**
 * Responde 409 si hay traslape y no se confirmó. @returns {boolean} true si respondió
 * @param {any} res @param {any} body @param {{ estado: EstadoCita, inicio: string, fin: string }} datos @param {number} [id]
 */
function frenarPorTraslape(res, body, datos, id) {
  if (datos.estado !== 'programada' || body?.confirmar_traslape === true) return false;
  const choques = traslapes(datos.inicio, datos.fin, id);
  if (choques.length === 0) return false;
  res.status(409).json({
    error: choques.length === 1 ? 'Esta cita se traslapa con otra cita programada.' : `Esta cita se traslapa con ${choques.length} citas programadas.`,
    traslapes: choques,
  });
  return true;
}

// GET /api/admin/citas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD  (días locales, ambos incluidos)
// Devuelve las citas que tocan el rango (también las que empiezan antes y terminan dentro).
router.get('/', (req, res) => {
  const desde = fechaAUtc(req.query.desde);
  const hastaDia = fechaAUtc(req.query.hasta);
  if (!desde || !hastaDia) return res.status(400).json({ error: 'Indica el rango con desde y hasta (YYYY-MM-DD).' });
  const hasta = sumarDias(hastaDia, 1); // fin del día "hasta"
  if (hasta <= desde) return res.status(400).json({ error: '"hasta" debe ser igual o posterior a "desde".' });
  if (hasta > sumarDias(desde, 62)) return res.status(400).json({ error: 'El rango puede ser de hasta 62 días.' });
  /** @type {FilaCita[]} */
  const filas = all(`${SELECT} WHERE c.inicio < ? AND c.fin > ? ORDER BY c.inicio, c.id`, hasta, desde);
  res.json(filas.map(aCita));
});

// GET /api/admin/citas/proximas?limite=5
router.get('/proximas', (req, res) => {
  const limite = Math.min(50, Math.max(1, Math.floor(Number(req.query.limite)) || 5));
  const ahora = ahoraUtc();
  /** @type {{ n: number } | undefined} */
  const semana = get("SELECT COUNT(*) AS n FROM citas WHERE estado = 'programada' AND fin > ? AND inicio < ?", ahora, sumarDias(ahora, 7));
  /** @type {FilaCita[]} */
  const filas = all(`${SELECT} WHERE c.estado = 'programada' AND c.fin > ? ORDER BY c.inicio, c.id LIMIT ?`, ahora, limite);
  res.json({ proximos_7_dias: semana?.n ?? 0, items: filas.map(aCita) });
});

// GET /api/admin/citas/:id
router.get('/:id', (req, res) => {
  const cita = buscar(Number(req.params.id));
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  res.json(cita);
});

// POST /api/admin/citas  Body: CitaDatos
router.post('/', (req, res) => {
  const { datos, campos } = validar(req.body);
  if (!datos) return res.status(400).json({ error: 'Revisa los campos marcados.', campos });
  if (frenarPorTraslape(res, req.body, datos)) return;
  const info = db
    .prepare(
      `INSERT INTO citas (titulo, cliente, telefono, correo, categoria_id, solicitud_origen, solicitud_id, inicio, fin, lugar, notas, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      datos.titulo, datos.cliente, datos.telefono, datos.correo, datos.servicioId,
      datos.solicitud?.origen ?? null, datos.solicitud?.id ?? null,
      datos.inicio, datos.fin, datos.lugar, datos.notas, datos.estado
    );
  res.status(201).json(buscar(Number(info.lastInsertRowid)));
});

// PUT /api/admin/citas/:id  Body: CitaDatos (reemplaza todos los campos)
router.put('/:id', (req, res) => {
  const actual = buscar(Number(req.params.id));
  if (!actual) return res.status(404).json({ error: 'Cita no encontrada' });
  const { datos, campos } = validar(req.body, { estadoActual: actual.estado });
  if (!datos) return res.status(400).json({ error: 'Revisa los campos marcados.', campos });
  if (frenarPorTraslape(res, req.body, datos, actual.id)) return;
  db.prepare(
    `UPDATE citas SET titulo = ?, cliente = ?, telefono = ?, correo = ?, categoria_id = ?, solicitud_origen = ?, solicitud_id = ?,
            inicio = ?, fin = ?, lugar = ?, notas = ?, estado = ?, fecha_actualizacion = datetime('now')
      WHERE id = ?`
  ).run(
    datos.titulo, datos.cliente, datos.telefono, datos.correo, datos.servicioId,
    datos.solicitud?.origen ?? null, datos.solicitud?.id ?? null,
    datos.inicio, datos.fin, datos.lugar, datos.notas, datos.estado, actual.id
  );
  res.json(buscar(actual.id));
});

// POST /api/admin/citas/:id/cancelar  (no se borra: queda en el historial como cancelada)
router.post('/:id/cancelar', (req, res) => {
  const actual = buscar(Number(req.params.id));
  if (!actual) return res.status(404).json({ error: 'Cita no encontrada' });
  if (actual.estado === 'cancelada') return res.json(actual);
  db.prepare("UPDATE citas SET estado = 'cancelada', fecha_actualizacion = datetime('now') WHERE id = ?").run(actual.id);
  res.json(buscar(actual.id));
});

module.exports = router;
