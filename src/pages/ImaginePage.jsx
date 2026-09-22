import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { FilmIcon, MenuIcon, PlayIcon } from '../components/Icons';

const ASPECTS = [
  { id: '9:16', label: 'Vertical 9:16' },
  { id: '16:9', label: 'Horizontal 16:9' },
  { id: '1:1', label: 'Cuadrado 1:1' },
];

const SOURCES = [
  { id: 'pexels', label: 'Pexels' },
  { id: 'pixabay', label: 'Pixabay' },
  { id: 'local', label: 'Local' },
];

const VOICES = [
  { id: 'es-ES-ElviraNeural-Female', label: 'Español (ES) · Elvira' },
  { id: 'es-ES-AlvaroNeural-Male', label: 'Español (ES) · Álvaro' },
  { id: 'es-MX-DaliaNeural-Female', label: 'Español (MX) · Dalia' },
  { id: 'es-MX-JorgeNeural-Male', label: 'Español (MX) · Jorge' },
  { id: 'en-US-JennyNeural-Female', label: 'English (US) · Jenny' },
  { id: 'en-US-GuyNeural-Male', label: 'English (US) · Guy' },
];

const STATE = {
  4: { label: 'Procesando…', tone: 'bg-[#f4ed36]' },
  1: { label: 'Listo', tone: 'bg-[#b5c995]' },
  [-1]: { label: 'Falló', tone: 'bg-[#f8c1ba]' },
};

const IDEAS = [
  'Cómo la IA cambia el día a día de un freelancer',
  '3 tips para lanzar una tienda online esta semana',
  'Historia de una marca colombiana en 60 segundos',
];

