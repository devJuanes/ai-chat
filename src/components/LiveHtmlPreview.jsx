import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, CodeBracketIcon, PlayIcon } from './Icons';

/** Extrae HTML de un mensaje (fence cerrado, fence abierto en stream, o DOCTYPE crudo). */
export function extractHtmlFromText(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\/?think(?:ing)?>/gi, '');

  const closed = /```html\s*\r?\n?([\s\S]*?)```/i.exec(cleaned);
  if (closed?.[1]?.trim()) return closed[1].trim();

  const open = /```html\s*\r?\n?([\s\S]*)$/i.exec(cleaned);
  if (open?.[1]?.trim()) return open[1].trim();

  const doctype = /<!DOCTYPE\s+html[\s\S]*/i.exec(cleaned);
  if (doctype) return doctype[0].trim();

  const htmlTag = /<html[\s>][\s\S]*/i.exec(cleaned);
  if (htmlTag) return htmlTag[0].trim();

  return null;
}

/** Detecta HTML truncado (fence abierto, sin </html>, o corte a mitad de CSS/markup). */
export function isIncompleteHtml(text) {
  if (!text) return false;
  const cleaned = String(text)
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\/?think(?:ing)?>/gi, '');

  const hasHtmlFence = /```html\b/i.test(cleaned);
  if (hasHtmlFence) {
    const closedFence = /```html\s*\r?\n?[\s\S]*?```/i.test(cleaned);
    if (!closedFence) return true;
  }

  const html = extractHtmlFromText(cleaned);
  if (!html) return false;

  if (!/<\/html>/i.test(html)) return true;

  const tail = html.trim().slice(-80);
  if (/[{:;,\.]\s*$/.test(tail)) return true;
  if (/<\/?(?!html\b)[a-zA-Z][^>]*$/i.test(tail)) return true;

  return false;
}

/** Cierra tags a medias para que el iframe pueda pintar mientras stream. */
function healPartialHtml(raw) {
  let doc = String(raw || '');
  if (!doc.trim()) return doc;

  const count = (re) => (doc.match(re) || []).length;

  const styleOpen = count(/<style\b[^>]*>/gi);
  const styleClose = count(/<\/style>/gi);
  if (styleOpen > styleClose) {
    doc += '\n</style>'.repeat(styleOpen - styleClose);
  }

  const scriptOpen = count(/<script\b[^>]*>/gi);
  const scriptClose = count(/<\/script>/gi);
  if (scriptOpen > scriptClose) {
    doc += '\n</script>'.repeat(scriptOpen - scriptClose);
  }

  const voidEls = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);
  const stack = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
  let m;
  while ((m = tagRe.exec(doc))) {
    const full = m[0];
    const name = m[1].toLowerCase();
    if (full.startsWith('</')) {
      const idx = stack.lastIndexOf(name);
      if (idx !== -1) stack.splice(idx);
      continue;
    }
    if (full.endsWith('/>') || voidEls.has(name)) continue;
    stack.push(name);
  }
  while (stack.length) {
    const name = stack.pop();
    if (name === 'html' || name === 'body' || name === 'head') continue;
    doc += `</${name}>`;
  }

  if (/<html[\s>]/i.test(doc) && !/<\/html>/i.test(doc)) {
    if (!/<\/body>/i.test(doc) && /<body[\s>]/i.test(doc)) doc += '</body>';
    doc += '</html>';
  }

  return doc;
}

/**
 * Cursor diseñador dentro del iframe:
 * - encuentra bloques (header, section, cards…)
 * - los “coloca” uno a uno con mouse + pim
 * - lo viejo ya está; lo nuevo cae con pop
 */
