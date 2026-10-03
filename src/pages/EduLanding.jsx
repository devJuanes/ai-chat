import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, { buildBreadcrumbLd, buildFaqLd, graphLd } from '../components/seo/SeoHead';
import { SITE, absoluteUrl } from '../lib/site';

const STEPS = [
  {
    n: '01',
    t: 'Pides el tema',
    d: 'Escribes qué quieres aprender. EduCreator arma módulos, lecciones y un quiz al cierre.',
  },
  {
    n: '02',
    t: 'Fijas la constancia',
    d: 'Todos los días, entre semana o un día a la semana, y a qué hora empieza la clase.',
  },
  {
    n: '03',
    t: 'Te avisamos',
    d: 'Quince minutos antes llega un correo. El calendario guarda la clase, el evento y la lección que ya diste.',
  },
];

const POINTS = [
  {
    t: 'Tu calendario',
    d: 'Eventos a los que te inscribes, clases de tus cursos y lecciones terminadas, en un solo mes.',
  },
  {
    t: 'Horario del curso',
    d: 'La constancia se configura en el curso. Si eliges todos los días a las 7:00, esa clase sale cada día.',
  },
  {
    t: 'Comunidad',
    d: 'Foro, retos, grupos y eventos. Al inscribirte, el evento queda en tu calendario.',
  },
  {
    t: 'Certificado',
    d: 'Terminas el aula, respondes el quiz y te llevas el certificado de EduCreator.',
  },
];

const FAQ = [
  {
    q: '¿Qué es EduCreator?',
    a: 'Es la aplicación de Matubyte para crear un curso con IA y estudiarlo hasta el certificado. Tiene calendario, comunidad y Edu Coins.',
  },
  {
    q: '¿Cómo me acuerdo de la clase?',
    a: 'En el curso eliges la constancia y la hora. EduCreator te escribe 15 minutos antes de que empiece.',
  },
  {
    q: '¿Dónde veo los eventos?',
    a: 'Cuando te inscribes a un evento, aparece en Calendario, junto con tus clases y las lecciones que ya terminaste.',
  },
];

export default function EduLanding() {
  const auth = useAuth();
  const startTo = auth.user ? '/edu' : '/register';
  const calendarTo = auth.user ? '/edu/calendario' : '/register';

  const jsonLd = graphLd(
    {
      '@type': 'SoftwareApplication',
      '@id': absoluteUrl('/educreator#app'),
      name: 'EduCreator',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: absoluteUrl('/educreator'),
      description:
        'Crea un curso con IA, estudia en el aula y recibe un correo 15 minutos antes de cada clase.',
      provider: {
        '@type': 'Organization',
        name: SITE.companyName,
        url: SITE.url,
      },
    },
    buildFaqLd(FAQ),
    buildBreadcrumbLd([
      { name: 'Inicio', path: '/' },
      { name: 'EduCreator', path: '/educreator' },
    ])
  );

  return (
    <MarketingShell>
      <SeoHead
        title="EduCreator, cursos con calendario y aviso 15 minutos antes"
        description="EduCreator de Matubyte: armas el curso con IA, fijas la constancia y recibes un correo 15 minutos antes de la clase. Eventos, lecciones y certificado en un solo calendario."
        path="/educreator"
        jsonLd={jsonLd}
      />

      <section className="relative flex min-h-[calc(100dvh-72px)] flex-col items-center justify-center px-4 pb-14 pt-8 sm:px-5 md:px-10 md:pb-16">
        <p className="mono mb-5 text-center" style={{ color: 'rgba(249,245,242,0.9)' }}>
          EduCreator
          <span className="mx-1.5 opacity-50">·</span>
          {SITE.companyShort}
        </p>
        <h1 className="display hero-title text-center">
          <span style={{ color: 'var(--color-hi-vis-yellow)' }}>Aprende.</span>
          <br />
          <span style={{ color: 'var(--color-buttery-yellow)' }}>Con horario.</span>
        </h1>
        <p
          className="mx-auto mt-6 max-w-lg text-center"
          style={{
            fontSize: 'clamp(15px, 3.6vw, 18px)',
            lineHeight: 1.45,
            color: 'var(--color-bone-white)',
          }}
        >
          Dices el tema y EduCreator arma el curso. Tú eliges cada cuánto y a qué hora.
          El calendario lo guarda y el correo llega 15 minutos antes.
        </p>
        <div className="mt-7 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:w-auto sm:flex-row">
          <Link to={startTo} className="btn-pill cta-label justify-center">
            {auth.user ? 'Abrir EduCreator' : 'Crear mi espacio'}
          </Link>
          <a href="#constancia" className="btn-outline cta-label justify-center">
            Ver el calendario
          </a>
        </div>
      </section>

      <section id="como" className="px-4 py-12 sm:px-5 md:px-10 md:py-16">
        <h2 className="display section-title mb-8 text-center" style={{ color: 'var(--color-hi-vis-yellow)' }}>
          Tres pasos.
        </h2>
        <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="card flex flex-col gap-3 border-[2.5px] border-black p-5 shadow-[4px_4px_0_#000]"
              style={{ background: '#b5c995', color: '#1a1a1a' }}
            >
              <span className="mono">{step.n}</span>
              <h3 className="display text-[28px] leading-none">{step.t}</h3>
              <p className="text-[15px] font-semibold leading-snug">{step.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="constancia" className="px-4 py-12 sm:px-5 md:px-10 md:py-16">
        <h2 className="display section-title mb-4 text-center" style={{ color: 'var(--color-hi-vis-yellow)' }}>
          El calendario es tuyo.
        </h2>
        <p
          className="section-lead mx-auto mb-8 max-w-xl text-center text-[15px] leading-relaxed"
          style={{ color: 'rgba(249,245,242,0.88)' }}
        >
          Es el calendario de EduCreator: clases, eventos y lecciones que ya diste.
        </p>
        <div className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2">
          {POINTS.map((point) => (
            <article
              key={point.t}
              className="rounded-2xl border border-white/15 p-5"
              style={{ background: 'rgba(181, 201, 149, 0.12)' }}
            >
              <h3 className="display mb-2 text-[26px] leading-none" style={{ color: 'var(--color-hi-vis-yellow)' }}>
                {point.t}
              </h3>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--color-bone-white)' }}>
                {point.d}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 sm:px-5 md:px-10 md:py-16">
        <h2 className="display section-title mb-6 text-center" style={{ color: 'var(--color-hi-vis-yellow)' }}>
          Preguntas
        </h2>
        <div className="mx-auto grid max-w-3xl gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="rounded-2xl border border-white/15 px-4 py-3">
              <summary className="cursor-pointer text-[16px] font-bold" style={{ color: 'var(--color-bone-white)' }}>
                {item.q}
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'rgba(249,245,242,0.88)' }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link to={calendarTo} className="btn-pill cta-label">
            {auth.user ? 'Ir a mi calendario' : 'Empezar en EduCreator'}
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
