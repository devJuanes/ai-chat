import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { setSizorEmbed } from '../lib/sizorEmbed';
import BrandLogo from '../components/BrandLogo';

function resolveSizorBaseUrl(sizorUrlParam) {
  let raw = (
    sizorUrlParam ||
    import.meta.env.VITE_SIZOR_URL ||
    'https://sizor.online'
  )
    .toString()
    .trim()
    .replace(/\/$/, '');

  // Mixed Content: nunca llamar http desde una página/iframe https
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    /^http:\/\//i.test(raw)
  ) {
    raw = raw.replace(/^http:/i, 'https:');
  }
  if (/^http:\/\/(www\.)?sizor\.online/i.test(raw)) {
    raw = raw.replace(/^http:/i, 'https:');
  }
  return raw || 'https://sizor.online';
}

export default function ConnectSizorPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState('Conectando con Sizor…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (auth.loading) return undefined;
    let cancelled = false;

    async function run() {
      const token = String(params.get('token') || '');
      const companyId = String(params.get('companyId') || '');
      const embed = params.get('embed') === '1';
      const base = resolveSizorBaseUrl(params.get('sizorUrl'));

      if (!token || !companyId) {
        if (!cancelled) {
          setFailed(true);
          setStatus('Falta token o companyId en la URL');
        }
        return;
      }

      setSizorEmbed(embed);

      try {
        setStatus('Validando acceso…');
        const res = await fetch(`${base}/api/matuai-sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, companyId }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.email || !payload?.password) {
          throw new Error(payload?.error || 'No se pudo validar el acceso SSO');
        }

        setStatus('Iniciando sesión en MatuAI…');
        await auth.signIn(payload.email, payload.password);
        if (cancelled) return;
        navigate(embed ? '/c/new' : '/explore', { replace: true });
      } catch (e) {
        if (cancelled) return;
        setFailed(true);
        setStatus(e?.message || 'Error al conectar con Sizor');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading]);

  return (
    <div className="grid min-h-dvh place-items-center bg-[#f9f5f2] px-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-black bg-white p-8 text-center shadow-[6px_6px_0_#000]">
        <div className="mb-4 flex justify-center">
          <BrandLogo size={48} decorative />
        </div>
        <h1 className="text-xl font-bold text-black">Sizor × MatuAI</h1>
        <p className="mt-2 text-sm text-black/60">
          Abriendo tu espacio de chat con los datos de Sizor.
        </p>
        {!failed ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            <p className="text-sm font-medium text-black/70">{status}</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-red-700">{status}</p>
            <Link
              to="/login"
              className="text-sm font-bold text-black underline underline-offset-2"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
