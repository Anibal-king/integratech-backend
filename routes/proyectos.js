const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/proyectos - Proyectos destacados (con filtro opcional ?anio=2024)
router.get('/', (req, res) => {
  const { anio } = req.query;
  let rows;
  if (anio) {
    rows = db.prepare('SELECT * FROM proyectos_destacados WHERE ejecucion LIKE ? ORDER BY id').all(`%${anio}%`);
  } else {
    rows = db.prepare('SELECT * FROM proyectos_destacados ORDER BY id').all();
  }
  res.json(rows);
});

// GET /api/proyectos/contratos-mantenimiento - Contratos de mantenimiento vigentes/históricos
router.get('/contratos-mantenimiento', (req, res) => {
  const rows = db.prepare('SELECT * FROM contratos_mantenimiento ORDER BY id').all();
  res.json(rows);
});

// GET /api/proyectos/:id - Detalle de un proyecto destacado
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM proyectos_destacados WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json(row);
});

module.exports = router;
