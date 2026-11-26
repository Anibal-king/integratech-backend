import { useEffect, useRef, useState } from 'react';
import { api, ContactoError } from '../lib/api';
import { enlaceCotizacion, enlaceDirecto, soloDigitos, whatsappCliente } from '../lib/whatsapp';

/**
 * Botón flotante de WhatsApp para cotizar (sin API de WhatsApp).
 *
 *  1. Toca el botón → formulario corto en un <dialog>.
 *  2. POST /api/cotizaciones crea el ticket y devuelve su número.
 *  3. Confirmación con un ENLACE "Continuar en WhatsApp" (wa.me con el número de
 *     ticket en el mensaje). Es un <a> que el usuario toca: un window.open después
 *     del fetch lo bloquearían los navegadores.
 *
 * Configuración (frontend/.env):
 *   PUBLIC_WHATSAPP_NUMBER  número de IntegraTech, solo dígitos con código de país (503XXXXXXXX)
 */

const NUMERO = soloDigitos(import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? '');
const CODIGO_PAIS = '503';

/** Lista de respaldo si la API no responde; se reemplaza con los servicios publicados. */
const OTRO = 'Otro / No estoy seguro';
const TIPOS_RESPALDO = [
  'Proyectos de Automatización',
  'Soluciones Área Comercial',
  'Soluciones Área Industrial',
  'Soluciones Energía Renovable y Calidad',
  'Auditorías Energéticas',
  'Mantenimiento de Infraestructura',
];
const PRESUPUESTOS = ['Menos de $1,000', '$1,000 – $5,000', '$5,000 – $20,000', 'Más de $20,000', 'Aún no lo sé'];

type Estado =
  | { tipo: 'form' }
  | { tipo: 'enviando' }
  | { tipo: 'listo'; ticket: number; enlace: string }
  | { tipo: 'error'; msg: string };

/** Fecha local de hoy 'YYYY-MM-DD' (mínimo del selector de fecha). */
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function IconoWhatsApp({ tamano = 30 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.45 9.43m8.04-17.47A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.62l6.02-1.58a11.3 11.3 0 0 0 5.44 1.39h.01c6.26 0 11.36-5.1 11.37-11.36 0-3.04-1.18-5.89-3.33-8.04" />
    </svg>
  );
}

