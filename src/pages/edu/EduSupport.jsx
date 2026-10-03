import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Clock,
  FileBadge,
  GraduationCap,
  Headset,
  LifeBuoy,
  Mail,
  MessageCircle,
  Search,
  Ticket,
  Users,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { SITE } from '../../lib/site';
import EduPending from './EduPending';

const FAQ = [
  {
    q: '¿Cómo creo un curso?',
    a: 'En Crear eliges el nivel, si el curso es público y el tema. EduCreator arma los módulos, las lecciones y el quiz.',
  },
  {
    q: '¿Dónde veo mi avance?',
    a: 'En Inicio están tus cursos. En Rutas queda el progreso de cada uno.',
  },
  {
    q: '¿Cómo descargo el certificado?',
    a: 'Al terminar el curso, el diploma aparece en Certificados. Lo bajas en PNG o PDF y el código se valida en público.',
  },
  {
    q: 'El nombre del diploma no es el mío',
    a: 'El certificado usa el nombre de tu perfil. Si sale otro, crea un ticket de cuenta con el nombre correcto.',
  },
  {
    q: '¿Qué hago si tengo problemas con el acceso?',
    a: 'Revisa el correo y la contraseña. Si sigue fallando, abre un ticket de problema en Cuenta y acceso.',
  },
  {
    q: '¿Cómo cambio mi contraseña?',
    a: 'La contraseña es la de tu cuenta de Matu AI. Si no puedes entrar para cambiarla, abre un ticket de cuenta y no escribas la clave en el mensaje.',
  },
];

const TICKET_CATEGORIES = [
  'Cuenta y acceso',
  'Cursos y lecciones',
  'Certificados',
  'Comunidad',
  'Videos',
  'Otro',
];

const PQR_TYPES = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];

function when(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind) {
  if (kind === 'pqr') return 'PQR';
  if (kind === 'incident') return 'Problema';
  return 'Ticket';
}

function statusLabel(status) {
  if (status === 'seen') return 'Visto';
  if (status === 'review') return 'En revisión';
  if (status === 'closed') return 'Cerrado';
  return 'Abierto';
}

function RequestForm({ kind, categories, category, onCategory, onCreated, onClose }) {
  const auth = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const json = await api('/api/support/tickets', {
        method: 'POST',
        token: auth.getToken(),
        body: { kind, category, subject, message },
      });
      onCreated?.(json.ticket);
    } catch (err) {
      setError(err.message || 'No se pudo enviar');
    } finally {
      setBusy(false);
    }
  };

  const ready = subject.trim().length >= 4 && message.trim().length >= 10;

  return (
    <form className="edu-help-form" onSubmit={submit}>
      <label>
        {kind === 'pqr' ? 'Tipo' : 'Tema'}
        <select value={category} onChange={(event) => onCategory(event.target.value)}>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Asunto
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={160}
          placeholder={kind === 'pqr' ? 'Resume la petición, queja o reclamo' : 'Qué necesitas, en una línea'}
        />
      </label>
      <label>
        Detalle
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={4000}
          placeholder="Qué pasó, en qué curso o cuenta, y qué esperabas."
        />
      </label>
      {error ? <div className="edu-error">{error}</div> : null}
      <div className="edu-forum-dialog-actions">
        <button type="button" className="edu-btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <button className="edu-btn" type="submit" disabled={busy || !ready}>
          {busy ? 'Enviando…' : kind === 'pqr' ? 'Enviar PQR' : 'Crear ticket'}
        </button>
      </div>
    </form>
  );
}

