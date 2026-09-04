import { useEffect, useRef, useState } from 'react';

/**
 * Chatbot de captura de leads + derivación a WhatsApp.
 *
 * Flujo (árbol de pasos): ver STEPS más abajo.
 *  1. Pregunta tipo de servicio, alcance, ubicación, plazo y datos de contacto.
 *  2. Al confirmar, hace POST a  {PUBLIC_API_URL}/api/lead-chatbot  y el backend
 *     envía un correo con el resumen al cliente.
 *  3. En cualquier momento el usuario puede pasar a WhatsApp (mensaje prellenado).
 *
 * Configuración (frontend/.env):
 *   PUBLIC_API_URL           URL del backend
 *   PUBLIC_WHATSAPP_NUMBER   número del cliente, formato 503XXXXXXXX (sin "+")
 *   PUBLIC_WHATSAPP_MESSAGE  mensaje prellenado por defecto
 */

const API_URL = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const WA_NUMBER = (import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const WA_DEFAULT_MSG =
  import.meta.env.PUBLIC_WHATSAPP_MESSAGE ??
  'Hola, escribo desde el sitio web de IntegraTech y quisiera asistencia con un proyecto de ingeniería.';

// ---------- Modelo ----------

interface Lead {
  tipo_servicio: string;
  alcance: string;
  ubicacion: string;
  plazo: string;
  nombre: string;
  empresa: string;
  correo: string;
  telefono: string;
}

const LEAD_VACIO: Lead = {
  tipo_servicio: '',
  alcance: '',
  ubicacion: '',
  plazo: '',
  nombre: '',
  empresa: '',
  correo: '',
  telefono: '',
};

type Autor = 'bot' | 'user';
interface Burbuja {
  de: Autor;
  texto: string;
}

type StepId =
  | 'inicio'
  | 'tipo_servicio'
  | 'alcance'
  | 'ubicacion'
  | 'plazo'
  | 'nombre'
  | 'empresa'
  | 'correo'
  | 'telefono'
  | 'resumen'
  | 'enviando'
  | 'enviado'
  | 'error';

interface Opcion {
  label: string;
  value?: string; // texto que se guarda / muestra como respuesta del usuario
  next?: StepId;
  action?: 'whatsapp' | 'submit' | 'reset';
}

interface Step {
  bot: string | ((l: Lead) => string);
  kind: 'choice' | 'text' | 'status';
  field?: keyof Lead;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean; // muestra botón "Omitir"
  validate?: (v: string) => string | null; // devuelve mensaje de error o null
  next?: StepId;
  options?: Opcion[];
}

const SERVICIOS = [
  'Proyectos de Automatización',
  'Soluciones Área Comercial',
  'Soluciones Área Industrial',
  'Soluciones Energía Renovable y Calidad',
  'Auditorías Energéticas',
  'Mantenimiento de Infraestructura',
  'Asesoría para Ahorro Energético',
  'Otro / No estoy seguro',
];

const STEPS: Record<StepId, Step> = {
  inicio: {
    bot: '¡Hola! 👋 Soy el asistente de IntegraTech. ¿Cómo te podemos ayudar?',
    kind: 'choice',
    options: [
      { label: '📝 Cotizar un proyecto', value: 'Quiero cotizar un proyecto', next: 'tipo_servicio' },
      { label: '💬 Hablar por WhatsApp', value: 'Prefiero WhatsApp', action: 'whatsapp' },
    ],
  },
  tipo_servicio: {
    bot: '¿Qué tipo de servicio de ingeniería necesitás?',
    kind: 'choice',
    field: 'tipo_servicio',
    next: 'alcance',
    options: SERVICIOS.map((s) => ({ label: s, value: s, next: 'alcance' })),
  },
  alcance: {
    bot: 'Contame brevemente el alcance: ¿qué necesitás resolver o qué equipos/áreas involucra?',
    kind: 'text',
    field: 'alcance',
    multiline: true,
    placeholder: 'Ej. Automatizar una línea de empaque con 3 variadores…',
    next: 'ubicacion',
  },
  ubicacion: {
    bot: '¿En qué ubicación se realizaría? (municipio y departamento)',
    kind: 'text',
    field: 'ubicacion',
    placeholder: 'Ej. Antiguo Cuscatlán, La Libertad',
    next: 'plazo',
  },
  plazo: {
    bot: '¿Para cuándo lo necesitás?',
    kind: 'choice',
    field: 'plazo',
    next: 'nombre',
    options: [
      { label: 'Lo antes posible', value: 'Lo antes posible', next: 'nombre' },
      { label: 'En 1–3 meses', value: 'En 1–3 meses', next: 'nombre' },
      { label: 'En más de 3 meses', value: 'En más de 3 meses', next: 'nombre' },
      { label: 'Solo estoy cotizando', value: 'Solo estoy cotizando', next: 'nombre' },
    ],
  },
  nombre: {
    bot: 'Perfecto. ¿Cuál es tu nombre?',
    kind: 'text',
    field: 'nombre',
    placeholder: 'Nombre y apellido',
    validate: (v) => (v.trim().length < 2 ? 'Escribe tu nombre, por favor.' : null),
    next: 'empresa',
  },
  empresa: {
    bot: '¿Nombre de tu empresa? (opcional)',
    kind: 'text',
    field: 'empresa',
    placeholder: 'Empresa u organización',
    optional: true,
    next: 'correo',
  },
  correo: {
    bot: '¿A qué correo te enviamos la propuesta? (opcional si nos dejas un teléfono)',
    kind: 'text',
    field: 'correo',
    placeholder: 'nombre@empresa.com',
    optional: true,
    validate: (v) =>
      v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Ese correo no parece válido.' : null,
    next: 'telefono',
  },
  telefono: {
    bot: 'Por último, ¿un teléfono o WhatsApp de contacto?',
    kind: 'text',
    field: 'telefono',
    placeholder: 'Ej. 7777-7777',
    validate: (v) => (v.replace(/\D/g, '').length < 7 ? 'Escribe un número de al menos 7 dígitos.' : null),
    next: 'resumen',
  },
  resumen: {
    bot: 'Revisá el resumen antes de enviarlo:',
    kind: 'choice',
    options: [
      { label: '✅ Enviar solicitud', action: 'submit' },
      { label: '↺ Empezar de nuevo', action: 'reset' },
      { label: '💬 Mejor por WhatsApp', action: 'whatsapp' },
    ],
  },
  enviando: { bot: 'Enviando tu solicitud…', kind: 'status' },
  enviado: {
    bot: '¡Listo! ✅ Tu solicitud fue enviada. Un asesor de IntegraTech te contactará con la estimación.',
    kind: 'choice',
    options: [
      { label: '💬 Continuar por WhatsApp', action: 'whatsapp' },
      { label: '↺ Nueva consulta', action: 'reset' },
    ],
  },
  error: {
    bot: 'No pudimos enviar la solicitud. Podés reintentar o escribirnos por WhatsApp.',
    kind: 'choice',
    options: [
      { label: '↻ Reintentar', action: 'submit' },
      { label: '💬 WhatsApp', action: 'whatsapp' },
      { label: '↺ Empezar de nuevo', action: 'reset' },
    ],
  },
};

// ---------- Helpers ----------

function textoBot(step: Step, lead: Lead): string {
  return typeof step.bot === 'function' ? step.bot(lead) : step.bot;
}

function resumenLead(l: Lead): string {
  const linea = (k: string, v: string) => (v ? `• ${k}: ${v}\n` : '');
  return (
    linea('Servicio', l.tipo_servicio) +
    linea('Alcance', l.alcance) +
    linea('Ubicación', l.ubicacion) +
    linea('Plazo', l.plazo) +
    linea('Nombre', l.nombre) +
    linea('Empresa', l.empresa) +
    linea('Correo', l.correo) +
    linea('Teléfono', l.telefono)
  ).trim();
}

function abrirWhatsApp(lead: Lead) {
  if (!WA_NUMBER) {
    alert('El número de WhatsApp aún no está configurado (PUBLIC_WHATSAPP_NUMBER).');
    return;
  }
  const tieneDatos = lead.nombre || lead.tipo_servicio || lead.alcance;
  const cuerpo = tieneDatos
    ? `Hola, soy ${lead.nombre || '(nombre)'}. Escribo desde el sitio web de IntegraTech.\n\n` +
      `Mi consulta:\n${resumenLead(lead) || WA_DEFAULT_MSG}`
    : WA_DEFAULT_MSG;
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(cuerpo)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------- Componente ----------

export default function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [stepId, setStepId] = useState<StepId>('inicio');
  const [lead, setLead] = useState<Lead>(LEAD_VACIO);
  const [borrador, setBorrador] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Burbuja[]>([{ de: 'bot', texto: textoBot(STEPS.inicio, LEAD_VACIO) }]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const step = STEPS[stepId];

  // Autoscroll al último mensaje
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, stepId]);

  const push = (b: Burbuja) => setMensajes((m) => [...m, b]);
  const pushBot = (texto: string) => push({ de: 'bot', texto });

  function irA(next: StepId, leadActual: Lead) {
    setStepId(next);
    setBorrador('');
    setErrorCampo(null);
    const t = textoBot(STEPS[next], leadActual);
    if (t) pushBot(t);
    if (next === 'resumen') {
      pushBot(resumenLead(leadActual) || '(sin datos)');
    }
    if (next === 'enviando') enviar(leadActual);
  }

  function reset() {
    setLead(LEAD_VACIO);
    setStepId('inicio');
    setBorrador('');
    setErrorCampo(null);
    setMensajes([{ de: 'bot', texto: textoBot(STEPS.inicio, LEAD_VACIO) }]);
  }

  function ejecutarAccion(accion: NonNullable<Opcion['action']>, leadActual: Lead) {
    if (accion === 'whatsapp') {
      abrirWhatsApp(leadActual);
      return;
    }
    if (accion === 'reset') {
      reset();
      return;
    }
    if (accion === 'submit') {
      irA('enviando', leadActual);
    }
  }

  function elegirOpcion(op: Opcion) {
    push({ de: 'user', texto: op.value ?? op.label });
    const nuevoLead = step.field && op.value ? { ...lead, [step.field]: op.value } : lead;
    if (step.field && op.value) setLead(nuevoLead);
    if (op.action) {
      ejecutarAccion(op.action, nuevoLead);
      return;
    }
    if (op.next) irA(op.next, nuevoLead);
  }

  function enviarTexto(omitir = false) {
    if (step.kind !== 'text' || !step.field) return;
    const valor = omitir ? '' : borrador.trim();

    if (!omitir) {
      if (!valor && !step.optional) {
        setErrorCampo('Este dato es necesario para continuar.');
        return;
      }
      const err = step.validate?.(valor);
      if (err) {
        setErrorCampo(err);
        return;
      }
    }

    push({ de: 'user', texto: valor || '(omitido)' });
    const nuevoLead = { ...lead, [step.field]: valor };
    setLead(nuevoLead);
    if (step.next) irA(step.next, nuevoLead);
  }

  async function enviar(leadActual: Lead) {
    try {
      const res = await fetch(`${API_URL}/api/lead-chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadActual, origen: 'chatbot' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setStepId('enviado');
      pushBot(textoBot(STEPS.enviado, leadActual));
      if (data.emailSent === false) {
        pushBot('(Tu solicitud quedó registrada; la notificación por correo se enviará cuando el equipo configure el buzón.)');
      }
    } catch (e) {
      setStepId('error');
      pushBot(`${textoBot(STEPS.error, leadActual)}\n\nDetalle: ${(e as Error).message}`);
    }
  }

  const mostrarWhatsAppEnInicio = WA_NUMBER !== '';

  return (
    <div className={`chat ${abierto ? 'chat--open' : ''}`}>
      {abierto && (
        <div className="chat__panel" role="dialog" aria-label="Asistente de cotización">
          <header className="chat__header">
            <span>Asistente IntegraTech</span>
            <button type="button" className="chat__icon" aria-label="Cerrar" onClick={() => setAbierto(false)}>
              &times;
            </button>
          </header>

          <div className="chat__body" ref={bodyRef}>
            {mensajes.map((m, i) => (
              <p key={i} className={`chat__msg chat__msg--${m.de}`}>
                {m.texto}
              </p>
            ))}
            {stepId === 'enviando' && <p className="chat__msg chat__msg--bot chat__typing">···</p>}
          </div>

          <div className="chat__controls">
            {step.kind === 'choice' && (
              <div className="chat__quick">
                {step.options
                  ?.filter((op) => op.action !== 'whatsapp' || mostrarWhatsAppEnInicio || stepId !== 'inicio')
                  .map((op, i) => (
                    <button key={i} type="button" className="chat__chip" onClick={() => elegirOpcion(op)}>
                      {op.label}
                    </button>
                  ))}
              </div>
            )}

            {step.kind === 'text' && (
              <form
                className="chat__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarTexto(false);
                }}
              >
                {step.multiline ? (
                  <textarea
                    autoFocus
                    rows={2}
                    value={borrador}
                    placeholder={step.placeholder}
                    onChange={(e) => setBorrador(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarTexto(false);
                      }
                    }}
                    aria-label="Tu respuesta"
                  />
                ) : (
                  <input
                    autoFocus
                    type="text"
                    value={borrador}
                    placeholder={step.placeholder}
                    onChange={(e) => setBorrador(e.target.value)}
                    aria-label="Tu respuesta"
                  />
                )}
                <div className="chat__form-actions">
                  {step.optional && (
                    <button type="button" className="chat__link" onClick={() => enviarTexto(true)}>
                      Omitir
                    </button>
                  )}
                  <button type="submit" className="btn btn--primary">
                    Enviar
                  </button>
                </div>
                {errorCampo && <p className="chat__error">{errorCampo}</p>}
              </form>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="chat__fab"
        aria-expanded={abierto}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir chat'}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? '×' : 'Chat'}
      </button>

      <style>{`
        .chat {
          position: fixed;
          right: 1.25rem;
          bottom: 1.25rem;
          z-index: 50;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.75rem;
        }
        .chat__fab {
          width: 64px; height: 64px;
          border-radius: 50%;
          border: 0;
          background: var(--color-accent);
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          box-shadow: var(--shadow-lg);
        }
        .chat__fab:hover { background: var(--color-accent-600); }
        .chat__panel {
          width: min(360px, calc(100vw - 2.5rem));
          height: min(560px, calc(100vh - 7rem));
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 16px;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .chat__header {
          background: var(--color-primary);
          color: #fff;
          padding: 0.85rem 1rem;
          font-weight: 600;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .chat__icon {
          background: none; border: 0; color: #fff;
          font-size: 1.4rem; line-height: 1; cursor: pointer;
        }
        .chat__body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          background: var(--color-surface);
        }
        .chat__msg {
          margin: 0;
          padding: 0.55rem 0.8rem;
          border-radius: 12px;
          font-size: 0.9rem;
          line-height: 1.45;
          max-width: 88%;
          white-space: pre-wrap;
        }
        .chat__msg--bot {
          background: #fff;
          border: 1px solid var(--color-border);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        .chat__msg--user {
          background: var(--color-accent);
          color: #fff;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        .chat__typing { letter-spacing: 2px; opacity: 0.6; }
        .chat__controls {
          border-top: 1px solid var(--color-border);
          background: #fff;
          padding: 0.75rem;
          flex-shrink: 0;
        }
        .chat__quick { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .chat__chip {
          border: 1px solid var(--color-accent);
          color: var(--color-accent-600);
          background: #fff;
          border-radius: 999px;
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.14s ease, color 0.14s ease;
        }
        .chat__chip:hover { background: var(--color-accent); color: #fff; }
        .chat__form { display: flex; flex-direction: column; gap: 0.5rem; }
        .chat__form input,
        .chat__form textarea {
          width: 100%;
          font: inherit;
          padding: 0.55rem 0.7rem;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          resize: vertical;
        }
        .chat__form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
        }
        .chat__form .btn { padding: 0.5rem 1rem; }
        .chat__link {
          background: none;
          border: 0;
          color: var(--color-text-muted);
          font: inherit;
          font-size: 0.85rem;
          text-decoration: underline;
          cursor: pointer;
        }
        .chat__error { margin: 0; color: var(--color-error); font-size: 0.82rem; }
      `}</style>
    </div>
  );
}
