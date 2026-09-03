/**
 * Cliente tipado para la API REST de SIIE (backend/).
 * La URL base se toma de la variable de entorno PUBLIC_API_URL.
 *
 * Todas las funciones son tolerantes a fallos: si el backend no responde,
 * registran una advertencia y devuelven un valor por defecto vacío para que
 * las páginas rendericen igual (con estado "sin datos") en vez de romper.
 */

const BASE_URL = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// ---------- Tipos ----------

export interface Valor {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface Empresa {
  id: number;
  nombre: string;
  sitio_web: string;
  direccion: string;
  telefono: string;
  celular: string;
  registro_fiscal: string;
  nit: string;
  resena_historica: string;
  mision: string;
  vision: string;
  valores: Valor[];
}

export interface CategoriaServicio {
  id: number;
  nombre: string;
  descripcion: string;
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

export interface ContratoMantenimiento {
  id: number;
  nombre_proyecto: string;
  ejecucion: string | null;
  descripcion: string | null;
}

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

export interface ContactoPayload {
  nombre: string;
  correo?: string;
  telefono?: string;
  empresa?: string;
  mensaje: string;
}

// ---------- Helper ----------

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn(`[api] GET ${path} -> ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[api] GET ${path} falló (¿backend levantado en ${BASE_URL}?):`, (err as Error).message);
    return fallback;
  }
}

// ---------- Endpoints ----------

export const api = {
  baseUrl: BASE_URL,

  empresa: () =>
    get<Empresa | null>('/api/empresa', null),

  servicios: () =>
    get<CategoriaServicio[]>('/api/servicios', []),

  servicio: (id: number | string) =>
    get<CategoriaServicio | null>(`/api/servicios/${id}`, null),

  clientes: () =>
    get<Cliente[]>('/api/clientes', []),

  otrosClientes: () =>
    get<OtroCliente[]>('/api/clientes/otros/lista', []),

  proyectos: (anio?: string | number) =>
    get<Proyecto[]>(`/api/proyectos${anio ? `?anio=${anio}` : ''}`, []),

  contratosMantenimiento: () =>
    get<ContratoMantenimiento[]>('/api/proyectos/contratos-mantenimiento', []),

  marcas: () =>
    get<Marca[]>('/api/marcas', []),

  legal: () =>
    get<DocumentoLegal[]>('/api/legal', []),

  /** Envía el formulario de contacto. Lanza si falla (lo maneja el componente). */
  async enviarContacto(payload: ContactoPayload): Promise<{ ok: boolean; id: number }> {
    const res = await fetch(`${BASE_URL}/api/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? `Error ${res.status} al enviar el mensaje`);
    }
    return data;
  },
};
