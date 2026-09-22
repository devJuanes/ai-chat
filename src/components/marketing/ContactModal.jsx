import { useEffect } from 'react';
import { SITE } from '../../lib/site';
import ContactForm from './ContactForm';

/**
 * Contact modal: email + WhatsApp + form.
 * @param {{ open: boolean, onClose: () => void, source?: 'landing' | 'contacto' }} props
 */
export default function ContactModal({ open, onClose, source = 'landing' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden border-[2.5px] border-black shadow-[6px_6px_0_#000] sm:max-h-[88dvh] sm:rounded-[2px]"
        style={{ background: '#fff', color: '#1a1a1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b-[2.5px] border-black px-4 py-3.5 sm:px-5"
          style={{ background: 'var(--color-hi-vis-yellow)' }}
        >
          <div>
            <p className="mono text-[10px] opacity-70">Contacto · Matu AI</p>
            <h2
              id="contact-modal-title"
              className="display"
              style={{ fontSize: 'clamp(24px, 5vw, 30px)', lineHeight: 1.05 }}
            >
              Hablemos.
            </h2>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center border-[2px] border-black bg-white text-[16px] font-bold leading-none"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-0 border-b-[2.5px] border-black">
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="flex flex-col gap-0.5 border-r-[2.5px] border-black px-3 py-3 no-underline transition-colors hover:bg-[var(--color-bone-white)]"
            style={{ color: '#1a1a1a' }}
          >
            <span className="mono text-[9px] opacity-55">Email</span>
            <span className="truncate text-[11px] font-bold leading-tight sm:text-[12px]">
              {SITE.contactEmail}
            </span>
          </a>
          <a
            href={SITE.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-0.5 px-3 py-3 no-underline transition-colors hover:bg-[var(--color-bone-white)]"
            style={{ color: '#1a1a1a' }}
          >
            <span className="mono text-[9px] opacity-55">WhatsApp</span>
            <span className="text-[11px] font-bold leading-tight sm:text-[12px]">
              {SITE.whatsappDisplay}
            </span>
          </a>
        </div>

        <ContactForm
          source={source}
          showTitle={false}
          variant="plain"
          formId="contact-modal-form"
          onSuccess={onClose}
        />
      </div>
    </div>
  );
}
