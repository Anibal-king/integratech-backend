const express = require('express');
const { all } = require('../db');
const { requireAdmin } = require('../lib/auth');

/**
 * El chatbot del sitio se reemplazó por el botón de WhatsApp (POST /api/cotizaciones).
 * Los leads que capturó siguen en leads_chatbot y se ven en el panel; aquí solo
 * queda la lista administrativa.
 */
const router = express.Router();

/**
 * GET /api/lead-chatbot  (administrativo, requiere sesión del panel)
 * Lista las cotizaciones (chatbot anterior y WhatsApp), más recientes primero.
 */
router.get('/', requireAdmin, (req, res) => {
  res.json(all('SELECT * FROM leads_chatbot ORDER BY fecha_creacion DESC, id DESC'));
});

module.exports = router;
