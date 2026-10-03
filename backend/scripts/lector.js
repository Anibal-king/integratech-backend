// Lectura de respuestas en la terminal para los scripts de administración.
const readline = require('node:readline');
const { MIN_PASSWORD } = require('../lib/auth');

/** Lector de líneas: en una terminal oculta lo escrito si `oculto`; si stdin es un pipe, lee línea a línea. */
function crearLector() {
  const tty = Boolean(process.stdin.isTTY);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  /** @type {string[]} */
  const pendientes = [];
  /** @type {((l: string) => void) | null} */
  let esperando = null;
  let cerrado = false;
  rl.on('line', (l) => (esperando ? (esperando(l), (esperando = null)) : pendientes.push(l)));
  rl.on('close', () => {
    cerrado = true;
    if (esperando) esperando('');
  });

  let silenciar = false;
  if (tty) {
    // Sustituye el eco de cada tecla mientras se escribe la contraseña.
    const escribir = /** @type {any} */ (rl)._writeToOutput.bind(rl);
    /** @type {any} */ (rl)._writeToOutput = (/** @type {string} */ s) => {
      if (!silenciar || s.includes('\n')) escribir(silenciar ? '\n' : s);
    };
  }

  return {
    /** @param {string} pregunta @param {boolean} [oculto] @returns {Promise<string>} */
    preguntar(pregunta, oculto = false) {
      process.stdout.write(pregunta);
      silenciar = tty && oculto;
      return new Promise((resolve) => {
        const fin = (/** @type {string} */ l) => {
          silenciar = false;
          if (!tty) process.stdout.write('\n');
          resolve(l);
        };
        if (pendientes.length) fin(/** @type {string} */ (pendientes.shift()));
        else if (cerrado) fin('');
        else esperando = fin;
      });
    },
    cerrar: () => rl.close(),
  };
}

/**
 * Pide una contraseña nueva dos veces (oculta) y la valida. Lanza con un mensaje
 * apto para la terminal si no cumple.
 * @param {ReturnType<typeof crearLector>} lector
 * @returns {Promise<string>}
 */
async function pedirPasswordNueva(lector) {
  const password = await lector.preguntar(`Contraseña (mínimo ${MIN_PASSWORD} caracteres): `, true);
  if (password.length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  if (password.length > 200) throw new Error('La contraseña no puede superar los 200 caracteres.');
  const repetida = await lector.preguntar('Repite la contraseña: ', true);
  if (password !== repetida) throw new Error('Las contraseñas no coinciden.');
  return password;
}

module.exports = { crearLector, pedirPasswordNueva };
