import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useMemo } from 'react';
import { useWorkspace } from '../lib/workspace';
import { MenuIcon } from '../components/Icons';

function formatTokens(n) {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function pct(used, limit) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function ProgressCard({ value, label, detail, usedLabel, tone }) {
  return (
    <div className={`fp-card ${tone} p-5`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="fp-mono opacity-70">{label}</div>
          <div className="mt-1 text-[13px] font-medium opacity-75">{detail}</div>
        </div>
        <div className="text-right text-[12px] font-bold">{usedLabel}</div>
      </div>
      <div className="fp-progress">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MonthHeatmap({ intensity = 0.2 }) {
  const cells = useMemo(() => {
    const days = 35;
    return Array.from({ length: days }, (_, i) => {
      const wave = Math.abs(Math.sin(i * 0.55)) * intensity;
      const noise = ((i * 17) % 10) / 40;
      return Math.min(1, wave + noise * intensity);
    });
  }, [intensity]);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <div key={d} className="fp-mono text-center text-[10px] opacity-50">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((v, i) => (
          <div
            key={i}
            className="aspect-square rounded-[3px] border border-black/20"
            style={{
              background:
                v < 0.08
                  ? '#f0ece8'
                  : `rgba(172, 79, 152, ${0.2 + v * 0.75})`,
            }}
            title={`Actividad relativa ${(v * 100).toFixed(0)}%`}
          />
        ))}
      </div>
    </div>
  );
}

export default function UsagePage() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};

  const plan = ws.plan || {};
  const usage = ws.usage || {};
  const tokensUsed = usage.tokens_total ?? 0;
  const tokenLimit = plan.monthly_token_limit ?? 0;
  const msgUsed = usage.messages_count ?? 0;
  const msgLimit = plan.monthly_message_limit ?? 0;
  const tokenPct = pct(tokensUsed, tokenLimit);
  const msgPct = pct(msgUsed, msgLimit);
  const intensity = Math.max(0.12, Math.min(0.9, (tokenPct || msgPct) / 100));

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[52px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="fp-mono">Uso y plan</div>
        <div className="flex-1" />
        <button
          type="button"
          className="fp-btn-ink px-3.5 py-2 text-[11px]"
          onClick={() => navigate('/settings/facturacion')}
        >
          Mejorar plan
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-5 py-8 sm:px-8">
          <div>
            <p className="fp-mono mb-2 opacity-55">Dashboard</p>
            <h1
              className="fp-display"
              style={{ fontSize: 'clamp(36px, 7vw, 64px)' }}
            >
              Mi uso
            </h1>
            <p className="mt-2 text-[14px] font-medium opacity-75">
              Periodo {usage.period_ym || 'actual'} · Plan{' '}
              <span className="font-bold">{plan.name || plan.id || 'Gratis'}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressCard
              value={tokenPct}
              tone="fp-card-butter"
              label="Límite de tokens"
              detail={
                tokenLimit > 0
                  ? `Cuota mensual ${formatTokens(tokenLimit)}`
                  : 'Sin límite configurado'
              }
              usedLabel={`${tokenPct}% · ${formatTokens(tokensUsed)}`}
            />
            <ProgressCard
              value={msgPct}
              tone="fp-card-matcha"
              label="Límite de mensajes"
              detail={
                msgLimit > 0
                  ? `Cuota mensual ${msgLimit}`
                  : 'Sin límite configurado'
              }
              usedLabel={`${msgPct}% · ${msgUsed}`}
            />
          </div>

          <div className="fp-card fp-card-lilac p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="fp-display text-[28px]" style={{ color: '#f4ed36' }}>
                  Saldo
                </h2>
                <p className="mt-2 max-w-md text-[13px] font-medium opacity-85">
                  Créditos de suscripción + recargas. Se usan cuando se agota la
                  cuota del plan.
                </p>
              </div>
              <button
                type="button"
                className="fp-pill px-4 py-2 text-[12px]"
                onClick={() => navigate('/settings/facturacion')}
              >
                Recargar
              </button>
            </div>
            <p className="mt-5 text-[13px] font-medium opacity-70">
              Aún no tienes créditos extra.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="fp-card p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[15px] font-bold">Resumen del periodo</h2>
                <span className="fp-mono opacity-50">Este mes</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Tokens',
                    value: formatTokens(tokensUsed),
                    tone: 'fp-card-pink',
                  },
                  {
                    label: 'Entrada',
                    value: formatTokens(usage.tokens_in ?? 0),
                    tone: 'fp-card-butter',
                  },
                  {
                    label: 'Salida',
                    value: formatTokens(usage.tokens_out ?? 0),
                    tone: 'fp-card-matcha',
                  },
                ].map((card) => (
                  <div key={card.label} className={`fp-card ${card.tone} px-3 py-4`}>
                    <div className="fp-mono opacity-60">{card.label}</div>
                    <div className="mt-1.5 text-[22px] font-bold tabular-nums">
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fp-card p-5 sm:p-6">
              <h2 className="mb-1 text-[15px] font-bold">Actividad</h2>
              <p className="mb-4 fp-mono opacity-50">Intensidad del periodo</p>
              <MonthHeatmap intensity={intensity} />
              <div className="mt-5 space-y-2 border-t-2 border-black/15 pt-4 text-[13px] font-medium">
                <div className="flex justify-between">
                  <span className="opacity-55">Mensajes</span>
                  <span className="tabular-nums">{msgUsed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-55">Tokens</span>
                  <span className="tabular-nums">{formatTokens(tokensUsed)}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-[12px] font-medium opacity-55">
            ¿Dudas?{' '}
            <Link
              to="/settings/facturacion"
              className="font-bold underline underline-offset-2"
            >
              Ir a facturación
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
