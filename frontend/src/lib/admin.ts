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
} from '../../../shared/api-types';

export type { AdminUsuario, EstadisticasAdmin, EstadoSolicitud, OrigenSolicitud, SolicitudAdmin, SolicitudesPagina };

const BASE_URL = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;

export const LOGIN_PATH = '/admin/login';
export const DASHBOARD_PATH = '/admin/dashboard';

/** Error con el estado HTTP (0 = sin conexión) y el mensaje del servidor, si lo hubo. */
export class AdminError extends Error {
  constructor(
    readonly status: number,
    message: string
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
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AdminError(0, 'No se pudo conectar con el servidor.');
  }
}

async function mensajeDe(res: Response, porDefecto: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return typeof data?.error === 'string' ? data.error : porDefecto;
}

/** Petición a una ruta protegida: 401 → login; otro error → AdminError. */
async function protegido<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await pedir(path, init);
  if (res.status === 401) irAlLogin();
  if (!res.ok) throw new AdminError(res.status, await mensajeDe(res, `Error ${res.status}`));
  return (await res.json()) as T;
}

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
    protegido<SolicitudAdmin>(`/api/admin/solicitudes/${origen}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),
};