export default function WhatsAppCotizar() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: 'form' });
  const [tipos, setTipos] = useState<string[]>(TIPOS_RESPALDO);
  const [pedidoTipos, setPedidoTipos] = useState(false);

  // Servicios publicados en el panel, solo la primera vez que se abre el formulario.
  useEffect(() => {
    if (!pedidoTipos) return;
    api
      .servicios()
      .then((r) => {
        if (r.status === 'ok') setTipos(r.data.map((s) => s.nombre));
      })
      .catch(() => {});
  }, [pedidoTipos]);

  if (!NUMERO) {
    if (import.meta.env.DEV) console.warn('[WhatsAppCotizar] PUBLIC_WHATSAPP_NUMBER no está configurado: no se muestra el botón.');
    return null;
  }

  const abrir = () => {
    setPedidoTipos(true);
    if (estado.tipo === 'listo' || estado.tipo === 'error') setEstado({ tipo: 'form' });
    dialogo.current?.showModal();
  };
  const cerrar = () => dialogo.current?.close();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const v = (k: string) => String(fd.get(k) ?? '').trim();

    const nombre = v('nombre');
    const descripcion = v('descripcion');
    if (nombre.length < 2) return setEstado({ tipo: 'error', msg: 'Escribe tu nombre.' });
    const wa = whatsappCliente(v('codigo_pais'), v('whatsapp'));
    if (!wa.ok) return setEstado({ tipo: 'error', msg: wa.error });
    if (descripcion.length < 10) return setEstado({ tipo: 'error', msg: 'Cuéntanos un poco más del proyecto (mínimo 10 caracteres).' });

    const tipo = v('tipo_proyecto');
    setEstado({ tipo: 'enviando' });
    try {
      const { ticket } = await api.enviarCotizacion({
        nombre,
        whatsapp: wa.valor,
        tipo_proyecto: tipo,
        descripcion,
        presupuesto: v('presupuesto'),
        fecha_deseada: v('fecha_deseada'),
        sitio_web: v('sitio_web'),
      });
      setEstado({ tipo: 'listo', ticket, enlace: enlaceCotizacion(NUMERO, ticket, nombre, tipo) });
      form.reset();
    } catch (err) {
      const msg =
        err instanceof ContactoError && err.esDelVisitante
          ? err.mensajeServidor
          : 'No pudimos registrar tu solicitud. Intenta de nuevo o escríbenos directo por WhatsApp.';
      if (import.meta.env.DEV) console.error('[WhatsAppCotizar]', err);
      setEstado({ tipo: 'error', msg });
    }
  };

  const enviando = estado.tipo === 'enviando';

  return (
    <>
      <button type="button" className="wa-fab" aria-label="Cotizar un proyecto por WhatsApp" aria-haspopup="dialog" onClick={abrir}>
        <IconoWhatsApp />
      </button>

      <dialog
        ref={dialogo}
        className="wa-dialogo"
        aria-labelledby="wa-titulo"
        // Clic en el fondo (fuera de la tarjeta) cierra.
        onClick={(e) => e.target === e.currentTarget && cerrar()}
      >
        <div className="wa-tarjeta">
          <header className="wa-cabecera">
            <span className="wa-cabecera__icono"><IconoWhatsApp tamano={22} /></span>
            <h2 id="wa-titulo">{estado.tipo === 'listo' ? '¡Solicitud registrada!' : 'Cotiza tu proyecto'}</h2>
            <button type="button" className="wa-cerrar" aria-label="Cerrar" onClick={cerrar}>×</button>
          </header>

          {estado.tipo === 'listo' ? (
            <div className="wa-listo">
              <p className="wa-ticket">
                Tu número de cotización es <strong>#{estado.ticket}</strong>
              </p>
              <p>Toca el botón para abrir WhatsApp con el mensaje listo. Solo tienes que enviarlo.</p>
              <a className="btn wa-continuar" href={estado.enlace} target="_blank" rel="noopener noreferrer">
                <IconoWhatsApp tamano={24} /> Continuar en WhatsApp
              </a>
              <button type="button" className="wa-enlace" onClick={cerrar}>Cerrar</button>
            </div>
          ) : (
            <form className="wa-form" onSubmit={onSubmit} noValidate>
              <p className="wa-intro">Déjanos unos datos y seguimos la conversación por WhatsApp.</p>

              <label>
                Nombre *
                <input name="nombre" type="text" required minLength={2} maxLength={120} autoComplete="name" />
              </label>

              <fieldset className="wa-tel">
                <legend>Tu WhatsApp *</legend>
                <label className="wa-tel__cod">
                  <span className="sr-only">Código de país</span>
                  <span aria-hidden="true">+</span>
                  <input name="codigo_pais" type="tel" inputMode="numeric" defaultValue={CODIGO_PAIS} maxLength={4} required autoComplete="tel-country-code" />
                </label>
                <label className="wa-tel__num">
                  <span className="sr-only">Número</span>
                  <input name="whatsapp" type="tel" inputMode="tel" required maxLength={20} placeholder="7000 0000" autoComplete="tel-national" />
                </label>
              </fieldset>

              <label>
                Tipo de proyecto
                <select name="tipo_proyecto" defaultValue="">
                  <option value="">Selecciona una opción</option>
                  {[...tipos, OTRO].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label>
                Descripción breve *
                <textarea name="descripcion" rows={3} required minLength={10} maxLength={2000} placeholder="Ej.: instalación eléctrica para una bodega de 500 m²" />
              </label>

              <div className="wa-fila">
                <label>
                  Presupuesto aprox.
                  <select name="presupuesto" defaultValue="">
                    <option value="">Opcional</option>
                    {PRESUPUESTOS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha deseada
                  <input name="fecha_deseada" type="date" min={hoy()} />
                </label>
              </div>

              {/* Trampa para bots: invisible y fuera del orden de tabulación. */}
              <div className="wa-trampa" aria-hidden="true">
                <label>
                  No llenar
                  <input name="sitio_web" type="text" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              {estado.tipo === 'error' && <p className="wa-error" role="alert">{estado.msg}</p>}

              <button type="submit" className="btn btn--primary wa-enviar" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar y continuar'}
              </button>

              <a className="wa-enlace" href={enlaceDirecto(NUMERO)} target="_blank" rel="noopener noreferrer">
                Prefiero escribir directo por WhatsApp
              </a>
            </form>
          )}
        </div>
      </dialog>

      <style>{`
        .wa-fab {
          position: fixed;
          right: 1.25rem;
          bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
          z-index: 50;
          width: 64px; height: 64px;
          border-radius: 50%;
          border: 0;
          display: grid; place-items: center;
          background: #25d366;
          color: #fff;
          cursor: pointer;
          box-shadow: var(--shadow-lg);
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .wa-fab:hover { filter: brightness(1.05); transform: translateY(-2px); }
        .wa-fab:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }

        .wa-dialogo {
          padding: 0;
          border: 0;
          background: transparent;
          width: min(440px, calc(100vw - 2rem));
          max-height: calc(100dvh - 2rem);
          overflow: visible;
        }
        .wa-dialogo::backdrop { background: rgb(5 20 38 / 0.55); }
        .wa-tarjeta {
          background: var(--surface-card, #fff);
          color: var(--text);
          border-radius: 16px;
          box-shadow: var(--shadow-lg);
          max-height: calc(100dvh - 2rem);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .wa-cabecera {
          position: sticky; top: 0; z-index: 1;
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.9rem 1rem;
          background: var(--color-navy-deep);
          color: var(--color-white);
        }
        .wa-cabecera h2 { margin: 0; flex: 1; font-size: 1.1rem; color: inherit; }
        .wa-cabecera__icono { color: #25d366; display: inline-flex; }
        .wa-cerrar {
          background: none; border: 0; color: inherit;
          font-size: 1.75rem; line-height: 1; cursor: pointer;
          width: 44px; height: 44px; margin: -0.5rem -0.5rem -0.5rem 0;
        }

        .wa-form, .wa-listo { display: flex; flex-direction: column; gap: 0.9rem; padding: 1rem 1.1rem 1.25rem; }
        .wa-intro { margin: 0; color: var(--text-muted); font-size: 0.92rem; }
        .wa-form label, .wa-tel legend {
          display: flex; flex-direction: column; gap: 0.35rem;
          font-weight: 600; font-size: 0.88rem; color: var(--text);
        }
        .wa-form input, .wa-form select, .wa-form textarea {
          font: inherit;
          font-size: 16px; /* evita el zoom automático de iOS */
          font-weight: 400;
          min-height: 48px;
          width: 100%;
          padding: 0.65rem 0.8rem;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          background: var(--input-bg);
          color: var(--text);
        }
        .wa-form textarea { resize: vertical; }
        .wa-form input:focus-visible, .wa-form select:focus-visible, .wa-form textarea:focus-visible {
          outline: 2px solid var(--focus-ring); outline-offset: 1px;
        }
        .wa-tel { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: 6.5rem 1fr; gap: 0.5rem; }
        .wa-tel legend { grid-column: 1 / -1; padding: 0; margin-bottom: 0.35rem; }
        .wa-tel__cod { flex-direction: row !important; align-items: center; gap: 0.25rem !important; }
        .wa-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .wa-trampa { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
        .wa-error { margin: 0; color: var(--danger-text); font-size: 0.9rem; }
        .wa-enviar { min-height: 50px; width: 100%; justify-content: center; }
        .wa-enlace {
          align-self: center;
          background: none; border: 0; padding: 0.5rem;
          font: inherit; font-size: 0.88rem;
          color: var(--text-muted);
          text-decoration: underline;
          cursor: pointer;
        }

        .wa-ticket { margin: 0; font-size: 1.15rem; }
        .wa-ticket strong { font-size: 1.5rem; color: var(--heading); }
        .wa-listo p { margin: 0; }
        .wa-continuar {
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          min-height: 56px;
          font-size: 1.1rem; font-weight: 700;
          background: #25d366; color: #fff;
          border-radius: var(--radius-btn);
          text-decoration: none;
        }
        .wa-continuar:hover { filter: brightness(1.05); color: #fff; }

        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }

        /* Celular: hoja que sube desde abajo, a todo lo ancho. */
        @media (max-width: 600px) {
          .wa-dialogo { width: 100vw; max-width: 100vw; margin: auto 0 0; max-height: 92dvh; }
          .wa-tarjeta { border-radius: 16px 16px 0 0; max-height: 92dvh; padding-bottom: env(safe-area-inset-bottom, 0px); }
          .wa-fila { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
