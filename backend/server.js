const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const { DB_PATH, initSchema } = require('./db');
const { seed } = require('./db/seed');

const empresaRoutes = require('./routes/empresa');
const clientesRoutes = require('./routes/clientes');
const serviciosRoutes = require('./routes/servicios');
const proyectosRoutes = require('./routes/proyectos');
const marcasRoutes = require('./routes/marcas');
const legalRoutes = require('./routes/legal');
const contactoRoutes = require('./routes/contacto');

// Si la base de datos aún no existe, crearla y poblarla automáticamente.
if (!fs.existsSync(DB_PATH)) {
  console.log('No se encontró base de datos, creando y poblando (seed) por primera vez...');
  seed();
} else {
  initSchema(); // asegura que las tablas existan (idempotente con IF NOT EXISTS)
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'SIIE API', version: '1.0.0' }));

app.use('/api/empresa', empresaRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/marcas', marcasRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/contacto', contactoRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejador de errores centralizado
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API de SIIE corriendo en http://localhost:${PORT}`);
  console.log(`   Prueba: http://localhost:${PORT}/api/health`);
});
