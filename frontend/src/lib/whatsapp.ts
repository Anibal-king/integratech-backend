/**
 * Enlaces a WhatsApp (wa.me) sin API: el usuario los toca y se abre su app.
 * Funciones puras (sin import.meta.env) para poder probarlas con `node --test`.
 */

/** Solo dígitos: "+503 7000-0000" → "50370000000". */
export const soloDigitos = (s: string) => s.replace(/\D/g, '');

/** https://wa.me/<numero>?text=<texto codificado>. Sin texto, solo el chat. */
export function enlaceWa(numero: string, texto?: string): string {
  const base = `https://wa.me/${soloDigitos(numero)}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

/** Mensaje con el que el cliente llega al WhatsApp de IntegraTech. */
export function mensajeCotizacion(ticket: number, nombre: string, tipo: string): string {
  const proyecto = tipo.trim() || 'por definir';
  return `Hola IntegraTech 👋 Vengo por la cotización #${ticket}. Soy ${nombre.trim()}, proyecto: ${proyecto}.`;
}

export const MENSAJE_DIRECTO = 'Hola IntegraTech, quiero cotizar un proyecto';

/** Enlace para continuar en WhatsApp con el número de ticket. */
export const enlaceCotizacion = (numeroEmpresa: string, ticket: number, nombre: string, tipo: string) =>
  enlaceWa(numeroEmpresa, mensajeCotizacion(ticket, nombre, tipo));

/** Enlace "Prefiero escribir directo" (no crea ticket). */
export const enlaceDirecto = (numeroEmpresa: string) => enlaceWa(numeroEmpresa, MENSAJE_DIRECTO);

/**
 * WhatsApp del cliente a partir del código de país y el número que escribió.
 * Devuelve los dígitos completos o un mensaje de error (mismas reglas que el backend).
 */
export function whatsappCliente(codigoPais: string, numero: string): { ok: true; valor: string } | { ok: false; error: string } {
  const cod = soloDigitos(codigoPais);
  const num = soloDigitos(numero);
  if (!num) return { ok: false, error: 'Escribe tu número de WhatsApp.' };
  if (!/^\+?[\d\s()-]+$/.test(numero.trim())) return { ok: false, error: 'El número solo puede llevar dígitos.' };
  if (!cod || cod.length > 4) return { ok: false, error: 'Revisa el código de país.' };
  const completo = `${cod}${num}`;
  if (completo.length < 10 || completo.length > 15) return { ok: false, error: 'El número no parece válido para ese código de país.' };
  return { ok: true, valor: completo };
}
