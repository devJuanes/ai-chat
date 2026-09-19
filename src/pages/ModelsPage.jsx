import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  buildSoftwareLd,
  graphLd,
} from '../components/seo/SeoHead';
import { MODELS_PUBLIC, SITE } from '../lib/site';

export default function ModelsPage() {
  const auth = useAuth();
  const startTo = auth.user ? '/c/new' : '/register';

  return (
    <MarketingShell>
      <SeoHead
        title="Modelos de IA sectorizados"
        description={`Catálogo Matu AI by Matubyte: Matu, VO0, VO5, Forge, Dev 3.5, Space Ultra, Commerce y Marketing. IA para negocio, growth, e-commerce y código.`}
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

      <main className="px-5 py-12 md:px-10 md:py-16">
        <p className="mono mb-4 opacity-80">Modelos · {SITE.productLegal}</p>
        <h1
          className="display mb-4 max-w-[14ch]"
          style={{
            color: 'var(--color-hi-vis-yellow)',
            fontSize: 'clamp(44px, 11vw, 92px)',
            lineHeight: 0.85,
          }}
        >
          Elige el
          <br />
          sombrero.
        </h1>
        <p className="mb-10 max-w-2xl text-[16px] font-bold leading-snug">
          Modelos propios de {SITE.companyName}. Busca “IA para marketing”, “IA
          e-commerce”, “IA diseño web” o “IA para startups” — Matu AI está
          pensado para esos nichos.
        </p>

        <div className="flex flex-col gap-5">
          {MODELS_PUBLIC.map((m) => (
            <article
              key={m.id}
              className="card border-[2.5px] border-black shadow-[4px_4px_0_#000] md:flex md:items-start md:justify-between md:gap-8"
              style={{ background: m.color, color: m.ink }}
            >
              <div>
                <span className="mono opacity-75">{m.tag}</span>
                <h2
                  className="display mt-1"
                  style={{ fontSize: 'clamp(36px, 7vw, 56px)', lineHeight: 0.9 }}
                >
                  {m.name}
                </h2>
                <p className="mt-2 text-[13px] font-bold uppercase tracking-wide opacity-70">
                  {m.niche}
                </p>
                <p className="mt-3 max-w-xl text-[15px] font-bold leading-snug">
                  {m.body}
                </p>
                <p className="mono mt-3 opacity-60">
                  Búsquedas: {m.search.join(' · ')}
                </p>
              </div>
              <Link
                to={startTo}
                className="btn-pill cta-label mt-4 shrink-0 !bg-black !text-[var(--color-hi-vis-yellow)] md:mt-0"
              >
                Usar {m.name}
              </Link>
            </article>
          ))}
        </div>
      </main>
    </MarketingShell>
  );
}
