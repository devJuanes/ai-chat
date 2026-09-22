/**
 * Preview React: envuelve un componente JSX/TSX suelto en shell
 * React 18 + Tailwind CDN (mismo patrón que docs/templates/react-tailwind.html).
 */

const FENCE_LANG =
  /^(jsx|tsx|react|javascript|js|typescript|ts)(?:[ \t]+.*)?$/i;

/** Corta markdown / fences que se colaron al final del código. */
export function sanitizeJsxSource(src = '') {
  let body = String(src || '');
  if (!body.trim()) return '';

  const lines = body.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    if (/^```+\s*$/.test(line)) break;
    if (
      kept.length > 5 &&
      /^(He |He\s|Aquí |Aqui |Si quieres|Si deseas|Puedes |También |Ademas |Además |\*\*[A-Za-zÁÉÍÓÚáéíóú])/i.test(
        line.trim()
      ) &&
      !/[{};()<>]=/.test(line) &&
      !/^\s*\/\//.test(line) &&
      !/^\s*\/\*/.test(line)
    ) {
      break;
    }
    if (
      kept.length > 5 &&
      /^[-*]\s+[A-ZÁÉÍÓÚa-záéíóú]/.test(line.trim()) &&
      !/[<>{};=]/.test(line) &&
      /separar|añadir|agregar|persistencia|localStorage|componente/i.test(line)
    ) {
      break;
    }
    kept.push(line);
  }
  body = kept.join('\n').trim();

  const tick = body.search(/\n```+\s*$/);
  if (tick !== -1) body = body.slice(0, tick).trim();

  return body;
}

/**
 * Quita import/export ESM (también multilínea). Stubea iconos lucide-react
 * y cualquier <Componente> PascalCase usado pero no definido.
 * Evita: "Cannot use import statement outside a module" / ReferenceError.
 */
