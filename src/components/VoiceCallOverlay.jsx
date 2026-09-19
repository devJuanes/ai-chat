import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  SparkIcon,
} from './Icons';
import {
  ensureVoicesLoaded,
  getSpeechRecognition,
  speakText,
  stopSpeaking,
  textForSpeech,
} from '../lib/speech';

const SILENCE_MS = 750;
const ECHO_COOLDOWN_MS = 650;
const STATUS = {
  connecting: 'Conectando…',
  listening: 'Te escucho',
  hearing: 'Escuchando…',
  thinking: 'Pensando…',
  speaking: 'Toca para interrumpir',
  muted: 'Micrófono en silencio',
  error: 'Algo falló',
};

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function Caption({ entry }) {
  const isUser = entry.role === 'user';
  return (
    <div
      className={`max-w-[92%] animate-[call-fade-up_0.35s_ease-out] ${
        isUser ? 'self-end' : 'self-start'
      }`}
    >
      <div
        className={`mb-1 text-[11px] font-medium uppercase tracking-[0.08em] ${
          isUser ? 'text-right text-white/45' : 'text-white/45'
        }`}
      >
        {isUser ? 'Tú' : 'Matu'}
      </div>
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${
          isUser
            ? 'rounded-br-md bg-white text-graphite-ink'
            : 'rounded-bl-md bg-white/12 text-white backdrop-blur-sm'
        }`}
      >
        {entry.text}
        {entry.interim ? (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle opacity-70" />
        ) : null}
      </div>
    </div>
  );
}

export default function VoiceCallOverlay({
  open,
  onClose,
  onSend,
  streaming,
  disabled,
}) {
  const [phase, setPhase] = useState('connecting');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [interim, setInterim] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [voiceName, setVoiceName] = useState('');

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const baseTranscriptRef = useRef('');
  const phaseRef = useRef(phase);
  const mutedRef = useRef(muted);
  const streamingRef = useRef(streaming);
  const wantListenRef = useRef(false);
  const pendingSendRef = useRef(false);
  const lastSpokenIdRef = useRef(null);
  const startedAtRef = useRef(0);
  const captionsEndRef = useRef(null);
  const activeRef = useRef(false);
  const startListeningRef = useRef(() => {});
  const speakingRef = useRef(false);
  const listenBlockedUntilRef = useRef(0);
  const cooldownTimerRef = useRef(null);

  phaseRef.current = phase;
  mutedRef.current = muted;
  streamingRef.current = streaming;

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearCooldown = () => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  const scheduleListen = useCallback((delay = 0) => {
    clearCooldown();
    const wait = Math.max(0, delay);
    listenBlockedUntilRef.current = Date.now() + wait;
    cooldownTimerRef.current = setTimeout(() => {
      if (!activeRef.current || mutedRef.current || speakingRef.current) return;
      if (streamingRef.current) return;
      if (phaseRef.current === 'thinking') return;
      startListeningRef.current();
    }, wait);
  }, []);

  const stopRecognition = useCallback(() => {
    wantListenRef.current = false;
    clearSilence();
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* noop */
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
  }, []);

  const appendCaption = useCallback((role, text, { interim: isInterim } = {}) => {
    const clean = String(text || '').trim();
    if (!clean && !isInterim) return;
    setCaptions((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (isInterim) {
        if (last?.interim && last.role === role) {
          next[next.length - 1] = { ...last, text: clean };
          return next;
        }
        return [...next, { id: `i-${Date.now()}`, role, text: clean, interim: true }];
      }
      if (last?.interim && last.role === role) {
        next[next.length - 1] = {
          id: `c-${Date.now()}`,
          role,
          text: clean,
          interim: false,
        };
        return next;
      }
      return [
        ...next,
        { id: `c-${Date.now()}`, role, text: clean, interim: false },
      ];
    });
    if (!isInterim) setInterim('');
  }, []);

  const submitUtterance = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || pendingSendRef.current || streamingRef.current) return;

      pendingSendRef.current = true;
      clearSilence();
      baseTranscriptRef.current = '';
      setInterim('');
      appendCaption('user', trimmed);
      setPhase('thinking');
      stopRecognition();

      try {
        const result = await onSend?.(trimmed);
        if (!activeRef.current) return;

        const content = result?.content || '';
        const messageId = result?.messageId || `a-${Date.now()}`;
        const spoken = textForSpeech(content);

        if (!spoken) {
          pendingSendRef.current = false;
          setPhase(mutedRef.current ? 'muted' : 'listening');
          if (!mutedRef.current) startListeningRef.current();
          return;
        }

        if (lastSpokenIdRef.current === messageId) {
          pendingSendRef.current = false;
          return;
        }

        lastSpokenIdRef.current = messageId;
        pendingSendRef.current = false;
        appendCaption('assistant', spoken);
        speakingRef.current = true;
        setPhase('speaking');
        stopRecognition();
        speakText(spoken, {
          onEnd: () => {
            speakingRef.current = false;
            if (!activeRef.current) return;
            setPhase(mutedRef.current ? 'muted' : 'listening');
            if (!mutedRef.current) scheduleListen(ECHO_COOLDOWN_MS);
          },
        });
      } catch (err) {
        setError(err?.message || 'No se pudo enviar el mensaje');
        setPhase('error');
        pendingSendRef.current = false;
        speakingRef.current = false;
        if (!mutedRef.current) scheduleListen(0);
      }
    },
    [appendCaption, onSend, scheduleListen, stopRecognition]
  );

  const startListening = useCallback(() => {
    if (!activeRef.current || mutedRef.current || streamingRef.current) return;
    if (speakingRef.current) return;
    if (Date.now() < listenBlockedUntilRef.current) return;
    if (phaseRef.current === 'speaking' || phaseRef.current === 'thinking') return;

    const SR = getSpeechRecognition();
    if (!SR) {
      setError('Tu navegador no soporta reconocimiento de voz.');
      setPhase('error');
      return;
    }

    wantListenRef.current = true;
    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* noop */
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }

    const recognition = new SR();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    baseTranscriptRef.current = '';

    recognition.onresult = (event) => {
      // Ignorar eco: nunca capturar mientras Matu habla o en cooldown
      if (
        !wantListenRef.current ||
        mutedRef.current ||
        speakingRef.current ||
        Date.now() < listenBlockedUntilRef.current
      ) {
        return;
      }
      let interimText = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += t;
        else interimText += t;
      }

      if (finalChunk) {
        baseTranscriptRef.current = `${baseTranscriptRef.current}${
          baseTranscriptRef.current && !baseTranscriptRef.current.endsWith(' ')
            ? ' '
            : ''
        }${finalChunk}`.trim();
      }

      const preview = `${baseTranscriptRef.current}${
        interimText
          ? `${baseTranscriptRef.current && !baseTranscriptRef.current.endsWith(' ') ? ' ' : ''}${interimText}`
          : ''
      }`.trim();

      if (preview) {
        setPhase('hearing');
        setInterim(preview);
        appendCaption('user', preview, { interim: true });
      }

      clearSilence();
      if (baseTranscriptRef.current.trim()) {
        silenceTimerRef.current = setTimeout(() => {
          const toSend = baseTranscriptRef.current.trim();
          if (toSend) submitUtterance(toSend);
        }, SILENCE_MS);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        setError('Activa el permiso del micrófono para la llamada.');
        setPhase('error');
        wantListenRef.current = false;
      }
    };

    recognition.onend = () => {
      if (
        activeRef.current &&
        wantListenRef.current &&
        !mutedRef.current &&
        !speakingRef.current &&
        !streamingRef.current &&
        Date.now() >= listenBlockedUntilRef.current &&
        phaseRef.current !== 'speaking' &&
        phaseRef.current !== 'thinking'
      ) {
        try {
          recognition.start();
        } catch {
          /* noop */
        }
      }
    };

    try {
      recognition.start();
      setPhase(mutedRef.current ? 'muted' : 'listening');
      setError(null);
    } catch {
      setError('No se pudo iniciar el micrófono.');
      setPhase('error');
    }
  }, [appendCaption, submitUtterance]);

  startListeningRef.current = startListening;

  const interruptSpeaking = useCallback(() => {
    if (!speakingRef.current && phaseRef.current !== 'speaking') return;
    speakingRef.current = false;
    stopSpeaking();
    setPhase(mutedRef.current ? 'muted' : 'listening');
    if (!mutedRef.current) scheduleListen(120);
  }, [scheduleListen]);

  useEffect(() => {
    if (!open) return undefined;

    activeRef.current = true;
    speakingRef.current = false;
    listenBlockedUntilRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setCaptions([]);
    setInterim('');
    setMuted(false);
    setError(null);
    setPhase('connecting');
    pendingSendRef.current = false;
    lastSpokenIdRef.current = null;

    let cancelled = false;
    (async () => {
      const voice = await ensureVoicesLoaded();
      if (cancelled) return;
      setVoiceName(voice?.name || 'Voz del sistema');
      setPhase('listening');
      startListeningRef.current();
    })();

    const tick = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 1000);

    return () => {
      cancelled = true;
      activeRef.current = false;
      speakingRef.current = false;
      clearInterval(tick);
      clearSilence();
      clearCooldown();
      stopRecognition();
      stopSpeaking();
    };
  }, [open, stopRecognition]);

  // Keep call status in sync while the model streams
  useEffect(() => {
    if (!open) return;
    if (streaming) {
      speakingRef.current = false;
      setPhase('thinking');
      stopRecognition();
    }
  }, [open, streaming, stopRecognition]);

  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [captions, interim]);

  const hangUp = () => {
    activeRef.current = false;
    speakingRef.current = false;
    wantListenRef.current = false;
    clearSilence();
    clearCooldown();
    stopRecognition();
    stopSpeaking();
    onClose?.();
  };

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (next) {
        clearSilence();
        wantListenRef.current = false;
        try {
          recognitionRef.current?.stop();
        } catch {
          /* noop */
        }
        if (phaseRef.current === 'listening' || phaseRef.current === 'hearing') {
          setPhase('muted');
        }
      } else if (
        !streamingRef.current &&
        phaseRef.current !== 'speaking' &&
        phaseRef.current !== 'thinking'
      ) {
        setPhase('listening');
        queueMicrotask(() => startListeningRef.current());
      }
      return next;
    });
  };

  if (!open) return null;

  const statusLabel = error
    ? error
    : muted && (phase === 'listening' || phase === 'muted')
      ? STATUS.muted
      : STATUS[phase] || STATUS.listening;

  const orbPulse =
    phase === 'listening' || phase === 'hearing'
      ? 'animate-[call-pulse_2.2s_ease-in-out_infinite]'
      : phase === 'speaking'
        ? 'animate-[call-speak_1.1s_ease-in-out_infinite]'
        : phase === 'thinking'
          ? 'animate-[call-think_1.6s_ease-in-out_infinite]'
          : '';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Llamada con Matu"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 50% 20%, #2a2a2e 0%, #141416 45%, #0a0a0b 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.06), transparent 35%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.05), transparent 30%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-[13px] font-medium text-white/50">Llamada con</p>
          <h2 className="text-[18px] font-semibold tracking-tight">Matu</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[13px] tabular-nums text-white/70">
          {formatDuration(elapsed)}
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <button
          type="button"
          className="relative flex h-44 w-44 items-center justify-center"
          onClick={() => {
            if (phase === 'speaking') interruptSpeaking();
          }}
          aria-label={
            phase === 'speaking' ? 'Interrumpir a Matu' : 'Estado de la llamada'
          }
        >
          <div
            className={`absolute inset-0 rounded-full bg-white/5 ${orbPulse}`}
          />
          <div
            className={`absolute inset-3 rounded-full bg-white/[0.07] ${
              phase === 'speaking' || phase === 'hearing' ? orbPulse : ''
            }`}
          />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-gradient-to-b from-white/15 to-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <SparkIcon className="h-10 w-10 text-white" />
          </div>
        </button>

        <div className="text-center">
          <p className="text-[17px] font-medium tracking-tight">{statusLabel}</p>
          {voiceName ? (
            <p className="mt-1.5 text-[12px] text-white/40">
              Voz: {voiceName}
              {phase === 'speaking' ? ' · Usa auriculares si hay eco' : ''}
            </p>
          ) : null}
        </div>

        <div className="flex h-[28vh] w-full max-w-md flex-col gap-3 overflow-y-auto px-1 scrollbar-quiet">
          {captions.length === 0 && !interim ? (
            <p className="mx-auto mt-6 max-w-xs text-center text-[14px] leading-relaxed text-white/35">
              Habla con naturalidad. Cuando pauses, Matu responde en audio y todo
              queda en el chat.
            </p>
          ) : (
            captions.map((c) => <Caption key={c.id} entry={c} />)
          )}
          <div ref={captionsEndRef} />
        </div>
      </div>

      <footer className="relative z-10 flex flex-col items-center gap-4 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={toggleMute}
            disabled={disabled}
            className={`inline-flex h-14 w-14 items-center justify-center rounded-full border transition active:scale-95 ${
              muted
                ? 'border-white/20 bg-white text-graphite-ink'
                : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
            }`}
            aria-label={muted ? 'Activar micrófono' : 'Silenciar micrófono'}
            title={muted ? 'Activar micrófono' : 'Silenciar'}
          >
            {muted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={hangUp}
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#e5484d] text-white shadow-[0_12px_32px_rgba(229,72,77,0.45)] transition hover:bg-[#d63d42] active:scale-95"
            aria-label="Colgar"
            title="Colgar"
          >
            <PhoneOffIcon className="h-6 w-6" />
          </button>
        </div>
        <p className="text-[12px] text-white/35">Colgar para volver al chat</p>
      </footer>

      <style>{`
        @keyframes call-pulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 0.9; }
        }
        @keyframes call-speak {
          0%, 100% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.14); opacity: 1; }
        }
        @keyframes call-think {
          0%, 100% { transform: scale(0.96); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 0.75; }
        }
        @keyframes call-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
