/**
 * Lector mínimo de .zip para los chats exportados de WhatsApp, sin dependencias
 * (zlib de Node). Solo saca UN archivo de texto a memoria:
 *  - nunca escribe nada al disco ni usa las rutas que vienen dentro del zip;
 *  - limita la cantidad de entradas y el tamaño descomprimido (bombas zip);
 *  - no soporta zip cifrado ni ZIP64 (WhatsApp no los usa): esos casos dan error.
 *
 * Elige `_chat.txt` (iPhone); si no está, el único .txt del zip (Android:
 * "Chat de WhatsApp con Ana.txt"). Las demás entradas cuentan como multimedia.
 */
const zlib = require('node:zlib');

const FIN_DIRECTORIO = 0x06054b50;
const ENTRADA_DIRECTORIO = 0x02014b50;
const CABECERA_LOCAL = 0x04034b50;
const MAX_ENTRADAS = 5000;

class ZipError extends Error {}

/**
 * @param {Buffer} buf
 * @returns {{ offset: number, total: number }}
 */
function finDelDirectorio(buf) {
  // El registro final mide 22 bytes + comentario (máx. 65535).
  const desde = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= desde; i--) {
    if (buf.readUInt32LE(i) === FIN_DIRECTORIO) {
      const total = buf.readUInt16LE(i + 10);
      const offset = buf.readUInt32LE(i + 16);
      if (total === 0xffff || offset === 0xffffffff) throw new ZipError('ZIP64 no soportado');
      return { offset, total };
    }
  }
  throw new ZipError('No es un archivo zip válido');
}

/**
 * @typedef {{ nombre: string, metodo: number, comprimido: number, tamano: number,
 *   offsetLocal: number, cifrado: boolean, esCarpeta: boolean }} EntradaZip
 */

/** @param {Buffer} buf @returns {EntradaZip[]} */
function entradas(buf) {
  const { offset, total } = finDelDirectorio(buf);
  if (total > MAX_ENTRADAS) throw new ZipError('El zip tiene demasiados archivos');
  /** @type {EntradaZip[]} */
  const lista = [];
  let p = offset;
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== ENTRADA_DIRECTORIO) throw new ZipError('Directorio del zip dañado');
    const flags = buf.readUInt16LE(p + 8);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const nombre = buf.toString('utf8', p + 46, p + 46 + largoNombre);
    lista.push({
      nombre,
      metodo: buf.readUInt16LE(p + 10),
      comprimido: buf.readUInt32LE(p + 20),
      tamano: buf.readUInt32LE(p + 24),
      offsetLocal: buf.readUInt32LE(p + 42),
      cifrado: (flags & 1) === 1,
      esCarpeta: nombre.endsWith('/'),
    });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return lista;
}

/**
 * Descomprime una entrada en memoria, sin pasar de `maxBytes`.
 * @param {Buffer} buf @param {EntradaZip} e @param {number} maxBytes
 */
function leerEntrada(buf, e, maxBytes) {
  if (e.cifrado) throw new ZipError('El zip está protegido con contraseña');
  if (e.tamano > maxBytes) throw new ZipError('El chat descomprimido es demasiado grande');
  const p = e.offsetLocal;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== CABECERA_LOCAL) throw new ZipError('Entrada del zip dañada');
  const inicio = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const datos = buf.subarray(inicio, inicio + e.comprimido);
  if (datos.length !== e.comprimido) throw new ZipError('Entrada del zip incompleta');
  if (e.metodo === 0) return Buffer.from(datos);
  if (e.metodo !== 8) throw new ZipError('Compresión del zip no soportada');
  try {
    // maxOutputLength corta la descompresión aunque el tamaño declarado mienta.
    return zlib.inflateRawSync(datos, { maxOutputLength: maxBytes });
  } catch {
    throw new ZipError('El chat descomprimido es demasiado grande o está dañado');
  }
}

/** Último segmento de la ruta (solo para elegir la entrada; nunca se usa como ruta). */
const base = (/** @type {string} */ n) => n.split(/[\\/]/).pop() ?? '';

/**
 * Extrae el texto del chat de un zip exportado por WhatsApp.
 * @param {Buffer} buf
 * @param {{ maxBytes: number }} opciones
 * @returns {{ texto: Buffer, otrosArchivos: number }}
 */
function extraerChat(buf, { maxBytes }) {
  const archivos = entradas(buf).filter((e) => !e.esCarpeta && !base(e.nombre).startsWith('._') && !e.nombre.startsWith('__MACOSX/'));
  const txts = archivos.filter((e) => base(e.nombre).toLowerCase().endsWith('.txt'));
  const chat = txts.find((e) => base(e.nombre) === '_chat.txt') ?? (txts.length === 1 ? txts[0] : undefined);
  if (!chat) throw new ZipError('El zip no trae el texto del chat (_chat.txt)');
  return { texto: leerEntrada(buf, chat, maxBytes), otrosArchivos: archivos.length - 1 };
}

module.exports = { extraerChat, ZipError };
