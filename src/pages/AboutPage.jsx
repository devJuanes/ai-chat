import { Link } from 'react-router-dom';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  graphLd,
} from '../components/seo/SeoHead';
import { SITE } from '../lib/site';

export default function AboutPage() {
  return (
    <MarketingShell>
      <SeoHead
        title={`Acerca de ${SITE.companyName} · creadores de Matu AI`}
        description={`${SITE.companyName} (${SITE.companyShort}) desarrolla Matu AI SaaS: inteligencia artificial sectorizada para negocios. Colombia · ${SITE.domain}`}
        path="/acerca"
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Acerca de', path: '/acerca' },
          ]),
          {
            '@type': 'AboutPage',
            name: `Acerca de ${SITE.companyName}`,
            url: `https://${SITE.domain}/acerca`,
            mainEntity: { '@id': `https://${SITE.domain}/#organization` },
          }
        )}
      />

      <main className="px-5 py-12 md:px-10 md:py-16">
        <p className="mono mb-4 opacity-80">Empresa · {SITE.domain}</p>
        <h1
          className="display mb-6 max-w-[12ch]"
          style={{
            color: 'var(--color-hi-vis-yellow)',
            fontSize: 'clamp(48px, 12vw, 100px)',
            lineHeight: 0.85,
          }}
        >
          Matubyte
          <br />
          hace IA.
        </h1>
        <p className="mb-10 max-w-2xl text-[17px] font-bold leading-snug">
          <strong>{SITE.companyName}</strong> es la empresa detrás de{' '}
          <strong>Matu AI SaaS</strong>. Diseñamos y operamos modelos propios —
          generales y de nicho — para que equipos en Latam y el mundo cierren
          más trabajo real con inteligencia artificial.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="card card-bone border-[2.5px] border-black shadow-[4px_4px_0_#000]">
            <h2 className="display text-[32px] leading-none">Quiénes somos</h2>
            <p className="mt-4 text-[15px] font-bold leading-snug opacity-85">
              Somos {SITE.companyName}, compañía colombiana enfocada en producto
              de IA aplicada al negocio. Matu AI no es un wrapper anónimo: es
              nuestra plataforma, nuestra marca y nuestro stack de modelos.
            </p>
          </article>
          <article className="card card-bone border-[2.5px] border-black shadow-[4px_4px_0_#000]">
            <h2 className="display text-[32px] leading-none">Qué construimos</h2>
            <p className="mt-4 text-[15px] font-bold leading-snug opacity-85">
              Chat con contexto, proyectos, tablas exportables, preview HTML y
              modelos sectorizados (Commerce, Marketing, Dev, Space Ultra,
              Forge…). Parte de la industria global de IA, con foco en nichos
              accionables.
            </p>
          </article>
          <article
            className="card border-[2.5px] border-black shadow-[4px_4px_0_#000] md:col-span-2"
            style={{ background: 'var(--color-lilac-shadow)' }}
          >
            <h2
              className="display text-[32px] leading-none"
              style={{ color: 'var(--color-hi-vis-yellow)' }}
            >
              Marca conectada
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] font-bold leading-snug">
              Si buscas <em>Matu AI</em>, <em>Matubyte</em>, <em>MatByte</em> o{' '}
              <em>Matu AI SaaS</em>, llegas al mismo ecosistema:{' '}
              <a
                href={`https://${SITE.domain}`}
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                {SITE.domain}
              </a>{' '}
              es la casa de la empresa; Matu AI es el producto de chat.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/contacto" className="btn-pill cta-label">
                Contactar
              </Link>
              <Link to="/register" className="btn-outline cta-label">
                Probar Matu AI
              </Link>
            </div>
          </article>
        </div>
      </main>
    </MarketingShell>
  );
}