const LIVE_UI = `<style id="matu-live-ui">
@keyframes matu-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes matu-pop{0%{transform:scale(.55);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes matu-drop{0%{opacity:0;transform:translateY(18px) scale(.96)}
70%{opacity:1;transform:translateY(-2px) scale(1.01)}100%{opacity:1;transform:none}}
@keyframes matu-pim{0%{transform:scale(.2);opacity:.9}100%{transform:scale(2.4);opacity:0}}
@keyframes matu-pulse{0%,100%{box-shadow:3px 3px 0 #000}50%{box-shadow:5px 5px 0 #000}}
@keyframes matu-draw{0%{stroke-dashoffset:48}100%{stroke-dashoffset:0}}
.matu-ghost{opacity:0!important;transform:translateY(14px) scale(.97)!important;filter:blur(1px);pointer-events:none!important}
.matu-placing{outline:2px dashed #000;outline-offset:4px;animation:matu-drop .48s cubic-bezier(.2,.8,.2,1) both}
.matu-placed{animation:matu-drop .42s cubic-bezier(.2,.8,.2,1) both}
#matu-live-badge{position:fixed;left:14px;bottom:14px;z-index:99999;
font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;
background:#f4ed36;color:#000;border:2px solid #000;border-radius:999px;padding:8px 12px;
box-shadow:3px 3px 0 #000;pointer-events:none;animation:matu-pop .35s ease-out,matu-pulse 1.4s ease-in-out infinite}
#matu-live-cursor{position:fixed;z-index:100000;width:22px;height:22px;pointer-events:none;
filter:drop-shadow(2px 2px 0 #000);transition:left .22s cubic-bezier(.2,.8,.2,1),top .22s cubic-bezier(.2,.8,.2,1),transform .12s}
#matu-live-cursor.matu-click{transform:scale(.82)}
#matu-live-cursor svg{display:block;width:22px;height:22px}
#matu-live-ripples{position:fixed;inset:0;z-index:99998;pointer-events:none;overflow:hidden}
.matu-ripple{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border:2.5px solid #000;
border-radius:50%;background:#f4ed36;animation:matu-pim .55s ease-out forwards}
#matu-live-sketch{position:fixed;z-index:99997;pointer-events:none;opacity:.55}
#matu-live-sketch rect{fill:none;stroke:#000;stroke-width:2;stroke-dasharray:48;animation:matu-draw .4s ease forwards}
</style>
<div id="matu-live-badge">Diseñando…</div>
<div id="matu-live-ripples"></div>
<svg id="matu-live-sketch" width="0" height="0" aria-hidden="true"></svg>
<div id="matu-live-cursor" aria-hidden="true">
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 3l8.5 17 2.2-6.2L21 11.5 4 3z" fill="#f4ed36" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
  </svg>
</div>
<script id="matu-live-script">
(function(){
  var cursor=document.getElementById('matu-live-cursor');
  var ripples=document.getElementById('matu-live-ripples');
  var sketch=document.getElementById('matu-live-sketch');
  var badge=document.getElementById('matu-live-badge');
  if(!cursor||!document.body) return;

  var SKIP={SCRIPT:1,STYLE:1,LINK:1,META:1,NOSCRIPT:1,BR:1,HR:1,SVG:1};
  var LIVE_IDS={
    'matu-live-ui':1,'matu-live-badge':1,'matu-live-cursor':1,
    'matu-live-ripples':1,'matu-live-sketch':1,'matu-live-caret':1,'matu-live-script':1
  };

  function isLive(el){
    if(!el||el.nodeType!==1) return true;
    if(LIVE_IDS[el.id]) return true;
    return !!(el.closest&&(
      el.closest('#matu-live-badge')||
      el.closest('#matu-live-cursor')||
      el.closest('#matu-live-ripples')||
      el.closest('#matu-live-sketch')
    ));
  }

  function blocks(){
    var sel='header,nav,main,section,article,footer,aside,h1,h2,h3,.card,.hero,.btn,button,img,ul,form';
    var list=Array.prototype.slice.call(document.body.querySelectorAll(sel));
    var out=[], seen=new WeakSet();
    for(var i=0;i<list.length;i++){
      var el=list[i];
      if(isLive(el)||SKIP[el.tagName]) continue;
      if(seen.has(el)) continue;
      // evita padres e hijos a la vez: si el padre ya está, saltamos hijos pequeños
      var parentBlock=el.parentElement&&el.parentElement.closest&&el.parentElement.closest('header,nav,section,article,footer,aside,main');
      if(parentBlock&&parentBlock!==el&&list.indexOf(parentBlock)!==-1&&(el.tagName==='H1'||el.tagName==='H2'||el.tagName==='H3'||el.tagName==='P')){
        // dejamos títulos grandes del hero
        if(el.tagName!=='H1') continue;
      }
      var r=el.getBoundingClientRect();
      if(r.width<8||r.height<8) continue;
      seen.add(el);
      out.push(el);
    }
    // fallback: hijos directos del body
    if(out.length<2){
      Array.prototype.forEach.call(document.body.children,function(el){
        if(!isLive(el)&&!SKIP[el.tagName]) out.push(el);
      });
    }
    return out;
  }

  function moveCursor(x,y,click){
    cursor.style.left=Math.max(4,x)+'px';
    cursor.style.top=Math.max(4,y)+'px';
    if(click){
      cursor.classList.add('matu-click');
      setTimeout(function(){cursor.classList.remove('matu-click');},120);
      if(ripples){
        var d=document.createElement('div');
        d.className='matu-ripple';
        d.style.left=x+'px';
        d.style.top=y+'px';
        ripples.appendChild(d);
        setTimeout(function(){d.remove();},560);
      }
    }
  }

  function drawBox(el){
    if(!sketch) return;
    var r=el.getBoundingClientRect();
    sketch.setAttribute('width', Math.ceil(r.width+8));
    sketch.setAttribute('height', Math.ceil(r.height+8));
    sketch.style.left=(r.left-4)+'px';
    sketch.style.top=(r.top-4)+'px';
    sketch.innerHTML='<rect x="2" y="2" width="'+(r.width)+'" height="'+(r.height)+'" rx="8"/>';
    setTimeout(function(){ sketch.innerHTML=''; },420);
  }

  var items=blocks();
  var total=items.length;
  if(!total){
    moveCursor(window.innerWidth*0.55, window.innerHeight*0.4, false);
    return;
  }

  // Lo ya “construido” aparece al tiro; solo animamos los últimos bloques
  var animateFrom=Math.max(0, total-3);
  for(var i=0;i<animateFrom;i++){
    items[i].classList.remove('matu-ghost');
    items[i].classList.add('matu-placed');
  }
  for(var j=animateFrom;j<total;j++){
    items[j].classList.add('matu-ghost');
  }

  var idx=animateFrom;
  function step(){
    if(idx>=total){
      if(badge) badge.textContent='Montando…';
      var last=items[total-1];
      var lr=last.getBoundingClientRect();
      moveCursor(lr.left+Math.min(40,lr.width*0.3), lr.top+Math.min(28,lr.height*0.3), false);
      try{ last.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){}
      return;
    }
    var el=items[idx];
    var r=el.getBoundingClientRect();
    var cx=r.left + Math.min(48, Math.max(16, r.width*0.25));
    var cy=r.top + Math.min(36, Math.max(12, r.height*0.25));
    try{ el.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){}
    moveCursor(cx, cy, false);
    drawBox(el);
    setTimeout(function(){
      moveCursor(cx, cy, true);
      el.classList.remove('matu-ghost');
      el.classList.add('matu-placing');
      if(badge) badge.textContent='Pim · colocando';
      idx++;
      setTimeout(step, 90);
    }, 160);
  }
  // arranque: cursor entra desde arriba
  moveCursor(window.innerWidth*0.7, 24, false);
  setTimeout(step, 40);
})();
</script>`;

