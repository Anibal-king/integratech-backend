/**
 * Datos del panel de administración: solicitudes unificadas (formulario de
 * contacto + chatbot) y estadísticas. Todo requiere sesión (requireAdmin).
 * Se monta dentro de routes/admin.js, bajo /api/admin.
 */
const express = require('express');
const { db, all, get, ESTADOS_SOLICITUD } = require('../db');
const { requireAdmin } = require('../lib/auth');

/** @typedef {import('../../shared/api-types').SolicitudAdmin} SolicitudAdmin */
/** @typedef {import('../../shared/api-types').SolicitudesPagina} SolicitudesPagina */
/** @typedef {import('../../shared/api-types').EstadisticasAdmin} EstadisticasAdmin */
/** @typedef {import('../../shared/api-types').EstadoSolicitud} EstadoSolicitud */
/** @typedef {import('../../shared/api-types').OrigenSolicitud} OrigenSolicitud */

const router = express.Router();
router.use(requireAdmin);

/** Tabla de cada origen. */
const TABLAS = /** @type {const} */ ({ formulario: 'mensajes_contacto', chatbot: 'leads_chatbot' });
const ORIGENES = /** @type {OrigenSolicitud[]} */ (Object.keys(TABLAS));

/**
 * Las fechas se guardan en UTC. El Salvador está en UTC-6 todo el año (sin
 * horario de verano): los meses de las estadísticas se cuentan en hora local.
 */
const LOCAL = "'-6 hours'";

// Vista unificada: mismas columnas para ambos orígenes.
const UNIFICADA = `
  SELECT 'formulario' AS origen, id, nombre, empresa, correo, telefono, mensaje,
         NULL AS tipo_servicio, NULL AS alcance, NULL AS ubicacion, NULL AS plazo,
         estado, notas, fecha_creacion, fecha_actualizacion
    FROM mensajes_contacto
  UNION ALL
  SELECT 'chatbot', id, nombre, empresa, correo, telefono, NULL,
         tipo_servicio, alcance, ubicacion, plazo,
         estado, notas, fecha_creacion, fecha_actualizacion
    FROM leads_chatbot`;

/**
 * @typedef {{ origen: OrigenSolicitud, id: number, nombre: string, empresa: string | null,
 *   correo: string | null, telefono: string | null, mensaje: string | null,
 *   tipo_servicio: string | null, alcance: string | null, ubicacion: string | null,
 *   plazo: string | null, estado: EstadoSolicitud, notas: string | null,
 *   fecha_creacion: string, fecha_actualizacion: string | null }} FilaUnificada
 */

/**
 * @param {FilaUnificada} f
 * @returns {SolicitudAdmin}
 */
function aSolicitud(f) {
  const chatbot = f.origen === 'chatbot';
  return {
    origen: f.origen,
    id: f.id,
    nombre: f.nombre,
    empresa: f.empresa,
    correo: f.correo,
    telefono: f.telefono,
    // El chatbot no tiene mensaje libre: se arma con sus respuestas.
    mensaje: chatbot
      ? [
          f.tipo_servicio && `Servicio: ${f.tipo_servicio}`,
          f.alcance && `Alcance: ${f.alcance}`,
          f.ubicacion && `Ubicación: ${f.ubicacion}`,
          f.plazo && `Plazo: ${f.plazo}`,
        ]
          .filter(Boolean)
          .join('\n')
      : (f.mensaje ?? ''),
    chatbot: chatbot
      ? { tipo_servicio: f.tipo_servicio, alcance: f.alcance, ubicacion: f.ubicacion, plazo: f.plazo }
      : null,
    estado: f.estado,
    notas: f.notas,
    fecha_creacion: f.fecha_creacion,
    fecha_actualizacion: f.fecha_actualizacion,
  };
}

