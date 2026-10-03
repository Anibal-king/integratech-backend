// npm run crear-admin — crea un usuario del panel de administración.
// Pide correo y contraseña (oculta, dos veces). No hay registro público ni
// usuarios por defecto: esta es la única forma de crear uno.
const readline = require('node:readline');
const { db, get, initSchema } = require('../db');
const { hashPassword } = require('../lib/auth');

const MIN_PASSWORD = 12;

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

async function main() {
  initSchema();
  const lector = crearLector();
  try {
    const correo = (await lector.preguntar('Correo del administrador: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 200) {
      throw new Error('El correo no tiene un formato válido.');
    }
    if (get('SELECT 1 AS x FROM admin_usuarios WHERE correo = ?', correo)) {
      throw new Error(`Ya existe un usuario con el correo ${correo}.`);
    }

    const password = await lector.preguntar(`Contraseña (mínimo ${MIN_PASSWORD} caracteres): `, true);
    if (password.length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (password.length > 200) throw new Error('La contraseña no puede superar los 200 caracteres.');
    const repetida = await lector.preguntar('Repite la contraseña: ', true);
    if (password !== repetida) throw new Error('Las contraseñas no coinciden.');

    const hash = await hashPassword(password);
    db.prepare('INSERT INTO admin_usuarios (correo, password_hash) VALUES (?, ?)').run(correo, hash);
    console.log(`✅ Usuario ${correo} creado. Ya puedes entrar en /admin/login.`);
  } finally {
    lector.cerrar();
  }
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
});
