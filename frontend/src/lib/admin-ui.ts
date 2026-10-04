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

// ---------- Citas ----------

/** Día de hoy en El Salvador: 'YYYY-MM-DD'. */
export const hoyLocal = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);

/** Suma días a un día local 'YYYY-MM-DD'. */
export function sumarDiasLocal(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const fmtHora = new Intl.DateTimeFormat('es-SV', { hour: 'numeric', minute: '2-digit', timeZone: ZONA });
const fmtDiaLargo = new Intl.DateTimeFormat('es-SV', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtDiaCorto = new Intl.DateTimeFormat('es-SV', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** ISO con desplazamiento → "9:00 a. m." */
export const horaCita = (iso: string) => fmtHora.format(new Date(iso));
/** "9:00 a. m. – 10:30 a. m." */
export const rangoHoras = (inicio: string, fin: string) => `${horaCita(inicio)} – ${horaCita(fin)}`;
/** 'YYYY-MM-DD' → "lunes, 5 de octubre" */
export const diaLargo = (dia: string) => fmtDiaLargo.format(new Date(`${dia}T12:00:00Z`));
/** Primera letra en mayúscula ("octubre de 2026" → "Octubre de 2026"); el resto igual. */
export const mayuscula = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
/** 'YYYY-MM-DD' → "lun, 5 oct" */
export const diaCorto = (dia: string) => fmtDiaCorto.format(new Date(`${dia}T12:00:00Z`)).replace(/\./g, '');

export const ESTADOS_CITA: { valor: import('./admin').EstadoCita; etiqueta: string }[] = [
  { valor: 'programada', etiqueta: 'Programada' },
  { valor: 'completada', etiqueta: 'Completada' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
];
export const etiquetaEstadoCita = (e: import('./admin').EstadoCita) => ESTADOS_CITA.find((x) => x.valor === e)?.etiqueta ?? e;

/**
 * Elemento de lista de una próxima cita (fecha, título, horario, cliente y lugar).
 * Con `href` es un enlace; sin él, un botón (el llamador agrega el clic).
 * Estilos: .lista-citas / .cita-item en AdminLayout.
 */
export function itemCita(c: import('./admin').Cita, href?: string): { li: HTMLLIElement; control: HTMLElement } {
  const li = document.createElement('li');
  const control = document.createElement(href ? 'a' : 'button');
  if (control instanceof HTMLAnchorElement) control.href = href!;
  else (control as HTMLButtonElement).type = 'button';
  control.className = 'cita-item';
  const dia = c.inicio_local.slice(0, 10);
  const [semana, , mesTxt] = diaCorto(dia).replace(',', '').split(' ');

  const fecha = document.createElement('span');
  fecha.className = 'cita-item__fecha';
  fecha.setAttribute('aria-hidden', 'true');
  const m = document.createElement('small');
  m.textContent = mesTxt ?? '';
  const n = document.createElement('strong');
  n.textContent = String(Number(dia.slice(8)));
  fecha.append(m, n);

  const txt = document.createElement('span');
  txt.className = 'cita-item__txt';
  const t = document.createElement('strong');
  t.textContent = c.titulo;
  const h = document.createElement('span');
  // La fecha ya está en la insignia: aquí solo el día de la semana y el horario.
  h.textContent = `${mayuscula(semana)} · ${rangoHoras(c.inicio, c.fin)}`;
  txt.append(t, h);
  const extra = [c.cliente, c.lugar].filter(Boolean).join(' · ');
  if (extra) {
    const e = document.createElement('span');
    e.textContent = extra;
    txt.append(e);
  }
  control.append(fecha, txt);
  li.append(control);
  return { li, control };
}

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
