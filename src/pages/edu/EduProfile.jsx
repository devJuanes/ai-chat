import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Bookmark,
  Camera,
  Check,
  Eye,
  GraduationCap,
  ImagePlus,
  Lightbulb,
  Link2,
  Lock,
  Pencil,
  Search,
  Share2,
  Star,
  User,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import LoadingRing from '../../components/LoadingRing';
import { uploadImage } from './community/live';
import { refreshPulse } from './pulse';
import EduCrop from './EduCrop';

const BIO_MAX = 300;

function CardArt() {
  return (
    <svg className="edu-profile-art" viewBox="0 0 92 92" aria-hidden="true">
      <rect x="18" y="16" width="52" height="64" rx="8" fill="#d6f25c" />
      <rect x="28" y="28" width="32" height="22" rx="6" fill="#182216" />
      <circle cx="44" cy="36" r="5" fill="#d6f25c" />
      <path d="M34 46c2-3 4-4 10-4s8 1 10 4" fill="none" stroke="#d6f25c" strokeWidth="2" />
      <path d="M62 58l12 8-8 2 2 10-8-8-6 4 8-16z" fill="#f6f1e7" />
    </svg>
  );
}

export default function EduProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const token = auth.getToken();
  const myId = auth.user?.id || '';
  const [profile, setProfile] = useState(null);
  const [own, setOwn] = useState(!userId || userId === myId);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [draft, setDraft] = useState('');
  const [avatar, setAvatar] = useState('');
  const [cover, setCover] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [ready, setReady] = useState(false);
  const [crop, setCrop] = useState(null);
  const [share, setShare] = useState(false);

  function applyCard(card) {
    setProfile(card);
    setName(card?.name || '');
    setBio(card?.bio || '');
    setInterests(card?.interests || []);
    setAvatar(card?.avatar_url || '');
    setCover(card?.cover_url || '');
    setOwn(!userId || card?.id === myId);
  }

  useEffect(() => {
    if (!token) return undefined;
    let stop = false;
    setReady(false);
    setError('');
    const path = !userId || userId === myId ? '/api/edu/profile' : `/api/edu/profile/${userId}`;
    api(path, { token })
      .then((json) => {
        if (stop) return;
        applyCard(json.profile);
        setReady(true);
      })
      .catch((err) => {
        if (stop) return;
        setError(err.message || 'No se pudo abrir el perfil');
        setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [token, myId, userId]);

  useEffect(() => {
    if (profile?.slug && userId && userId !== profile.slug) {
      navigate(`/edu/perfil/${profile.slug}`, { replace: true });
    }
  }, [profile?.slug, userId, navigate]);

  function addInterest() {
    const label = draft.trim().slice(0, 28);
    if (!label) return;
    setInterests((current) => {
      if (current.some((item) => item.toLocaleLowerCase('es') === label.toLocaleLowerCase('es'))) return current;
      if (current.length >= 8) return current;
      return [...current, label];
    });
    setDraft('');
  }

  function pickImage(kind) {
    return (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError('Usa una imagen JPG, PNG o WebP.');
        return;
      }
      setError('');
      setCrop({ kind, url: URL.createObjectURL(file) });
    };
  }

  async function useCropped(file) {
    const preview = URL.createObjectURL(file);
    if (crop?.kind === 'cover') setCover(preview);
    else setAvatar(preview);
    try {
      const remote = await uploadImage(token, file);
      const body = crop?.kind === 'cover' ? { cover_url: remote } : { avatar_url: remote };
      const json = await api('/api/edu/profile', { method: 'POST', token, body });
      applyCard(json.profile);
      refreshPulse(token);
      setNote(crop?.kind === 'cover' ? 'Portada guardada.' : 'Foto de perfil guardada.');
      if (crop?.url) URL.revokeObjectURL(crop.url);
      URL.revokeObjectURL(preview);
      setCrop(null);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la foto');
      throw err;
    }
  }

  function closeCrop() {
    if (crop?.url) URL.revokeObjectURL(crop.url);
    setCrop(null);
  }

  async function save(event) {
    event.preventDefault();
    setBusy('guardar');
    setError('');
    setNote('');
    try {
      const json = await api('/api/edu/profile', {
        method: 'POST',
        token,
        body: { name, bio, interests },
      });
      applyCard(json.profile);
      setNote('Perfil guardado.');
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setBusy('');
    }
  }

  const publicUrl = profile?.slug || profile?.id
    ? `${window.location.origin}/edu/perfil/${profile.slug || profile.id}`
    : '';

  async function nativeShare() {
    if (!publicUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: name || 'Perfil en EduCreator',
        text: `Mira el perfil de ${name || 'este estudiante'} en EduCreator`,
        url: publicUrl,
      });
      setShare(false);
    } catch (err) {
      if (err?.name !== 'AbortError') setNote(publicUrl);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setNote('Enlace copiado.');
      setShare(false);
    } catch {
      setNote(publicUrl);
    }
  }

  if (!ready) {
    return (
      <div className="edu-home edu-fill" style={{ display: 'grid', placeItems: 'center' }}>
        <LoadingRing />
      </div>
    );
  }

  const steps = [
    { ok: Boolean(avatar), label: 'Agrega una foto' },
    { ok: Boolean(bio.trim()), label: 'Escribe una breve biografía' },
    { ok: interests.length > 0, label: 'Añade tus intereses' },
  ];
  const whatsapp = publicUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Perfil de ${name || 'un estudiante'} en EduCreator ${publicUrl}`)}`
    : '';

  return (
    <div className="edu-home edu-profile-page">
      <div className="edu-profile-grid">
        <section className="edu-profile-main">
          <div className="edu-profile-cover">
            {cover ? <img src={cover} alt="" /> : <GraduationCap className="edu-profile-cap" />}
            {own ? (
              <button type="button" onClick={() => document.getElementById('edu-cover-file')?.click()}>
                <ImagePlus size={14} />
                Cambiar portada
              </button>
            ) : null}
          </div>
          <div className="edu-profile-body">
            <button
              type="button"
              className="edu-profile-avatar"
              onClick={() => own && document.getElementById('edu-avatar-file')?.click()}
              aria-label={own ? 'Cambiar foto de perfil' : 'Foto de perfil'}
            >
              {avatar ? <img src={avatar} alt="" /> : (
                <span>
                  <User size={42} />
                </span>
              )}
              {own ? (
                <i>
                  <Camera size={14} />
                </i>
              ) : null}
            </button>

            {own ? (
              <form className="edu-profile-form" onSubmit={save}>
                <label className="edu-profile-field">
                  <span>Nombre</span>
                  <span className="edu-profile-control">
                    <User size={16} />
                    <input
                      value={name}
                      maxLength={80}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Cómo te ven en la comunidad"
                    />
                  </span>
                </label>
                <label className="edu-profile-field">
                  <span>Biografía</span>
                  <span className="edu-profile-control is-area">
                    <textarea
                      value={bio}
                      maxLength={BIO_MAX}
                      onChange={(event) => setBio(event.target.value)}
                      placeholder="Qué estudias, qué te gusta construir, en qué puedes ayudar."
                    />
                    <Pencil size={16} />
                    <em className="edu-profile-count">{bio.length}/{BIO_MAX}</em>
                  </span>
                </label>
                <div className="edu-profile-interests">
                  <span>Intereses</span>
                  <div className="edu-profile-interest-row">
                    <span className="edu-profile-control">
                      <Search size={16} />
                      <input
                        value={draft}
                        maxLength={28}
                        placeholder="SQL, diseño, Python…"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addInterest();
                          }
                        }}
                      />
                    </span>
                    <button type="button" className="edu-btn" onClick={addInterest} disabled={!draft.trim() || interests.length >= 8}>
                      Añadir
                    </button>
                  </div>
                  {interests.length ? (
                    <div className="edu-profile-tags">
                      {interests.map((item) => (
                        <button key={item} type="button" onClick={() => setInterests((current) => current.filter((tag) => tag !== item))}>
                          {item}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {error ? <p className="edu-error">{error}</p> : null}
                {note ? <p className="edu-profile-lock">{note}</p> : null}
                <button type="submit" className="edu-btn edu-profile-save" disabled={Boolean(busy) || name.trim().length < 2}>
                  <Bookmark size={16} />
                  {busy === 'guardar' ? 'Guardando…' : 'Guardar perfil'}
                </button>
              </form>
            ) : (
              <div className="edu-profile-form">
                <h1 className="edu-profile-public-name">{profile?.name || 'Estudiante'}</h1>
                <p className="edu-profile-public-bio">{profile?.bio || 'Todavía no escribió una biografía.'}</p>
                {interests.length ? (
                  <div className="edu-profile-tags">
                    {interests.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
                {error ? <p className="edu-error">{error}</p> : null}
              </div>
            )}

            <p className="edu-profile-lock">
              <Lock size={14} />
              {own
                ? 'Este perfil es público. La gente ve tu foto, nombre, biografía e intereses. El correo no se muestra.'
                : 'Perfil público. No muestra correo ni datos de contacto.'}
            </p>
            <div className="edu-profile-share">
              <button type="button" onClick={() => setShare((value) => !value)} aria-expanded={share}>
                <Share2 size={15} />
                Compartir perfil
              </button>
              {share ? (
                <menu>
                  {typeof navigator.share === 'function' ? (
                    <li>
                      <button type="button" onClick={nativeShare}>Compartir…</button>
                    </li>
                  ) : null}
                  <li>
                    <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
                  </li>
                  <li>
                    <button type="button" onClick={copyLink}>Copiar enlace</button>
                  </li>
                </menu>
              ) : null}
            </div>
          </div>
          {own ? (
            <>
              <input id="edu-avatar-file" hidden type="file" accept="image/*" onChange={pickImage('avatar')} />
              <input id="edu-cover-file" hidden type="file" accept="image/*" onChange={pickImage('cover')} />
            </>
          ) : null}
        </section>

        <aside className="edu-profile-side">
          <article>
            <div className="edu-profile-story">
              <div>
                <h2><Star size={16} /> {own ? 'Tu perfil, tu historia' : 'Su perfil'}</h2>
                <p>{own ? 'Completa tu perfil para que otros estudiantes y creadores te conozcan mejor.' : 'Así se presenta en la comunidad. Sin correo ni datos de contacto.'}</p>
                <ul className="edu-profile-checks">
                  {steps.map((step) => (
                    <li key={step.label} className={step.ok ? undefined : 'is-off'}>
                      <Check size={16} />
                      {step.label}
                    </li>
                  ))}
                </ul>
              </div>
              <CardArt />
            </div>
          </article>
          <article>
            <h2><BarChart3 size={16} /> Estadísticas de tu perfil</h2>
            <div className="edu-profile-stat">
              <i><Eye size={16} /></i>
              <div>
                <b>Visualizaciones</b>
                <small>Personas han visto tu perfil</small>
              </div>
              <strong>{profile?.views || 0}</strong>
            </div>
            <div className="edu-profile-stat">
              <i><Users size={16} /></i>
              <div>
                <b>Seguidores</b>
                <small>Estudiantes que te siguen</small>
              </div>
              <strong>{profile?.followers || 0}</strong>
            </div>
            <div className="edu-profile-stat">
              <i><Link2 size={16} /></i>
              <div>
                <b>Enlace público</b>
                <small>{profile?.slug ? `edu/perfil/${profile.slug}` : 'Visible para la comunidad'}</small>
              </div>
              <strong>Activo</strong>
            </div>
          </article>
          <article className="edu-profile-tip">
            <i><Lightbulb size={18} /></i>
            <div>
              <h2>Un buen perfil puede abrirte nuevas oportunidades.</h2>
              <p>Muéstrate, comparte tu conocimiento y conecta con otros.</p>
            </div>
            {publicUrl ? (
              <a href={publicUrl} aria-label="Abrir perfil público">
                <ArrowUpRight size={16} />
              </a>
            ) : null}
          </article>
        </aside>
      </div>
      {crop ? (
        <EduCrop
          image={crop.url}
          round={crop.kind !== 'cover'}
          title={crop.kind === 'cover' ? 'Encuadra la portada' : 'Encuadra tu foto'}
          onCancel={closeCrop}
          onUse={useCropped}
        />
      ) : null}
    </div>
  );
}
