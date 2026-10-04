/**
 * Registro central de imágenes del sitio (carpeta src/assets/img).
 *
 * Las imágenes se importan con import.meta.glob (eager) para que Astro las
 * optimice (resize + webp) al usarlas con el componente <Image />.
 *
 * Fuente: C:\Users\ANDRES\OneDrive\Escritorio\SIIE_imagenes_web
 */
import type { ImageMetadata } from 'astro';

// ---------- Glob de carpetas ----------

const proyectosGlob = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/img/proyectos/*.jpg',
  { eager: true }
);
const marcasGlob = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/img/marcas/*.jpg',
  { eager: true }
);
const logoGlob = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/img/logo/*.jpg',
  { eager: true }
);
const legalesGlob = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/img/legales/*.jpg',
  { eager: true }
);

// base del path -> "proyecto_001"
function clave(path: string): string {
  return path.split('/').pop()!.replace(/\.jpg$/i, '');
}

function aMapa(glob: Record<string, { default: ImageMetadata }>): Map<string, ImageMetadata> {
  return new Map(Object.entries(glob).map(([p, m]) => [clave(p), m.default]));
}

const PROYECTOS = aMapa(proyectosGlob);
const MARCAS = aMapa(marcasGlob);
const LOGOS = aMapa(logoGlob);
const LEGALES = aMapa(legalesGlob);

// ---------- Logo / legales ----------

export const logoHorizontal = LOGOS.get('logo_horizontal')!;
export const logoVariante = LOGOS.get('logo_variante')!;

export interface DocLegalImg {
  img: ImageMetadata;
  alt: string;
}
export const documentosLegales: DocLegalImg[] = [
  { img: LEGALES.get('nrc_registro')!, alt: 'Registro de contribuyentes (NRC 317094-1) — Ministerio de Hacienda' },
  { img: LEGALES.get('nit_tarjeta')!, alt: 'Tarjeta NIT 0614-120722-106-0 — Gobierno de El Salvador' },
  { img: LEGALES.get('direccion_casa_matriz')!, alt: 'Documento con dirección de casa matriz' },
].filter((d) => d.img);

// ---------- Marcas ----------

const MARCA_ARCHIVO: Record<string, string> = {
  'aksa power generation': 'aksa',
  'tripp-lite by eaton': 'tripplite',
  'mcpherson controls': 'mcpherson',
  loxone: 'loxone',
  nederman: 'nederman',
  citel: 'citel',
  smartbitt: 'smartbitt',
  abb: 'abb',
  'deep sea electronics': 'deepsea',
  sylvania: 'sylvania',
};

/** Logo de una marca por su nombre (como viene de la API). Devuelve null si no hay. */
export function marcaLogo(nombre: string): ImageMetadata | null {
  const key = MARCA_ARCHIVO[nombre.trim().toLowerCase()];
  if (key && MARCAS.has(key)) return MARCAS.get(key)!;
  // fallback: primer token del nombre
  const token = nombre.trim().toLowerCase().split(/[\s-]+/)[0];
  for (const [k, v] of MARCAS) if (k.startsWith(token)) return v;
  return null;
}

// ---------- Fotos de proyectos ----------

