import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import LoadingRing from '../components/LoadingRing';
import {
  ChevronDownIcon,
  FacebookIcon,
  InboxIcon,
  InstagramIcon,
  MenuIcon,
  PaperPlaneIcon,
  WhatsAppIcon,
} from '../components/Icons';

const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  messenger: 'Facebook',
  instagram: 'Instagram',
};

const CHANNEL_FILTERS = [
  { id: '', label: 'Todos' },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: WhatsAppIcon,
    color: '#25D366',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    Icon: InstagramIcon,
    color: '#E4405F',
  },
  {
    id: 'messenger',
    label: 'Facebook',
    Icon: FacebookIcon,
    color: '#1877F2',
  },
];

function ChannelBadge({ channel, className = '' }) {
  const meta = CHANNEL_FILTERS.find((f) => f.id === channel);
  if (!meta?.Icon) {
    return (
      <span className={`fp-mono text-[10px] uppercase opacity-60 ${className}`}>
        {CHANNEL_LABEL[channel] || channel}
      </span>
    );
  }
  const { Icon, color, label } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={label}
      style={{ color }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
    </span>
  );
}

function contactTitle(thread, conversation) {
  if (!thread) return conversation?.title || 'Conversación';
  if (thread.channel === 'whatsapp') {
    return (
      thread.contact_phone ||
      thread.contact_name ||
      conversation?.title ||
      thread.external_user_id
    );
  }
  if (thread.channel === 'instagram') {
    const u = thread.contact_username
      ? `@${String(thread.contact_username).replace(/^@/, '')}`
      : '';
    return u || thread.contact_name || conversation?.title || 'Instagram';
  }
  // Facebook Messenger → first name / display
  return thread.contact_name || conversation?.title || 'Facebook';
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function messageParts(text) {
  const source = String(text || '');
  const re = /https?:\/\/[^\s<]+/gi;
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ type: 'text', value: source.slice(last, start) });
    }
    const raw = match[0];
    const url = raw.replace(/[)\].,!?;:]+$/g, '');
    const suffix = raw.slice(url.length);
    if (url) parts.push({ type: 'link', value: url });
    if (suffix) parts.push({ type: 'text', value: suffix });
    last = start + raw.length;
  }
  if (last < source.length) {
    parts.push({ type: 'text', value: source.slice(last) });
  }
  return parts;
}

