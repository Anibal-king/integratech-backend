import { useRef, useState } from 'react';
import { api, ContactoError, type ContactoPayload } from '../lib/api';
import StatusMessage from './StatusMessage';

type Estado =
  | { tipo: 'idle' }
  | { tipo: 'enviando' }
  | { tipo: 'ok' }
  | { tipo: 'invalido'; msg: string }
  | { tipo: 'error'; detalle: string };

export default function ContactForm() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'idle' });
  const ultimoPayload = useRef<ContactoPayload | null>(null);

  const enviar = async (payload: ContactoPayload, form?: HTMLFormElement) => {
    ultimoPayload.current = payload;
    setEstado({ tipo: 'enviando' });
    try {
      await api.enviarContacto(payload);
      setEstado({ tipo: 'ok' });
      form?.reset();
    } catch (err) {
      // Validación o límite de envíos: el servidor ya da un mensaje apto para el visitante.
      if (err instanceof ContactoError && err.esDelVisitante) {
        setEstado({ tipo: 'invalido', msg: err.mensajeServidor });
        return;
      }
      setEstado({ tipo: 'error', detalle: `POST ${api.baseUrl}/api/contacto: ${(err as Error).message}` });
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      nombre: String(fd.get('nombre') ?? '').trim(),
      correo: String(fd.get('correo') ?? '').trim(),
      telefono: String(fd.get('telefono') ?? '').trim(),
      empresa: String(fd.get('empresa') ?? '').trim(),
      mensaje: String(fd.get('mensaje') ?? '').trim(),
    };

    if (!payload.nombre || !payload.mensaje) {
      setEstado({ tipo: 'invalido', msg: 'El nombre y el mensaje son obligatorios.' });
      return;
    }
    if (!payload.correo && !payload.telefono) {
      setEstado({ tipo: 'invalido', msg: 'Déjenos un correo o un teléfono para poder responderle.' });
      return;
    }
    if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) {
      setEstado({ tipo: 'invalido', msg: 'El correo no tiene un formato válido.' });
      return;
    }
    if (payload.telefono && payload.telefono.replace(/\D/g, '').length < 7) {
      setEstado({ tipo: 'invalido', msg: 'El teléfono debe tener al menos 7 dígitos.' });
      return;
    }

    enviar(payload, form);
  };

  return (
    <form className="cform" onSubmit={onSubmit} noValidate>
      <div className="cform__row">
        <label>
          Nombre *
          <input name="nombre" type="text" required maxLength={120} autoComplete="name" />
        </label>
        <label>
          Empresa
          <input name="empresa" type="text" maxLength={150} autoComplete="organization" />
        </label>
      </div>

      <div className="cform__row">
        <label>
          Correo **
          <input name="correo" type="email" maxLength={200} autoComplete="email" />
        </label>
        <label>
          Teléfono **
          <input name="telefono" type="tel" maxLength={40} autoComplete="tel" />
        </label>
      </div>

      <label>
        Mensaje *
        <textarea name="mensaje" rows={5} required maxLength={5000} />
      </label>

      <p className="cform__hint">* Obligatorio · ** Al menos uno de los dos, para poder responderle.</p>

      <button type="submit" className="btn btn--primary" disabled={estado.tipo === 'enviando'}>
        {estado.tipo === 'enviando' ? 'Enviando…' : 'Enviar mensaje'}
      </button>

      {estado.tipo === 'ok' && (
        <StatusMessage tipo="success" mensaje="¡Gracias! Su mensaje fue enviado. Le contactaremos pronto." />
      )}
      {estado.tipo === 'invalido' && <StatusMessage tipo="error" mensaje={estado.msg} />}
      {estado.tipo === 'error' && (
        <StatusMessage
          tipo="error"
          mensaje="No pudimos enviar su mensaje en este momento. Intente de nuevo más tarde."
          detalle={estado.detalle}
          onRetry={() => ultimoPayload.current && enviar(ultimoPayload.current)}
        />
      )}

      <style>{`
        .cform { display: flex; flex-direction: column; gap: 1.1rem; }
        .cform__row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
        .cform label {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--text);
        }
        .cform input,
        .cform textarea {
          font: inherit;
          font-size: 1rem;
          font-weight: 400;
          min-height: 48px;
          padding: 0.7rem 0.85rem;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          background: var(--input-bg);
          color: var(--text);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .cform input:hover,
        .cform textarea:hover { border-color: var(--heading); }
        .cform input:focus-visible,
        .cform textarea:focus-visible {
          outline: none;
          border-color: var(--focus-ring);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-ring) 25%, transparent);
        }
        .cform textarea { resize: vertical; }
        .cform__hint { margin: -0.25rem 0 0; font-size: 0.82rem; color: var(--text-muted); }
        .cform .btn { align-self: stretch; }
        @media (max-width: 620px) {
          .cform__row { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}
