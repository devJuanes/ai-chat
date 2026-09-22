import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  WhatsAppIcon,
  InstagramIcon,
  FacebookIcon,
} from '../../components/Icons';

const CHANNEL_ICON = {
  whatsapp: { Icon: WhatsAppIcon, color: '#25D366' },
  instagram: { Icon: InstagramIcon, color: '#E4405F' },
  messenger: { Icon: FacebookIcon, color: '#1877F2' },
};

const NOTE_COLORS = [
  '#fff9e6',
  '#ffe8d6',
  '#e8f4ff',
  '#f0ffe8',
  '#fce8ff',
  '#fff0f0',
];

const TYPE_LABEL = {
  sentiment: 'Sentimiento',
  meeting: 'Reunión',
  objection: 'Objeción',
  win: 'Ganado',
  lost: 'Perdido',
  handoff: 'Escalado',
  interest: 'Interés',
  custom: 'Nota',
};

const STAGE_LABEL = {
  nuevo: 'Nuevo',
  interesado: 'Interesado',
  en_duda: 'En duda',
  cita: 'Cita',
  cerrar: 'Por cerrar',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

const CHART_PALETTE = [
  '#f4ed36',
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#a855f7',
  '#ef4444',
  '#14b8a6',
  '#64748b',
];

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Hace ${d} día${d === 1 ? '' : 's'}`;
}

function ChannelMark({ channel }) {
  const meta = CHANNEL_ICON[channel];
  if (!meta) return null;
  const { Icon, color } = meta;
  return <Icon className="h-3.5 w-3.5" style={{ color }} />;
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border-2 border-black bg-white p-4">
      <h3 className="mb-3 text-[14px] font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 180;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path =
      d.value <= 0
        ? ''
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...d, path, color: CHART_PALETTE[i % CHART_PALETTE.length] };
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#faf8f5" stroke="#000" strokeWidth="2" />
        {slices.map((s) =>
          s.path ? (
            <path
              key={s.label}
              d={s.path}
              fill={s.color}
              stroke="#000"
              strokeWidth="1.5"
            />
          ) : null
        )}
        <circle cx={cx} cy={cy} r={28} fill="#faf8f5" stroke="#000" strokeWidth="2" />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-black"
          style={{ fontSize: 14, fontWeight: 700 }}
        >
          {total}
        </text>
      </svg>
      <ul className="flex min-w-[140px] flex-col gap-1.5 text-[12px]">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm border border-black"
              style={{ background: s.color }}
            />
            <span className="flex-1">{s.label}</span>
            <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChartVertical({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = Math.max(280, data.length * 48);
  const h = 160;
  const pad = 28;
  const barW = Math.min(36, (w - pad * 2) / data.length - 8);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 36}`} className="max-w-full">
      <line
        x1={pad}
        y1={h}
        x2={w - 8}
        y2={h}
        stroke="#000"
        strokeWidth="2"
      />
      {data.map((d, i) => {
        const bh = (d.value / max) * (h - 16);
        const x = pad + i * ((w - pad - 8) / data.length) + 4;
        const y = h - bh;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(bh, d.value ? 2 : 0)}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              stroke="#000"
              strokeWidth="1.5"
              rx="4"
            />
            <text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {d.value}
            </text>
            <text
              x={x + barW / 2}
              y={h + 14}
              textAnchor="middle"
              style={{ fontSize: 9 }}
            >
              {d.short || d.label.slice(0, 6)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BarChartHorizontal({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = 28;
  const h = data.length * rowH + 8;
  const w = 320;
  const labelW = 88;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="max-w-full">
      {data.map((d, i) => {
        const bw = ((w - labelW - 40) * d.value) / max;
        const y = i * rowH + 4;
        return (
          <g key={d.label}>
            <text
              x={0}
              y={y + 14}
              style={{ fontSize: 11 }}
              className="fill-black"
            >
              {d.label}
            </text>
            <rect
              x={labelW}
              y={y}
              width={Math.max(bw, d.value ? 4 : 0)}
              height={18}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              stroke="#000"
              strokeWidth="1.5"
              rx="4"
            />
            <text
              x={labelW + Math.max(bw, 0) + 6}
              y={y + 13}
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TimelineChart({ data }) {
  if (!data?.length) {
    return <p className="text-[13px] opacity-50">Sin datos en el periodo.</p>;
  }
  const max = Math.max(
    ...data.map((d) => Math.max(d.conversations || 0, d.notes || 0)),
    1
  );
  const w = Math.max(360, data.length * 36);
  const h = 160;
  const pad = { l: 28, r: 12, t: 16, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const points = (key) =>
    data
      .map((d, i) => {
        const x = pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
        const y = pad.t + innerH - ((d[key] || 0) / max) * innerH;
        return `${x},${y}`;
      })
      .join(' ');

  const area = (key) => {
    const pts = data.map((d, i) => {
      const x = pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = pad.t + innerH - ((d[key] || 0) / max) * innerH;
      return [x, y];
    });
    if (!pts.length) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `M ${first[0]} ${pad.t + innerH} L ${pts
      .map((p) => p.join(' '))
      .join(' L ')} L ${last[0]} ${pad.t + innerH} Z`;
  };

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={pad.l}
              y1={y}
              x2={w - pad.r}
              y2={y}
              stroke="#000"
              strokeOpacity="0.12"
              strokeWidth="1"
            />
          );
        })}
        <path d={area('conversations')} fill="#f4ed36" fillOpacity="0.35" />
        <polyline
          points={points('conversations')}
          fill="none"
          stroke="#000"
          strokeWidth="2.5"
        />
        <polyline
          points={points('notes')}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        {data.map((d, i) => {
          const x = pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
          const show =
            data.length <= 8 || i % Math.ceil(data.length / 7) === 0;
          return show ? (
            <text
              key={d.date}
              x={x}
              y={h - 8}
              textAnchor="middle"
              style={{ fontSize: 9 }}
            >
              {String(d.date).slice(5)}
            </text>
          ) : null;
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-black" /> Chats
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-[#22c55e]" />{' '}
          Notas
        </span>
      </div>
    </div>
  );
}

function MetricsView({ metrics }) {
  const funnelData = useMemo(() => {
    const f = metrics?.funnel || {};
    return [
      { label: 'Escribieron', value: f.wrote || 0 },
      { label: 'Interesados', value: f.interested || 0 },
      { label: 'En duda', value: f.unsure || 0 },
      { label: 'Sin interés', value: f.not_interested || 0 },
      { label: 'Ganados', value: f.won || 0 },
    ];
  }, [metrics]);

  const stageData = useMemo(() => {
    const by = metrics?.by_stage || {};
    return Object.entries(STAGE_LABEL).map(([id, label]) => ({
      label,
      short: label.slice(0, 5),
      value: by[id] || 0,
    }));
  }, [metrics]);

  const noteTypeData = useMemo(() => {
    const by = metrics?.by_note_type || {};
    const entries = Object.entries(by);
    if (!entries.length) {
      return [{ label: 'Sin notas', value: 0 }];
    }
    return entries.map(([k, v]) => ({
      label: TYPE_LABEL[k] || k,
      value: v,
    }));
  }, [metrics]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-2">
        {[
          ['Chats', metrics?.conversations ?? 0],
          ['Ganados', metrics?.funnel?.won ?? 0],
          ['Críticos', metrics?.notes?.critical ?? 0],
          ['Reuniones', metrics?.notes?.meetings ?? 0],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border-2 border-black bg-[#faf8f5] px-3 py-3"
          >
            <div className="text-[24px] font-semibold tracking-tight">
              {value}
            </div>
            <div className="fp-mono text-[10px] uppercase opacity-50">
              {label}
            </div>
          </div>
        ))}
      </div>

      <ChartCard title="Línea de tiempo">
        <TimelineChart data={metrics?.timeline || []} />
      </ChartCard>

      <ChartCard title="Embudo (pastel)">
        <PieChart data={funnelData.filter((d) => d.value > 0).length ? funnelData : [{ label: 'Sin datos', value: 1 }]} />
      </ChartCard>

      <ChartCard title="Pipeline (barras verticales)">
        <BarChartVertical data={stageData} />
      </ChartCard>

      <ChartCard title="Tipos de nota (barras horizontales)">
        <BarChartHorizontal data={noteTypeData} />
      </ChartCard>
    </div>
  );
}

export default function NotesPanel({ token, onError }) {
  const [notes, setNotes] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [range, setRange] = useState('today');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('notas');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ range });
      if (typeFilter) q.set('type', typeFilter);
      const [notesRes, metricsRes] = await Promise.all([
        api(`/api/conversation-notes?${q}`, { token }),
        api(`/api/bots-metrics?range=${range}`, { token }),
      ]);
      setNotes(notesRes.notes || []);
      setMetrics(metricsRes);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, range, typeFilter, onError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[18px] font-semibold tracking-tight">Notas</h2>
        <p className="text-[13px] opacity-70">
          Apuntes que crea el agente y métricas del embudo.
        </p>
      </div>

      <div className="mb-4 inline-flex rounded-full border-2 border-black bg-white p-0.5">
        {[
          ['notas', 'Notas'],
          ['metricas', 'Métricas'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition ${
              subTab === id ? 'bg-black text-[#f4ed36]' : 'hover:bg-black/5'
            }`}
            onClick={() => setSubTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ['today', 'Hoy'],
          ['week', 'Semana'],
          ['month', 'Mes'],
          ['all', 'Todo'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-lg border-2 border-black px-2.5 py-1 text-[12px] ${
              range === id ? 'bg-[#f4ed36]' : 'bg-white'
            }`}
            onClick={() => setRange(id)}
          >
            {label}
          </button>
        ))}
        {subTab === 'notas' ? (
          <select
            className="rounded-lg border-2 border-black bg-white px-2 py-1 text-[12px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {subTab === 'metricas' ? (
        loading || !metrics ? (
          <p className="text-[14px] opacity-50">Cargando métricas…</p>
        ) : (
          <MetricsView metrics={metrics} />
        )
      ) : loading ? (
        <p className="text-[14px] opacity-50">Cargando notas…</p>
      ) : notes.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-[22px] font-semibold">Aún no hay notas</p>
          <p className="mt-2 max-w-md text-[14px] opacity-55">
            El agente las crea solo cuando detecta sentimiento, citas o interés.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n, i) => {
            const bg = NOTE_COLORS[i % NOTE_COLORS.length];
            const initials = (n.contact_name || 'CL')
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={n.id}>
                <div
                  className="relative flex min-h-[160px] flex-col rounded-sm border border-black/10 px-4 pb-3 pt-5 shadow-[3px_4px_12px_rgba(0,0,0,0.08)]"
                  style={{
                    background: bg,
                    transform:
                      i % 3 === 1
                        ? 'rotate(0.6deg)'
                        : i % 3 === 2
                          ? 'rotate(-0.5deg)'
                          : 'none',
                  }}
                >
                  <div
                    className="absolute left-1/2 top-0 h-3 w-12 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#7eb6d9]/70 shadow-sm"
                    aria-hidden
                  />
                  <div className="mb-1 flex items-center gap-2">
                    <span className="fp-mono text-[9px] uppercase opacity-50">
                      {TYPE_LABEL[n.note_type] || n.note_type}
                    </span>
                    {n.channel ? <ChannelMark channel={n.channel} /> : null}
                    {n.sentiment === 'critical' ? (
                      <span className="rounded bg-[#ef4444] px-1.5 text-[9px] font-medium text-white">
                        crítico
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-[15px] font-bold leading-snug text-[#1a2a4a]">
                    {n.title}
                  </h3>
                  <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[#1a2a4a]/90">
                    {n.body || '—'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 border-t border-dashed border-black/20 pt-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4a7fc1] text-[10px] font-bold text-white">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold text-[#1a2a4a]">
                        {n.contact_name || n.contact_external_id || 'Cliente'}
                      </div>
                      <div className="text-[10px] opacity-50">
                        {relativeTime(n.created_at)}
                      </div>
                    </div>
                    {n.conversation_id ? (
                      <Link
                        to={`/inbox/${n.conversation_id}`}
                        className="text-[11px] font-medium underline opacity-70"
                      >
                        Ver chat
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
