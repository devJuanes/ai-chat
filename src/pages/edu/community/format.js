export const KINDS = [
  { id: 'pregunta', label: 'Pregunta', hint: 'Una duda concreta, con lo que ya intentaste.' },
  { id: 'proyecto', label: 'Proyecto', hint: 'Algo que construiste y quieres mostrar.' },
  { id: 'logro', label: 'Logro', hint: 'Un avance que te costó y ya está.' },
  { id: 'debate', label: 'Debate', hint: 'Una idea para contrastar con otras formas.' },
  { id: 'ayuda', label: 'Ayuda', hint: 'El punto exacto donde estás trabado.' },
];

export const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'pregunta', label: 'Preguntas' },
  { id: 'proyecto', label: 'Proyectos' },
  { id: 'logro', label: 'Logros' },
  { id: 'debate', label: 'Debates' },
  { id: 'ayuda', label: 'Ayuda' },
];

export const SORTS = [
  { id: 'recent', label: 'Más recientes' },
  { id: 'comments', label: 'Más comentados' },
  { id: 'popular', label: 'Más populares' },
];

export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ') || 'Estudiante';
}

export function kindLabel(kind) {
  return KINDS.find((item) => item.id === kind)?.label || 'Debate';
}

export function ago(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `hace ${weeks} sem`;
  return `hace ${Math.max(1, Math.round(days / 30))} mes`;
}

export function initial(name) {
  const letter = String(name || '').trim().charAt(0);
  return letter ? letter.toUpperCase() : 'E';
}

export function excerpt(body, max = 180) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function filterPosts(posts, kind) {
  if (!kind || kind === 'todos') return posts;
  return posts.filter((post) => post.kind === kind);
}

export function sortPosts(posts, sort) {
  const list = [...posts];
  const byDate = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  if (sort === 'comments') {
    list.sort((a, b) => (b.comments || 0) - (a.comments || 0) || byDate(a, b));
  } else if (sort === 'popular') {
    list.sort(
      (a, b) =>
        (b.likes || 0) + (b.comments || 0) - ((a.likes || 0) + (a.comments || 0)) || byDate(a, b)
    );
  } else {
    list.sort(byDate);
  }
  return list;
}

export function summarizeProgress(courses, certificates) {
  const list = courses || [];
  const pct = list.length
    ? Math.round(list.reduce((sum, course) => sum + (Number(course.pct) || 0), 0) / list.length)
    : 0;
  const certs = (certificates || []).length;
  let level = 'Por empezar';
  if (certs >= 2) level = 'Constante';
  else if (certs >= 1) level = 'Con certificado';
  else if (pct >= 70) level = 'En ritmo';
  else if (list.length && pct > 0) level = 'En ruta';
  else if (list.length) level = 'Recién empezado';
  return { pct, certs, courses: list.length, level };
}

function activityMeta(kind, type) {
  if (type === 'reply') return { label: 'Nuevo comentario en', tone: 'talk' };
  if (type === 'course' || kind === 'proyecto') return { label: 'Nuevo proyecto subido', tone: 'project' };
  if (kind === 'logro') return { label: 'Nuevo logro', tone: 'note' };
  if (kind === 'pregunta' || kind === 'ayuda') return { label: 'Nueva pregunta', tone: 'talk' };
  return { label: 'Nueva publicación', tone: 'note' };
}

export function buildActivity(posts, replies, courses) {
  const items = [];
  for (const post of posts || []) {
    const meta = activityMeta(post.kind, 'post');
    items.push({
      id: `post-${post.id}`,
      at: post.created_at,
      href: `/edu/comunidad/${post.slug || post.id}`,
      title: post.title,
      author: post.author_name || '',
      avatar: post.avatar_url || '',
      ...meta,
    });
  }
  for (const reply of replies || []) {
    const meta = activityMeta(reply.kind, 'reply');
    items.push({
      id: `reply-${reply.id}`,
      at: reply.created_at,
      href: `/edu/comunidad/${reply.post_slug || reply.post_id}`,
      title: reply.post_title,
      author: reply.author_name || '',
      avatar: reply.avatar_url || '',
      ...meta,
    });
  }
  for (const course of courses || []) {
    if (!course?.author_name && !course?.title) continue;
    const meta = activityMeta('proyecto', 'course');
    items.push({
      id: `course-${course.id}`,
      at: course.created_at,
      href: `/edu/cursos/${course.id}`,
      title: course.title || 'Curso',
      author: course.author_name || '',
      avatar: course.avatar_url || '',
      ...meta,
    });
  }
  return items
    .filter((item) => item.at && item.title)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);
}