function buildLiveDoc(code, { streaming = false } = {}) {
  let raw = String(code || '').trim();
  if (!raw) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f9f5f2;color:#8a8278}
</style></head><body><p>Esperando HTML…</p>${streaming ? LIVE_UI : ''}</body></html>`;
  }

  if (streaming || !/<\/html>/i.test(raw)) {
    raw = healPartialHtml(raw);
  }

  const live = streaming ? LIVE_UI : '';

  if (/<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw)) {
    if (streaming && /<\/body>/i.test(raw)) {
      return raw.replace(/<\/body>/i, `${live}</body>`);
    }
    if (streaming && /<\/html>/i.test(raw)) {
      return raw.replace(/<\/html>/i, `${live}</html>`);
    }
    return streaming ? `${raw}${live}` : raw;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;padding:0;min-height:100%;background:#fff;color:#0d0d0d;font-family:system-ui,sans-serif}
img,svg,video{max-width:100%;height:auto}
</style></head><body>${raw}${live}</body></html>`;
}

function DesignerOverlay({ html, streaming }) {
  const [pos, setPos] = useState({ x: 62, y: 18 });
  const [pim, setPim] = useState(false);
  const [visible, setVisible] = useState(false);
  const lenRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!streaming) {
      setVisible(false);
      lenRef.current = 0;
      return undefined;
    }
    setVisible(true);
    const len = (html || '').length;
    const progress = Math.min(1, len / 14000);
    const t = Date.now() / 1000;
    const x = 18 + progress * 58 + Math.sin(t * 1.7) * 6;
    const y = 12 + progress * 68 + Math.cos(t * 1.3) * 5;

    if (len > lenRef.current + 120) {
      lenRef.current = len;
      setPim(true);
      const kill = setTimeout(() => setPim(false), 420);
      setPos({ x, y });
      return () => clearTimeout(kill);
    }

    rafRef.current = requestAnimationFrame(() => setPos({ x, y }));
    return () => cancelAnimationFrame(rafRef.current);
  }, [html, streaming]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute transition-[left,top] duration-300 ease-out"
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: pim ? 'scale(0.85)' : 'scale(1)',
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          className="drop-shadow-[2px_2px_0_#000]"
        >
          <path
            d="M4 3l8.5 17 2.2-6.2L21 11.5 4 3z"
            fill="#f4ed36"
            stroke="#000"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        {pim ? (
          <span className="absolute left-1 top-1 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-black bg-[#f4ed36]" />
        ) : null}
      </div>
      <div className="absolute bottom-3 left-3 rounded-full border-2 border-black bg-[#f4ed36] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-[2px_2px_0_#000]">
        {pim ? 'Pim' : 'Cursor · armando'}
      </div>
    </div>
  );
}

