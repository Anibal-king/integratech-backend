import { useState } from 'react';
import { api } from '../lib/api';

type Estado = { tipo: 'idle' | 'enviando' | 'ok' | 'error'; msg?: string };

export default function ContactForm() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'idle' });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nombre: String(fd.get('nombre') ?? '').trim(),
      correo: String(fd.get('correo') ?? '').trim(),
      telefono: String(fd.get('telefono') ?? '').trim(),
      empresa: String(fd.get('empresa') ?? '').trim(),
      mensaje: String(fd.get('mensaje') ?? '').trim(),
    };

    if (!payload.nombre || !payload.mensaje) {
      setEstado({ tipo: 'error', msg: 'El nombre y el mensaje son obligatorios.' });
      return;
    }

    setEstado({ tipo: 'enviando' });
    try {
      await api.enviarContacto(payload);
      setEstado({ tipo: 'ok', msg: '¡Gracias! Tu mensaje fue enviado. Te contactaremos pronto.' });
      e.currentTarget.reset();
    } catch (err) {
      setEstado({ tipo: 'error', msg: (err as Error).message });
    }
  };

  return (
    <form className="cform" onSubmit={onSubmit} noValidate>
      <div className="cform__row">
        <label>
          Nombre *
          <input name="nombre" type="text" required autoComplete="name" />
        </label>
        <label>
          Empresa
          <input name="empresa" type="text" autoComplete="organization" />
        </label>
      </div>

      <div className="cform__row">
        <label>
          Correo
          <input name="correo" type="email" autoComplete="email" />
        </label>
        <label>
          Teléfono
          <input name="telefono" type="tel" autoComplete="tel" />
        </label>
      </div>

      <label>
        Mensaje *
        <textarea name="mensaje" rows={5} required />
      </label>

      <button type="submit" className="btn btn--primary" disabled={estado.tipo === 'enviando'}>
        {estado.tipo === 'enviando' ? 'Enviando…' : 'Enviar mensaje'}
      </button>

      {estado.msg && (
        <p className={`cform__feedback cform__feedback--${estado.tipo}`} role="status">
          {estado.msg}
        </p>
      )}

      <style>{`
        .cform { display: flex; flex-direction: column; gap: 1rem; max-width: 640px; }
        .cform__row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .cform label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-primary);
        }
        .cform input,
        .cform textarea {
          font: inherit;
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: #fff;
          color: var(--color-text);
        }
        .cform textarea { resize: vertical; }
        .cform .btn { align-self: flex-start; }
        .cform__feedback { margin: 0; font-weight: 600; }
        .cform__feedback--ok { color: var(--color-success); }
        .cform__feedback--error { color: var(--color-error); }
        @media (max-width: 620px) {
          .cform__row { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}
