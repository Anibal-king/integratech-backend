const express = require('express');
const { db, all } = require('../db');
const { sendMail, escapeHtml: esc } = require('../lib/mailer');
const { requireAdmin, rateLimit, campoTexto } = require('../lib/security');

// Longitud máxima de cada campo del lead
const MAX = { tipo_servicio: 120, alcance: 3000, ubicacion: 200, plazo: 60, nombre: 120, empresa: 150, correo: 200, telefono: 40 };

const router = express.Router();

function resumenTexto(lead) {
  return [
    `Nuevo lead de cotización (chatbot del sitio web)`,
    ``,
    `Tipo de servicio : ${lead.tipo_servicio || '-'}`,
    `Alcance          : ${lead.alcance || '-'}`,
    `Ubicación        : ${lead.ubicacion || '-'}`,
    `Plazo estimado   : ${lead.plazo || '-'}`,
    ``,
    `Contacto`,
    `  Nombre   : ${lead.nombre || '-'}`,
    `  Empresa  : ${lead.empresa || '-'}`,
    `  Correo   : ${lead.correo || '-'}`,
    `  Teléfono : ${lead.telefono || '-'}`,
    ``,
    `Recibido: ${new Date().toLocaleString('es-SV')}`,
  ].join('\n');
}

function resumenHtml(lead) {
  const fila = (k, v) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#5b6b7c;">${esc(k)}</td><td style="padding:4px 0;"><strong>${esc(v || '-')}</strong></td></tr>`;
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a2733;">
    <h2 style="color:#0b2a4a;margin:0 0 4px;">Nuevo lead de cotización</h2>
    <p style="margin:0 0 16px;color:#5b6b7c;">Capturado por el chatbot del sitio web IntegraTech.</p>
    <table style="border-collapse:collapse;font-size:14px;">
      ${fila('Tipo de servicio', lead.tipo_servicio)}
      ${fila('Alcance', lead.alcance)}
      ${fila('Ubicación', lead.ubicacion)}
      ${fila('Plazo estimado', lead.plazo)}
      <tr><td colspan="2" style="padding:10px 0 2px;color:#0b2a4a;"><strong>Contacto</strong></td></tr>
      ${fila('Nombre', lead.nombre)}
      ${fila('Empresa', lead.empresa)}
      ${fila('Correo', lead.correo)}
      ${fila('Teléfono', lead.telefono)}
    </table>
    <p style="margin:16px 0 0;color:#8a99a8;font-size:12px;">Recibido: ${esc(new Date().toLocaleString('es-SV'))}</p>
  </div>`;
}

/**
 * POST /api/lead-chatbot
 * Body: { tipo_servicio, alcance, ubicacion, plazo, nombre, empresa, correo, telefono, origen? }
 * Guarda el lead y notifica por correo al cliente (si SMTP está configurado).
 */
router.post('/', rateLimit({ max: 5, ventanaMs: 10 * 60 * 1000 }), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    /** @type {Record<string, string>} */
    const d = {};
    for (const [campo, max] of Object.entries(MAX)) {
      const valor = campoTexto(b[campo], max);
      if (valor === null) return res.status(400).json({ error: `El campo "${campo}" supera los ${max} caracteres.` });
      d[campo] = valor;
    }
    const { nombre, correo, telefono } = d;

    if (!nombre) {
      return res.status(400).json({ error: 'El campo "nombre" es obligatorio.' });
    }
    if (!correo && !telefono) {
      return res.status(400).json({ error: 'Se requiere al menos un dato de contacto (correo o teléfono).' });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
    }

    const lead = {
      tipo_servicio: d.tipo_servicio || null,
      alcance: d.alcance || null,
      ubicacion: d.ubicacion || null,
      plazo: d.plazo || null,
      nombre,
      empresa: d.empresa || null,
      correo: correo || null,
      telefono: telefono || null,
      origen: b.origen === 'whatsapp' ? 'whatsapp' : 'chatbot',
    };

    // 1) Notificación por correo (no bloquea el guardado si falla)
    let correoEnviado = false;
    try {
      const r = await sendMail({
        subject: `Cotización — ${lead.tipo_servicio || 'Consulta'} (${lead.nombre})`,
        text: resumenTexto(lead),
        html: resumenHtml(lead),
        replyTo: lead.correo || undefined,
      });
      correoEnviado = r.sent;
      if (!r.sent) console.warn('[lead-chatbot] correo no enviado:', r.reason);
    } catch (mailErr) {
      console.error('[lead-chatbot] error al enviar correo:', /** @type {Error} */ (mailErr).message);
    }

    // 2) Persistencia
    const info = db
      .prepare(
        `INSERT INTO leads_chatbot
           (tipo_servicio, alcance, ubicacion, plazo, nombre, empresa, correo, telefono, origen, correo_enviado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        lead.tipo_servicio,
        lead.alcance,
        lead.ubicacion,
        lead.plazo,
        lead.nombre,
        lead.empresa,
        lead.correo,
        lead.telefono,
        lead.origen,
        correoEnviado ? 1 : 0
      );

    res.status(201).json({
      ok: true,
      id: Number(info.lastInsertRowid),
      emailSent: correoEnviado,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/lead-chatbot  (administrativo, requiere ADMIN_TOKEN)
 * Lista los leads capturados, más recientes primero.
 */
router.get('/', requireAdmin, (req, res) => {
  res.json(all('SELECT * FROM leads_chatbot ORDER BY fecha_creacion DESC, id DESC'));
});

module.exports = router;
