import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { refreshPulse } from './pulse';
import { useCollection } from './community/live';

const FALLBACK_RATE = { per: 1000, cop: 5000, usd: 2, min: 100, max: 100000 };

const REASON = {
  post: 'Publicaste un hilo',
  reply: 'Respondiste en un hilo',
  challenge_create: 'Creaste un reto',
  challenge_join: 'Te uniste a un reto',
  challenge_done: 'Completaste un reto',
  project_create: 'Creaste un proyecto',
  project_join: 'Te uniste a un proyecto',
  group_create: 'Creaste un grupo',
  group_join: 'Entraste a un grupo',
  lesson: 'Terminaste una lección',
  module: 'Terminaste un módulo',
  course: 'Completaste un curso',
  topup: 'Recargaste Edu Coins',
  course_fee: 'Desbloqueaste un curso',
  event_fee: 'Te inscribiste a un evento',
  course_refund: 'Devolución de un curso',
  event_refund: 'Devolución de un evento',
};

const PLACE = {
  post: 'Comunidad',
  reply: 'Comunidad',
  challenge_create: 'Retos',
  challenge_join: 'Retos',
  challenge_done: 'Retos',
  project_create: 'Proyectos',
  project_join: 'Proyectos',
  group_create: 'Grupos',
  group_join: 'Grupos',
  lesson: 'Rutas',
  module: 'Rutas',
  course: 'Rutas',
  topup: 'Recarga',
  course_fee: 'Cursos',
  event_fee: 'Eventos',
  course_refund: 'Cursos',
  event_refund: 'Eventos',
};

const PACKS = [
  { coins: 1000 },
  { coins: 5000, badge: 'Más elegido' },
  { coins: 10000, badge: 'Mayor ahorro' },
];

function money(value, currency) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(value);
}

function quote(raw, rate) {
  const coins = Math.round(Number(raw));
  if (!Number.isInteger(coins) || coins < 1) return null;
  return {
    coins,
    cop: (coins * rate.cop) / rate.per,
    usd: (coins * rate.usd) / rate.per,
    ok: coins >= rate.min && coins <= rate.max,
  };
}

function whenShort(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(date);
}

function Icon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="M5 12.5 9.2 17 19 7" />
      </svg>
    );
  }
  if (name === 'cap') {
    return (
      <svg {...common}>
        <path d="m3 10 9-5 9 5-9 5z" />
        <path d="M7 12.2V16c0 1.2 2.2 2.8 5 2.8s5-1.6 5-2.8v-3.8" />
      </svg>
    );
  }
  if (name === 'chat') {
    return (
      <svg {...common}>
        <path d="M6 16.2 4.4 19V7.2A1.7 1.7 0 0 1 6.1 5.5h11.8A1.7 1.7 0 0 1 19.6 7.2v7.3a1.7 1.7 0 0 1-1.7 1.7z" />
      </svg>
    );
  }
  if (name === 'trophy') {
    return (
      <svg {...common}>
        <path d="M8 4.5h8v5.2a4 4 0 0 1-8 0z" />
        <path d="M8 6.2H5.8A2.3 2.3 0 0 0 8 9.5M16 6.2h2.2A2.3 2.3 0 0 1 16 9.5M12 13.7V16M9 19.5h6" />
      </svg>
    );
  }
  if (name === 'rocket') {
    return (
      <svg {...common}>
        <path d="M14.5 4.5c2.8.4 5 2.6 5.4 5.4-2.2 2.6-5.2 4.2-8.4 4.6L8 18.5l-2.5-2.5 4-3.5c.4-3.2 2-6.2 4.6-8z" />
        <path d="M9.2 14.8 6 18M14.2 9.2h.01" />
      </svg>
    );
  }
  if (name === 'coin') {
    return <img src="/edu-coin.png" alt="" />;
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v8M9 12h6" />
    </svg>
  );
}

function CoinMark() {
  return (
    <div className="edu-coin-art" aria-hidden="true">
      <span className="edu-coin-art-glow" />
      <img src="/edu-coin.png" alt="" />
    </div>
  );
}

