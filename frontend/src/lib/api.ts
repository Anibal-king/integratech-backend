/**
 * Cliente tipado para la API REST de SIIE (backend/).
 * La URL base se toma de la variable de entorno PUBLIC_API_URL.
 *
 * Los tipos vienen de shared/api-types.ts (el mismo contrato que usa el backend).
 * Cada GET devuelve un ApiResult que distingue cuatro situaciones:
 *   - 'network': el backend no respondió (apagado, URL errónea o timeout)
 *   - 'http':    respondió con 4xx/5xx
 *   - 'invalid': respondió 200 pero con una estructura que no cumple el contrato
 *   - 'empty':   respondió bien pero sin datos (no es un error)
 *   - 'ok':      datos listos
 *
 * Los GET corren en el frontmatter de Astro (servidor en dev, `astro build` en
 * producción): el backend debe estar levantado durante el build.
 */

import type {
  CategoriaServicio,
  Cliente,
  ContactoPayload,
  ContactoRespuesta,
  ContratoMantenimiento,
  DocumentoLegal,
  Empresa,
  Marca,
  OtroCliente,
  Proyecto,
} from '../../../shared/api-types';

export type {
  ServicioFoto,
  CategoriaServicio,
  Cliente,
  ContactoPayload,
  ContratoMantenimiento,
  DocumentoLegal,
  Empresa,
  Marca,
  OtroCliente,
  Proyecto,
  Valor,
} from '../../../shared/api-types';

const BASE_URL = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
/**
 * Las páginas que dependen de servicios se renderizan en cada visita: si la API
 * no responde, mejor mostrar el aviso pronto que dejar la página esperando.
 */
export const TIMEOUT_MS = 4000;

/** URL absoluta de un archivo del backend (/media/...). */
export const mediaUrl = (ruta: string) => `${BASE_URL}${ruta}`;

/** srcset con URLs absolutas a partir del srcset relativo que devuelve la API. */
export const mediaSrcset = (srcset: string) =>
  srcset
    .split(',')
    .map((parte) => mediaUrl(parte.trim()))
    .join(', ');

// ---------- Resultado ----------

export type ApiFailure =
  | { status: 'network'; detail: string }
  | { status: 'http'; code: number; detail: string }
  | { status: 'invalid'; detail: string };

export type ApiResult<T> = { status: 'ok'; data: T } | { status: 'empty' } | ApiFailure;

/** Datos si el resultado es 'ok'; si no, el valor por defecto. */
export function dataOr<T, F>(result: ApiResult<T>, fallback: F): T | F {
  return result.status === 'ok' ? result.data : fallback;
}

// ---------- Validación mínima del contrato ----------
// Comprueba la forma (tipos de las propiedades) sin dependencias externas.

type Campo = 'string' | 'number' | 'string?' | 'string[]';
type Forma = Record<string, Campo>;

function cumple(valor: unknown, forma: Forma): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const obj = valor as Record<string, unknown>;
  return Object.entries(forma).every(([clave, tipo]) => {
    const v = obj[clave];
    switch (tipo) {
      case 'string?':
        return v === null || v === undefined || typeof v === 'string';
      case 'string[]':
        return Array.isArray(v) && v.every((x) => typeof x === 'string');
      default:
        return typeof v === tipo;
    }
  });
}

const FORMAS = {
  categoria: { id: 'number', nombre: 'string', descripcion: 'string?', descripcion_larga: 'string?', items: 'string[]' },
  foto: { id: 'number', alt: 'string', src: 'string', srcset: 'string', ancho: 'number', alto: 'number' },
  cliente: { id: 'number', nombre: 'string', servicios: 'string[]' },
  otroCliente: { id: 'number', nombre: 'string' },
  proyecto: { id: 'number', nombre_proyecto: 'string', ejecucion: 'string?', descripcion: 'string?' },
  marca: { id: 'number', nombre: 'string', funcion: 'string?' },
  legal: { id: 'number', tipo: 'string', numero: 'string?', fecha_expedicion: 'string?', descripcion: 'string?' },
  empresa: { id: 'number', nombre: 'string', mision: 'string?', vision: 'string?', resena_historica: 'string?' },
  valor: { id: 'number', nombre: 'string', descripcion: 'string?' },
} satisfies Record<string, Forma>;

const lista = (forma: Forma) => (v: unknown) => Array.isArray(v) && v.every((x) => cumple(x, forma));
const esServicio = (v: unknown) => {
  if (!cumple(v, FORMAS.categoria)) return false;
  const { portada, fotos } = v as { portada?: unknown; fotos?: unknown };
  return (portada === null || cumple(portada, FORMAS.foto)) && lista(FORMAS.foto)(fotos);
};
const esEmpresa = (v: unknown) =>
  cumple(v, FORMAS.empresa) && lista(FORMAS.valor)((v as { valores?: unknown }).valores);

