const express = require('express');
const { all, get } = require('../db');

/** @typedef {import('../../shared/api-types').Empresa} Empresa */
/** @typedef {import('../../shared/api-types').Valor} Valor */

const router = express.Router();

// GET /api/empresa - Información general + valores.
// Registro único: si aún no está configurado responde 200 con null (no es un error).
router.get('/', (req, res) => {
  /** @type {Omit<Empresa, 'valores'> | undefined} */
  const empresa = get(
    `SELECT id, nombre, sitio_web, direccion, telefono, celular, registro_fiscal, nit,
            resena_historica, mision, vision
       FROM empresa WHERE id = 1`
  );
  if (!empresa) return res.json(null);
  /** @type {Valor[]} */
  const valores = all('SELECT id, nombre, descripcion FROM valores ORDER BY id');
  /** @type {Empresa} */
  const result = { ...empresa, valores };
  res.json(result);
});

module.exports = router;
