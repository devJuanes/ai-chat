import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { applyPageTitle } from '../../lib/pageTitle';
import EduPending from './EduPending';
import './edu.css';

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function EduVerify() {
  const { code: codeParam } = useParams();
  const [draft, setDraft] = useState(codeParam || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(Boolean(codeParam));

  useEffect(() => {
    applyPageTitle('Validar certificado', 'EduCreator');
  }, []);

  useEffect(() => {
    if (!codeParam) return undefined;
    let stop = false;
    setBusy(true);
    setDraft(codeParam);
    api(`/api/edu/certificates/verify?code=${encodeURIComponent(codeParam)}`)
      .then((json) => {
        if (!stop) setResult(json);
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude comprobar el código');
      })
      .finally(() => {
        if (!stop) setBusy(false);
      });
    return () => {
      stop = true;
    };
  }, [codeParam]);

  const check = (event) => {
    event.preventDefault();
    const code = draft.trim();
    if (code.length < 4) return;
    window.history.replaceState(null, '', `/edu/validar/${encodeURIComponent(code)}`);
    setBusy(true);
    setError('');
    setResult(null);
    api(`/api/edu/certificates/verify?code=${encodeURIComponent(code)}`)
      .then((json) => setResult(json))
      .catch((err) => setError(err.message || 'No pude comprobar el código'))
      .finally(() => setBusy(false));
  };

  const cert = result?.valid ? result.certificate : null;

  return (
    <div className="edu-verify">
      <div className="edu-verify-card">
        <p className="edu-home-hello">EduCreator</p>
        <h1 className="edu-home-title">Validar certificado</h1>
        <p className="edu-verify-lead">
          Escribe el código que aparece en el diploma. Si lo emitió MatuAI Academy, aquí sale.
        </p>
        <form className="edu-verify-form" onSubmit={check}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.toUpperCase())}
            placeholder="EDU-"
            aria-label="Código del certificado"
            autoCapitalize="characters"
            spellCheck="false"
          />
          <button className="edu-btn" type="submit" disabled={busy || draft.trim().length < 4}>
            Comprobar
          </button>
        </form>
        {busy ? <EduPending /> : null}
        {error ? <div className="edu-error">{error}</div> : null}
        {!busy && result && !result.valid ? (
          <div className="edu-verify-miss">
            <strong>Este código no está en el sistema.</strong>
            <p>Revisa que esté completo, tal como sale en el certificado.</p>
          </div>
        ) : null}
        {!busy && cert ? (
          <div className="edu-verify-ok">
            <p>Certificado válido</p>
            <h2>{cert.learner_name}</h2>
            <p>{cert.title}</p>
            <p>
              {formatWhen(cert.issued_at)}
              {cert.code ? ` · ${cert.code}` : ''}
            </p>
            <p>Emitido por MatuAI Academy dentro de EduCreator.</p>
          </div>
        ) : null}
        <Link className="edu-verify-back" to="/edu">
          Volver a EduCreator
        </Link>
      </div>
    </div>
  );
}
