import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  InstagramIcon,
  MessengerIcon,
  WhatsAppIcon,
} from '../components/Icons';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  buildSoftwareLd,
  graphLd,
} from '../components/seo/SeoHead';
import { MODELS_PUBLIC, SITE } from '../lib/site';

const META_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, color: '#25D366' },
  { id: 'instagram', label: 'Instagram', Icon: InstagramIcon, color: '#E4405F' },
  { id: 'messenger', label: 'Messenger', Icon: MessengerIcon, color: '#0084FF' },
];

export default function ModelsPage() {
  const auth = useAuth();
  const startTo = auth.user ? '/c/new' : '/register';
  const botsTo = auth.user ? '/bots/agentes' : '/register';

  return (
    <MarketingShell>
      <SeoHead
        title="Modelos de IA sectorizados"
        description={`Catálogo Matu AI by Matubyte: Matu, VO0, VO5, Forge, Dev 3.5, Space Ultra, Commerce, Marketing y MatuBot para WhatsApp, Instagram y Messenger.`}
        path="/modelos"
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildSoftwareLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Modelos', path: '/modelos' },
          ]),
          {
            '@type': 'ItemList',
            name: 'Modelos Matu AI',
            itemListElement: MODELS_PUBLIC.map((m, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: m.name,
              description: m.body,
            })),
          }
        )}
      />

      <main className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 py-8 sm:px-5 md:px-10 md:py-14">
        <div
          className="card mb-5 border-[2.5px] border-black shadow-[4px_4px_0_#000] sm:mb-6 sm:shadow-[5px_5px_0_#000]"
          style={{
            background: 'var(--color-hi-vis-yellow)',
            color: '#1a1a1a',
          }}
        >
          <p className="mono mb-2 opacity-70 sm:mb-3">
            Modelos · {SITE.productLegal}
          </p>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
            <div className="min-w-0 max-w-xl">
              <h1
                className="display"
                style={{
                  fontSize: 'clamp(28px, 8vw, 48px)',
                  lineHeight: 1.18,
                  letterSpacing: '0.03em',
                }}
              >
                Elige el modelo.
              </h1>
              <p className="mt-4 text-[14px] font-bold leading-relaxed opacity-85 sm:mt-3 sm:text-[15px]">
                Stack sectorizado de {SITE.companyName}: negocio, growth,
                e-commerce, diseño web e ingeniería — no un chat genérico.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link
                to={startTo}
                className="btn-pill cta-label w-full justify-center !bg-black !text-[var(--color-hi-vis-yellow)] sm:w-auto"
              >
                Empezar gratis
              </Link>
              <Link
                to="/precios"
                className="btn-outline cta-label w-full justify-center !border-black !text-black sm:w-auto"
              >
                Ver precios
              </Link>
            </div>
          </div>
        </div>

        <div
          className="card mb-8 flex flex-col gap-4 border-[2.5px] border-black shadow-[4px_4px_0_#000] sm:mb-10 md:flex-row md:items-center md:justify-between md:gap-6"
          style={{ background: 'var(--color-bone-white)', color: '#1a1a1a' }}
        >
          <div className="min-w-0 flex-1">
            <p className="mono mb-2 opacity-60 sm:mb-1">Nuevo · Agentes Meta</p>
            <p className="text-[14px] font-bold leading-relaxed sm:text-[15px] sm:leading-snug">
              Atiende WhatsApp, Instagram y Messenger con MatuBot.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:w-auto md:justify-end md:gap-4">
            <div
              className="flex items-center gap-2"
              aria-label="Canales Meta"
            >
              {META_CHANNELS.map(({ id, label, Icon, color }) => (
                <span
                  key={id}
                  className="inline-flex h-10 w-10 items-center justify-center border-[2px] border-black bg-white sm:h-9 sm:w-9"
                  title={label}
                  aria-label={label}
                >
                  <span style={{ color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                </span>
              ))}
            </div>
            <Link
              to={botsTo}
              className="btn-outline cta-label w-full justify-center !border-black !px-4 !py-2.5 !text-[13px] !text-black sm:w-auto"
            >
              {auth.user ? 'Ver agentes' : 'Crear agente'}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {MODELS_PUBLIC.map((m) => (
            <Link
              key={m.id}
              to={`/modelos/${m.id}`}
              className="model-card card flex min-w-0 flex-col border-[2.5px] border-black shadow-[4px_4px_0_#000] no-underline"
              style={{ background: m.color, color: m.ink }}
            >
              <span className="mono opacity-75">{m.tag}</span>
              <h2
                className="display mt-3 break-words"
                style={{
                  fontSize: 'clamp(26px, 7vw, 40px)',
                  lineHeight: 1.14,
                  letterSpacing: '0.02em',
                }}
              >
                {m.name}
              </h2>
              <p className="mt-2.5 text-[12px] font-bold uppercase tracking-wide opacity-70 sm:mt-2">
                {m.niche}
              </p>
              <p className="mt-3.5 flex-1 text-[14px] font-bold leading-relaxed opacity-90 sm:mt-3 sm:leading-snug">
                {m.body}
              </p>
              <p className="mono mt-4 flex items-center justify-between gap-2 opacity-60">
                <span className="break-words" style={{ lineHeight: 1.4 }}>
                  {m.search.slice(0, 2).join(' · ')}
                </span>
                <span className="shrink-0">Ver →</span>
              </p>
            </Link>
          ))}
        </div>
      </main>
    </MarketingShell>
  );
}
