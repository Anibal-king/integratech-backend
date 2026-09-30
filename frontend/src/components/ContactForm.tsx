import { useRef, useState } from 'react';
import { api, type ContactoPayload } from '../lib/api';
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

    enviar(payload, form);
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

      {estado.tipo === 'ok' && (
        <StatusMessage tipo="success" mensaje="¡Gracias! Tu mensaje fue enviado. Te contactaremos pronto." />
      )}
      {estado.tipo === 'invalido' && <StatusMessage tipo="error" mensaje={estado.msg} />}
      {estado.tipo === 'error' && (
        <StatusMessage
          tipo="error"
          mensaje="No pudimos enviar tu mensaje en este momento. Intenta de nuevo más tarde."
          detalle={estado.detalle}
          onRetry={() => ultimoPayload.current && enviar(ultimoPayload.current)}
        />
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
          color: var(--text);
        }
        .cform input,
        .cform textarea {
          font: inherit;
          font-weight: 400;
          padding: 0.65rem 0.75rem;
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          background: var(--input-bg);
          color: var(--text);
        }
        .cform input:focus-visible,
        .cform textarea:focus-visible { border-color: var(--focus-ring); }
        .cform textarea { resize: vertical; }
        .cform .btn { align-self: flex-start; }
        @media (max-width: 620px) {
          .cform__row { grid-template-columns: 1fr; }
        }
      `}</style>
    </form>
  );
}
