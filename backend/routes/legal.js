const express = require('express');
const { all } = require('../db');

/** @typedef {import('../../shared/api-types').DocumentoLegal} DocumentoLegal */

const router = express.Router();

// GET /api/legal - Documentación legal de la empresa
router.get('/', (req, res) => {
  /** @type {DocumentoLegal[]} */
  const rows = all('SELECT id, tipo, numero, fecha_expedicion, descripcion FROM documentacion_legal ORDER BY id');
  res.json(rows);
});

module.exports = router;
