/**
 * Fotos de los servicios: validación, versiones WebP y archivos en disco.
 *
 * - El tipo se decide por el contenido (sharp lee la cabecera), nunca por la
 *   extensión ni por el Content-Type que declara el navegador.
 * - Se corrige la orientación, se quitan los metadatos (EXIF/GPS) y se generan
 *   WebP en varios anchos, sin agrandar nunca la original.
 * - Los nombres los genera el servidor: UPLOADS_DIR/servicios/<archivo>-<ancho>.webp
 */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { UPLOADS_DIR } = require('../config');

/** Formatos aceptados según el contenido real del archivo. */
const FORMATOS = new Set(['jpeg', 'png', 'webp']);
const MAX_BYTES = 8 * 1024 * 1024;
/** Anchos estándar de las versiones; nunca se agranda la original. */
const ANCHOS = [400, 800, 1600];
/** Límite de píxeles al decodificar (evita imágenes que se descomprimen a tamaños enormes). */
const MAX_PIXELES = 50_000_000;

const CARPETA = 'servicios';
const DIR = path.join(UPLOADS_DIR, CARPETA);
/** Ruta pública con la que Express sirve UPLOADS_DIR. */
const URL_MEDIA = '/media';

/** Error de validación con mensaje apto para el usuario del panel. */
class FotoInvalida extends Error {}

/**
 * Procesa una imagen y guarda sus versiones WebP.
 * @param {Buffer} buffer contenido del archivo subido
 * @returns {Promise<{ archivo: string, anchos: number[], ancho: number, alto: number }>}
 */
async function guardarFoto(buffer) {
  if (buffer.length > MAX_BYTES) throw new FotoInvalida('La foto supera los 8 MB.');

  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_PIXELES }).metadata();
  } catch {
    throw new FotoInvalida('El archivo no es una imagen válida. Usa JPG, PNG o WebP.');
  }
  if (!meta.format || !FORMATOS.has(meta.format)) {
    throw new FotoInvalida('Formato no permitido. Usa JPG, PNG o WebP.');
  }
  if (!meta.width || !meta.height) throw new FotoInvalida('No se pudo leer el tamaño de la imagen.');

  // Ancho real tras corregir la orientación (EXIF 5-8 intercambia ancho y alto).
  const girada = (meta.orientation ?? 1) >= 5;
  const anchoOriginal = girada ? meta.height : meta.width;
  const altoOriginal = girada ? meta.width : meta.height;

  // Los tamaños estándar menores que la original, más la original (hasta el mayor estándar):
  // una foto de 623 px queda en 400 y 623; una de 3000 px, en 400, 800 y 1600.
  const tope = Math.min(anchoOriginal, ANCHOS[ANCHOS.length - 1]);
  const anchos = [...ANCHOS.filter((a) => a < tope), tope];

  const archivo = crypto.randomBytes(12).toString('hex');
  await fs.mkdir(DIR, { recursive: true });
  const escritos = [];
  try {
    for (const ancho of anchos) {
      const destino = rutaVersion(archivo, ancho);
      await sharp(buffer, { limitInputPixels: MAX_PIXELES })
        .rotate() // aplica la orientación EXIF; los metadatos no se copian a la salida
        .resize({ width: ancho, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(destino);
      escritos.push(destino);
    }
  } catch (err) {
    await Promise.all(escritos.map((f) => fs.rm(f, { force: true })));
    if (err instanceof FotoInvalida) throw err;
    console.error('[fotos] error al procesar la imagen:', err);
    throw new FotoInvalida('No se pudo procesar la imagen. Prueba con otro archivo.');
  }

  const mayor = anchos[anchos.length - 1];
  return { archivo, anchos, ancho: mayor, alto: Math.round((altoOriginal * mayor) / anchoOriginal) };
}

/** @param {string} archivo @param {number} ancho */
function rutaVersion(archivo, ancho) {
  if (!/^[a-f0-9]{24}$/.test(archivo)) throw new Error(`Nombre de archivo inválido: ${archivo}`);
  return path.join(DIR, `${archivo}-${ancho}.webp`);
}

/**
 * Borra todas las versiones de una foto (ignora las que ya no existan).
 * @param {string} archivo
 * @param {number[]} anchos
 */
async function borrarFoto(archivo, anchos) {
  await Promise.all(anchos.map((a) => fs.rm(rutaVersion(archivo, a), { force: true })));
}

/**
 * URLs públicas de una foto, relativas al backend (el frontend antepone la URL de la API).
 * @param {string} archivo
 * @param {number[]} anchos
 */
function urlsFoto(archivo, anchos) {
  const url = (/** @type {number} */ a) => `${URL_MEDIA}/${CARPETA}/${archivo}-${a}.webp`;
  return {
    // Para src (navegadores sin srcset): la menor versión de al menos 800 px, o la mayor.
    src: url(anchos.find((a) => a >= 800) ?? anchos[anchos.length - 1]),
    srcset: anchos.map((a) => `${url(a)} ${a}w`).join(', '),
  };
}

/** "400,800" → [400, 800] */
const leerAnchos = (/** @type {string} */ s) => s.split(',').map(Number).filter((n) => n > 0);

module.exports = { guardarFoto, borrarFoto, urlsFoto, leerAnchos, FotoInvalida, MAX_BYTES, URL_MEDIA };
