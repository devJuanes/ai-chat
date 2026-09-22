import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { BrandMascot, ConfettiBit } from '../components/BrandMascot';
import {
  InstagramIcon,
  MessengerIcon,
  WhatsAppIcon,
} from '../components/Icons';
import MarketingShell from '../components/marketing/MarketingShell';
import ContactModal from '../components/marketing/ContactModal';
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
  {
    n: '01',
    t: 'Entra',
    d: 'Crea tu espacio gratis y elige si quieres chat o agentes.',
    color: '#f8c1ba',
    ink: '#1a1a1a',
  },
  {
    n: '02',
    t: 'Configura',
    d: 'Modelo de chat por nicho, o MatuBot con WhatsApp, Instagram y Messenger.',
    color: '#f4ed36',
    ink: '#1a1a1a',
  },
  {
    n: '03',
    t: 'Activa',
    d: 'Responde clientes, califica leads y avanza ventas — o genera copy y planes en el chat.',
    color: '#b5c995',
    ink: '#1a1a1a',
  },
];

const META_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, color: '#25D366' },
  { id: 'instagram', label: 'Instagram', Icon: InstagramIcon, color: '#E4405F' },
  { id: 'messenger', label: 'Messenger', Icon: MessengerIcon, color: '#0084FF' },
];

const META_FEATURES = [
  'Inbox unificado para todos los canales Meta.',
  'Catálogo, notas y etapas del embudo en cada conversación.',
  'MatuBot califica leads y propone el siguiente paso.',
  'Handoff humano cuando el caso lo requiere.',
];

const MATUBOT_VIDEO = '/media/matubot-preview.mp4';

