import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  buildSoftwareLd,
  graphLd,
} from '../components/seo/SeoHead';
import { getModelPublic, SITE } from '../lib/site';

export default function ModelDetailPage() {
  const { modelId } = useParams();
  const auth = useAuth();
  const model = getModelPublic(modelId);

  if (!model) {
    return <Navigate to="/modelos" replace />;
  }

  const startTo =
    model.cta === 'bots'
      ? auth.user
        ? '/bots/agentes'
        : '/register'
      : auth.user
        ? '/c/new'
        : '/register';

  const ctaLabel =
    model.cta === 'bots'
      ? auth.user
        ? 'Ver agentes'
        : 'Crear agente'
      : auth.user
        ? `Usar ${model.name}`
        : 'Empezar gratis';

  return (
    <MarketingShell>
      <SeoHead
        title={`${model.name} — ${model.niche}`}
        description={`${model.name} by Matubyte: ${model.summary}`}
        path={`/modelos/${model.id}`}
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildSoftwareLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Modelos', path: '/modelos' },
            { name: model.name, path: `/modelos/${model.id}` },
          ])
        )}
      />

      <main className="mx-auto min-w-0 max-w-3xl overflow-x-hidden px-4 py-8 sm:px-5 md:px-10 md:py-14">
        <Link
          to="/modelos"
          className="link-underline mb-6 inline-block !text-[12px]"
          style={{ color: 'rgba(249,245,242,0.85)' }}
        >
          ← Todos los modelos
        </Link>

        <article
          className="card border-[2.5px] border-black shadow-[5px_5px_0_#000]"
          style={{ background: model.color, color: model.ink }}
        >
          <p className="mono opacity-75">{model.tag}</p>
          <h1
            className="display mt-2 break-words"
            style={{
              fontSize: 'clamp(36px, 9vw, 64px)',
              lineHeight: 1.05,
              letterSpacing: '0.02em',
            }}
          >
            {model.name}
          </h1>
          <p className="mt-2 text-[13px] font-bold uppercase tracking-wide opacity-70">
            {model.niche}
          </p>
          <p className="mt-5 text-[16px] font-bold leading-relaxed sm:text-[17px]">
            {model.summary}
          </p>
        </article>

        <section
          className="card card-bone mt-5 border-[2.5px] border-black shadow-[4px_4px_0_#000]"
          style={{ color: '#1a1a1a' }}
        >
          <p className="mono mb-4 opacity-60">Qué hace</p>
          <ul className="flex flex-col gap-4">
            {model.points.map((p) => (
              <li
                key={p}
                className="border-t pt-4 text-[15px] font-bold leading-snug"
                style={{ borderColor: 'rgba(26,26,26,0.2)' }}
              >
                → {p}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            to={startTo}
            className="btn-pill cta-label w-full justify-center sm:w-auto"
          >
            {ctaLabel}
          </Link>
          <Link
            to="/modelos"
            className="btn-outline cta-label w-full justify-center sm:w-auto"
          >
            Ver catálogo
          </Link>
        </div>

        <p
          className="mono mt-6 opacity-60"
          style={{ color: 'rgba(249,245,242,0.7)' }}
        >
          {SITE.productName} · {SITE.companyShort}
        </p>
      </main>
    </MarketingShell>
  );
}
