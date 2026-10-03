import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { domToPng } from 'modern-screenshot';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { applyPageTitle } from '../../lib/pageTitle';
import LoadingRing from '../../components/LoadingRing';
import { courseStats } from './courseState';
import BrandLogo from '../../components/BrandLogo';
import { ConfettiBit } from '../../components/BrandMascot';

function isEmailDerivedName(value, email) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  const full = String(email || '').trim().toLowerCase();
  const local = full.split('@')[0];
  if (full && raw === full) return true;
  return Boolean(local) && raw === local;
}

function certificateLearnerName(stored, user) {
  const email = user?.email || '';
  const display = String(user?.display_name || '').trim();
  const account = String(user?.name || '').trim();
  const saved = String(stored || '').trim();
  const displayReal = display && !isEmailDerivedName(display, email) ? display : '';
  const accountReal = account && !isEmailDerivedName(account, email) ? account : '';
  if (!saved || isEmailDerivedName(saved, email)) return displayReal || accountReal || 'Estudiante';
  return saved;
}

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

function CertRibbons() {
  return (
    <svg
      className="edu-cert-ribbon"
      viewBox="0 0 1200 848"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path d="M-28 48C18 8 46 40 34 108" fill="none" stroke="#8584bd" strokeWidth="26" strokeLinecap="butt" />
      <path d="M-18 68C22 34 44 58 36 118" fill="none" stroke="#f4ed36" strokeWidth="8" strokeLinecap="butt" />
      <path d="M-12 16C16 2 42 18 58 44" fill="none" stroke="#f9cc73" strokeWidth="10" strokeLinecap="butt" />
      <path d="M1248 8C1168 48 1148 150 1192 280C1224 380 1168 470 1220 620" fill="none" stroke="#8584bd" strokeWidth="36" strokeLinecap="butt" />
      <path d="M1268 36C1196 78 1176 168 1212 286C1238 370 1192 460 1236 590" fill="none" stroke="#f4ed36" strokeWidth="10" strokeLinecap="butt" />
      <path d="M-12 800C40 772 78 800 62 900" fill="none" stroke="#8584bd" strokeWidth="24" strokeLinecap="butt" />
      <path d="M4 828C42 804 70 826 58 900" fill="none" stroke="#f9cc73" strokeWidth="8" strokeLinecap="butt" />
    </svg>
  );
}

function CertFlourish({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 160" aria-hidden="true">
      <path d="M16 62c22-2 34-18 34-38" fill="none" stroke="#1a1a1a" strokeWidth="1.35" />
      <path d="M16 74c30-1 46-20 46-46" fill="none" stroke="#8584bd" strokeWidth="1.05" />
      <path d="M62 16c-2 22-18 34-38 34" fill="none" stroke="#1a1a1a" strokeWidth="1.35" />
      <path d="M74 16c-1 30-20 46-46 46" fill="none" stroke="#8584bd" strokeWidth="1.05" />
      <path d="M44 44c16 6 26 18 20 32" fill="none" stroke="#61609a" strokeWidth="1.1" />
      <path d="M44 44c6 16 18 26 32 20" fill="none" stroke="#61609a" strokeWidth="1.1" />
      <path d="M58 70c8 1 14 8 12 16-7-1-12-7-12-16z" fill="#8584bd" />
      <path d="M70 58c1 8 8 14 16 12-1-7-7-12-16-12z" fill="#f9cc73" />
      <path d="M18 18c14 2 22 12 18 22-10-2-16-10-18-22z" fill="#8584bd" />
      <path d="M18 18c2 14 12 22 22 18-2-10-10-16-22-18z" fill="#f9cc73" />
      <path d="M30 30c8 10 6 18-2 22" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <path d="M30 30c10 8 18 6 22-2" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <circle cx="52" cy="52" r="2.6" fill="#f4ed36" stroke="#1a1a1a" strokeWidth="0.7" />
      <circle cx="28" cy="14" r="1.15" fill="#f4ed36" />
      <circle cx="42" cy="14" r="1.15" fill="#1a1a1a" />
      <circle cx="14" cy="28" r="1.15" fill="#f9cc73" />
      <circle cx="14" cy="42" r="1.15" fill="#1a1a1a" />
    </svg>
  );
}