// ---------- Helper ----------

/** Error de red legible (incluye el timeout). Solo se muestra en desarrollo. */
function describirErrorRed(err: unknown): string {
  const e = err as Error;
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return `sin respuesta en ${TIMEOUT_MS / 1000}s`;
  const causa = (e as Error & { cause?: { code?: string } })?.cause?.code;
  return causa ? `${e.message} (${causa})` : (e?.message ?? String(err));
}

/**
 * GET con timeout y validación.
 * `isEmpty` decide cuándo una respuesta válida cuenta como "sin datos".
 */
async function get<T>(
  path: string,
  isValid: (v: unknown) => boolean,
  isEmpty: (v: T) => boolean,
): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const detail = `Error de red en GET ${url}: ${describirErrorRed(err)}`;
    console.error(`[api] ${detail}`);
    return { status: 'network', detail };
  }

  if (!res.ok) {
    const detail = `HTTP ${res.status} en GET ${url}`;
    // Un 404 es una respuesta esperada (p. ej. servicio oculto o dirección inventada), no un fallo.
    if (res.status !== 404) console.error(`[api] ${detail}`);
    return { status: 'http', code: res.status, detail };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    const detail = `Respuesta no JSON en GET ${url}`;
    console.error(`[api] ${detail}`);
    return { status: 'invalid', detail };
  }

  if (!isValid(body)) {
    const detail = `Formato inválido en GET ${url}: no cumple el contrato de shared/api-types.ts`;
    console.error(`[api] ${detail}`, body);
    return { status: 'invalid', detail };
  }

  const data = body as T;
  return isEmpty(data) ? { status: 'empty' } : { status: 'ok', data };
}

const vacia = (v: unknown[]) => v.length === 0;
const getLista = <T>(path: string, forma: Forma) => get<T[]>(path, lista(forma), vacia);

/** Rechazo del servidor al enviar el formulario (validación, límite de envíos o error interno). */
export class ContactoError extends Error {
  readonly status: number;
  readonly mensajeServidor: string;

  constructor(status: number, mensajeServidor: string) {
    super(`HTTP ${status}: ${mensajeServidor}`);
    this.status = status;
    this.mensajeServidor = mensajeServidor;
  }

  /** 400 y 429 traen un mensaje apto para mostrar al visitante. */
  get esDelVisitante() {
    return this.status === 400 || this.status === 429;
  }
}

// ---------- Endpoints ----------

export const api = {
  baseUrl: BASE_URL,

  /** null (empresa no configurada) cuenta como vacío. */
  empresa: () =>
    get<Empresa | null>('/api/empresa', (v) => v === null || esEmpresa(v), (v) => v === null) as Promise<
      ApiResult<Empresa>
    >,

  servicios: () =>
    get<CategoriaServicio[]>('/api/servicios', (v) => Array.isArray(v) && v.every(esServicio), vacia),

  /** Un servicio publicado; { status: 'http', code: 404 } si no existe o está oculto. */
  servicio: (id: number | string) => get<CategoriaServicio>(`/api/servicios/${id}`, esServicio, () => false),

  clientes: () => getLista<Cliente>('/api/clientes', FORMAS.cliente),

  otrosClientes: () => getLista<OtroCliente>('/api/clientes/otros/lista', FORMAS.otroCliente),

  proyectos: (anio?: string | number) =>
    getLista<Proyecto>(`/api/proyectos${anio ? `?anio=${anio}` : ''}`, FORMAS.proyecto),

  contratosMantenimiento: () =>
    getLista<ContratoMantenimiento>('/api/proyectos/contratos-mantenimiento', FORMAS.proyecto),

  marcas: () => getLista<Marca>('/api/marcas', FORMAS.marca),

  legal: () => getLista<DocumentoLegal>('/api/legal', FORMAS.legal),

  /**
   * Envía el formulario de contacto (desde el navegador). Lanza si falla (lo maneja el componente):
   * ContactoError con el mensaje del servidor para 400/429 (texto pensado para el visitante).
   */
  async enviarContacto(payload: ContactoPayload): Promise<ContactoRespuesta> {
    const res = await fetch(`${BASE_URL}/api/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ContactoError(res.status, data?.error ?? 'Error al enviar el mensaje');
    }
    return data as ContactoRespuesta;
  },
};
