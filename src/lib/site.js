/** Configuración pública del sitio — SEO, marca y contenido marketing */

export const SITE = {
  productName: 'Matu AI',
  productLegal: 'Matu AI SaaS',
  companyName: 'MatByte S.A.S.',
  companyShort: 'Matubyte',
  companyCountry: 'Colombia',
  domain: 'matubyte.com',
  url:
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_SITE_URL) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_COMPANY_URL) ||
    'https://matubyte.com',
  appUrl:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) ||
    null,
  email: 'hola@matubyte.com',
  contactEmail: 'contacto@matubyte.com',
  supportEmail: 'soporte@matubyte.com',
  whatsapp: '+573332771764',
  whatsappDisplay: '+57 333 277 1764',
  whatsappUrl: 'https://wa.me/573332771764',
  locale: 'es_CO',
  lang: 'es',
  twitter: '@matubyte',
  themeColor: '#f4ed36',
  sameAs: [
    'https://matubyte.com',
    'https://www.linkedin.com/company/matubyte',
  ],
};

export const MODELS_PUBLIC = [
  {
    id: 'matu',
    name: 'Matu',
    tag: 'Flagship',
    niche: 'Negocio general',
    body: 'Copiloto diario: copy, pricing, GTM y decisiones claras.',
    search: ['IA para negocios', 'asistente de ventas', 'copiloto SaaS'],
    color: '#f8c1ba',
    ink: '#1a1a1a',
    summary:
      'Tu asistente de día a día para el negocio. Te ayuda a pensar, escribir y decidir sin rodeos.',
    points: [
      'Redacta mensajes, propuestas y textos listos para enviar.',
      'Ordena ideas de pricing, oferta y go-to-market.',
      'Sirve cuando necesitas claridad rápida, no un ensayo largo.',
    ],
    cta: 'chat',
  },
  {
    id: 'vo0',
    name: 'VO0',
    tag: 'Relámpago',
    niche: 'Respuestas rápidas',
    body: 'Borradores y replies en segundos. Listos para pegar.',
    search: ['IA rápida', 'borrador de email IA'],
    color: '#b5c995',
    ink: '#1a1a1a',
    summary:
      'Cuando necesitas algo ya: un reply, un borrador corto, una idea en segundos.',
    points: [
      'Ideal para soporte, DMs y correos cortos.',
      'Mantiene el tono y va al grano.',
      'Perfecto para iterar sin fricción.',
    ],
    cta: 'chat',
  },
  {
    id: 'vo5',
    name: 'VO5',
    tag: 'Estrategia',
    niche: 'Estrategia profunda',
    body: 'Unit economics, escenarios y roadmaps sin relleno.',
    search: ['IA estrategia', 'análisis de negocio IA'],
    color: '#f9cc73',
    ink: '#1a1a1a',
    summary:
      'Para decisiones gordas: escenarios, números y planes que sí se pueden seguir.',
    points: [
      'Compara caminos y aclara trade-offs.',
      'Ayuda a armar roadmaps sin relleno.',
      'Útil cuando el equipo necesita una mirada más profunda.',
    ],
    cta: 'chat',
  },
  {
    id: 'matu-apex',
    name: 'Matu Forge',
    tag: '3 en 1',
    niche: 'Ingeniería · ventas · ops',
    body: 'Ingeniero + ventas + operaciones. Planes que se ejecutan.',
    search: ['IA operaciones', 'IA para startups'],
    color: '#ac4f98',
    ink: '#f9f5f2',
    summary:
      'Une lo técnico, lo comercial y lo operativo en un solo copiloto para ejecutar.',
    points: [
      'Arma playbooks y SOPs que el equipo puede seguir.',
      'Conecta ventas con operaciones sin perder el hilo.',
      'Pensado para startups y equipos que mueven varias frentes a la vez.',
    ],
    cta: 'chat',
  },
  {
    id: 'matu-dev-3-5',
    name: 'Matu Dev 3.5',
    tag: 'UI elite',
    niche: 'Diseño web · frontend',
    body: 'UI/UX y demos HTML listas para vista previa en el chat.',
    search: ['IA diseño web', 'IA frontend', 'generar landing IA'],
    color: '#f4ed36',
    ink: '#1a1a1a',
    summary:
      'Diseña interfaces y landings con gusto — y las ves en preview dentro del chat.',
    points: [
      'Landings, dashboards y piezas de producto.',
      'Menos UI genérica, más presencia de marca.',
      'Ideal para designers y founders que entregan a clientes.',
    ],
    cta: 'chat',
  },
  {
    id: 'matu-space-ultra',
    name: 'Matu Space Ultra',
    tag: 'Frontier',
    niche: 'Ingeniería · agentes',
    body: 'Arquitectura, debug, código de producción y ejecución verificada.',
    search: ['IA programación', 'agente de código', 'IA ingeniería'],
    color: '#8584bd',
    ink: '#f9f5f2',
    summary:
      'El motor más capaz para problemas de producto y sistemas: pensar, revisar y avanzar con rigor.',
    points: [
      'Ayuda a ordenar arquitectura y decisiones de producto.',
      'Útil para debug y revisión de trabajo complejo.',
      'Para equipos que necesitan profundidad, no solo un borrador.',
    ],
    cta: 'chat',
  },
  {
    id: 'matu-commerce',
    name: 'Matu Commerce',
    tag: 'Revenue',
    niche: 'E-commerce · CRM',
    body: 'Pricing, pipeline, retención y acciones que mueven ingresos.',
    search: ['IA e-commerce', 'IA CRM', 'IA ventas online'],
    color: '#c94245',
    ink: '#f9f5f2',
    summary:
      'Enfocado en vender más: precios, embudo, retención y acciones de revenue.',
    points: [
      'Audita embudos y prioriza lo que mueve ingreso.',
      'Ayuda con fichas, pricing y recuperación de carritos.',
      'Hecho para tiendas y equipos comerciales.',
    ],
    cta: 'chat',
  },
  {
    id: 'matu-marketing',
    name: 'Matu Marketing',
    tag: 'Growth',
    niche: 'Growth · copy',
    body: 'Ofertas, landings, ads y adquisición medible — no vanity metrics.',
    search: ['IA marketing', 'IA copywriting', 'IA growth'],
    color: '#61609a',
    ink: '#f9f5f2',
    summary:
      'Growth y copy orientados a leads y ventas, no a likes.',
    points: [
      'Ángulos de ads, ofertas y CTAs listos para probar.',
      'Calendarios y piezas de adquisición.',
      'Enfocado en resultados medibles.',
    ],
    cta: 'chat',
  },
  {
    id: 'matubot',
    name: 'MatuBot',
    tag: 'Agentes',
    niche: 'WhatsApp · Instagram · Messenger',
    body: 'Atiende clientes en Meta: responde, califica leads y mueve el pipeline.',
    search: [
      'chatbot WhatsApp',
      'agente Instagram',
      'bot Messenger Meta',
    ],
    color: '#0f7a3a',
    ink: '#f9f5f2',
    summary:
      'Tu agente comercial en WhatsApp, Instagram y Messenger. Habla con clientes, entiende qué necesitan y avanza la venta — o pasa el caso a tu equipo.',
    points: [
      'Responde y califica leads en los canales donde ya te escriben.',
      'Usa tu catálogo, notas y etapas del embudo sin que se pierda el contexto.',
      'Cuando hace falta una persona, hace handoff con el contexto listo.',
    ],
    cta: 'bots',
  },
];