function CertSeal() {
  return (
    <div className="edu-cert-seal" aria-hidden="true">
      <svg className="edu-cert-seal-art" viewBox="0 0 200 200">
        <defs>
          <path
            id="eduCertSealRing"
            d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0"
          />
        </defs>
        <circle cx="100" cy="100" r="98" fill="#8584bd" />
        <circle cx="100" cy="100" r="96" fill="none" stroke="#f4ed36" strokeWidth="2.4" />
        <circle cx="100" cy="100" r="63" fill="#f9f5f2" />
        <circle cx="100" cy="100" r="65" fill="none" stroke="#f9cc73" strokeWidth="2" />
        <text className="edu-cert-seal-text">
          <textPath href="#eduCertSealRing" startOffset="0%" textLength="503" lengthAdjust="spacing">
            EDUCREATOR · MATU AI · EDUCREATOR · MATU AI ·
          </textPath>
        </text>
      </svg>
      <BrandLogo className="edu-cert-seal-logo" size={46} decorative />
    </div>
  );
}

function fileSlug(code) {
  const clean = String(code || 'certificado').replace(/[^\w-]+/g, '');
  return clean || 'certificado';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('No pude leer el PDF'));
    reader.readAsDataURL(blob);
  });
}

async function captureSheet(node) {
  return domToPng(node, {
    scale: 2,
    backgroundColor: '#f9f5f2',
  });
}

