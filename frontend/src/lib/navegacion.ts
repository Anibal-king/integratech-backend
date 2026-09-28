/**
 * Navegación de la landing: cada enlace apunta a una sección de "/" (con la
 * barra inicial, para que también funcione desde las subpáginas de detalle).
 */
export interface NavLink {
  /** id de la <section> destino en la landing */
  id: string;
  href: string;
  label: string;
}

const link = (id: string, label: string): NavLink => ({ id, href: `/#${id}`, label });

export const NAV_LINKS: NavLink[] = [
  link('inicio', 'Inicio'),
  link('servicios', 'Servicios'),
  link('proyectos', 'Proyectos'),
  link('clientes', 'Clientes'),
  link('nosotros', 'Nosotros'),
  link('contacto', 'Contacto'),
];

export const CTA_LINK: NavLink = link('contacto', 'Solicitar cotización');

/** Evento que emite el scrollspy del header (detail = id de la sección activa). */
export const SECTION_CHANGE_EVENT = 'section:change';
/** Evento para pedir al header un desplazamiento a una sección (detail = id). */
export const SECTION_GOTO_EVENT = 'section:goto';

/**
 * Sección activa según la ruta. En la landing arranca en "inicio" (el
 * scrollspy la corrige); en una subpágina es su sección padre:
 * "/servicios/3" → "servicios", "/proyectos" → "proyectos".
 */
export function sectionForPath(pathname: string): string | null {
  if (pathname === '/') return 'inicio';
  const first = pathname.split('/')[1];
  return NAV_LINKS.some((l) => l.id === first) ? first : null;
}
