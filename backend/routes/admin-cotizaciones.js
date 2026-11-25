/**
 * Panel: conversación de WhatsApp e historial de una cotización (leads_chatbot).
 * Se monta en routes/admin.js bajo /api/admin/cotizaciones. Todo con requireAdmin.
 *
 *   GET  /:id/conversacion            mensajes, autores, archivos subidos y autor IntegraTech
 *   POST /:id/conversacion            sube un chat exportado (.txt o .zip, máx. 10 MB)
 *   PUT  /:id/autor                   { autor } elige cuál autor del chat es IntegraTech
 *   GET  /:id/conversacion/descarga   conversación en .txt con los datos del ticket arriba
 *   GET  /:id/historial               cambios de estado (quién y cuándo)
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { db, all, get } = require('../db');
const { requireAdmin } = require('../lib/auth');
const { leerChat } = require('../lib/chat-export');
const { extraerChat, ZipError } = require('../lib/zip');
const { CONVERSACIONES_DIR } = require('../config');

/** @typedef {import('../../shared/api-types').ConversacionCotizacion} ConversacionCotizacion */
/** @typedef {import('../../shared/api-types').MensajeCotizacion} MensajeCotizacion */
/** @typedef {import('../../shared/api-types').ArchivoConversacion} ArchivoConversacion */
/** @typedef {import('../../shared/api-types').SubidaConversacion} SubidaConversacion */
/** @typedef {import('../../shared/api-types').CambioEstado} CambioEstado */

const MAX_SUBIDA = 10 * 1024 * 1024;
/** Tope del texto descomprimido de un zip (evita bombas zip). */
const MAX_DESCOMPRIMIDO = 20 * 1024 * 1024;

const router = express.Router();
router.use(requireAdmin);

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SUBIDA, files: 1, fields: 0, parts: 2 },
});

/**
 * @typedef {{ id: number, nombre: string, telefono: string | null, tipo_servicio: string | null,
 *   alcance: string | null, plazo: string | null, presupuesto: string | null, estado: string,
 *   origen: string | null, fecha_creacion: string, autor_integratech: string | null }} Ticket
 */

/** Ticket de :id, o responde 404. @returns {Ticket | null} */
function ticketDe(/** @type {any} */ req, /** @type {any} */ res) {
  const id = Number(req.params.id);
  /** @type {Ticket | undefined} */
  const t = Number.isInteger(id) && id > 0 ? get('SELECT * FROM leads_chatbot WHERE id = ?', id) : undefined;
  if (!t) {
    res.status(404).json({ error: 'Cotización no encontrada' });
    return null;
  }
  return t;
}

/** @param {number} ticketId @returns {MensajeCotizacion[]} */
const mensajesDe = (ticketId) =>
  all('SELECT id, fecha_hora, autor, texto FROM mensajes_cotizacion WHERE ticket_id = ? ORDER BY fecha_hora, orden', ticketId);

/** @param {number} ticketId @returns {string[]} */
const autoresDe = (ticketId) =>
  all(
    'SELECT autor FROM mensajes_cotizacion WHERE ticket_id = ? AND autor IS NOT NULL GROUP BY autor ORDER BY MIN(fecha_hora), MIN(orden)',
    ticketId
  ).map((f) => /** @type {{ autor: string }} */ (f).autor);

/** @param {Ticket} t @returns {ConversacionCotizacion} */
function conversacion(t) {
  /** @type {ArchivoConversacion[]} */
  const archivos = all(
    `SELECT id, nombre_original, bytes, tenia_multimedia, lineas_no_reconocidas, mensajes_leidos, mensajes_nuevos, fecha
       FROM conversaciones_cotizacion WHERE ticket_id = ? ORDER BY id DESC`,
    t.id
  ).map((a) => ({ ...a, tenia_multimedia: Boolean(/** @type {any} */ (a).tenia_multimedia) }));
  return { autor_integratech: t.autor_integratech, autores: autoresDe(t.id), mensajes: mensajesDe(t.id), archivos };
}

router.get('/:id/conversacion', (req, res) => {
  const t = ticketDe(req, res);
  if (t) res.json(conversacion(t));
});

