/**
 * Administración de servicios y sus fotos (/api/admin/servicios). Requiere sesión.
 * Se monta dentro de routes/admin.js, que ya valida el Origin.
 */
const express = require('express');
const multer = require('multer');
const { db, all, get } = require('../db');
const { requireAdmin } = require('../lib/auth');
const { listarServicios, obtenerServicio } = require('../lib/servicios');
const { guardarFoto, borrarFoto, leerAnchos, FotoInvalida, MAX_BYTES } = require('../lib/fotos');

/** @typedef {import('../../shared/api-types').ServicioAdmin} ServicioAdmin */

const router = express.Router();
router.use(requireAdmin);

const MAX_FOTOS_POR_ENVIO = 20;
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FOTOS_POR_ENVIO, fields: 5 },
});

// ---------- Utilidades ----------

/** Ejecuta fn dentro de una transacción. @template T @param {() => T} fn @returns {T} */
function transaccion(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** @param {number} id */
const tocar = (id) => db.prepare("UPDATE categorias_servicios SET fecha_actualizacion = datetime('now') WHERE id = ?").run(id);

/** Servicio de :id (incluye ocultos) o responde 404. @param {any} req @param {any} res */
function servicioDe(req, res) {
  const id = Number(req.params.id);
  const s = Number.isInteger(id) && id > 0 ? obtenerServicio(id, { soloPublicados: false }) : null;
  if (!s) res.status(404).json({ error: 'Servicio no encontrado' });
  return s;
}

/** @param {unknown} v */
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Valida el cuerpo de crear/editar. Devuelve los datos limpios o los errores por campo.
 * @param {any} body
 */
function validarDatos(body) {
  /** @type {Record<string, string>} */
  const campos = {};
  const nombre = texto(body?.nombre);
  const descripcion = texto(body?.descripcion);
  const larga = texto(body?.descripcion_larga);
  const itemsCrudos = Array.isArray(body?.items) ? body.items : null;
  const items = (itemsCrudos ?? []).map(texto).filter(Boolean);

  if (!nombre) campos.nombre = 'Escribe el título del servicio.';
  else if (nombre.length > 120) campos.nombre = 'El título no puede superar los 120 caracteres.';
  if (!descripcion) campos.descripcion = 'Escribe una descripción corta.';
  else if (descripcion.length > 300) campos.descripcion = 'La descripción corta no puede superar los 300 caracteres.';
  if (larga.length > 5000) campos.descripcion_larga = 'La descripción larga no puede superar los 5000 caracteres.';
  if (itemsCrudos === null || itemsCrudos.some((/** @type {unknown} */ i) => typeof i !== 'string')) campos.items = 'Los ítems deben ser una lista de textos.';
  else if (items.length > 50) campos.items = 'Máximo 50 ítems.';
  else if (items.some((i) => i.length > 200)) campos.items = 'Cada ítem puede tener hasta 200 caracteres.';
  if (typeof body?.publicado !== 'boolean') campos.publicado = 'Indica si el servicio está publicado.';

  return Object.keys(campos).length
    ? { campos }
    : { datos: { nombre, descripcion, descripcion_larga: larga || null, items, publicado: body.publicado } };
}

/** Responde 409 si el título ya lo usa otro servicio. @returns {boolean} true si respondió */
function tituloRepetido(res, nombre, exceptoId = 0) {
  if (get('SELECT 1 AS x FROM categorias_servicios WHERE nombre = ? COLLATE NOCASE AND id <> ?', nombre, exceptoId)) {
    res.status(409).json({ error: 'Revisa los campos marcados.', campos: { nombre: 'Ya existe un servicio con ese título.' } });
    return true;
  }
  return false;
}

/** @param {number} id @param {string[]} items */
function guardarItems(id, items) {
  db.prepare('DELETE FROM servicios WHERE categoria_id = ?').run(id);
  const ins = db.prepare('INSERT INTO servicios (categoria_id, nombre, orden) VALUES (?, ?, ?)');
  items.forEach((item, i) => ins.run(id, item, i));
}

/**
 * Valida que `ids` sea exactamente el conjunto `existentes` (en cualquier orden).
 * @param {unknown} ids @param {number[]} existentes
 */
function mismoConjunto(ids, existentes) {
  return (
    Array.isArray(ids) &&
    ids.length === existentes.length &&
    new Set(ids).size === ids.length &&
    ids.every((i) => existentes.includes(/** @type {number} */ (i)))
  );
}

// ---------- Servicios ----------

// GET /api/admin/servicios  Todos, incluidos los ocultos
router.get('/', (req, res) => {
  res.json(listarServicios({ soloPublicados: false }));
});

// PUT /api/admin/servicios/orden  Body: { ids: [3, 1, 2, ...] } (todos los servicios)
router.put('/orden', (req, res) => {
  /** @type {number[]} */
  const existentes = all('SELECT id FROM categorias_servicios').map((/** @type {{ id: number }} */ f) => f.id);
  if (!mismoConjunto(req.body?.ids, existentes)) {
    return res.status(400).json({ error: 'El orden debe incluir todos los servicios una sola vez.' });
  }
  const upd = db.prepare('UPDATE categorias_servicios SET orden = ? WHERE id = ?');
  transaccion(() => req.body.ids.forEach((/** @type {number} */ id, /** @type {number} */ i) => upd.run(i + 1, id)));
  res.json(listarServicios({ soloPublicados: false }));
});

// GET /api/admin/servicios/:id
router.get('/:id', (req, res) => {
  const s = servicioDe(req, res);
  if (s) res.json(s);
});

// POST /api/admin/servicios  Body: ServicioDatos
router.post('/', (req, res) => {
  const { datos, campos } = validarDatos(req.body);
  if (!datos) return res.status(400).json({ error: 'Revisa los campos marcados.', campos });
  if (tituloRepetido(res, datos.nombre)) return;

  const id = transaccion(() => {
    /** @type {{ n: number } | undefined} */
    const max = get('SELECT COALESCE(MAX(orden), 0) AS n FROM categorias_servicios');
    const info = db
      .prepare(
        "INSERT INTO categorias_servicios (nombre, descripcion, descripcion_larga, publicado, orden, fecha_actualizacion) VALUES (?, ?, ?, ?, ?, datetime('now'))"
      )
      .run(datos.nombre, datos.descripcion, datos.descripcion_larga, datos.publicado ? 1 : 0, (max?.n ?? 0) + 1);
    const nuevo = Number(info.lastInsertRowid);
    guardarItems(nuevo, datos.items);
    return nuevo;
  });
  res.status(201).json(obtenerServicio(id, { soloPublicados: false }));
});

// PUT /api/admin/servicios/:id  Body: ServicioDatos
router.put('/:id', (req, res) => {
  const s = servicioDe(req, res);
  if (!s) return;
  const { datos, campos } = validarDatos(req.body);
  if (!datos) return res.status(400).json({ error: 'Revisa los campos marcados.', campos });
  if (tituloRepetido(res, datos.nombre, s.id)) return;

  transaccion(() => {
    db.prepare(
      "UPDATE categorias_servicios SET nombre = ?, descripcion = ?, descripcion_larga = ?, publicado = ?, fecha_actualizacion = datetime('now') WHERE id = ?"
    ).run(datos.nombre, datos.descripcion, datos.descripcion_larga, datos.publicado ? 1 : 0, s.id);
    guardarItems(s.id, datos.items);
  });
  res.json(obtenerServicio(s.id, { soloPublicados: false }));
});

// DELETE /api/admin/servicios/:id  Borra el servicio, sus ítems, sus fotos y los archivos
router.delete('/:id', async (req, res) => {
  const s = servicioDe(req, res);
  if (!s) return;
  /** @type {{ archivo: string, anchos: string }[]} */
  const archivos = all('SELECT archivo, anchos FROM servicio_fotos WHERE categoria_id = ?', s.id);
  db.prepare('DELETE FROM categorias_servicios WHERE id = ?').run(s.id); // ítems y fotos: ON DELETE CASCADE
  await Promise.all(archivos.map((f) => borrarFoto(f.archivo, leerAnchos(f.anchos))));
  res.status(204).end();
});

// ---------- Fotos ----------

// POST /api/admin/servicios/:id/fotos  multipart, campo "fotos" (uno o varios archivos)
router.post('/:id/fotos', (req, res, next) => {
  subida.array('fotos', MAX_FOTOS_POR_ENVIO)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const mensajes = {
        LIMIT_FILE_SIZE: 'Cada foto puede pesar como máximo 8 MB.',
        LIMIT_FILE_COUNT: `Sube como máximo ${MAX_FOTOS_POR_ENVIO} fotos a la vez.`,
        LIMIT_UNEXPECTED_FILE: 'Envía las fotos en el campo "fotos".',
      };
      return res.status(400).json({ error: /** @type {Record<string, string>} */ (mensajes)[err.code] ?? 'No se pudo recibir el archivo.' });
    }
    if (err) return next(err);
    next();
  });
}, async (req, res) => {
  const s = servicioDe(req, res);
  if (!s) return;
  /** @type {{ originalname: string, buffer: Buffer }[]} */
  const archivos = req.files ?? [];
  if (archivos.length === 0) return res.status(400).json({ error: 'Selecciona al menos una foto.' });

  /** @type {{ archivo: string, error: string }[]} */
  const errores = [];
  let agregadas = 0;
  for (const f of archivos) {
    try {
      const foto = await guardarFoto(f.buffer);
      try {
        transaccion(() => {
          /** @type {{ n: number, portadas: number | null } | undefined} */
          const actual = get('SELECT COALESCE(MAX(orden), -1) + 1 AS n, SUM(es_portada) AS portadas FROM servicio_fotos WHERE categoria_id = ?', s.id);
          db.prepare(
            'INSERT INTO servicio_fotos (categoria_id, archivo, anchos, ancho, alto, alt, orden, es_portada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(s.id, foto.archivo, foto.anchos.join(','), foto.ancho, foto.alto, s.nombre, actual?.n ?? 0, actual?.portadas ? 0 : 1);
        });
      } catch (dbErr) {
        await borrarFoto(foto.archivo, foto.anchos); // no dejar archivos huérfanos
        throw dbErr;
      }
      agregadas++;
    } catch (err) {
      if (!(err instanceof FotoInvalida)) throw err;
      errores.push({ archivo: f.originalname.slice(0, 120), error: err.message });
    }
  }
  if (agregadas > 0) tocar(s.id);

  const servicio = obtenerServicio(s.id, { soloPublicados: false });
  if (agregadas === 0) {
    return res.status(400).json({ error: errores.length === 1 ? errores[0].error : 'Ninguna foto se pudo subir.', errores });
  }
  res.status(201).json({ servicio, errores });
});