/** Descripción de cada foto (de metadata.json). */
export const DESCRIPCION_PROYECTO: Record<string, string> = {
  proyecto_001: 'Diseño y construcción de data center',
  proyecto_002: 'Suministro e instalación de transformadores secos de resina epóxica de media tensión con sistema de media y baja tensión',
  proyecto_003: 'Suministro e instalación de bancos de capacitores',
  proyecto_004: 'Suministro e instalación de filtro de armónicos de baja tensión',
  proyecto_005: 'Suministro e instalación de celdas de baja tensión con automatización, protecciones y sistemas de barras',
  proyecto_006: 'Puesta en marcha de sistemas de potencia de media y baja tensión',
  proyecto_007: 'Suministro e instalación de celdas de media tensión en gas SF6',
  proyecto_008: 'Cambio de controladores a generadores',
  proyecto_009: 'Construcción de subestaciones al piso',
  proyecto_010: 'Suministro de banco de capacitores',
  proyecto_011: 'Suministro e instalación de generadores',
  proyecto_012: 'Suministro e instalación de subestaciones al piso',
  proyecto_013: 'Mantenimiento y pruebas a transformadores con equipos especializados',
  proyecto_014: 'Suministro, instalación y mantenimiento de generadores',
  proyecto_015: 'Diseño e instalación de subestaciones en poste',
  proyecto_016: 'Diseño e instalación de cuarto eléctrico, generador, subestación, cableado primario y secundario',
  proyecto_017: 'Diseño y construcción de tableros de automatización',
  proyecto_018: 'Construcción de galpones con equipos avícolas',
  proyecto_019: 'Diseño y construcción de sistemas de automatización y red eléctrica para galpones avícolas y naves industriales',
  proyecto_020: 'Diseño y construcción de centros de carga y redes eléctricas de galpones y naves industriales',
  proyecto_021: 'Estudios de calidad de energía con equipo especializado',
  proyecto_022: 'Diseño y construcción de cuarto eléctrico, generador y tableros',
  proyecto_023: 'Servicios de grúa para montaje y desmontaje de postes, generadores, etc.',
  proyecto_024: 'Diseño y construcción de cuarto eléctrico, subestación, generador, cableado primario y secundario',
  proyecto_025: 'Diseño y construcción de cableado primario',
  proyecto_026: 'Diseño y construcción de pozos de registro subterráneos en media y baja tensión',
  proyecto_027: 'Diseño, construcción y programación de tableros de automatización de sistemas Loxone',
  proyecto_028: 'Automatización de oficinas, edificios, complejos deportivos, naves industriales, etc.',
  proyecto_029: 'Diseño y construcción de iluminación de áreas',
  proyecto_030: 'Diseño y construcción de iluminación decorativa',
  proyecto_031: 'Diseño y construcción de iluminación de escenarios deportivos',
  proyecto_032: 'Diseño y construcción de iluminación de escenarios deportivos',
  proyecto_033: 'Diseño y construcción de iluminación de escenarios deportivos',
  proyecto_034: 'Diseño y construcción de monopolo de 25 metros para colocación de pararrayo',
  proyecto_035: 'Diseño e iluminación de escenarios deportivos, naves industriales, oficinas, etc.',
  proyecto_036: 'Suministro e instalación de generadores UL con opción a certificación TIER III y IV',
  proyecto_037: 'Suministro e instalación de generadores UL con opción a certificación TIER III y IV',
  proyecto_038: 'Suministro, instalación y mantenimiento de transferencias automáticas desde 125 A hasta 4,000 A',
  proyecto_039: 'Suministro, instalación y mantenimiento de transferencias automáticas desde 125 A hasta 4,000 A',
  proyecto_040: 'Redes de distribución eléctricas en oficinas, industria, etc.',
  proyecto_041: 'Iluminación de bodegas industriales, oficinas, etc.',
  proyecto_042: 'Sistemas de UPS para operaciones críticas en edificios, industrias, etc.',
  proyecto_043: 'Suministro e instalación de sistemas solares',
  proyecto_044: 'Suministro e instalación de sistemas solares con inyección cero, con inyección a red y sistemas aislados',
  proyecto_045: 'Diseño y construcción de pozos eléctricos y de comunicaciones',
  proyecto_046: 'Diseño y construcción de iluminación de áreas de estacionamiento',
  proyecto_047: 'Diseño y construcción de iluminación de áreas verdes',
  proyecto_048: 'Diseño y construcción de tableros principales de alimentación de subestación',
  proyecto_049: 'Diseño y construcción de tableros de distribución de circuitos subterráneos y aéreos',
  proyecto_050: 'Diseño y construcción de canalizaciones subterráneas y pozos eléctricos',
  proyecto_051: 'Diseño y construcción de zona de subestación, generador y cuarto eléctrico',
  proyecto_052: 'Diseño y construcción de subestación en padmounted',
  proyecto_053: 'Diseño y construcción de tableros eléctricos, tableros de automatización, pozos eléctricos y cableados subterráneos',
  proyecto_054: 'Diseño y construcción de cuarto eléctrico',
  proyecto_055: 'Diseño y construcción de cuarto de UPS',
  proyecto_056: 'Diseño y construcción de cuarto de UPS',
  proyecto_057: 'Diseño y construcción de cuarto de UPS',
  proyecto_058: 'Diseño y construcción de cuarto de UPS',
  proyecto_059: 'Diseño y construcción de cuarto de UPS',
  proyecto_060: 'Diseño y construcción de cuarto de UPS',
};

