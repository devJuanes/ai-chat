import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/workspace';
import { api } from '../lib/api';
import { BotIcon, MenuIcon, PlusIcon, TrashIcon, WhatsAppIcon, InstagramIcon, FacebookIcon } from '../components/Icons';

const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
};

const CHANNEL_ICON = {
  whatsapp: { Icon: WhatsAppIcon, color: '#25D366' },
  instagram: { Icon: InstagramIcon, color: '#E4405F' },
  messenger: { Icon: FacebookIcon, color: '#1877F2' },
};

function ChannelMark({ channel, iconOnly = false, size = 'md' }) {
  const meta = CHANNEL_ICON[channel];
  const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  if (!meta) {
    return (
      <span className="fp-mono text-[11px] uppercase">
        {CHANNEL_LABEL[channel] || channel}
      </span>
    );
  }
  const { Icon, color } = meta;
  if (iconOnly) {
    return (
      <Icon
        className={`${sizeClass} shrink-0`}
        style={{ color }}
        title={CHANNEL_LABEL[channel]}
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color }}>
      <Icon className={`${sizeClass} shrink-0`} />
      <span className="fp-mono text-[11px] uppercase text-black">
        {CHANNEL_LABEL[channel]}
      </span>
    </span>
  );
}

const EMPTY_BOT = {
  name: '',
  objective: 'Cerrar ventas y calificar leads',
  instructions:
    'Saluda, entiende la necesidad, presenta la oferta y guía al cierre o a agendar.',
  business_context: '',
  tone: 'profesional y cercano',
  model_id: 'matu-commerce',
  language: 'es',
  handoff_keywords: 'humano,asesor,agente humano,hablar con alguien',
  active: true,
};

function loadFbSdk(appId, apiVersion) {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: apiVersion || 'v21.0',
      });
      resolve(window.FB);
    };
    const id = 'facebook-jssdk';
    if (document.getElementById(id)) {
      resolve(window.FB);
      return;
    }
    const js = document.createElement('script');
    js.id = id;
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.onerror = () => reject(new Error('No se pudo cargar Facebook SDK'));
    document.body.appendChild(js);
  });
}

