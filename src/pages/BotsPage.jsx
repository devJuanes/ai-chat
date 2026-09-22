import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useOutlet,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import {
  BotIcon,
  MenuIcon,
  PlusIcon,
  TrashIcon,
  CloseIcon,
  WhatsAppIcon,
  InstagramIcon,
  FacebookIcon,
} from '../components/Icons';
import ProductsPanel from './bots/ProductsPanel';
import NotesPanel from './bots/NotesPanel';
import PipelinePanel from './bots/PipelinePanel';

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

const TABS = [
  { id: 'agentes', label: 'Agentes' },
  { id: 'canales', label: 'Canales' },
  { id: 'productos', label: 'Productos' },
  { id: 'formularios', label: 'Formularios' },
  { id: 'leads', label: 'Leads' },
  { id: 'notas', label: 'Notas' },
  { id: 'pipeline', label: 'Pipeline' },
];

const TAB_IDS = new Set(TABS.map((t) => t.id));

function ChannelMark({ channel, iconOnly = false, size = 'md' }) {
  const meta = CHANNEL_ICON[channel];
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
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

/** Green ON (right) / Red OFF (left) switch */
function StatusSwitch({ checked, onChange, disabled, labelOn = 'Activo', labelOff = 'Apagado' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? labelOn : labelOff}
      disabled={disabled}
      title={checked ? labelOn : labelOff}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-black transition disabled:opacity-50 ${
        checked ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full border-2 border-black bg-white transition-transform ${
          checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function EmptyState({ title, hint, action }) {
  return (
    <div className="flex min-h-[min(52vh,420px)] flex-col items-center justify-center px-6 py-10 text-center">
      <p className="max-w-lg text-[22px] font-semibold tracking-tight text-black sm:text-[28px]">
        {title}
      </p>
      {hint ? (
        <p className="mt-3 max-w-md text-[15px] leading-relaxed opacity-55 sm:text-[16px]">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
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
  company_website: '',
  company_knowledge: '',
  catalog_mode: 'all',
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
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};
  const auth = useAuth();
  const token = auth.getToken?.();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = TAB_IDS.has(tabParam) ? tabParam : 'agentes';

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
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [botModels, setBotModels] = useState(BOT_MODELS_FALLBACK);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const models = useMemo(
    () => (botModels.length ? botModels : BOT_MODELS_FALLBACK),
    [botModels]
  );

  const setTab = (id) => {
    navigate(`/bots/${id}`);
    setEditing(null);
    setEditingForm(null);
  };

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [botsRes, connRes, cfg, formsRes, leadsRes, modelsRes, catalogRes] =
        await Promise.all([
          api('/api/bots', { token }),
          api('/api/meta/connections', { token }),
          api('/api/meta/config', { token }),
          api('/api/lead-forms', { token }).catch(() => ({ forms: [] })),
          api('/api/leads', { token }).catch(() => ({ leads: [] })),
          api('/api/bots/models', { token }).catch(() => ({
            models: BOT_MODELS_FALLBACK,
          })),
          api('/api/catalog/products', { token }).catch(() => ({
            products: [],
          })),
        ]);
      setBots((prev) => {
        const pending = prev.filter(
          (b) => b._training || String(b.id).startsWith('pending-')
        );
        const server = botsRes.bots || [];
        const serverIds = new Set(server.map((b) => b.id));
        return [
          ...pending.filter((p) => !serverIds.has(p.id)),
          ...server,
        ];
      });
      setBindings((prev) => {
        const pendingBind = prev.filter((b) =>
          String(b.bot_id).startsWith('pending-')
        );
        return [...pendingBind, ...(botsRes.bindings || [])];
      });
      setConnections(connRes.connections || []);
      setMetaCfg(cfg);
      setLeadForms(formsRes.forms || []);
      setLeads(leadsRes.leads || []);
      if (modelsRes.models?.length) setBotModels(modelsRes.models);
      setCatalogProducts(catalogRes.products || []);
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
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 5200);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    const connected = searchParams.get('meta_connected');
    const metaError = searchParams.get('meta_error');
    if (connected != null) {
      setNotice(`Meta conectado: ${connected} canal(es)`);
      setSearchParams({}, { replace: true });
      navigate('/bots/canales', { replace: true });
      refresh();
    } else if (metaError) {
      setError(decodeURIComponent(metaError));
      setSearchParams({}, { replace: true });
      navigate('/bots/canales', { replace: true });
    }
  }, [searchParams, setSearchParams, refresh, navigate]);

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

  const openCreate = () => {
    setEditing('new');
    setForm({ ...EMPTY_BOT });
    setSelectedConnections([]);
    setSelectedProducts([]);
    setShowWelcome(false);
    setShowAdvanced(false);
  };

  const openEdit = async (bot) => {
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
      company_website: bot.company_website || '',
      company_knowledge: bot.company_knowledge || '',
      catalog_mode: bot.catalog_mode || 'all',
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
    try {
      const res = await api(`/api/bots/${bot.id}/products`, { token });
      setSelectedProducts(res.product_ids || []);
    } catch {
      setSelectedProducts([]);
    }
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || !bots.length || editing) return;
    const bot = bots.find((b) => b.id === editId && !b._training);
    if (!bot) return;
    openEdit(bot);
    setSearchParams({}, { replace: true });
    // intentionally only when edit query appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, bots]);

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

    // Create: close modal immediately and train in the background
    if (editing === 'new') {
      const draft = {
        name: form.name.trim(),
        company_name: form.company_name.trim(),
        brief: form.brief.trim(),
        model_id: form.model_id || 'matu-bot-3-5',
        connectionIds: [...selectedConnections],
        productIds: [...selectedProducts],
      };
      const tempId = `pending-${Date.now()}`;
      const pendingBot = {
        id: tempId,
        name: draft.name,
        company_name: draft.company_name,
        objective: draft.brief,
        active: true,
        model_id: draft.model_id,
        _training: true,
      };
      setBots((prev) => [pendingBot, ...prev]);
      setBindings((prev) => [
        ...draft.connectionIds.map((cid) => ({
          bot_id: tempId,
          meta_connection_id: cid,
        })),
        ...prev,
      ]);
      setEditing(null);
      setNotice('Agente en entrenamiento…');

      (async () => {
        try {
          const channels = draft.connectionIds
            .map((id) => connById[id]?.channel)
            .filter(Boolean);
          const { generated } = await api('/api/bots/generate', {
            token,
            method: 'POST',
            body: {
              name: draft.name,
              company_name: draft.company_name,
              brief: draft.brief,
              channels,
            },
          });
          const body = {
            ...generated,
            name: draft.name,
            company_name: draft.company_name,
            form_id: null,
            model_id: draft.model_id,
            active: true,
          };
          const res = await api('/api/bots', {
            token,
            method: 'POST',
            body,
          });
          const botId = res.bot.id;
          await api(`/api/bots/${botId}/bindings`, {
            token,
            method: 'PUT',
            body: { connection_ids: draft.connectionIds },
          });
          const productIds =
            draft.productIds?.length
              ? draft.productIds
              : (catalogProducts || [])
                  .filter((p) => p.active !== false)
                  .map((p) => p.id);
          if (productIds.length) {
            await api(`/api/bots/${botId}/products`, {
              token,
              method: 'PUT',
              body: { product_ids: productIds },
            });
          }
          setBots((prev) =>
            prev.map((b) =>
              b.id === tempId ? { ...res.bot, _training: false } : b
            )
          );
          setBindings((prev) => [
            ...prev.filter((b) => b.bot_id !== tempId),
            ...draft.connectionIds.map((cid) => ({
              bot_id: botId,
              meta_connection_id: cid,
            })),
          ]);
          setNotice('Agente listo');
        } catch (err) {
          setBots((prev) =>
            prev.map((b) =>
              b.id === tempId
                ? { ...b, _training: false, _error: err.message }
                : b
            )
          );
          setError(err.message || 'No se pudo entrenar el agente');
        }
      })();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        form_id: form.form_id || null,
        model_id: form.model_id || 'matu-bot-3-5',
      };
      await api(`/api/bots/${editing}`, {
        token,
        method: 'PATCH',
        body,
      });
      await api(`/api/bots/${editing}/bindings`, {
        token,
        method: 'PUT',
        body: { connection_ids: selectedConnections },
      });
      await api(`/api/bots/${editing}/products`, {
        token,
        method: 'PUT',
        body: { product_ids: selectedProducts },
      });
      setEditing(null);
      await refresh();
      setNotice('Agente guardado');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleBot = async (bot, next) => {
    if (!token) return;
    setBots((prev) =>
      prev.map((b) => (b.id === bot.id ? { ...b, active: next } : b))
    );
    try {
      await api(`/api/bots/${bot.id}`, {
        token,
        method: 'PATCH',
        body: { active: next },
      });
    } catch (err) {
      setBots((prev) =>
        prev.map((b) => (b.id === bot.id ? { ...b, active: !next } : b))
      );
      setError(err.message);
    }
  };

  const toggleForm = async (lf, next) => {
    if (!token) return;
    setLeadForms((prev) =>
      prev.map((f) => (f.id === lf.id ? { ...f, active: next } : f))
    );
    try {
      await api(`/api/lead-forms/${lf.id}`, {
        token,
        method: 'PATCH',
        body: { active: next },
      });
    } catch (err) {
      setLeadForms((prev) =>
        prev.map((f) => (f.id === lf.id ? { ...f, active: !next } : f))
      );
      setError(err.message);
    }
  };

  const toggleConnection = async (c, next) => {
    if (!token) return;
    const nextStatus = next ? 'active' : 'disconnected';
    const prevStatus = c.status;
    setConnections((prev) =>
      prev.map((row) =>
        row.id === c.id ? { ...row, status: nextStatus } : row
      )
    );
    if (!next) {
      setBindings((prev) =>
        prev.filter((b) => b.meta_connection_id !== c.id)
      );
    }
    try {
      await api(`/api/meta/connections/${c.id}`, {
        token,
        method: 'PATCH',
        body: { status: nextStatus },
      });
    } catch (err) {
      setConnections((prev) =>
        prev.map((row) =>
          row.id === c.id ? { ...row, status: prevStatus } : row
        )
      );
      setError(err.message);
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
      setNotice('Formulario guardado');
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

  if (!TAB_IDS.has(tabParam)) {
    return <Navigate to="/bots/agentes" replace />;
  }

  const tabClass = (id) =>
    `rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
      tab === id
        ? 'bg-black text-[#f4ed36]'
        : 'bg-transparent text-black hover:bg-black/5'
    }`;

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[56px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black md:hidden"
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
          className="ml-1 flex w-fit shrink-0 items-center gap-0.5 rounded-full border-2 border-black p-1"
          style={{ background: '#fff' }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tabClass(t.id)}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1" />
        <Link
          to="/inbox"
          className="fp-mono hidden shrink-0 text-[11px] underline sm:inline"
        >
          Ir al inbox
        </Link>
        {tab === 'agentes' ? (
          <button
            type="button"
            className="fp-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] font-medium"
            onClick={openCreate}
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo agente
          </button>
        ) : null}
        {tab === 'formularios' ? (
          <button
            type="button"
            className="fp-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] font-medium"
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
        {tab === 'productos' ? (
          <button
            type="button"
            className="fp-btn inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] font-medium"
            onClick={() => {
              // ProductsPanel owns its modal; signal via custom event
              window.dispatchEvent(new CustomEvent('bots:new-product'));
            }}
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo producto
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {notice ? (
          <div className="pointer-events-none fixed left-1/2 top-4 z-[95] w-[min(92vw,360px)] -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0">
            <div className="pointer-events-auto inline-flex w-full max-w-full items-start gap-2 rounded-xl border-2 border-black bg-[#b5c995] px-3 py-2 text-[13px] shadow-[4px_4px_0_#000]">
              <span className="min-w-0 flex-1">{notice}</span>
              <button
                type="button"
                className="shrink-0 opacity-60 hover:opacity-100"
                onClick={() => setNotice(null)}
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="pointer-events-none fixed left-1/2 top-4 z-[95] w-[min(92vw,360px)] -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0">
            <div
              className={`pointer-events-auto inline-flex w-full max-w-full items-start gap-2 rounded-xl border-2 border-black bg-[#f8c1ba] px-3 py-2 text-[13px] shadow-[4px_4px_0_#000] ${
                notice ? 'mt-14' : ''
              }`}
            >
              <span className="min-w-0 flex-1">{error}</span>
              <button
                type="button"
                className="shrink-0 opacity-60 hover:opacity-100"
                onClick={() => setError(null)}
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {tab === 'canales' ? (
          <section>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={connecting || !metaCfg?.configured}
                className="fp-btn rounded-lg border-2 border-black bg-white px-3 py-1.5 text-[13px] disabled:opacity-50"
                onClick={connectPages}
              >
                {connecting ? 'Conectando…' : 'Conectar Facebook / Instagram'}
              </button>
              <button
                type="button"
                disabled={connecting || !metaCfg?.configured}
                className="fp-btn rounded-lg border-2 border-black bg-[#f4ed36] px-3 py-1.5 text-[13px] font-medium disabled:opacity-50"
                onClick={connectWhatsApp}
              >
                WhatsApp Embedded Signup
              </button>
            </div>
            {!metaCfg?.configured ? (
              <p className="mb-3 text-center text-[12px] opacity-60">
                El servidor aún no tiene las variables META_* configuradas.
              </p>
            ) : null}
            {connections.length === 0 ? (
              <EmptyState
                title="Ningún canal conectado"
                hint="Conecta WhatsApp, Instagram o Facebook para empezar a recibir mensajes."
              />
            ) : (
              <>
                <h2 className="mb-1 text-[18px] font-semibold tracking-tight">
                  Canales Meta
                </h2>
                <p className="mb-4 max-w-2xl text-[13px] opacity-70">
                  WhatsApp, Instagram y Facebook son canales separados. Activa o
                  apaga cada uno con el switch.
                </p>
                <ul className="flex flex-col gap-2">
                  {connections.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-black bg-white px-3 py-2.5"
                    >
                      <ChannelMark channel={c.channel} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                        {c.display_name}
                      </span>
                      <StatusSwitch
                        checked={c.status === 'active'}
                        onChange={(next) => toggleConnection(c, next)}
                        labelOn="Canal activo"
                        labelOff="Canal apagado"
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ) : null}

        {tab === 'agentes' ? (
          <section>
            {loading || bots.length === 0 ? null : (
              <>
                <h2 className="mb-1 text-[18px] font-semibold tracking-tight">
                  Tus agentes
                </h2>
                <p className="mb-4 text-[13px] opacity-70">
                  Crea un agente, asígnalo a canales y actívalo o apágalo con el
                  switch.
                </p>
              </>
            )}
            {loading ? (
              <EmptyState title="Cargando…" />
            ) : bots.length === 0 ? (
              <EmptyState
                title="Aún no tienes agentes"
                hint="Crea un agente, asígnalo a tus canales y actívalo o apágalo con el switch."
                action={
                  <button
                    type="button"
                    className="fp-btn inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[14px] font-medium"
                    onClick={openCreate}
                  >
                    <PlusIcon className="h-4 w-4" />
                    Nuevo agente
                  </button>
                }
              />
            ) : (
              <ul className="mb-6 flex flex-col gap-2">
                {bots.map((bot) => (
                  <li key={bot.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (bot._training || bot.id.startsWith('pending-')) return;
                        navigate(`/bots/agentes/${bot.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (bot._training || bot.id.startsWith('pending-'))
                            return;
                          navigate(`/bots/agentes/${bot.id}`);
                        }
                      }}
                      className={`flex w-full flex-wrap items-start gap-3 rounded-xl border-2 border-black bg-white px-3 py-3 text-left transition ${
                        bot._training
                          ? 'cursor-wait opacity-90'
                          : 'cursor-pointer hover:bg-[#faf8f5]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{bot.name}</span>
                          {bot.company_name ? (
                            <span className="text-[12px] opacity-50">
                              · {bot.company_name}
                            </span>
                          ) : null}
                          {bot._training ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#f4ed36] px-2 py-0.5 text-[11px] font-medium">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black" />
                              Entrenando…
                            </span>
                          ) : null}
                          {bot._error ? (
                            <span className="rounded-full border border-[#ef4444] bg-[#f8c1ba] px-2 py-0.5 text-[11px]">
                              Error
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] opacity-70">
                          {bot._training
                            ? 'MatuBot está preparando el guion del agente…'
                            : bot._error || bot.objective || 'Sin objetivo'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(bindingsByBot[bot.id] || []).map((cid) => {
                            const c = connById[cid];
                            if (!c) return null;
                            return (
                              <span
                                key={cid}
                                className="inline-flex items-center gap-1 rounded-full border border-black/30 px-2 py-0.5 text-black"
                                title={CHANNEL_LABEL[c.channel]}
                              >
                                <ChannelMark
                                  channel={c.channel}
                                  iconOnly
                                  size="sm"
                                />
                                <span className="fp-mono text-[10px]">
                                  {CHANNEL_LABEL[c.channel]}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusSwitch
                          checked={bot.active !== false}
                          onChange={(next) => toggleBot(bot, next)}
                          disabled={bot._training || Boolean(bot._error)}
                        />
                        <button
                          type="button"
                          disabled={bot._training || bot.id.startsWith('pending-')}
                          className="rounded-lg border-2 border-black bg-[#f4ed36] px-2.5 py-1 text-[12px] font-medium disabled:opacity-40"
                          onClick={() => openEdit(bot)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="inline-flex rounded-lg border-2 border-black bg-white p-1.5 opacity-70 hover:opacity-100"
                          onClick={() => {
                            if (bot.id.startsWith('pending-')) {
                              setBots((prev) =>
                                prev.filter((b) => b.id !== bot.id)
                              );
                              setBindings((prev) =>
                                prev.filter((b) => b.bot_id !== bot.id)
                              );
                              return;
                            }
                            deleteBot(bot.id);
                          }}
                          aria-label="Eliminar"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'formularios' ? (
          <section>
            {leadForms.length === 0 ? null : (
              <>
                <h2 className="mb-1 text-[18px] font-semibold tracking-tight">
                  Formularios de leads
                </h2>
                <p className="mb-4 max-w-2xl text-[13px] opacity-70">
                  Define los campos que el agente pedirá. Haz clic en la tarjeta
                  para editar.
                </p>
              </>
            )}
            {leadForms.length === 0 ? (
              <EmptyState
                title="Aún no hay formularios"
                hint="Define los campos que el agente pedirá al cliente y luego asígnalo en el agente."
                action={
                  <button
                    type="button"
                    className="fp-btn inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[14px] font-medium"
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
                }
              />
            ) : (
              <ul className="mb-6 flex flex-col gap-2">
                {leadForms.map((lf) => (
                  <li key={lf.id}>
                    <div
                      role="button"
                      tabIndex={0}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
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
                        }
                      }}
                      className="flex w-full cursor-pointer flex-wrap items-start gap-3 rounded-xl border-2 border-black bg-white px-3 py-3 text-left transition hover:bg-[#faf8f5]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{lf.name}</div>
                        <p className="mt-1 text-[12px] opacity-60">
                          {(lf.fields || []).map((f) => f.label).join(' · ') ||
                            'Sin campos'}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusSwitch
                          checked={lf.active !== false}
                          onChange={(next) => toggleForm(lf, next)}
                        />
                        <button
                          type="button"
                          className="rounded-lg border-2 border-black bg-[#f4ed36] px-2.5 py-1 text-[12px] font-medium"
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
                          className="inline-flex rounded-lg border-2 border-black bg-white p-1.5 opacity-70 hover:opacity-100"
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
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'productos' ? (
          <ProductsPanel
            token={token}
            onNotice={setNotice}
            onError={setError}
          />
        ) : null}

        {tab === 'notas' ? (
          <NotesPanel token={token} onError={setError} />
        ) : null}

        {tab === 'pipeline' ? (
          <PipelinePanel
            token={token}
            onError={setError}
            onNotice={setNotice}
          />
        ) : null}

        {tab === 'leads' ? (
          <section>
            {leads.length === 0 ? null : (
              <>
                <h2 className="mb-1 text-[18px] font-semibold tracking-tight">
                  Leads capturados
                </h2>
                <p className="mb-4 text-[13px] opacity-70">
                  Datos que los agentes fueron recopilando en los chats.
                </p>
              </>
            )}
            {leads.length === 0 ? (
              <EmptyState
                title="Aún no hay leads"
                hint="Cuando los agentes capturen datos en los chats, aparecerán aquí."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {leads.map((lead) => (
                  <li
                    key={lead.id}
                    className="rounded-xl border-2 border-black bg-white px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ChannelMark channel={lead.channel} iconOnly />
                      <span className="font-medium">
                        {lead.contact_name || lead.contact_external_id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          lead.status === 'complete'
                            ? 'bg-[#22c55e]/20 text-[#166534]'
                            : 'bg-[#f4ed36]/50 text-black'
                        }`}
                      >
                        {lead.status === 'complete' ? 'completo' : 'parcial'}
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

      {editing ? (
        <BotEditor
          editing={editing}
          form={form}
          setForm={setForm}
          selectedConnections={selectedConnections}
          setSelectedConnections={setSelectedConnections}
          selectedProducts={selectedProducts}
          setSelectedProducts={setSelectedProducts}
          catalogProducts={catalogProducts}
          connections={connections}
          leadForms={leadForms}
          models={models}
          showWelcome={showWelcome}
          setShowWelcome={setShowWelcome}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          saving={saving}
          onSave={saveBot}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {editingForm ? (
        <FormEditor
          editingForm={editingForm}
          formDraft={formDraft}
          setFormDraft={setFormDraft}
          saving={saving}
          onSave={saveLeadForm}
          onCancel={() => setEditingForm(null)}
        />
      ) : null}
    </main>
  );
}

function ModalShell({ open, title, subtitle, onClose, children, wide, bodyClassName }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bots-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border-2 border-black bg-[#faf8f5] shadow-[6px_6px_0_#000] sm:rounded-2xl ${
          wide ? 'sm:max-w-[720px]' : 'sm:max-w-[560px]'
        }`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b-2 border-black px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h3
              id="bots-modal-title"
              className="text-[16px] font-semibold tracking-tight"
            >
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-[13px] opacity-70">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-[#f4ed36]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 px-4 py-4 sm:px-5 ${
            bodyClassName || 'overflow-y-auto'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function BotEditor({
  editing,
  form,
  setForm,
  selectedConnections,
  setSelectedConnections,
  selectedProducts = [],
  setSelectedProducts,
  catalogProducts = [],
  connections,
  leadForms,
  models,
  showWelcome,
  setShowWelcome,
  showAdvanced,
  setShowAdvanced,
  saving,
  onSave,
  onCancel,
}) {
  const isNew = editing === 'new';
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  useEffect(() => {
    if (isNew) setStep(1);
  }, [isNew, editing]);

  const activeConnections = connections.filter((c) => c.status === 'active');
  const stepMeta = [
    {
      title: 'Canales',
      subtitle: 'Elige dónde responderá este agente.',
    },
    {
      title: 'Identidad',
      subtitle: 'Nombre del agente y de tu empresa.',
    },
    {
      title: 'Objetivo',
      subtitle: 'Describe qué debe hacer. MatuBot 3.5 entrena el resto.',
    },
  ];

  const canNext =
    step === 1
      ? selectedConnections.length > 0
      : step === 2
        ? form.name.trim() && form.company_name.trim()
        : form.brief.trim();

  const allSelected =
    activeConnections.length > 0 &&
    activeConnections.every((c) => selectedConnections.includes(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedConnections([]);
    } else {
      setSelectedConnections(activeConnections.map((c) => c.id));
    }
  };

  const channelsBlock = (
    <div className="flex h-full min-h-0 flex-col">
      {activeConnections.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-black/30 bg-white px-4 py-6 text-center text-[13px] opacity-60">
          Conecta un canal en la pestaña Canales primero.
        </p>
      ) : (
        <div className="flex h-full min-h-0 max-h-[min(52vh,420px)] flex-col overflow-hidden rounded-xl border-2 border-black bg-white">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-black bg-[#faf8f5] px-3 py-2">
            <span className="text-[12px] opacity-60">
              {selectedConnections.length} de {activeConnections.length}{' '}
              seleccionados
            </span>
            <div className="flex-1" />
            <button
              type="button"
              className="rounded-lg border-2 border-black bg-[#f4ed36] px-2.5 py-1 text-[12px] font-medium"
              onClick={toggleSelectAll}
            >
              {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {activeConnections.map((c, idx) => {
              const checked = selectedConnections.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-3 text-[13px] transition hover:bg-[#f4ed36]/20 ${
                    checked ? 'bg-[#f4ed36]/30' : 'bg-white'
                  } ${
                    idx < activeConnections.length - 1
                      ? 'border-b border-black/10'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-black"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedConnections((prev) =>
                        e.target.checked
                          ? [...prev, c.id]
                          : prev.filter((x) => x !== c.id)
                      );
                    }}
                  />
                  <ChannelMark channel={c.channel} iconOnly />
                  <span className="fp-mono shrink-0 text-[10px] uppercase opacity-60">
                    {CHANNEL_LABEL[c.channel]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.display_name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (isNew) {
    return (
      <ModalShell
        open
        wide
        title={`Nuevo agente · Paso ${step} de ${totalSteps}`}
        subtitle={stepMeta[step - 1].subtitle}
        onClose={onCancel}
        bodyClassName={
          step === 1
            ? 'flex min-h-0 flex-col overflow-hidden'
            : 'overflow-y-auto'
        }
      >
        <div className="mb-4 flex shrink-0 items-center gap-2">
          {stepMeta.map((s, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={s.title} className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black text-[11px] font-semibold ${
                    active
                      ? 'bg-[#f4ed36]'
                      : done
                        ? 'bg-[#22c55e] text-white'
                        : 'bg-white opacity-50'
                  }`}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  className={`hidden truncate text-[12px] font-medium sm:inline ${
                    active ? '' : 'opacity-45'
                  }`}
                >
                  {s.title}
                </span>
                {n < totalSteps ? (
                  <div
                    className={`mx-1 hidden h-0.5 flex-1 sm:block ${
                      done ? 'bg-black' : 'bg-black/20'
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <h4 className="mb-3 shrink-0 text-[18px] font-semibold tracking-tight">
          {stepMeta[step - 1].title}
        </h4>

        <div className={step === 1 ? 'min-h-0 flex-1 overflow-hidden' : ''}>
          {step === 1 ? channelsBlock : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[12px]">
                <span className="fp-mono opacity-70">Nombre del agente</span>
                <input
                  className="rounded-lg border-2 border-black bg-white px-3 py-2.5 text-[15px]"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ana"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px]">
                <span className="fp-mono opacity-70">Nombre de la empresa</span>
                <input
                  className="rounded-lg border-2 border-black bg-white px-3 py-2.5 text-[15px]"
                  value={form.company_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company_name: e.target.value }))
                  }
                  placeholder="Escribe tu empresa (no el correo)"
                />
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <label className="flex flex-col gap-1.5 text-[12px]">
              <span className="fp-mono opacity-70">
                ¿Qué quieres que haga este agente?
              </span>
              <textarea
                className="min-h-[160px] rounded-lg border-2 border-black bg-white px-3 py-2.5 text-[15px] leading-relaxed"
                value={form.brief}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brief: e.target.value }))
                }
                placeholder="Ej: Vender mis planes de internet fibra en Bogotá, calificar leads, pedir nombre y barrio, y agendar visita técnica."
                autoFocus
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4 shrink-0 border-t-2 border-black pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {step > 1 ? (
              <button
                type="button"
                className="fp-btn rounded-lg border-2 border-black bg-white px-4 py-2 text-[13px]"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
              >
                Atrás
              </button>
            ) : (
              <button
                type="button"
                className="fp-btn rounded-lg border-2 border-black bg-white px-4 py-2 text-[13px]"
                onClick={onCancel}
              >
                Cancelar
              </button>
            )}
            <div className="flex-1" />
            {step < totalSteps ? (
              <button
                type="button"
                disabled={!canNext}
                className="fp-btn rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
                onClick={() => setStep((s) => s + 1)}
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || !canNext}
                className="fp-btn rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
                onClick={onSave}
              >
                {saving ? 'Entrenando agente…' : 'Crear agente'}
              </button>
            )}
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      open
      wide
      title="Editar agente"
      subtitle="Ajusta identidad, canales y (si quieres) la configuración avanzada."
      onClose={onCancel}
    >
      <div className="mb-4">
        <div className="fp-mono mb-2 text-[11px] opacity-70">Canales</div>
        {channelsBlock}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="fp-mono opacity-70">Nombre del agente</span>
          <input
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ana"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="fp-mono opacity-70">Nombre de la empresa</span>
          <input
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
            value={form.company_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, company_name: e.target.value }))
            }
            placeholder="Escribe tu empresa (no el correo)"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span className="fp-mono opacity-70">Saludo inicial</span>
            <button
              type="button"
              className="rounded-full border border-black/30 px-2 py-0.5 text-[11px]"
              onClick={() => setShowWelcome((v) => !v)}
            >
              {showWelcome ? 'Ocultar' : 'Configurar'}
            </button>
          </div>
          {showWelcome ? (
            <input
              className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
              value={form.welcome_message}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  welcome_message: e.target.value,
                }))
              }
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
          <span className="fp-mono opacity-70">Formulario de leads</span>
          <select
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
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
        <div className="sm:col-span-2">
          <div className="fp-mono mb-2 text-[11px] opacity-70">
            Acceso al catálogo
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {[
              ['all', 'Todo el catálogo'],
              ['selected', 'Solo productos elegidos'],
              ['none', 'Sin productos'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-lg border-2 border-black px-2.5 py-1 text-[12px] ${
                  (form.catalog_mode || 'all') === id
                    ? 'bg-[#f4ed36] font-medium'
                    : 'bg-white'
                }`}
                onClick={() =>
                  setForm((f) => ({ ...f, catalog_mode: id }))
                }
              >
                {label}
              </button>
            ))}
          </div>
          {(form.catalog_mode || 'all') === 'selected' ? (
            (catalogProducts || []).filter((p) => p.active !== false).length ===
            0 ? (
              <p className="text-[12px] opacity-50">
                Crea productos en la pestaña Productos primero.
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border-2 border-black bg-white p-2">
                {(catalogProducts || [])
                  .filter((p) => p.active !== false)
                  .map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-[13px]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(p.id)}
                        onChange={(e) => {
                          setSelectedProducts((prev) =>
                            e.target.checked
                              ? [...prev, p.id]
                              : prev.filter((x) => x !== p.id)
                          );
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    </label>
                  ))}
              </div>
            )
          ) : (form.catalog_mode || 'all') === 'all' ? (
            <p className="text-[12px] opacity-60">
              El agente verá todos los productos activos del catálogo.
            </p>
          ) : (
            <p className="text-[12px] opacity-60">
              El agente no ofrecerá productos; solo califica y escala.
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
          <span className="fp-mono opacity-70">Web de la empresa</span>
          <input
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
            value={form.company_website || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, company_website: e.target.value }))
            }
            placeholder="https://…"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] sm:col-span-2">
          <span className="fp-mono opacity-70">
            Conocimiento de la empresa
          </span>
          <textarea
            className="min-h-[72px] rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
            value={form.company_knowledge || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, company_knowledge: e.target.value }))
            }
            placeholder="Qué hace tu empresa, metas, tono, lo que el agente debe saber…"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="fp-mono opacity-70">Modelo</span>
          <select
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
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
            {[
              ['objective', 'Objetivo'],
              ['instructions', 'Instrucciones'],
              ['business_context', 'Contexto del negocio'],
              ['products_services', 'Productos / servicios'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex flex-col gap-1 text-[12px] sm:col-span-2"
              >
                <span className="fp-mono opacity-70">{label}</span>
                <textarea
                  className="min-h-[72px] rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="fp-mono opacity-70">Tono</span>
              <input
                className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
                value={form.tone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tone: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="fp-mono opacity-70">Keywords handoff</span>
              <input
                className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
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
      </div>

      <div className="sticky bottom-0 -mx-4 mt-5 border-t-2 border-black bg-[#faf8f5] px-4 py-3 sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              saving || !form.name.trim() || !form.company_name.trim()
            }
            className="fp-btn rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            onClick={onSave}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="fp-btn rounded-lg border-2 border-black bg-white px-4 py-2 text-[13px]"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function FormEditor({
  editingForm,
  formDraft,
  setFormDraft,
  saving,
  onSave,
  onCancel,
}) {
  return (
    <ModalShell
      open
      title={editingForm === 'new' ? 'Nuevo formulario' : 'Editar formulario'}
      subtitle="Define los campos que el agente pedirá al cliente."
      onClose={onCancel}
    >
      <label className="mb-3 flex flex-col gap-1 text-[12px]">
        <span className="fp-mono opacity-70">Nombre</span>
        <input
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-[14px]"
          value={formDraft.name}
          onChange={(e) =>
            setFormDraft((d) => ({ ...d, name: e.target.value }))
          }
          placeholder="Lead ventas"
        />
      </label>
      <div className="fp-mono mb-2 text-[11px] opacity-70">Campos</div>
      <div className="flex flex-col gap-2">
        {formDraft.fields.map((field, idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-lg border border-black/20 bg-white p-2 sm:grid-cols-4"
          >
            <input
              className="rounded-md border border-black/30 px-2 py-1.5 text-[13px] sm:col-span-2"
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
              className="rounded-md border border-black/30 px-2 py-1.5 text-[13px]"
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
      <div className="sticky bottom-0 -mx-4 mt-4 border-t-2 border-black bg-[#faf8f5] px-4 py-3 sm:-mx-5 sm:px-5">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || !formDraft.name.trim()}
            className="fp-btn rounded-lg border-2 border-black bg-[#f4ed36] px-4 py-2 text-[13px] font-medium disabled:opacity-50"
            onClick={onSave}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="fp-btn rounded-lg border-2 border-black bg-white px-4 py-2 text-[13px]"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
