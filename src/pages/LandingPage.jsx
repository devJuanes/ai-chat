import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { BrandMascot, ConfettiBit } from '../components/BrandMascot';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildFaqLd,
  buildOrganizationLd,
  buildSoftwareLd,
  buildWebSiteLd,
  graphLd,
} from '../components/seo/SeoHead';
import {
  FAQ,
  MODELS_PUBLIC,
  PLANS_PUBLIC,
  SITE,
  TESTIMONIALS,
} from '../lib/site';

const STEPS = [
  { n: '01', t: 'Entra', d: 'Crea tu espacio gratis en segundos.' },
  { n: '02', t: 'Elige modelo', d: 'Negocio, marketing, commerce, UI o ingeniería.' },
  { n: '03', t: 'Envía', d: 'Copy, tablas, HTML preview y planes listos.' },
];

export default function LandingPage() {
  const auth = useAuth();
  const startTo = auth.user ? '/c/new' : '/register';
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS];

  const jsonLd = graphLd(
    buildOrganizationLd(),
    buildWebSiteLd(),
    buildSoftwareLd(),
    buildFaqLd(FAQ),
    buildBreadcrumbLd([{ name: 'Inicio', path: '/' }])
  );

  return (
    <MarketingShell>
      <SeoHead
        title="IA para negocios, marketing, e-commerce y diseño web"
        description={`Matu AI by ${SITE.companyName} (${SITE.companyShort}): chat con modelos propios sectorizados. Plan gratis · Pro $29 · Team $99. ${SITE.domain}`}
        path="/"
        jsonLd={jsonLd}
      />

      <section className="relative flex min-h-[calc(100dvh-72px)] flex-col items-center justify-center px-5 pb-16 pt-6 md:px-10">
        <ConfettiBit
          className="anim-float absolute left-[8%] top-[18%] hidden sm:block"
          fill="#f8c1ba"
        />
        <ConfettiBit
          className="anim-float absolute right-[12%] top-[28%] hidden sm:block"
          fill="#b5c995"
        />

        <p
          className="mono anim-rise mb-6 text-center"
          style={{ color: 'rgba(249,245,242,0.9)' }}
        >
          {SITE.productLegal} · by {SITE.companyName} · {SITE.domain}
        </p>

        <div className="relative w-full max-w-[1100px]">
          <BrandMascot className="anim-bob absolute -right-2 top-1/2 z-0 hidden h-[180px] w-[165px] -translate-y-1/2 md:block lg:right-8 lg:h-[220px] lg:w-[200px]" />
          <h1 className="display hero-title anim-rise anim-rise-delay-1 relative z-10 text-center">
            <span style={{ color: 'var(--color-hi-vis-yellow)' }}>Habla.</span>
            <br />
            <span style={{ color: 'var(--color-buttery-yellow)' }}>Cierra.</span>
            <br />
            <span style={{ color: 'var(--color-hi-vis-yellow)' }}>Crece.</span>
          </h1>
        </div>

        <p
          className="anim-rise anim-rise-delay-2 mx-auto mt-8 max-w-lg text-center"
          style={{
            fontSize: 'clamp(15px, 2.5vw, 18px)',
            letterSpacing: '0.04em',
            lineHeight: 1.35,
            color: 'var(--color-bone-white)',
          }}
        >
          El copiloto de IA de <strong>Matubyte</strong> con modelos propios
          para negocio, growth, e-commerce, UI e ingeniería — no un chat genérico.
        </p>

        <div className="anim-rise anim-rise-delay-3 mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <Link to={startTo} className="btn-pill cta-label">
            Empezar gratis
          </Link>
          <Link to="/modelos" className="btn-outline cta-label">
            Ver modelos
          </Link>
        </div>

        <a href="#testimonios" className="link-underline mt-6">
          Ver qué dicen los equipos
        </a>
      </section>

      <section id="nichos" className="px-5 py-10 md:px-10 md:py-16">
        <h2
          className="display section-title mb-4 max-w-[16ch]"
          style={{ color: 'var(--color-hi-vis-yellow)' }}
        >
          IA por nicho.
          <br />
          No genérica.
        </h2>
        <p
          className="mb-10 max-w-xl text-[15px] leading-snug"
          style={{ color: 'rgba(249,245,242,0.88)' }}
        >
          Si buscas una IA para marketing, e-commerce, diseño web, ventas u
          operaciones, Matu AI — desarrollado por {SITE.companyName} — tiene un
          modelo pensado para eso.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS_PUBLIC.map((f) => (
            <article
              key={f.id}
              className="card flex flex-col gap-2 border-[2.5px] border-black shadow-[4px_4px_0_#000]"
              style={{ background: f.color, color: f.ink }}
            >
              <span className="mono opacity-80">{f.tag}</span>
              <h3
                className="display"
                style={{ fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 0.9 }}
              >
                {f.name}
              </h3>
              <p className="text-[13px] font-bold uppercase tracking-wide opacity-70">
                {f.niche}
              </p>
              <p className="text-[15px] font-bold leading-snug opacity-90">
                {f.body}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-8">
          <Link to="/modelos" className="btn-outline cta-label">
            Detalle de modelos
          </Link>
        </div>
      </section>

      <section className="px-5 py-10 md:px-10 md:py-16">
        <div className="card card-bone mx-auto max-w-3xl border-[2.5px] border-black shadow-[5px_5px_0_#000]">
          <p className="mono mb-4">Cómo funciona</p>
          <h2
            className="display mb-8"
            style={{
              fontSize: 'clamp(40px, 9vw, 80px)',
              lineHeight: 0.85,
            }}
          >
            Tres pasos.
            <br />
            Cero teatro.
          </h2>
          <div className="flex flex-col gap-6">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="flex gap-4 border-t pt-4"
                style={{ borderColor: 'rgba(26,26,26,0.2)' }}
              >
                <span className="mono" style={{ color: 'rgba(26,26,26,0.55)' }}>
                  {s.n}
                </span>
                <div>
                  <div className="cta-label">{s.t}</div>
                  <p
                    className="mt-1 text-[15px] leading-snug"
                    style={{ color: 'rgba(26,26,26,0.8)' }}
                  >
                    {s.d}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="precios" className="px-5 py-10 md:px-10 md:py-16">
        <h2
          className="display section-title mb-3"
          style={{ color: 'var(--color-hi-vis-yellow)' }}
        >
          Precios honestos.
        </h2>
        <p
          className="mb-8 max-w-lg text-[15px]"
          style={{ color: 'rgba(249,245,242,0.88)' }}
        >
          Empieza gratis. Premium accesible para meterle caña al mercado sin
          quemar presupuesto.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS_PUBLIC.map((p) => (
            <article
              key={p.id}
              className={`card flex flex-col border-[2.5px] border-black shadow-[4px_4px_0_#000] ${
                p.highlight ? '' : 'card-bone'
              }`}
              style={
                p.highlight
                  ? {
                      background: 'var(--color-hi-vis-yellow)',
                      color: '#1a1a1a',
                    }
                  : undefined
              }
            >
              {p.highlight && (
                <span className="mono mb-2">Recomendado</span>
              )}
              <h3 className="display text-[36px] leading-none">{p.name}</h3>
              <p className="mt-3 text-[28px] font-bold">
                {p.price}
                <span className="text-[14px] font-bold opacity-70">
                  {' '}
                  {p.period}
                </span>
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-[14px] font-bold leading-snug">
                {p.features.map((f) => (
                  <li key={f}>→ {f}</li>
                ))}
              </ul>
              <Link
                to={startTo}
                className="btn-pill cta-label mt-6 !bg-black !text-[var(--color-hi-vis-yellow)]"
              >
                {p.id === 'free' ? 'Empezar gratis' : 'Elegir plan'}
              </Link>
            </article>
          ))}
        </div>
        <p className="mono mt-6 opacity-80">
          <Link to="/precios" className="link-underline">
            Ver página de precios
          </Link>
        </p>
      </section>

      <section id="testimonios" className="px-5 py-10 md:px-10 md:py-16">
        <h2
          className="display section-title mb-8"
          style={{ color: 'var(--color-hi-vis-yellow)' }}
        >
          Equipos reales.
          <br />
          Trabajo real.
        </h2>
        <div className="t-marquee">
          <div className="t-track" aria-label="Testimonios de clientes">
            {doubled.map((t, i) => (
              <figure key={`${t.name}-${i}`} className="t-card">
                <blockquote className="text-[15px] font-bold leading-snug">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-4 border-t border-black/15 pt-3">
                  <div className="font-bold">{t.name}</div>
                  <div className="mono mt-1 opacity-70">
                    {t.role} · {t.company}
                  </div>
                  <div className="mono mt-1 opacity-50">{t.sector}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="px-5 py-10 md:px-10 md:py-16">
        <div className="card card-bone mx-auto max-w-3xl border-[2.5px] border-black shadow-[5px_5px_0_#000]">
          <p className="mono mb-3">FAQ · SEO</p>
          <h2
            className="display mb-8"
            style={{ fontSize: 'clamp(36px, 8vw, 64px)', lineHeight: 0.9 }}
          >
            Preguntas
            <br />
            frecuentes
          </h2>
          <div className="flex flex-col gap-5">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="border-t pt-4"
                style={{ borderColor: 'rgba(26,26,26,0.2)' }}
              >
                <summary className="cursor-pointer list-none font-bold text-[16px]">
                  {item.q}
                </summary>
                <p
                  className="mt-2 text-[14px] leading-snug"
                  style={{ color: 'rgba(26,26,26,0.8)' }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-6 md:px-10">
        <div
          className="card flex flex-col items-start gap-5 border-[2.5px] border-black shadow-[5px_5px_0_#000] md:flex-row md:items-center md:justify-between"
          style={{ background: 'var(--color-firecracker-red)' }}
        >
          <div>
            <h2
              className="display"
              style={{
                color: 'var(--color-bone-white)',
                fontSize: 'clamp(36px, 8vw, 64px)',
                lineHeight: 0.9,
              }}
            >
              ¿Listo
              <br />
              para enviar?
            </h2>
            <p
              className="mono mt-3"
              style={{ color: 'rgba(249,245,242,0.85)' }}
            >
              Matu AI · {SITE.companyName} · {SITE.domain}
            </p>
          </div>
          <Link to={startTo} className="btn-pill cta-label shrink-0">
            Crear cuenta
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
