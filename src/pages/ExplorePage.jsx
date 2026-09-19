import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useMemo } from 'react';
import { useWorkspace } from '../lib/workspace';
import { MenuIcon, SparkIcon } from '../components/Icons';

const MODEL_META = {
  matu: {
    power: 4,
    bestFor: 'Negocio, copy y estrategia general',
    useCases: 'Posicionamiento, emails, propuestas, respuestas a clientes',
    speed: 'Rápido',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-pink',
  },
  vo0: {
    power: 2,
    bestFor: 'Respuestas relámpago',
    useCases: 'Borradores cortos, ideas rápidas, iteraciones sin fricción',
    speed: 'Muy rápido',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-matcha',
  },
  'matu-apex': {
    power: 5,
    bestFor: 'Ingeniería · ventas · operaciones',
    useCases: 'Flujos técnicos, playbooks de ventas, automatización ops',
    speed: 'Equilibrado',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-magenta',
  },
  vo5: {
    power: 5,
    bestFor: 'Estrategia profunda',
    useCases: 'Decisiones complejas, análisis, planes a largo plazo',
    speed: 'Pensado',
    plans: 'Pro · Team',
    color: 'fp-card-butter',
  },
  'matu-dev-3-5': {
    power: 5,
    bestFor: 'UI/UX y diseño web elite',
    useCases: 'Landings, dashboards, design systems, componentes frontend',
    speed: 'Equilibrado',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-yellow',
  },
  'matu-space-ultra': {
    power: 5,
    bestFor: 'Ingeniería y razonamiento agente',
    useCases:
      'Arquitectura, debug, code review, APIs, sistemas y tareas multi-paso con verificación',
    speed: 'Pensado',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-lilac',
  },
  'matu-commerce': {
    power: 5,
    bestFor: 'E-commerce, CRM e ingresos',
    useCases:
      'Pricing, fichas, pipeline, retención, WhatsApp commerce y acciones de revenue',
    speed: 'Equilibrado',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-red',
  },
  'matu-marketing': {
    power: 5,
    bestFor: 'Growth, copy y adquisición',
    useCases:
      'Ofertas, landings, ads, hooks, CRO, calendarios y copy listo para convertir',
    speed: 'Equilibrado',
    plans: 'Gratis · Pro · Team',
    color: 'fp-card-dusk',
  },
};

const SUGGESTIONS = [
  {
    title: 'Frase de posicionamiento',
    body: 'Ayúdame a escribir una frase corta de posicionamiento para un SaaS B2B que automatiza facturación para freelancers.',
    model: 'matu',
  },
  {
    title: 'Respuesta a cliente',
    body: 'Redacta una respuesta amable a un cliente que pide reembolso por un envío demorado.',
    model: 'vo0',
  },
  {
    title: 'Landing de producto',
    body: 'Diseña una landing page moderna para un SaaS de facturación. Entrégame el HTML completo listo para vista previa, con hero, beneficios, pricing y CTA. Evita UI genérica.',
    model: 'matu-dev-3-5',
  },
  {
    title: 'Plan de lanzamiento',
    body: 'Arma un plan de 5 días para lanzar una landing de waitlist con anuncios y captura de email.',
    model: 'matu-apex',
  },
  {
    title: 'Decisión de precios',
    body: 'Compara freemium vs. prueba de 14 días para una herramienta de productividad dirigida a equipos pequeños.',
    model: 'vo5',
  },
  {
    title: 'Debug de API',
    body: 'Tengo un endpoint Express que a veces responde 500 al crear órdenes. Ayúdame a encontrar causa raíz probable y un fix mínimo seguro.',
    model: 'matu-space-ultra',
  },
  {
    title: 'Auditoría de tienda',
    body: 'Audita mi embudo de e-commerce: tráfico → carrito → checkout → recompra. Dame top 3 acciones de mayor impacto y un script de recuperación de carrito abandonado.',
    model: 'matu-commerce',
  },
  {
    title: 'Campaña de adquisición',
    body: 'Necesito un ángulo de ads + 3 variantes de copy + CTA para un SaaS de facturación B2B. Optimiza para leads calificados, no likes.',
    model: 'matu-marketing',
  },
];

function PowerDots({ n = 1 }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Potencia ${n} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-[2px] border border-black"
          style={{
            background: i < n ? '#1a1a1a' : 'transparent',
          }}
        />
      ))}
    </div>
  );
}

export default function ExplorePage() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};

  const rows = useMemo(
    () =>
      (ws.models || []).map((m) => ({
        ...m,
        ...(MODEL_META[m.id] || {
          power: 3,
          bestFor: m.tagline || 'Uso general',
          useCases: m.tagline || '—',
          speed: '—',
          plans: 'Según tu plan',
          color: 'fp-card',
        }),
      })),
    [ws.models]
  );

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[52px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="fp-mono">Explorar</div>
        <div className="flex-1" />
        <Link
          to="/usage"
          className="fp-pill hidden px-3 py-1.5 text-[11px] sm:inline-flex"
        >
          Ver consumo
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-10 px-5 py-8 sm:px-8 sm:py-10">
          <div>
            <p className="fp-mono mb-2 opacity-55">Modelos</p>
            <h1
              className="fp-display"
              style={{ fontSize: 'clamp(36px, 7vw, 64px)' }}
            >
              Elige tu
              <br />
              sombrero.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-snug opacity-75">
              Compara potencia, velocidad y para qué sirve cada uno.
            </p>
          </div>

          <div className="grid gap-4">
            {rows.map((m) => {
              const selected = m.id === ws.model?.id;
              return (
                <article
                  key={m.id}
                  className={`fp-card ${m.color} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border-2 border-black bg-white">
                      <SparkIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="fp-display text-[28px] sm:text-[36px]">
                        {m.name}
                      </div>
                      <div className="fp-mono mt-1 opacity-70">{m.tagline}</div>
                      <p className="mt-2 max-w-md text-[14px] font-medium leading-snug opacity-85">
                        {m.bestFor}. {m.useCases}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <PowerDots n={m.power} />
                        <span className="fp-mono opacity-60">{m.speed}</span>
                        <span className="fp-mono opacity-60">{m.plans}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`fp-btn-ink shrink-0 px-5 py-2.5 text-[12px] ${
                      selected ? '!bg-[#f4ed36] !text-black' : ''
                    }`}
                    onClick={() => {
                      ws.setModelId(m.id);
                      navigate('/c/new');
                    }}
                  >
                    {selected ? 'Activo' : 'Usar'}
                  </button>
                </article>
              );
            })}
          </div>

          <div>
            <h2 className="fp-mono mb-1 opacity-55">Prompts sugeridos</h2>
            <p className="mb-4 text-[14px] font-medium opacity-75">
              Arranca un chat con un prompt listo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => {
                const tones = [
                  'fp-card-pink',
                  'fp-card-matcha',
                  'fp-card-yellow',
                  'fp-card-butter',
                  'fp-card',
                ];
                return (
                  <button
                    key={s.title}
                    type="button"
                    className={`fp-card ${tones[i % tones.length]} p-5 text-left transition hover:-translate-y-0.5`}
                    onClick={() => {
                      if (s.model) ws.setModelId(s.model);
                      navigate('/c/new', { state: { draft: s.body } });
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-bold">{s.title}</span>
                      <span className="fp-mono rounded-full border border-black/30 bg-white/60 px-2 py-0.5 text-[10px]">
                        {s.model}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-relaxed opacity-80">
                      {s.body}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