export default function BotsPage() {
  const { onToggleSidebar } = useOutletContext() || {};
  const auth = useAuth();
  const ws = useWorkspace();
  const token = auth.getToken?.();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bots, setBots] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [metaCfg, setMetaCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_BOT);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const models = useMemo(
    () => ws.models || [{ id: 'matu-commerce', name: 'Matu Commerce' }],
    [ws.models]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [botsRes, connRes, cfg] = await Promise.all([
        api('/api/bots', { token }),
        api('/api/meta/connections', { token }),
        api('/api/meta/config', { token }),
      ]);
      setBots(botsRes.bots || []);
      setBindings(botsRes.bindings || []);
      setConnections(connRes.connections || []);
      setMetaCfg(cfg);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const connected = searchParams.get('meta_connected');
    const metaError = searchParams.get('meta_error');
    if (connected != null) {
      setNotice(`Meta conectado: ${connected} canal(es).`);
      setSearchParams({}, { replace: true });
      refresh();
    } else if (metaError) {
      setError(decodeURIComponent(metaError));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refresh]);

  const openCreate = () => {
    setEditing('new');
    setForm({ ...EMPTY_BOT });
    setSelectedConnections([]);
  };

  const openEdit = (bot) => {
    setEditing(bot.id);
    setForm({
      name: bot.name,
      objective: bot.objective || '',
      instructions: bot.instructions || '',
      business_context: bot.business_context || '',
      tone: bot.tone || '',
      model_id: bot.model_id || 'matu-commerce',
      language: bot.language || 'es',
      handoff_keywords: bot.handoff_keywords || '',
      active: bot.active !== false,
    });
    setSelectedConnections(
      bindings
        .filter((b) => b.bot_id === bot.id)
        .map((b) => b.meta_connection_id)
    );
  };

  const saveBot = async () => {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let botId = editing;
      if (editing === 'new') {
        const res = await api('/api/bots', {
          token,
          method: 'POST',
          body: form,
        });
        botId = res.bot.id;
      } else {
        await api(`/api/bots/${editing}`, {
          token,
          method: 'PATCH',
          body: form,
        });
      }
      await api(`/api/bots/${botId}/bindings`, {
        token,
        method: 'PUT',
        body: { connection_ids: selectedConnections },
      });
      setEditing(null);
      await refresh();
      setNotice('Agente guardado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteBot = async (id) => {
    if (!token || !window.confirm('¿Eliminar este agente?')) return;
    try {
      await api(`/api/bots/${id}`, { token, method: 'DELETE' });
      if (editing === id) setEditing(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const disconnect = async (id) => {
    if (!token || !window.confirm('¿Desconectar este canal de Meta?')) return;
    try {
      await api(`/api/meta/connections/${id}`, { token, method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const connectPages = async () => {
    if (!token) return;
    setConnecting(true);
    setError(null);
    try {
      const { url } = await api('/api/meta/oauth/start', { token });
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const connectWhatsApp = async () => {
    if (!token || !metaCfg?.appId || !metaCfg?.embeddedSignupConfigId) {
      setError(
        'Configura META_APP_ID y META_EMBEDDED_SIGNUP_CONFIG_ID para WhatsApp Embedded Signup, o usa Conectar Facebook/Instagram.'
      );
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const FB = await loadFbSdk(metaCfg.appId, metaCfg.apiVersion);
      await new Promise((resolve, reject) => {
        FB.login(
          (response) => {
            if (response?.authResponse?.code) {
              api('/api/meta/embedded-signup', {
                token,
                method: 'POST',
                body: { code: response.authResponse.code },
              })
                .then((data) => {
                  setNotice(
                    `WhatsApp vinculado: ${(data.connections || []).length} activo(s).`
                  );
                  refresh();
                  resolve();
                })
                .catch(reject);
            } else if (response?.authResponse?.accessToken) {
              // Fallback: some setups return access token; redirect to pages oauth instead
              reject(
                new Error(
                  'Embedded Signup no devolvió code. Usa Conectar Facebook / Instagram o revisa la config de Meta.'
                )
              );
            } else {
              reject(new Error('Inicio de sesión cancelado'));
            }
          },
          {
            config_id: metaCfg.embeddedSignupConfigId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: '',
              sessionInfoVersion: '3',
            },
          }
        );
      });
    } catch (err) {
      setError(err.message || 'No se pudo conectar WhatsApp');
    } finally {
      setConnecting(false);
    }
  };

  const bindingsByBot = useMemo(() => {
    const map = {};
    for (const b of bindings) {
      if (!map[b.bot_id]) map[b.bot_id] = [];
      map[b.bot_id].push(b.meta_connection_id);
    }
    return map;
  }, [bindings]);

  const connById = useMemo(
    () => Object.fromEntries(connections.map((c) => [c.id, c])),
    [connections]
  );

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
        <div className="flex items-center gap-2">
          <BotIcon />
          <div className="fp-mono text-[12px]">Agentes</div>
        </div>
        <div className="flex-1" />
        <Link
          to="/inbox"
          className="fp-mono hidden text-[11px] underline sm:inline"
        >
          Ir al inbox
        </Link>
        <button
          type="button"
          className="fp-btn fp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
          onClick={openCreate}
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo agente
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {notice ? (
          <div className="mb-4 border-2 border-black bg-[#b5c995] px-3 py-2 text-[13px]">
            {notice}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setNotice(null)}
            >
              ok
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 border-2 border-black bg-[#f8c1ba] px-3 py-2 text-[13px]">
            {error}
          </div>
        ) : null}

        <section className="mb-8">
          <h2 className="mb-1 text-[18px] font-semibold tracking-tight">
            Canales Meta
          </h2>
          <p className="mb-4 max-w-2xl text-[13px] opacity-70">
            Conecta Facebook Page, Instagram y WhatsApp Business. Luego asigna
            un agente para responder automáticamente.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={connecting || !metaCfg?.configured}
              className="fp-btn border-2 border-black bg-white px-3 py-1.5 text-[13px] disabled:opacity-50"
              onClick={connectPages}
            >
              {connecting ? 'Conectando…' : 'Conectar Facebook / Instagram'}
            </button>
            <button
              type="button"
              disabled={connecting || !metaCfg?.configured}
              className="fp-btn border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] disabled:opacity-50"
              onClick={connectWhatsApp}
            >
              WhatsApp Embedded Signup
            </button>
          </div>
          {!metaCfg?.configured ? (
            <p className="mb-3 text-[12px] opacity-60">
              El servidor aún no tiene las variables META_* configuradas.
            </p>
          ) : null}
          {connections.length === 0 ? (
            <p className="text-[13px] opacity-60">Ningún canal conectado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {connections.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 border-2 border-black bg-white px-3 py-2"
                >
                  <ChannelMark channel={c.channel} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                    {c.display_name}
                  </span>
                  <span className="fp-mono text-[10px] opacity-50">
                    {c.status}
                  </span>
                  <button
                    type="button"
                    className="text-[12px] underline opacity-70 hover:opacity-100"
                    onClick={() => disconnect(c.id)}
                  >
                    Desconectar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-[18px] font-semibold tracking-tight">
            Tus agentes
          </h2>
          {loading ? (
            <p className="text-[13px] opacity-60">Cargando…</p>
          ) : bots.length === 0 && editing !== 'new' ? (
            <p className="text-[13px] opacity-60">
              Crea un agente con un objetivo (ej. cerrar ventas) y asígnalo a
              tus canales.
            </p>
          ) : (
            <ul className="mb-6 flex flex-col gap-2">
              {bots.map((bot) => (
                <li
                  key={bot.id}
                  className="flex flex-wrap items-start gap-3 border-2 border-black bg-white px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{bot.name}</span>
                      {!bot.active ? (
                        <span className="fp-mono text-[10px] opacity-50">
                          pausado
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13px] opacity-70 line-clamp-2">
                      {bot.objective || 'Sin objetivo'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(bindingsByBot[bot.id] || []).map((cid) => {
                        const c = connById[cid];
                        if (!c) return null;
                        return (
                          <span
                            key={cid}
                            className="inline-flex items-center gap-1 border border-black/30 px-1.5 py-0.5 text-black"
                            title={CHANNEL_LABEL[c.channel]}
                          >
                            <ChannelMark channel={c.channel} iconOnly size="sm" />
                            <span className="fp-mono text-[10px]">
                              {CHANNEL_LABEL[c.channel]}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[13px] underline"
                    onClick={() => openEdit(bot)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="inline-flex opacity-50 hover:opacity-100"
                    onClick={() => deleteBot(bot.id)}
                    aria-label="Eliminar"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {editing ? (
            <div className="border-2 border-black bg-[#faf8f5] p-4 sm:p-5">
              <h3 className="mb-4 text-[16px] font-semibold">
                {editing === 'new' ? 'Nuevo agente' : 'Editar agente'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                  <span className="fp-mono opacity-70">Nombre</span>
                  <input
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Cierre de ventas"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                  <span className="fp-mono opacity-70">Objetivo</span>
                  <textarea
                    className="min-h-[72px] border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.objective}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, objective: e.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                  <span className="fp-mono opacity-70">Instrucciones</span>
                  <textarea
                    className="min-h-[88px] border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.instructions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        instructions: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                  <span className="fp-mono opacity-70">
                    Contexto del negocio
                  </span>
                  <textarea
                    className="min-h-[88px] border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.business_context}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        business_context: e.target.value,
                      }))
                    }
                    placeholder="Productos, precios, horarios, políticas…"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px]">
                  <span className="fp-mono opacity-70">Tono</span>
                  <input
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.tone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tone: e.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px]">
                  <span className="fp-mono opacity-70">Modelo</span>
                  <select
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.model_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, model_id: e.target.value }))
                    }
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                  <span className="fp-mono opacity-70">
                    Keywords handoff (coma)
                  </span>
                  <input
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.handoff_keywords}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        handoff_keywords: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                  />
                  Activo
                </label>
              </div>

              <div className="mt-4">
                <div className="fp-mono mb-2 text-[11px] opacity-70">
                  Canales asignados
                </div>
                {connections.filter((c) => c.status === 'active').length ===
                0 ? (
                  <p className="text-[12px] opacity-60">
                    Conecta un canal Meta primero.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {connections
                      .filter((c) => c.status === 'active')
                      .map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedConnections.includes(c.id)}
                            onChange={(e) => {
                              setSelectedConnections((prev) =>
                                e.target.checked
                                  ? [...prev, c.id]
                                  : prev.filter((x) => x !== c.id)
                              );
                            }}
                          />
                          <ChannelMark channel={c.channel} iconOnly />
                          {c.display_name}
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !form.name.trim()}
                  className="fp-btn fp-btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
                  onClick={saveBot}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="fp-btn border-2 border-black bg-white px-4 py-2 text-[13px]"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
