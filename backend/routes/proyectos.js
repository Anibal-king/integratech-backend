const express = require('express');
const { all, get } = require('../db');

/** @typedef {import('../../shared/api-types').Proyecto} Proyecto */
/** @typedef {import('../../shared/api-types').ContratoMantenimiento} ContratoMantenimiento */

const router = express.Router();

const COLUMNAS = 'id, nombre_proyecto, ejecucion, descripcion';

// GET /api/proyectos - Proyectos destacados (con filtro opcional ?anio=2024)
router.get('/', (req, res) => {
  const anio = typeof req.query.anio === 'string' ? req.query.anio : '';
  /** @type {Proyecto[]} */
  const rows = anio
    ? all(`SELECT ${COLUMNAS} FROM proyectos_destacados WHERE ejecucion LIKE ? ORDER BY id`, `%${anio}%`)
    : all(`SELECT ${COLUMNAS} FROM proyectos_destacados ORDER BY id`);
  res.json(rows);
});

// GET /api/proyectos/contratos-mantenimiento - Contratos de mantenimiento vigentes/históricos
router.get('/contratos-mantenimiento', (req, res) => {
  /** @type {ContratoMantenimiento[]} */
  const rows = all(`SELECT ${COLUMNAS} FROM contratos_mantenimiento ORDER BY id`);
  res.json(rows);
});

// GET /api/proyectos/:id - Detalle de un proyecto destacado
router.get('/:id', (req, res) => {
  /** @type {Proyecto | undefined} */
  const row = get(`SELECT ${COLUMNAS} FROM proyectos_destacados WHERE id = ?`, req.params.id);
  if (!row) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json(row);
});

module.exports = router;
