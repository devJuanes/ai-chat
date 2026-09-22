import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, CodeBracketIcon, PlayIcon } from './Icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  extractHtmlFromText,
  isIncompleteHtml,
  wrapReactJsxForPreview,
} from '../lib/reactPreview';

export { extractHtmlFromText, isIncompleteHtml, wrapReactJsxForPreview };

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
 * Cursor diseñador dentro del iframe (solo mientras stream).
 * Simula arrastrar / pegar bloques mientras llega el HTML.
 * Al terminar el stream se reescribe el HTML limpio sin esta capa.
 */
const LIVE_UI = `<style id="matu-live-ui">
@keyframes matu-pop{0%{transform:scale(.55);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes matu-drop{0%{opacity:0;transform:translateY(22px) scale(.92)}
55%{opacity:1;transform:translateY(-4px) scale(1.03)}100%{opacity:1;transform:none}}
@keyframes matu-pim{0%{transform:scale(.2);opacity:.95}100%{transform:scale(2.6);opacity:0}}
@keyframes matu-pulse{0%,100%{box-shadow:3px 3px 0 #000}50%{box-shadow:5px 5px 0 #000}}
@keyframes matu-draw{0%{stroke-dashoffset:64}100%{stroke-dashoffset:0}}
@keyframes matu-carry{0%,100%{transform:rotate(-8deg) scale(1.05)}50%{transform:rotate(6deg) scale(1.08)}}
.matu-ghost{opacity:0!important;transform:translateY(18px) scale(.94)!important;filter:blur(2px);pointer-events:none!important}
.matu-placing{outline:2px dashed #000;outline-offset:5px;animation:matu-drop .52s cubic-bezier(.2,.8,.2,1) both}
.matu-placed{animation:matu-drop .38s cubic-bezier(.2,.8,.2,1) both}
#matu-live-badge{position:fixed;left:14px;bottom:14px;z-index:99999;
font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;
background:#f4ed36;color:#000;border:2px solid #000;border-radius:999px;padding:8px 12px;
box-shadow:3px 3px 0 #000;pointer-events:none;animation:matu-pop .35s ease-out,matu-pulse 1.4s ease-in-out infinite}
#matu-live-tray{position:fixed;right:14px;top:14px;z-index:99999;display:flex;gap:6px;
pointer-events:none;animation:matu-pop .4s ease-out}
#matu-live-tray span{display:inline-flex;align-items:center;justify-content:center;
min-width:28px;height:22px;padding:0 8px;border:2px solid #000;border-radius:6px;
background:#fff;font:700 9px/1 system-ui,sans-serif;box-shadow:2px 2px 0 #000}
#matu-live-cursor{position:fixed;z-index:100000;width:24px;height:24px;pointer-events:none;left:70%;top:18px;
filter:drop-shadow(2px 2px 0 #000);transition:left .28s cubic-bezier(.2,.8,.2,1),top .28s cubic-bezier(.2,.8,.2,1),transform .12s}
#matu-live-cursor.matu-click{transform:scale(.78)}
#matu-live-cursor.matu-carry{animation:matu-carry .35s ease-in-out infinite}
#matu-live-cursor svg{display:block;width:24px;height:24px}
#matu-live-ghost-chip{position:fixed;z-index:99999;pointer-events:none;opacity:0;
border:2px solid #000;border-radius:8px;background:#f4ed36;box-shadow:3px 3px 0 #000;
font:700 10px/1 system-ui,sans-serif;padding:8px 12px;transform:translate(-50%,-50%);
transition:left .28s cubic-bezier(.2,.8,.2,1),top .28s cubic-bezier(.2,.8,.2,1),opacity .15s}
#matu-live-ghost-chip.on{opacity:.92}
#matu-live-ripples{position:fixed;inset:0;z-index:99998;pointer-events:none;overflow:hidden}
.matu-ripple{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border:2.5px solid #000;
border-radius:50%;background:#f4ed36;animation:matu-pim .55s ease-out forwards}
#matu-live-sketch{position:fixed;z-index:99997;pointer-events:none;opacity:.6}
#matu-live-sketch rect{fill:none;stroke:#000;stroke-width:2.5;stroke-dasharray:64;animation:matu-draw .45s ease forwards}
</style>
<div id="matu-live-badge">MatuAI · construyendo</div>
<div id="matu-live-tray" aria-hidden="true"><span>Btn</span><span>Card</span><span>Hero</span></div>
<div id="matu-live-ghost-chip" aria-hidden="true">bloque</div>
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
  var chip=document.getElementById('matu-live-ghost-chip');
  if(!cursor||!document.body) return;

  var SKIP={SCRIPT:1,STYLE:1,LINK:1,META:1,NOSCRIPT:1,BR:1,HR:1,SVG:1,TITLE:1};
  var LIVE_IDS={
    'matu-live-ui':1,'matu-live-badge':1,'matu-live-cursor':1,
    'matu-live-ripples':1,'matu-live-sketch':1,'matu-live-caret':1,
    'matu-live-script':1,'matu-live-tray':1,'matu-live-ghost-chip':1
  };

  function isLive(el){
    if(!el||el.nodeType!==1) return true;
    if(LIVE_IDS[el.id]) return true;
    return !!(el.closest&&(
      el.closest('#matu-live-badge')||
      el.closest('#matu-live-cursor')||
      el.closest('#matu-live-ripples')||
      el.closest('#matu-live-sketch')||
      el.closest('#matu-live-tray')||
      el.closest('#matu-live-ghost-chip')
    ));
  }

  function labelFor(el){
    var t=(el.tagName||'').toLowerCase();
    if(t==='button'||(el.getAttribute&&el.getAttribute('role')==='button')) return 'Botón';
    if(t==='img') return 'Imagen';
    if(t==='form'||t==='input') return 'Form';
    if(t==='nav'||t==='header') return 'Nav';
    if(t==='footer') return 'Footer';
    if(/^h[1-6]$/.test(t)) return 'Título';
    if(el.className&&/hero|card|btn/i.test(String(el.className))) return 'Bloque';
    return 'Pieza';
  }

  function blocks(){
    var sel='header,nav,main,section,article,footer,aside,h1,h2,h3,.card,.hero,.btn,button,a.button,img,ul,ol,form,table,[class*="card"],[class*="hero"],[class*="btn"]';
    var list=Array.prototype.slice.call(document.body.querySelectorAll(sel));
    var out=[], seen=typeof WeakSet!=='undefined'?new WeakSet():null;
    for(var i=0;i<list.length;i++){
      var el=list[i];
      if(isLive(el)||SKIP[el.tagName]) continue;
      if(seen&&seen.has(el)) continue;
      var r=el.getBoundingClientRect();
      if(r.width<10||r.height<10) continue;
      if(seen) seen.add(el);
      out.push(el);
    }
    if(out.length<2){
      Array.prototype.forEach.call(document.body.children,function(el){
        if(!isLive(el)&&!SKIP[el.tagName]){
          var r2=el.getBoundingClientRect();
          if(r2.width>=10&&r2.height>=10) out.push(el);
        }
      });
    }
    return out;
  }

  function moveCursor(x,y,click){
    cursor.style.left=Math.max(4,x)+'px';
    cursor.style.top=Math.max(4,y)+'px';
    if(click){
      cursor.classList.add('matu-click');
      setTimeout(function(){cursor.classList.remove('matu-click');},140);
      if(ripples){
        var d=document.createElement('div');
        d.className='matu-ripple';
        d.style.left=x+'px';
        d.style.top=y+'px';
        ripples.appendChild(d);
        setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },560);
      }
    }
  }

  function drawBox(el){
    if(!sketch) return;
    var r=el.getBoundingClientRect();
    sketch.setAttribute('width', Math.ceil(r.width+10));
    sketch.setAttribute('height', Math.ceil(r.height+10));
    sketch.style.left=(r.left-5)+'px';
    sketch.style.top=(r.top-5)+'px';
    sketch.innerHTML='<rect x="3" y="3" width="'+(r.width)+'" height="'+(r.height)+'" rx="8"/>';
    setTimeout(function(){ sketch.innerHTML=''; },480);
  }

  function trayPoint(){
    return { x: Math.max(40, window.innerWidth-70), y: 28 };
  }

  var items=blocks();
  var total=items.length;
  if(!total){
    var tp=trayPoint();
    moveCursor(tp.x, tp.y, false);
    if(badge) badge.textContent='MatuAI · esperando piezas';
    return;
  }

  var animateFrom=Math.max(0, total-5);
  for(var i=0;i<animateFrom;i++){
    items[i].classList.remove('matu-ghost','matu-placing');
    items[i].classList.add('matu-placed');
  }
  for(var j=animateFrom;j<total;j++){
    items[j].classList.remove('matu-placed','matu-placing');
    items[j].classList.add('matu-ghost');
  }

  var idx=animateFrom;
  function placeNext(){
    if(idx>=total){
      if(badge) badge.textContent='MatuAI · montando…';
      if(chip) chip.classList.remove('on');
      cursor.classList.remove('matu-carry');
      var last=items[total-1];
      var lr=last.getBoundingClientRect();
      moveCursor(lr.left+Math.min(40,lr.width*0.3), lr.top+Math.min(28,lr.height*0.3), false);
      try{ last.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){}
      return;
    }

    var el=items[idx];
    var r=el.getBoundingClientRect();
    var cx=r.left + Math.min(52, Math.max(18, r.width*0.28));
    var cy=r.top + Math.min(40, Math.max(14, r.height*0.28));
    var from=trayPoint();
    var name=labelFor(el);

    try{ el.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){}

    if(badge) badge.textContent='MatuAI · arrastra '+name;
    cursor.classList.add('matu-carry');
    if(chip){
      chip.textContent=name;
      chip.style.left=from.x+'px';
      chip.style.top=(from.y+22)+'px';
      chip.classList.add('on');
    }
    moveCursor(from.x, from.y, true);

    setTimeout(function(){
      if(chip){
        chip.style.left=cx+'px';
        chip.style.top=cy+'px';
      }
      moveCursor(cx, cy, false);
      drawBox(el);
      setTimeout(function(){
        moveCursor(cx, cy, true);
        cursor.classList.remove('matu-carry');
        if(chip) chip.classList.remove('on');
        el.classList.remove('matu-ghost');
        el.classList.add('matu-placing');
        if(badge) badge.textContent='Pim · pegó '+name;
        idx++;
        setTimeout(placeNext, 110);
      }, 220);
    }, 200);
  }

  var start=trayPoint();
  moveCursor(start.x, start.y, false);
  setTimeout(placeNext, 50);
})();
</script>`;

