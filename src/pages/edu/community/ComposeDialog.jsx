import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { refreshPulse } from '../pulse';
import { KINDS } from './format';
import { ImageField } from './liveui';
import { useCommunity } from './CommunityContext';

const EMPTY = {
  title: '',
  body: '',
  tags: '',
  tech: '',
  image_url: '',
  code: '',
  link: '',
  starts_at: '',
  ends_at: '',
  place: '',
  price_coins: '0',
};

const LIVE = {
  challenge: { title: 'Nuevo reto', path: '/api/edu/challenges', to: '/edu/comunidad/retos', dated: true },
  project: { title: 'Nuevo proyecto', path: '/api/edu/projects', to: '/edu/comunidad/proyectos' },
  group: { title: 'Nuevo grupo', path: '/api/edu/groups', to: '/edu/comunidad/grupos', session: true },
  event: { title: 'Nuevo evento', path: '/api/edu/events', to: '/edu/comunidad/eventos', dated: true, price: true },
};

export default function ComposeDialog() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { composing, setComposing, draftKind, publish } = useCommunity();
  const [kind, setKind] = useState(draftKind);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const live = LIVE[draftKind];

  useEffect(() => {
    if (!composing) return undefined;
    setKind(draftKind === 'hilo' ? 'pregunta' : draftKind);
    setForm(EMPTY);
    setError('');
    const onKey = (event) => {
      if (event.key === 'Escape') setComposing(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [composing, draftKind, setComposing]);

  if (!composing) return null;

  const hint = KINDS.find((item) => item.id === kind)?.hint;
  const canPublish = form.title.trim().length >= 4 && form.body.trim().length >= 4;
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !canPublish) return;
    setBusy(true);
    setError('');
    try {
      if (!live) {
        await publish({
          kind: KINDS.some((item) => item.id === kind) ? kind : 'debate',
          title: form.title,
          body: form.body,
          tags: form.tags,
          tech: form.tech,
          image_url: form.image_url,
          code: form.code,
        });
        setForm(EMPTY);
        return;
      }
      const json = await api(live.path, {
        method: 'POST',
        token: auth.getToken(),
        body: {
          title: form.title,
          body: form.body,
          tech: form.tech,
          link: form.link,
          image_url: form.image_url,
          starts_at: form.starts_at,
          ends_at: form.ends_at,
          place: form.place,
          price_coins: Number(form.price_coins) || 0,
        },
      });
      refreshPulse(auth.getToken());
      setComposing(false);
      setForm(EMPTY);
      const id = json.group?.id || json.challenge?.id;
      navigate(id && draftKind === 'group' ? `/edu/comunidad/grupos/${id}` : live.to);
    } catch (err) {
      setError(err.message || 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="edu-forum-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) setComposing(false);
      }}
    >
      <form
        className="edu-forum-dialog edu-forum-form edu-cm-compose"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edu-cm-compose-title"
        onSubmit={submit}
      >
        <h2 id="edu-cm-compose-title">{live ? live.title : 'Nueva publicación'}</h2>
        {live ? null : (
          <>
            <div className="edu-cm-kinds" role="radiogroup" aria-label="Tipo de publicación">
              {KINDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === item.id}
                  className={kind === item.id ? 'is-on' : undefined}
                  onClick={() => setKind(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="edu-cm-hint">{hint}</p>
          </>
        )}
        <input autoFocus value={form.title} onChange={set('title')} placeholder="Título" maxLength={140} aria-label="Título" />
        <textarea
          value={form.body}
          onChange={set('body')}
          placeholder={live ? 'Describe de qué se trata.' : 'Cuéntalo con el detalle que a ti te hubiera servido.'}
          maxLength={4000}
          aria-label="Contenido"
        />
        {live?.dated ? (
          <div className="edu-cm-pair">
            <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} aria-label="Inicio" />
            <input type="datetime-local" value={form.ends_at} onChange={set('ends_at')} aria-label="Cierre" />
          </div>
        ) : null}
        {draftKind === 'challenge' || draftKind === 'project' ? (
          <input value={form.tech} onChange={set('tech')} placeholder="Tecnología" maxLength={40} aria-label="Tecnología" />
        ) : null}
        {draftKind === 'project' ? (
          <input value={form.link} onChange={set('link')} placeholder="Enlace https, si tienes" maxLength={240} aria-label="Enlace" />
        ) : null}
        {live?.session ? (
          <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} aria-label="Próxima sesión" />
        ) : null}
        {live?.price ? (
          <div className="edu-cm-pair">
            <input value={form.place} onChange={set('place')} placeholder="Lugar" maxLength={140} aria-label="Lugar" />
            <input value={form.price_coins} onChange={set('price_coins')} inputMode="numeric" placeholder="Edu Coins" aria-label="Precio en Edu Coins" />
          </div>
        ) : null}
        {!live ? (
          <div className="edu-cm-pair">
            <input value={form.tags} onChange={set('tags')} placeholder="Etiquetas, separadas por coma" maxLength={80} aria-label="Etiquetas" />
            <input value={form.tech} onChange={set('tech')} placeholder="Tecnología" maxLength={40} aria-label="Tecnología" />
          </div>
        ) : null}
        <ImageField token={auth.getToken()} onUrl={(url) => setForm((prev) => ({ ...prev, image_url: url }))} />
        {!live ? (
          <textarea
            value={form.code}
            onChange={set('code')}
            placeholder="Código, si hace falta"
            maxLength={4000}
            aria-label="Código"
            className="edu-cm-code"
          />
        ) : null}
        {error ? <div className="edu-error">{error}</div> : null}
        <div className="edu-forum-dialog-actions">
          <button type="button" className="edu-btn-ghost" onClick={() => setComposing(false)}>
            Cerrar
          </button>
          <button className="edu-btn" type="submit" disabled={busy || !canPublish}>
            {busy ? 'Guardando…' : live ? 'Crear' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
}
