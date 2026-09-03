const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/legal - Documentación legal de la empresa
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, tipo, numero, fecha_expedicion, descripcion FROM documentacion_legal ORDER BY id').all();
  res.json(rows);
});

module.exports = router;
