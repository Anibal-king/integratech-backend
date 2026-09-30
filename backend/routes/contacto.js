const express = require('express');
const { db, all } = require('../db');
const { requireAdmin, rateLimit, campoTexto } = require('../lib/security');

/** @typedef {import('../../shared/api-types').ContactoRespuesta} ContactoRespuesta */

const router = express.Router();

// Longitud máxima de cada campo del formulario
const MAX = { nombre: 120, correo: 200, telefono: 40, empresa: 150, mensaje: 5000 };

// POST /api/contacto - Recibe mensajes desde el formulario de contacto del sitio
router.post('/', rateLimit({ max: 5, ventanaMs: 10 * 60 * 1000 }), (req, res) => {
  const body = req.body ?? {};
  /** @type {Record<string, string>} */
  const datos = {};
  for (const [campo, max] of Object.entries(MAX)) {
    const valor = campoTexto(body[campo], max);
    if (valor === null) return res.status(400).json({ error: `El campo "${campo}" supera los ${max} caracteres.` });
    datos[campo] = valor;
  }
  const { nombre, correo, telefono, empresa, mensaje } = datos;
  if (!nombre || !mensaje) {
    return res.status(400).json({ error: 'Los campos "nombre" y "mensaje" son obligatorios.' });
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
  }

  const info = db.prepare(`
    INSERT INTO mensajes_contacto (nombre, correo, telefono, empresa, mensaje)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre, correo || null, telefono || null, empresa || null, mensaje);

  /** @type {ContactoRespuesta} */
  const respuesta = { ok: true, id: Number(info.lastInsertRowid) };
  res.status(201).json(respuesta);
});

// GET /api/contacto - (administrativo, requiere ADMIN_TOKEN) Lista los mensajes recibidos
router.get('/', requireAdmin, (req, res) => {
  res.json(all('SELECT * FROM mensajes_contacto ORDER BY fecha_creacion DESC'));
});

module.exports = router;
