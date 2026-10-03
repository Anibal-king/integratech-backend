// npm run crear-admin — crea un usuario del panel de administración.
// Pide correo y contraseña (oculta, dos veces). No hay registro público ni
// usuarios por defecto: esta es la única forma de crear uno.
const { db, get, initSchema } = require('../db');
const { hashPassword } = require('../lib/auth');
const { crearLector, pedirPasswordNueva } = require('./lector');

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

    const password = await pedirPasswordNueva(lector);
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
