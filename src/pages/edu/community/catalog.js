/**
 * Catálogo editorial para descubrir retos, grupos y formatos de evento.
 * No son publicaciones, ni miembros, ni asistencia de personas reales.
 * Cuando esas secciones tengan tablas, este módulo se sustituye por la API.
 */

export const LEVELS = [
  { id: 'todos', label: 'Todas' },
  { id: 'principiante', label: 'Principiante' },
  { id: 'intermedio', label: 'Intermedio' },
  { id: 'avanzado', label: 'Avanzado' },
];

export const CHALLENGES = [
  {
    id: 'api-rest',
    name: 'Construye una API REST',
    summary: 'Rutas para crear, leer y borrar, con un error que se entiende.',
    level: 'intermedio',
    tech: 'Node.js',
    points: 250,
  },
  {
    id: 'auth',
    name: 'Construye un sistema de autenticación',
    summary: 'Registro, sesión y una ruta que solo abre quien ya entró.',
    level: 'avanzado',
    tech: 'Node.js',
    points: 200,
  },
  {
    id: 'joins',
    name: 'Una consulta con JOIN',
    summary: 'Cruza dos tablas y quédate con las filas que de verdad corresponden.',
    level: 'principiante',
    tech: 'SQL',
    points: 120,
  },
  {
    id: 'git-branch',
    name: 'Una rama hasta el merge',
    summary: 'Abre una rama, haz un commit y vuelve a la principal sin mezclar de más.',
    level: 'principiante',
    tech: 'Git',
    points: 80,
  },
  {
    id: 'docker-pg',
    name: 'Postgres en un contenedor',
    summary: 'Levanta la base, publica el puerto y conserva los datos al bajarla.',
    level: 'intermedio',
    tech: 'Docker',
    points: 180,
  },
  {
    id: 'python-csv',
    name: 'Lee un CSV con Python',
    summary: 'Abre un archivo real y saca una cifra que puedas explicar.',
    level: 'principiante',
    tech: 'Python',
    points: 100,
  },
];

function blob(post) {
  return `${post?.title || ''} ${post?.body || ''} ${(post?.tags || []).join(' ')} ${post?.tech || ''}`;
}

export const GROUPS = [
  {
    id: 'javascript',
    name: 'JavaScript',
    description: 'Funciones, asincronía y lo que pasa en el navegador.',
    test: (post) => /javascript|\bnode\b|\breact\b/i.test(blob(post)),
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Scripts, datos y el primer programa que sí usas.',
    test: (post) => /python|\bcsv\b/i.test(blob(post)),
  },
  {
    id: 'flutter',
    name: 'Flutter',
    description: 'Interfaces móviles y el estado de una pantalla.',
    test: (post) => /flutter|\bdart\b/i.test(blob(post)),
  },
  {
    id: 'backend',
    name: 'Backend',
    description: 'APIs, sesiones y lo que no se ve en la pantalla.',
    test: (post) => /backend|\bapi\b|node|servidor/i.test(blob(post)),
  },
  {
    id: 'frontend',
    name: 'Frontend',
    description: 'Layout, estado y la interfaz que otra persona usa.',
    test: (post) => /frontend|react|css|interfaz/i.test(blob(post)),
  },
  {
    id: 'ia',
    name: 'IA',
    description: 'Cómo pedir, revisar y no creerle todo al modelo.',
    test: (post) => /\bia\b|inteligencia artificial|\bmodelo\b|\btutor\b/i.test(blob(post)),
  },
  {
    id: 'datos',
    name: 'Bases de datos',
    description: 'Tablas, consultas y el índice que sí hacía falta.',
    test: (post) => /sql|postgres|base de datos|índice|indice|\bjoin\b/i.test(blob(post)),
  },
];

export const EVENT_FORMATS = [
  {
    id: 'live',
    name: 'Live coding',
    summary: 'Construir algo en vivo, con el código a la vista.',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    summary: 'Una práctica corta, con un resultado al final de la hora.',
  },
  {
    id: 'qa',
    name: 'Sesión de preguntas',
    summary: 'Traer una duda y salir con el siguiente paso.',
  },
  {
    id: 'mentor',
    name: 'Mentoría',
    summary: 'Una conversación para destrabar la ruta en la que vas.',
  },
  {
    id: 'review',
    name: 'Revisión de proyectos',
    summary: 'Mostrar lo que armaste y escuchar una observación concreta.',
  },
];

export function challengeOfWeek(date = new Date()) {
  const week = Math.floor(date.getTime() / 604800000);
  return CHALLENGES[Math.abs(week) % CHALLENGES.length];
}

export function levelLabel(level) {
  return LEVELS.find((item) => item.id === level)?.label || 'Principiante';
}
