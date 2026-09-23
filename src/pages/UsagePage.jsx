import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useMemo } from 'react';
import { useWorkspace } from '../lib/workspace';
import { MenuIcon } from '../components/Icons';
import NotificationBell from '../components/NotificationBell';

const MODEL_LABELS = {
  matu: 'Matu',
  vo0: 'VO0',
  vo5: 'VO5',
  'matu-apex': 'Matu Forge',
  'matu-dev-3-5': 'Matu Dev 3.5',
  'matu-space-ultra': 'Space Ultra',
  'matu-commerce': 'Commerce',
  'matu-marketing': 'Marketing',
  'matu-bot-3-5': 'MatuBot (Meta)',
};

function formatTokens(n) {
  if (n == null) return '—';
  if (n < 0) return '∞';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function pct(used, limit) {
  if (limit == null || limit < 0) return 0;
  if (!limit) return 100;
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

export default function UsagePage() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};

  const plan = ws.plan || {};
  const usage = ws.usage || {};
  const unlimited = Boolean(usage.unlimited || ws.profileUser?.is_admin);
  const tokensUsed = usage.tokens_total ?? 0;
  const tokenLimit = plan.monthly_token_limit ?? 0;
  const msgUsed = usage.messages_count ?? 0;
  const byModel = useMemo(() => {
    const rows = Array.isArray(usage.by_model) ? [...usage.by_model] : [];
    rows.sort((a, b) => (b.tokens_total || 0) - (a.tokens_total || 0));
    return rows;
  }, [usage.by_model]);

  const tokenPct = unlimited ? 0 : pct(tokensUsed, tokenLimit);
  const activeModels = byModel.filter((m) => (m.tokens_total || 0) > 0 || m.messages_count > 0);

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
        <NotificationBell />
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
              {unlimited ? (
                <span className="ml-2 rounded-[4px] border-2 border-black bg-[#f4ed36] px-1.5 py-0.5 text-[11px] font-bold">
                  Admin · ilimitado
                </span>
              ) : null}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressCard
              value={tokenPct}
              tone="fp-card-butter"
              label="Tokens del periodo"
              detail={
                unlimited
                  ? 'Sin tope (cuenta admin)'
                  : tokenLimit < 0
                    ? 'Cuota global ilimitada'
                    : tokenLimit > 0
                      ? `Referencia global ${formatTokens(tokenLimit)}`
                      : 'Sin límite global'
              }
              usedLabel={
                unlimited
                  ? `${formatTokens(tokensUsed)} usados`
                  : `${tokenPct}% · ${formatTokens(tokensUsed)}`
              }
            />
            <ProgressCard
              value={Math.min(
                100,
                activeModels.length
                  ? Math.round(
                      activeModels.reduce((a, m) => a + (m.pct || 0), 0) /
                        activeModels.length
                    )
                  : 0
              )}
              tone="fp-card-matcha"
              label="Modelos activos"
              detail={`${activeModels.length || 0} con consumo este mes`}
              usedLabel={`${msgUsed} msgs`}
            />
          </div>

          <div className="fp-card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold">Consumo por modelo</h2>
                <p className="mt-1 text-[13px] opacity-70">
                  Cada modelo tiene su propia cuota de tokens. MatuBot (WhatsApp /
                  Instagram / Messenger) no consume la cuota de tu chat Matu.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b-2 border-black/20 fp-mono text-[10px] opacity-60">
                    <th className="py-2 pr-3 font-normal">Modelo</th>
                    <th className="py-2 pr-3 font-normal">Usado</th>
                    <th className="py-2 pr-3 font-normal">Límite</th>
                    <th className="py-2 pr-3 font-normal">Msgs</th>
                    <th className="py-2 font-normal">%</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => {
                    const limit = unlimited ? -1 : m.monthly_token_limit;
                    const p = unlimited ? 0 : m.pct || pct(m.tokens_total, limit);
                    return (
                      <tr
                        key={m.model_id}
                        className="border-b border-black/10 align-middle"
                      >
                        <td className="py-3 pr-3 font-bold">
                          {MODEL_LABELS[m.model_id] || m.model_id}
                          {m.model_id === 'matu-bot-3-5' ? (
                            <span className="ml-1.5 text-[10px] font-medium opacity-55">
                              Meta
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {formatTokens(m.tokens_total)}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {unlimited || limit < 0
                            ? 'Ilimitado'
                            : formatTokens(limit)}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {m.messages_count || 0}
                        </td>
                        <td className="py-3 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="fp-progress flex-1">
                              <span
                                style={{
                                  width: `${p}%`,
                                  background:
                                    p >= 90
                                      ? '#c94245'
                                      : p >= 70
                                        ? '#ac4f98'
                                        : undefined,
                                }}
                              />
                            </div>
                            <span className="w-8 text-right tabular-nums text-[11px] font-bold">
                              {unlimited ? '—' : `${p}%`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
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

          <p className="text-center text-[12px] font-medium opacity-55">
            Alertas al 30%, 70% y 90% de cada modelo ·{' '}
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
