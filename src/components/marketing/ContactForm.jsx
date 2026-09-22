import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SITE } from '../../lib/site';

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  company: '',
  subject: 'Ventas',
  message: '',
  website: '',
};

const SUBJECTS = ['Ventas', 'Soporte', 'Partnership', 'Prensa', 'Otro'];

function Field({ label, required, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-black/65">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

function FeedbackModal({ kind, title, body, onClose, primaryLabel }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isOk = kind === 'ok';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="contact-feedback-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm border-[2.5px] border-black p-5 shadow-[6px_6px_0_#000]"
        style={{
          background: isOk ? 'var(--color-matcha-cream)' : '#f8c1ba',
          color: '#1a1a1a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mono mb-2 text-[11px] opacity-70">
          {isOk ? 'Éxito' : 'Revisa el formulario'}
        </p>
        <h4
          id="contact-feedback-title"
          className="display mb-2"
          style={{ fontSize: 'clamp(22px, 5vw, 28px)', lineHeight: 1.08 }}
        >
          {title}
        </h4>
        <p className="mb-5 text-[14px] font-bold leading-snug opacity-85">
          {body}
        </p>
        <button
          type="button"
          className="btn-pill cta-label w-full justify-center !bg-black !text-[var(--color-hi-vis-yellow)]"
          onClick={onClose}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   source?: 'landing' | 'contacto',
 *   showTitle?: boolean,
 *   variant?: 'card' | 'plain',
 *   formId?: string,
 *   onSuccess?: () => void,
 * }} props
 */
export default function ContactForm({
  source = 'contacto',
  showTitle = true,
  variant = 'card',
  formId = 'contact-form',
  onSuccess,
}) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const closeModal = () => {
    const wasOk = modal?.kind === 'ok';
    setModal(null);
    if (wasOk) onSuccess?.();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const name = form.name.trim();
      const email = form.email.trim();
      const message = form.message.trim();

      if (!name) {
        setModal({
          kind: 'error',
          title: 'Falta el nombre',
          body: 'Escribe tu nombre para poder contactarte.',
        });
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setModal({
          kind: 'error',
          title: 'Email inválido',
          body: 'Revisa el correo e inténtalo de nuevo.',
        });
        return;
      }
      if (message.length < 10) {
        setModal({
          kind: 'error',
          title: 'Mensaje muy corto',
          body: 'El mensaje debe tener al menos 10 caracteres.',
        });
        return;
      }

      await api('/api/contact', {
        method: 'POST',
        body: {
          name,
          email,
          phone: form.phone.trim(),
          company: form.company.trim(),
          subject: form.subject.trim(),
          message,
          website: form.website,
          source,
        },
      });
      setForm(EMPTY);
      setModal({
        kind: 'ok',
        title: 'Mensaje enviado',
        body: `Gracias. El equipo de ${SITE.companyShort} te responde pronto.`,
      });
    } catch (err) {
      setModal({
        kind: 'error',
        title: 'No se pudo enviar',
        body: err.message || 'Inténtalo de nuevo en un momento.',
      });
    } finally {
      setBusy(false);
    }
  };

  const plain = variant === 'plain';

  return (
    <>
      <form
        id={formId}
        onSubmit={onSubmit}
        className={
          plain
            ? 'relative flex min-h-0 flex-1 flex-col'
            : 'relative flex flex-col gap-5 border-[2.5px] border-black bg-white p-5 shadow-[5px_5px_0_#000] sm:gap-6 sm:p-7'
        }
        style={{ color: '#1a1a1a' }}
        noValidate
      >
        {showTitle && !plain ? (
          <div className="flex flex-col gap-1 border-b-[2.5px] border-black pb-4">
            <p className="mono text-[11px] opacity-60">Contacto directo</p>
            <h3
              className="display"
              style={{ fontSize: 'clamp(26px, 5vw, 36px)', lineHeight: 1.08 }}
            >
              Escríbenos.
            </h3>
          </div>
        ) : null}

        <input
          type="text"
          name="website"
          value={form.website}
          onChange={set('website')}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <div
          className={
            plain
              ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5'
              : 'contents'
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <Field label="Nombre" required>
              <input
                className="fp-input"
                required
                maxLength={120}
                value={form.name}
                onChange={set('name')}
                placeholder="Tu nombre"
              />
            </Field>
            <Field label="Email" required>
              <input
                className="fp-input"
                type="email"
                required
                maxLength={200}
                value={form.email}
                onChange={set('email')}
                placeholder="tu@empresa.com"
              />
            </Field>
            <Field label="Teléfono">
              <input
                className="fp-input"
                type="tel"
                maxLength={40}
                value={form.phone}
                onChange={set('phone')}
                placeholder="+57 300 000 0000"
              />
            </Field>
            <Field label="Empresa">
              <input
                className="fp-input"
                maxLength={120}
                value={form.company}
                onChange={set('company')}
                placeholder="Tu empresa"
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-black/65">
              Asunto
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => {
                const active = form.subject === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, subject: s }))}
                    className="border-[2px] border-black px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      background: active
                        ? 'var(--color-hi-vis-yellow)'
                        : '#fff',
                      boxShadow: active ? '2px 2px 0 #000' : 'none',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Mensaje" required>
            <textarea
              className="fp-input min-h-[110px] resize-y py-3"
              required
              maxLength={4000}
              value={form.message}
              onChange={set('message')}
              placeholder="Cuéntanos qué necesitas."
            />
          </Field>
        </div>

        <div
          className={
            plain
              ? 'shrink-0 border-t-[2.5px] border-black bg-white px-4 py-3 sm:px-5'
              : 'flex flex-col gap-3 border-t-[2.5px] border-black pt-5 sm:flex-row sm:items-center sm:justify-between'
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!plain ? (
              <p className="text-[12px] font-bold leading-snug text-black/55">
                Respondemos a {SITE.contactEmail}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="btn-pill cta-label w-full justify-center !bg-black !text-[var(--color-hi-vis-yellow)] disabled:opacity-60"
            >
              {busy ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </div>
        </div>
      </form>

      {modal ? (
        <FeedbackModal
          kind={modal.kind}
          title={modal.title}
          body={modal.body}
          onClose={closeModal}
          primaryLabel={modal.kind === 'ok' ? 'Listo' : 'Entendido'}
        />
      ) : null}
    </>
  );
}
