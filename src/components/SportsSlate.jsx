import { useState } from 'react';

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

export default function SportsSlate({ cards = [] }) {
  if (!cards.length) return null;
  return (
    <div className="my-2 grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <article
          key={card.id || `${card.home}-${card.away}`}
          className="rounded-[8px] border-[2.5px] border-black bg-[#f9f5f2] p-3 text-[#1a1a1a] shadow-[3px_3px_0_#000]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
              {card.sport}
              {card.league ? ` · ${card.league}` : ''}
            </p>
            <span className="text-[11px] font-bold">{kickoffLabel(card.kickoff)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <TeamRow name={card.home} logo={card.homeLogo} />
            <TeamRow name={card.away} logo={card.awayLogo} />
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold opacity-70">{card.pick}</p>
              {card.summary ? (
                <p className="mt-1 text-[12px] leading-snug opacity-80">{card.summary}</p>
              ) : null}
            </div>
            {card.winProb != null ? (
              <div className="text-right">
                <div className="text-[28px] font-black leading-none">{card.winProb}%</div>
                <div className="text-[10px] font-bold uppercase">
                  {card.premium ? 'Alta' : 'Estimado'}
                </div>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
