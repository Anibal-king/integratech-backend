const express = require('express');
const { all, get } = require('../db');

/** @typedef {import('../../shared/api-types').CategoriaServicio} CategoriaServicio */

const router = express.Router();

/** @param {number} categoriaId */
const itemsDe = (categoriaId) =>
  all(/* sql */ 'SELECT nombre FROM servicios WHERE categoria_id = ? ORDER BY orden', categoriaId).map(
    (/** @type {{ nombre: string }} */ i) => i.nombre
  );

// GET /api/servicios - Catálogo de categorías de servicios con sus ítems
router.get('/', (req, res) => {
  /** @type {Omit<CategoriaServicio, 'items'>[]} */
  const categorias = all('SELECT id, nombre, descripcion FROM categorias_servicios ORDER BY id');
  /** @type {CategoriaServicio[]} */
  const result = categorias.map((c) => ({ ...c, items: itemsDe(c.id) }));
  res.json(result);
});

// GET /api/servicios/:id - Detalle de una categoría de servicios
router.get('/:id', (req, res) => {
  /** @type {Omit<CategoriaServicio, 'items'> | undefined} */
  const categoria = get('SELECT id, nombre, descripcion FROM categorias_servicios WHERE id = ?', req.params.id);
  if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
  /** @type {CategoriaServicio} */
  const result = { ...categoria, items: itemsDe(categoria.id) };
  res.json(result);
});

module.exports = router;
