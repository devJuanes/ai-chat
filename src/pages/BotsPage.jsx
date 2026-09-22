import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { BotIcon, MenuIcon, PlusIcon, TrashIcon, WhatsAppIcon, InstagramIcon, FacebookIcon } from '../components/Icons';

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
  company_name: '',
  brief: '',
  objective: '',
  instructions: '',
  business_context: '',
  products_services: '',
  welcome_message: '',
  form_id: '',
  tone: 'cálido, cercano y comercial',
  model_id: 'matu-bot-3-5',
  language: 'es',
  handoff_keywords: 'humano,asesor,agente humano,hablar con alguien',
  active: true,
};

const BOT_MODELS_FALLBACK = [
  { id: 'matu-bot-3-5', name: 'MatuBot 3.5', tagline: 'Chatbot ventas' },
  { id: 'matu-marketing', name: 'Matu Marketing', tagline: 'Growth' },
  { id: 'matu-commerce', name: 'Matu Commerce', tagline: 'Commerce' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  fields: [
    { label: 'Nombre', field_key: 'nombre', field_type: 'text', required: true },
    { label: 'Teléfono', field_key: 'telefono', field_type: 'phone', required: true },
    { label: 'Email', field_key: 'email', field_type: 'email', required: false },
  ],
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
  const token = auth.getToken?.();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bots, setBots] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [leadForms, setLeadForms] = useState([]);
  const [leads, setLeads] = useState([]);
  const [metaCfg, setMetaCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_BOT);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [tab, setTab] = useState('agentes'); // agentes | formularios | leads

  const [botModels, setBotModels] = useState(BOT_MODELS_FALLBACK);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const models = useMemo(
    () => (botModels.length ? botModels : BOT_MODELS_FALLBACK),
    [botModels]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [botsRes, connRes, cfg, formsRes, leadsRes, modelsRes] =
        await Promise.all([
          api('/api/bots', { token }),
          api('/api/meta/connections', { token }),
          api('/api/meta/config', { token }),
          api('/api/lead-forms', { token }).catch(() => ({ forms: [] })),
          api('/api/leads', { token }).catch(() => ({ leads: [] })),
          api('/api/bots/models', { token }).catch(() => ({
            models: BOT_MODELS_FALLBACK,
          })),
        ]);
      setBots(botsRes.bots || []);
      setBindings(botsRes.bindings || []);
      setConnections(connRes.connections || []);
      setMetaCfg(cfg);
      setLeadForms(formsRes.forms || []);
      setLeads(leadsRes.leads || []);
      if (modelsRes.models?.length) setBotModels(modelsRes.models);
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
    setShowWelcome(false);
    setShowAdvanced(false);
  };

  const openEdit = (bot) => {
    setEditing(bot.id);
    setForm({
      name: bot.name,
      company_name: bot.company_name || '',
      brief: '',
      objective: bot.objective || '',
      instructions: bot.instructions || '',
      business_context: bot.business_context || '',
      products_services: bot.products_services || '',
      welcome_message: bot.welcome_message || '',
      form_id: bot.form_id || '',
      tone: bot.tone || '',
      model_id: bot.model_id || 'matu-bot-3-5',
      language: bot.language || 'es',
      handoff_keywords: bot.handoff_keywords || '',
      active: bot.active !== false,
    });
    setSelectedConnections(
      bindings
        .filter((b) => b.bot_id === bot.id)
        .map((b) => b.meta_connection_id)
    );
    setShowWelcome(Boolean(bot.welcome_message));
    setShowAdvanced(false);
  };

  const saveBot = async () => {
    if (!token || !form.name.trim()) return;
    if (!form.company_name.trim()) {
      setError('Escribe el nombre de tu empresa (no uses el correo).');
      return;
    }
    if (editing === 'new' && !form.brief.trim()) {
      setError('Describe qué quieres que haga el agente.');
      return;
    }
    if (editing === 'new' && selectedConnections.length === 0) {
      setError('Elige al menos un canal (WhatsApp, Instagram o Facebook).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let body = {
        ...form,
        form_id: form.form_id || null,
        model_id: form.model_id || 'matu-bot-3-5',
      };

      if (editing === 'new') {
        const channels = selectedConnections
          .map((id) => connById[id]?.channel)
          .filter(Boolean);
        const { generated } = await api('/api/bots/generate', {
          token,
          method: 'POST',
          body: {
            name: form.name,
            company_name: form.company_name,
            brief: form.brief,
            channels,
          },
        });
        body = {
          ...body,
          ...generated,
          name: form.name,
          company_name: form.company_name,
          form_id: form.form_id || null,
          active: true,
        };
      }

      let botId = editing;
      if (editing === 'new') {
        const res = await api('/api/bots', {
          token,
          method: 'POST',
          body,
        });
        botId = res.bot.id;
      } else {
        await api(`/api/bots/${editing}`, {
          token,
          method: 'PATCH',
          body,
        });
      }
      await api(`/api/bots/${botId}/bindings`, {
        token,
        method: 'PUT',
        body: { connection_ids: selectedConnections },
      });
      setEditing(null);
      await refresh();
      setNotice(
        editing === 'new'
          ? 'Agente creado y entrenado automáticamente.'
          : 'Agente guardado.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveLeadForm = async () => {
    if (!token || !formDraft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingForm === 'new') {
        await api('/api/lead-forms', {
          token,
          method: 'POST',
          body: formDraft,
        });
      } else {
        await api(`/api/lead-forms/${editingForm}`, {
          token,
          method: 'PATCH',
          body: formDraft,
        });
      }
      setEditingForm(null);
      await refresh();
      setNotice('Formulario guardado.');
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
        <nav
          className="ml-2 hidden items-center gap-1 rounded-full border-2 border-black p-1 sm:flex"
          style={{ background: '#fff' }}
        >
          {[
            { id: 'agentes', label: 'Agentes' },
            { id: 'formularios', label: 'Formularios' },
            { id: 'leads', label: 'Leads' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`fp-tab px-3 py-1.5 text-[12px] ${
                tab === t.id ? 'fp-tab-active' : 'fp-tab-idle'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <Link
          to="/inbox"
          className="fp-mono hidden text-[11px] underline sm:inline"
        >
          Ir al inbox
        </Link>
        {tab === 'agentes' ? (
          <button
            type="button"
            className="fp-btn fp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
            onClick={openCreate}
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo agente
          </button>
        ) : null}
        {tab === 'formularios' ? (
          <button
            type="button"
            className="fp-btn fp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px]"
            onClick={() => {
              setEditingForm('new');
              setFormDraft({
                ...EMPTY_FORM,
                fields: EMPTY_FORM.fields.map((f) => ({ ...f })),
              });
            }}
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo formulario
          </button>
        ) : null}
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

        {tab === 'agentes' ? (
        <>
        <section className="mb-8">
          <h2 className="mb-1 text-[18px] font-semibold tracking-tight">
            Canales Meta
          </h2>
          <p className="mb-4 max-w-2xl text-[13px] opacity-70">
            WhatsApp, Instagram y Facebook son canales separados. Cada uno
            muestra su propio icono e identidad (teléfono / @usuario / nombre).
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
                      {bot.company_name ? (
                        <span className="text-[12px] opacity-50">
                          · {bot.company_name}
                        </span>
                      ) : null}
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
              <h3 className="mb-1 text-[16px] font-semibold">
                {editing === 'new' ? 'Nuevo agente' : 'Editar agente'}
              </h3>
              <p className="mb-4 text-[13px] opacity-70">
                {editing === 'new'
                  ? 'Elige canales, pon nombre + empresa y describe qué debe hacer. MatuBot 3.5 entrena el resto automáticamente.'
                  : 'Ajusta identidad, canales y (si quieres) la configuración avanzada.'}
              </p>

              <div className="mb-4">
                <div className="fp-mono mb-2 text-[11px] opacity-70">
                  1. Canales
                </div>
                {connections.filter((c) => c.status === 'active').length ===
                0 ? (
                  <p className="text-[12px] opacity-60">
                    Conecta un canal Meta primero (arriba).
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
                          <span className="fp-mono text-[10px] uppercase">
                            {CHANNEL_LABEL[c.channel]}
                          </span>
                          {c.display_name}
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[12px]">
                  <span className="fp-mono opacity-70">
                    2. Nombre del agente
                  </span>
                  <input
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Ana"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[12px]">
                  <span className="fp-mono opacity-70">
                    3. Nombre de la empresa
                  </span>
                  <input
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={form.company_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, company_name: e.target.value }))
                    }
                    placeholder="Escribe tu empresa (no el correo)"
                  />
                </label>

                {editing === 'new' ? (
                  <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                    <span className="fp-mono opacity-70">
                      4. ¿Qué quieres que haga este agente?
                    </span>
                    <textarea
                      className="min-h-[120px] border-2 border-black bg-white px-3 py-2 text-[14px]"
                      value={form.brief}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, brief: e.target.value }))
                      }
                      placeholder="Ej: Vender mis planes de internet fibra en Bogotá, calificar leads, pedir nombre y barrio, y agendar visita técnica."
                    />
                    <span className="text-[11px] opacity-50">
                      Con esto MatuBot 3.5 genera objetivo, instrucciones, tono
                      y saludo. No verás esos campos al crear.
                    </span>
                  </label>
                ) : (
                  <>
                    <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="fp-mono opacity-70">
                          Saludo inicial
                        </span>
                        <button
                          type="button"
                          className="text-[11px] underline opacity-70"
                          onClick={() => setShowWelcome((v) => !v)}
                        >
                          {showWelcome ? 'Ocultar' : 'Configurar'}
                        </button>
                      </div>
                      {showWelcome ? (
                        <input
                          className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                          value={form.welcome_message}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              welcome_message: e.target.value,
                            }))
                          }
                          placeholder="Hola, soy Ana de Mi Empresa…"
                        />
                      ) : (
                        <p className="text-[12px] opacity-50">
                          {form.welcome_message
                            ? 'Saludo configurado (oculto).'
                            : 'Sin saludo personalizado.'}
                        </p>
                      )}
                    </label>

                    <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                      <span className="fp-mono opacity-70">
                        Formulario de leads
                      </span>
                      <select
                        className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                        value={form.form_id || ''}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, form_id: e.target.value }))
                        }
                      >
                        <option value="">Sin formulario</option>
                        {leadForms.map((lf) => (
                          <option key={lf.id} value={lf.id}>
                            {lf.name}
                          </option>
                        ))}
                      </select>
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
                            {m.tagline ? ` · ${m.tagline}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, active: e.target.checked }))
                        }
                      />
                      Activo
                    </label>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        className="fp-mono text-[11px] underline opacity-70"
                        onClick={() => setShowAdvanced((v) => !v)}
                      >
                        {showAdvanced
                          ? 'Ocultar sistema interno'
                          : 'Ver / editar sistema interno'}
                      </button>
                    </div>

                    {showAdvanced ? (
                      <>
                        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                          <span className="fp-mono opacity-70">Objetivo</span>
                          <textarea
                            className="min-h-[72px] border-2 border-black bg-white px-3 py-2 text-[14px]"
                            value={form.objective}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                objective: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                          <span className="fp-mono opacity-70">
                            Instrucciones
                          </span>
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
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
                          <span className="fp-mono opacity-70">
                            Productos / servicios
                          </span>
                          <textarea
                            className="min-h-[88px] border-2 border-black bg-white px-3 py-2 text-[14px]"
                            value={form.products_services}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                products_services: e.target.value,
                              }))
                            }
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
                          <span className="fp-mono opacity-70">
                            Keywords handoff
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
                      </>
                    ) : null}
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    saving ||
                    !form.name.trim() ||
                    !form.company_name.trim() ||
                    (editing === 'new' && !form.brief.trim())
                  }
                  className="fp-btn fp-btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
                  onClick={saveBot}
                >
                  {saving
                    ? editing === 'new'
                      ? 'Entrenando agente…'
                      : 'Guardando…'
                    : editing === 'new'
                      ? 'Crear agente'
                      : 'Guardar'}
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
        </>
        ) : null}

        {tab === 'formularios' ? (
          <section>
            <h2 className="mb-2 text-[18px] font-semibold tracking-tight">
              Formularios de leads
            </h2>
            <p className="mb-4 max-w-2xl text-[13px] opacity-70">
              Define los campos que el agente debe pedir al cliente. Luego
              asígnalo en el agente.
            </p>
            {leadForms.length === 0 && editingForm !== 'new' ? (
              <p className="text-[13px] opacity-60">Aún no hay formularios.</p>
            ) : (
              <ul className="mb-6 flex flex-col gap-2">
                {leadForms.map((lf) => (
                  <li
                    key={lf.id}
                    className="flex flex-wrap items-start gap-3 border-2 border-black bg-white px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{lf.name}</div>
                      <p className="mt-1 text-[12px] opacity-60">
                        {(lf.fields || [])
                          .map((f) => f.label)
                          .join(' · ') || 'Sin campos'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[13px] underline"
                      onClick={() => {
                        setEditingForm(lf.id);
                        setFormDraft({
                          name: lf.name,
                          description: lf.description || '',
                          fields: (lf.fields || []).map((f) => ({
                            label: f.label,
                            field_key: f.field_key,
                            field_type: f.field_type,
                            required: f.required !== false,
                            options: f.options || '',
                          })),
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="inline-flex opacity-50 hover:opacity-100"
                      onClick={async () => {
                        if (!window.confirm('¿Eliminar formulario?')) return;
                        try {
                          await api(`/api/lead-forms/${lf.id}`, {
                            token,
                            method: 'DELETE',
                          });
                          await refresh();
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                      aria-label="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {editingForm ? (
              <div className="border-2 border-black bg-[#faf8f5] p-4 sm:p-5">
                <h3 className="mb-4 text-[16px] font-semibold">
                  {editingForm === 'new'
                    ? 'Nuevo formulario'
                    : 'Editar formulario'}
                </h3>
                <label className="mb-3 flex flex-col gap-1 text-[12px]">
                  <span className="fp-mono opacity-70">Nombre</span>
                  <input
                    className="border-2 border-black bg-white px-3 py-2 text-[14px]"
                    value={formDraft.name}
                    onChange={(e) =>
                      setFormDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Lead ventas"
                  />
                </label>
                <div className="mb-2 fp-mono text-[11px] opacity-70">
                  Campos
                </div>
                <div className="flex flex-col gap-2">
                  {formDraft.fields.map((field, idx) => (
                    <div
                      key={idx}
                      className="grid gap-2 border border-black/20 bg-white p-2 sm:grid-cols-4"
                    >
                      <input
                        className="border border-black/30 px-2 py-1.5 text-[13px] sm:col-span-2"
                        placeholder="Etiqueta"
                        value={field.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setFormDraft((d) => {
                            const fields = [...d.fields];
                            fields[idx] = {
                              ...fields[idx],
                              label,
                              field_key:
                                fields[idx].field_key ||
                                label
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '_')
                                  .replace(/^_|_$/g, ''),
                            };
                            return { ...d, fields };
                          });
                        }}
                      />
                      <select
                        className="border border-black/30 px-2 py-1.5 text-[13px]"
                        value={field.field_type}
                        onChange={(e) => {
                          setFormDraft((d) => {
                            const fields = [...d.fields];
                            fields[idx] = {
                              ...fields[idx],
                              field_type: e.target.value,
                            };
                            return { ...d, fields };
                          });
                        }}
                      >
                        <option value="text">Texto</option>
                        <option value="email">Email</option>
                        <option value="phone">Teléfono</option>
                        <option value="number">Número</option>
                        <option value="textarea">Texto largo</option>
                      </select>
                      <label className="flex items-center gap-2 text-[12px]">
                        <input
                          type="checkbox"
                          checked={field.required !== false}
                          onChange={(e) => {
                            setFormDraft((d) => {
                              const fields = [...d.fields];
                              fields[idx] = {
                                ...fields[idx],
                                required: e.target.checked,
                              };
                              return { ...d, fields };
                            });
                          }}
                        />
                        Obligatorio
                      </label>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 text-[12px] underline"
                  onClick={() =>
                    setFormDraft((d) => ({
                      ...d,
                      fields: [
                        ...d.fields,
                        {
                          label: '',
                          field_key: '',
                          field_type: 'text',
                          required: true,
                        },
                      ],
                    }))
                  }
                >
                  + Campo
                </button>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={saving || !formDraft.name.trim()}
                    className="fp-btn fp-btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
                    onClick={saveLeadForm}
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="fp-btn border-2 border-black bg-white px-4 py-2 text-[13px]"
                    onClick={() => setEditingForm(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'leads' ? (
          <section>
            <h2 className="mb-2 text-[18px] font-semibold tracking-tight">
              Leads capturados
            </h2>
            <p className="mb-4 text-[13px] opacity-70">
              Datos que los agentes fueron recopilando en los chats.
            </p>
            {leads.length === 0 ? (
              <p className="text-[13px] opacity-60">Aún no hay leads.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {leads.map((lead) => (
                  <li
                    key={lead.id}
                    className="border-2 border-black bg-white px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ChannelMark channel={lead.channel} iconOnly />
                      <span className="font-medium">
                        {lead.contact_name || lead.contact_external_id}
                      </span>
                      <span className="fp-mono text-[10px] opacity-50">
                        {lead.status}
                      </span>
                    </div>
                    <dl className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
                      {Object.entries(lead.data || {}).map(([k, v]) => (
                        <div key={k}>
                          <dt className="fp-mono text-[10px] opacity-50">
                            {k}
                          </dt>
                          <dd>{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
