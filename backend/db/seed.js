const { db, initSchema } = require('./index');

function seed() {
  initSchema();

  // ---------- EMPRESA ----------
  db.exec('DELETE FROM empresa;');
  db.prepare(`
    INSERT INTO empresa (id, nombre, sitio_web, direccion, telefono, celular, registro_fiscal, nit, resena_historica, mision, vision)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'SERVICIOS INTEGRALES DE INGENIERIA EL SALVADOR S.A. DE C.V.',
    'www.sii.com.sv',
    'Av. Las Palmeras y Calle Las Azucenas Polig. "F" Urb. La Sultana #21, Antiguo Cuscatlán.',
    '503 2556-1756',
    '503 7986-2065',
    '317094-1',
    '0614-120722-106-0',
    'Servicios Integrales de Ingeniería inicia operaciones en el mes de enero de 2003, constituyéndose por un staff selecto de profesionales altamente capacitados con experiencia comprobada y especialización en cada una de las áreas que servimos.',
    'Satisfacer la demanda de servicios profesionales y especializados que requiere el mercado corporativo y empresarial de El Salvador.',
    'A corto plazo consolidar las operaciones, a mediano y largo plazo ser la empresa líder en servicios de ingeniería, así como también, ser parte activa del crecimiento, desarrollo del País, contribuyendo socialmente en la generación de empleos y productividad de El Salvador.'
  );

  // ---------- VALORES ----------
  const insValor = db.prepare('INSERT INTO valores (nombre, descripcion) VALUES (?, ?)');
  db.exec('DELETE FROM valores;');
  [
    ['Responsabilidad', 'Desempeñamos nuestro servicio profesional cumpliendo los compromisos con el cliente.'],
    ['Honestidad', 'Fortalecemos la relación de negocios con nuestros clientes bajo el principio de lo correcto.'],
    ['Cooperación', 'Trabajamos en equipo con nuestro cliente a fin de lograr los mejores resultados en beneficio mutuo.'],
  ].forEach(v => insValor.run(...v));

  // ---------- CLIENTES + SERVICIOS POR CLIENTE ----------
  db.exec('DELETE FROM servicios_por_cliente; DELETE FROM clientes;');
  const insCliente = db.prepare('INSERT INTO clientes (nombre) VALUES (?)');
  const insServCliente = db.prepare('INSERT INTO servicios_por_cliente (cliente_id, descripcion, orden) VALUES (?, ?, ?)');

  const clientesData = [
    {
      nombre: 'Avícola Salvadoreña, S.A. de C.V.',
      servicios: [
        'Suministro e instalación de más de 30 generadores AKSA Cummins desde 165 KVA a 1 MVA.',
        'Contrato de mantenimiento de 70 generadores en capacidades de 80 KVA hasta 1 MVA en diferentes granjas avícolas por valor de $70K más reparaciones.',
        'Proyectos de automatización de climatización de galeras de granjas avícolas por $1.1 M.',
        'Proyectos de obra civil y mecánica en más de 40 galeras.',
        'Proyectos de subestaciones en poste, estructura H y al piso desde 75 KVA a 501 KVA y distribución eléctrica.',
        'Suministro e instalación de más de 45 transferencias automáticas desde 400 A a 1,200 A.',
      ],
    },
    {
      nombre: 'Alas Doradas, S.A. de C.V.',
      servicios: [
        'Contrato de mantenimiento de aires acondicionados de precisión Tripplite en Data Center.',
        'Suministro de generador eléctrico y transferencias automáticas.',
      ],
    },
    {
      nombre: 'Banco Hipotecario',
      servicios: [
        'Contrato de mantenimiento de aires acondicionados de precisión Tripplite en Data Center.',
        'Contrato de mantenimiento de UPS en Data Center.',
        'Suministro de aires acondicionados de precisión y UPS de Data Center en redundancia paralela.',
      ],
    },
    {
      nombre: 'Financiera Enlace',
      servicios: [
        'Mantenimiento de infraestructura eléctrica de agencias y aires acondicionados de precisión Tripplite en Data Center.',
        'Mantenimiento de generadores eléctricos.',
      ],
    },
    {
      nombre: 'Grupo FE Gasolineras Texaco',
      servicios: [
        'Suministro e instalación de más de 7 generadores AKSA Cummins de 125 y 165 KVA.',
        'Instalaciones de subestaciones y red eléctrica en estaciones de servicio.',
      ],
    },
    {
      nombre: 'Sertracen',
      servicios: [
        'Contrato de mantenimiento de aires acondicionados de precisión Tripplite en Data Center y aires acondicionados centrales.',
      ],
    },
    {
      nombre: 'Presidencia de la República',
      servicios: [
        'Suministros de 3 generadores desde 75 KVA hasta 320 KVA.',
        'Suministro e instalación de aires acondicionados para despacho presidencial con automatización con sistema Loxone.',
        'Suministro e instalación de transferencias automáticas para generadores.',
      ],
    },
    {
      nombre: 'Banco Central de Reserva',
      servicios: [
        'Proyecto de red eléctrica subterránea de complejo deportivo con más de 26 pozos de registro eléctricos y 35 de comunicaciones, subestaciones, cuarto eléctrico, luminarias, etc. por $1.2 M.',
        'Suministro e instalación de 2 generadores de 1,200 KVA y 320 KVA con sus transferencias automáticas para edificio centro.',
      ],
    },
    {
      nombre: 'Molinos Modernos',
      servicios: [
        'Mantenimiento de generadores de plantas Sultana, Aliansa y Harisa.',
        'Suministro de UPS de 60 KVA y red eléctrica.',
        'Conexión de equipos compresores, secadores, etc.',
      ],
    },
    {
      nombre: 'Iglesia de Jesucristo de los Santos de los Últimos Días',
      servicios: [
        'Suministro de transferencias automáticas a capillas.',
        'Red eléctrica de capillas e instalación de aires acondicionados tipo casette.',
      ],
    },
  ];

  clientesData.forEach(c => {
    const info = insCliente.run(c.nombre);
    const clienteId = Number(info.lastInsertRowid);
    c.servicios.forEach((desc, i) => insServCliente.run(clienteId, desc, i));
  });

  // ---------- OTROS CLIENTES ----------
  db.exec('DELETE FROM otros_clientes;');
  const insOtro = db.prepare('INSERT INTO otros_clientes (nombre) VALUES (?)');
  [
    'SIGET', 'Infored', 'Pollo Campero', 'Gasolinera UNO El Limón',
    'Caja de Crédito Acoguadalupana', 'ICIVIL', 'CNR', 'Casino Colonial',
    'Plycem', 'Sherwin Williams', 'Corte Suprema de Justicia', 'Polaris',
    'Sello de Oro', 'Abank', 'US Navy',
  ].forEach(n => insOtro.run(n));

  // ---------- CATEGORÍAS DE SERVICIOS + SERVICIOS ----------
  db.exec('DELETE FROM servicios; DELETE FROM categorias_servicios;');
  const insCategoria = db.prepare('INSERT INTO categorias_servicios (nombre, descripcion) VALUES (?, ?)');
  const insServicio = db.prepare('INSERT INTO servicios (categoria_id, nombre, orden) VALUES (?, ?, ?)');

  const categorias = [
    {
      nombre: 'Proyectos de Automatización',
      descripcion: 'Automatización de procesos industriales y comerciales.',
      items: [
        'Suministro de sensores y dispositivos (variadores WEG y TECO)',
        'Programaciones',
        'Sistemas de conveyor y transporte',
        'Suministro de motores y arrancadores',
        'Modificaciones y auditorías de procesos',
        'Monitoreo de redes Profibus',
        'Redes de medición y analizadores Socomec',
        'Monitoreo de condiciones (temperatura, humedad, etc.)',
        'Extracción de polvillo y gases',
      ],
    },
    {
      nombre: 'Soluciones Área Comercial',
      descripcion: 'Infraestructura eléctrica y de datos para el sector comercial.',
      items: [
        'Redes de Datos',
        'Redes de Tierra, protecciones y pararrayos',
        'Auditorías Energéticas y proyectos eléctricos',
        'Infraestructura de Data Center',
        'CCTV, Alarmas, Control de Acceso',
      ],
    },
    {
      nombre: 'Soluciones Área Industrial',
      descripcion: 'Soluciones eléctricas y mecánicas para la industria.',
      items: [
        'Extractores industriales de polvo y humos',
        'Monitoreo de Redes Profibus',
        'Medición de energía',
        'Generadores eléctricos',
      ],
    },
    {
      nombre: 'Soluciones Energía Renovable y Calidad',
      descripcion: 'Energía renovable, calidad de energía y respaldo eléctrico.',
      items: [
        'Filtros activos para corrección de armónicos y factor de potencia',
        'Monitoreo de bancos de baterías',
        'Inversores con conexión a sistemas de panel y/o baterías',
        'Sistemas industriales de UPS online',
      ],
    },
    {
      nombre: 'Auditorías Energéticas',
      descripcion: 'Elaboración de plan de acción para el análisis de infraestructura conforme a la norma IEC 61000-4-30 Clase A, incluyendo mediciones, identificación de oportunidades de ahorro (iluminación, motores eléctricos, aire comprimido), corrección de factor de potencia, control de demanda y calidad de energía eléctrica, y elaboración del informe técnico final del estudio.',
      items: [],
    },
    {
      nombre: 'Mantenimiento de Infraestructura',
      descripcion: 'Administración de infraestructura para mantener buenas condiciones de funcionamiento del sistema eléctrico, estructurado de voz y datos, equipos acondicionadores de aire, UPS y plantas de emergencia, mediante mantenimiento preventivo y correctivo de los equipos.',
      items: [
        'Análisis de factuación eléctrica',
        'Interruptores de protección',
        'Red de tomas e interruptores',
        'Luminarias',
        'Equipos acondicionadores de aire',
        'Plantas de emergencia',
      ],
    },
    {
      nombre: 'Asesoría para Ahorro Energético',
      descripcion: 'Formulación de recomendaciones para el ahorro de energía y por consiguiente en dinero, a través de proyectos de cambio de patrones de comportamiento y/o operaciones, así como también proyectos de inversión con un análisis costo-beneficio del sistema.',
      items: ['Talleres generales'],
    },
  ];

  categorias.forEach(cat => {
    const info = insCategoria.run(cat.nombre, cat.descripcion);
    const catId = Number(info.lastInsertRowid);
    cat.items.forEach((item, i) => insServicio.run(catId, item, i));
  });

  // ---------- CONTRATOS DE MANTENIMIENTO ----------
  db.exec('DELETE FROM contratos_mantenimiento;');
  const insContrato = db.prepare('INSERT INTO contratos_mantenimiento (nombre_proyecto, ejecucion, descripcion) VALUES (?, ?, ?)');
  [
    ['Contrato de mantenimiento de plantas de emergencia para división pecuaria CMI, Avícola Salvadoreña', '2020 al 2025', 'Mantenimiento de equipos y atención de fallas para un parque de 85 unidades con capacidad de 80KVA a 1,000KVA.'],
    ['Contrato de mantenimiento de plantas de emergencia para Harisa, Molinos Modernos', '2023 al 2024', 'Mantenimiento de equipos y atención de fallas para un parque de 10 unidades con capacidad de 150 KVA a 2,000 KVA.'],
    ['Contrato de mantenimiento de plantas de emergencia para Hospital Ginecológico, Gasolinera Texaco Grupo Fe', '2023', 'Mantenimiento de equipos y atención de fallas para un parque de 10 unidades con capacidad de 5 KVA a 1,250 KVA.'],
    ['Contrato de mantenimiento de UPS, aires acondicionados de precisión e infraestructura de Data Center principal en Edificio Senda Florida, San Salvador y redundante en Santa Ana, Agencia Centro', '2012 al 2025', 'Mantenimiento de equipos y atención de fallas para UPS, aires de precisión, infraestructura eléctrica y de datos.'],
  ].forEach(row => insContrato.run(...row));

  // ---------- PROYECTOS DESTACADOS ----------
  db.exec('DELETE FROM proyectos_destacados;');
  const insProyecto = db.prepare('INSERT INTO proyectos_destacados (nombre_proyecto, ejecucion, descripcion) VALUES (?, ?, ?)');
  [
    ['Proyecto automatización de proceso industrial de Plycem con brazos robot marca KUKA y equipo National Instruments', '2012-2013', 'Automatización de línea de producción con National Instruments y robots KUKA.'],
    ['Proyectos de suministro e implementación de filtros de polvo asbesto en Plycem', '2014', 'Filtros de extracción de polvo de proceso.'],
    ['Proyectos de suministro e implementación de filtros de polvo y vapores de proceso pinturas en Sherwin Williams', '2016', 'Filtros de extracción de polvo y vapores.'],
    ['Diseño y construcción de Data Center principal para Banco Hipotecario, incluye obra civil, mecánica, eléctrica y equipos (UPS, aires de precisión, gabinetes, etc.)', '2012', 'Construcción de Data Center de Banco Hipotecario y migraciones.'],
    ['Diseño y construcción de Data Center redundante para Banco Hipotecario, incluye obra civil, mecánica, eléctrica y equipos (UPS, aires de precisión, gabinetes, etc.)', '2016', 'Construcción de Data Center alterno para Banco Hipotecario.'],
    ['Diseño y construcción de Data Center principal para Financiera Enlace, incluye obra civil, mecánica, eléctrica y equipos (UPS, aires de precisión, gabinetes, etc.)', '2016', 'Construcción de Data Center de Financiera Enlace y migraciones.'],
    ['Diseño de Data Center TIER 4 redundante para CNR, incluye obra civil, mecánica, eléctrica y equipos (UPS, aires de precisión, gabinetes, etc.)', '2018', 'Diseño de Data Center para CNR con TIER 4.'],
    ['Suministro de generadores y transferencias automáticas para Infored, Avícola Salvadoreña, Texaco (50 KVA a 1,000 KVA)', '2021 al 2023', 'Granjas La Esperanza, Guazapa, Las Torres, San Ramón, San Juan, San José, Primavera: 5 generadores AKSA de 250 KVA, 3 de 500 KVA, 1 de 344 KVA, 1 de 300 KVA, 1 de 1000 KVA y 14 transferencias automáticas de 800 a 1200 amperios marca McPherson.'],
    ['Diseño, suministro e instalación de red eléctrica de granjas avícola', '2021', 'Suministro de 3 subestaciones desde 225 KVA a 501 KVA al piso y en estructura H, cableados secundarios, cuartos eléctricos, etc.'],
    ['Diseño, suministro e instalación de obra eléctrica y automatización de galpones avícolas para Avícola Salvadoreña (34 galpones)', '2023-2024', 'Cableado primario y secundario, subestaciones de 300 KVA y 501 KVA en estructuras H y al piso.'],
    ['Diseño, suministro e instalación de obra civil y mecánica de galpones avícolas para Avícola Salvadoreña (34 galpones)', '2023-2024', 'Instalación eléctrica y automatización del sistema de clima de galpones.'],
    ['Red eléctrica de granja Suchitlán de Avícola Salvadoreña', '2023-2024', 'Diseño, suministro e instalación de red eléctrica de 1 km de cableado primario, subestación, cuarto eléctrico, cableado secundario, generador, transferencia, etc.'],
    ['Proyecto de infraestructura eléctrica con desarrollo de pozos eléctricos, iluminación de complejo deportivo, iluminación de 3 escenarios deportivos para BCR, con automatización y control por equipo domótica Loxone', '2024-2025', 'Red eléctrica desde subestación, cuarto eléctrico, generador, 27 pozos eléctricos, 37 pozos de comunicación, tomas, luminarias, tableros, etc.'],
    ['Suministro de generadores y transferencias automáticas para BCR (1 equipo UL de 1,200 KVA y 2 de 320 KVA) y para Casa Presidencial y Canal 10 (2 equipos de 300 KVA)', '2024-2025', 'Cambio de generadores de edificio centro y cableado de 175 metros para generadores.'],
    ['Automatización de climatización con Loxone para Casa Presidencial de aires acondicionados con aplicativos en red', '2024', 'Automatización de aires acondicionados de despacho presidencial y luminarias.'],
    ['Mantenimientos y construcción de subestaciones, obra eléctrica para Iglesia de Jesucristo de los Santos de los Últimos Días', '2020-2025', 'Construcción de red eléctrica, mantenimiento, instalación de aires acondicionados, etc.'],
    ['Proyecto de iluminación de estadio de Ilobasco', '2025', 'Construcción de 6 torres de iluminación para escenarios deportivos.'],
    ['Iluminación de planta de procesos y cableados de equipos en Sello de Oro', '2025-2026', 'Proyecto de iluminación, sistema de baja tensión para planta de harinas y cableados y conexiones de equipos para control y fuerza.'],
    ['Proyecto de mejora de red eléctrica en edificios de Corte Suprema de Justicia', '2026', 'Suministro de 4 celdas de media tensión, transformador seco de 2,500 KVA, bancos de capacitores de 750 KVAR, filtros de armónicos, supresores de transientes, acometidas subterráneas de media tensión, etc.'],
    ['UPS 80 KVA en Century Tower', '2026', 'Suministro e instalación de UPS de 80 KVA con sistema de fuerza para alimentación de elevadores y así evitar emergencias en fallos eléctricos con elevadores.'],
  ].forEach(row => insProyecto.run(...row));

  // ---------- MARCAS ----------
  db.exec('DELETE FROM marcas;');
  const insMarca = db.prepare('INSERT INTO marcas (nombre, funcion) VALUES (?, ?)');
  [
    ['AKSA Power Generation', 'Generadores eléctricos desde 15 KVA hasta 3,000 KVA.'],
    ['Tripp-Lite by Eaton', 'Aires de precisión, UPS monofásicos, trifásicos y modulares, PDU, etc.'],
    ['McPherson Controls', 'Transferencias automáticas desde 125 A hasta 3,000 A. Repuestos de generadores.'],
    ['Loxone', 'Automatización de edificios, oficinas, hogares, etc.'],
    ['Nederman', 'Extracción y filtración de polvo, partículas, humos, gases, etc.'],
    ['Citel', 'Soluciones de protección contra las sobretensiones transitorias de equipos eléctricos, informáticos, telefónicos (fija y móvil) y RF.'],
    ['Smartbitt', 'UPS desde 10 KVA a 120 KVA.'],
    ['ABB', 'Protecciones térmicas, contactores, guardamotores, transformadores.'],
    ['Deep Sea Electronics', 'Controladores de generadores.'],
    ['Sylvania', 'Iluminación y sistemas solares.'],
  ].forEach(row => insMarca.run(...row));

  // ---------- DOCUMENTACIÓN LEGAL ----------
  db.exec('DELETE FROM documentacion_legal;');
  const insLegal = db.prepare('INSERT INTO documentacion_legal (tipo, numero, fecha_expedicion, descripcion) VALUES (?, ?, ?, ?)');
  [
    ['NIT (Número de Identificación Tributaria)', '0614-120722-106-0', null, 'Ministerio de Hacienda, Gobierno de El Salvador.'],
    ['NRC (Número de Registro de Contribuyente)', '317094-1', '25/07/2022', 'Dirección General de Impuestos Internos - tarjeta de registro de contribuyentes, giro: instalaciones eléctricas.'],
  ].forEach(row => insLegal.run(...row));

  console.log('✅ Base de datos inicializada y poblada correctamente en', require('./index').DB_PATH);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