/**
 * Convierte el archivo subido en texto. Lanza Error con mensaje apto para el usuario.
 * @param {{ originalname: string, buffer: Buffer }} archivo
 * @returns {{ texto: string, tipo: 'txt' | 'zip', otrosArchivos: number }}
 */
function textoDelArchivo(archivo) {
  const ext = path.extname(archivo.originalname).toLowerCase();
  const esZip = archivo.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  /** @type {Buffer} */
  let bytes;
  let otrosArchivos = 0;
  if (ext === '.zip') {
    if (!esZip) throw new Error('El archivo .zip no es válido.');
    try {
      ({ texto: bytes, otrosArchivos } = extraerChat(archivo.buffer, { maxBytes: MAX_DESCOMPRIMIDO }));
    } catch (err) {
      throw new Error(err instanceof ZipError ? `${err.message}.` : 'El archivo .zip no es válido.');
    }
  } else if (ext === '.txt') {
    if (esZip) throw new Error('El archivo tiene extensión .txt pero es un zip.');
    bytes = archivo.buffer;
  } else {
    throw new Error('Solo se aceptan archivos .txt o .zip exportados de WhatsApp.');
  }
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('El chat no está en UTF-8: vuelve a exportarlo desde WhatsApp.');
  }
  if (texto.includes('\u0000')) throw new Error('El archivo no es un chat de texto.');
  return { texto, tipo: ext === '.zip' ? 'zip' : 'txt', otrosArchivos };
}

router.post('/:id/conversacion', (req, res, next) => {
  const t = ticketDe(req, res);
  if (!t) return;
  subida.single('archivo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return err.code === 'LIMIT_FILE_SIZE'
        ? res.status(413).json({ error: 'El archivo supera los 10 MB.' })
        : res.status(400).json({ error: 'Envía un solo archivo en el campo "archivo".' });
    }
    if (err) return next(err);
    const archivo = /** @type {any} */ (req).file;
    if (!archivo) return res.status(400).json({ error: 'Falta el archivo.' });

    let leido;
    try {
      leido = textoDelArchivo(archivo);
    } catch (e) {
      return res.status(400).json({ error: /** @type {Error} */ (e).message });
    }
    const chat = leerChat(leido.texto);
    if (chat.mensajes.length === 0) {
      return res.status(422).json({ error: 'No se reconoció ningún mensaje de WhatsApp en el archivo.' });
    }

    // Original en disco con nombre aleatorio (nunca el nombre que trae el archivo).
    fs.mkdirSync(CONVERSACIONES_DIR, { recursive: true });
    const nombreDisco = `${crypto.randomUUID()}.${leido.tipo}`;
    const rutaDisco = path.join(CONVERSACIONES_DIR, nombreDisco);
    fs.writeFileSync(rutaDisco, archivo.buffer, { flag: 'wx' });

    const teniaMultimedia = leido.otrosArchivos > 0 || chat.multimediaReferenciada;
    let nuevos = 0;
    try {
      db.exec('BEGIN');
      /** @type {{ m: number | null } | undefined} */
      const max = get('SELECT MAX(orden) AS m FROM mensajes_cotizacion WHERE ticket_id = ?', t.id);
      const base = (max?.m ?? 0) + 1;
      const insertar = db.prepare(
        `INSERT OR IGNORE INTO mensajes_cotizacion (ticket_id, fecha_hora, autor, texto, orden, ocurrencia)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      /** @type {Map<string, number>} */
      const vistos = new Map();
      chat.mensajes.forEach((m, i) => {
        // Mensajes idénticos dentro del mismo archivo (fecha + autor + texto) se numeran.
        const clave = JSON.stringify([m.fecha_hora, m.autor, m.texto]);
        const ocurrencia = (vistos.get(clave) ?? 0) + 1;
        vistos.set(clave, ocurrencia);
        nuevos += Number(insertar.run(t.id, m.fecha_hora, m.autor, m.texto, base + i, ocurrencia).changes);
      });
      db.prepare(
        `INSERT INTO conversaciones_cotizacion
           (ticket_id, archivo, nombre_original, bytes, tenia_multimedia, lineas_no_reconocidas, mensajes_leidos, mensajes_nuevos, admin_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        t.id,
        nombreDisco,
        String(archivo.originalname).slice(0, 255),
        archivo.size,
        teniaMultimedia ? 1 : 0,
        chat.noReconocidas,
        chat.mensajes.length,
        nuevos,
        /** @type {any} */ (req).admin.id
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      fs.rmSync(rutaDisco, { force: true });
      return next(e);
    }

    const autores = autoresDe(t.id);
    /** @type {SubidaConversacion} */
    const respuesta = {
      mensajes_leidos: chat.mensajes.length,
      mensajes_nuevos: nuevos,
      lineas_no_reconocidas: chat.noReconocidas,
      tenia_multimedia: teniaMultimedia,
      necesita_autor: !t.autor_integratech || !autores.includes(t.autor_integratech),
      conversacion: conversacion(t),
    };
    res.status(201).json(respuesta);
  });
});

