const express = require('express');
const { rateLimit, campoTexto } = require('../lib/security');
const {
  verificarCredenciales,
  crearSesion,
  borrarSesion,
  leerToken,
  enviarCookie,
  limpiarCookie,
  requireAllowedOrigin,
  requireAdmin,
} = require('../lib/auth');
const panelRoutes = require('./admin-panel');
const serviciosRoutes = require('./admin-servicios');
const citasRoutes = require('./admin-citas');

/** @typedef {import('../../shared/api-types').AdminUsuario} AdminUsuario */

const router = express.Router();

// Todas las rutas del panel: solo desde los orígenes permitidos.
router.use(requireAllowedOrigin);

const ERROR_LOGIN = 'Correo o contraseña incorrectos.';

// POST /api/admin/login  Body: { correo, password }
router.post('/login', rateLimit({ max: 10, ventanaMs: 15 * 60 * 1000 }), async (req, res, next) => {
  try {
    const correo = campoTexto(req.body?.correo, 200) ?? '';
    // La contraseña no se recorta: los espacios forman parte de ella.
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!correo || !password || password.length > 200) {
      return res.status(401).json({ error: ERROR_LOGIN });
    }

    const usuario = await verificarCredenciales(correo, password);
    if (!usuario) return res.status(401).json({ error: ERROR_LOGIN });

    enviarCookie(res, crearSesion(usuario.id));
    /** @type {AdminUsuario} */
    const respuesta = { correo: usuario.correo };
    res.json(respuesta);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/logout  Invalida la sesión en la base (la cookie deja de servir).
router.post('/logout', (req, res) => {
  const token = leerToken(req);
  if (token) borrarSesion(token);
  limpiarCookie(res);
  res.status(204).end();
});

// GET /api/admin/me  Usuario de la sesión actual, o 401.
router.get('/me', requireAdmin, (req, res) => {
  /** @type {AdminUsuario} */
  const respuesta = { correo: req.admin.correo };
  res.json(respuesta);
});

// Servicios y fotos, citas; solicitudes y estadísticas (todas con requireAdmin).
router.use('/servicios', serviciosRoutes);
router.use('/citas', citasRoutes);
router.use(panelRoutes);

module.exports = router;
