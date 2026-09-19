import { useEffect, useState } from 'react';
import { CloseIcon } from './Icons';
import { ProjectIcon } from './ProjectIcons';
import {
  PROJECT_COLORS,
  PROJECT_ICON_IDS,
  getProjectColor,
} from '../lib/projectTheme';

export default function ProjectModal({ open, onClose, onSubmit, busy }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('briefcase');
  const [color, setColor] = useState('ink');

  useEffect(() => {
    if (!open) return;
    setName('');
    setIcon('briefcase');
    setColor('ink');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const palette = getProjectColor(color);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    onSubmit?.({ name: trimmed, icon, color });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-[640px] overflow-hidden rounded-[6px] border-[2.5px] border-black bg-[#f9f5f2] shadow-[6px_6px_0_#000]"
      >
        <div
          className="relative flex items-center gap-4 border-b-[2.5px] border-black px-6 py-5"
          style={{ background: palette.bg }}
        >
          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>

          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] text-black"
            aria-hidden="true"
          >
            <ProjectIcon id={icon} className="h-6 w-6" />
          </div>
          <div className="min-w-0 pr-8 text-left">
            <p
              className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] opacity-70"
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
            >
              Nuevo mural
            </p>
            <h2
              id="project-modal-title"
              className="text-[28px] uppercase leading-none tracking-wide text-black"
              style={{
                fontFamily: "'Archivo Black', 'Arial Black', Impact, sans-serif",
              }}
            >
              Proyecto
            </h2>
            <p className="mt-2 text-[13px] font-medium leading-snug text-black/75">
              Nombre, ícono y color. Los chats compartirán contexto.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
          <label className="flex flex-col gap-1.5 text-left">
            <span
              className="text-[11px] uppercase tracking-[0.05em] text-black/55"
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
            >
              Nombre del proyecto
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Lanzamiento Q2, Cliente Acme…"
              maxLength={60}
              className="rounded-[6px] border-[2.5px] border-black bg-white px-3.5 py-2.5 text-[15px] font-medium text-[#1a1a1a] placeholder:text-black/35 focus:shadow-[3px_3px_0_#f4ed36] focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr] sm:items-start">
            <div>
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.05em] text-black/55"
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                Ícono
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {PROJECT_ICON_IDS.map((id) => {
                  const selected = icon === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={id}
                      onClick={() => setIcon(id)}
                      className={`inline-flex h-10 w-full items-center justify-center rounded-[6px] border-2 border-black transition-colors ${
                        selected
                          ? 'bg-[#f4ed36] text-black'
                          : 'bg-white text-black/60 hover:bg-[#f8c1ba]'
                      }`}
                      aria-pressed={selected}
                    >
                      <ProjectIcon id={id} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.05em] text-black/55"
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                Color
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-2">
                {PROJECT_COLORS.map((c) => {
                  const selected = color === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setColor(c.id)}
                      className={`flex h-10 items-center gap-2.5 rounded-[6px] border-2 border-black px-2.5 transition ${
                        selected ? 'bg-[#f4ed36]' : 'bg-white hover:bg-[#f8c1ba]'
                      }`}
                      aria-label={c.label}
                      aria-pressed={selected}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-[4px] border-2 border-black"
                        style={{ background: c.bg }}
                      />
                      <span className="truncate text-[12px] font-bold text-black">
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="min-w-[110px] rounded-full border-2 border-black bg-white px-4 py-2.5 text-[13px] font-bold hover:bg-[#f0ece8]"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || busy}
              className="min-w-[140px] rounded-full border-2 border-black bg-black px-4 py-2.5 text-[13px] font-bold text-[#f4ed36] enabled:hover:bg-[#61609a] disabled:cursor-not-allowed disabled:border-black/20 disabled:bg-[#ddd] disabled:text-black/30"
            >
              {busy ? 'Creando…' : 'Crear proyecto'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
