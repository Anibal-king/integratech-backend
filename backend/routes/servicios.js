const express = require('express');
const { listarServicios, obtenerServicio, aPublico } = require('../lib/servicios');

/** @typedef {import('../../shared/api-types').CategoriaServicio} CategoriaServicio */

const router = express.Router();

// GET /api/servicios - Servicios publicados, en el orden definido en el panel
router.get('/', (req, res) => {
  /** @type {CategoriaServicio[]} */
  const result = listarServicios({ soloPublicados: true }).map(aPublico);
  res.json(result);
});

// GET /api/servicios/:id - Detalle de un servicio publicado (404 si no existe o está oculto)
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const servicio = Number.isInteger(id) && id > 0 ? obtenerServicio(id, { soloPublicados: true }) : null;
  if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
  /** @type {CategoriaServicio} */
  const result = aPublico(servicio);
  res.json(result);
});

module.exports = router;
