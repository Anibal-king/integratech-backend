/**
 * Utilidades de interfaz del panel (solo navegador): control de sesión del
 * shell, formato de fechas, etiquetas de estado/origen, enlaces de respuesta
 * y estados de vista (cargando / vacío / error).
 *
 * Todo el texto que viene de la API se inserta con textContent, nunca con
 * innerHTML: los datos los escribieron visitantes del sitio.
 */
import { admin, AdminError, LOGIN_PATH, type AdminUsuario, type EstadoSolicitud, type OrigenSolicitud } from './admin';

// ---------- Sesión ----------

let sesionPromesa: Promise<AdminUsuario> | null = null;

/**
 * Confirma la sesión una sola vez por página. Sin sesión redirige al login y la
 * promesa nunca se resuelve (la página no llega a pedir datos ni a mostrarse).
 */
export function panelListo(): Promise<AdminUsuario> {
  sesionPromesa ??= admin.sesion().then((usuario) => {
    if (!usuario) {
      location.replace(LOGIN_PATH);
      return new Promise<never>(() => {});
    }
    return usuario;
  });
  return sesionPromesa;
}

// ---------- Estados y orígenes ----------

export const ESTADOS: { valor: EstadoSolicitud; etiqueta: string }[] = [
  { valor: 'nuevo', etiqueta: 'Nuevo' },
  { valor: 'contactado', etiqueta: 'Contactado' },
  { valor: 'cotizado', etiqueta: 'Cotizado' },
  { valor: 'cerrado', etiqueta: 'Cerrado' },
  { valor: 'descartado', etiqueta: 'Descartado' },
];

export const etiquetaEstado = (e: EstadoSolicitud) => ESTADOS.find((x) => x.valor === e)?.etiqueta ?? e;

export const ORIGENES: { valor: OrigenSolicitud; etiqueta: string }[] = [
  { valor: 'formulario', etiqueta: 'Formulario' },
  { valor: 'chatbot', etiqueta: 'Chatbot' },
];

export const etiquetaOrigen = (o: OrigenSolicitud) => (o === 'chatbot' ? 'Chatbot' : 'Formulario');

/** Color sólido de cada estado (gráficas). Las etiquetas usan las variables --estado-* del layout. */
export function colorEstado(e: EstadoSolicitud): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--estado-${e}`).trim();
}

/** Etiqueta de color para un estado. */
export function chipEstado(e: EstadoSolicitud): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `chip chip--${e}`;
  s.textContent = etiquetaEstado(e);
  return s;
}

export function chipOrigen(o: OrigenSolicitud): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `chip-origen chip-origen--${o}`;
  s.textContent = etiquetaOrigen(o);
  return s;
}

/** Clave estable de una solicitud en la URL: "formulario-12". */
export const claveSolicitud = (o: OrigenSolicitud, id: number) => `${o}-${id}`;
export function leerClave(clave: string | null): { origen: OrigenSolicitud; id: number } | null {
  const m = /^(formulario|chatbot)-(\d+)$/.exec(clave ?? '');
  return m ? { origen: m[1] as OrigenSolicitud, id: Number(m[2]) } : null;
}

// ---------- Fechas ----------

/** Las fechas de SQLite son UTC sin zona ('YYYY-MM-DD HH:MM:SS'). */
export const fechaUTC = (s: string) => new Date(`${s.replace(' ', 'T')}Z`);

const ZONA = 'America/El_Salvador';
const fmtFechaHora = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA });
const fmtFecha = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short', timeZone: ZONA });
const fmtMes = new Intl.DateTimeFormat('es-SV', { month: 'short', timeZone: 'UTC' });
const fmtMesLargo = new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const fechaHora = (s: string) => fmtFechaHora.format(fechaUTC(s));
export const fechaCorta = (s: string) => fmtFecha.format(fechaUTC(s));
/** 'YYYY-MM' → "may", "jun"... */
export const mesCorto = (ym: string) => fmtMes.format(new Date(`${ym}-01T00:00:00Z`)).replace('.', '');
/** 'YYYY-MM' → "octubre de 2026" */
export const mesLargo = (ym: string) => fmtMesLargo.format(new Date(`${ym}-01T00:00:00Z`));

// ---------- Responder ----------

const ASUNTO = 'Su solicitud a Servicios Integrales de Ingeniería';

export function enlaceCorreo(correo: string, nombre: string): string {
  const cuerpo = `Hola ${nombre}:\n\nGracias por contactar a Servicios Integrales de Ingeniería.\n\n`;
  return `mailto:${correo}?subject=${encodeURIComponent(ASUNTO)}&body=${encodeURIComponent(cuerpo)}`;
}

export const enlaceTelefono = (tel: string) => `tel:${tel.replace(/[^\d+]/g, '')}`;

/**
 * Enlace de WhatsApp, o null si el número no parece un celular.
 * En El Salvador los celulares tienen 8 dígitos y empiezan por 6 o 7 (se antepone 503);
 * un número con código de país (11 dígitos o más) se usa tal cual.
 */
export function enlaceWhatsApp(tel: string, nombre: string): string | null {
  let digitos = tel.replace(/\D/g, '');
  if (digitos.length === 8 && /^[67]/.test(digitos)) digitos = `503${digitos}`;
  else if (digitos.length < 11) return null;
  const texto = `Hola ${nombre}, le escribimos de Servicios Integrales de Ingeniería por su solicitud.`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

// ---------- Estados de vista ----------

export type EstadoVista = 'cargando' | 'vacio' | 'error' | 'listo';

/**
 * Muestra uno de los hijos [data-vista="cargando|vacio|error|listo"] de un contenedor.
 * Con `mensaje` se reemplaza el texto del bloque [data-vista-texto] de ese estado.
 */
export function vista(contenedor: HTMLElement, estado: EstadoVista, mensaje?: string) {
  contenedor.querySelectorAll<HTMLElement>(':scope > [data-vista]').forEach((el) => {
    const activo = el.dataset.vista === estado;
    el.hidden = !activo;
    if (activo && mensaje) {
      const t = el.querySelector<HTMLElement>('[data-vista-texto]');
      if (t) t.textContent = mensaje;
    }
  });
  contenedor.setAttribute('aria-busy', String(estado === 'cargando'));
}

/**
 * Mensaje de error apto para el usuario a partir de una excepción del cliente.
 * `queFallo` es la frase completa, p. ej. "No se pudieron cargar las cifras."
 */
export function mensajeError(err: unknown, queFallo = 'No se pudieron cargar los datos.'): string {
  if (err instanceof AdminError && err.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return `${queFallo} Intenta de nuevo.`;
}

/** true si el error es un 401 (ya se está redirigiendo al login: no hay que mostrar nada). */
export const esSesionExpirada = (err: unknown) => err instanceof AdminError && err.status === 401;
