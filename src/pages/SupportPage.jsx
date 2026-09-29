import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { FAQ, SITE } from '../lib/site';
import { CloseIcon, MenuIcon } from '../components/Icons';
import MatuAvatar from '../components/MatuAvatar';
import NotificationBell from '../components/NotificationBell';

const SECTIONS = [
  {
    id: 'ticket',
    label: 'Crear ticket',
    hint: 'Un caso para que el equipo lo revise.',
    tone: 'fp-card-butter',
  },
  {
    id: 'incident',
    label: 'Reportar novedad',
    hint: 'Un error, un cobro o algo que no cuadra.',
    tone: 'fp-card-pink',
  },
  {
    id: 'faq',
    label: 'Preguntas frecuentes',
    hint: 'Respuestas cortas antes de escribir.',
    tone: 'fp-card-matcha',
  },
  {
    id: 'contact',
    label: 'Contacto',
    hint: 'Correo, WhatsApp o un mensaje directo.',
    tone: 'fp-card-yellow',
  },
];

const TICKET_CATEGORIES = [
  'Cuenta',
  'Plan y facturación',
  'Modelos',
  'Agentes',
  'Otro',
];

const INCIDENT_CATEGORIES = [
  'Error en el chat',
  'Cobro o plan',
  'Un modelo falló',
  'Agente o canal',
  'Otro',
];

const HELP_FAQ = [
  ...FAQ,
  {
    q: '¿Cómo creo un ticket?',
    a: 'En Ayuda, elige Crear ticket, describe el caso y envíalo. Queda ligado a tu cuenta para que podamos responderte.',
  },
  {
    q: '¿Dónde veo mi consumo?',
    a: 'En Uso, dentro de tu espacio. Cada modelo tiene su propia cuota. MatuBot de WhatsApp no gasta la cuota del chat.',
  },
];

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="fp-mono opacity-60">{label}</span>
      {children}
    </label>
  );
}