export default function ImaginePage() {
  const { onToggleSidebar } = useOutletContext() || {};
  const auth = useAuth();
  const token = auth.getToken?.();

  const [subject, setSubject] = useState('');
  const [script, setScript] = useState('');
  const [aspect, setAspect] = useState('9:16');
  const [source, setSource] = useState('pexels');
  const [voice, setVoice] = useState('es-ES-ElviraNeural-Female');
  const [subtitles, setSubtitles] = useState(true);

  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [task, setTask] = useState(null);
  const pollRef = useRef(null);
  const pollInFlight = useRef(false);
  const pollFails = useRef(0);

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api('/api/imagine/status', { token });
      setStatus(data);
    } catch (err) {
      setStatus({ ok: false, error: err.message });
    }
  }, [token]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollTask = useCallback(
    (taskId) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollFails.current = 0;
      pollInFlight.current = false;

      const tick = async () => {
        if (pollInFlight.current) return;
        pollInFlight.current = true;
        try {
          const data = await api(`/api/imagine/tasks/${taskId}`, { token });
          const t = data.task;
          pollFails.current = 0;
          setError(null);
          setTask(t);
          if (t.state === 1 || t.state === -1) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setBusy(false);
            if (t.state === -1) {
              setError(t.error || 'La generación falló');
            }
          }
        } catch (err) {
          pollFails.current += 1;
          // MPT se satura al renderizar: un fallo puntual no debe matar el poll.
          if (pollFails.current >= 8) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setBusy(false);
            setError(
              err.message ||
                'Se perdió la conexión con MoneyPrinterTurbo tras varios intentos.'
            );
          }
        } finally {
          pollInFlight.current = false;
        }
      };

      tick();
      pollRef.current = setInterval(tick, 4000);
    },
    [token]
  );

  const onCreate = async (e) => {
    e?.preventDefault?.();
    const topic = subject.trim();
    if (!topic || busy) return;
    setError(null);
    setTask(null);
    setBusy(true);
    try {
      const data = await api('/api/imagine/videos', {
        token,
        method: 'POST',
        body: {
          video_subject: topic,
          video_script: script.trim(),
          video_aspect: aspect,
          video_source: source,
          video_language: 'es-ES',
          voice_name: voice,
          subtitle_enabled: subtitles,
        },
      });
      const created = data.task;
      setTask({
        task_id: created.task_id,
        state: 4,
        progress: 0,
        videos: [],
      });
      pollTask(created.task_id);
    } catch (err) {
      setBusy(false);
      setError(err.message);
    }
  };

  const stateMeta = STATE[task?.state] || STATE[4];
  const videoUrl = task?.videos?.[0] || null;
  const progressPct = Math.max(
    0,
    Math.min(100, Number(task?.progress) || 0)
  );

  return (
    <div className="fp-page flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-3 sm:px-6">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black bg-[#8584bd] text-[#f4ed36]">
            <FilmIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-bold tracking-tight sm:text-[18px]">
              Imagine
            </h1>
            <p className="truncate text-[12px] font-medium text-black/50">
              Crea videos con MoneyPrinterTurbo
            </p>
          </div>
        </div>
        <button
          type="button"
          className="hidden h-8 items-center rounded-full border-2 border-black bg-white px-3 text-[11px] font-bold sm:inline-flex hover:bg-[#f4ed36]"
          onClick={refreshStatus}
        >
          {status?.ok ? 'API · online' : 'API · comprobar'}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={onCreate}
            className="flex flex-col gap-3 rounded-[6px] border-2 border-black bg-[#f9f5f2] p-4 shadow-[3px_3px_0_#000] sm:p-5"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-black/55">
                Tema del video
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej. Cómo vender ropa online en 60 segundos"
                className="rounded-[6px] border-2 border-black bg-white px-3 py-2.5 text-[15px] outline-none focus:shadow-[3px_3px_0_#f4ed36]"
                disabled={busy}
              />
            </label>

            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  disabled={busy}
                  className="rounded-full border-2 border-black bg-white px-2.5 py-1 text-left text-[11px] font-medium hover:bg-[#f4ed36] disabled:opacity-50"
                  onClick={() => setSubject(idea)}
                >
                  {idea}
                </button>
              ))}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-black/55">
                Guion (opcional)
              </span>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={5}
                placeholder="Si lo dejas vacío, MoneyPrinterTurbo genera el guion desde el tema."
                className="resize-y rounded-[6px] border-2 border-black bg-white px-3 py-2.5 text-[14px] outline-none focus:shadow-[3px_3px_0_#f4ed36]"
                disabled={busy}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-black/55">
                  Formato
                </span>
                <select
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                  className="rounded-[6px] border-2 border-black bg-white px-3 py-2 text-[14px] font-medium"
                  disabled={busy}
                >
                  {ASPECTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-black/55">
                  Material
                </span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="rounded-[6px] border-2 border-black bg-white px-3 py-2 text-[14px] font-medium"
                  disabled={busy}
                >
                  {SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-black/55">
                  Voz (TTS)
                </span>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="rounded-[6px] border-2 border-black bg-white px-3 py-2 text-[14px] font-medium"
                  disabled={busy}
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-[13px] font-medium">
              <input
                type="checkbox"
                checked={subtitles}
                onChange={(e) => setSubtitles(e.target.checked)}
                disabled={busy}
                className="h-4 w-4 accent-black"
              />
              Subtítulos
            </label>

            {status && !status.ok ? (
              <p className="rounded-[6px] border-2 border-black bg-[#f8c1ba] px-3 py-2 text-[12px] font-medium">
                {status.error ||
                  `API offline en ${status.baseUrl || 'MoneyPrinterTurbo'}. Arranca la API en el puerto 8080.`}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-[6px] border-2 border-black bg-[#f8c1ba] px-3 py-2 text-[12px] font-medium">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !subject.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-black bg-[#f4ed36] px-4 text-[14px] font-bold enabled:hover:bg-[#f9cc73] enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PlayIcon className="h-4 w-4" />
              {busy ? 'Generando…' : 'Crear video'}
            </button>
          </form>

          <aside className="flex min-h-[280px] flex-col rounded-[6px] border-2 border-black bg-white p-4 shadow-[3px_3px_0_#000] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold">Resultado</h2>
              {task ? (
                <span
                  className={`rounded-full border-2 border-black px-2.5 py-0.5 text-[10px] font-bold uppercase ${stateMeta.tone}`}
                >
                  {stateMeta.label}
                  {task.state === 4 && task.progress != null
                    ? ` · ${task.progress}%`
                    : ''}
                </span>
              ) : null}
            </div>

            {!task ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-[13px] text-black/45">
                <FilmIcon className="h-8 w-8 opacity-40" />
                <p>Escribe un tema y pulsa Crear video.</p>
                <p className="text-[11px]">
                  Powered by MoneyPrinterTurbo · Imagine
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                {task.task_id ? (
                  <p className="font-mono text-[11px] text-black/45">
                    task · {task.task_id}
                  </p>
                ) : null}

                {videoUrl ? (
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    playsInline
                    className="w-full rounded-[6px] border-2 border-black bg-black"
                  />
                ) : task.state === 4 ? (
                  <div
                    className="imagine-wave-box relative flex min-h-[220px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[6px] border-2 border-black bg-[#f9f5f2]"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progreso ${progressPct}%`}
                  >
                    <div
                      className="imagine-wave-fill absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
                      style={{ height: `${progressPct}%` }}
                      aria-hidden
                    >
                      <div className="imagine-wave imagine-wave--back" />
                      <div className="imagine-wave imagine-wave--front" />
                    </div>
                    <div className="relative z-[1] flex flex-col items-center gap-1.5 px-4 text-center">
                      <p
                        className={`text-[13px] font-medium transition-colors duration-300 ${
                          progressPct >= 55 ? 'text-white' : 'text-black/55'
                        }`}
                      >
                        Armando el video…
                      </p>
                      <p
                        className={`text-[28px] font-bold tabular-nums tracking-tight transition-colors duration-300 ${
                          progressPct >= 55 ? 'text-white' : 'text-black'
                        }`}
                      >
                        {progressPct}%
                      </p>
                      <p
                        className={`text-[11px] font-medium transition-colors duration-300 ${
                          progressPct >= 55 ? 'text-white/80' : 'text-black/40'
                        }`}
                      >
                        {progressPct < 30
                          ? 'Guion y voz…'
                          : progressPct < 70
                            ? 'Material y clips…'
                            : 'Montaje final…'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[6px] border-2 border-black bg-[#f8c1ba] px-3 py-3 text-[13px] font-medium">
                    {task.error || 'No hay video disponible'}
                  </div>
                )}

                {videoUrl ? (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-full border-2 border-black bg-[#f4ed36] px-3 text-[12px] font-bold"
                  >
                    Abrir / descargar
                  </a>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
