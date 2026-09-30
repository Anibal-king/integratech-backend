/**
 * Recuadro de estado para islas React (misma apariencia que StatusMessage.astro).
 * Solo usa los tokens --placeholder-*: se adapta a la superficie donde esté.
 * El detalle técnico solo se muestra en desarrollo; en producción va a console.error.
 */
import { useEffect } from 'react';

interface Props {
  tipo?: 'loading' | 'error' | 'empty' | 'success';
  mensaje: string;
  detalle?: string;
  onRetry?: () => void;
}

export default function StatusMessage({ tipo = 'error', mensaje, detalle, onRetry }: Props) {
  const dev = import.meta.env.DEV;

  useEffect(() => {
    if (detalle && !dev) console.error(`[StatusMessage] ${detalle}`);
  }, [detalle, dev]);

  return (
    <div className="status-msg" role={tipo === 'error' ? 'alert' : 'status'} aria-busy={tipo === 'loading' || undefined}>
      <p>{mensaje}</p>
      {dev && detalle && <p className="status-msg__detail">{detalle}</p>}
      {onRetry && (
        <button type="button" className="btn btn--secondary status-msg__retry" onClick={onRetry}>
          Reintentar
        </button>
      )}

      <style>{`
        .status-msg {
          border: 1px dashed var(--placeholder-border);
          border-radius: var(--radius);
          padding: 1rem 1.25rem;
          background: var(--placeholder-bg);
          color: var(--placeholder-text);
          font-size: 0.95rem;
          font-weight: 600;
        }
        .status-msg p { margin: 0; }
        .status-msg__detail {
          margin-top: 0.5rem !important;
          font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
          font-size: 0.8rem;
          font-weight: 400;
        }
        .status-msg__retry { margin-top: 0.75rem; padding: 0.45rem 1rem; }
      `}</style>
    </div>
  );
}
