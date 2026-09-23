import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BellIcon } from './Icons';

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationBell({ className = '', placement = 'bottom' }) {
  const auth = useAuth();
  const token = auth.session?.access_token;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(
    () => auth.profile?.notifications?.items || []
  );
  const [unread, setUnread] = useState(
    () => auth.profile?.notifications?.unread || 0
  );
  const ref = useRef(null);

  useEffect(() => {
    setItems(auth.profile?.notifications?.items || []);
    setUnread(auth.profile?.notifications?.unread || 0);
  }, [auth.profile?.notifications]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api('/api/notifications', { token });
        if (cancelled) return;
        setItems(res.items || []);
        setUnread(res.unread || 0);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = async () => {
    if (!token || unread === 0) return;
    try {
      const res = await api('/api/notifications/read', {
        token,
        method: 'POST',
        body: {},
      });
      setItems(res.items || []);
      setUnread(res.unread || 0);
    } catch {
      /* ignore */
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await markRead();
  };

  if (!token) return null;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-[6px] border-2 border-black bg-[#f9f5f2] text-black hover:bg-white"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c94245] px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notificaciones de uso"
          className={`absolute z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-[8px] border-2 border-black bg-[#f9f5f2] text-black shadow-[4px_4px_0_#000] ${
            placement === 'top'
              ? 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2'
              : 'right-0 top-[calc(100%+8px)]'
          }`}
        >
          <div className="flex items-center justify-between border-b-2 border-black/15 px-3 py-2.5">
            <span className="text-[13px] font-bold">Notificaciones</span>
            <Link
              to="/usage"
              className="fp-mono text-[10px] underline opacity-70"
              onClick={() => setOpen(false)}
            >
              Ver uso
            </Link>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] opacity-60">
                Sin alertas de uso por ahora.
              </p>
            ) : (
              items.slice(0, 12).map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-black/10 px-3 py-2.5 ${
                    n.read_at ? 'opacity-70' : 'bg-[#f4ed36]/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold leading-snug">
                      {n.title || `Uso ${n.threshold}%`}
                    </p>
                    <span className="fp-mono shrink-0 text-[9px] opacity-50">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug opacity-80">
                    {n.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