/** Foto :fotoId del servicio :id, o responde 404. */
function fotoDe(req, res) {
  /** @type {{ id: number, categoria_id: number, archivo: string, anchos: string, es_portada: number } | undefined} */
  const f = get('SELECT id, categoria_id, archivo, anchos, es_portada FROM servicio_fotos WHERE id = ? AND categoria_id = ?', Number(req.params.fotoId), Number(req.params.id));
  if (!f) res.status(404).json({ error: 'Foto no encontrada' });
  return f;
}

// PUT /api/admin/servicios/:id/fotos/orden  Body: { ids: [...] } (todas las fotos del servicio)
router.put('/:id/fotos/orden', (req, res) => {
  const s = servicioDe(req, res);
  if (!s) return;
  if (!mismoConjunto(req.body?.ids, s.fotos.map((f) => f.id))) {
    return res.status(400).json({ error: 'El orden debe incluir todas las fotos del servicio una sola vez.' });
  }
  const upd = db.prepare('UPDATE servicio_fotos SET orden = ? WHERE id = ?');
  transaccion(() => {
    req.body.ids.forEach((/** @type {number} */ id, /** @type {number} */ i) => upd.run(i, id));
    tocar(s.id);
  });
  res.json(obtenerServicio(s.id, { soloPublicados: false }));
});

