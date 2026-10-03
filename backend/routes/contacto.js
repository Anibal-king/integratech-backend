const express = require('express');
const { db, all } = require('../db');
const { sendMail, escapeHtml: esc } = require('../lib/mailer');
const { rateLimit, campoTexto } = require('../lib/security');
const { requireAdmin } = require('../lib/auth');

/** @typedef {import('../../shared/api-types').ContactoRespuesta} ContactoRespuesta */

const router = express.Router();

// Longitud máxima de cada campo del formulario
const MAX = { nombre: 120, correo: 200, telefono: 40, empresa: 150, mensaje: 5000 };

/** @param {Record<string, string>} m */
function resumenTexto(m) {
  return [
    `Nuevo mensaje del formulario de contacto del sitio web`,
    ``,
    `Nombre   : ${m.nombre}`,
    `Empresa  : ${m.empresa || '-'}`,
    `Correo   : ${m.correo || '-'}`,
    `Teléfono : ${m.telefono || '-'}`,
    ``,
    `Mensaje:`,
    m.mensaje,
    ``,
    `Recibido: ${new Date().toLocaleString('es-SV')}`,
  ].join('\n');
}

/** @param {Record<string, string>} m */
function resumenHtml(m) {
  const fila = (/** @type {string} */ k, /** @type {string} */ v) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#5b6b7c;">${esc(k)}</td><td style="padding:4px 0;"><strong>${esc(v || '-')}</strong></td></tr>`;
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a2733;">
    <h2 style="color:#0b2a4a;margin:0 0 4px;">Nuevo mensaje de contacto</h2>
    <p style="margin:0 0 16px;color:#5b6b7c;">Enviado desde el formulario del sitio web IntegraTech.</p>
    <table style="border-collapse:collapse;font-size:14px;">
      ${fila('Nombre', m.nombre)}
      ${fila('Empresa', m.empresa)}
      ${fila('Correo', m.correo)}
      ${fila('Teléfono', m.telefono)}
    </table>
    <p style="margin:16px 0 4px;color:#0b2a4a;"><strong>Mensaje</strong></p>
    <p style="margin:0;white-space:pre-wrap;font-size:14px;">${esc(m.mensaje)}</p>
    <p style="margin:16px 0 0;color:#8a99a8;font-size:12px;">Recibido: ${esc(new Date().toLocaleString('es-SV'))}</p>
  </div>`;
}

// POST /api/contacto - Recibe mensajes desde el formulario de contacto del sitio
router.post('/', rateLimit({ max: 5, ventanaMs: 10 * 60 * 1000 }), async (req, res, next) => {
  try {
    const body = req.body ?? {};
    /** @type {Record<string, string>} */
    const datos = {};
    for (const [campo, max] of Object.entries(MAX)) {
      const valor = campoTexto(body[campo], max);
      if (valor === null) return res.status(400).json({ error: `El campo "${campo}" supera los ${max} caracteres.` });
      datos[campo] = valor;
    }
    const { nombre, correo, telefono, empresa, mensaje } = datos;
    if (!nombre || !mensaje) {
      return res.status(400).json({ error: 'Los campos "nombre" y "mensaje" son obligatorios.' });
    }
    if (!correo && !telefono) {
      return res.status(400).json({ error: 'Déjanos un correo o un teléfono para poder responderte.' });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
    }
    if (telefono && telefono.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ error: 'El teléfono debe tener al menos 7 dígitos.' });
    }

    // 1) Persistencia primero: el mensaje no se pierde aunque falle el correo
    const info = db.prepare(`
      INSERT INTO mensajes_contacto (nombre, correo, telefono, empresa, mensaje)
      VALUES (?, ?, ?, ?, ?)
    `).run(nombre, correo || null, telefono || null, empresa || null, mensaje);

    // 2) Notificación por correo (si SMTP está configurado)
    let correoEnviado = false;
    try {
      const r = await sendMail({
        subject: `Contacto web — ${nombre}${empresa ? ` (${empresa})` : ''}`,
        text: resumenTexto(datos),
        html: resumenHtml(datos),
        replyTo: correo || undefined,
      });
      correoEnviado = r.sent;
      if (!r.sent) console.warn('[contacto] correo no enviado:', r.reason);
    } catch (mailErr) {
      console.error('[contacto] error al enviar correo:', /** @type {Error} */ (mailErr).message);
    }

    /** @type {ContactoRespuesta} */
    const respuesta = { ok: true, id: Number(info.lastInsertRowid), emailSent: correoEnviado };
    res.status(201).json(respuesta);
  } catch (err) {
    next(err);
  }
});

// GET /api/contacto - (administrativo, requiere sesión del panel) Lista los mensajes recibidos
router.get('/', requireAdmin, (req, res) => {
  res.json(all('SELECT * FROM mensajes_contacto ORDER BY fecha_creacion DESC'));
});

module.exports = router;
