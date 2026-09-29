import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export default function VerifyEmailModal() {
  const auth = useAuth();
  const email = auth.profile?.user?.email || auth.user?.email || '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const started = useRef(false);

  const send = async () => {
    setError('');
    setBusy(true);
    try {
      const json = await api('/api/auth/verify/send', {
        method: 'POST',
        token: auth.getToken(),
      });
      if (json?.already) {
        auth.setProfile((prev) =>
          prev
            ? { ...prev, user: { ...prev.user, email_verified: true } }
            : prev
        );
        return;
      }
      setNote(
        json?.sent === false
          ? 'El código anterior sigue vigente.'
          : `Te enviamos un código a ${email}.`
      );
    } catch (err) {
      setError(err.message || 'No se pudo enviar el código');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    send();
  }, []);

  const confirm = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/verify/confirm', {
        method: 'POST',
        token: auth.getToken(),
        body: { code },
      });
      auth.setProfile((prev) =>
        prev
          ? { ...prev, user: { ...prev.user, email_verified: true } }
          : prev
      );
    } catch (err) {
      setError(err.message || 'No se pudo verificar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-email-title"
    >
      <form
        className="w-full max-w-md rounded-[8px] border-[2.5px] border-black bg-[#f9f5f2] p-5 text-[#1a1a1a] shadow-[6px_6px_0_#000]"
        onSubmit={confirm}
      >
        <p className="fp-mono opacity-55">Verificación obligatoria</p>
        <h2 id="verify-email-title" className="fp-display mt-2 text-[28px] leading-none">
          Confirma tu correo
        </h2>
        <p className="mt-3 text-[15px] font-medium leading-snug">
          {note || `Para seguir usando Matu AI verifica ${email}.`}
        </p>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="fp-mono opacity-60">Código</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="fp-input text-center text-[24px] font-bold tracking-[0.35em]"
            required
            minLength={6}
            maxLength={6}
          />
        </label>
        {error ? (
          <p className="mt-3 text-[13px] font-medium text-[#9b2c2c]">{error}</p>
        ) : null}
        <button
          type="submit"
          className="fp-btn-ink mt-4 w-full px-5 py-2.5 text-[13px]"
          disabled={busy}
        >
          {busy ? 'Un momento…' : 'Verificar cuenta'}
        </button>
        <button
          type="button"
          className="mt-3 w-full text-[14px] font-medium underline underline-offset-2"
          disabled={busy}
          onClick={send}
        >
          Reenviar código
        </button>
      </form>
    </div>
  );
}
