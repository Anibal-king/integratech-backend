const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/marcas - Marcas representadas
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, nombre, funcion FROM marcas ORDER BY nombre').all();
  res.json(rows);
});

module.exports = router;
