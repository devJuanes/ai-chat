import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import EduPending from './EduPending';

function isEmailDerivedName(value, email) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  const full = String(email || '').trim().toLowerCase();
  const local = full.split('@')[0];
  if (full && raw === full) return true;
  return Boolean(local) && raw === local;
}

function previewLearnerName(stored, user) {
  const email = user?.email || '';
  const display = String(user?.display_name || '').trim();
  const account = String(user?.name || '').trim();
  const saved = String(stored || '').trim();
  const displayReal = display && !isEmailDerivedName(display, email) ? display : '';
  const accountReal = account && !isEmailDerivedName(account, email) ? account : '';
  if (!saved || isEmailDerivedName(saved, email)) return displayReal || accountReal;
  return saved;
}

export default function EduCertificatesPage() {
  const auth = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop = false;
    api('/api/edu/certificates', { token: auth.getToken() })
      .then((json) => {
        if (!stop) setItems(json.certificates || []);
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude cargar tus certificados');
      })
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [auth]);

  if (!ready) return <EduPending />;

  const empty = items.length === 0;

  return (
    <div className={empty ? 'edu-home edu-certs-empty' : 'edu-home'}>
      <p className="edu-home-hello">Tu progreso</p>
      <h1 className="edu-home-title">Certificados</h1>
      {error ? <div className="edu-error">{error}</div> : null}
      {empty ? (
        <div className="edu-empty-panel">
          <strong>Aún no tienes un certificado.</strong>
          <p>Termina las lecciones y los quizzes de un curso. Ahí se abre el certificado.</p>
          <Link className="edu-btn" to="/edu/rutas">
            Ir a cursos
          </Link>
        </div>
      ) : (
        <div className="edu-cert-list">
          {items.map((item) => {
            const name = previewLearnerName(item.learner_name, auth.user);
            return (
              <Link
                key={item.id}
                to={`/edu/cursos/${item.course_id}/certificado`}
                className="edu-cert-preview"
              >
                <span className="edu-cert-preview-ribbon edu-cert-preview-ribbon-tl" aria-hidden="true" />
                <span className="edu-cert-preview-ribbon edu-cert-preview-ribbon-gold" aria-hidden="true" />
                <span className="edu-cert-preview-ribbon edu-cert-preview-ribbon-br" aria-hidden="true" />
                <span className="edu-cert-preview-bookmark" aria-hidden="true" />
                <span className="edu-cert-preview-frame" aria-hidden="true" />
                <span className="edu-cert-preview-seal" aria-hidden="true">
                  <BrandLogo className="edu-cert-preview-logo" size={22} decorative />
                </span>
                <p className="edu-cert-preview-word">Certificado</p>
                <p className="edu-cert-preview-sub">De reconocimiento</p>
                {name ? <p className="edu-cert-preview-name">{name}</p> : null}
                <p className="edu-cert-preview-title">{item.title}</p>
                {item.code ? <p className="edu-cert-preview-code">{item.code}</p> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