export function stripModuleSyntax(src = '') {
  let body = String(src || '');
  const lucideIcons = new Set();

  const collectLucide = (namesChunk) => {
    String(namesChunk || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((part) => {
        const asMatch = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(
          part
        );
        if (asMatch) {
          lucideIcons.add(asMatch[2]);
          return;
        }
        const name = part.replace(/^type\s+/, '').split(/\s+/)[0];
        if (name && /^[A-Z]/.test(name)) lucideIcons.add(name);
      });
  };

  body = body.replace(
    /(?:^|\n)\s*import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react(?:\/[^'"]*)?['"]\s*;?/g,
    (_, names) => {
      collectLucide(names);
      return '\n';
    }
  );
  body = body.replace(
    /(?:^|\n)\s*import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]lucide-react(?:\/[^'"]*)?['"]\s*;?/g,
    (_, name) => {
      lucideIcons.add(name);
      return '\n';
    }
  );

  // Imports de otros paquetes de iconos → mismos stubs
  body = body.replace(
    /(?:^|\n)\s*import\s*\{([\s\S]*?)\}\s*from\s*['"](?:react-icons\/[\w-]+|@heroicons\/react\/[\w-]+|heroicons\/react)['"]\s*;?/g,
    (_, names) => {
      collectLucide(names);
      return '\n';
    }
  );

  body = body.replace(
    /(?:^|\n)\s*import\s+type\s+[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g,
    '\n'
  );
  body = body.replace(
    /(?:^|\n)\s*import\s*[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g,
    '\n'
  );
  body = body.replace(/(?:^|\n)\s*import\s*['"][^'"]+['"]\s*;?/g, '\n');
  body = body.replace(/(?:^|\n)\s*import\b[^\n]*\n?/g, '\n');

  body = body
    .replace(/(?:^|\n)\s*export\s+default\s+/g, '\n')
    .replace(/(?:^|\n)\s*export\s+\{[^}]*\}\s*;?/g, '\n')
    .replace(
      /(?:^|\n)\s*export\s+(?=async\b|function\b|const\b|let\b|var\b|class\b)/g,
      '\n'
    );

  body = body
    .replace(/(?:^|\n)\s*interface\s+[A-Za-z0-9_]+\s*\{[\s\S]*?\}\s*/g, '\n')
    .replace(/(?:^|\n)\s*type\s+[A-Za-z0-9_]+\s*=\s*[\s\S]*?;\s*/g, '\n')
    .replace(/:\s*React\.(FC|FunctionComponent)(<[^>]*>)?/g, '')
    .replace(/\)\s*:\s*JSX\.Element/g, ')')
    .replace(/\)\s*:\s*React\.(ReactNode|ReactElement)/g, ')');

  body = body.trim();

  // Componentes PascalCase usados en JSX pero no definidos (Search, Heart, …)
  const defined = new Set(['App', 'Fragment', 'React', 'ReactDOM', 'StrictMode']);
  for (const m of body.matchAll(/(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    defined.add(m[1]);
  }
  for (const m of body.matchAll(/(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/g)) {
    defined.add(m[1]);
  }

  const used = new Set();
  for (const m of body.matchAll(/<\/?([A-Z][A-Za-z0-9_]*)\b/g)) {
    used.add(m[1]);
  }

  for (const name of used) {
    if (!defined.has(name)) lucideIcons.add(name);
  }

  let stubs = '';
  if (lucideIcons.size) {
    stubs =
      [...lucideIcons]
        .filter((name) => !defined.has(name))
        .map(
          (name) =>
            `function ${name}(props){props=props||{};var s=props.size||'1em';return React.createElement('span',{className:props.className,'aria-hidden':true,role:'img',style:{display:'inline-flex',width:s,height:s,alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1}},props.children||'◆');}`
        )
        .join('\n') + '\n';
  }

  return { code: body, stubs };
}

export function wrapReactJsxForPreview(jsxSource) {
  let body = sanitizeJsxSource(jsxSource);
  if (!body) return null;

  const stripped = stripModuleSyntax(body);
  body = sanitizeJsxSource(stripped.code);
  if (!body) return null;

  // Cinturón: ningún import debe llegar a Babel
  if (/\bimport\s/.test(body)) {
    body = stripModuleSyntax(body).code;
  }
  body = body.replace(/\bimport\s[\s\S]*?(?:from\s*['"][^'"]+['"]\s*;?|;)/g, '');
  body = body.trim();
  if (!body || /\bimport\s/.test(body)) {
    // Último recurso: eliminar líneas que empiezan por import
    body = body
      .split(/\r?\n/)
      .filter((l) => !/^\s*import\b/.test(l))
      .join('\n')
      .trim();
  }
  if (!body) return null;

  const hasApp =
    /\bfunction\s+App\b/.test(body) ||
    /\bconst\s+App\s*=/.test(body) ||
    /\bclass\s+App\b/.test(body);

  const nameMatch =
    body.match(/(?:function\s+)([A-Z][A-Za-z0-9_]*)\s*\(/) ||
    body.match(
      /(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\(|function\b|<)/
    ) ||
    body.match(/(?:class\s+)([A-Z][A-Za-z0-9_]*)\b/);

  const componentName = nameMatch?.[1] || null;
  const looksLikeJsxOnly =
    !componentName &&
    !hasApp &&
    (/^\s*</.test(body) || /className=|<\/[A-Za-z]/.test(body));

  let appBlock;
  if (hasApp) {
    appBlock = body;
  } else if (componentName) {
    appBlock = `${body}

function App() {
  return (
    <div className="min-h-screen bg-[#f9f5f2] p-6 text-[#0d0d0d]">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4">
        <${componentName} />
      </div>
    </div>
  );
}`;
  } else if (looksLikeJsxOnly) {
    appBlock = `function App() {\n  return (\n${body}\n  );\n}`;
  } else {
    appBlock = `function App() {\n  return (\n    <>\n${body}\n    </>\n  );\n}`;
  }

  const needsHooks =
    /\buse(State|Effect|Memo|Ref|Callback|Reducer|Context|Id|LayoutEffect)\b/.test(
      body
    );
  const hooksLine = needsHooks
    ? 'const { useState, useEffect, useMemo, useRef, useCallback, useReducer, Fragment } = React;\n'
    : 'const { Fragment } = React;\n';

  const hasMount =
    /ReactDOM\.createRoot/.test(appBlock) || /createRoot\s*\(/.test(appBlock);

  const mount = hasMount
    ? ''
    : `\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<App />);`;

  const safeBlock = `${hooksLine}${stripped.stubs}${appBlock}${mount}`.replace(
    /<\/script/gi,
    '<\\/script'
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Matu · React preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            matu: {
              yellow: '#f4ed36',
              lilac: '#8584bd',
              mint: '#b5c995',
              coral: '#f8c1ba',
              bone: '#f9f5f2',
              ink: '#0d0d0d',
            },
          },
          boxShadow: {
            brutal: '3px 3px 0 #000',
            'brutal-lg': '4px 4px 0 #000',
          },
        },
      },
    };
  <\/script>
  <style>
    html, body, #root { margin: 0; min-height: 100%; }
    body { font-family: "Segoe UI", system-ui, sans-serif; background: #f9f5f2; color: #0d0d0d; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.26.9/babel.min.js"><\/script>
  <script type="text/babel" data-presets="react,typescript">
${safeBlock}
  <\/script>
</body>
</html>`;
}

export function looksLikeReactSource(src = '') {
  const s = String(src);
  if (!s.trim()) return false;
  return (
    /<[A-Za-z]/.test(s) ||
    /className\s*=/.test(s) ||
    /\bfunction\s+[A-Z][A-Za-z0-9_]*/.test(s) ||
    /\bconst\s+[A-Z][A-Za-z0-9_]*\s*=/.test(s) ||
    /\bexport\s+default\s+function\b/.test(s) ||
    /\bReact\.(createElement|Fragment)\b/.test(s)
  );
}

function extractReactFence(cleaned) {
  const lines = String(cleaned || '').split(/\r?\n/);
  const closed = [];
  let i = 0;
  while (i < lines.length) {
    const open = /^```\s*([^\s`]*)/.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }
    const langRaw = (open[1] || '').trim();
    const langOk = !langRaw || FENCE_LANG.test(langRaw);
    if (!langOk) {
      i += 1;
      continue;
    }
    const lang = (langRaw.split(/[ \t]/)[0] || '').toLowerCase() || 'jsx';
    const bodyLines = [];
    i += 1;
    let closedFence = false;
    while (i < lines.length) {
      if (/^```+\s*$/.test(lines[i])) {
        closedFence = true;
        i += 1;
        break;
      }
      bodyLines.push(lines[i]);
      i += 1;
    }
    const src = sanitizeJsxSource(bodyLines.join('\n'));
    if (!src) continue;
    const isJsxLang = /^(jsx|tsx|react)$/.test(lang);
    if (!isJsxLang && !looksLikeReactSource(src)) continue;
    closed.push({ src, lang, open: !closedFence });
  }

  const sealed = closed.filter((b) => !b.open);
  const pool = sealed.length ? sealed : closed;
  if (!pool.length) return null;
  pool.sort((a, b) => b.src.length - a.src.length);
  return pool[0];
}

export function extractHtmlFromText(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\/?think(?:ing)?>/gi, '');

  const htmlFence = extractHtmlFence(cleaned);
  if (htmlFence?.src) {
    const html = htmlFence.src.trim();
    if (
      !/<!DOCTYPE/i.test(html) &&
      !/<html[\s>]/i.test(html) &&
      looksLikeReactSource(html)
    ) {
      return wrapReactJsxForPreview(html);
    }
    return html;
  }

  const doctype = /<!DOCTYPE\s+html[\s\S]*/i.exec(cleaned);
  if (doctype) {
    const raw = doctype[0];
    const end = raw.search(/<\/html>/i);
    if (end !== -1) return raw.slice(0, end + 7).trim();
    return sanitizeJsxSource(raw) || raw.trim();
  }

  const htmlTag = /<html[\s>][\s\S]*/i.exec(cleaned);
  if (htmlTag) {
    const raw = htmlTag[0];
    const end = raw.search(/<\/html>/i);
    if (end !== -1) return raw.slice(0, end + 7).trim();
    return raw.trim();
  }

  const reactFence = extractReactFence(cleaned);
  if (reactFence?.src) {
    return wrapReactJsxForPreview(reactFence.src);
  }

  return null;
}

function extractHtmlFence(cleaned) {
  const lines = String(cleaned || '').split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const open = /^```\s*html\b/i.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }
    const bodyLines = [];
    i += 1;
    let sealed = false;
    while (i < lines.length) {
      if (/^```+\s*$/.test(lines[i])) {
        sealed = true;
        i += 1;
        break;
      }
      bodyLines.push(lines[i]);
      i += 1;
    }
    const src = bodyLines.join('\n').trim();
    if (src) blocks.push({ src, open: !sealed });
  }
  if (!blocks.length) return null;
  const sealed = blocks.filter((b) => !b.open);
  const pool = sealed.length ? sealed : blocks;
  pool.sort((a, b) => b.src.length - a.src.length);
  return pool[0];
}

export function isIncompleteHtml(text) {
  if (!text) return false;
  const cleaned = String(text)
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\/?think(?:ing)?>/gi, '');

  const hasHtmlFence = /```html\b/i.test(cleaned);
  if (hasHtmlFence) {
    const fence = extractHtmlFence(cleaned);
    if (fence?.open) return true;
  }

  const hasJsxFence = /```(?:jsx|tsx|react|typescript|ts)\b/i.test(cleaned);
  if (hasJsxFence) {
    const fence = extractReactFence(cleaned);
    if (fence?.open) return true;
  }

  const html = extractHtmlFromText(cleaned);
  if (!html) return false;

  if (
    /Matu · React preview/i.test(html) &&
    extractReactFence(cleaned) &&
    !extractReactFence(cleaned)?.open
  ) {
    return false;
  }

  if (!/<\/html>/i.test(html)) return true;

  const tail = html.trim().slice(-80);
  if (/[{:;,\.]\s*$/.test(tail)) return true;
  if (/<\/?(?!html\b)[a-zA-Z][^>]*$/i.test(tail)) return true;

  return false;
}