function buildLiveDoc(code, { streaming = false } = {}) {
  let raw = String(code || '').trim();
  if (!raw) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f9f5f2;color:#8a8278}
</style></head><body><p>Esperando HTML…</p>${streaming ? LIVE_UI : ''}</body></html>`;
  }

  // Solo sanear mientras stream; al terminar usamos el HTML final tal cual.
  if (streaming) {
    raw = healPartialHtml(raw);
  }

  const live = streaming ? LIVE_UI : '';

  if (/<!DOCTYPE/i.test(raw) || /<html[\s>]/i.test(raw)) {
    if (live) {
      if (/<\/body>/i.test(raw)) {
        return raw.replace(/<\/body>/i, `${live}</body>`);
      }
      if (/<\/html>/i.test(raw)) {
        return raw.replace(/<\/html>/i, `${live}</html>`);
      }
      return `${raw}${live}`;
    }
    return raw;
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
        {pim ? 'Pim · pegó' : 'MatuAI · construyendo'}
      </div>
    </div>
  );
}

function slugifyName(name) {
  return (
    String(name || 'app')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'app'
  );
}

/**
 * Panel lateral tipo navegador (solo desktop).
 * Al terminar el stream fuerza un render limpio (sin animación ghost).
 */
export default function LiveHtmlPreview({
  html,
  streaming = false,
  incomplete = false,
  onClose,
  onContinue,
  title = 'Vista previa',
  conversationId = null,
}) {
  const auth = useAuth();
  const isIncomplete = Boolean(incomplete);
  const [mode, setMode] = useState('preview');
  const iframeRef = useRef(null);
  const lastWrittenRef = useRef('');
  const writeTimerRef = useRef(null);
  const blobUrlRef = useRef(null);
  const wasStreamingRef = useRef(streaming);
  const [frameKey, setFrameKey] = useState(0);
  const [doneFlash, setDoneFlash] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [publishedUrl, setPublishedUrl] = useState(null);

  const complete = useMemo(() => {
    if (!html) return false;
    return /<\/html>/i.test(html) && !isIncompleteHtml(html);
  }, [html]);

  const showGenerating = streaming;
  const liveMode = streaming;

  const revokeBlob = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => () => revokeBlob(), []);

  // Durante el stream siempre mostrar el lienzo (preview), no el código.
  useEffect(() => {
    if (streaming) setMode('preview');
  }, [streaming]);

  // Al cortar el stream: remount iframe + HTML limpio final.
  useEffect(() => {
    if (wasStreamingRef.current && !streaming) {
      lastWrittenRef.current = '';
      setFrameKey((k) => k + 1);
      setDoneFlash(true);
      const t = setTimeout(() => setDoneFlash(false), 2800);
      wasStreamingRef.current = streaming;
      return () => clearTimeout(t);
    }
    wasStreamingRef.current = streaming;
    return undefined;
  }, [streaming]);

  useEffect(() => {
    if (mode !== 'preview') return undefined;
    if (!html && !streaming) {
      lastWrittenRef.current = '';
      return undefined;
    }

    // Throttle más largo en live para que la animación de “pegar” se vea.
    const delay = streaming ? 480 : 0;
    clearTimeout(writeTimerRef.current);

    const paint = (attempt = 0) => {
      const docHtml = buildLiveDoc(html || '', { streaming: liveMode });
      const iframe = iframeRef.current;

      if (!iframe) {
        if (attempt < 12) {
          writeTimerRef.current = setTimeout(() => paint(attempt + 1), 32);
        }
        return;
      }

      if (
        docHtml === lastWrittenRef.current &&
        (iframe.getAttribute('srcdoc') ||
          (iframe.src && iframe.src !== 'about:blank'))
      ) {
        return;
      }

      if (!streaming) {
        const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        revokeBlob();
        blobUrlRef.current = url;
        lastWrittenRef.current = docHtml;
        iframe.removeAttribute('srcdoc');
        iframe.src = url;
        return;
      }

      // Live: srcdoc ejecuta scripts de construcción de forma fiable.
      lastWrittenRef.current = docHtml;
      try {
        iframe.removeAttribute('src');
        iframe.srcdoc = docHtml;
        return;
      } catch {
        /* fallback doc.write */
      }
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(docHtml);
          doc.close();
          return;
        }
      } catch {
        /* fallback blob */
      }
      const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      revokeBlob();
      blobUrlRef.current = url;
      iframe.src = url;
    };

    writeTimerRef.current = setTimeout(() => paint(0), delay);

    return () => clearTimeout(writeTimerRef.current);
  }, [html, streaming, liveMode, mode, frameKey]);

  const openPublish = () => {
    setPublishError(null);
    setPublishedUrl(null);
    if (!appName.trim()) {
      const guess =
        /<title[^>]*>([^<]+)<\/title>/i.exec(html || '')?.[1]?.trim() ||
        'Mi app';
      setAppName(guess.slice(0, 60));
    }
    setPublishOpen(true);
  };

  const handlePublish = async () => {
    const token = auth.getToken?.();
    if (!token) {
      setPublishError('Inicia sesión para publicar.');
      return;
    }
    const name = appName.trim();
    if (!name) {
      setPublishError('Pon un nombre a la aplicación.');
      return;
    }
    if (!html?.trim()) {
      setPublishError('No hay HTML para publicar.');
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const data = await api('/api/sites', {
        token,
        method: 'POST',
        body: {
          name,
          slug: slugifyName(name),
          html,
          conversation_id: conversationId || undefined,
        },
      });
      const url = data?.site?.url || data?.url;
      if (!url) throw new Error('No se recibió URL pública');
      setPublishedUrl(url);
    } catch (err) {
      setPublishError(err.message || 'No se pudo publicar');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <aside className="hidden h-full min-h-0 w-[min(52%,720px)] shrink-0 flex-col border-l-[2.5px] border-black bg-[#f9f5f2] lg:flex">
      <div className="flex shrink-0 items-center gap-2 border-b-[2.5px] border-black bg-[#8584bd] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#c94245]" />
          <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#f4ed36]" />
          <span className="h-2.5 w-2.5 rounded-full border border-black/30 bg-[#b5c995]" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-full border border-black/20 bg-white/90 px-3 py-1 text-[11px] font-medium text-black/70">
          {showGenerating
            ? 'matu://diseñando…'
            : publishedUrl
              ? publishedUrl.replace(/^https?:\/\//, '')
              : title}
        </div>
        {!streaming && html ? (
          <button
            type="button"
            className="hidden h-7 shrink-0 items-center rounded-[6px] border-2 border-black bg-[#f4ed36] px-2 text-[10px] font-bold uppercase tracking-wide hover:bg-white sm:inline-flex"
            onClick={openPublish}
            title="Publicar en ai.matubyte.com"
          >
            Publicar
          </button>
        ) : null}
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
          onClick={() => {
            lastWrittenRef.current = '';
            setFrameKey((k) => k + 1);
            setMode('preview');
          }}
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
          Live · MatuAI armando la página
        </div>
      ) : null}

      {doneFlash && !streaming ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-black/15 bg-[#b5c995] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-black">
          Listo · vista final
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

      {publishedUrl ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/15 bg-white px-3 py-2">
          <a
            href={publishedUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-[12px] font-medium text-black underline"
          >
            {publishedUrl}
          </a>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full border-2 border-black bg-[#f4ed36] px-2.5 py-1 text-[10px] font-bold uppercase"
          >
            Abrir
          </a>
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
              key={frameKey}
              ref={iframeRef}
              title="Vista previa HTML en vivo"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              className="h-full w-full border-0 bg-white"
            />
            <DesignerOverlay html={html} streaming={streaming} />          </>
        )}

        {publishOpen ? (
          <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Publicar aplicación"
              className="w-full max-w-md rounded-2xl border-2 border-black bg-[#f9f5f2] p-4 shadow-[4px_4px_0_#000]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold">Publicar en producción</h3>
                  <p className="mt-0.5 text-[12px] text-black/60">
                    Queda en{' '}
                    <span className="font-mono">ai.matubyte.com/sites/…</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-2 border-black bg-white"
                  onClick={() => setPublishOpen(false)}
                  aria-label="Cerrar"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="block text-[12px] font-bold uppercase tracking-wide">
                Nombre de la app
                <input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="mt-1 w-full rounded-[8px] border-2 border-black bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal outline-none focus:bg-[#f4ed36]/40"
                  placeholder="BibliKids"
                  maxLength={60}
                  autoFocus
                />
              </label>
              <p className="mt-1.5 font-mono text-[11px] text-black/50">
                /sites/{slugifyName(appName || 'app')}
              </p>
              {publishError ? (
                <p className="mt-2 text-[12px] font-medium text-[#c94245]">
                  {publishError}
                </p>
              ) : null}
              {publishedUrl ? (
                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-[13px] font-medium underline"
                  >
                    {publishedUrl}
                  </a>
                  <button
                    type="button"
                    className="rounded-[8px] border-2 border-black bg-[#f4ed36] px-3 py-2 text-[13px] font-bold"
                    onClick={() => {
                      window.open(publishedUrl, '_blank', 'noopener,noreferrer');
                      setPublishOpen(false);
                    }}
                  >
                    Abrir sitio publicado
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={publishing || !complete}
                  className="mt-3 w-full rounded-[8px] border-2 border-black bg-[#f4ed36] px-3 py-2.5 text-[13px] font-bold disabled:opacity-50"
                  onClick={handlePublish}
                >
                  {publishing
                    ? 'Publicando…'
                    : complete
                      ? 'Publicar ahora'
                      : 'HTML incompleto'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