function MessageBody({ text }) {
  return (
    <div className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {messageParts(text).map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-black underline decoration-black/40 underline-offset-2 [overflow-wrap:anywhere]"
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </div>
  );
}

export default function InboxPage() {
  const { conversationId } = useParams();
  const { onToggleSidebar } = useOutletContext() || {};
  const auth = useAuth();
  const token = auth.getToken?.();

  const [channelFilter, setChannelFilter] = useState('');
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const threadsLoaded = useRef(false);
  const detailReq = useRef(0);
  const threadScrollRef = useRef(null);
  const stickToBottomRef = useRef(true);

  const refreshThreads = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!threadsLoaded.current) setLoading(true);
    setError(null);
    try {
      const q = channelFilter ? `?channel=${channelFilter}` : '';
      const data = await api(`/api/inbox${q}`, { token });
      setThreads(data.threads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      threadsLoaded.current = true;
      setLoading(false);
    }
  }, [token, channelFilter]);

  useEffect(() => {
    refreshThreads();
    const t = setInterval(refreshThreads, 15000);
    return () => clearInterval(t);
  }, [refreshThreads]);

  const loadDetail = useCallback(
    async (id) => {
      const req = ++detailReq.current;
      if (!token || !id) {
        setDetail(null);
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      try {
        const data = await api(`/api/inbox/${id}`, { token });
        if (req !== detailReq.current) return;
        setDetail(data);
      } catch (err) {
        if (req !== detailReq.current) return;
        setError(err.message);
      } finally {
        if (req === detailReq.current) setDetailLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    setDetail(null);
    loadDetail(conversationId);
  }, [conversationId, loadDetail]);

  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [conversationId]);

  useLayoutEffect(() => {
    stickToBottomRef.current = true;
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversationId]);

  useLayoutEffect(() => {
    const el = threadScrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [detail?.messages]);

  const setAssignee = async (assignee) => {
    if (!token || !conversationId) return;
    try {
      await api(`/api/inbox/${conversationId}/assignee`, {
        token,
        method: 'POST',
        body: { assignee },
      });
      await loadDetail(conversationId);
      await refreshThreads();
    } catch (err) {
      setError(err.message);
    }
  };

  const sendReply = async (e) => {
    e?.preventDefault?.();
    if (!token || !conversationId || !reply.trim()) return;
    if ((detail?.conversation?.assignee || 'bot') !== 'human') return;
    stickToBottomRef.current = true;
    setSending(true);
    setError(null);
    try {
      await api(`/api/inbox/${conversationId}/reply`, {
        token,
        method: 'POST',
        body: { content: reply.trim() },
      });
      setReply('');
      await loadDetail(conversationId);
      await refreshThreads();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const activeId = conversationId;
  const preview =
    threads.find((t) => t.conversation_id === activeId) || null;
  const viewThread = detail?.thread || preview;
  const viewConversation = detail?.conversation || preview?.conversation;
  const assignee = viewConversation?.assignee || 'bot';
  const showLoader =
    (loading && threads.length === 0) ||
    (Boolean(activeId) && detailLoading && !detail);

  return (
    <main className="fp-page relative flex h-dvh min-w-0 flex-col overflow-x-hidden">
      <header
        className={`fp-page-header h-[56px] shrink-0 items-center gap-3 px-4 sm:px-6 ${
          activeId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2">
          <InboxIcon />
          <div className="fp-mono text-[12px]">Inbox</div>
        </div>
        <div className="flex-1" />
        <Link to="/bots/agentes" className="fp-mono text-[11px] underline">
          Agentes
        </Link>
      </header>

      {error ? (
        <div className="mx-4 mt-3 border-2 border-black bg-[#f8c1ba] px-3 py-2 text-[13px] sm:mx-6">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`${
            activeId ? 'hidden md:flex' : 'flex'
          } min-h-0 w-full max-w-[340px] shrink-0 flex-col overflow-hidden border-r-2 border-black max-md:max-w-none max-md:border-r-0 md:w-[340px]`}
        >
          <div className="flex gap-1 border-b-2 border-black p-2">
            {CHANNEL_FILTERS.map((f) => {
              const active = channelFilter === f.id;
              const Icon = f.Icon;
              return (
                <button
                  key={f.id || 'all'}
                  type="button"
                  title={f.label}
                  aria-label={f.label}
                  aria-pressed={active}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-1 py-1.5 transition ${
                    active
                      ? 'bg-black text-white'
                      : 'bg-white hover:bg-black/5'
                  }`}
                  onClick={() => setChannelFilter(f.id)}
                >
                  {Icon ? (
                    <Icon
                      className="h-4 w-4"
                      style={active ? undefined : { color: f.color }}
                    />
                  ) : (
                    <span className="fp-mono text-[10px]">{f.label}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && threads.length === 0 ? null : threads.length === 0 ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
                <p className="max-w-sm text-[20px] font-semibold tracking-tight sm:text-[22px]">
                  Aún no hay conversaciones
                </p>
                <p className="mt-2 max-w-sm text-[14px] leading-relaxed opacity-55">
                  Cuando lleguen mensajes de WhatsApp, Instagram o Messenger
                  aparecerán aquí.
                </p>
              </div>
            ) : (
              threads.map((t) => {
                const active = t.conversation_id === activeId;
                return (
                  <Link
                    key={t.id}
                    to={`/inbox/${t.conversation_id}`}
                    className={`block min-w-0 border-b border-black/10 px-3 py-3 ${
                      active ? 'bg-[#f4ed36]/40' : 'hover:bg-black/5'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ChannelBadge channel={t.channel} />
                      <span className="fp-mono shrink-0 text-[10px] opacity-40">
                        {t.conversation?.assignee === 'human'
                          ? 'humano'
                          : 'bot'}
                      </span>
                      <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] opacity-40">
                        {formatTime(t.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[14px] font-medium">
                      {contactTitle(t, t.conversation)}
                    </div>
                    <div className="truncate text-[12px] opacity-60">
                      {t.conversation?.preview || '—'}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <section
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden ${
            activeId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-[14px] opacity-50">
              Selecciona una conversación
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 overflow-hidden border-b-2 border-black px-3 py-3">
                <Link
                  to="/inbox"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
                  aria-label="Volver a conversaciones"
                >
                  <ChevronDownIcon className="rotate-90" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {contactTitle(viewThread, viewConversation)}
                  </div>
                  <div className="fp-mono flex items-center gap-1.5 text-[10px] uppercase opacity-50">
                    <ChannelBadge channel={viewThread?.channel} />
                    <span>
                      {CHANNEL_LABEL[viewThread?.channel] ||
                        viewConversation?.source}
                    </span>
                  </div>
                </div>
                {assignee === 'bot' ? (
                  <button
                    type="button"
                    className="shrink-0 whitespace-nowrap rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[12px] font-medium"
                    onClick={() => setAssignee('human')}
                  >
                    Tomar control
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 whitespace-nowrap rounded-lg border-2 border-black bg-[#b5c995] px-3 py-1.5 text-[12px] font-medium"
                    onClick={() => setAssignee('bot')}
                  >
                    Reanudar bot
                  </button>
                )}
              </div>

              <div
                ref={threadScrollRef}
                className="min-h-0 w-full min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4"
              >
                {(detail?.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`w-fit max-w-[85%] min-w-0 rounded-2xl border-2 border-black px-3 py-2 text-[14px] leading-relaxed break-words [overflow-wrap:anywhere] ${
                      m.role === 'user'
                        ? 'mr-auto rounded-bl-md bg-white'
                        : 'ml-auto rounded-br-md bg-[#f4ed36]/50'
                    }`}
                  >
                    <div className="fp-mono mb-1 text-[9px] uppercase opacity-50">
                      {m.role === 'user' ? 'Cliente' : 'Agente'}
                    </div>
                    <MessageBody text={m.content} />
                    <div className="mt-1 text-[10px] opacity-40">
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (assignee !== 'human') return;
                  sendReply(e);
                }}
                className="flex shrink-0 gap-2 border-t-2 border-black p-3"
              >
                {assignee === 'bot' ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-black/30 bg-[#faf8f5] px-3 py-2 text-[13px]">
                    <span className="opacity-70">
                      El bot está respondiendo. Toma el control para escribir
                      como humano.
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border-2 border-black bg-[#f4ed36] px-2.5 py-1 text-[12px] font-medium"
                      onClick={() => setAssignee('human')}
                    >
                      Tomar control
                    </button>
                  </div>
                ) : (
                  <input
                    className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-[14px]"
                    placeholder="Escribe una respuesta…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={sending}
                  />
                )}
                <button
                  type="submit"
                  disabled={
                    assignee !== 'human' || sending || !reply.trim()
                  }
                  className="fp-btn fp-btn-primary inline-flex items-center gap-1 rounded-xl px-3 py-2 disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <PaperPlaneIcon />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
      {showLoader ? <LoadingRing overlay /> : null}
    </main>
  );
}