export interface FotoProyecto {
  id: string;
  img: ImageMetadata;
  descripcion: string;
}

function foto(id: string): FotoProyecto | null {
  const img = PROYECTOS.get(id);
  if (!img) return null;
  return { id, img, descripcion: DESCRIPCION_PROYECTO[id] ?? 'Proyecto ejecutado por SIIE' };
}

/** Todas las fotos, ordenadas por número. */
export const todasLasFotos: FotoProyecto[] = Array.from(PROYECTOS.keys())
  .sort()
  .map((id) => foto(id)!)
  .filter(Boolean);

// Las fotos de cada servicio ya no se definen aquí: se administran en el panel
// (/admin/servicios) y llegan por la API (ver backend/scripts/migrar-fotos-servicios.js).

// ---------- Selección para la portada ----------

/**
 * Diapositivas del carrusel del inicio (hero). Para cambiar textos o fotos,
 * edita solo esta lista: el componente Hero.astro las recorre en orden.
 *  - titulo: la primera es el <h1> de la página.
 *  - frase:  null en la primera = misión de la empresa desde la API (con respaldo).
 *  - foto:   cualquier archivo de src/assets/img/proyectos (sin extensión).
 *  - alt:    describe lo que se ve en la foto.
 */
export interface DiapositivaHero {
  titulo: string;
  frase: string | null;
  foto: ImageMetadata;
  alt: string;
}

const fotoHero = (id: string) => {
  const img = PROYECTOS.get(id);
  if (!img) throw new Error(`Diapositiva del hero: no existe la foto "${id}" en assets/img/proyectos`);
  return img;
};

export const DIAPOSITIVAS_HERO: DiapositivaHero[] = [
  {
    titulo: 'Ingeniería especializada para la industria y el sector corporativo',
    frase: null,
    foto: fotoHero('proyecto_001'),
    alt: 'Pasillo de un data center con racks de servidores y bandejas de cableado en el techo',
  },
  {
    titulo: 'Automatiza tus procesos sin detener tu operación',
    frase: 'Diseñamos, construimos y programamos tableros de automatización para tu planta, tus oficinas o tu edificio.',
    foto: fotoHero('proyecto_027'),
    alt: 'Tablero de automatización con controladores Loxone y contactores numerados',
  },
  {
    titulo: 'Energía limpia y confiable para tu empresa',
    frase: 'Instalamos sistemas solares, UPS y filtros de armónicos para que reduzcas costos y nunca te quedes sin respaldo.',
    foto: fotoHero('proyecto_058'),
    alt: 'Paneles solares instalados sobre el techo de una nave industrial',
  },
];

/** Miniaturas de la franja "nuestro trabajo" del inicio (enlazan a /proyectos). */
export const bandaProyectos: FotoProyecto[] = ['proyecto_009', 'proyecto_043', 'proyecto_030', 'proyecto_036', 'proyecto_017']
  .map(foto)
  .filter((f): f is FotoProyecto => f !== null);

/** Galería de 6 fotos (se usa donde haga falta un grid con lightbox). */
export const galeriaHome: FotoProyecto[] = ['proyecto_017', 'proyecto_043', 'proyecto_030', 'proyecto_009', 'proyecto_036', 'proyecto_028']
  .map(foto)
  .filter((f): f is FotoProyecto => f !== null);