function HelpModal({ open, title, hint, tone, wide, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[6px] border-[2.5px] border-black bg-[#f9f5f2] shadow-[6px_6px_0_#000] sm:rounded-[6px] ${
          wide ? 'sm:max-w-[760px]' : 'sm:max-w-[560px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-start justify-between gap-3 border-b-[2.5px] border-black px-5 py-4 ${tone}`}
        >
          <div className="min-w-0 text-left">
            <p className="fp-mono opacity-60">Ayuda</p>
            <h2 id="help-modal-title" className="mt-1 text-[20px] font-bold leading-tight">
              {title}
            </h2>
            {hint ? (
              <p className="mt-1 text-[13px] font-medium leading-snug opacity-75">
                {hint}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function formatWhen(iso) {
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

function RequestForm({ kind, onCreated }) {
  const auth = useAuth();
  const incident = kind === 'incident';
  const categories = incident ? INCIDENT_CATEGORIES : TICKET_CATEGORIES;
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone(false);
    setBusy(true);
    try {
      const json = await api('/api/support/tickets', {
        token: auth.getToken(),
        method: 'POST',
        body: { kind, category, subject, message },
      });
      setSubject('');
      setMessage('');
      setDone(true);
      onCreated?.(json.ticket);
    } catch (err) {
      setError(err.message || 'No se pudo enviar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Field label="Tipo">
        <select
          className="fp-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Asunto">
        <input
          className="fp-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={
            incident ? 'Qué pasó, en una línea' : 'De qué se trata el caso'
          }
          required
          minLength={4}
          maxLength={160}
        />
      </Field>
      <Field label="Detalle">
        <textarea
          className="fp-input min-h-28 resize-y"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            incident
              ? 'Qué estabas haciendo, qué esperabas y qué ocurrió.'
              : 'Cuéntanos el contexto para poder ayudarte.'
          }
          required
          minLength={10}
          maxLength={4000}
        />
      </Field>
      {error ? (
        <p className="text-left text-[13px] font-medium text-[#9b2c2c]">{error}</p>
      ) : null}
      {done ? (
        <p className="text-left text-[13px] font-medium">
          Listo. Recibimos tu {incident ? 'reporte' : 'ticket'}.
        </p>
      ) : null}
      <button
        type="submit"
        className="fp-btn-ink mt-1 px-5 py-2.5 text-[13px]"
        disabled={busy}
      >
        {busy ? 'Enviando…' : incident ? 'Enviar reporte' : 'Crear ticket'}
      </button>
    </form>
  );
}

function TicketList({ tickets, error }) {
  if (error) {
    return <p className="text-[13px] font-medium opacity-70">{error}</p>;
  }
  if (!tickets.length) {
    return (
      <p className="text-[13px] font-medium opacity-60">
        Aún no tienes solicitudes.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="fp-card px-3 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="fp-mono opacity-55">
              {ticket.kind === 'incident' ? 'Novedad' : 'Ticket'}
              {ticket.category ? ` · ${ticket.category}` : ''}
            </span>
            <span className="text-[12px] opacity-55">
              {formatWhen(ticket.created_at)}
            </span>
          </div>
          <p className="mt-1 text-[14px] font-bold">{ticket.subject}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug opacity-75">
            {ticket.message}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function SupportPage() {
  const { onToggleSidebar } = useOutletContext() || {};
  const auth = useAuth();
  const [section, setSection] = useState(null);
  const faqRef = useRef(null);
  const activeSection = SECTIONS.find((item) => item.id === section) || null;
  const closeSection = useCallback(() => setSection(null), []);
  const [openFaq, setOpenFaq] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [listError, setListError] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactNote, setContactNote] = useState('');
  const [contactError, setContactError] = useState('');

  const loadTickets = async () => {
    try {
      const json = await api('/api/support/tickets', { token: auth.getToken() });
      setTickets(json.tickets || []);
      setListError('');
    } catch (err) {
      setListError(err.message || 'No se pudieron cargar tus solicitudes');
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const sendContact = async (e) => {
    e.preventDefault();
    setContactError('');
    setContactNote('');
    setContactBusy(true);
    try {
      await api('/api/contact', {
        method: 'POST',
        body: {
          name: auth.user?.name || 'Usuario',
          email: auth.user?.email || '',
          subject: 'Contacto desde la app',
          message: contactMessage,
          source: 'other',
        },
      });
      setContactMessage('');
      setContactNote('Mensaje enviado. Te respondemos por correo.');
    } catch (err) {
      setContactError(err.message || 'No se pudo enviar');
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[52px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="fp-mono">Centro de ayuda</div>
        <div className="flex-1" />
        <NotificationBell />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col px-4 py-6 sm:px-8 sm:py-8 lg:py-10">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex flex-col items-center lg:flex-row lg:items-center lg:gap-5">
              <MatuAvatar size={96} crop="bust" alt="Soporte Matu" />
              <div>
                <p className="fp-mono mt-4 opacity-55 lg:mt-0">Ayuda y soporte</p>
                <h1 className="fp-display mt-1 text-[32px] leading-[0.92] sm:text-[44px] lg:text-[52px]">
                  ¿En qué te ayudo?
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-snug opacity-70 lg:mt-4">
              Tickets, novedades, respuestas y contacto. Elige una vía y seguimos desde tu cuenta.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`fp-card ${item.tone} h-full px-4 py-4 text-left hover:shadow-[2px_2px_0_#000]`}
                onClick={() => {
                  if (item.id === 'faq') {
                    faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                  }
                  setSection(item.id);
                }}
              >
                <span className="block text-[15px] font-bold">{item.label}</span>
                <span className="mt-1 block text-[13px] font-medium leading-snug opacity-75">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>

          <section ref={faqRef} className="fp-card mt-6 scroll-mt-6 p-4 sm:p-6 lg:p-7">
            <h2 className="text-left text-[18px] font-bold">Preguntas frecuentes</h2>
            <div className="mt-3 grid gap-x-10 md:grid-cols-2">
              {HELP_FAQ.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div key={item.q} className="border-t border-black/15">
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 py-3 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? -1 : i)}
                    >
                      <span className="text-[15px] font-bold leading-snug">{item.q}</span>
                      <span className="fp-mono shrink-0">{open ? '−' : '+'}</span>
                    </button>
                    {open ? (
                      <p className="pb-3 text-[14px] font-medium leading-relaxed opacity-75">
                        {item.a}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <HelpModal
            open={Boolean(activeSection)}
            title={activeSection?.label}
            hint={activeSection?.hint}
            tone={activeSection?.tone || ''}
            onClose={closeSection}
          >
            {section === 'ticket' || section === 'incident' ? (
              <div className="flex flex-col gap-5 text-left">
                <RequestForm
                  key={section}
                  kind={section === 'incident' ? 'incident' : 'ticket'}
                  onCreated={(ticket) => {
                    if (ticket) setTickets((prev) => [ticket, ...prev]);
                  }}
                />
                <div className="border-t border-black/15 pt-4">
                  <h3 className="mb-3 text-[15px] font-bold">Tus solicitudes</h3>
                  <TicketList tickets={tickets} error={listError} />
                </div>
              </div>
            ) : null}

            {section === 'contact' ? (
              <div className="flex flex-col gap-4 text-left">
                <p className="text-[14px] font-medium leading-snug opacity-70">
                  Te respondemos a {auth.user?.email}.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <a
                    className="fp-card fp-card-butter flex flex-col gap-1 p-4 no-underline"
                    href={`mailto:${SITE.supportEmail}`}
                  >
                    <span className="fp-mono text-[10px] opacity-60">Correo</span>
                    <span className="text-[15px] font-bold">{SITE.supportEmail}</span>
                  </a>
                  <a
                    className="fp-card fp-card-matcha flex flex-col gap-1 p-4 no-underline"
                    href={SITE.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="fp-mono text-[10px] opacity-60">WhatsApp</span>
                    <span className="text-[15px] font-bold">
                      {SITE.whatsappDisplay}
                    </span>
                  </a>
                </div>
                <form className="flex flex-col gap-3" onSubmit={sendContact}>
                  <Field label="Mensaje">
                    <textarea
                      className="fp-input min-h-32 resize-y"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Escribe tu mensaje"
                      required
                      minLength={10}
                      maxLength={4000}
                    />
                  </Field>
                  {contactError ? (
                    <p className="text-[13px] font-medium text-[#9b2c2c]">
                      {contactError}
                    </p>
                  ) : null}
                  {contactNote ? (
                    <p className="text-[13px] font-medium">{contactNote}</p>
                  ) : null}
                  <button
                    type="submit"
                    className="fp-btn-ink w-fit px-5 py-2.5 text-[13px]"
                    disabled={contactBusy}
                  >
                    {contactBusy ? 'Enviando…' : 'Enviar mensaje'}
                  </button>
                </form>
              </div>
            ) : null}
      </HelpModal>
    </main>
  );
}
