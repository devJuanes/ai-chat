import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Message from '../components/Message';
import { BrandMascot } from '../components/BrandMascot';
import BrandLogo from '../components/BrandLogo';
import '../styles/landing.css';

export default function SharePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/share/${token}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message || 'Enlace no válido');
        }
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="landing fp min-h-dvh">
      <header className="relative z-20 flex items-center justify-between px-5 py-[17px] md:px-10">
        <Link to="/" className="link-underline inline-flex items-center gap-2">
          <BrandLogo
            size={28}
            decorative
            className="rounded-[4px] border-2 border-black shadow-[2px_2px_0_#000]"
          />
          ← Matu AI
        </Link>
        <span
          className="display"
          style={{
            background: '#000',
            color: '#fff',
            fontSize: 13,
            letterSpacing: '0.06em',
            padding: '8px 12px',
            borderRadius: 4,
            lineHeight: 1,
          }}
        >
          Chat compartido
        </span>
        <Link to="/register" className="link-underline">
          Crear cuenta
        </Link>
      </header>

      <div className="mx-auto max-w-[768px] px-5 pb-16 pt-6 md:px-10">
        <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
          <BrandMascot className="h-16 w-14 shrink-0" />
          <div>
            <p className="mono mb-2" style={{ color: 'rgba(249,245,242,0.7)' }}>
              Vista pública
            </p>
            <h1
              className="display"
              style={{
                color: 'var(--color-hi-vis-yellow)',
                fontSize: 'clamp(28px, 6vw, 48px)',
                lineHeight: 0.9,
              }}
            >
              {data?.conversation?.title || 'Conversación'}
            </h1>
          </div>
        </div>

        <div className="card card-bone border-[2.5px] border-black shadow-[4px_4px_0_#000]">
          {loading && (
            <p className="text-[14px] font-medium opacity-55">
              Cargando conversación…
            </p>
          )}
          {error && (
            <p
              className="rounded-[6px] px-3 py-2 text-[14px] font-medium"
              style={{
                background: 'var(--color-firecracker-red)',
                color: '#fff',
              }}
            >
              {error}
            </p>
          )}
          {data?.messages?.length ? (
            <div className="flex flex-col gap-5">
              {data.messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
            </div>
          ) : null}
          {!loading && !error && !data?.messages?.length ? (
            <p className="text-[14px] font-medium opacity-55">
              Este chat no tiene mensajes.
            </p>
          ) : null}
        </div>

        <div className="mt-8 text-center">
          <Link to="/register" className="btn-pill cta-label">
            Probar Matu AI
          </Link>
        </div>
      </div>
    </div>
  );
}
