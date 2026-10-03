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
