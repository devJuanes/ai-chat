import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import BrandLogo from '../BrandLogo';
import { SITE } from '../../lib/site';
import '../../styles/landing.css';

export function MarketingHeader({ onContact }) {
  const auth = useAuth();
  const loginTo = auth.user ? '/c/new' : '/login';
  const startTo = auth.user ? '/c/new' : '/register';

  return (
    <header className="mkt-header relative z-20 flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-[17px] md:px-10">
      <Link
        to="/"
        className="display no-underline inline-flex min-w-0 shrink items-center gap-2 sm:gap-2.5"
        style={{
          color: 'var(--color-hi-vis-yellow)',
          fontSize: 'clamp(17px, 4.2vw, 28px)',
          lineHeight: 1,
        }}
      >
        <BrandLogo
          size={28}
          decorative
          className="shrink-0 rounded-[6px] border-2 border-black shadow-[2px_2px_0_#000] sm:h-[34px] sm:w-[34px]"
        />
        <span className="truncate">Matu AI</span>
      </Link>

      <nav className="mkt-header__nav flex shrink-0 items-center gap-2.5 sm:gap-4 md:gap-5">
        <a
          href={`https://${SITE.domain}`}
          className="mono no-underline hidden lg:inline"
          style={{ color: 'rgba(249,245,242,0.75)' }}
          target="_blank"
          rel="noreferrer"
        >
          {SITE.domain}
        </a>
        <Link to="/modelos" className="link-underline hidden sm:inline">
          Modelos
        </Link>
        <Link to="/precios" className="link-underline hidden sm:inline">
          Precios
        </Link>
        {onContact ? (
          <button
            type="button"
            className="link-underline hidden md:inline"
            onClick={onContact}
          >
            Contacto
          </button>
        ) : (
          <Link to="/contacto" className="link-underline hidden md:inline">
            Contacto
          </Link>
        )}
        <Link
          to={loginTo}
          className="link-underline whitespace-nowrap !text-[11px] sm:!text-[12px]"
        >
          {auth.user ? 'Chat' : 'Entrar'}
        </Link>
        <Link
          to={startTo}
          className="btn-pill cta-label mkt-header__cta whitespace-nowrap !px-3.5 !py-2 !text-[12px] sm:!px-4 sm:!py-2.5 sm:!text-[13px]"
        >
          {auth.user ? 'Espacio' : 'Empezar'}
        </Link>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-10 px-4 py-12 sm:px-5 md:px-10 md:py-10"
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
                lineHeight: 1.1,
              }}
            >
              Matu AI
            </div>
          </div>
          <p
            className="mt-4 max-w-xs text-[14px] leading-relaxed sm:mt-3 sm:leading-snug"
            style={{ color: 'rgba(249,245,242,0.85)' }}
          >
            Producto de <strong>{SITE.companyName}</strong> ({SITE.companyShort}
            ). Inteligencia artificial sectorizada para negocios reales.
          </p>
          <p className="mono mt-4 sm:mt-3" style={{ color: 'rgba(249,245,242,0.65)' }}>
            {SITE.companyCountry} · {year}
          </p>
        </div>

        <div>
          <p className="mono mb-4 sm:mb-3" style={{ color: 'var(--color-hi-vis-yellow)' }}>
            Producto
          </p>
          <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed sm:gap-2">
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
          <p className="mono mb-4 sm:mb-3" style={{ color: 'var(--color-hi-vis-yellow)' }}>
            Empresa
          </p>
          <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed sm:gap-2">
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
          <p className="mono mb-4 sm:mb-3" style={{ color: 'var(--color-hi-vis-yellow)' }}>
            Legal
          </p>
          <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed sm:gap-2">
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
        className="mx-auto mt-10 max-w-6xl border-t pt-6 text-[12px] leading-relaxed sm:pt-5"
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

export default function MarketingShell({ children, onContact }) {
  return (
    <div className="landing min-h-dvh">
      <MarketingHeader onContact={onContact} />
      {children}
      <MarketingFooter />
    </div>
  );
}