export function getModelPublic(id) {
  return MODELS_PUBLIC.find((m) => m.id === id) || null;
}

export const PLANS_PUBLIC = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    highlight: false,
    features: [
      '40 mensajes / mes',
      'Modelos flagship y de nicho',
      'Proyectos y chats',
      'Ideal para probar Matu AI',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/ mes',
    highlight: true,
    features: [
      '500 mensajes / mes',
      'VO5 y todos los modelos',
      'Más tokens y conversaciones',
      'Para freelancers y founders',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$99',
    period: '/ mes',
    highlight: false,
    features: [
      '5.000 mensajes / mes',
      'Capacidad de equipo',
      'Límites altos de tokens',
      'Para operaciones en crecimiento',
    ],
  },
];

export const TESTIMONIALS = [
  {
    quote:
      'Pasamos de borradores eternos a propuestas listas en minutos. Matu se siente hecho para cerrar, no para charlar.',
    name: 'Camila Restrepo',
    role: 'CEO',
    company: 'Nexo Legal',
    sector: 'Servicios profesionales',
  },
  {
    quote:
      'Matu Commerce nos ayudó a rearmar el funnel y el CRM. Menos intuición, más acciones que sí mueven revenue.',
    name: 'Diego Vargas',
    role: 'Head of Growth',
    company: 'TiendaAndina',
    sector: 'E-commerce',
  },
  {
    quote:
      'Con Matu Dev 3.5 sacamos landings que no parecen “de IA”. El preview en el chat cambió cómo entregamos a clientes.',
    name: 'Laura Méndez',
    role: 'Product Designer',
    company: 'Studio Norte',
    sector: 'Diseño / producto',
  },
  {
    quote:
      'VO0 es nuestro atajo diario: replies de soporte y correos sin perder el tono de marca.',
    name: 'Andrés Quintero',
    role: 'Customer Success',
    company: 'PayFlow Latam',
    sector: 'Fintech',
  },
  {
    quote:
      'Matubyte construyó algo sectorizado. No es un chat genérico: es un stack de modelos para operar el negocio.',
    name: 'Valentina Cruz',
    role: 'COO',
    company: 'Atlas Ops',
    sector: 'Operaciones',
  },
  {
    quote:
      'El plan Pro es honestamente económico frente a lo que usábamos. Matu Forge nos armó SOPs que el equipo sí sigue.',
    name: 'Julián Pardo',
    role: 'Founder',
    company: 'Ruta SaaS',
    sector: 'Startups',
  },
];

