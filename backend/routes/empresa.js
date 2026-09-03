const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/empresa - Información general + valores
router.get('/', (req, res) => {
  const empresa = db.prepare('SELECT * FROM empresa WHERE id = 1').get();
  const valores = db.prepare('SELECT id, nombre, descripcion FROM valores ORDER BY id').all();
  if (!empresa) return res.status(404).json({ error: 'Información de empresa no configurada' });
  res.json({ ...empresa, valores });
});

module.exports = router;
