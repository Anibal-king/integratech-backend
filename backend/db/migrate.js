// npm run db:migrate — crea las tablas que falten sin tocar los datos existentes.
const { initSchema, DB_PATH } = require('./index');

initSchema();
console.log('✅ Esquema aplicado en', DB_PATH);
