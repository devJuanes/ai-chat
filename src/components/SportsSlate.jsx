import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function Crest({ src, name }) {
  const [failed, setFailed] = useState(false);
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  if (!src || failed) {
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-black bg-[#f4ed36] text-[14px] font-bold">
        {letter}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-10 w-10 shrink-0 rounded-full border-2 border-black bg-white object-contain"
      onError={() => setFailed(true)}
    />
  );
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

function TeamRow({ name, logo }) {
  return (
    <div className="flex items-center gap-2">
      <Crest src={logo} name={name} />
      <span className="text-[14px] font-bold leading-tight">{name}</span>
    </div>
  );
}

function sessionToken() {
  try {
    return JSON.parse(localStorage.getItem('matu_ai_session') || 'null')?.access_token || '';
  } catch {
    return '';
  }
}

function hasForecast(card) {
  return Boolean(card?.ready) || (Number(card?.winProb) > 0 && Boolean(card?.summary));
}

export default function SportsSlate({ cards = [] }) {
  const [live, setLive] = useState(cards);
  const [busyId, setBusyId] = useState('');
  const [errors, setErrors] = useState({});
  const signature = cards.map((card) => `${card.id}:${card.winProb || 0}`).join('|');

  useEffect(() => {
    setLive((current) => {
      const kept = new Map(current.filter(hasForecast).map((card) => [card.id, card]));
      return cards.map((card) => (hasForecast(card) ? card : kept.get(card.id) || card));
    });
  }, [signature, cards]);

  useEffect(() => {
    const token = sessionToken();
    if (!token) return undefined;
    let stop = false;
    let tries = 0;
    let timer = 0;
    const pull = async () => {
      tries += 1;
      try {
        const data = await api('/api/sports/slate', { token });
        if (stop || !data?.cards?.length) return;
        setLive((current) => {
          const kept = new Map(current.filter(hasForecast).map((card) => [card.id, card]));
          return data.cards.map((card) =>
            hasForecast(card) ? card : kept.get(card.id) || card
          );
        });
      } catch {
        /* el siguiente intento vuelve a pedir el día */
      }
      if (tries >= 4) clearInterval(timer);
    };
    pull();
    timer = setInterval(pull, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [signature]);

  async function generate(card) {
    const token = sessionToken();
    if (!token || busyId) return;
    setBusyId(card.id);
    setErrors((current) => ({ ...current, [card.id]: '' }));
    try {
      const data = await api('/api/sports/forecast', {
        token,
        method: 'POST',
        body: { fixtureId: card.id },
      });
      if (!data?.card) throw new Error('No llegó el pronóstico');
      setLive((current) => current.map((item) => (item.id === card.id ? data.card : item)));
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [card.id]: err?.message || 'No se pudo generar',
      }));
    } finally {
      setBusyId('');
    }
  }

  if (!live.length) return null;
  return (
    <div className="my-2 grid gap-3 sm:grid-cols-2">
      {live.map((card) => (
        <article
          key={card.id || `${card.home}-${card.away}`}
          className="rounded-[8px] border-[2.5px] border-black bg-[#f9f5f2] p-3 text-[#1a1a1a] shadow-[3px_3px_0_#000]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
              {card.sport}
              {card.league ? ` · ${card.league}` : ''}
            </p>
            <span className="text-[11px] font-bold">
              {card.finished
                ? `Final${card.homeScore != null ? ` ${card.homeScore}-${card.awayScore}` : ''}`
                : kickoffLabel(card.kickoff)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <TeamRow name={card.home} logo={card.homeLogo} />
            <TeamRow name={card.away} logo={card.awayLogo} />
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            {hasForecast(card) ? (
              <>
                <div>
                  <p className="text-[12px] font-bold opacity-70">{card.pick}</p>
                  {card.summary ? (
                    <p className="mt-1 text-[12px] leading-snug opacity-80">{card.summary}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-[28px] font-black leading-none">{card.winProb}%</div>
                  <div className="text-[10px] font-bold uppercase">
                    {card.premium ? 'Alta' : 'Estimado'}
                  </div>
                </div>
              </>
            ) : card.finished ? (
              <p className="text-[12px] font-bold opacity-70">Partido finalizado</p>
            ) : (
              <div>
                <button
                  type="button"
                  disabled={busyId === card.id}
                  onClick={() => generate(card)}
                  className="rounded-[6px] border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[12px] font-bold disabled:opacity-60"
                >
                  {busyId === card.id ? 'Generando…' : 'Generar pronóstico'}
                </button>
                {errors[card.id] ? (
                  <p className="mt-1 text-[11px] font-medium">{errors[card.id]}</p>
                ) : null}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
