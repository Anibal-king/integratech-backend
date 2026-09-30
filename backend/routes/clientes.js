const express = require('express');
const { all, get } = require('../db');

/** @typedef {import('../../shared/api-types').Cliente} Cliente */
/** @typedef {import('../../shared/api-types').OtroCliente} OtroCliente */

const router = express.Router();

/** @param {number} clienteId */
const serviciosDe = (clienteId) =>
  all('SELECT descripcion FROM servicios_por_cliente WHERE cliente_id = ? ORDER BY orden', clienteId).map(
    (/** @type {{ descripcion: string }} */ s) => s.descripcion
  );

// GET /api/clientes - Lista de clientes principales con sus servicios
router.get('/', (req, res) => {
  /** @type {Omit<Cliente, 'servicios'>[]} */
  const clientes = all('SELECT id, nombre FROM clientes ORDER BY nombre');
  /** @type {Cliente[]} */
  const result = clientes.map((c) => ({ ...c, servicios: serviciosDe(c.id) }));
  res.json(result);
});

// GET /api/clientes/otros/lista - Lista de "otros clientes"
// (definida antes de "/:id" para que no sea interceptada por esa ruta)
router.get('/otros/lista', (req, res) => {
  /** @type {OtroCliente[]} */
  const otros = all('SELECT id, nombre FROM otros_clientes ORDER BY nombre');
  res.json(otros);
});

// GET /api/clientes/:id - Detalle de un cliente
router.get('/:id', (req, res) => {
  /** @type {Omit<Cliente, 'servicios'> | undefined} */
  const cliente = get('SELECT id, nombre FROM clientes WHERE id = ?', req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  /** @type {Cliente} */
  const result = { ...cliente, servicios: serviciosDe(cliente.id) };
  res.json(result);
});

module.exports = router;
