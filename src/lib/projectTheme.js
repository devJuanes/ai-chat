/** Iconos y colores de proyectos (UI) */

export const PROJECT_COLORS = [
  { id: 'ink', label: 'Tinta', bg: '#0d0d0d', fg: '#ffffff' },
  { id: 'ocean', label: 'Azul', bg: '#2563eb', fg: '#ffffff' },
  { id: 'forest', label: 'Verde', bg: '#16a34a', fg: '#ffffff' },
  { id: 'clay', label: 'Ámbar', bg: '#f59e0b', fg: '#ffffff' },
  { id: 'wine', label: 'Rojo', bg: '#e11d48', fg: '#ffffff' },
  { id: 'stone', label: 'Cian', bg: '#0891b2', fg: '#ffffff' },
];

export const PROJECT_ICON_IDS = [
  'briefcase',
  'rocket',
  'target',
  'code',
  'chart',
  'bulb',
  'users',
  'cart',
  'building',
  'flask',
  'pen',
  'spark',
];

export function getProjectColor(id) {
  return PROJECT_COLORS.find((c) => c.id === id) || PROJECT_COLORS[0];
}

export function getProjectIconId(id) {
  return PROJECT_ICON_IDS.includes(id) ? id : 'briefcase';
}
