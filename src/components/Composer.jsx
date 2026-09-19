import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDownIcon,
  MicIcon,
  PaperPlaneIcon,
  PhoneIcon,
  SparkIcon,
  StopIcon,
} from './Icons';
import { isSizorEmbed } from '../lib/sizorEmbed';

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function Composer({
  onSend,
  onStartCall,
  disabled,
  models = [],
  model,
  onModelChange,
  placeholder,
}) {
  const [value, setValue] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const submittingRef = useRef(false);
  const taRef = useRef(null);
  const modelRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseValueRef = useRef('');

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const maxH =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 640px)').matches
        ? 112
        : 220;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  }, [value]);

  useEffect(() => {
    // Mantener focus listo para escribir
    const t = requestAnimationFrame(() => taRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!disabled) {
      const t = requestAnimationFrame(() => taRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [disabled]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!modelRef.current?.contains(e.target)) {
        const portal = document.getElementById('matu-model-menu');
        if (portal?.contains(e.target)) return;
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!modelOpen || !modelRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = modelRef.current.getBoundingClientRect();
      const width = Math.max(260, rect.width);
      const maxH = Math.min(320, window.innerHeight - 24);
      const spaceAbove = rect.top - 12;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const openUp = spaceAbove >= Math.min(maxH, 160) || spaceAbove > spaceBelow;
      setMenuPos({
        left: Math.min(rect.left, window.innerWidth - width - 12),
        width,
        maxHeight: openUp ? Math.min(maxH, spaceAbove) : Math.min(maxH, spaceBelow),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [modelOpen, models.length]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const focusInput = () => {
    requestAnimationFrame(() => {
      taRef.current?.focus();
    });
    // Segundo intento por si el click del mic/botón robó el focus
    setTimeout(() => taRef.current?.focus(), 60);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    submittingRef.current = true;
    const activeRecognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      activeRecognition?.abort?.();
      activeRecognition?.stop?.();
    } catch {
      /* noop */
    }
    setListening(false);
    baseValueRef.current = '';
    setValue('');
    onSend(trimmed);
    focusInput();
    // Chrome a veces entrega onresult final DESPUÉS de stop(); ignorar un rato
    setTimeout(() => {
      submittingRef.current = false;
      focusInput();
    }, 400);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
    setListening(false);
  };

  const toggleMic = async () => {
    setMicError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setMicError('Tu navegador no soporta dictado por voz.');
      return;
    }
    if (listening) {
      stopListening();
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      const name = err?.name || '';
      if (isSizorEmbed()) {
        setMicError(
          'Micrófono bloqueado en el iframe. Usa “Abrir en pestaña” o permite el mic en el candado del navegador.'
        );
      } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicError('Permiso de micrófono denegado. Actívalo en la barra del navegador.');
      } else {
        setMicError('No se pudo usar el micrófono. Revisa permisos.');
      }
      return;
    }

    const recognition = new SR();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    baseValueRef.current = value;

    recognition.onresult = (event) => {
      if (submittingRef.current || recognitionRef.current !== recognition) return;
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) {
        baseValueRef.current = `${baseValueRef.current}${
          baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : ''
        }${finalChunk}`.trimStart();
      }
      const next = `${baseValueRef.current}${
        interim
          ? `${baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : ''}${interim}`
          : ''
      }`;
      setValue(next);
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error !== 'aborted') {
        setMicError(
          isSizorEmbed()
            ? 'No se pudo dictar en el iframe. Prueba “Abrir en pestaña”.'
            : 'No se pudo usar el micrófono. Revisa permisos.'
        );
      }
      setListening(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      setListening(false);
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setMicError('No se pudo iniciar la grabación.');
      setListening(false);
    }
  };

  const modelMenu =
    modelOpen &&
    menuPos &&
    createPortal(
      <div
        id="matu-model-menu"
        className="fixed z-[100] flex flex-col gap-0.5 overflow-y-auto rounded-[6px] border-[2.5px] border-black bg-[#f9f5f2] p-1.5 shadow-[4px_4px_0_#000]"
        style={{
          left: menuPos.left,
          width: menuPos.width,
          maxHeight: menuPos.maxHeight,
          top: menuPos.top,
          bottom: menuPos.bottom,
        }}
        role="listbox"
      >
        {models.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`flex flex-col gap-0.5 rounded-[6px] px-3 py-2.5 text-left transition-colors hover:bg-[#f4ed36] ${
              m.id === model?.id ? 'bg-[#f4ed36]' : ''
            }`}
            onClick={() => {
              onModelChange?.(m.id);
              setModelOpen(false);
            }}
          >
            <span className="text-[14px] font-bold">{m.name}</span>
            <span className="text-[12px] font-medium opacity-55">{m.tagline}</span>
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <div className="mx-auto flex w-full max-w-[var(--spacing-content)] flex-col items-center gap-1.5 sm:gap-2">
      <div
        className={`w-full rounded-[6px] border-2 border-black bg-white px-3 pb-2 pt-2.5 shadow-[2px_2px_0_#000] transition focus-within:shadow-[3px_3px_0_#f4ed36] sm:border-[2.5px] sm:px-3.5 sm:pb-2.5 sm:pt-3.5 sm:shadow-[3px_3px_0_#000] ${
          listening ? 'bg-[#fffbeb]' : ''
        }`}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            listening
              ? 'Escuchando… habla y se transcribe aquí'
              : placeholder || 'Escribe un mensaje a Matu…'
          }
          aria-label="Mensaje"
          className="max-h-[112px] min-h-6 w-full bg-transparent py-0.5 text-[15px] font-medium leading-normal text-[#1a1a1a] placeholder:text-black/35 sm:max-h-[220px] sm:text-base"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-2">
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            <div className="relative" ref={modelRef}>
              <button
                type="button"
                className="inline-flex h-8 max-w-[140px] items-center gap-1 rounded-full border-2 border-black bg-[#f4ed36] px-2.5 text-[11px] font-bold transition hover:bg-[#f9cc73] sm:max-w-[170px] sm:gap-1.5 sm:px-3 sm:text-[12px]"
                onClick={() => setModelOpen((v) => !v)}
                aria-expanded={modelOpen}
                title="Elegir modelo"
              >
                <SparkIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{model?.name || 'Modelo'}</span>
                <ChevronDownIcon className="h-3 w-3 shrink-0 opacity-60" />
              </button>
              {modelMenu}
            </div>

            <button
              type="button"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-black transition sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[12px] sm:font-bold ${
                listening
                  ? 'bg-black text-[#f4ed36]'
                  : 'bg-white hover:bg-[#f8c1ba]'
              }`}
              title={listening ? 'Detener dictado' : 'Dictar con micrófono'}
              aria-label={listening ? 'Detener dictado' : 'Dictar con micrófono'}
              onClick={toggleMic}
            >
              {listening ? <StopIcon /> : <MicIcon />}
              <span className="hidden sm:inline">
                {listening ? 'Detener' : 'Voz'}
              </span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onStartCall ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white transition enabled:hover:bg-[#b5c995] enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (listening) stopListening();
                  onStartCall();
                }}
                disabled={disabled}
                aria-label="Llamar a Matu"
                title="Llamar a Matu"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-black text-[#f4ed36] transition enabled:hover:bg-[#61609a] enabled:active:scale-95 disabled:cursor-not-allowed disabled:border-black/20 disabled:bg-[#e8e8e8] disabled:text-black/30"
              onClick={submit}
              disabled={!value.trim() || disabled}
              aria-label="Enviar mensaje"
            >
              <PaperPlaneIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
      {micError ? (
        <p className="px-1 text-center text-[11px] font-medium opacity-60 sm:text-xs">
          {micError}
        </p>
      ) : (
        <p className="hidden text-center text-xs font-medium leading-snug opacity-45 sm:block">
          Matu AI puede equivocarse. Verifica la información importante.
        </p>
      )}
    </div>
  );
}
