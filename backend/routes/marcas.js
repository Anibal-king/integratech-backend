const express = require('express');
const { all } = require('../db');

/** @typedef {import('../../shared/api-types').Marca} Marca */

const router = express.Router();

// GET /api/marcas - Marcas representadas
router.get('/', (req, res) => {
  /** @type {Marca[]} */
  const rows = all('SELECT id, nombre, funcion FROM marcas ORDER BY nombre');
  res.json(rows);
});

module.exports = router;
