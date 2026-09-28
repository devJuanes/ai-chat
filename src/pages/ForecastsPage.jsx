import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MenuIcon } from '../components/Icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const SPORTS = [
  { id: '', label: 'Todos' },
  { id: 'football', label: 'Fútbol' },
  { id: 'basketball', label: 'Baloncesto' },
  { id: 'hockey', label: 'Hockey' },
  { id: 'nba', label: 'NBA' },
];

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function kickoffLabel(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function hasForecast(match) {
  return Boolean(match?.ready) || (Number(match?.winProb) > 0 && Boolean(match?.summary));
}

function isTop(match) {
  return hasForecast(match) && Number(match.winProb) >= 75;
}

function Crest({ src, name }) {
  const [failed, setFailed] = useState(false);
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  if (!src || failed) {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-black bg-[#f4ed36] text-[13px] font-bold">
        {letter}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-9 w-9 shrink-0 rounded-full border-2 border-black bg-white object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export default function ForecastsPage() {
  const auth = useAuth();
  const { onToggleSidebar } = useOutletContext() || {};
  const [date, setDate] = useState(bogotaToday);
  const [sport, setSport] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [forecast, setForecast] = useState('todos');
  const [tab, setTab] = useState('top');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const token = auth.getToken();
    if (!token) return undefined;
    let stop = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ date });
    if (sport) params.set('sport', sport);
    if (search) params.set('q', search);
    api(`/api/sports/board?${params}`, { token })
      .then((data) => {
        if (!stop) setMatches(Array.isArray(data?.matches) ? data.matches : []);
      })
      .catch((err) => {
        if (!stop) setError(err?.message || 'No se pudieron cargar los partidos');
      })
      .finally(() => {
        if (!stop) setLoading(false);
      });
    return () => {
      stop = true;
    };
  }, [auth, date, sport, search]);

  const shown = useMemo(() => {
    const rows = matches.filter((match) => {
      if (status === 'abiertos' && match.finished) return false;
      if (status === 'finalizados' && !match.finished) return false;
      const ready = hasForecast(match);
      if (forecast === 'con' && !ready) return false;
      if (forecast === 'sin' && ready) return false;
      if (tab === 'top' && !isTop(match)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const aTop = isTop(a);
      const bTop = isTop(b);
      if (aTop !== bTop) return aTop ? -1 : 1;
      if (aTop && bTop) return Number(b.winProb) - Number(a.winProb);
      return String(a.kickoff || '').localeCompare(String(b.kickoff || ''));
    });
    return rows;
  }, [matches, status, forecast, tab]);

  const topCount = matches.filter(isTop).length;

  const withPick = matches.filter(hasForecast).length;

  async function generate(match) {
    const token = auth.getToken();
    if (!token || busyId) return;
    setBusyId(match.id);
    try {
      const data = await api('/api/sports/forecast', {
        token,
        method: 'POST',
        body: { fixtureId: match.id },
      });
      if (data?.card) {
        setMatches((current) =>
          current.map((item) => (item.id === match.id ? { ...item, ...data.card } : item))
        );
      }
    } catch (err) {
      setError(err?.message || 'No se pudo generar el pronóstico');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[56px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="fp-mono text-[12px]">Pronósticos</div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto w-full max-w-[960px] px-5 py-8 sm:px-8">
          <p className="fp-mono mb-2 opacity-55">Base interna</p>
          <h1 className="fp-display" style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}>
            Pronósticos
          </h1>
          <p className="mt-3 max-w-xl text-[15px] font-medium leading-snug opacity-75">
            Partidos del día y el pronóstico guardado de cada uno. {withPick} con lectura de{' '}
            {matches.length}.
          </p>

          <div className="mt-6 inline-flex items-center gap-1 rounded-full border-2 border-black bg-white p-1">
            <button
              type="button"
              onClick={() => setTab('top')}
              className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${
                tab === 'top' ? 'bg-black text-[#f4ed36]' : ''
              }`}
            >
              Top del día{topCount ? ` · ${topCount}` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('todos')}
              className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${
                tab === 'todos' ? 'bg-black text-[#f4ed36]' : ''
              }`}
            >
              Todos
            </button>
          </div>
          <p className="mt-2 text-[12px] font-medium opacity-60">
            Top del día son las lecturas de 75% o más. En Todos quedan arriba.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="fp-mono text-[11px] opacity-60">Fecha</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="fp-input"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="fp-mono text-[11px] opacity-60">Deporte</span>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="fp-input"
              >
                {SPORTS.map((item) => (
                  <option key={item.id || 'all'} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
              <span className="fp-mono text-[11px] opacity-60">Buscar</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Equipo o liga"
                className="fp-input"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="fp-mono text-[11px] opacity-60">Estado</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="fp-input"
              >
                <option value="todos">Todos</option>
                <option value="abiertos">Abiertos</option>
                <option value="finalizados">Finalizados</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="fp-mono text-[11px] opacity-60">Pronóstico</span>
              <select
                value={forecast}
                onChange={(e) => setForecast(e.target.value)}
                className="fp-input"
              >
                <option value="todos">Todos</option>
                <option value="con">Con pronóstico</option>
                <option value="sin">Sin pronóstico</option>
              </select>
            </label>
          </div>

          {error ? <p className="mt-4 text-[13px] font-bold">{error}</p> : null}
          {loading ? <p className="mt-6 text-[14px] font-bold opacity-60">Cargando partidos…</p> : null}

          {!loading && !shown.length ? (
            <p className="mt-6 text-[14px] font-bold opacity-60">
              {tab === 'top'
                ? 'Ningún pronóstico de esta fecha pasa del 75%.'
                : 'No hay partidos con esos filtros.'}
            </p>
          ) : null}

          <ul className="mt-6 flex flex-col gap-3">
            {shown.map((match) => {
              const ready = hasForecast(match);
              return (
                <li
                  key={match.id}
                  className="rounded-[8px] border-[2.5px] border-black bg-[#f9f5f2] p-3 shadow-[3px_3px_0_#000]"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wide opacity-70">
                      {match.leagueLogo ? (
                        <img
                          src={match.leagueLogo}
                          alt=""
                          className="h-4 w-4 shrink-0 object-contain"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <span className="truncate">
                        {match.sport}
                        {match.league ? ` · ${match.league}` : ''}
                      </span>
                    </p>
                    <span className="shrink-0 text-[11px] font-bold">
                      {match.finished
                        ? `Final${match.homeScore != null ? ` ${match.homeScore}-${match.awayScore}` : ''}`
                        : kickoffLabel(match.kickoff)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Crest src={match.homeLogo} name={match.home} />
                      <span className="text-[15px] font-bold leading-tight">{match.home}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Crest src={match.awayLogo} name={match.away} />
                      <span className="text-[15px] font-bold leading-tight">{match.away}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    {ready ? (
                      <>
                        <div>
                          <p className="text-[12px] font-bold opacity-70">{match.pick}</p>
                          {match.summary ? (
                            <p className="mt-1 text-[12px] leading-snug opacity-80">{match.summary}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-[28px] font-black leading-none">{match.winProb}%</div>
                          <div className="text-[10px] font-bold uppercase">
                            {match.premium ? 'Alta' : 'Estimado'}
                          </div>
                        </div>
                      </>
                    ) : match.finished ? (
                      <p className="text-[12px] font-bold opacity-70">Sin pronóstico guardado</p>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === match.id}
                        onClick={() => generate(match)}
                        className="rounded-[6px] border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[12px] font-bold disabled:opacity-60"
                      >
                        {busyId === match.id ? 'Generando…' : 'Generar pronóstico'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
