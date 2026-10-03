// npm run db:migrate — crea las tablas y columnas que falten sin tocar los datos existentes.
const { initSchema, DB_PATH } = require('./index');

initSchema();
console.log('✅ Esquema aplicado en', DB_PATH);