/** @param {unknown} v */
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/** Escapa % y _ para usar el texto dentro de LIKE ... ESCAPE '\'. */
const patronLike = (/** @type {string} */ s) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// GET /api/admin/solicitudes?estado=&origen=&q=&pagina=1&por_pagina=20
router.get('/solicitudes', (req, res) => {
  const estado = texto(req.query.estado);
  const origen = texto(req.query.origen);
  const q = texto(req.query.q);
  const pagina = Math.max(1, Math.floor(Number(req.query.pagina)) || 1);
  const porPagina = Math.min(100, Math.max(1, Math.floor(Number(req.query.por_pagina)) || 20));

  if (estado && !ESTADOS_SOLICITUD.includes(/** @type {any} */ (estado))) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }
  if (origen && !ORIGENES.includes(/** @type {any} */ (origen))) {
    return res.status(400).json({ error: 'Origen no válido.' });
  }
  if (q.length > 100) return res.status(400).json({ error: 'La búsqueda es demasiado larga.' });

  /** @type {string[]} */
  const where = [];
  /** @type {(string | number)[]} */
  const params = [];
  if (estado) {
    where.push('estado = ?');
    params.push(estado);
  }
  if (origen) {
    where.push('origen = ?');
    params.push(origen);
  }
  if (q) {
    const campos = ['nombre', 'empresa', 'correo', 'telefono', 'mensaje', 'tipo_servicio', 'alcance', 'ubicacion', 'notas'];
    where.push(`(${campos.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    params.push(...campos.map(() => patronLike(q)));
  }
  const filtro = where.length ? `WHERE ${where.join(' AND ')}` : '';

  /** @type {{ n: number } | undefined} */
  const conteo = get(`WITH s AS (${UNIFICADA}) SELECT COUNT(*) AS n FROM s ${filtro}`, ...params);
  /** @type {FilaUnificada[]} */
  const filas = all(
    `WITH s AS (${UNIFICADA}) SELECT * FROM s ${filtro}
      ORDER BY fecha_creacion DESC, id DESC LIMIT ? OFFSET ?`,
    ...params,
    porPagina,
    (pagina - 1) * porPagina
  );

  /** @type {SolicitudesPagina} */
  const respuesta = { items: filas.map(aSolicitud), total: conteo?.n ?? 0, pagina, por_pagina: porPagina };
  res.json(respuesta);
});

/**
 * Valida :origen y :id. Devuelve la tabla o responde 404.
 * @param {any} req @param {any} res
 * @returns {{ tabla: string, origen: OrigenSolicitud, id: number } | null}
 */
function destino(req, res) {
  const origen = /** @type {OrigenSolicitud} */ (req.params.origen);
  const id = Number(req.params.id);
  if (!ORIGENES.includes(origen) || !Number.isInteger(id) || id < 1) {
    res.status(404).json({ error: 'Solicitud no encontrada' });
    return null;
  }
  return { tabla: TABLAS[origen], origen, id };
}

/** @param {OrigenSolicitud} origen @param {number} id */
function buscar(origen, id) {
  /** @type {FilaUnificada | undefined} */
  const fila = get(`WITH s AS (${UNIFICADA}) SELECT * FROM s WHERE origen = ? AND id = ?`, origen, id);
  return fila ? aSolicitud(fila) : null;
}

// GET /api/admin/solicitudes/:origen/:id
router.get('/solicitudes/:origen/:id', (req, res) => {
  const d = destino(req, res);
  if (!d) return;
  const solicitud = buscar(d.origen, d.id);
  if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json(solicitud);
});

// PATCH /api/admin/solicitudes/:origen/:id  Body: { estado?, notas? }
router.patch('/solicitudes/:origen/:id', (req, res) => {
  const d = destino(req, res);
  if (!d) return;
  const body = req.body ?? {};

  /** @type {string[]} */
  const sets = [];
  /** @type {(string | null)[]} */
  const params = [];
  if (body.estado !== undefined) {
    if (!ESTADOS_SOLICITUD.includes(body.estado)) return res.status(400).json({ error: 'Estado no válido.' });
    sets.push('estado = ?');
    params.push(body.estado);
  }
  if (body.notas !== undefined) {
    if (body.notas !== null && typeof body.notas !== 'string') return res.status(400).json({ error: 'Las notas deben ser texto.' });
    const notas = (body.notas ?? '').trim();
    if (notas.length > 5000) return res.status(400).json({ error: 'Las notas no pueden superar los 5000 caracteres.' });
    sets.push('notas = ?');
    params.push(notas || null);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });

  const r = db
    .prepare(`UPDATE ${d.tabla} SET ${sets.join(', ')}, fecha_actualizacion = datetime('now') WHERE id = ?`)
    .run(...params, d.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json(buscar(d.origen, d.id));
});

/** 'YYYY-MM' de los últimos `n` meses en hora de El Salvador, del más antiguo al actual. */
function ultimosMeses(n) {
  const ahora = new Date(Date.now() - 6 * 60 * 60 * 1000); // hora local expresada en UTC
  const meses = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  return meses;
}

// GET /api/admin/estadisticas
router.get('/estadisticas', (req, res) => {
  const mesLocal = `strftime('%Y-%m', fecha_creacion, ${LOCAL})`;
  const meses = ultimosMeses(6);
  const mesActual = meses[meses.length - 1];

  /** @type {{ estado: EstadoSolicitud, n: number }[]} */
  const porEstadoFilas = all(`WITH s AS (${UNIFICADA}) SELECT estado, COUNT(*) AS n FROM s GROUP BY estado`);
  const porEstado = /** @type {Record<EstadoSolicitud, number>} */ (
    Object.fromEntries(ESTADOS_SOLICITUD.map((e) => [e, porEstadoFilas.find((f) => f.estado === e)?.n ?? 0]))
  );

  /** @type {{ mes: string, origen: OrigenSolicitud, n: number }[]} */
  const porMesFilas = all(
    `WITH s AS (${UNIFICADA})
     SELECT ${mesLocal} AS mes, origen, COUNT(*) AS n FROM s
      WHERE ${mesLocal} >= ? GROUP BY mes, origen`,
    meses[0]
  );
  const porMes = meses.map((mes) => ({
    mes,
    formulario: porMesFilas.find((f) => f.mes === mes && f.origen === 'formulario')?.n ?? 0,
    chatbot: porMesFilas.find((f) => f.mes === mes && f.origen === 'chatbot')?.n ?? 0,
  }));

  const delMes = porMes[porMes.length - 1];
  /** @type {EstadisticasAdmin} */
  const respuesta = {
    total: Object.values(porEstado).reduce((a, b) => a + b, 0),
    sin_atender: porEstado.nuevo,
    mes_actual: { mes: mesActual, total: delMes.formulario + delMes.chatbot },
    por_mes: porMes,
    por_estado: porEstado,
  };
  res.json(respuesta);
});

module.exports = router;
