import { useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import {
  CheckIcon,
  CodeBracketIcon,
  CopyIcon,
  PlayIcon,
} from './Icons';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('svg', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

const LANG_LABELS = {
  javascript: 'JavaScript',
  js: 'JavaScript',
  jsx: 'JSX',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  tsx: 'TSX',
  html: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  python: 'Python',
  py: 'Python',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  sql: 'SQL',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  csharp: 'C#',
  cs: 'C#',
  php: 'PHP',
  ruby: 'Ruby',
  yaml: 'YAML',
  yml: 'YAML',
  markdown: 'Markdown',
  md: 'Markdown',
  csv: 'CSV',
  tsv: 'TSV',
  text: 'Text',
  plaintext: 'Text',
};

function normalizeLang(lang = '') {
  const l = String(lang).trim().toLowerCase();
  if (!l) return 'text';
  if (l === 'htm') return 'html';
  if (l === 'c++' || l === 'cpp') return 'cpp';
  return l;
}

function canPreview(lang) {
  return ['html', 'svg', 'css'].includes(normalizeLang(lang));
}

function buildPreviewDoc(code, lang) {
  const l = normalizeLang(lang);
  const raw = String(code || '').trim();

  if (!raw) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;height:100%;display:grid;place-items:center;background:#f7f7f8;font-family:system-ui,sans-serif;color:#5d5d5d}
    </style></head><body><p>No hay HTML para previsualizar.</p></body></html>`;
  }

  if (l === 'svg') {
    const body = raw.startsWith('<')
      ? raw
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${raw}</svg>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#f7f7f8;}svg{max-width:100%;max-height:100%;}</style></head><body>${body}</body></html>`;
  }

  if (l === 'css') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${raw}</style></head><body style="margin:0;padding:24px;font-family:system-ui,sans-serif"><h1>Vista previa CSS</h1><p>Párrafo de ejemplo</p><button>Botón</button><div class="card" style="margin-top:16px;padding:16px;border:1px solid #ddd;border-radius:12px">Tarjeta de ejemplo</div></body></html>`;
  }

  // Documento completo
  if (/<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return raw;
  }

  // Fragmento HTML → documento listo para iframe
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;padding:0;min-height:100%;background:#fff;color:#0d0d0d;font-family:system-ui,-apple-system,sans-serif;}
img,video,svg{max-width:100%;height:auto;}
</style></head><body>${raw}</body></html>`;
}

export default function CodeBlock({ code, language = 'text', isUser = false }) {
  const lang = normalizeLang(language);
  const previewable = canPreview(lang) && !isUser;
  const hasContent = Boolean(String(code || '').trim());
  // Código primero mientras llega el stream; el usuario cambia a preview
  const [mode, setMode] = useState('code');
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const highlighted = useMemo(() => {
    const src = String(code || '');
    try {
      if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
        return hljs.highlight(src, { language: lang }).value;
      }
      return hljs.highlightAuto(src).value;
    } catch {
      return escapeHtml(src);
    }
  }, [code, lang]);

  useEffect(() => {
    if (mode !== 'preview' || !previewable) {
      setPreviewUrl(null);
      return undefined;
    }
    const doc = buildPreviewDoc(code, lang);
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [mode, code, lang, previewable]);

  const label = LANG_LABELS[lang] || language || 'Code';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  const showPreview = mode === 'preview' && previewable;

  return (
    <div
      className={`code-editor w-full min-w-0 overflow-hidden ${
        isUser
          ? 'my-1 rounded-xl border border-white/20 bg-black/30'
          : 'border-y border-hairline bg-white first:border-t-0 last:border-b-0'
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 ${
          isUser ? 'border-white/15 bg-black/20' : 'border-hairline bg-[#f7f7f8]'
        }`}
      >
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            isUser ? 'bg-white/50' : 'bg-[#c4c4c4]'
          }`}
          aria-hidden="true"
        />
        <span
          className={`text-[12px] font-medium tracking-wide ${
            isUser ? 'text-white/80' : 'text-mid-ash'
          }`}
        >
          {label}
        </span>
        {showPreview && (
          <span className="rounded-full bg-[#f4ed36] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            Preview
          </span>
        )}
        <div className="flex-1" />
        {previewable && (
          <>
            <button
              type="button"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                mode === 'code'
                  ? isUser
                    ? 'bg-white/15 text-white'
                    : 'bg-white text-graphite-ink shadow-sm ring-1 ring-black/10'
                  : isUser
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-hollow hover:bg-white hover:text-graphite-ink'
              }`}
              title="Ver código"
              aria-label="Ver código"
              onClick={() => setMode('code')}
            >
              <CodeBracketIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                mode === 'preview'
                  ? isUser
                    ? 'bg-white/15 text-white'
                    : 'bg-[#f4ed36] text-black shadow-sm ring-1 ring-black/20'
                  : isUser
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-hollow hover:bg-white hover:text-graphite-ink'
              }`}
              title="Vista previa"
              aria-label="Vista previa"
              onClick={() => setMode('preview')}
            >
              <PlayIcon className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition ${
            isUser
              ? 'text-white/80 hover:bg-white/10 hover:text-white'
              : 'text-mid-ash hover:bg-white hover:text-graphite-ink'
          }`}
          onClick={copy}
          title="Copiar código"
          aria-label="Copiar código"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <CopyIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copiar</span>
            </>
          )}
        </button>
      </div>

      {showPreview ? (
        previewUrl ? (
          <iframe
            key={previewUrl}
            title="Vista previa HTML"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            className="block h-[min(560px,70vh)] w-full min-w-0 border-0 bg-white"
            src={previewUrl}
          />
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-mid-ash">
            Preparando vista previa…
          </div>
        )
      ) : (
        <div className="code-editor-body max-h-[420px] min-h-[48px] overflow-auto">
          {hasContent ? (
            <pre className="m-0 p-0">
              <code
                className={`hljs block px-4 py-3 font-mono text-[13px] leading-[1.55] ${
                  isUser ? 'bg-transparent text-white' : 'bg-white text-[#24292e]'
                }`}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </pre>
          ) : (
            <p className="px-4 py-3 text-[13px] text-mid-ash">
              El bloque de código llegó vacío. Pide regenerar la respuesta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
