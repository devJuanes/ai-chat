import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  buildSoftwareLd,
  graphLd,
} from '../components/seo/SeoHead';
import { PLANS_PUBLIC, SITE } from '../lib/site';

export default function PricingPage() {
  const auth = useAuth();
  const startTo = auth.user ? '/c/new' : '/register';

  return (
    <MarketingShell>
      <SeoHead
        title="Precios — Free, Pro $29, Team $99"
        description={`Precios Matu AI by Matubyte: plan gratis, Pro $29/mes y Team $99/mes. IA sectorizada a precio accesible. ${SITE.domain}`}
        path="/precios"
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildSoftwareLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Precios', path: '/precios' },
          ])
        )}
      />

      <main className="min-w-0 overflow-x-hidden px-4 py-10 sm:px-6 md:px-10 md:py-16">
        <p className="mono mb-4 opacity-80">Pricing</p>
        <h1
          className="display mb-4"
          style={{
            color: 'var(--color-hi-vis-yellow)',
            fontSize: 'clamp(48px, 12vw, 96px)',
            lineHeight: 0.85,
          }}
        >
          Simple.
          <br />
          Barato
          <br />
          de verdad.
        </h1>
        <p className="mb-10 max-w-xl text-[16px] font-bold leading-snug">
          Paneles gratis para entrar al mercado. Premium económico para escalar
          con Matu AI — producto de {SITE.companyName}.
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
              {p.highlight && <span className="mono mb-2">Más popular</span>}
              <h2
                className="display leading-none"
                style={{ fontSize: 'clamp(28px, 8vw, 40px)' }}
              >
                {p.name}
              </h2>
              <p className="mt-3 text-[32px] font-bold">
                {p.price}
                <span className="text-[14px] opacity-70"> {p.period}</span>
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-[14px] font-bold">
                {p.features.map((f) => (
                  <li key={f}>→ {f}</li>
                ))}
              </ul>
              <Link
                to={startTo}
                className="btn-pill cta-label mt-6 !bg-black !text-[var(--color-hi-vis-yellow)]"
              >
                Empezar
              </Link>
            </article>
          ))}
        </div>
      </main>
    </MarketingShell>
  );
}