// PATCH /api/admin/servicios/:id/fotos/:fotoId  Body: { alt?, es_portada?: true }
router.patch('/:id/fotos/:fotoId', (req, res) => {
  const f = fotoDe(req, res);
  if (!f) return;
  const { alt, es_portada } = req.body ?? {};
  if (alt === undefined && es_portada === undefined) return res.status(400).json({ error: 'No hay cambios que guardar.' });
  if (alt !== undefined && (typeof alt !== 'string' || !alt.trim())) {
    return res.status(400).json({ error: 'Escribe un texto alternativo que describa la foto.' });
  }
  if (typeof alt === 'string' && alt.trim().length > 200) return res.status(400).json({ error: 'El texto alternativo puede tener hasta 200 caracteres.' });
  if (es_portada !== undefined && es_portada !== true) return res.status(400).json({ error: 'Para cambiar la portada, elige otra foto como portada.' });

  transaccion(() => {
    if (typeof alt === 'string') db.prepare('UPDATE servicio_fotos SET alt = ? WHERE id = ?').run(alt.trim(), f.id);
    if (es_portada) {
      db.prepare('UPDATE servicio_fotos SET es_portada = 0 WHERE categoria_id = ?').run(f.categoria_id);
      db.prepare('UPDATE servicio_fotos SET es_portada = 1 WHERE id = ?').run(f.id);
    }
    tocar(f.categoria_id);
  });
  res.json(obtenerServicio(f.categoria_id, { soloPublicados: false }));
});

// DELETE /api/admin/servicios/:id/fotos/:fotoId  Si era la portada, pasa a serlo la primera que quede
router.delete('/:id/fotos/:fotoId', async (req, res) => {
  const f = fotoDe(req, res);
  if (!f) return;
  transaccion(() => {
    db.prepare('DELETE FROM servicio_fotos WHERE id = ?').run(f.id);
    if (f.es_portada) {
      db.prepare(
        'UPDATE servicio_fotos SET es_portada = 1 WHERE id = (SELECT id FROM servicio_fotos WHERE categoria_id = ? ORDER BY orden, id LIMIT 1)'
      ).run(f.categoria_id);
    }
    tocar(f.categoria_id);
  });
  await borrarFoto(f.archivo, leerAnchos(f.anchos));
  res.json(obtenerServicio(f.categoria_id, { soloPublicados: false }));
});

module.exports = router;