router.put('/:id/autor', (req, res) => {
  const t = ticketDe(req, res);
  if (!t) return;
  const autor = req.body?.autor;
  if (typeof autor !== 'string' || !autoresDe(t.id).includes(autor)) {
    return res.status(400).json({ error: 'Elige uno de los autores de la conversación.' });
  }
  db.prepare("UPDATE leads_chatbot SET autor_integratech = ?, fecha_actualizacion = datetime('now') WHERE id = ?").run(autor, t.id);
  res.json(conversacion({ ...t, autor_integratech: autor }));
});

/** 'YYYY-MM-DD HH:MM:SS' (UTC) → 'DD/MM/YYYY HH:MM' en hora de El Salvador (UTC-6). */
function fechaLocal(/** @type {string} */ utc) {
  const d = new Date(Date.parse(`${utc.replace(' ', 'T')}Z`) - 6 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`;
}
/** 'YYYY-MM-DD HH:MM:SS' tal cual (hora del chat) → 'DD/MM/YYYY HH:MM'. */
/** Etiquetas de estado tal como se ven en el panel. */
const ETIQUETA_ESTADO = /** @type {Record<string, string>} */ ({
  nuevo: 'Nuevo',
  contactado: 'En proceso',
  cotizado: 'Cotizado',
  cerrado: 'Cerrado',
  descartado: 'Descartado',
});
const fechaChat = (/** @type {string} */ s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}`;

router.get('/:id/conversacion/descarga', (req, res) => {
  const t = ticketDe(req, res);
  if (!t) return;
  const mensajes = mensajesDe(t.id);
  const linea = '─'.repeat(48);
  const texto = [
    `Cotización #${t.id} — IntegraTech`,
    linea,
    `Cliente:          ${t.nombre}`,
    `WhatsApp:         ${t.telefono ? `+${t.telefono.replace(/\D/g, '')}` : '-'}`,
    `Tipo de proyecto: ${t.tipo_servicio ?? '-'}`,
    `Presupuesto:      ${t.presupuesto ?? '-'}`,
    `Fecha deseada:    ${t.plazo ?? '-'}`,
    `Estado:           ${ETIQUETA_ESTADO[t.estado] ?? t.estado}`,
    `Creada:           ${fechaLocal(t.fecha_creacion)} (hora de El Salvador)`,
    '',
    'Descripción:',
    t.alcance ?? '-',
    linea,
    `Conversación (${mensajes.length} mensajes)${t.autor_integratech ? ` · IntegraTech = ${t.autor_integratech}` : ''}`,
    '',
    ...mensajes.map((m) => `[${fechaChat(m.fecha_hora)}] ${m.autor ? `${m.autor}: ` : ''}${m.texto}`),
    '',
  ].join('\n');
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="cotizacion-${t.id}.txt"`,
  });
  res.send(texto);
});

router.get('/:id/historial', (req, res) => {
  const t = ticketDe(req, res);
  if (!t) return;
  /** @type {CambioEstado[]} */
  const historial = all(
    'SELECT estado_anterior, estado_nuevo, admin_correo, fecha FROM historial_cotizacion WHERE ticket_id = ? ORDER BY id DESC',
    t.id
  );
  res.json(historial);
});

module.exports = router;
