/**
 * Cliente del panel de administración (solo navegador).
 *
 * La sesión vive en una cookie HttpOnly que pone el backend: este código nunca
 * la ve, solo pide al navegador que la envíe (credentials: 'include').
 * Cualquier 401 de una ruta protegida significa sesión inexistente o expirada:
 * se redirige al login.
 */
import type {
  AdminUsuario,
  EstadisticasAdmin,
  EstadoSolicitud,
  OrigenSolicitud,
  SolicitudAdmin,
  SolicitudCambios,
  SolicitudesPagina,
  ServicioAdmin,
  ServicioDatos,
  ServicioFoto,
  Cita,
  CitaDatos,
  CitasProximas,
  EstadoCita,
} from '../../../shared/api-types';

export type {
  Cita,
  CitaDatos,
  CitasProximas,
  EstadoCita,
  AdminUsuario,
  EstadisticasAdmin,
  EstadoSolicitud,
  OrigenSolicitud,
  SolicitudAdmin,
  SolicitudesPagina,
  ServicioAdmin,
  ServicioDatos,
  ServicioFoto,
};

const BASE_URL = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;
/** Las subidas de fotos pueden tardar (varias imágenes de hasta 8 MB). */
const TIMEOUT_SUBIDA_MS = 120_000;

/** URL absoluta de un archivo del backend (/media/...). */
export const mediaUrl = (ruta: string) => `${BASE_URL}${ruta}`;

export const LOGIN_PATH = '/admin/login';
export const DASHBOARD_PATH = '/admin/dashboard';

/**
 * Error con el estado HTTP (0 = sin conexión), el mensaje del servidor y, si los
 * hubo, los errores por campo (`campos`) o por archivo (`errores`).
 */
export class AdminError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly campos: Record<string, string> = {},
    readonly errores: { archivo: string; error: string }[] = [],
    /** Citas que se cruzan (409 al crear/editar una cita sin confirmar el traslape). */
    readonly traslapes: Cita[] = []
  ) {
    super(message);
  }
}

function irAlLogin(): never {
  location.replace(LOGIN_PATH);
  // La navegación ya empezó: se corta la ejecución del llamador.
  throw new AdminError(401, 'Sesión expirada');
}

async function pedir(path: string, init: RequestInit = {}): Promise<Response> {
  const esArchivo = init.body instanceof FormData; // el navegador pone el boundary del multipart
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body && !esArchivo ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(esArchivo ? TIMEOUT_SUBIDA_MS : TIMEOUT_MS),
    });
  } catch {
    throw new AdminError(0, 'No se pudo conectar con el servidor.');
  }
}

async function mensajeDe(res: Response, porDefecto: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return typeof data?.error === 'string' ? data.error : porDefecto;
}

/** Petición a una ruta protegida: 401 → login; otro error → AdminError (con campos/errores). */
async function protegido<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await pedir(path, init);
  if (res.status === 401) irAlLogin();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminError(
      res.status,
      typeof data?.error === 'string' ? data.error : `Error ${res.status}`,
      data?.campos && typeof data.campos === 'object' ? data.campos : {},
      Array.isArray(data?.errores) ? data.errores : [],
      Array.isArray(data?.traslapes) ? data.traslapes : []
    );
  }
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export interface FiltrosSolicitudes {
  estado?: EstadoSolicitud | '';
  origen?: OrigenSolicitud | '';
  q?: string;
  pagina?: number;
  por_pagina?: number;
}

