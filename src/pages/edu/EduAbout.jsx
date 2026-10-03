import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { SITE } from '../../lib/site';

const SUBJECTS = ['EduCreator', 'Alianza o institución', 'Prensa', 'Otro'];

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  subject: SUBJECTS[0],
  message: '',
  website: '',
};

export default function EduAbout() {
  const auth = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const name = auth.user?.name || '';
    const email = auth.user?.email || '';
    setForm((prev) => ({
      ...prev,
      name: prev.name || name,
      email: prev.email || email,
    }));
  }, [auth.user?.name, auth.user?.email]);

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    if (!name) {
      setError('Escribe tu nombre.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('El correo no es válido.');
      return;
    }
    if (message.length < 10) {
      setError('El mensaje necesita al menos 10 caracteres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/contact', {
        method: 'POST',
        body: {
          name,
          email,
          phone: form.phone.trim(),
          company: '',
          subject: form.subject,
          message,
          website: form.website,
          source: 'educreator',
        },
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="edu-home edu-about">
      <header className="edu-about-intro">
        <p className="edu-home-hello">{SITE.companyShort}</p>
        <h1 className="edu-home-title">Acerca de</h1>
        <p className="edu-about-lead">
          EduCreator lo hace {SITE.companyName}, en {SITE.companyCountry}. Si quieres
          saber de la empresa, una alianza o escribirnos, aquí están los datos y un
          formulario.
        </p>
      </header>

      <section className="edu-about-grid" aria-label="La empresa">
        <article className="edu-about-card">
          <h2>Quiénes somos</h2>
          <p>
            {SITE.companyName} ({SITE.companyShort}) diseña productos de inteligencia
            artificial. Matu AI es la plataforma; EduCreator es el espacio para crear
            cursos, aprender y certificar.
          </p>
        </article>
        <article className="edu-about-card">
          <h2>Dónde estamos</h2>
          <p>
            Empresa colombiana. La casa pública es{' '}
            <a href={SITE.url} target="_blank" rel="noreferrer">
              {SITE.domain}
            </a>
            . LinkedIn:{' '}
            <a href="https://www.linkedin.com/company/matubyte" target="_blank" rel="noreferrer">
              Matubyte
            </a>
            .
          </p>
        </article>
      </section>

      <section className="edu-about-block" aria-label="Contactos">
        <h2>Contactos</h2>
        <p>Elige el canal. Respondemos por el mismo medio.</p>
        <div className="edu-about-contacts">
          <a className="edu-about-contact" href={`mailto:${SITE.contactEmail}`}>
            <small>Correo</small>
            <strong>{SITE.contactEmail}</strong>
          </a>
          <a className="edu-about-contact" href={`mailto:${SITE.supportEmail}`}>
            <small>Soporte</small>
            <strong>{SITE.supportEmail}</strong>
          </a>
          <a
            className="edu-about-contact"
            href={`${SITE.whatsappUrl}?text=${encodeURIComponent('Hola Matubyte, escribo desde EduCreator.')}`}
            target="_blank"
            rel="noreferrer"
          >
            <small>WhatsApp</small>
            <strong>{SITE.whatsappDisplay}</strong>
          </a>
          <a className="edu-about-contact" href={SITE.url} target="_blank" rel="noreferrer">
            <small>Web</small>
            <strong>{SITE.domain}</strong>
          </a>
        </div>
      </section>

      <section className="edu-about-block" aria-label="Escríbenos">
        <h2>Escríbenos</h2>
        <p>
          Cuéntanos qué necesitas. Si el tema es un curso, un certificado o tu cuenta,
          mejor abre un ticket en <Link to="/edu/soporte">Soporte</Link>.
        </p>
        {sent ? (
          <div className="edu-about-sent">
            <strong>Mensaje enviado.</strong>
            <p>Te respondemos al correo {form.email.trim()}.</p>
          </div>
        ) : (
          <form className="edu-about-form" onSubmit={submit}>
            <div className="edu-about-row">
              <label>
                Nombre
                <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={120} required />
              </label>
              <label>
                Correo
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  maxLength={200}
                  required
                />
              </label>
            </div>
            <div className="edu-about-row">
              <label>
                Teléfono
                <input
                  value={form.phone}
                  onChange={set('phone')}
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={40}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Tema
                <select value={form.subject} onChange={set('subject')}>
                  {SUBJECTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Mensaje
              <textarea
                value={form.message}
                onChange={set('message')}
                maxLength={4000}
                required
                placeholder="Qué necesitas y cómo te ayudamos."
              />
            </label>
            <label className="edu-sr">
              Sitio web
              <input value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" />
            </label>
            {error ? <div className="edu-error">{error}</div> : null}
            <button className="edu-btn" type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
