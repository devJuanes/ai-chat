import { useState } from 'react';
import MarketingShell from '../components/marketing/MarketingShell';
import ContactModal from '../components/marketing/ContactModal';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  graphLd,
} from '../components/seo/SeoHead';
import { SITE } from '../lib/site';

export default function ContactPage() {
  const [open, setOpen] = useState(false);

  return (
    <MarketingShell onContact={() => setOpen(true)}>
      <SeoHead
        title="Contacto"
        description={`Contacta a ${SITE.companyName} (${SITE.companyShort}), desarrolladores de Matu AI. ${SITE.contactEmail} · WhatsApp ${SITE.whatsappDisplay} · ${SITE.domain}`}
        path="/contacto"
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Contacto', path: '/contacto' },
          ]),
          {
            '@type': 'ContactPage',
            name: 'Contacto Matubyte',
            url: `https://${SITE.domain}/contacto`,
            email: SITE.contactEmail,
            telephone: SITE.whatsapp,
          }
        )}
      />

      <main className="min-w-0 overflow-x-hidden px-4 py-10 sm:px-6 md:px-10 md:py-16">
        <p className="mono mb-4 opacity-80">Contacto</p>
        <h1
          className="display mb-6 max-w-full"
          style={{
            color: 'var(--color-hi-vis-yellow)',
            fontSize: 'clamp(40px, 11vw, 96px)',
            lineHeight: 0.95,
          }}
        >
          Hablemos.
        </h1>
        <p className="mb-8 max-w-xl text-[16px] font-bold leading-snug">
          Ventas, partnerships, prensa o soporte de Matu AI — el equipo de{' '}
          {SITE.companyName} te responde.
        </p>

        <button
          type="button"
          className="btn-pill cta-label mb-10"
          onClick={() => setOpen(true)}
        >
          Abrir contacto
        </button>

        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="card card-bone border-[2.5px] border-black no-underline shadow-[4px_4px_0_#000]"
          >
            <p className="mono opacity-60">Email</p>
            <p className="mt-2 break-all text-[16px] font-bold sm:text-[18px]">
              {SITE.contactEmail}
            </p>
          </a>
          <a
            href={SITE.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="card card-bone border-[2.5px] border-black no-underline shadow-[4px_4px_0_#000]"
          >
            <p className="mono opacity-60">WhatsApp</p>
            <p className="mt-2 text-[16px] font-bold sm:text-[18px]">
              {SITE.whatsappDisplay}
            </p>
          </a>
        </div>
      </main>

      <ContactModal
        open={open}
        onClose={() => setOpen(false)}
        source="contacto"
      />
    </MarketingShell>
  );
}
