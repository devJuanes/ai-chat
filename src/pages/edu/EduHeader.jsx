import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { refreshPulse, useEduPulse } from './pulse';
import { useCourseMenu } from './courseMenu';

function givenNames(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ') || 'Estudiante';
}

export default function EduHeader({ onMenu }) {
  const auth = useAuth();
  const courseMenu = useCourseMenu();
  const [bell, setBell] = useState(false);
  const pulse = useEduPulse();
  const full = auth.user?.name || auth.user?.email?.split('@')[0] || 'Estudiante';
  const name = givenNames(full);
  const initial = name.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!bell) return undefined;
    const close = () => setBell(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [bell]);

  return (
    <header className="edu-head">
      <button type="button" className="edu-head-menu" onClick={onMenu} aria-label="Abrir menú">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <Link to="/edu/crear" className="edu-head-search" aria-label="¿Qué quieres aprender?">
        <svg className="edu-head-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>¿Qué quieres aprender?</span>
      </Link>
      <div className="edu-head-actions">
        {courseMenu?.ready ? (
          <button
            type="button"
            className="edu-temario"
            onClick={() => courseMenu.setOpen(true)}
          >
            Temario
          </button>
        ) : null}
        <Link to="/edu/monedas" className="edu-head-coins" aria-label={`${pulse.balance} Edu Coins`}>
          <img src="/edu-coin.png" alt="" />
          {pulse.balance}
          <span>Edu Coins</span>
        </Link>
        <div className="edu-head-bell">
          <button
            type="button"
            aria-label="Notificaciones"
            aria-expanded={bell}
            onClick={(event) => {
              event.stopPropagation();
              setBell((value) => !value);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6.5 16.5h11l-.8-2.1a6 6 0 0 1-.6-2.6V9.2a4.1 4.1 0 0 0-8.2 0v2.6c0 .9-.2 1.8-.6 2.6z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path d="M10 16.8a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            {pulse.unread ? <i>{pulse.unread}</i> : null}
          </button>
          {bell ? (
            <div className="edu-menu edu-note-menu" onClick={(event) => event.stopPropagation()}>
              {pulse.notifications.length ? (
                pulse.notifications.map((note) => (
                  <Link
                    key={note.id}
                    to={note.href || '/edu/comunidad/actividad'}
                    onClick={() => {
                      api('/api/edu/notifications/read', {
                        method: 'POST',
                        token: auth.getToken(),
                        body: { id: note.id },
                      }).finally(() => refreshPulse(auth.getToken()));
                      setBell(false);
                    }}
                  >
                    <strong>{note.title}</strong>
                    <span>{note.body}</span>
                  </Link>
                ))
              ) : (
                <p>Sin avisos</p>
              )}
            </div>
          ) : null}
        </div>
        <Link to="/edu/eventos" className="edu-head-ticket" aria-label="Tickets de eventos">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.2a2 2 0 0 0 0 3.6V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.2a2 2 0 0 0 0-3.6z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path d="M12 7.5v9" stroke="currentColor" strokeWidth="1.7" strokeDasharray="2 2" />
          </svg>
        </Link>
        <Link to="/edu/perfil" className="edu-head-avatar" aria-label="Tu perfil">
          {pulse.avatar ? <img src={pulse.avatar} alt="" /> : initial}
        </Link>
      </div>
    </header>
  );
}
