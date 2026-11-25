/**
 * Lector de chats exportados desde WhatsApp ("Exportar chat → Sin archivos").
 *
 * Formatos soportados (Android e iPhone, en español; 12 h o 24 h; año de 2 o 4 dígitos):
 *   Android: 24/11/26, 9:30 p. m. - Ana: Hola, quiero cotizar
 *   iPhone:  [24/11/26, 9:30:12 p. m.] Ana: Hola, quiero cotizar
 *
 * Reglas:
 *  - Una línea sin fecha pertenece al mensaje anterior (mensajes de varias líneas).
 *  - Mensaje sin "Autor: " = mensaje del sistema (autor null).
 *  - Se quitan las marcas de dirección invisibles (‎, ‏, ‪-‮,
 *    ⁦-⁩, BOM) y los espacios especiales ( ,  ) pasan a espacio normal.
 *  - Una línea que empieza como fecha pero no se entiende (p. ej. 32/13/26) no
 *    rompe la lectura: se pega al mensaje anterior y se cuenta en `noReconocidas`.
 *    Las líneas anteriores al primer mensaje también se cuentan (no hay a qué pegarlas).
 *
 * La fecha se guarda tal como viene en el archivo (hora del teléfono que exportó),
 * en formato 'YYYY-MM-DD HH:MM:SS'. Android no trae segundos: quedan en 00.
 */

/** @typedef {{ fecha_hora: string, autor: string | null, texto: string }} MensajeChat */
/**
 * @typedef {{
 *   mensajes: MensajeChat[],
 *   autores: string[],
 *   noReconocidas: number,
 *   multimediaReferenciada: boolean,
 * }} ChatLeido
 */

const INVISIBLES = /[​‎‏‪-‮⁦-⁩﻿]/g;
const ESPACIOS = /[   ]/g;

const FECHA = String.raw`(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})`;
// "9:30", "21:30", "9:30:12", con "a. m." / "p. m." / "a.m." / "AM" / "pm" opcional.
const HORA = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?`;

const RE_IPHONE = new RegExp(String.raw`^\[${FECHA},?\s+${HORA}\]\s?(.*)$`, 'i');
const RE_ANDROID = new RegExp(String.raw`^${FECHA},?\s+${HORA}\s+[-–]\s(.*)$`, 'i');
/** Línea que parece empezar con fecha (para distinguir "rara" de "continuación"). */
const RE_PARECE_FECHA = /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/;
/** "Autor: texto". El autor no lleva ":" ni saltos y tiene un largo razonable. */
const RE_AUTOR = /^([^:\n]{1,80}?):(?: |$)([\s\S]*)$/;

/** Avisos de iPhone que llegan con el nombre del chat como autor. */
const SISTEMA_IPHONE =
  /cifrados de extremo a extremo|creó (el grupo|este grupo)|te añadió|añadió a|cambió (el asunto|la descripción|el ícono|este grupo)|salió del grupo|eliminó a|se unió|cambió su número|mensajes temporales/i;

const MULTIMEDIA = /<Multimedia omitido>|\(archivo adjunto\)|<adjunto:|(imagen|audio|video|sticker|GIF|documento) omitid[oa]/i;

/** @param {string} s */
const limpiar = (s) => s.replace(INVISIBLES, '').replace(ESPACIOS, ' ');

const dos = (/** @type {number} */ n) => String(n).padStart(2, '0');

/**
 * Convierte las partes de fecha y hora a 'YYYY-MM-DD HH:MM:SS', o null si no son válidas.
 * El orden es día/mes (exportaciones en español); si el "mes" pasa de 12 se
 * interpreta como mes/día (teléfono configurado en inglés de EE. UU.).
 * @param {string[]} p [d1, d2, año, hora, min, seg, ampm]
 */
function aFechaHora([a, b, y, h, mi, s, ampm]) {
  let dia = Number(a);
  let mes = Number(b);
  if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia];
  const anio = y.length === 2 ? 2000 + Number(y) : Number(y);
  let hora = Number(h);
  const min = Number(mi);
  const seg = s ? Number(s) : 0;
  if (ampm) {
    if (hora < 1 || hora > 12) return null;
    const pm = ampm.toLowerCase() === 'p';
    if (hora === 12) hora = pm ? 12 : 0;
    else if (pm) hora += 12;
  }
  if (mes < 1 || mes > 12 || dia < 1 || hora > 23 || min > 59 || seg > 59) return null;
  // Rechaza 31/02, 31/04, etc.
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return `${anio}-${dos(mes)}-${dos(dia)} ${dos(hora)}:${dos(min)}:${dos(seg)}`;
}

/**
 * Lee el texto de un chat exportado.
 * @param {string} contenido
 * @returns {ChatLeido}
 */
function leerChat(contenido) {
  const lineas = contenido.replace(/\r\n?/g, '\n').split('\n');
  /** @type {MensajeChat[]} */
  const mensajes = [];
  let noReconocidas = 0;
  let multimediaReferenciada = false;

  for (const cruda of lineas) {
    const linea = limpiar(cruda);
    const mIphone = RE_IPHONE.exec(linea);
    const m = mIphone ?? RE_ANDROID.exec(linea);
    const fechaHora = m ? aFechaHora(m.slice(1, 8)) : null;

    if (!m || !fechaHora) {
      const rara = (m !== null && !fechaHora) || RE_PARECE_FECHA.test(linea.trim());
      const anterior = mensajes[mensajes.length - 1];
      if (!anterior) {
        // Antes del primer mensaje: no hay a qué pegarla (las líneas en blanco no cuentan).
        if (linea.trim()) noReconocidas += 1;
        continue;
      }
      if (rara) noReconocidas += 1;
      anterior.texto += `\n${linea}`;
      continue;
    }

    const resto = m[8];
    const a = RE_AUTOR.exec(resto);
    // iPhone pone los avisos del sistema con el nombre del chat como autor y los
    // marca con ‎ (igual que los adjuntos): se reconocen por la marca + el texto.
    const esSistemaIphone =
      mIphone !== null && a !== null && cruda.slice(cruda.indexOf(']')).includes('‎') && SISTEMA_IPHONE.test(a[2]);

    const autor = a && !esSistemaIphone ? a[1].trim() : null;
    const texto = a ? a[2] : resto;
    if (MULTIMEDIA.test(texto)) multimediaReferenciada = true;
    mensajes.push({ fecha_hora: fechaHora, autor, texto });
  }

  for (const msg of mensajes) msg.texto = msg.texto.replace(/\s+$/, '');
  const autores = [...new Set(mensajes.map((x) => x.autor).filter((x) => x !== null))];
  return { mensajes, autores: /** @type {string[]} */ (autores), noReconocidas, multimediaReferenciada };
}

module.exports = { leerChat };
