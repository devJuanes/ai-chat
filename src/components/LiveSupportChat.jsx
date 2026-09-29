import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { notifyIncoming, seedSupportChime, unlockSupportChime } from '../lib/supportChime';
import MatuAvatar from './MatuAvatar';
import { CloseIcon } from './Icons';

const READ_PREFIX = 'matu-live-read:';

function storedRead(chatId) {
  if (!chatId) return '';
  try {
    return localStorage.getItem(`${READ_PREFIX}${chatId}`) || '';
  } catch {
    return '';
  }
}

function rememberRead(chatId, iso) {
  if (!chatId || !iso) return;
  try {
    localStorage.setItem(`${READ_PREFIX}${chatId}`, iso);
  } catch {
    /* private mode */
  }
}

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function queueCopy(queue, status) {
  if (status !== 'pending' || !queue) return '';
  const ahead = Math.max(0, (queue.position || 1) - 1);
  const attending = queue.active || 0;
  if (ahead === 0 && attending > 0) {
    return 'Eres el siguiente. Ahora hay una persona en atención.';
  }
  if (ahead === 0) return 'Eres el primero en la cola.';
  return `Vas en el puesto ${queue.position}. Hay ${ahead} ${ahead === 1 ? 'persona' : 'personas'} antes que tú.`;
}

