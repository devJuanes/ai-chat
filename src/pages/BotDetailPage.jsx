import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import {
  BotIcon,
  MenuIcon,
  PencilIcon,
  WhatsAppIcon,
  InstagramIcon,
  FacebookIcon,
} from '../components/Icons';

const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  messenger: 'Facebook',
  instagram: 'Instagram',
};

const CHANNEL_ICON = {
  whatsapp: { Icon: WhatsAppIcon, color: '#25D366' },
  instagram: { Icon: InstagramIcon, color: '#E4405F' },
  messenger: { Icon: FacebookIcon, color: '#1877F2' },
};

function ChannelMark({ channel }) {
  const meta = CHANNEL_ICON[channel];
  if (!meta) return null;
  const { Icon, color } = meta;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/25 px-2 py-0.5">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <span className="fp-mono text-[10px] uppercase">
        {CHANNEL_LABEL[channel] || channel}
      </span>
    </span>
  );
}

function buildFlow(bot, hasForm) {
  const steps = [
    {
      id: 'in',
      title: 'Llega el mensaje',
      detail: 'Cliente escribe por WhatsApp, Instagram o Facebook.',
    },
    {
      id: 'greet',
      title: 'Saluda y entiende',
      detail: bot.welcome_message
        ? bot.welcome_message
        : 'Responde de forma natural y capta la intención.',
    },
    {
      id: 'goal',
      title: 'Persigue el objetivo',
      detail: bot.objective || 'Ayuda al cliente según su misión.',
    },
  ];
  if (hasForm) {
    steps.push({
      id: 'form',
      title: 'Pide los datos',
      detail: 'Recoge la información del formulario asignado.',
    });
  }
  steps.push({
    id: 'act',
    title: 'Responde o deriva',
    detail: bot.handoff_keywords
      ? `Si pide humano (${bot.handoff_keywords.split(',').slice(0, 3).join(', ')}…), pasa el chat.`
      : 'Cierra la duda o pasa a un asesor humano.',
  });
  return steps;
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function BotDetailPage() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};
  const auth = useAuth();
  const token = auth.getToken?.();

  const [bot, setBot] = useState(null);
  const [bindings, setBindings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [formName, setFormName] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveStep, setLiveStep] = useState(0);
  const [pulse, setPulse] = useState(true);

  const load = useCallback(async () => {
    if (!token || !botId) return;
    setError(null);
    try {
      const [botRes, statsRes, connRes, formsRes] = await Promise.all([
        api(`/api/bots/${botId}`, { token }),
        api(`/api/bots/${botId}/stats`, { token }),
        api('/api/meta/connections', { token }),
        api('/api/lead-forms', { token }).catch(() => ({ forms: [] })),
      ]);
      setBot(botRes.bot);
      setBindings(botRes.bindings || []);
      setStats(statsRes.stats);
      setRecent(statsRes.recent || []);
      setConnections(connRes.connections || []);
      const form = (formsRes.forms || []).find(
        (f) => f.id === botRes.bot?.form_id
      );
      setFormName(form?.name || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, botId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !botId) return undefined;
    const t = setInterval(() => {
      api(`/api/bots/${botId}/stats`, { token })
        .then((statsRes) => {
          setStats(statsRes.stats);
          setRecent(statsRes.recent || []);
          setPulse(Boolean(statsRes.stats?.active_bot));
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [token, botId]);

  const flow = useMemo(
    () => (bot ? buildFlow(bot, Boolean(bot.form_id)) : []),
    [bot]
  );

  useEffect(() => {
    if (!flow.length) return undefined;
    const t = setInterval(() => {
      setLiveStep((s) => (s + 1) % flow.length);
    }, pulse ? 1600 : 2800);
    return () => clearInterval(t);
  }, [flow.length, pulse]);

  const connById = useMemo(
    () => Object.fromEntries(connections.map((c) => [c.id, c])),
    [connections]
  );

  const channels = bindings
    .map((b) => connById[b.meta_connection_id])
    .filter(Boolean);

  if (loading) {
    return (
      <main className="fp-page flex h-dvh items-center justify-center">
        <p className="text-[16px] opacity-50">Cargando agente…</p>
      </main>
    );
  }

  if (error || !bot) {
    return (
      <main className="fp-page flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[18px] font-semibold">
          {error || 'No encontramos este agente'}
        </p>
        <Link
          to="/bots/agentes"
          className="rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[13px] font-medium"
        >
          Volver a agentes
        </Link>
      </main>
    );
  }

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[56px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <Link
          to="/bots/agentes"
          className="fp-mono text-[11px] underline opacity-70"
        >
          ← Agentes
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BotIcon />
          <div className="min-w-0 truncate font-semibold">{bot.name}</div>
          {bot.company_name ? (
            <span className="hidden truncate text-[12px] opacity-50 sm:inline">
              · {bot.company_name}
            </span>
          ) : null}
        </div>
        <span
          className={`rounded-full border-2 border-black px-2.5 py-0.5 text-[11px] font-medium ${
            bot.active !== false
              ? 'bg-[#22c55e] text-white'
              : 'bg-[#ef4444] text-white'
          }`}
        >
          {bot.active !== false ? 'Activo' : 'Apagado'}
        </span>
        <button
          type="button"
          className="fp-btn inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] font-medium"
          onClick={() =>
            navigate(`/bots/agentes?edit=${encodeURIComponent(bot.id)}`)
          }
        >
          <PencilIcon className="h-4 w-4" />
          Editar
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Live robot / activity */}
          <section className="rounded-2xl border-2 border-black bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold">En vivo</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border border-black/20 px-2 py-0.5 text-[11px] ${
                  pulse ? 'bg-[#22c55e]/15' : 'bg-black/5'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    pulse ? 'animate-pulse bg-[#22c55e]' : 'bg-black/30'
                  }`}
                />
                {pulse ? 'Respondiendo chats' : 'En espera'}
              </span>
            </div>

            <div className="relative mx-auto mb-5 flex h-36 w-36 items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full border-2 border-black ${
                  pulse ? 'animate-ping opacity-20' : 'opacity-0'
                }`}
                style={{ animationDuration: '2s' }}
              />
              <div
                className={`absolute inset-3 rounded-full border-2 border-dashed border-black/30 ${
                  pulse ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '8s' }}
              />
              <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-black bg-[#f4ed36] shadow-[4px_4px_0_#000]">
                <BotIcon className="h-10 w-10" />
                <span className="mt-1 fp-mono text-[9px] uppercase opacity-60">
                  {bot.name.slice(0, 10)}
                </span>
              </div>
            </div>

            <p className="text-center text-[13px] opacity-70">
              Ahora:{' '}
              <strong className="text-black">
                {flow[liveStep]?.title || '—'}
              </strong>
            </p>
            <p className="mt-1 text-center text-[12px] opacity-50">
              {flow[liveStep]?.detail}
            </p>
          </section>

          {/* Stats */}
          <section className="rounded-2xl border-2 border-black bg-[#faf8f5] p-5">
            <h2 className="mb-4 text-[16px] font-semibold">Resultados</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Conversaciones', stats?.conversations ?? 0],
                ['Respuestas enviadas', stats?.replies ?? 0],
                ['Mensajes recibidos', stats?.inbound ?? 0],
                ['Con humano', stats?.active_human ?? 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border-2 border-black bg-white px-3 py-3"
                >
                  <div className="text-[22px] font-semibold tracking-tight">
                    {value}
                  </div>
                  <div className="fp-mono text-[10px] uppercase opacity-50">
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="fp-mono mb-2 text-[10px] uppercase opacity-50">
                Canales
              </div>
              <div className="flex flex-wrap gap-1.5">
                {channels.length === 0 ? (
                  <span className="text-[12px] opacity-50">Sin canales</span>
                ) : (
                  channels.map((c) => (
                    <ChannelMark key={c.id} channel={c.channel} />
                  ))
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="fp-mono mb-1 text-[10px] uppercase opacity-50">
                Modelo
              </div>
              <p className="text-[14px] font-medium">
                {bot.model_id === 'matu-bot-3-5'
                  ? 'MatuBot 3.5'
                  : bot.model_id || 'MatuBot'}
              </p>
            </div>
          </section>

          {/* Flow */}
          <section className="rounded-2xl border-2 border-black bg-white p-5 lg:col-span-2">
            <h2 className="mb-1 text-[16px] font-semibold">
              Cómo trabaja este agente
            </h2>
            <p className="mb-5 text-[13px] opacity-60">
              Flujo que sigue en cada conversación (paso a paso).
            </p>
            <ol className="relative flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-2">
              {flow.map((step, i) => {
                const active = i === liveStep;
                return (
                  <li
                    key={step.id}
                    className="relative flex flex-1 flex-col sm:min-w-0"
                  >
                    <div
                      className={`flex flex-1 flex-col rounded-xl border-2 border-black px-3 py-3 transition ${
                        active
                          ? 'bg-[#f4ed36] shadow-[3px_3px_0_#000]'
                          : 'bg-[#faf8f5]'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-black text-[11px] font-semibold ${
                            active ? 'bg-black text-[#f4ed36]' : 'bg-white'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[13px] font-semibold">
                          {step.title}
                        </span>
                      </div>
                      <p className="text-[12px] leading-snug opacity-70">
                        {step.detail}
                      </p>
                    </div>
                    {i < flow.length - 1 ? (
                      <div
                        className="mx-auto my-1 h-4 w-0.5 bg-black/30 sm:absolute sm:right-0 sm:top-1/2 sm:my-0 sm:h-0.5 sm:w-2 sm:translate-x-full sm:-translate-y-1/2"
                        aria-hidden
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Personality / brief (user-friendly, not "system prompt") */}
          <section className="rounded-2xl border-2 border-black bg-[#faf8f5] p-5 lg:col-span-2">
            <h2 className="mb-1 text-[16px] font-semibold">
              Personalidad y guion
            </h2>
            <p className="mb-4 text-[13px] opacity-60">
              Cómo habla y qué tiene en cuenta (sin jerga técnica).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-black bg-white px-3 py-3">
                <div className="fp-mono mb-1 text-[10px] uppercase opacity-50">
                  Objetivo
                </div>
                <p className="text-[13px] leading-relaxed">
                  {bot.objective || 'Sin objetivo definido.'}
                </p>
              </div>
              <div className="rounded-xl border-2 border-black bg-white px-3 py-3">
                <div className="fp-mono mb-1 text-[10px] uppercase opacity-50">
                  Tono
                </div>
                <p className="text-[13px] leading-relaxed">
                  {bot.tone || 'Profesional y cercano'}
                </p>
              </div>
              <div className="rounded-xl border-2 border-black bg-white px-3 py-3 sm:col-span-2">
                <div className="fp-mono mb-1 text-[10px] uppercase opacity-50">
                  Instrucciones de trabajo
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                  {bot.instructions || 'Sin instrucciones extra.'}
                </p>
              </div>
              {bot.business_context ? (
                <div className="rounded-xl border-2 border-black bg-white px-3 py-3 sm:col-span-2">
                  <div className="fp-mono mb-1 text-[10px] uppercase opacity-50">
                    Contexto del negocio
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                    {bot.business_context}
                  </p>
                </div>
              ) : null}
              {formName ? (
                <div className="rounded-xl border-2 border-black bg-white px-3 py-3">
                  <div className="fp-mono mb-1 text-[10px] uppercase opacity-50">
                    Formulario de leads
                  </div>
                  <p className="text-[13px] font-medium">{formName}</p>
                </div>
              ) : null}
            </div>
          </section>

          {/* Recent chats */}
          <section className="rounded-2xl border-2 border-black bg-white p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold">Chats recientes</h2>
              <Link
                to="/inbox"
                className="fp-mono text-[11px] underline opacity-70"
              >
                Ir al inbox
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-[14px] opacity-50">
                Todavía no hay conversaciones con este agente.
              </p>
            ) : (
              <ul className="divide-y divide-black/10">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/inbox/${c.id}`}
                      className="flex items-start gap-3 py-3 transition hover:bg-[#faf8f5]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium">
                          {c.title || 'Chat'}
                        </div>
                        <div className="truncate text-[12px] opacity-60">
                          {c.preview || '—'}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="fp-mono text-[10px] uppercase opacity-40">
                          {c.assignee === 'human' ? 'humano' : 'bot'}
                        </div>
                        <div className="text-[10px] opacity-40">
                          {formatTime(c.updated_at)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
