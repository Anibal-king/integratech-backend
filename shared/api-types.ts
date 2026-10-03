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
export interface CategoriaServicio {
  id: number;
  nombre: string;
  descripcion: string | null;
  items: string[];
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
