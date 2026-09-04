/**
 * Envío de correo por SMTP (nodemailer).
 *
 * Configuración por variables de entorno (ver backend/.env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *   MAIL_FROM      -> remitente ("IntegraTech <no-reply@dominio.com>")
 *   MAIL_TO_LEADS  -> destinatario de los leads (correo del cliente)
 *
 * Si SMTP no está configurado, sendMail() NO lanza: devuelve
 * { sent: false, reason: 'SMTP no configurado' } para que el endpoint
 * pueda seguir guardando el lead en la base de datos.
 */

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  // nodemailer aún no instalado: se maneja abajo.
}

const {
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO_LEADS,
} = process.env;

const smtpConfigurado = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
function getTransporter() {
  if (!nodemailer) return null;
  if (!smtpConfigurado) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * @param {{ to?: string, subject: string, text: string, html?: string, replyTo?: string }} opts
 * @returns {Promise<{ sent: boolean, reason?: string, id?: string }>}
 */
async function sendMail(opts) {
  const t = getTransporter();
  if (!t) {
    return {
      sent: false,
      reason: !nodemailer
        ? 'nodemailer no instalado (ejecuta: npm install)'
        : 'SMTP no configurado (define SMTP_HOST/SMTP_USER/SMTP_PASS en .env)',
    };
  }

  const info = await t.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to: opts.to || MAIL_TO_LEADS || SMTP_USER,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    replyTo: opts.replyTo,
  });

  return { sent: true, id: info.messageId };
}

module.exports = { sendMail, smtpConfigurado };
