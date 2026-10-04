// npm run migrar-fotos-servicios — pasa las fotos que usaba cada servicio (antes
// fijas en frontend/src/lib/imagenes.ts) al sistema de fotos del panel.
// Idempotente: los servicios que ya tienen fotos se saltan. Los JPG originales de
// frontend/src/assets/img/proyectos no se modifican (los siguen usando otras secciones).
const fs = require('node:fs/promises');
const path = require('node:path');
const { db, all, get, initSchema } = require('../db');
const { guardarFoto, borrarFoto } = require('../lib/fotos');

const ORIGEN = path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'img', 'proyectos');

/** Servicio (por título) → fotos en orden: [archivo sin extensión, texto alternativo]. La primera es la portada. */
const FOTOS_POR_SERVICIO = {
  'Proyectos de Automatización': [
    ['proyecto_017', 'Diseño y construcción de tableros de automatización'],
    ['proyecto_027', 'Diseño, construcción y programación de tableros de automatización de sistemas Loxone'],
    ['proyecto_028', 'Automatización de oficinas, edificios, complejos deportivos, naves industriales, etc.'],
    ['proyecto_019', 'Diseño y construcción de sistemas de automatización y red eléctrica para galpones avícolas y naves industriales'],
    ['proyecto_053', 'Diseño y construcción de tableros eléctricos, tableros de automatización, pozos eléctricos y cableados subterráneos'],
    ['proyecto_005', 'Suministro e instalación de celdas de baja tensión con automatización, protecciones y sistemas de barras'],
  ],
  'Soluciones Área Comercial': [
    ['proyecto_001', 'Diseño y construcción de data center'],
    ['proyecto_040', 'Redes de distribución eléctricas en oficinas, industria, etc.'],
    ['proyecto_045', 'Diseño y construcción de pozos eléctricos y de comunicaciones'],
    ['proyecto_049', 'Diseño y construcción de tableros de distribución de circuitos subterráneos y aéreos'],
    ['proyecto_025', 'Diseño y construcción de cableado primario'],
    ['proyecto_026', 'Diseño y construcción de pozos de registro subterráneos en media y baja tensión'],
  ],
  'Soluciones Área Industrial': [
    ['proyecto_018', 'Construcción de galpones con equipos avícolas'],
    ['proyecto_020', 'Diseño y construcción de centros de carga y redes eléctricas de galpones y naves industriales'],
    ['proyecto_003', 'Suministro e instalación de bancos de capacitores'],
    ['proyecto_010', 'Suministro de banco de capacitores'],
    ['proyecto_002', 'Suministro e instalación de transformadores secos de resina epóxica de media tensión con sistema de media y baja tensión'],
    ['proyecto_016', 'Diseño e instalación de cuarto eléctrico, generador, subestación, cableado primario y secundario'],
  ],
  'Soluciones Energía Renovable y Calidad': [
    ['proyecto_043', 'Suministro e instalación de sistemas solares'],
    ['proyecto_044', 'Suministro e instalación de sistemas solares con inyección cero, con inyección a red y sistemas aislados'],
    ['proyecto_042', 'Sistemas de UPS para operaciones críticas en edificios, industrias, etc.'],
    ['proyecto_004', 'Suministro e instalación de filtro de armónicos de baja tensión'],
    ['proyecto_055', 'Diseño y construcción de cuarto de UPS'],
    ['proyecto_056', 'Diseño y construcción de cuarto de UPS'],
  ],
  'Auditorías Energéticas': [
    ['proyecto_021', 'Estudios de calidad de energía con equipo especializado'],
    ['proyecto_013', 'Mantenimiento y pruebas a transformadores con equipos especializados'],
    ['proyecto_006', 'Puesta en marcha de sistemas de potencia de media y baja tensión'],
  ],
  'Mantenimiento de Infraestructura': [
    ['proyecto_013', 'Mantenimiento y pruebas a transformadores con equipos especializados'],
    ['proyecto_014', 'Suministro, instalación y mantenimiento de generadores'],
    ['proyecto_008', 'Cambio de controladores a generadores'],
    ['proyecto_038', 'Suministro, instalación y mantenimiento de transferencias automáticas desde 125 A hasta 4,000 A'],
    ['proyecto_039', 'Suministro, instalación y mantenimiento de transferencias automáticas desde 125 A hasta 4,000 A'],
    ['proyecto_036', 'Suministro e instalación de generadores UL con opción a certificación TIER III y IV'],
  ],
  'Asesoría para Ahorro Energético': [
    ['proyecto_021', 'Estudios de calidad de energía con equipo especializado'],
    ['proyecto_042', 'Sistemas de UPS para operaciones críticas en edificios, industrias, etc.'],
    ['proyecto_029', 'Diseño y construcción de iluminación de áreas'],
    ['proyecto_041', 'Iluminación de bodegas industriales, oficinas, etc.'],
  ],
};

async function main() {
  initSchema();
  let creadas = 0;
  for (const [nombre, fotos] of Object.entries(FOTOS_POR_SERVICIO)) {
    /** @type {{ id: number } | undefined} */
    const servicio = get('SELECT id FROM categorias_servicios WHERE nombre = ?', nombre);
    if (!servicio) {
      console.warn(`⚠️  No existe el servicio "${nombre}": se omite.`);
      continue;
    }
    if (get('SELECT 1 AS x FROM servicio_fotos WHERE categoria_id = ?', servicio.id)) {
      console.log(`·  "${nombre}" ya tiene fotos: se omite.`);
      continue;
    }
    const ins = db.prepare(
      'INSERT INTO servicio_fotos (categoria_id, archivo, anchos, ancho, alto, alt, orden, es_portada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    /** @type {Awaited<ReturnType<typeof guardarFoto>>[]} */
    const guardadas = [];
    try {
      for (const [archivo] of fotos) guardadas.push(await guardarFoto(await fs.readFile(path.join(ORIGEN, `${archivo}.jpg`))));
      db.exec('BEGIN');
      guardadas.forEach((g, i) =>
        ins.run(servicio.id, g.archivo, g.anchos.join(','), g.ancho, g.alto, fotos[i][1], i, i === 0 ? 1 : 0)
      );
      db.exec('COMMIT');
    } catch (err) {
      if (db.isTransaction) db.exec('ROLLBACK');
      await Promise.all(guardadas.map((g) => borrarFoto(g.archivo, g.anchos)));
      throw new Error(`Falló "${nombre}": ${/** @type {Error} */ (err).message}`);
    }
    creadas += guardadas.length;
    console.log(`✅ "${nombre}": ${guardadas.length} fotos.`);
  }
  /** @type {{ n: number } | undefined} */
  const total = get('SELECT COUNT(*) AS n FROM servicio_fotos');
  console.log(`Fotos nuevas: ${creadas}. Total en el sistema: ${total?.n ?? 0}.`);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
});
