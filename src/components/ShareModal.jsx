import { useEffect, useState } from 'react';
import { CloseIcon, CopyIcon, CheckIcon } from './Icons';

export default function ShareModal({
  open,
  url,
  title = 'Compartir chat',
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !url) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-[440px] overflow-hidden rounded-[6px] border-[2.5px] border-black bg-[#f9f5f2] shadow-[6px_6px_0_#000]">
        <div
          className="flex items-center justify-between border-b-[2.5px] border-black px-5 py-4"
          style={{ background: '#8584bd' }}
        >
          <h2
            id="share-modal-title"
            className="font-[family-name:var(--fp-display,'Archivo_Black',sans-serif)] text-[18px] uppercase tracking-wide text-[#f4ed36]"
            style={{
              fontFamily: "'Archivo Black', 'Arial Black', Impact, sans-serif",
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] text-black"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="text-[14px] font-medium leading-snug text-[#1a1a1a]/opacity-75">
            Cualquiera con este enlace podrá ver la conversación.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={url}
              className="min-w-0 flex-1 rounded-[6px] border-[2.5px] border-black bg-white px-3 py-2.5 text-[13px] font-medium text-[#1a1a1a]"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-black bg-[#f4ed36] px-4 text-[13px] font-bold text-black hover:bg-[#f9cc73]"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
