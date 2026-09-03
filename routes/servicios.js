const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/servicios - Catálogo de categorías de servicios con sus ítems
router.get('/', (req, res) => {
  const categorias = db.prepare('SELECT id, nombre, descripcion FROM categorias_servicios ORDER BY id').all();
  const stmtItems = db.prepare('SELECT nombre FROM servicios WHERE categoria_id = ? ORDER BY orden');
  const result = categorias.map(c => ({
    ...c,
    items: stmtItems.all(c.id).map(i => i.nombre),
  }));
  res.json(result);
});

// GET /api/servicios/:id - Detalle de una categoría de servicios
router.get('/:id', (req, res) => {
  const categoria = db.prepare('SELECT id, nombre, descripcion FROM categorias_servicios WHERE id = ?').get(req.params.id);
  if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
  const items = db.prepare('SELECT nombre FROM servicios WHERE categoria_id = ? ORDER BY orden').all(categoria.id).map(i => i.nombre);
  res.json({ ...categoria, items });
});

module.exports = router;