function saveFile(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

export default function EduCertificate() {
  const { courseId } = useParams();
  const auth = useAuth();
  const sheetRef = useRef(null);
  const [data, setData] = useState(null);
  const [cert, setCert] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    const courseTitle = data?.course?.title;
    applyPageTitle(courseTitle ? `Certificado · ${courseTitle}` : 'Certificado', 'EduCreator');
  }, [data?.course?.title]);

  useEffect(() => {
    if (!sentTo) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSentTo('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sentTo]);

  useEffect(() => {
    let stop = false;
    api(`/api/edu/courses/${courseId}`, { token: auth.getToken() })
      .then((json) => {
        if (stop) return;
        setData(json);
        setCert(json.certificate);
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude abrir el certificado');
      });
    return () => {
      stop = true;
    };
  }, [auth, courseId]);

  const issue = async () => {
    setBusy(true);
    setError('');
    try {
      const json = await api(`/api/edu/courses/${courseId}/certificate`, {
        method: 'POST',
        token: auth.getToken(),
      });
      setCert(json.certificate);
    } catch (err) {
      setError(err.message || 'Todavía no se puede emitir');
    } finally {
      setBusy(false);
    }
  };

  const downloadPng = async () => {
    const node = sheetRef.current;
    if (!node) return;
    setSaving('png');
    setError('');
    try {
      const png = await captureSheet(node);
      saveFile(png, `${fileSlug(cert?.code)}.png`);
    } catch (err) {
      setError(err.message || 'No pude armar la imagen');
    } finally {
      setSaving('');
    }
  };

  const renderPdf = async () => {
    const node = sheetRef.current;
    if (!node) return null;
    const png = await captureSheet(node);
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const pdf = new jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
      hotfixes: ['px_scaling'],
    });
    pdf.addImage(png, 'PNG', 0, 0, width, height, undefined, 'FAST');
    return pdf;
  };

  const downloadPdf = async () => {
    setSaving('pdf');
    setError('');
    setSentTo('');
    try {
      const pdf = await renderPdf();
      if (!pdf) return;
      pdf.save(`${fileSlug(cert?.code)}.pdf`);
    } catch (err) {
      setError(err.message || 'No pude armar el PDF');
    } finally {
      setSaving('');
    }
  };

  const sendEmail = async () => {
    setSaving('mail');
    setError('');
    setSentTo('');
    try {
      const pdf = await renderPdf();
      if (!pdf) return;
      const base64 = await blobToBase64(pdf.output('blob'));
      const json = await api(`/api/edu/courses/${courseId}/certificate/email`, {
        method: 'POST',
        token: auth.getToken(),
        body: { pdf: base64 },
      });
      setSentTo(json.email || 'tu correo');
    } catch (err) {
      setError(err.message || 'No pude enviar el correo');
    } finally {
      setSaving('');
    }
  };

  if (!data && !error) {
    return (
      <div className="edu-fill" style={{ display: 'grid', placeItems: 'center' }}>
        <LoadingRing />
      </div>
    );
  }

  const stats = data ? courseStats(data.modules, data.progress) : null;
  const name = certificateLearnerName(cert?.learner_name, auth.user);
  const title = data?.course?.title || 'Curso';
  const when = cert ? formatWhen(cert.issued_at) : '';

  return (
    <div className="edu-cert-wrap">
      <article ref={sheetRef} className="edu-cert edu-cert-sheet">
        <CertRibbons />
        <ConfettiBit className="edu-cert-bit edu-cert-bit-a" fill="#f8c1ba" />
        <ConfettiBit className="edu-cert-bit edu-cert-bit-b" fill="#f4ed36" />
        <span className="edu-cert-bookmark" aria-hidden="true" />
        <span className="edu-cert-border" aria-hidden="true" />
        <span className="edu-cert-border-inner" aria-hidden="true" />
        <span className="edu-cert-fillet" aria-hidden="true" />
        <CertFlourish className="edu-cert-flourish edu-cert-flourish-tl" />
        <CertFlourish className="edu-cert-flourish edu-cert-flourish-tr" />
        <CertFlourish className="edu-cert-flourish edu-cert-flourish-bl" />
        <CertFlourish className="edu-cert-flourish edu-cert-flourish-br" />
        <div className="edu-cert-inner">
          <header className="edu-cert-head">
            <h1 className="edu-cert-title">Certificado</h1>
            <p className="edu-cert-subtitle">De reconocimiento</p>
            <div className="edu-cert-rule" aria-hidden="true">
              <span className="edu-cert-rule-line" />
              <svg className="edu-cert-rule-gem" viewBox="0 0 16 16">
                <path d="M8 1.2 14.8 8 8 14.8 1.2 8Z" fill="none" stroke="#1a1a1a" strokeWidth="1" />
                <path d="M8 4.2 11.8 8 8 11.8 4.2 8Z" fill="#f4ed36" stroke="#8584bd" strokeWidth="0.6" />
              </svg>
              <span className="edu-cert-rule-line" />
            </div>
          </header>
          <p className="edu-cert-label">Otorgado a:</p>
          <p className="name edu-cert-name">{name}</p>
          <p className="edu-cert-sentence">
            Por haber completado satisfactoriamente el curso{' '}
            <strong className="edu-cert-course">{title}</strong>.
          </p>
          <p className="edu-cert-fine">
            {when || 'Aún sin emitir'}
            {cert?.code ? <span> · {cert.code}</span> : null}
          </p>
          <footer className="edu-cert-sign">
            <span className="edu-cert-sign-name">MatuAI Academy</span>
            <span className="edu-cert-sign-rule" aria-hidden="true" />
          </footer>
        </div>
        <CertSeal />
      </article>
      {error ? <div className="edu-error">{error}</div> : null}
      {sentTo ? (
        <div
          className="edu-forum-modal edu-no-print"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSentTo('');
          }}
        >
          <div
            className="edu-forum-dialog edu-cert-mail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edu-cert-mail-title"
          >
            <h2 id="edu-cert-mail-title">Certificado enviado</h2>
            <p>
              Lo enviamos a <strong>{sentTo}</strong>. Revisa la bandeja y, si no aparece, el spam.
            </p>
            <div className="edu-forum-dialog-actions">
              <button type="button" className="edu-btn" onClick={() => setSentTo('')}>
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="edu-row edu-no-print edu-cert-actions">
        {!cert && stats?.ready ? (
          <button type="button" className="edu-btn" disabled={busy} onClick={issue}>
            {busy ? 'Emitiendo…' : 'Emitir certificado'}
          </button>
        ) : null}
        {cert ? (
          <>
            <button type="button" className="edu-btn" disabled={Boolean(saving)} onClick={downloadPng}>
              {saving === 'png' ? 'Preparando…' : 'Descargar PNG'}
            </button>
            <button type="button" className="edu-btn" disabled={Boolean(saving)} onClick={downloadPdf}>
              {saving === 'pdf' ? 'Preparando…' : 'Descargar PDF'}
            </button>
            <button type="button" className="edu-btn" disabled={Boolean(saving)} onClick={sendEmail}>
              {saving === 'mail' ? 'Enviando…' : 'Enviar al correo'}
            </button>
          </>
        ) : null}
        {cert?.code ? (
          <Link className="edu-btn-ghost" to={`/edu/validar/${encodeURIComponent(cert.code)}`}>
            Validar código
          </Link>
        ) : null}
        <Link className="edu-btn-ghost" to={`/edu/cursos/${courseId}`}>
          Volver al curso
        </Link>
      </div>
    </div>
  );
}