export default function LiveSupportChat() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [queue, setQueue] = useState(null);
  const [readThrough, setReadThrough] = useState('');
  const scroller = useRef(null);
  const seededChat = useRef(null);

  const apply = (json) => {
    setChat(json?.chat || null);
    setMessages(json?.messages || []);
    setQueue(json?.queue || null);
  };

  useEffect(() => {
    if (!auth.user?.id) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const json = await api('/api/support/live', { token: auth.getToken() });
        if (!stop) apply(json);
      } catch (err) {
        if (!stop && open) setError(err.message || 'No se pudo actualizar el chat');
      }
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [open, auth.user?.id]);

  useEffect(() => {
    setReadThrough(storedRead(chat?.id));
  }, [chat?.id]);

  useEffect(() => {
    const id = chat?.id || '';
    if (!id || !messages.length) return undefined;
    if (seededChat.current !== id) {
      seedSupportChime(messages);
      seededChat.current = id;
      return undefined;
    }
    notifyIncoming(messages, (item) => item.sender !== 'user');
    return undefined;
  }, [messages, chat?.id]);

  useEffect(() => {
    if (!open || !chat?.id) return undefined;
    const incoming = messages.filter((item) => item.sender !== 'user');
    const latest = incoming.length ? incoming[incoming.length - 1].created_at : '';
    if (!latest || (readThrough && readThrough >= latest)) return undefined;
    rememberRead(chat.id, latest);
    setReadThrough(latest);
    return undefined;
  }, [open, chat?.id, messages, readThrough]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const json = await api('/api/support/live/start', {
        method: 'POST',
        token: auth.getToken(),
      });
      apply(json);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el chat');
    } finally {
      setBusy(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !chat || busy) return;
    setBusy(true);
    setError('');
    try {
      const json = await api(`/api/support/live/${chat.id}/messages`, {
        method: 'POST',
        token: auth.getToken(),
        body: { message: text },
      });
      setDraft('');
      setMessages((prev) => [
        ...prev,
        json.message,
        ...(json.assistant ? [json.assistant] : []),
      ]);
      if (json.queue) setQueue(json.queue);
    } catch (err) {
      setError(err.message || 'No se pudo enviar');
    } finally {
      setBusy(false);
    }
  };

  const waiting = chat?.status === 'pending';
  const live = chat?.status === 'active';
  const unread = open
    ? 0
    : messages.filter(
        (item) => item.sender !== 'user' && (!readThrough || item.created_at > readThrough)
      ).length;

  return (
    <div
      className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[70] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6"
      onPointerDown={unlockSupportChime}
    >
      {open ? (
        <section
          className="pointer-events-auto fixed inset-0 z-[80] flex h-dvh w-full max-w-[100vw] flex-col overflow-hidden rounded-none border-0 bg-[#f9f5f2] pt-[env(safe-area-inset-top)] text-[#1a1a1a] shadow-none md:static md:inset-auto md:z-auto md:h-[min(70dvh,560px)] md:w-[min(100vw-2rem,380px)] md:max-w-[380px] md:rounded-[10px] md:border-[2.5px] md:border-black md:pt-0 md:shadow-[6px_6px_0_#000]"
          aria-label="Chat de soporte"
        >
          <header className="flex items-center gap-3 border-b-[2.5px] border-black bg-[#f9cc73] px-3 py-3">
            <MatuAvatar size={40} crop="bust" decorative />
            <div className="min-w-0 flex-1 text-left">
              <p className="fp-mono opacity-60">Soporte</p>
              <p className="truncate text-[15px] font-bold">Chat en vivo</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36]"
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
            >
              <CloseIcon />
            </button>
          </header>

          <div ref={scroller} className="min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3">
            {!chat ? (
              <div className="flex gap-2">
                <MatuAvatar size={28} decorative />
                <p className="rounded-[8px] border-2 border-black bg-white px-3 py-2 text-[14px] font-medium leading-snug">
                  Hola. ¿En qué puedo ayudarte?
                </p>
              </div>
            ) : null}
            {waiting ? (
              <div className="rounded-[6px] border-2 border-black bg-[#f4ed36] px-3 py-2 text-[13px] font-bold leading-snug">
                <span className="mr-2 inline-flex gap-1 align-middle">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black [animation-delay:150ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-black [animation-delay:300ms]" />
                </span>
                Buscando a una persona. {queueCopy(queue, chat.status)}
              </div>
            ) : null}
            {live ? (
              <p className="rounded-[6px] border-2 border-black bg-[#b5c995] px-3 py-2 text-[13px] font-bold">
                Ya te atiende una persona. Puedes seguir escribiendo.
              </p>
            ) : null}
            {messages.map((item) => (
              <Bubble key={item.id} item={item} />
            ))}
          </div>

          {!chat ? (
            <div className="shrink-0 border-t-[2.5px] border-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
              {error ? (
                <p className="mb-2 text-[12px] font-medium text-[#9b2c2c]">{error}</p>
              ) : null}
              <button
                type="button"
                className="fp-btn-ink w-full px-4 py-2.5 text-[13px]"
                disabled={busy}
                onClick={start}
              >
                {busy ? 'Iniciando…' : 'Iniciar chat'}
              </button>
            </div>
          ) : (
            <form
              className="shrink-0 border-t-[2.5px] border-black p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3"
              onSubmit={send}
            >
              {error ? (
                <p className="mb-2 text-[12px] font-medium text-[#9b2c2c]">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <input
                  className="fp-input min-w-0 flex-1 max-md:!text-base"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={waiting ? 'Cuéntame la novedad' : 'Escribe tu mensaje'}
                  maxLength={2000}
                />
                <button
                  type="submit"
                  className="fp-btn-ink shrink-0 px-3 py-2 text-[12px]"
                  disabled={busy}
                >
                  {busy ? '…' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <button
        type="button"
        className={`pointer-events-auto relative rounded-[22px] shadow-[4px_4px_0_#000] ${
          open ? 'max-md:hidden' : ''
        }`}
        onClick={() => {
          unlockSupportChime();
          setOpen((value) => !value);
        }}
        aria-label={
          open
            ? 'Cerrar soporte'
            : unread > 0
              ? `Abrir chat de soporte, ${unread} sin leer`
              : 'Abrir chat de soporte'
        }
      >
        <MatuAvatar size={64} crop="bust" alt="Soporte Matu" className="!border-[2.5px]" />
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 hidden h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-black bg-[#f4ed36] px-1 text-[11px] font-bold leading-none text-[#1a1a1a] md:inline-flex">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function Bubble({ item }) {
  const mine = item.sender === 'user';
  const label = item.sender === 'admin' ? 'Soporte' : item.sender === 'assistant' ? 'Matu' : 'Tú';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-[8px] border-2 border-black px-3 py-2 text-left ${
          mine ? 'bg-[#1a1a1a] text-[#f9f5f2]' : 'bg-white'
        }`}
      >
        <p className="break-words text-[14px] font-medium leading-snug">{item.body}</p>
        <p className={`mt-1 text-[11px] ${mine ? 'text-white/60' : 'opacity-50'}`}>
          {label} · {formatWhen(item.created_at)}
        </p>
      </div>
    </div>
  );
}