function WompiButton({ checkout }) {
  useEffect(() => {
    const holder = document.getElementById('edu-wompi');
    if (!holder) return undefined;
    holder.replaceChildren();
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.setAttribute('data-render', 'button');
    script.setAttribute('data-public-key', checkout.public_key);
    script.setAttribute('data-currency', checkout.currency);
    script.setAttribute('data-amount-in-cents', String(checkout.amount_in_cents));
    script.setAttribute('data-reference', checkout.reference);
    script.setAttribute('data-signature:integrity', checkout.signature);
    script.setAttribute('data-redirect-url', checkout.redirect_url);
    holder.appendChild(script);
    return () => holder.replaceChildren();
  }, [checkout]);

  return <div id="edu-wompi" className="edu-coin-pay" />;
}

export default function EduCoins() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const { extra, error, ready, reload, setError } = useCollection('/api/edu/coins', 'ledger');
  const [amount, setAmount] = useState('1000');
  const [busy, setBusy] = useState('');
  const [checkout, setCheckout] = useState(null);
  const rate = extra.rate || FALLBACK_RATE;
  const prices = useMemo(() => quote(amount, rate), [amount, rate]);
  const rewards = extra.rewards || {};
  const balance = extra.balance || 0;

  useEffect(() => {
    const id = params.get('id');
    if (!id) return undefined;
    let stop = false;
    api('/api/edu/coins/sync', { method: 'POST', token: auth.getToken(), body: { id } })
      .then(() => {
        if (!stop) {
          refreshPulse(auth.getToken());
          return reload();
        }
        return null;
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude confirmar el pago');
      });
    return () => {
      stop = true;
    };
  }, [auth, params, reload, setError]);

  const buy = async (currency, raw = amount) => {
    const next = quote(raw, rate);
    if (!next?.ok || busy) return;
    setBusy(`${next.coins}-${currency}`);
    setError('');
    setCheckout(null);
    try {
      const json = await api('/api/edu/coins/checkout', {
        method: 'POST',
        token: auth.getToken(),
        body: { coins: next.coins, currency },
      });
      setCheckout(json);
    } catch (err) {
      setError(err.message || 'No se pudo abrir el pago');
    } finally {
      setBusy('');
    }
  };

  const ways = [
    { icon: 'cap', title: 'Completa una lección', coins: rewards.lesson ?? 5 },
    { icon: 'chat', title: 'Responde en la comunidad', coins: rewards.reply ?? 8 },
    { icon: 'trophy', title: 'Completa un reto', coins: rewards.challenge_done ?? 40 },
    { icon: 'rocket', title: 'Crea un proyecto', coins: rewards.project_create ?? 20 },
  ];

  return (
    <div className="edu-home edu-coins">
      <section className="edu-coin-hero">
        <div className="edu-coin-intro">
          <span className="edu-coin-mark">
            <Icon name="coin" />
          </span>
          <div>
            <h1>Edu Coins</h1>
            <p>Gana monedas mientras aprendes y úsalas para desbloquear cursos, retos y experiencias dentro de EduCreator.</p>
            <ul className="edu-coin-pills">
              <li><Icon name="check" />Completa lecciones</li>
              <li><Icon name="check" />Participa en la comunidad</li>
              <li><Icon name="check" />Completa retos</li>
              <li><Icon name="check" />Crea proyectos</li>
            </ul>
          </div>
        </div>
        <aside className="edu-coin-balance">
          <CoinMark />
          <div>
            <strong>{ready ? balance.toLocaleString('es-CO') : '—'}</strong>
            <span>Edu Coins</span>
            <small>Saldo disponible</small>
          </div>
        </aside>
      </section>

      <section className="edu-coin-panel">
        <h2>¿Cómo ganas Edu Coins?</h2>
        <div className="edu-coin-ways">
          {ways.map((way) => (
            <article key={way.title}>
              <span>
                <Icon name={way.icon} />
              </span>
              <div>
                <strong>{way.title}</strong>
                <em>+{way.coins} Coins</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="edu-coin-panel">
        <header className="edu-coin-panel-head">
          <div>
            <h2>Recarga tus Edu Coins</h2>
            <p>Obtén Edu Coins para desbloquear experiencias y contenido premium.</p>
          </div>
        </header>
        <div className="edu-coin-packs">
          {PACKS.map((pack) => {
            const price = quote(pack.coins, rate);
            const key = `${pack.coins}-COP`;
            return (
              <article key={pack.coins} className={pack.badge === 'Más elegido' ? 'is-featured' : undefined}>
                {pack.badge ? <em className="edu-coin-badge">{pack.badge}</em> : <em className="edu-coin-badge is-quiet">Estándar</em>}
                <span className="edu-coin-pack-icon">
                  <Icon name="coin" />
                </span>
                <strong>{pack.coins.toLocaleString('es-CO')}</strong>
                <small>Edu Coins</small>
                <p>{price ? money(price.cop, 'COP') : ''}</p>
                <span className="edu-coin-usd">{price ? money(price.usd, 'USD') : ''}</span>
                <button
                  type="button"
                  className="edu-btn"
                  disabled={!price?.ok || Boolean(busy)}
                  onClick={() => buy('COP', pack.coins)}
                >
                  {busy === key ? 'Abriendo pago…' : 'Comprar ahora'}
                </button>
              </article>
            );
          })}
        </div>

        <div className="edu-coin-custom">
          <div>
            <h3>¿Quieres una cantidad diferente?</h3>
            <p>El precio se calcula con la misma tarifa: {rate.per.toLocaleString('es-CO')} monedas por {money(rate.cop, 'COP')} o {money(rate.usd, 'USD')}.</p>
          </div>
          <label>
            Cantidad de Edu Coins
            <input
              type="number"
              min={rate.min}
              max={rate.max}
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 6));
                setCheckout(null);
              }}
            />
          </label>
          <div className="edu-coin-quote">
            {prices ? (
              <>
                <strong>{prices.coins.toLocaleString('es-CO')} Edu Coins</strong>
                <span>{money(prices.cop, 'COP')}</span>
                <span>{money(prices.usd, 'USD')}</span>
              </>
            ) : (
              <strong>Escribe una cantidad</strong>
            )}
          </div>
          {prices && !prices.ok ? (
            <p className="edu-coin-note">
              Entre {rate.min.toLocaleString('es-CO')} y {rate.max.toLocaleString('es-CO')} Edu Coins.
            </p>
          ) : null}
          <div className="edu-coin-pay-actions">
            <button type="button" className="edu-btn" disabled={!prices?.ok || Boolean(busy)} onClick={() => buy('COP')}>
              {busy === `${prices?.coins}-COP` ? 'Abriendo pago…' : 'Pagar en COP'}
            </button>
            <button type="button" className="edu-coin-usd-btn" disabled={!prices?.ok || Boolean(busy)} onClick={() => buy('USD')}>
              {busy === `${prices?.coins}-USD` ? 'Abriendo pago…' : 'Pagar en USD'}
            </button>
          </div>
        </div>
        {error ? <div className="edu-error">{error}</div> : null}
        {checkout ? <WompiButton checkout={checkout} /> : null}
      </section>

      <section className="edu-coin-panel">
        <header className="edu-coin-panel-head">
          <div>
            <h2>Movimientos</h2>
            <p>Aquí puedes consultar cómo has ganado y utilizado tus Edu Coins.</p>
          </div>
        </header>
        <ul className="edu-coin-ledger">
          {(extra.ledger || []).length ? (
            extra.ledger.map((row) => {
              const positive = row.amount > 0;
              return (
                <li key={row.id} className={positive ? 'is-in' : 'is-out'}>
                  <span className="edu-coin-move-icon">
                    <Icon name={positive ? 'coin' : 'cap'} />
                  </span>
                  <strong>{positive ? `+${row.amount}` : row.amount}</strong>
                  <div>
                    <b>{REASON[row.reason] || row.reason}</b>
                    <small>{PLACE[row.reason] || 'EduCreator'}</small>
                  </div>
                  <time>{whenShort(row.created_at)}</time>
                </li>
              );
            })
          ) : (
            <li className="is-empty">
              <div>
                <b>{ready ? 'Todavía no hay movimientos.' : 'Cargando movimientos…'}</b>
                <small>Cuando termines una lección o recargues, queda registrado aquí.</small>
              </div>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
