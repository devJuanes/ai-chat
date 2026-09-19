import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import BrandLogo from '../BrandLogo';
import { SITE } from '../../lib/site';
import '../../styles/landing.css';

export function MarketingHeader() {
  const auth = useAuth();
  const loginTo = auth.user ? '/c/new' : '/login';
  const startTo = auth.user ? '/c/new' : '/register';

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-[17px] md:px-10">
      <a
        href={`https://${SITE.domain}`}
        className="mono no-underline"
        style={{ color: 'rgba(249,245,242,0.75)' }}
        target="_blank"
        rel="noreferrer"
      >
        {SITE.domain}
      </a>
      <Link
        to="/"
        className="display no-underline inline-flex items-center gap-2.5"
        style={{
          color: 'var(--color-hi-vis-yellow)',
          fontSize: 'clamp(20px, 4vw, 28px)',
          lineHeight: 1,
        }}
      >
        <BrandLogo
          size={34}
          decorative
          className="rounded-[6px] border-2 border-black shadow-[2px_2px_0_#000]"
        />
        Matu AI
      </Link>
      <nav className="flex flex-wrap items-center gap-4 md:gap-5">
        <Link to="/modelos" className="link-underline hidden sm:inline">
          Modelos
        </Link>
        <Link to="/precios" className="link-underline hidden sm:inline">
          Precios
        </Link>
        <Link to="/acerca" className="link-underline hidden md:inline">
          Empresa
        </Link>
        <Link to={loginTo} className="link-underline">
          {auth.user ? 'Abrir chat' : 'Iniciar sesión'}
        </Link>
        <Link to={startTo} className="btn-pill cta-label !px-4 !py-2.5 text-[13px]">
          {auth.user ? 'Ir al espacio' : 'Empezar'}
        </Link>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-10 px-5 py-10 md:px-10"
      style={{ background: '#375027' }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <BrandLogo
              size={40}
              decorative
              className="rounded-[6px] border-2 border-black shadow-[3px_3px_0_#000]"
            />
            <div
              className="display"
              style={{
                color: 'var(--color-hi-vis-yellow)',
                fontSize: 26,
                lineHeight: 1,
              }}
            >
              Matu AI
            </div>
          </div>
          <p
            className="mt-3 max-w-xs text-[14px] leading-snug"
            style={{ color: 'rgba(249,245,242,0.85)' }}
          >
            Producto de <strong>{SITE.companyName}</strong> ({SITE.companyShort}
            ). Inteligencia artificial sectorizada para negocios reales.
          </p>
          <p className="mono mt-3" style={{ color: 'rgba(249,245,242,0.65)' }}>
            {SITE.companyCountry} · {year}
          </p>
        </div>

        <div>
          <p className="mono mb-3" style={{ color: 'var(--color-hi-vis-yellow)' }}>
            Producto
          </p>
          <ul className="flex flex-col gap-2 text-[14px]">
            <li>
              <Link to="/modelos" className="link-underline">
                Modelos
              </Link>
            </li>
            <li>
              <Link to="/precios" className="link-underline">
                Precios
              </Link>
            </li>
            <li>
              <Link to="/register" className="link-underline">
                Crear cuenta
              </Link>
            </li>
            <li>
              <Link to="/login" className="link-underline">
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mono mb-3" style={{ color: 'var(--color-hi-vis-yellow)' }}>
            Empresa
          </p>
          <ul className="flex flex-col gap-2 text-[14px]">
            <li>
              <Link to="/acerca" className="link-underline">
                Acerca de Matubyte
              </Link>
            </li>
            <li>
              <Link to="/contacto" className="link-underline">
                Contacto
              </Link>
            </li>
            <li>
              <a
                href={`https://${SITE.domain}`}
                target="_blank"
                rel="noreferrer"
                className="link-underline"
              >
                {SITE.domain}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mono mb-3" style={{ color: 'var(--color-hi-vis-yellow)' }}>
            Legal
          </p>
          <ul className="flex flex-col gap-2 text-[14px]">
            <li>
              <Link to="/privacidad" className="link-underline">
                Privacidad
              </Link>
            </li>
            <li>
              <Link to="/terminos" className="link-underline">
                Términos
              </Link>
            </li>
            <li>
              <a href={`mailto:${SITE.contactEmail}`} className="link-underline">
                {SITE.contactEmail}
              </a>
            </li>
            <li>
              <a
                href={SITE.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="link-underline"
              >
                WhatsApp
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="mx-auto mt-10 max-w-6xl border-t pt-5 text-[12px] leading-relaxed"
        style={{
          borderColor: 'rgba(249,245,242,0.2)',
          color: 'rgba(249,245,242,0.65)',
        }}
      >
        © {year} {SITE.companyName}. {SITE.productLegal} es una marca de{' '}
        {SITE.companyShort}. Busca Matu AI, Matubyte o MatByte S.A.S. — somos
        quienes desarrollamos esta plataforma.
      </div>
    </footer>
  );
}

export default function MarketingShell({ children }) {
  return (
    <div className="landing min-h-dvh">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