export default function LandingPage() {
  const auth = useAuth();
  const startTo = auth.user ? '/c/new' : '/register';
  const botsTo = auth.user ? '/bots/agentes' : '/register';
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS];
  const [openFaq, setOpenFaq] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const openContact = () => setContactOpen(true);

  const jsonLd = graphLd(
    buildOrganizationLd(),
    buildWebSiteLd(),
    buildSoftwareLd(),
    buildFaqLd(FAQ),
    buildBreadcrumbLd([{ name: 'Inicio', path: '/' }])
  );

  return (
    <MarketingShell onContact={openContact}>
      <SeoHead
        title="IA para negocios, marketing, e-commerce y diseño web"
        description={`Matu AI by ${SITE.companyName} (${SITE.companyShort}): chat con modelos propios y agentes para WhatsApp, Instagram y Messenger. Plan gratis · Pro $29 · Team $99. ${SITE.domain}`}
        path="/"
        jsonLd={jsonLd}
      />

      <section className="relative flex min-h-[calc(100dvh-72px)] flex-col items-center justify-center px-4 pb-14 pt-8 sm:px-5 md:px-10 md:pb-16 md:pt-6">
        <ConfettiBit
          className="anim-float absolute left-[8%] top-[18%] hidden sm:block"
          fill="#f8c1ba"
        />
        <ConfettiBit
          className="anim-float absolute right-[12%] top-[28%] hidden sm:block"
          fill="#b5c995"
        />

        <p
          className="mono anim-rise mb-5 flex max-w-[18rem] flex-col items-center gap-1.5 text-center sm:mb-6 sm:block sm:max-w-none"
          style={{ color: 'rgba(249,245,242,0.9)' }}
        >
          <span>
            {SITE.productLegal}
            <span className="mx-1.5 opacity-50">·</span>
            by {SITE.companyName}
          </span>
          <span className="hidden opacity-50 sm:inline">·</span>
          <span>{SITE.domain}</span>
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
          className="anim-rise anim-rise-delay-2 mx-auto mt-6 max-w-md text-center sm:mt-8 sm:max-w-lg"
          style={{
            fontSize: 'clamp(14px, 3.6vw, 18px)',
            letterSpacing: '0.03em',
            lineHeight: 1.45,
            color: 'var(--color-bone-white)',
          }}
        >
          El copiloto de IA de <strong>Matubyte</strong> con modelos propios
          para negocio, growth, e-commerce, UI e ingeniería — y agentes que
          atienden WhatsApp, Instagram y Messenger.
        </p>

        <div className="anim-rise anim-rise-delay-3 mt-7 flex w-full max-w-sm flex-col items-stretch gap-3 sm:mt-8 sm:max-w-none sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <Link to={startTo} className="btn-pill cta-label justify-center">
            Empezar gratis
          </Link>
          <button
            type="button"
            className="btn-outline cta-label justify-center"
            onClick={openContact}
          >
            Contacto
          </button>
        </div>

        <a href="#testimonios" className="link-underline mt-7 sm:mt-6">
          Ver qué dicen los equipos
        </a>
      </section>

      <section id="nichos" className="px-4 py-12 sm:px-5 md:px-10 md:py-16">
        <h2
          className="display section-title mb-5 text-center sm:mb-4"
          style={{ color: 'var(--color-hi-vis-yellow)' }}
        >
          IA por nicho.
          <br />
          No genérica.
        </h2>
        <p
          className="section-lead mx-auto mb-8 max-w-xl text-center text-[14px] leading-relaxed sm:mb-10 sm:text-[15px] sm:leading-snug"
          style={{ color: 'rgba(249,245,242,0.88)' }}
        >
          Si buscas una IA para marketing, e-commerce, diseño web, ventas u
          operaciones, Matu AI — desarrollado por {SITE.companyName} — tiene un
          modelo pensado para eso.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS_PUBLIC.map((f) => (
            <Link
              key={f.id}
              to={`/modelos/${f.id}`}
              className="model-card card flex flex-col gap-2.5 border-[2.5px] border-black shadow-[4px_4px_0_#000] no-underline"
              style={{ background: f.color, color: f.ink }}
            >
              <span className="mono opacity-80">{f.tag}</span>
              <h3
                className="display"
                style={{
                  fontSize: 'clamp(26px, 6vw, 40px)',
                  lineHeight: 1.1,
                }}
              >
                {f.name}
              </h3>
              <p className="text-[12px] font-bold uppercase tracking-wide opacity-70 sm:text-[13px]">
                {f.niche}
              </p>
              <p className="text-[14px] font-bold leading-relaxed opacity-90 sm:text-[15px] sm:leading-snug">
                {f.body}
              </p>
              <span className="mono mt-auto pt-2 opacity-70">Ver detalle →</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="canales" className="w-full">
        <div
          className="grid w-full grid-cols-1 items-stretch border-y-[2.5px] border-black lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          style={{ background: 'var(--color-bone-white)', color: '#1a1a1a' }}
        >
          <div className="order-2 flex min-w-0 flex-col items-center justify-center px-4 py-10 text-center sm:px-8 lg:order-1 lg:items-start lg:px-12 lg:py-12 lg:text-left xl:px-16">
            <p className="mono mb-4 opacity-65">Agentes · Meta</p>
            <h2
              className="display section-heading mb-4 w-full"
              style={{
                fontSize: 'clamp(26px, 7vw, 44px)',
                lineHeight: 1.18,
                letterSpacing: '0.02em',
              }}
            >
              Atiende WhatsApp,
              <br />
              Instagram y Messenger.
            </h2>
            <p
              className="section-lead mb-7 max-w-lg text-[14px] font-bold leading-relaxed sm:mb-6 sm:text-[15px]"
              style={{ color: 'rgba(26,26,26,0.8)' }}
            >
              Agentes MatuBot que responden, califican leads, usan tu catálogo y
              mueven el pipeline — sin perder el tono de tu marca.
            </p>

            <div className="mb-7 flex w-full flex-col gap-2.5 sm:mb-6 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-2.5">
              {META_CHANNELS.map(({ id, label, Icon, color }) => (
                <span
                  key={id}
                  className="inline-flex w-full items-center justify-center gap-2 border-[2.5px] border-black bg-white px-3 py-2.5 text-[13px] font-bold shadow-[2px_2px_0_#000] sm:w-auto sm:justify-start sm:py-1.5 sm:text-[12px]"
                >
                  <span style={{ color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </span>
              ))}
            </div>

            <ul className="mb-8 flex w-full max-w-lg flex-col text-left sm:mb-7">
              {META_FEATURES.map((f) => (
                <li
                  key={f}
                  className="border-t py-3 text-[14px] font-bold leading-relaxed"
                  style={{
                    borderColor: 'rgba(26,26,26,0.18)',
                    color: 'rgba(26,26,26,0.85)',
                  }}
                >
                  → {f}
                </li>
              ))}
            </ul>

            <Link
              to={botsTo}
              className="btn-pill cta-label inline-flex w-full justify-center !bg-black !text-[var(--color-hi-vis-yellow)] sm:w-auto"
            >
              {auth.user ? 'Ver agentes' : 'Crear agente'}
            </Link>
          </div>

          <div className="order-1 relative aspect-[16/10] w-full overflow-hidden border-b-[2.5px] border-black sm:aspect-video lg:order-2 lg:aspect-auto lg:min-h-[520px] lg:border-b-0 lg:border-l-[2.5px]">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={MATUBOT_VIDEO}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label="Vista previa de MatuBot en WhatsApp, Instagram y Messenger"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 lg:h-20"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.35), transparent)',
              }}
            />
          </div>
        </div>
      </section>

      <section className="w-full py-10 md:py-12">
        <div
          className="w-full border-y-[2.5px] border-black px-4 py-10 sm:px-8 md:px-10 md:py-10"
          style={{
            background: 'var(--color-hi-vis-yellow)',
            color: '#1a1a1a',
          }}
        >
          <div className="section-head mx-auto flex max-w-6xl flex-col items-center gap-5 text-center lg:flex-row lg:justify-between lg:text-left">
            <div className="w-full lg:w-auto">
              <p className="mono mb-3 opacity-70 sm:mb-2">Cómo funciona</p>
              <h2
                className="display section-heading"
                style={{
                  fontSize: 'clamp(30px, 8vw, 56px)',
                  lineHeight: 1.18,
                  letterSpacing: '0.02em',
                }}
              >
                Tres pasos.
                <br />
                Cero teatro.
              </h2>
            </div>
            <p className="section-lead max-w-sm text-[14px] font-bold leading-relaxed opacity-80 sm:leading-snug lg:text-right">
              Del registro a tu primer agente o chat — sin vueltas.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-8 md:px-10 md:pt-8">
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            {STEPS.map((s, i) => (
              <article
                key={s.n}
                className="card relative flex min-h-[200px] flex-col border-[2.5px] border-black shadow-[4px_4px_0_#000] sm:min-h-[240px] max-sm:!transform-none"
                style={{
                  background: s.color,
                  color: s.ink,
                  transform:
                    i === 1
                      ? 'rotate(-0.6deg)'
                      : i === 2
                        ? 'rotate(0.5deg)'
                        : 'rotate(0.4deg)',
                }}
              >
                <span
                  className="display absolute right-3 top-2 opacity-25"
                  style={{ fontSize: 'clamp(48px, 8vw, 72px)', lineHeight: 1 }}
                  aria-hidden
                >
                  {s.n}
                </span>
                <p className="mono relative z-[1] opacity-70">Paso {s.n}</p>
                <h3
                  className="display relative z-[1] mt-4 sm:mt-3"
                  style={{
                    fontSize: 'clamp(26px, 6vw, 40px)',
                    lineHeight: 1.12,
                  }}
                >
                  {s.t}
                </h3>
                <p className="relative z-[1] mt-3.5 flex-1 text-[14px] font-bold leading-relaxed opacity-90 sm:mt-3 sm:leading-snug">
                  {s.d}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-3">
            <Link
              to={startTo}
              className="btn-pill cta-label inline-flex w-full justify-center !bg-black !text-[var(--color-hi-vis-yellow)] sm:w-auto"
            >
              Empezar gratis
            </Link>
            <Link
              to={botsTo}
              className="btn-outline cta-label inline-flex w-full justify-center sm:w-auto"
            >
              Crear agente
            </Link>
          </div>
        </div>
      </section>

      <section id="precios" className="px-4 py-12 sm:px-5 md:px-10 md:py-16">
        <h2
          className="display section-title mb-4 text-center sm:mb-3"
          style={{ color: 'var(--color-hi-vis-yellow)' }}
        >
          Precios honestos.
        </h2>
        <p
          className="section-lead mx-auto mb-8 max-w-lg text-center text-[14px] leading-relaxed sm:text-[15px]"
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
              <h3
                className="display text-[32px] leading-tight sm:text-[36px] sm:leading-none"
              >
                {p.name}
              </h3>
              <p className="mt-3 text-[26px] font-bold leading-none sm:text-[28px]">
                {p.price}
                <span className="text-[14px] font-bold opacity-70">
                  {' '}
                  {p.period}
                </span>
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-[14px] font-bold leading-relaxed sm:mt-4 sm:gap-2 sm:leading-snug">
                {p.features.map((f) => (
                  <li key={f}>→ {f}</li>
                ))}
              </ul>
              <Link
                to={startTo}
                className="btn-pill cta-label mt-6 w-full justify-center !bg-black !text-[var(--color-hi-vis-yellow)]"
              >
                {p.id === 'free' ? 'Empezar gratis' : 'Elegir plan'}
              </Link>
            </article>
          ))}
        </div>
        <p className="section-lead mono mt-7 text-center opacity-80 sm:mt-6">
          <Link to="/precios" className="link-underline">
            Ver página de precios
          </Link>
        </p>
      </section>

      <section id="testimonios" className="px-4 py-12 sm:px-5 md:px-10 md:py-16">
        <h2
          className="display section-title mb-8 text-center"
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
                <blockquote className="text-[14px] font-bold leading-relaxed sm:text-[15px] sm:leading-snug">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-4 border-t border-black/15 pt-3.5 sm:pt-3">
                  <div className="font-bold">{t.name}</div>
                  <div className="mono mt-1.5 opacity-70 sm:mt-1">
                    {t.role} · {t.company}
                  </div>
                  <div className="mono mt-1 opacity-50">{t.sector}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="w-full py-10 md:py-12">
        <div
          className="w-full border-y-[2.5px] border-black px-4 py-10 sm:px-8 md:px-10 md:py-10"
          style={{
            background: 'var(--color-bone-white)',
            color: '#1a1a1a',
          }}
        >
          <div className="section-head mx-auto flex max-w-6xl flex-col items-center gap-5 text-center lg:flex-row lg:justify-between lg:text-left">
            <div className="w-full lg:w-auto">
              <p className="mono mb-3 opacity-65 sm:mb-2">FAQ · SEO</p>
              <h2
                className="display section-heading"
                style={{
                  fontSize: 'clamp(30px, 8vw, 56px)',
                  lineHeight: 1.18,
                  letterSpacing: '0.02em',
                }}
              >
                Preguntas
                <br />
                frecuentes
              </h2>
            </div>
            <p className="section-lead max-w-xs text-[14px] font-bold leading-relaxed opacity-75 sm:leading-snug lg:text-right">
              Respuestas cortas. Sin letra chica absurda.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-8 md:px-10 md:pt-8">
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {FAQ.map((item, i) => (
              <details
                key={item.q}
                open={openFaq === i}
                className="faq-card group border-[2.5px] border-black shadow-[4px_4px_0_#000] open:shadow-[5px_5px_0_#000]"
                style={{
                  background: i % 2 === 0 ? 'var(--color-bone-white)' : '#fff',
                  color: '#1a1a1a',
                }}
              >
                <summary
                  className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 sm:p-5"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenFaq((prev) => (prev === i ? null : i));
                  }}
                >
                  <span className="text-[15px] font-bold leading-relaxed sm:text-[16px] sm:leading-snug">
                    {item.q}
                  </span>
                  <span
                    className="faq-card__mark mono shrink-0 border-[2px] border-black bg-[var(--color-hi-vis-yellow)] px-2 py-0.5 text-[12px] leading-none"
                    aria-hidden
                  >
                    <span className="faq-card__plus">+</span>
                    <span className="faq-card__minus">−</span>
                  </span>
                </summary>
                <p
                  className="min-h-[4.5rem] border-t px-4 pb-5 pt-4 text-[14px] font-bold leading-relaxed sm:px-5 sm:pb-5 sm:pt-3 sm:leading-snug"
                  style={{
                    borderColor: 'rgba(26,26,26,0.15)',
                    color: 'rgba(26,26,26,0.8)',
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-5 md:px-10">
        <div
          className="card flex flex-col items-center gap-6 border-[2.5px] border-black text-center shadow-[5px_5px_0_#000] lg:flex-row lg:items-center lg:justify-between lg:gap-5 lg:text-left"
          style={{ background: 'var(--color-firecracker-red)' }}
        >
          <div>
            <h2
              className="display section-heading"
              style={{
                color: 'var(--color-bone-white)',
                fontSize: 'clamp(32px, 9vw, 64px)',
                lineHeight: 1.15,
              }}
            >
              ¿Listo
              <br />
              para enviar?
            </h2>
            <p
              className="mono mt-4 leading-relaxed sm:mt-3"
              style={{ color: 'rgba(249,245,242,0.85)' }}
            >
              Matu AI
              <span className="mx-1.5 opacity-50">·</span>
              {SITE.companyName}
              <span className="mx-1.5 opacity-50">·</span>
              {SITE.domain}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              className="btn-outline cta-label w-full justify-center !border-[var(--color-bone-white)] !text-[var(--color-bone-white)] sm:w-auto"
              onClick={openContact}
            >
              Contacto
            </button>
            <Link
              to={startTo}
              className="btn-pill cta-label w-full justify-center sm:w-auto"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </section>

      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        source="landing"
      />
    </MarketingShell>
  );
}
