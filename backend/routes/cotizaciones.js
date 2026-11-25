/**
 * POST /api/cotizaciones — formulario público del botón de WhatsApp.
 *
 * Crea un ticket de cotización (leads_chatbot, origen 'whatsapp', estado 'nuevo')
 * y responde SOLO con su número: { ticket }. El navegador luego abre wa.me con
 * ese número en el mensaje; la conversación sigue en WhatsApp Business.
 *
 * Antispam: campo trampa oculto (`sitio_web`, los humanos lo dejan vacío) y
 * límite de envíos por IP. Validación estricta de tipo y largo de cada campo.
 */
const express = require('express');
const { db } = require('../db');
const { sendMail, escapeHtml: esc } = require('../lib/mailer');
const { rateLimit } = require('../lib/security');
const { MAIL_TO_COTIZACIONES } = require('../config');

/** @typedef {import('../../shared/api-types').CotizacionPayload} CotizacionPayload */
/** @typedef {import('../../shared/api-types').CotizacionRespuesta} CotizacionRespuesta */

const router = express.Router();

/** Largos máximos (y mínimos de los obligatorios). */
const LIMITES = {
  nombre: { min: 2, max: 120 },
  whatsapp: { min: 8, max: 20 },
  tipo_proyecto: { min: 0, max: 120 },
  descripcion: { min: 10, max: 2000 },
  presupuesto: { min: 0, max: 60 },
  fecha_deseada: { min: 0, max: 10 },
};
/** Nombre del campo trampa: invisible para las personas. */
const HONEYPOT = 'sitio_web';
const CODIGO_PAIS_DEFECTO = '503';

/**
 * Valida el cuerpo. Devuelve los datos limpios o un mensaje de error.
 * @param {unknown} cuerpo
 * @returns {{ ok: true, datos: Record<keyof typeof LIMITES, string> } | { ok: false, error: string }}
 */
function validar(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { ok: false, error: 'Solicitud inválida.' };
  const b = /** @type {Record<string, unknown>} */ (cuerpo);

  /** @type {Record<string, string>} */
  const d = {};
  for (const [campo, { min, max }] of Object.entries(LIMITES)) {
    const v = b[campo];
    if (v !== undefined && v !== null && typeof v !== 'string') return { ok: false, error: `El campo "${campo}" no es válido.` };
    // La descripción conserva sus saltos de línea; el resto se deja en una sola línea.
    const s = campo === 'descripcion' ? (v ?? '').trim() : (v ?? '').trim().replace(/\s+/g, ' ');
    if (s.length > max) return { ok: false, error: `El campo "${campo}" supera los ${max} caracteres.` };
    if (min > 0 && s.length < min) {
      return { ok: false, error: s ? `El campo "${campo}" es demasiado corto.` : `El campo "${campo}" es obligatorio.` };
    }
    d[campo] = s;
  }

  // WhatsApp: solo dígitos (se aceptan +, espacios y guiones al escribir).
  if (!/^\+?[\d\s()-]+$/.test(d.whatsapp)) return { ok: false, error: 'El WhatsApp solo puede llevar números.' };
  let wa = d.whatsapp.replace(/\D/g, '');
  if (wa.length === 8) wa = `${CODIGO_PAIS_DEFECTO}${wa}`; // número local de El Salvador
  if (wa.length < 10 || wa.length > 15) return { ok: false, error: 'Escribe el WhatsApp con código de país (ej. 503 7000 0000).' };
  d.whatsapp = wa;

  if (d.fecha_deseada) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.fecha_deseada);
    const f = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
    if (!m || !f || f.toISOString().slice(0, 10) !== d.fecha_deseada) return { ok: false, error: 'La fecha deseada no es válida.' };
  }
  return { ok: true, datos: /** @type {any} */ (d) };
}

/** @param {number} ticket @param {Record<string, string>} d */
function correoEncargado(ticket, d) {
  const filas = [
    ['Ticket', `#${ticket}`],
    ['Nombre', d.nombre],
    ['WhatsApp', `+${d.whatsapp}`],
    ['Tipo de proyecto', d.tipo_proyecto || '-'],
    ['Presupuesto', d.presupuesto || '-'],
    ['Fecha deseada', d.fecha_deseada || '-'],
  ];
  const text = [
    `Nueva cotización por WhatsApp (#${ticket})`,
    '',
    ...filas.map(([k, v]) => `${k.padEnd(17)}: ${v}`),
    '',
    'Descripción:',
    d.descripcion,
    '',
    'El cliente fue enviado a WhatsApp con el número de ticket. Atiéndelo desde WhatsApp Business',
    'y, al terminar, sube la conversación exportada al ticket en el panel.',
  ].join('\n');
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1a2733;">
    <h2 style="color:#0b2a4a;margin:0 0 12px;">Nueva cotización por WhatsApp #${ticket}</h2>
    <table style="border-collapse:collapse;font-size:14px;">
      ${filas.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b6b7c;">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join('')}
    </table>
    <p style="margin:16px 0 4px;"><strong>Descripción</strong></p>
    <p style="margin:0;white-space:pre-wrap;font-size:14px;">${esc(d.descripcion)}</p>
  </div>`;
  return { subject: `Cotización #${ticket} por WhatsApp — ${d.nombre}`, text, html };
}

router.post('/', rateLimit({ max: 5, ventanaMs: 10 * 60 * 1000 }), (req, res) => {
  const cuerpo = req.body ?? {};
  // Campo trampa lleno = bot. Respuesta genérica, sin pistas.
  if (cuerpo && typeof cuerpo === 'object' && cuerpo[HONEYPOT]) {
    return res.status(400).json({ error: 'Solicitud inválida.' });
  }
  const v = validar(cuerpo);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const d = v.datos;

  const info = db
    .prepare(
      `INSERT INTO leads_chatbot (tipo_servicio, alcance, plazo, presupuesto, nombre, telefono, origen, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', 'nuevo')`
    )
    .run(d.tipo_proyecto || null, d.descripcion, d.fecha_deseada || null, d.presupuesto || null, d.nombre, d.whatsapp);
  const ticket = Number(info.lastInsertRowid);

  /** @type {CotizacionRespuesta} */
  const respuesta = { ticket };
  res.status(201).json(respuesta);

  // Aviso por correo al encargado, después de responder (no hace esperar al visitante).
  const correo = correoEncargado(ticket, d);
  sendMail({ ...correo, to: MAIL_TO_COTIZACIONES || undefined })
    .then((r) => {
      if (r.sent) db.prepare('UPDATE leads_chatbot SET correo_enviado = 1 WHERE id = ?').run(ticket);
      else console.warn(`[cotizaciones] #${ticket}: correo no enviado (${r.reason})`);
    })
    .catch((err) => console.error(`[cotizaciones] #${ticket}: error al enviar correo:`, err.message));
});

module.exports = router;
module.exports.validar = validar;
