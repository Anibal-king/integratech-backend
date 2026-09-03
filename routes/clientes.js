const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/clientes - Lista de clientes principales con sus servicios
router.get('/', (req, res) => {
  const clientes = db.prepare('SELECT id, nombre FROM clientes ORDER BY nombre').all();
  const stmtServicios = db.prepare('SELECT descripcion FROM servicios_por_cliente WHERE cliente_id = ? ORDER BY orden');
  const result = clientes.map(c => ({
    ...c,
    servicios: stmtServicios.all(c.id).map(s => s.descripcion),
  }));
  res.json(result);
});

// GET /api/clientes/otros/lista - Lista de "otros clientes"
// (definida antes de "/:id" para que no sea interceptada por esa ruta)
router.get('/otros/lista', (req, res) => {
  const otros = db.prepare('SELECT id, nombre FROM otros_clientes ORDER BY nombre').all();
  res.json(otros);
});

// GET /api/clientes/:id - Detalle de un cliente
router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  const servicios = db.prepare('SELECT descripcion FROM servicios_por_cliente WHERE cliente_id = ? ORDER BY orden').all(cliente.id).map(s => s.descripcion);
  res.json({ ...cliente, servicios });
});

module.exports = router;
