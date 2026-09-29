import { useEffect, useRef, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { notifyIncoming, seedSupportChime, unlockSupportChime } from '../lib/supportChime';
import { ChevronDownIcon, MenuIcon } from '../components/Icons';
import NotificationBell from '../components/NotificationBell';

function formatNum(n) {
  const value = Number(n) || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ADMIN_READ_PREFIX = 'matu-admin-live-read:';

function adminReadThrough(chatId) {
  if (!chatId) return '';
  try {
    return localStorage.getItem(`${ADMIN_READ_PREFIX}${chatId}`) || '';
  } catch {
    return '';
  }
}

function rememberAdminRead(chatId, iso) {
  if (!chatId || !iso) return;
  try {
    localStorage.setItem(`${ADMIN_READ_PREFIX}${chatId}`, iso);
  } catch {
    /* private mode */
  }
}

function unreadForChat(item, openChatId) {
  if (!item?.id || item.id === openChatId) return 0;
  const mark = adminReadThrough(item.id);
  return (item.incoming_at || []).filter((iso) => iso && (!mark || iso > mark)).length;
}

function formatClock(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPage() {
  const auth = useAuth();
  const { onToggleSidebar } = useOutletContext() || {};
  const [tab, setTab] = useState('chats');
  const [users, setUsers] = useState([]);
  const [period, setPeriod] = useState('');
  const [inbox, setInbox] = useState([]);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);
  const seededChats = useRef(new Set());
  const inboxStamp = useRef(new Map());
  const inboxReady = useRef(false);

  const admin = auth.profile?.user?.is_admin === true;

  const loadUsers = async () => {
    const json = await api('/api/admin/overview', { token: auth.getToken() });
    setUsers(json.users || []);
    setPeriod(json.period || '');
  };

  const loadInbox = async () => {
    const json = await api('/api/support/live/inbox', { token: auth.getToken() });
    const chats = json.chats || [];
    setInbox(chats);
    const changed = [];
    for (const item of chats) {
      const prev = inboxStamp.current.get(item.id);
      if (inboxReady.current && prev !== item.updated_at) {
        changed.push({ id: item.id, since: prev || '' });
      }
      inboxStamp.current.set(item.id, item.updated_at || '');
    }
    inboxReady.current = true;
    return changed;
  };

  const openChat = async (id) => {
    const json = await api(`/api/support/live/${id}`, { token: auth.getToken() });
    setChat(json.chat);
    setMessages(json.messages || []);
  };

  useEffect(() => {
    if (!admin) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        if (tab === 'users') await loadUsers();
        const changed = await loadInbox();
        if (tab === 'chats' && chat?.id) await openChat(chat.id);
        for (const item of changed) {
          if (tab === 'chats' && item.id === chat?.id) continue;
          try {
            const detail = await api(`/api/support/live/${item.id}`, { token: auth.getToken() });
            notifyIncoming(detail.messages, (row) => row.sender !== 'admin', item.since);
          } catch {
            /* the open thread still refreshes on the next tick */
          }
        }
        if (!stop) setError('');
      } catch (err) {
        if (!stop) setError(err.message || 'No se pudo cargar');
      }
    };
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [admin, tab, chat?.id]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return undefined;
    node.scrollTop = node.scrollHeight;
    return undefined;
  }, [messages, chat?.id]);

  useEffect(() => {
    if (!chat?.id) return undefined;
    if (!seededChats.current.has(chat.id)) {
      if (!messages.length) return undefined;
      seedSupportChime(messages);
      seededChats.current.add(chat.id);
      return undefined;
    }
    notifyIncoming(messages, (item) => item.sender !== 'admin');
    return undefined;
  }, [messages, chat?.id]);

  useEffect(() => {
    if (!chat?.id) return undefined;
    const incoming = messages.filter((item) => item.sender !== 'admin');
    const latest = incoming.length ? incoming[incoming.length - 1].created_at : '';
    if (!latest || adminReadThrough(chat.id) >= latest) return undefined;
    rememberAdminRead(chat.id, latest);
    return undefined;
  }, [chat?.id, messages]);

  if (auth.profile && !admin) {
    return <Navigate to="/c/new" replace />;
  }

  const accept = async () => {
    if (!chat) return;
    setBusy(true);
    try {
      const json = await api(`/api/support/live/${chat.id}/accept`, {
        method: 'POST',
        token: auth.getToken(),
      });
      setChat(json.chat);
      setMessages(json.messages || []);
      await loadInbox();
    } catch (err) {
      setError(err.message || 'No se pudo aceptar');
    } finally {
      setBusy(false);
    }
  };

  const reply = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !chat) return;
    setBusy(true);
    try {
      const json = await api(`/api/support/live/${chat.id}/messages`, {
        method: 'POST',
        token: auth.getToken(),
        body: { message: text },
      });
      setMessages((prev) => [...prev, json.message]);
      setDraft('');
    } catch (err) {
      setError(err.message || 'No se pudo responder');
    } finally {
      setBusy(false);
    }
  };

  const closeChat = async () => {
    if (!chat) return;
    setBusy(true);
    try {
      await api(`/api/support/live/${chat.id}/close`, {
        method: 'POST',
        token: auth.getToken(),
      });
      setChat(null);
      setMessages([]);
      await loadInbox();
    } catch (err) {
      setError(err.message || 'No se pudo cerrar');
    } finally {
      setBusy(false);
    }
  };

  const waiting = inbox.filter((item) => item.status === 'pending');
  const active = inbox.filter((item) => item.status === 'active');
  const mobileThread = tab === 'chats' && Boolean(chat);

  return (
    <main
      className="fp-page flex h-dvh min-w-0 flex-col overflow-x-hidden"
      onPointerDown={tab === 'chats' ? unlockSupportChime : undefined}
    >
      <header className="fp-page-header flex h-[52px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="fp-mono">Admin</div>
        <div className="flex-1" />
        <NotificationBell />
      </header>

      <div
        className={`min-h-0 min-w-0 flex-1 scrollbar-quiet ${
          mobileThread
            ? 'flex flex-col overflow-hidden md:block md:overflow-x-hidden md:overflow-y-auto'
            : 'overflow-x-hidden overflow-y-auto'
        }`}
      >
        <div
          className={`mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-8 ${
            mobileThread
              ? 'max-md:min-h-0 max-md:flex-1 max-md:gap-0 max-md:overflow-hidden max-md:px-0 max-md:py-0'
              : ''
          }`}
        >
          <div className={`min-w-0 max-w-full ${mobileThread ? 'max-md:hidden' : ''}`}>
            <p className="fp-mono opacity-55">Equipo</p>
            <h1 className="fp-display mt-1 max-w-full overflow-hidden text-[clamp(17px,5.2vw,22px)] leading-[1.05] md:text-[48px] md:leading-none">
              Administración
            </h1>
          </div>

          <div className={`flex max-w-full flex-wrap gap-2 ${mobileThread ? 'max-md:hidden' : ''}`}>
            <button
              type="button"
              className={`rounded-full border-2 border-black px-4 py-2 text-[13px] font-bold ${
                tab === 'chats' ? 'bg-[#1a1a1a] text-[#f4ed36]' : 'bg-white'
              }`}
              onClick={() => setTab('chats')}
            >
              Chats en vivo
            </button>
            <button
              type="button"
              className={`rounded-full border-2 border-black px-4 py-2 text-[13px] font-bold ${
                tab === 'users' ? 'bg-[#1a1a1a] text-[#f4ed36]' : 'bg-white'
              }`}
              onClick={() => setTab('users')}
            >
              Usuarios
            </button>
          </div>

          {error ? <p className="text-[13px] font-medium text-[#9b2c2c]">{error}</p> : null}

          {tab === 'users' ? (
            <section className="fp-card overflow-hidden">
              <div className="border-b-[2.5px] border-black px-4 py-3 text-left">
                <h2 className="text-[16px] font-bold">Consumo del periodo {period || 'actual'}</h2>
                <p className="text-[13px] font-medium opacity-70">
                  {users.length} cuentas. Ordenadas por tokens usados.
                </p>
              </div>
              <ul>
                {users.map((person) => (
                  <li
                    key={person.id}
                    className="grid gap-1 border-t border-black/10 px-4 py-3 text-left sm:grid-cols-[1.4fr_1fr_auto_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-[14px] font-bold">
                        {person.name}
                        {person.is_admin ? (
                          <span className="ml-2 rounded-full border-2 border-black bg-[#f4ed36] px-2 py-0.5 text-[10px]">
                            Admin
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[12px] opacity-70">{person.email}</p>
                    </div>
                    <p className="text-[12px] opacity-60">{formatWhen(person.created_at)}</p>
                    <p className="text-[13px] font-bold">{formatNum(person.messages)} mensajes</p>
                    <p className="text-[13px] font-bold">{formatNum(person.tokens)} tokens</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div
              className={`grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] ${
                mobileThread ? 'max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:gap-0' : ''
              }`}
            >
              <section
                className={`min-w-0 text-left max-md:!rounded-none max-md:!border-0 max-md:!bg-transparent max-md:p-0 fp-card p-3 ${
                  mobileThread ? 'max-md:hidden' : ''
                }`}
              >
                <div className="max-md:hidden">
                  <h2 className="px-1 text-[15px] font-bold">Cola</h2>
                  <p className="px-1 pb-2 text-[12px] font-medium opacity-65">
                    {waiting.length} en espera · {active.length} en atención
                  </p>
                </div>
                {[...waiting, ...active].length === 0 ? (
                  <p className="px-1 text-[13px] opacity-60">No hay chats abiertos.</p>
                ) : (
                  <ul className="flex min-w-0 flex-col md:gap-2">
                    {[...waiting, ...active].map((item) => {
                      const unread = unreadForChat(item, chat?.id);
                      const preview = item.preview || item.email;
                      return (
                        <li key={item.id} className="min-w-0">
                          <button
                            type="button"
                            className={`flex w-full min-w-0 items-center gap-3 text-left max-md:border-b max-md:border-black/15 max-md:bg-transparent max-md:px-0 max-md:py-3 md:rounded-[6px] md:border-2 md:border-black md:px-3 md:py-2 ${
                              chat?.id === item.id ? 'md:bg-[#f4ed36]' : 'md:bg-white'
                            }`}
                            onClick={() => openChat(item.id)}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[15px] font-bold">{item.name}</span>
                                <span className="fp-mono shrink-0 opacity-55">
                                  {item.status === 'pending' ? 'En espera' : 'En vivo'}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-[13px] font-medium opacity-70">
                                {preview}
                              </span>
                            </span>
                            {unread > 0 ? (
                              <span className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#f4ed36] px-1 text-[11px] font-bold leading-none text-[#1a1a1a]">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section
                className={`fp-card flex flex-col text-left md:min-h-[420px] ${
                  chat
                    ? 'max-md:min-h-0 max-md:flex-1 max-md:!rounded-none max-md:!border-0 max-md:!bg-[#f9f5f2]'
                    : 'max-md:hidden'
                }`}
              >
                {!chat ? (
                  <p className="p-5 text-[14px] font-medium opacity-70">
                    Elige un chat. Si está en espera, acéptalo para responder. Ciérralo cuando termines.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 border-b-[2.5px] border-black px-4 py-3 max-md:bg-[#f9cc73] max-md:px-3">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] md:hidden"
                        onClick={() => {
                          setChat(null);
                          setMessages([]);
                        }}
                        aria-label="Volver a la cola"
                      >
                        <ChevronDownIcon className="h-4 w-4 rotate-90" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-bold">{chat.name}</p>
                        <p className="truncate text-[13px] opacity-70">{chat.email}</p>
                        <p className="fp-mono mt-1 hidden opacity-55 md:block">
                          {chat.status === 'pending' ? 'En espera' : 'Aceptado'} ·{' '}
                          {formatWhen(chat.created_at)}
                        </p>
                      </div>
                    </div>
                    <div
                      ref={scroller}
                      className="min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 max-md:px-3"
                    >
                      {messages.map((item) => (
                        <div
                          key={item.id}
                          className={`flex ${item.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-[8px] border-2 border-black px-3 py-2 text-[14px] ${
                              item.sender === 'admin'
                                ? 'bg-[#1a1a1a] text-[#f9f5f2]'
                                : 'bg-white'
                            }`}
                          >
                            <p className="break-words font-medium leading-snug">{item.body}</p>
                            <p className="mt-1 text-[11px] opacity-60">
                              {item.sender === 'user'
                                ? chat.name
                                : item.sender === 'assistant'
                                  ? 'Matu'
                                  : 'Soporte'}
                              <span className="md:hidden"> · {formatClock(item.created_at)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="shrink-0 border-t-[2.5px] border-black p-3 max-md:bg-[#f9f5f2] max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                      {chat.status === 'pending' ? (
                        <button
                          type="button"
                          className="fp-btn-ink px-4 py-2 text-[13px]"
                          disabled={busy}
                          onClick={accept}
                        >
                          {busy ? 'Aceptando…' : 'Aceptar chat'}
                        </button>
                      ) : (
                        <form className="flex flex-col gap-2" onSubmit={reply}>
                          <div className="flex gap-2">
                            <input
                              className="fp-input min-w-0 flex-1 max-md:!text-base"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              placeholder="Responder"
                            />
                            <button
                              type="submit"
                              className="fp-btn-ink px-3 py-2 text-[12px]"
                              disabled={busy}
                            >
                              Enviar
                            </button>
                          </div>
                          <button
                            type="button"
                            className="self-start text-[12px] font-bold underline"
                            onClick={closeChat}
                            disabled={busy}
                          >
                            Cerrar chat
                          </button>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
