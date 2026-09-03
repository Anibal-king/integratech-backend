import { useState } from 'react';

/**
 * Widget de chat flotante ("chatea con un asesor" del wireframe).
 * De momento es solo UI: guarda los mensajes en memoria y responde con un
 * texto fijo. Cuando el backend exponga /api/chat se conecta aquí.
 */

interface Mensaje {
  de: 'usuario' | 'asesor';
  texto: string;
}

const RESPUESTA_AUTO =
  'Gracias por tu mensaje. Un asesor de IntegraTech te contactará a la brevedad. ' +
  'Si es urgente, escríbenos por el formulario de contacto.';

export default function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { de: 'asesor', texto: '¡Hola! 👋 ¿En qué servicio de ingeniería podemos ayudarte?' },
  ]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = borrador.trim();
    if (!texto) return;
    setMensajes((m) => [...m, { de: 'usuario', texto }]);
    setBorrador('');
    setTimeout(() => {
      setMensajes((m) => [...m, { de: 'asesor', texto: RESPUESTA_AUTO }]);
    }, 600);
  };

  return (
    <div className={`chat ${abierto ? 'chat--open' : ''}`}>
      {abierto && (
        <div className="chat__panel" role="dialog" aria-label="Chat con un asesor">
          <header className="chat__header">
            <span>Chatea con un asesor</span>
            <button
              type="button"
              className="chat__icon"
              aria-label="Cerrar chat"
              onClick={() => setAbierto(false)}
            >
              &times;
            </button>
          </header>

          <div className="chat__body">
            {mensajes.map((m, i) => (
              <p key={i} className={`chat__msg chat__msg--${m.de}`}>
                {m.texto}
              </p>
            ))}
          </div>

          <form className="chat__form" onSubmit={enviar}>
            <input
              type="text"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="Escribe tu mensaje…"
              aria-label="Mensaje"
            />
            <button type="submit" className="btn btn--primary">
              Enviar
            </button>
          </form>
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
          width: 64px;
          height: 64px;
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
          width: min(340px, calc(100vw - 2.5rem));
          height: 440px;
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
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .chat__icon {
          background: none;
          border: 0;
          color: #fff;
          font-size: 1.4rem;
          line-height: 1;
          cursor: pointer;
        }
        .chat__body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          background: var(--color-surface);
        }
        .chat__msg {
          margin: 0;
          padding: 0.55rem 0.8rem;
          border-radius: 12px;
          font-size: 0.9rem;
          max-width: 85%;
        }
        .chat__msg--asesor {
          background: #fff;
          border: 1px solid var(--color-border);
          align-self: flex-start;
        }
        .chat__msg--usuario {
          background: var(--color-accent);
          color: #fff;
          align-self: flex-end;
        }
        .chat__form {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem;
          border-top: 1px solid var(--color-border);
          background: #fff;
        }
        .chat__form input {
          flex: 1;
          padding: 0.55rem 0.7rem;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          font: inherit;
        }
        .chat__form .btn { padding: 0.55rem 0.9rem; }
      `}</style>
    </div>
  );
}