export const admin = {
  /** Usuario de la sesión actual, o null si no hay sesión (sin redirigir: lo decide la página). */
  async sesion(): Promise<AdminUsuario | null> {
    const res = await pedir('/api/admin/me');
    if (res.status === 401) return null;
    if (!res.ok) throw new AdminError(res.status, await mensajeDe(res, `Error ${res.status}`));
    return (await res.json()) as AdminUsuario;
  },

  async login(correo: string, password: string): Promise<AdminUsuario> {
    const res = await pedir('/api/admin/login', { method: 'POST', body: JSON.stringify({ correo, password }) });
    if (!res.ok) throw new AdminError(res.status, await mensajeDe(res, `Error ${res.status}`));
    return (await res.json()) as AdminUsuario;
  },

  async logout(): Promise<void> {
    await pedir('/api/admin/logout', { method: 'POST' });
  },

  estadisticas: () => protegido<EstadisticasAdmin>('/api/admin/estadisticas'),

  solicitudes(filtros: FiltrosSolicitudes = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v !== undefined && v !== '') params.set(k, String(v));
    const qs = params.toString();
    return protegido<SolicitudesPagina>(`/api/admin/solicitudes${qs ? `?${qs}` : ''}`);
  },

  solicitud: (origen: OrigenSolicitud, id: number) =>
    protegido<SolicitudAdmin>(`/api/admin/solicitudes/${origen}/${id}`),

  actualizarSolicitud: (origen: OrigenSolicitud, id: number, cambios: SolicitudCambios) =>
    protegido<SolicitudAdmin>(`/api/admin/solicitudes/${origen}/${id}`, json('PATCH', cambios)),

  // ---------- Servicios ----------
  servicios: () => protegido<ServicioAdmin[]>('/api/admin/servicios'),
  servicio: (id: number) => protegido<ServicioAdmin>(`/api/admin/servicios/${id}`),
  crearServicio: (datos: ServicioDatos) => protegido<ServicioAdmin>('/api/admin/servicios', json('POST', datos)),
  editarServicio: (id: number, datos: ServicioDatos) => protegido<ServicioAdmin>(`/api/admin/servicios/${id}`, json('PUT', datos)),
  ordenarServicios: (ids: number[]) => protegido<ServicioAdmin[]>('/api/admin/servicios/orden', json('PUT', { ids })),
  eliminarServicio: (id: number) => protegido<void>(`/api/admin/servicios/${id}`, { method: 'DELETE' }),

  /** Sube una o varias fotos. Las que no se pudieron procesar vienen en `errores`. */
  subirFotos(id: number, archivos: File[]) {
    const fd = new FormData();
    for (const a of archivos) fd.append('fotos', a);
    return protegido<{ servicio: ServicioAdmin; errores: { archivo: string; error: string }[] }>(
      `/api/admin/servicios/${id}/fotos`,
      { method: 'POST', body: fd }
    );
  },
  editarFoto: (id: number, fotoId: number, cambios: { alt?: string; es_portada?: true }) =>
    protegido<ServicioAdmin>(`/api/admin/servicios/${id}/fotos/${fotoId}`, json('PATCH', cambios)),
  ordenarFotos: (id: number, ids: number[]) => protegido<ServicioAdmin>(`/api/admin/servicios/${id}/fotos/orden`, json('PUT', { ids })),
  eliminarFoto: (id: number, fotoId: number) => protegido<ServicioAdmin>(`/api/admin/servicios/${id}/fotos/${fotoId}`, { method: 'DELETE' }),

  // ---------- Citas (fechas en hora de El Salvador) ----------
  /** Citas que tocan el rango de días locales [desde, hasta] ('YYYY-MM-DD', ambos incluidos). */
  citas: (desde: string, hasta: string) => protegido<Cita[]>(`/api/admin/citas?desde=${desde}&hasta=${hasta}`),
  citasProximas: (limite = 5) => protegido<CitasProximas>(`/api/admin/citas/proximas?limite=${limite}`),
  cita: (id: number) => protegido<Cita>(`/api/admin/citas/${id}`),
  /** 409 con `traslapes` si se cruza con otra cita programada y no se confirmó. */
  crearCita: (datos: CitaDatos) => protegido<Cita>('/api/admin/citas', json('POST', datos)),
  editarCita: (id: number, datos: CitaDatos) => protegido<Cita>(`/api/admin/citas/${id}`, json('PUT', datos)),
  cancelarCita: (id: number) => protegido<Cita>(`/api/admin/citas/${id}/cancelar`, { method: 'POST' }),
};
