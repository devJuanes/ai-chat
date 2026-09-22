import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import {
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

  const refreshThreads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = channelFilter ? `?channel=${channelFilter}` : '';
      const data = await api(`/api/inbox${q}`, { token });
      setThreads(data.threads || []);
    } catch (err) {
      setError(err.message);
    } finally {
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
      if (!token || !id) {
        setDetail(null);
        return;
      }
      setDetailLoading(true);
      try {
        const data = await api(`/api/inbox/${id}`, { token });
        setDetail(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadDetail(conversationId);
  }, [conversationId, loadDetail]);

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
  const assignee = detail?.conversation?.assignee || 'bot';

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[56px] shrink-0 items-center gap-3 px-4 sm:px-6">
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
        <Link to="/bots" className="fp-mono text-[11px] underline">
          Agentes
        </Link>
      </header>

      {error ? (
        <div className="mx-4 mt-3 border-2 border-black bg-[#f8c1ba] px-3 py-2 text-[13px] sm:mx-6">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-full max-w-[340px] shrink-0 flex-col border-r-2 border-black max-md:max-w-none max-md:border-r-0 md:w-[340px]">
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
            {loading && threads.length === 0 ? (
              <p className="p-4 text-[13px] opacity-60">Cargando…</p>
            ) : threads.length === 0 ? (
              <p className="p-4 text-[13px] opacity-60">
                Aún no hay conversaciones de canal. Cuando lleguen mensajes de
                WhatsApp, Instagram o Messenger aparecerán aquí.
              </p>
            ) : (
              threads.map((t) => {
                const active = t.conversation_id === activeId;
                return (
                  <Link
                    key={t.id}
                    to={`/inbox/${t.conversation_id}`}
                    className={`block border-b border-black/10 px-3 py-3 ${
                      active ? 'bg-[#f4ed36]/40' : 'hover:bg-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={t.channel} />
                      <span className="fp-mono text-[10px] opacity-40">
                        {t.conversation?.assignee === 'human'
                          ? 'humano'
                          : 'bot'}
                      </span>
                      <span className="ml-auto text-[10px] opacity-40">
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
          className={`min-w-0 flex-1 flex-col ${
            activeId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-[14px] opacity-50">
              Selecciona una conversación
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex flex-1 items-center justify-center text-[13px] opacity-60">
              Cargando hilo…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b-2 border-black px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {contactTitle(detail?.thread, detail?.conversation)}
                  </div>
                  <div className="fp-mono flex items-center gap-1.5 text-[10px] uppercase opacity-50">
                    <ChannelBadge channel={detail?.thread?.channel} />
                    <span>
                      {CHANNEL_LABEL[detail?.thread?.channel] ||
                        detail?.conversation?.source}
                    </span>
                  </div>
                </div>
                {assignee === 'bot' ? (
                  <button
                    type="button"
                    className="fp-btn border-2 border-black bg-white px-3 py-1.5 text-[12px]"
                    onClick={() => setAssignee('human')}
                  >
                    Tomar control
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fp-btn border-2 border-black bg-[#b5c995] px-3 py-1.5 text-[12px]"
                    onClick={() => setAssignee('bot')}
                  >
                    Reanudar bot
                  </button>
                )}
                <Link
                  to="/inbox"
                  className="text-[12px] underline md:hidden"
                >
                  Volver
                </Link>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {(detail?.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] border-2 border-black px-3 py-2 text-[14px] leading-relaxed ${
                      m.role === 'user'
                        ? 'mr-auto bg-white'
                        : 'ml-auto bg-[#f4ed36]/50'
                    }`}
                  >
                    <div className="fp-mono mb-1 text-[9px] uppercase opacity-50">
                      {m.role === 'user' ? 'Cliente' : 'Agente'}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div className="mt-1 text-[10px] opacity-40">
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={sendReply}
                className="flex gap-2 border-t-2 border-black p-3"
              >
                <input
                  className="min-w-0 flex-1 border-2 border-black bg-white px-3 py-2 text-[14px]"
                  placeholder={
                    assignee === 'bot'
                      ? 'Toma el control para responder como humano…'
                      : 'Escribe una respuesta…'
                  }
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="fp-btn fp-btn-primary inline-flex items-center gap-1 px-3 py-2 disabled:opacity-50"
                  aria-label="Enviar"
                >
                  <PaperPlaneIcon />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
