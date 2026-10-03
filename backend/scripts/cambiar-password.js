// npm run cambiar-password — asigna una contraseña nueva a un usuario del panel.
// Sirve también para recuperar el acceso: requiere acceso al servidor, no hay
// recuperación por correo. Cierra todas las sesiones abiertas de ese usuario.
const { db, get, initSchema } = require('../db');
const { hashPassword } = require('../lib/auth');
const { crearLector, pedirPasswordNueva } = require('./lector');

async function main() {
  initSchema();
  const lector = crearLector();
  try {
    const correo = (await lector.preguntar('Correo del administrador: ')).trim().toLowerCase();
    /** @type {{ id: number, correo: string } | undefined} */
    const usuario = get('SELECT id, correo FROM admin_usuarios WHERE correo = ?', correo);
    if (!usuario) {
      /** @type {{ correo: string }[]} */
      const existentes = db.prepare('SELECT correo FROM admin_usuarios ORDER BY correo').all().map((f) => ({ correo: String(f.correo) }));
      const lista = existentes.length ? existentes.map((u) => `  - ${u.correo}`).join('\n') : '  (ninguno: créalo con npm run crear-admin)';
      throw new Error(`No existe un usuario con el correo ${correo}. Usuarios registrados:\n${lista}`);
    }

    const password = await pedirPasswordNueva(lector);
    const hash = await hashPassword(password);
    db.prepare('UPDATE admin_usuarios SET password_hash = ? WHERE id = ?').run(hash, usuario.id);
    const cerradas = db.prepare('DELETE FROM admin_sesiones WHERE usuario_id = ?').run(usuario.id).changes;
    console.log(`✅ Contraseña de ${usuario.correo} actualizada. Sesiones cerradas: ${cerradas}.`);
  } finally {
    lector.cerrar();
  }
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
});