/**
 * Panel lateral tipo navegador (solo desktop).
 * Actualiza el iframe mientras el modelo escribe HTML.
 */
export default function LiveHtmlPreview({
  html,
  streaming = false,
  incomplete = false,
  onClose,
  onContinue,
  title = 'Vista previa',
}) {
  const isIncomplete = Boolean(incomplete);
  const [mode, setMode] = useState('preview');
  const iframeRef = useRef(null);
  const lastWrittenRef = useRef('');
  const writeTimerRef = useRef(null);

  const complete = useMemo(() => {
    if (!html) return false;
    return /<\/html>/i.test(html) && !isIncompleteHtml(html);
  }, [html]);

  const showGenerating = streaming || (isIncomplete && !complete);
  const liveMode = streaming || isIncomplete;

  // Escritura en vivo: un poco más lenta en stream para que el cursor alcance a “colocar”
  useEffect(() => {
    if (mode !== 'preview') return undefined;
    if (!html && !streaming) {
      lastWrittenRef.current = '';
      return undefined;
    }

    const delay = streaming ? 170 : 40;
    clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      const docHtml = buildLiveDoc(html || '', {
        streaming: liveMode,
      });
      if (docHtml === lastWrittenRef.current) return;
      lastWrittenRef.current = docHtml;

      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(docHtml);
          doc.close();
          return;
        }
      } catch {
        /* fallback blob below */
      }
      const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      iframe.onload = () => URL.revokeObjectURL(url);
      iframe.src = url;
    }, delay);

    return () => clearTimeout(writeTimerRef.current);
  }, [html, streaming, liveMode, mode]);

  return (
    <aside className="hidden h-full min-h-0 w-[min(52%,720px)] shrink-0 flex-col border-l-[2.5px] border-black bg-[#f9f5f2] lg:flex">
      <div className="flex shrink-0 items-center gap-2 border-b-[2.5px] border-black bg-[#8584bd] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#c94245]" />
          <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#f4ed36]" />
          <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#b5c995]" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-full border border-black/20 bg-white/90 px-3 py-1 text-[11px] font-medium text-black/70">
          {showGenerating ? 'matu://diseñando…' : title}
        </div>
        <button
          type="button"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-2 border-black transition ${
            mode === 'code' ? 'bg-[#f4ed36]' : 'bg-white hover:bg-[#f4ed36]'
          }`}
          title="Código"
          aria-label="Ver código"
          onClick={() => setMode('code')}
        >
          <CodeBracketIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-2 border-black transition ${
            mode === 'preview' ? 'bg-[#f4ed36]' : 'bg-white hover:bg-[#f4ed36]'
          }`}
          title="Preview"
          aria-label="Vista previa"
          onClick={() => setMode('preview')}
        >
          <PlayIcon className="h-3.5 w-3.5" />
        </button>
        {onClose ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-2 border-black bg-white hover:bg-[#f8c1ba]"
            onClick={onClose}
            aria-label="Cerrar preview"
            title="Cerrar"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {streaming ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-black/15 bg-[#f4ed36] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-black">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-black" />
          Live · cursor armando la página
        </div>
      ) : null}

      {!streaming && isIncomplete && onContinue ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/15 bg-[#f8c1ba] px-3 py-2">
          <span className="text-[12px] font-medium text-black/80">
            HTML incompleto — puedes seguir
          </span>
          <button
            type="button"
            className="rounded-full border-2 border-black bg-[#f4ed36] px-3 py-1 text-[11px] font-bold"
            onClick={onContinue}
          >
            Continuar generando
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-white">
        {mode === 'code' ? (
          <pre className="h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed text-[#1a1a1a]">
            {html || '—'}
            {streaming ? (
              <span className="inline-block w-2 animate-pulse bg-[#f4ed36]">
                &nbsp;
              </span>
            ) : null}
          </pre>
        ) : (
          <>
            <iframe
              ref={iframeRef}
              title="Vista previa HTML en vivo"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              className="h-full w-full border-0 bg-white"
              src="about:blank"
            />
            <DesignerOverlay html={html} streaming={streaming} />
          </>
        )}
      </div>
    </aside>
  );
}