export const FAQ = [
  {
    q: '¿Qué es Matu AI?',
    a: 'Matu AI es el copiloto de Matubyte: modelos propios para negocio, marketing, e-commerce, diseño web e ingeniería, más agentes MatuBot para canales Meta.',
  },
  {
    q: '¿Quién desarrolla Matu AI?',
    a: 'Lo desarrolla MatByte S.A.S. (Matubyte) en Colombia. Matu AI SaaS es nuestro producto; más info en matubyte.com y soporte en contacto@matubyte.com.',
  },
  {
    q: '¿En qué se diferencia de un chat genérico?',
    a: 'No es un chat genérico: tienes modelos de nicho (Commerce, Marketing, Dev, Forge, VO0, VO5) y MatuBot para WhatsApp, Instagram y Messenger.',
  },
  {
    q: '¿Hay plan gratis?',
    a: 'Sí. Free incluye mensajes mensuales para probar. Pro ($29) y Team ($99) suben capacidad sin precios absurdos. Empiezas gratis y escalas cuando lo necesites.',
  },
  {
    q: '¿Puedo usarlo para landings, tablas y exports?',
    a: 'Sí. El chat renderiza Markdown, tablas con CSV/Excel y preview HTML. Ideal con Matu Dev 3.5 para landings y piezas listas para entregar a clientes.',
  },
  {
    q: '¿Puedo conectar WhatsApp, Instagram y Messenger?',
    a: 'Sí. Con MatuBot conectas WhatsApp, Instagram y Messenger: inbox unificado, catálogo, pipeline de leads y handoff a tu equipo cuando hace falta.',
  },
];

export const PUBLIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/acerca', priority: '0.8', changefreq: 'monthly' },
  { path: '/contacto', priority: '0.7', changefreq: 'monthly' },
  { path: '/precios', priority: '0.9', changefreq: 'weekly' },
  { path: '/modelos', priority: '0.9', changefreq: 'weekly' },
  ...MODELS_PUBLIC.map((m) => ({
    path: `/modelos/${m.id}`,
    priority: '0.7',
    changefreq: 'monthly',
  })),
  { path: '/privacidad', priority: '0.4', changefreq: 'yearly' },
  { path: '/terminos', priority: '0.4', changefreq: 'yearly' },
  { path: '/login', priority: '0.5', changefreq: 'monthly' },
  { path: '/register', priority: '0.8', changefreq: 'monthly' },
];

export function absoluteUrl(path = '/') {
  const base = SITE.url.replace(/\/$/, '');
  if (!path || path === '/') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function defaultDescription() {
  return `Matu AI SaaS by Matubyte (MatByte S.A.S.): chat con modelos propios para negocio, marketing, e-commerce, diseño web e ingeniería. Plan gratis y Pro desde $29. Colombia · ${SITE.domain}`;
}
