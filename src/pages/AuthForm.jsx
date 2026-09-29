import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useId, useState } from 'react';
import { useAuth } from '../lib/auth';
import { ConfettiBit } from '../components/BrandMascot';
import BrandLogo from '../components/BrandLogo';
import SeoHead from '../components/seo/SeoHead';
import { SITE } from '../lib/site';
import '../styles/landing.css';

export default function AuthForm({ mode = 'login' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverError, setRecoverError] = useState('');
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const recoverTitleId = useId();

  const isRegister = mode === 'register';
  const from = location.state?.from || '/c/new';

  const closeRecover = () => {
    if (recoverBusy) return;
    setRecoverOpen(false);
    setRecoverError('');
    setRecoverSent(false);
  };

  const openRecover = () => {
    setRecoverEmail(email.trim());
    setRecoverError('');
    setRecoverSent(false);
    setRecoverOpen(true);
  };

  const submitRecover = async (e) => {
    e.preventDefault();
    setRecoverError('');
    setRecoverBusy(true);
    try {
      await auth.requestPasswordReset(recoverEmail);
      setRecoverSent(true);
    } catch (err) {
      setRecoverError(err.message || 'No pudimos enviar el enlace');
    } finally {
      setRecoverBusy(false);
    }
  };

  useEffect(() => {
    if (!recoverOpen) return undefined;
    const onKey = (ev) => {
      if (ev.key === 'Escape' && !recoverBusy) {
        setRecoverOpen(false);
        setRecoverError('');
        setRecoverSent(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recoverOpen, recoverBusy]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let result;
      if (isRegister && !codeSent) {
        await auth.requestSignupCode(
          email.trim(),
          password,
          name.trim() || email.split('@')[0]
        );
        setCode('');
        setCodeSent(true);
        return;
      }
      if (isRegister) {
        result = await auth.confirmSignup(email.trim(), code, password);
      } else {
        result = await auth.signIn(email.trim(), password);
      }
      if (!result?.session?.access_token || !result?.user?.id) {
        throw new Error(
          isRegister
            ? 'No se pudo crear la cuenta'
            : 'Correo o contraseña incorrectos'
        );
      }
      const safeFrom =
        typeof from === 'string' &&
        (from.startsWith('/c') ||
          from.startsWith('/p') ||
          from.startsWith('/explore') ||
          from.startsWith('/settings') ||
          from.startsWith('/usage') ||
          from.startsWith('/library') ||
          from.startsWith('/search'))
          ? from
          : '/c/new';
      navigate(safeFrom, { replace: true });
    } catch (err) {
      setError(err.message || 'Algo salió mal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing fp auth-page flex min-h-dvh flex-col">
      <SeoHead
        title={isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
        description={
          isRegister
            ? `Crea tu cuenta gratis en Matu AI, el chat de ${SITE.companyShort} con modelos propios.`
            : `Entra a Matu AI, el chat de ${SITE.companyShort} con modelos propios para negocio, diseño y agentes.`
        }
        path={isRegister ? '/register' : '/login'}
      />
      <header className="relative z-20 flex shrink-0 items-center justify-between px-5 py-[17px] md:px-10">
        <Link to="/" className="link-underline">
          ← Inicio
        </Link>
        <Link
          to="/"
          className="display no-underline inline-flex items-center gap-2"
          style={{
            background: '#000',
            color: '#fff',
            fontSize: 14,
            letterSpacing: '0.06em',
            padding: '6px 12px 6px 6px',
            borderRadius: 4,
            lineHeight: 1,
          }}
        >
          <BrandLogo
            size={28}
            decorative
            className="rounded-[3px] border border-white/20"
          />
          Matu AI
        </Link>
        <Link
          to={isRegister ? '/login' : '/register'}
          className="link-underline"
        >
          {isRegister ? 'Login' : 'Registro'}
        </Link>
      </header>

      <div className="auth-grid relative mx-auto grid w-full max-w-[1200px] flex-1 gap-8 px-5 pb-16 pt-4 md:grid-cols-2 md:gap-12 md:px-10 md:pb-20 lg:gap-16">
        <ConfettiBit
          className="anim-float absolute left-[4%] top-[8%] hidden sm:block"
          fill="#f8c1ba"
        />
        <ConfettiBit
          className="anim-float absolute bottom-[12%] left-[28%] hidden md:block"
          fill="#f4ed36"
        />
        <ConfettiBit
          className="anim-float absolute right-[8%] top-[18%] hidden lg:block"
          fill="#b5c995"
        />

        <div className="relative z-10 flex flex-col items-center text-center md:items-start md:text-left">
          <BrandLogo
            decorative
            className="anim-bob mb-4 hidden h-28 w-28 sm:block md:mb-5 md:h-40 md:w-40 lg:h-48 lg:w-48"
          />

          <p
            className="mono anim-rise mb-3 md:mb-4"
            style={{ color: 'rgba(249,245,242,0.85)' }}
          >
            {isRegister ? 'Crea tu espacio' : 'Bienvenido de nuevo'}
          </p>

          <h1
            className="display anim-rise anim-rise-delay-1"
            style={{
              color: 'var(--color-hi-vis-yellow)',
              fontSize: 'clamp(40px, 11vw, 110px)',
              lineHeight: 0.85,
            }}
          >
            {isRegister ? (
              <>
                Entra.
                <br />
                Crece.
              </>
            ) : (
              <>
                Hola.
                <br />
                Otra vez.
              </>
            )}
          </h1>

          <p
            className="anim-rise anim-rise-delay-2 mt-5 max-w-sm text-[15px] font-medium leading-snug md:mt-6 md:text-[16px]"
            style={{ color: 'rgba(249,245,242,0.88)' }}
          >
            {isRegister
              ? 'Abre tu cuenta gratis y empieza a chatear con los modelos Matu.'
              : 'Tus chats, proyectos y modelos siguen aquí. Retómalos cuando quieras.'}
          </p>

          <p
            className="mono mt-6 hidden md:mt-8 md:block"
            style={{ color: 'rgba(249,245,242,0.55)' }}
          >
            MatByte S.A.S. · Colombia
          </p>
        </div>

        <div className="relative z-10 flex w-full justify-center md:justify-end">
          <form
            className="card card-bone anim-rise anim-rise-delay-2 w-full max-w-[420px] border-[2.5px] border-black shadow-[4px_4px_0_#000]"
            onSubmit={submit}
          >
            <p className="mono mb-5" style={{ color: 'rgba(26,26,26,0.55)' }}>
              {isRegister
                ? codeSent
                  ? 'Verifica tu correo'
                  : 'Crear cuenta'
                : 'Iniciar sesión'}
            </p>

            <div className="flex flex-col gap-3.5">
              {isRegister && codeSent ? (
                <>
                  <p className="text-[15px] font-medium leading-snug">
                    Te enviamos un código de 6 dígitos a{' '}
                    <strong>{email.trim()}</strong>. La cuenta se crea cuando lo
                    confirmas.
                  </p>
                  <label className="flex flex-col gap-1.5">
                    <span className="mono" style={{ color: 'rgba(26,26,26,0.65)' }}>
                      Código
                    </span>
                    <input
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      className="fp-input text-center text-[24px] font-bold tracking-[0.35em]"
                      required
                      minLength={6}
                      maxLength={6}
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-[14px] font-medium underline underline-offset-2"
                      disabled={busy}
                      onClick={async () => {
                        setError('');
                        setBusy(true);
                        try {
                          const json = await auth.requestSignupCode(
                            email.trim(),
                            password,
                            name.trim() || email.split('@')[0]
                          );
                          if (json && json.sent === false) {
                            setError('El código anterior sigue vigente. Revisa tu bandeja.');
                          }
                        } catch (err) {
                          setError(err.message || 'No se pudo reenviar');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Reenviar código
                    </button>
                    <button
                      type="button"
                      className="text-[14px] font-medium underline underline-offset-2"
                      onClick={() => {
                        setCodeSent(false);
                        setCode('');
                        setError('');
                      }}
                    >
                      Corregir correo
                    </button>
                  </div>
                </>
              ) : null}
              {isRegister && !codeSent && (
                <label className="flex flex-col gap-1.5">
                  <span
                    className="mono"
                    style={{ color: 'rgba(26,26,26,0.65)' }}
                  >
                    Nombre
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Tu nombre"
                    className="fp-input"
                  />
                </label>
              )}
              {!codeSent && (
              <label className="flex flex-col gap-1.5">
                <span className="mono" style={{ color: 'rgba(26,26,26,0.65)' }}>
                  Correo
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="tu@empresa.com"
                  className="fp-input"
                />
              </label>
              )}
              {!codeSent && (
              <label className="flex flex-col gap-1.5">
                <span className="mono" style={{ color: 'rgba(26,26,26,0.65)' }}>
                  Contraseña
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    isRegister ? 'new-password' : 'current-password'
                  }
                  placeholder="••••••••"
                  className="fp-input"
                />
              </label>
              )}

              {!isRegister && (
                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    className="py-1 text-[14px] font-medium underline underline-offset-2"
                    style={{ color: 'var(--color-ink-black)' }}
                    onClick={openRecover}
                  >
                    ¿Olvidaste la clave?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="btn-pill cta-label mt-1 w-full"
                disabled={busy}
                style={{
                  opacity: busy ? 0.7 : 1,
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy
                  ? 'Un momento…'
                  : isRegister
                    ? codeSent
                      ? 'Verificar y crear cuenta'
                      : 'Enviar código'
                    : 'Entrar al chat'}
              </button>
            </div>

            <p
              className="mt-5 text-center text-[14px] font-medium"
              style={{ color: 'rgba(26,26,26,0.75)' }}
            >
              {isRegister ? (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    to="/login"
                    className="underline underline-offset-2"
                    style={{ color: 'var(--color-ink-black)' }}
                  >
                    Inicia sesión
                  </Link>
                </>
              ) : (
                <>
                  ¿Eres nuevo?{' '}
                  <Link
                    to="/register"
                    className="underline underline-offset-2"
                    style={{ color: 'var(--color-ink-black)' }}
                  >
                    Crea una cuenta
                  </Link>
                </>
              )}
            </p>
          </form>
        </div>
      </div>

      {recoverOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={recoverTitleId}
          onClick={closeRecover}
        >
          <div
            className="w-full max-w-md rounded-[8px] border-[2.5px] border-black bg-[#f9f5f2] p-5 text-[#1a1a1a] shadow-[6px_6px_0_#000]"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="mono text-[11px] opacity-55">Recuperar contraseña</p>
            <h2
              id={recoverTitleId}
              className="display mt-2 text-[28px] leading-none"
            >
              {recoverSent ? 'Revisa tu correo' : '¿Olvidaste la clave?'}
            </h2>

            {recoverSent ? (
              <>
                <p className="mt-3 text-[15px] font-medium leading-snug">
                  Si hay una cuenta con ese correo, te enviamos un enlace para
                  elegir una clave nueva. Ábrelo desde tu bandeja.
                </p>
                <button
                  type="button"
                  className="btn-pill cta-label mt-5 w-full !bg-[#f4ed36] !text-black"
                  onClick={closeRecover}
                >
                  Entendido
                </button>
              </>
            ) : (
              <form className="mt-4 flex flex-col gap-3.5" onSubmit={submitRecover}>
                <p className="text-[15px] font-medium leading-snug">
                  Escribe el correo de tu cuenta. Te enviaremos un enlace para
                  restablecer la clave.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="mono" style={{ color: 'rgba(26,26,26,0.65)' }}>
                    Correo
                  </span>
                  <input
                    type="email"
                    required
                    value={recoverEmail}
                    onChange={(ev) => setRecoverEmail(ev.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="tu@empresa.com"
                    className="fp-input"
                    autoFocus
                  />
                </label>
                {recoverError ? (
                  <p className="text-[14px] font-medium leading-snug text-[#c94245]" role="alert">
                    {recoverError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="btn-pill cta-label mt-1 w-full !bg-[#f4ed36] !text-black"
                  disabled={recoverBusy}
                  style={{
                    opacity: recoverBusy ? 0.7 : 1,
                    cursor: recoverBusy ? 'wait' : 'pointer',
                  }}
                >
                  {recoverBusy ? 'Enviando…' : 'Enviar enlace'}
                </button>
                <button
                  type="button"
                  className="text-center text-[14px] font-medium underline underline-offset-2"
                  style={{ color: 'var(--color-ink-black)' }}
                  onClick={closeRecover}
                  disabled={recoverBusy}
                >
                  Volver al inicio de sesión
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="auth-error-title"
          onClick={() => setError('')}
        >
          <div
            className="w-full max-w-md rounded-[8px] border-[2.5px] border-black bg-[#f9f5f2] p-5 text-[#1a1a1a] shadow-[6px_6px_0_#000]"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="mono text-[11px] opacity-55">
              {isRegister ? 'Registro' : 'Inicio de sesión'}
            </p>
            <h2
              id="auth-error-title"
              className="display mt-2 text-[28px] leading-none"
            >
              No pudimos entrar
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-snug">{error}</p>
            <p className="mt-2 text-[13px] opacity-70">
              {isRegister
                ? 'Revisa el correo o prueba con otro. La contraseña debe tener mínimo 8 caracteres.'
                : 'Si aún no tienes cuenta, regístrate primero. Si ya la tienes, revisa correo y contraseña.'}
            </p>
            <button
              type="button"
              className="btn-pill cta-label mt-5 w-full !bg-[#f4ed36] !text-black"
              onClick={() => setError('')}
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
