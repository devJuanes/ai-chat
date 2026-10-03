import { SITE } from './site';

export function applyPageTitle(section, product = SITE.productName) {
  const name = String(section || '').trim();
  document.title = name ? `${name} · ${product}` : product;
}

const EDU_SECTIONS = [
  ['/edu/crear', 'Crear'],
  ['/edu/rutas', 'Rutas'],
  ['/edu/monedas', 'Edu Coins'],
  ['/edu/certificados', 'Certificados'],
  ['/edu/comunidad', 'Comunidad'],
  ['/edu/perfil', 'Perfil'],
  ['/edu/eventos', 'Eventos'],
  ['/edu/calendario', 'Calendario'],
  ['/edu/soporte', 'Soporte'],
  ['/edu/acerca', 'Acerca de'],
  ['/edu/validar', 'Validar certificado'],
];

/** Título fijo de EduCreator. null si la página pone el suyo (curso, foro, certificado). */
export function eduSectionTitle(pathname) {
  const path = pathname.replace(/\/$/, '') || '/edu';
  if (path.startsWith('/edu/cursos/')) return null;
  if (/^\/edu\/comunidad\/[^/]+/.test(path)) return null;
  if (path === '/edu') return 'Inicio';
  const match = EDU_SECTIONS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : 'EduCreator';
}

const BOT_TABS = {
  agentes: 'Agentes',
  canales: 'Canales',
  productos: 'Productos',
  formularios: 'Formularios',
  leads: 'Leads',
  notas: 'Notas',
  pipeline: 'Pipeline',
};

/** Título del espacio de trabajo. null si la página pone el suyo (detalle de agente). */
export function appSectionTitle(pathname, ws) {
  const path = pathname.replace(/\/$/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'bots' && parts[1] === 'agentes' && parts[2]) return null;
  if (parts[0] === 'bots') return BOT_TABS[parts[1]] || 'Agentes';
  if (parts[0] === 'inbox') return 'Inbox';
  if (parts[0] === 'explore') return 'Explorar';
  if (parts[0] === 'imagine') return 'Imagine';
  if (parts[0] === 'search') return 'Buscar';
  if (parts[0] === 'usage') return 'Uso y plan';
  if (parts[0] === 'soporte') return 'Ayuda';
  if (parts[0] === 'admin') return 'Administración';
  if (parts[0] === 'pronosticos') return 'Pronósticos';
  if (parts[0] === 'library') return 'Biblioteca';
  if (parts[0] === 'settings') {
    return parts[1] === 'facturacion' ? 'Facturación' : 'Perfil';
  }

  const route = ws?.route;
  if (!route) return 'Chat';
  if (route.section === 'project' && !route.conversationId) {
    return ws.activeProject?.name || 'Proyecto';
  }
  if (route.section === 'chat' || route.section === 'project-chat' || route.section === 'project') {
    if (route.isNew || !route.conversationId) return 'Nuevo chat';
    const conv =
      (ws.active?.id === route.conversationId && ws.active) ||
      ws.conversations?.find((item) => item.id === route.conversationId);
    return conv?.title || 'Chat';
  }
  return 'Chat';
}
