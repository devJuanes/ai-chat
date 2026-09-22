import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const TEMPLATE_DIR = path.join(config.root, 'docs', 'templates');

const CATALOG = [
  {
    id: 'react-tailwind',
    file: 'react-tailwind.html',
    label: 'React + Tailwind (previewable)',
    match: [
      /\b(react|jsx|tsx|next\.?js|vite\s*\+?\s*react)\b/i,
      /\b(tailwind|tailwindcss)\b/i,
      /\b(componente|component).{0,30}\b(react|jsx)\b/i,
      /\b(crea|haz|arma|diseña|disena|monta).{0,40}\b(react|jsx|tsx)\b/i,
    ],
  },
  {
    id: 'landing',
    file: 'landing.html',
    label: 'Landing / marketing',
    match: [
      /\b(landing|home\s*page|página\s*web|pagina\s*web|sitio\s*web|website|web\s*page)\b/i,
      /\b(hero|marketing|producto|saas|startup|negocio)\b/i,
      /\b(diseña|disena|crea|haz|arma|monta).{0,40}\b(página|pagina|web|site|landing)\b/i,
    ],
  },
  {
    id: 'blog',
    file: 'blog.html',
    label: 'Blog / revista',
    match: [
      /\b(blog|revista|artículos|articulos|posts?|magazine)\b/i,
      /\b(perros?|mascotas?|recetas?|noticias)\b/i,
    ],
  },
  {
    id: 'app-shell',
    file: 'app-shell.html',
    label: 'App / dashboard',
    match: [
      /\b(dashboard|panel|admin|crm|app\s*shell|saas\s*app|intranet)\b/i,
      /\b(métricas|metricas|analytics|tabla de control)\b/i,
    ],
  },
];

const cache = new Map();

function readTemplate(file) {
  const cached = cache.get(file);
  const full = path.join(TEMPLATE_DIR, file);
  try {
    const raw = fs.readFileSync(full, 'utf8');
    if (cached !== raw) cache.set(file, raw);
    return cache.get(file);
  } catch {
    return null;
  }
}

/** ¿El mensaje pide una página / demo visual (HTML o React previewable)? */
export function wantsHtmlPage(text = '') {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (wantsReactPage(t)) return true;
  if (
    /\b(html|landing|página|pagina|sitio|website|blog|dashboard|mockup|demo\s*visual|diseño\s*web|diseno\s*web)\b/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    /\b(crea|haz|arma|diseña|disena|monta|genera).{0,60}\b(web|página|pagina|site|ui|interfaz)\b/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

export function wantsReactPage(text = '') {
  const t = String(text || '');
  if (!t.trim()) return false;
  return (
    /\b(react|jsx|tsx|tailwind|tailwindcss|next\.?js)\b/i.test(t) ||
    /\b(componente|component).{0,40}\b(react|jsx|ui)\b/i.test(t)
  );
}

export function pickTemplateId(text = '') {
  const t = String(text || '');

  // React / Tailwind gana siempre si el usuario lo pidió explícitamente.
  if (wantsReactPage(t)) {
    return 'react-tailwind';
  }

  let best = CATALOG.find((c) => c.id === 'landing') || CATALOG[0];
  let bestScore = 0;
  for (const item of CATALOG) {
    if (item.id === 'react-tailwind') continue;
    let score = 0;
    for (const re of item.match) {
      if (re.test(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best.id;
}

export function loadTemplate(id) {
  const item = CATALOG.find((t) => t.id === id) || CATALOG[0];
  const html = readTemplate(item.file);
  if (!html) return null;
  return { id: item.id, label: item.label, html };
}

/**
 * Bloque para inyectar en el system prompt cuando el usuario pide una página.
 * La IA adapta la plantilla en vez de inventar estructura desde cero.
 */
export function buildTemplatePromptBlock(userText = '') {
  if (!wantsHtmlPage(userText)) return '';
  const picked = loadTemplate(pickTemplateId(userText));
  if (!picked) return '';

  if (picked.id === 'react-tailwind') {
    return `
## Plantilla base Matu — React + Tailwind (OBLIGATORIO)
El usuario pidió React / Tailwind / JSX. La vista previa del chat monta el componente automáticamente.

Plantilla elegida: **${picked.id}** (${picked.label}).

Cómo entregar (elige UNA):
A) **Preferido — un solo componente** en fence \`\`\`jsx\`\`\` o \`\`\`tsx\`\`\` (ej. \`FavoriteButton\`, \`PricingCard\`). La app lo envuelve sola con React + Tailwind y lo muestra en preview. NO hace falta App.jsx ni createRoot.
B) Documento \`\`\`html\`\`\` completo partiendo de la plantilla de abajo (si el brief es una página entera).

Reglas:
1. Si entregas un componente: un solo fence con el componente exportado/definido (PascalCase). Usa Tailwind (\`className\`). Puedes usar \`useState\` / hooks.
2. Sin \`import\` de npm en el fence del componente (o la app los ignora). No Next.js ni Vite.
3. Si usas la plantilla HTML de abajo: conserva CDNs (Tailwind + React + Babel), \`#root\` y el script \`type="text/babel"\`; adapta el JSX de \`App\` y reemplaza \`{{...}}\`.
4. Objetivo: calidad alta, compacto — un componente usable en preview > muchos archivos.

Plantilla HTML de referencia (solo si eliges B):
\`\`\`html
${picked.html.trim()}
\`\`\`
`;
  }

  return `
## Plantilla base Matu (OBLIGATORIO usar como punto de partida)
El usuario pidió una página/demo visual. NO inventes el esqueleto desde cero.

Plantilla elegida: **${picked.id}** (${picked.label}).

Reglas de adaptación:
1. Parte de la plantilla de abajo. Conserva la estructura (nav, secciones, grid, footer).
2. Reemplaza TODOS los placeholders \`{{...}}\` con copy real del pedido.
3. Adapta colores, tipografía y detalles visuales al brief (marca, tono, nicho).
4. Puedes añadir 1–2 secciones si el brief lo exige, sin inflar el HTML.
5. Entrega un único documento \`\`\`html\`\`\` completo y cerrado (DOCTYPE → </html>).
6. Mantén CSS en un solo <style>, sin CDNs pesados. SVG inline solo si aporta.
7. Objetivo: calidad alta con MENOS tokens — editar > reescribir.

\`\`\`html
${picked.html.trim()}
\`\`\`
`;
}

export function listTemplates() {
  return CATALOG.map(({ id, label, file }) => ({ id, label, file }));
}
