const express = require('express');
const { db } = require('../db');

const router = express.Router();

// POST /api/contacto - Recibe mensajes desde el formulario de contacto del sitio
router.post('/', (req, res) => {
  const { nombre, correo, telefono, empresa, mensaje } = req.body || {};

  if (!nombre || !mensaje) {
    return res.status(400).json({ error: 'Los campos "nombre" y "mensaje" son obligatorios.' });
  }

  const info = db.prepare(`
    INSERT INTO mensajes_contacto (nombre, correo, telefono, empresa, mensaje)
    VALUES (?, ?, ?, ?, ?)
  `).run(nombre, correo || null, telefono || null, empresa || null, mensaje);

  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

// GET /api/contacto - (uso administrativo) Lista los mensajes recibidos
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM mensajes_contacto ORDER BY fecha_creacion DESC').all();
  res.json(rows);
});

module.exports = router;
