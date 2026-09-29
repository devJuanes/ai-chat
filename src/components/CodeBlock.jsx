import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const REEL_ROWS = 18;
const REEL_ROW_H = 24;

function highlightCode(src, lang) {
  const text = String(src || '');
  if (!text) return '';
  try {
    if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
      return hljs.highlight(text, { language: lang }).value;
    }
    return hljs.highlightAuto(text).value;
  } catch {
    return escapeHtml(text);
  }
}

/** Parte el HTML resaltado por líneas reales, sin cortar un tag a la mitad. */
function splitHighlightedLines(html) {
  const lines = [];
  let cur = '';
  let inTag = false;
  const src = String(html || '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    if (ch === '\n' && !inTag) {
      lines.push(cur);
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  lines.push(cur);
  return lines;
}

function poseReel(reel, rows) {
  const box = reel.getBoundingClientRect();
  const half = box.height / 2 || 1;
  const cy = box.top + half;
  rows.forEach((row) => {
    const face = row.firstElementChild;
    if (!face) return;
    const r = row.getBoundingClientRect();
    const rel = (r.top + r.height / 2 - cy) / half;
    const ad = Math.min(1.15, Math.abs(rel));
    const tilt = rel * -54;
    const z = (1 - Math.min(1, ad)) * 48;
    face.style.transform = `rotateX(${tilt.toFixed(2)}deg) translateZ(${z.toFixed(1)}px) scale(${(1.12 - ad * 0.42).toFixed(3)})`;
    face.style.opacity = String(Math.max(0.04, 1 - ad * 0.9));
  });
}

/** La última línea real queda en la zona nítida, un poco bajo el centro. */
function tailSlotFor(reel) {
  const visible = Math.max(6, Math.round((reel?.clientHeight || 280) / REEL_ROW_H));
  return Math.min(REEL_ROWS - 3, Math.round(visible * 0.62));
}

function CodeReel({ lines }) {
  const reelRef = useRef(null);
  const trackRef = useRef(null);
  const source = lines?.length ? lines : [''];

  useLayoutEffect(() => {
    const reel = reelRef.current;
    const track = trackRef.current;
    if (!reel || !track) return;
    const rows = [...track.children];
    const tailSlot = tailSlotFor(reel);
    const tailIndex = Math.max(0, source.length - 1);
    const start = tailIndex - tailSlot;
    rows.forEach((row, i) => {
      const face = row.firstElementChild;
      if (!face) return;
      const lineIndex = start + i;
      const html =
        lineIndex >= 0 && lineIndex < source.length ? source[lineIndex] : '';
      if (face.innerHTML !== html) face.innerHTML = html;
    });
    if (track.style.transform) track.style.transform = '';
    poseReel(reel, rows);
  }, [source]);

  useEffect(() => {
    const reel = reelRef.current;
    const track = trackRef.current;
    if (!reel || !track) return undefined;
    const onResize = () => poseReel(reel, [...track.children]);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="code-reel" ref={reelRef}>
      <div className="code-reel__track" ref={trackRef}>
        {Array.from({ length: REEL_ROWS }, (_, i) => (
          <div className="code-reel__row" key={i}>
            <div className="code-reel__face" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CodeBlock({
  code,
  language = 'text',
  isUser = false,
  streaming = false,
}) {
  const lang = normalizeLang(language);
  const previewable = canPreview(lang) && !isUser;
  const hasContent = Boolean(String(code || '').trim());
  const live = Boolean(streaming) && !isUser;
  const studio = !isUser;
  // Código primero mientras llega el stream; el usuario cambia a preview
  const [mode, setMode] = useState('code');
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const highlighted = useMemo(() => highlightCode(code, lang), [code, lang]);
  const liveLines = useMemo(
    () => (live ? splitHighlightedLines(highlighted) : []),
    [live, highlighted],
  );

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
    <div className={`code-stream-shell ${live ? 'is-live' : ''}`}>
      {live ? (
        <span className="code-stream-led" aria-hidden="true">
          <span className="code-stream-led__spin" />
        </span>
      ) : null}
    <div
      className={`code-editor relative z-[1] w-full min-w-0 overflow-hidden ${
        studio ? 'code-editor--studio' : ''
      } ${live ? 'code-editor--streaming' : ''} ${
        isUser
          ? 'my-1 rounded-xl border border-white/20 bg-black/30'
          : 'border-y border-transparent first:border-t-0 last:border-b-0'
      }`}
    >
      <div
        className={`relative z-[2] flex items-center gap-2 border-b px-3 py-2 ${
          isUser
            ? 'border-white/15 bg-black/20'
            : 'border-white/10 bg-[#10182a]'
        }`}
      >
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            live
              ? 'code-stream-dot'
              : isUser
                ? 'bg-white/50'
                : 'bg-[#3c4d66]'
          }`}
          aria-hidden="true"
        />
        <span
          className={`text-[12px] font-medium tracking-wide ${
            isUser ? 'text-white/80' : 'text-[#d5deea]'
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
                    : 'bg-[#f4ed36] text-black shadow-sm ring-1 ring-black/30'
                  : isUser
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-[#b7c3d6] hover:bg-white/10 hover:text-white'
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
                    : 'bg-[#f4ed36] text-black shadow-sm ring-1 ring-black/30'
                  : isUser
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-[#b7c3d6] hover:bg-white/10 hover:text-white'
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
              : 'text-[#b7c3d6] hover:bg-white/10 hover:text-white'
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
      ) : live ? (
        <CodeReel lines={liveLines} />
      ) : (
        <div className="code-editor-body max-h-[420px] min-h-[48px] overflow-auto">
          {hasContent ? (
            <pre className="m-0 max-w-full p-0">
              <code
                className={`hljs block px-4 py-3 font-mono text-[13px] leading-[1.55] ${
                  isUser ? 'bg-transparent text-white' : 'bg-transparent text-[#d5deea]'
                }`}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </pre>
          ) : (
            <p className={`px-4 py-3 text-[13px] ${studio ? 'text-[#8ea0b8]' : 'text-mid-ash'}`}>
              El bloque de código llegó vacío. Pide regenerar la respuesta.
            </p>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

