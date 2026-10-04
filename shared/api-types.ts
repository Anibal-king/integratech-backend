/**
 * Contrato de la API REST de SIIE, compartido por backend/ (JSDoc + checkJs)
 * y frontend/ (TypeScript). Si una respuesta cambia de forma, ambos lados
 * dejan de compilar.
 *
 * Formato de respuesta (todas las rutas GET):
 *  - Listas: arreglo directo (`[]` con 200 si no hay datos).
 *  - Recurso individual (`/:id`): objeto, o 404 `{ error }` si no existe.
 *  - `/api/empresa`: objeto, o `null` con 200 si aún no está configurada.
 *  - Errores: `{ error: string }` con mensaje genérico; el detalle va al log.
 */

export interface Valor {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface Empresa {
  id: number;
  nombre: string;
  sitio_web: string | null;
  direccion: string | null;
  telefono: string | null;
  celular: string | null;
  registro_fiscal: string | null;
  nit: string | null;
  resena_historica: string | null;
  mision: string | null;
  vision: string | null;
  valores: Valor[];
}

/** Categoría del catálogo con los nombres de sus servicios (tabla `servicios`). */
/** Foto de un servicio. src/srcset son rutas del backend (/media/...): se antepone la URL de la API. */
export interface ServicioFoto {
  id: number;
  alt: string;
  /** Menor versión de al menos 800 px, o la mayor disponible. */
  src: string;
  /** Todas las versiones WebP: "/media/... 400w, /media/... 800w". */
  srcset: string;
  /** Tamaño de la versión más grande (para width/height y evitar saltos de diseño). */
  ancho: number;
  alto: number;
  es_portada: boolean;
}

/** Servicio público (GET /api/servicios y /api/servicios/:id; solo los publicados). */
export interface CategoriaServicio {
  id: number;
  /** Título. */
  nombre: string;
  /** Descripción corta (tarjetas). */
  descripcion: string | null;
  /** Descripción larga (página de detalle); null = usar la corta. */
  descripcion_larga: string | null;
  /** Ítems de "Qué incluye", en orden. */
  items: string[];
  portada: ServicioFoto | null;
  /** Galería completa en orden (incluye la portada). */
  fotos: ServicioFoto[];
}

export interface Cliente {
  id: number;
  nombre: string;
  servicios: string[];
}

export interface OtroCliente {
  id: number;
  nombre: string;
}

export interface Proyecto {
  id: number;
  nombre_proyecto: string;
  ejecucion: string | null;
  descripcion: string | null;
}

export type ContratoMantenimiento = Proyecto;

export interface Marca {
  id: number;
  nombre: string;
  funcion: string | null;
}

export interface DocumentoLegal {
  id: number;
  tipo: string;
  numero: string | null;
  fecha_expedicion: string | null;
  descripcion: string | null;
}

/** Se exige correo o teléfono (al menos uno). */
export interface ContactoPayload {
  nombre: string;
  correo?: string;
  telefono?: string;
  empresa?: string;
  mensaje: string;
}

export interface ContactoRespuesta {
  ok: true;
  id: number;
  /** false si SMTP no está configurado o falló: el mensaje igual quedó guardado. */
  emailSent: boolean;
}

// ---------- Panel de administración (requieren sesión) ----------

/** Servicio en el panel: incluye los ocultos. */
export interface ServicioAdmin extends CategoriaServicio {
  orden: number;
  publicado: boolean;
  /** UTC; null si nunca se editó desde el panel. */
  fecha_actualizacion: string | null;
}

/** Cuerpo de POST /api/admin/servicios y PUT /api/admin/servicios/:id. */
export interface ServicioDatos {
  nombre: string;
  descripcion: string;
  descripcion_larga?: string | null;
  items: string[];
  publicado: boolean;
}

/** Respuesta de POST /api/admin/login y GET /api/admin/me. */
export interface AdminUsuario {
  correo: string;
}

/** Estados de seguimiento de una solicitud, en orden. */
export type EstadoSolicitud = 'nuevo' | 'contactado' | 'cotizado' | 'cerrado' | 'descartado';

/** De dónde llegó la solicitud. */
export type OrigenSolicitud = 'formulario' | 'chatbot';

/** Solicitud unificada (formulario o chatbot) de /api/admin/solicitudes. */
export interface SolicitudAdmin {
  origen: OrigenSolicitud;
  /** id dentro de su origen: la clave única es origen + id. */
  id: number;
  nombre: string;
  empresa: string | null;
  correo: string | null;
  telefono: string | null;
  /** Mensaje del formulario, o resumen de las respuestas del chatbot. */
  mensaje: string;
  /** Respuestas del chatbot por separado (null para el formulario). */
  chatbot: {
    tipo_servicio: string | null;
    alcance: string | null;
    ubicacion: string | null;
    plazo: string | null;
  } | null;
  estado: EstadoSolicitud;
  notas: string | null;
  /** UTC, formato 'YYYY-MM-DD HH:MM:SS'. */
  fecha_creacion: string;
  /** UTC; null si nunca se cambió el estado ni las notas. */
  fecha_actualizacion: string | null;
}

/** GET /api/admin/solicitudes */
export interface SolicitudesPagina {
  items: SolicitudAdmin[];
  /** Total con los filtros aplicados (para paginar). */
  total: number;
  pagina: number;
  por_pagina: number;
}

/** PATCH /api/admin/solicitudes/:origen/:id */
export interface SolicitudCambios {
  estado?: EstadoSolicitud;
  notas?: string | null;
}

/** GET /api/admin/estadisticas (meses en hora de El Salvador). */
export interface EstadisticasAdmin {
  total: number;
  /** Solicitudes en estado 'nuevo'. */
  sin_atender: number;
  mes_actual: { mes: string; total: number };
  /** Últimos 6 meses, del más antiguo al actual; mes = 'YYYY-MM'. */
  por_mes: { mes: string; formulario: number; chatbot: number }[];
  por_estado: Record<EstadoSolicitud, number>;
}

// ---------- Calendario de citas ----------

export type EstadoCita = 'programada' | 'completada' | 'cancelada';

/** Cita del calendario. Fechas en hora de El Salvador (UTC-6). */
export interface Cita {
  id: number;
  titulo: string;
  cliente: string | null;
  telefono: string | null;
  correo: string | null;
  servicio: { id: number; nombre: string } | null;
  /** Solicitud de la que salió la cita (formulario o chatbot), si la hay. */
  solicitud: { origen: OrigenSolicitud; id: number; nombre: string | null } | null;
  /** ISO con desplazamiento: '2026-10-05T09:00:00-06:00'. */
  inicio: string;
  fin: string;
  /** Hora local para <input type="datetime-local">: '2026-10-05T09:00'. */
  inicio_local: string;
  fin_local: string;
  lugar: string | null;
  notas: string | null;
  estado: EstadoCita;
  fecha_actualizacion: string | null;
}

/** Cuerpo de POST /api/admin/citas y PUT /api/admin/citas/:id. Fechas 'YYYY-MM-DDTHH:MM' locales. */
export interface CitaDatos {
  titulo: string;
  cliente?: string | null;
  telefono?: string | null;
  correo?: string | null;
  servicio_id?: number | null;
  solicitud?: { origen: OrigenSolicitud; id: number } | null;
  inicio_local: string;
  fin_local: string;
  lugar?: string | null;
  notas?: string | null;
  estado?: EstadoCita;
  /** true para guardar aunque se traslape con otra cita programada. */
  confirmar_traslape?: boolean;
}

/** 409 de crear/editar cuando hay traslape y no se confirmó. */
export interface TraslapeRespuesta {
  error: string;
  traslapes: Cita[];
}

/** GET /api/admin/citas/proximas */
export interface CitasProximas {
  /** Citas programadas que empiezan en los próximos 7 días. */
  proximos_7_dias: number;
  /** Próximas citas programadas (aún no terminadas), en orden. */
  items: Cita[];
}

/** Fila de GET /api/contacto. */
export interface MensajeContacto {
  id: number;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  empresa: string | null;
  mensaje: string;
  /** UTC, formato 'YYYY-MM-DD HH:MM:SS'. */
  fecha_creacion: string;
  estado: EstadoSolicitud;
  notas: string | null;
  fecha_actualizacion: string | null;
}

/** Fila de GET /api/lead-chatbot. */
export interface LeadChatbot {
  id: number;
  tipo_servicio: string | null;
  alcance: string | null;
  ubicacion: string | null;
  plazo: string | null;
  nombre: string;
  empresa: string | null;
  correo: string | null;
  telefono: string | null;
  origen: 'chatbot' | 'whatsapp';
  correo_enviado: 0 | 1;
  /** UTC, formato 'YYYY-MM-DD HH:MM:SS'. */
  fecha_creacion: string;
  estado: EstadoSolicitud;
  notas: string | null;
  fecha_actualizacion: string | null;
}

export interface ApiError {
  error: string;
}

export interface Health {
  ok: boolean;
  servicio: string;
  version: string;
  db: {
    ok: boolean;
    /** Filas por tabla principal (solo si la base respondió). */
    conteos?: Record<string, number>;
  };
}