export default function EduSupport() {
  const auth = useAuth();
  const [tab, setTab] = useState('help');
  const [openFaq, setOpenFaq] = useState(0);
  const [picker, setPicker] = useState(false);
  const [draftKind, setDraftKind] = useState('');
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [pqrType, setPqrType] = useState(PQR_TYPES[0]);
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const faqRef = useRef(null);

  useEffect(() => {
    let stop = false;
    api('/api/support/tickets', { token: auth.getToken() })
      .then((json) => {
        if (!stop) setTickets(json.tickets || []);
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude cargar tus solicitudes');
      })
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [auth]);

  useEffect(() => {
    if (!picker && !draftKind) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setPicker(false);
      setDraftKind('');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [picker, draftKind]);

  const created = (ticket) => {
    if (ticket) setTickets((prev) => [ticket, ...prev.filter((item) => item.id !== ticket.id)]);
    setDraftKind('');
    setPicker(false);
    setTab('requests');
  };

  if (!ready) return <EduPending />;

  const needle = query.trim().toLowerCase();
  const faqs = FAQ.filter((item) => {
    if (!needle) return true;
    return item.q.toLowerCase().includes(needle) || item.a.toLowerCase().includes(needle);
  });

  const goFaq = () => {
    setTab('help');
    window.setTimeout(() => faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  return (
    <div className="edu-home edu-desk edu-hd">
      <div className="edu-hd-tabs">
        <button type="button" className={tab === 'requests' ? 'is-on' : ''} onClick={() => setTab('requests')}>
          Mis solicitudes
        </button>
        <button type="button" className={tab === 'help' ? 'is-on' : ''} onClick={() => setTab('help')}>
          Centro de ayuda
        </button>
      </div>

      {tab === 'requests' ? (
        <section className="edu-desk-card">
          <div className="edu-desk-card-head">
            <h2>Mis solicitudes</h2>
            <p>Tickets de problema y PQR de tu cuenta.</p>
          </div>
          {error ? <div className="edu-error">{error}</div> : null}
          {tickets.length === 0 ? (
            <p className="edu-desk-empty">Todavía no tienes solicitudes. Desde Centro de ayuda puedes crear un ticket o un PQR.</p>
          ) : (
            <div className="edu-desk-table-wrap">
              <table className="edu-desk-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Asunto</th>
                    <th>Tema</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{kindLabel(ticket.kind)}</td>
                      <td>{ticket.subject}</td>
                      <td>{ticket.category || '—'}</td>
                      <td>
                        <span className={`edu-desk-status is-${ticket.status || 'open'}`}>
                          {statusLabel(ticket.status)}
                        </span>
                      </td>
                      <td>{when(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="edu-hd-stack">
          <section className="edu-hd-hero">
            <div className="edu-hd-hero-copy">
              <div className="edu-hd-hero-title">
                <span className="edu-hd-badge is-green">
                  <Headset size={22} />
                </span>
                <h1>
                  Centro de <span>ayuda</span>
                </h1>
              </div>
              <p>Encuentra respuestas rápidas a tus dudas o contáctanos directamente. Estamos aquí para ayudarte.</p>
              <form
                className="edu-hd-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  goFaq();
                }}
              >
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Busca en nuestras guías, preguntas frecuentes..."
                  aria-label="Buscar en el centro de ayuda"
                />
                <button type="submit" aria-label="Buscar">
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
            <div className="edu-hd-buoy" aria-hidden="true">
              <LifeBuoy size={148} strokeWidth={1.6} />
              <span>
                <MessageCircle size={18} />
              </span>
            </div>
          </section>

          <div className="edu-hd-shortcuts">
            <Link to="/edu/rutas">
              <span className="edu-hd-badge is-green">
                <GraduationCap size={22} />
              </span>
              <span>
                <strong>Rutas</strong>
                Avance de tus cursos y seguimiento de progreso.
              </span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/edu/certificados">
              <span className="edu-hd-badge is-blue">
                <FileBadge size={22} />
              </span>
              <span>
                <strong>Certificados</strong>
                Descarga tus diplomas y códigos de verificación.
              </span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/edu/comunidad">
              <span className="edu-hd-badge is-purple">
                <Users size={22} />
              </span>
              <span>
                <strong>Comunidad</strong>
                Conecta con otros estudiantes y comparte experiencias.
              </span>
              <ArrowRight size={16} />
            </Link>
            <button type="button" onClick={goFaq}>
              <span className="edu-hd-badge is-orange">
                <MessageCircle size={22} />
              </span>
              <span>
                <strong>Preguntas frecuentes</strong>
                Respuestas cortas antes de abrir un caso.
              </span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="edu-hd-split">
            <section className="edu-hd-panel" ref={faqRef}>
              <header>
                <span className="edu-hd-badge is-line">
                  <ClipboardList size={18} />
                </span>
                <div>
                  <h2>Preguntas frecuentes</h2>
                  <p>Las dudas más comunes, resueltas en un solo lugar.</p>
                </div>
              </header>
              <div className="edu-hd-faq">
                {faqs.length === 0 ? <p className="edu-hd-none">No hay una pregunta con ese texto.</p> : null}
                {faqs.map((item) => {
                  const index = FAQ.indexOf(item);
                  const open = openFaq === index;
                  return (
                    <article key={item.q}>
                      <button type="button" aria-expanded={open} onClick={() => setOpenFaq(open ? -1 : index)}>
                        {item.q}
                        <ChevronDown size={16} className={open ? 'is-open' : ''} />
                      </button>
                      {open ? <p>{item.a}</p> : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="edu-hd-panel edu-hd-contact">
              <header>
                <span className="edu-hd-badge is-green">
                  <Headset size={18} />
                </span>
                <div>
                  <h2>¿No encontraste lo que buscas?</h2>
                  <p>Nuestro equipo de soporte está listo para ayudarte.</p>
                </div>
              </header>
              <a className="edu-hd-row" href={`mailto:${SITE.supportEmail}`}>
                <span className="edu-hd-badge is-green">
                  <Mail size={16} />
                </span>
                <span>
                  <small>Correo de soporte</small>
                  {SITE.supportEmail}
                </span>
              </a>
              <a className="edu-hd-row" href={SITE.whatsappUrl} target="_blank" rel="noreferrer">
                <span className="edu-hd-badge is-green">
                  <MessageCircle size={16} />
                </span>
                <span>
                  <small>WhatsApp</small>
                  {SITE.whatsappDisplay}
                </span>
              </a>
              <div className="edu-hd-row">
                <span className="edu-hd-badge is-green">
                  <Clock size={16} />
                </span>
                <span>
                  <small>Horario de atención</small>
                  Lun - Vie: 8:00 a.m. - 6:00 p.m. (GMT-5)
                </span>
              </div>
              <button type="button" className="edu-hd-ticket" onClick={() => setPicker(true)}>
                <Ticket size={16} />
                Crear un ticket de soporte
                <ArrowRight size={16} />
              </button>
            </section>
          </div>
        </div>
      )}

      {picker ? (
        <div
          className="edu-forum-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPicker(false);
          }}
        >
          <div className="edu-forum-dialog edu-desk-picker" role="dialog" aria-modal="true" aria-labelledby="edu-desk-pick">
            <h2 id="edu-desk-pick">Nueva solicitud</h2>
            <button
              type="button"
              onClick={() => {
                setPicker(false);
                setDraftKind('incident');
              }}
            >
              <strong>Ticket de problema</strong>
              <span>Un fallo en la cuenta, un curso, un video o un certificado.</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPicker(false);
                setDraftKind('pqr');
              }}
            >
              <strong>Generar PQR</strong>
              <span>Una petición, una queja, un reclamo o una sugerencia.</span>
            </button>
            <button type="button" className="edu-btn-ghost" onClick={() => setPicker(false)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {draftKind ? (
        <div
          className="edu-forum-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDraftKind('');
          }}
        >
          <div className="edu-forum-dialog" role="dialog" aria-modal="true">
            <h2>{draftKind === 'pqr' ? 'Generar PQR' : 'Ticket de problema'}</h2>
            <RequestForm
              kind={draftKind}
              categories={draftKind === 'pqr' ? PQR_TYPES : TICKET_CATEGORIES}
              category={draftKind === 'pqr' ? pqrType : category}
              onCategory={draftKind === 'pqr' ? setPqrType : setCategory}
              onCreated={created}
              onClose={() => setDraftKind('')}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
