import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/workspace';
import { useOutletContext } from 'react-router-dom';
import { MenuIcon } from '../components/Icons';

function formatTokens(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = tab === 'facturacion' ? 'facturacion' : 'perfil';
  const ws = useWorkspace();
  const auth = useAuth();
  const { onToggleSidebar } = useOutletContext() || {};
  const [name, setName] = useState(ws.profileUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(ws.profileUser?.name || '');
  }, [ws.profileUser?.name]);

  if (!tab) return <Navigate to="/settings/perfil" replace />;
  if (tab !== 'perfil' && tab !== 'facturacion') {
    return <Navigate to="/settings/perfil" replace />;
  }

  const plan = ws.plan;
  const usage = ws.usage;
  const tokensUsed = usage?.tokens_total ?? 0;
  const tokenLimit = plan?.monthly_token_limit;
  const msgUsed = usage?.messages_count ?? 0;
  const msgLimit = plan?.monthly_message_limit;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await ws.saveProfile(name);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const tabClass = ({ isActive }) =>
    `fp-tab px-4 py-2 ${isActive ? 'fp-tab-active' : 'fp-tab-idle'}`;

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
        <div className="fp-mono text-[12px]">Ajustes</div>
        <div className="flex-1" />
        <nav
          className="flex items-center gap-1 rounded-full border-2 border-black p-1"
          style={{ background: '#fff' }}
        >
          <NavLink to="/settings/perfil" className={tabClass}>
            Perfil
          </NavLink>
          <NavLink to="/settings/facturacion" className={tabClass}>
            Facturación
          </NavLink>
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:px-8">
          {active === 'perfil' ? (
            <div className="flex flex-col gap-8">
              <div>
                <p className="fp-mono mb-2 opacity-55">Tu espacio</p>
                <h1
                  className="fp-display"
                  style={{ fontSize: 'clamp(40px, 8vw, 72px)' }}
                >
                  Perfil
                </h1>
                <p className="mt-3 max-w-md text-[15px] font-medium leading-snug opacity-75">
                  Cómo te ve Matu AI en el chat y en el equipo.
                </p>
              </div>

              <div className="fp-card fp-card-pink p-6">
                <div className="mb-5 flex items-center gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-[6px] border-2 border-black bg-black text-[18px] font-bold text-[#f4ed36]">
                    {(name || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[18px] font-bold">
                      {name || 'Sin nombre'}
                    </div>
                    <div className="fp-mono mt-1 truncate opacity-70">
                      {auth.user?.email || ws.profileUser?.email}
                    </div>
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="fp-mono opacity-70">Nombre para mostrar</span>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="Tu nombre"
                    className="fp-input"
                  />
                </label>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={saving || !name.trim()}
                    onClick={save}
                    className="fp-btn-ink px-5 py-2.5 text-[13px]"
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  {saved && (
                    <span className="fp-mono text-[11px]">✓ Guardado</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div>
                <p className="fp-mono mb-2 opacity-55">Dashboard</p>
                <h1
                  className="fp-display"
                  style={{ fontSize: 'clamp(36px, 7vw, 64px)' }}
                >
                  Facturación
                </h1>
                <p className="mt-3 max-w-md text-[15px] font-medium leading-snug opacity-75">
                  Plan, consumo y modelos — sin letra chica absurda.
                </p>
              </div>

              <div className="fp-card fp-card-lilac p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="fp-mono opacity-80">Plan actual</div>
                    <div
                      className="fp-display mt-2"
                      style={{
                        fontSize: 'clamp(32px, 6vw, 48px)',
                        color: 'var(--fp-hi-vis)',
                      }}
                    >
                      {plan?.name || plan?.id || 'Free'}
                    </div>
                    <div className="mt-2 text-[14px] font-medium opacity-85">
                      {ws.organization?.name || 'Tu espacio'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/usage')}
                    className="fp-pill px-4 py-2 text-[12px]"
                  >
                    Mejorar plan
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="fp-card fp-card-butter p-5">
                  <div className="fp-mono opacity-70">Tokens este mes</div>
                  <div className="mt-2 text-[28px] font-bold tabular-nums">
                    {formatTokens(tokensUsed)}
                    {tokenLimit > 0 ? (
                      <span className="text-[14px] font-medium opacity-55">
                        {' '}
                        / {formatTokens(tokenLimit)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="fp-card fp-card-matcha p-5">
                  <div className="fp-mono opacity-70">Mensajes este mes</div>
                  <div className="mt-2 text-[28px] font-bold tabular-nums">
                    {msgUsed}
                    {msgLimit > 0 ? (
                      <span className="text-[14px] font-medium opacity-55">
                        {' '}
                        / {msgLimit}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="fp-card p-6">
                <h2 className="text-[16px] font-bold">Historial de pagos</h2>
                <p className="mt-1 text-[14px] font-medium opacity-70">
                  Cuando actives un plan de pago, aquí verás facturas y recibos.
                </p>
                <div
                  className="mt-5 rounded-[6px] border-2 border-dashed border-black/30 px-4 py-8 text-center text-[14px] font-medium opacity-55"
                >
                  Aún no hay pagos registrados
                </div>
              </div>

              <div className="fp-card fp-card-yellow p-6">
                <h2 className="fp-display text-[28px]">Modelos incluidos</h2>
                <p className="mt-3 text-[14px] font-bold leading-relaxed">
                  {(plan?.models_allowed ||
                    'matu,vo0,vo5,matu-apex,matu-dev-3-5,matu-space-ultra,matu-commerce,matu-marketing')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
