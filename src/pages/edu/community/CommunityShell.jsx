import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEduPulse } from '../pulse';
import { CommunityProvider, useCommunity } from './CommunityContext';
import CommunityNav from './CommunityNav';
import ComposeDialog from './ComposeDialog';
import Icon from './icons';

const DOCK = [
  { to: '/edu/comunidad', label: 'Inicio', icon: 'home', end: true },
  { to: '/edu/comunidad/foro', label: 'Foro', icon: 'chat' },
  { to: '/edu/comunidad/cursos', label: 'Cursos', icon: 'book' },
];

const CREATE_PICKS = [
  { kind: 'hilo', label: 'Hilo', hint: 'Una pregunta o una idea para el foro.', icon: 'chat', tone: 'hilo' },
  { kind: 'challenge', label: 'Reto', hint: 'Invita a otros a hacerlo contigo.', icon: 'trophy', tone: 'reto' },
  { kind: 'project', label: 'Proyecto', hint: 'Muestra lo que ya construiste.', icon: 'code', tone: 'proyecto' },
  { kind: 'group', label: 'Grupo', hint: 'Un espacio para estudiar juntos.', icon: 'people', tone: 'grupo' },
  { kind: 'event', label: 'Evento', hint: 'Una sesión con fecha y lugar.', icon: 'calendar', tone: 'evento', admin: true },
];

const MORE = [
  { to: '/edu/comunidad/actividad', label: 'Mi actividad', hint: 'Lo que estás haciendo ahora.', icon: 'bolt', tone: 'hilo' },
  { to: '/edu/comunidad/retos', label: 'Retos', hint: 'Entra y hazlo con otros.', icon: 'trophy', tone: 'reto' },
  { to: '/edu/comunidad/proyectos', label: 'Proyectos', hint: 'Lo que la gente ya construyó.', icon: 'code', tone: 'proyecto' },
  { to: '/edu/comunidad/grupos', label: 'Grupos', hint: 'Espacios para estudiar juntos.', icon: 'users', tone: 'grupo' },
  { to: '/edu/comunidad/eventos', label: 'Eventos', hint: 'Sesiones con fecha y ticket.', icon: 'calendar', tone: 'sesion' },
  { to: '/edu/comunidad/rachas', label: 'Rachas', hint: 'Quién lleva más días seguidos.', icon: 'chart', tone: 'racha' },
];

const SECTIONS = new Set(['foro', 'cursos', 'retos', 'proyectos', 'grupos', 'eventos', 'actividad', 'calendario', 'rachas', 'monedas']);

function CommunityFrame() {
  const { openCompose, notice, setNotice } = useCommunity();
  const pulse = useEduPulse();
  const { pathname } = useLocation();
  const tail = pathname.split('/').filter(Boolean).pop();
  const onPost = /^\/edu\/comunidad\/[^/]+$/.test(pathname) && tail && !SECTIONS.has(tail);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const create = (kind) => {
    setMenu(false);
    setMore(false);
    openCompose(kind);
  };

  return (
    <div className="edu-home">
      <div className={`edu-community${onPost ? ' is-post' : ''}`}>
        {onPost ? null : (
        <header className="edu-cm-head">
          <div className="edu-cm-brand">
            <span className="edu-cm-mark" aria-hidden="true">
              <Icon name="people" />
            </span>
            <div>
              <h1>Comunidad</h1>
              <p>Pregunta, muestra lo que construyes y ayuda a quien va en la misma ruta.</p>
            </div>
          </div>
          <div className="edu-cm-create">
            <button type="button" className="edu-btn edu-cm-publish" onClick={() => setMenu(true)}>
              <Icon name="pencil" />
              Crear
            </button>
          </div>
        </header>
        )}
        {onPost ? null : <CommunityNav />}
        {notice ? (
          <div className="edu-cm-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>
              Cerrar
            </button>
          </div>
        ) : null}
        <Outlet />
      </div>
      <nav className="edu-cm-dock" aria-label="Comunidad">
        {DOCK.slice(0, 2).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button type="button" className="edu-cm-dock-plus" aria-label="Crear" onClick={() => setMenu(true)}>
          <Icon name="plus" />
        </button>
        <NavLink to={DOCK[2].to}>
          <Icon name={DOCK[2].icon} />
          {DOCK[2].label}
        </NavLink>
        <button type="button" onClick={() => setMore(true)}>
          <Icon name="people" />
          Más
        </button>
      </nav>
      {menu ? (
        <div className="edu-cm-sheet" role="presentation" onClick={() => setMenu(false)}>
          <div className="edu-cm-sheet-card" role="dialog" aria-modal="true" aria-label="Crear" onClick={(event) => event.stopPropagation()}>
            <span className="edu-cm-sheet-grab" aria-hidden="true" />
            <strong>¿Qué vas a crear?</strong>
            <p className="edu-cm-sheet-lead">Elige uno y lo publicas enseguida.</p>
            <div className="edu-cm-create-grid">
              {CREATE_PICKS.filter((item) => !item.admin || pulse.admin).map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className={`edu-cm-create-pick is-${item.tone}`}
                  onClick={() => create(item.kind)}
                >
                  <span className="edu-cm-create-ico">
                    <Icon name={item.icon} />
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {more ? (
        <div className="edu-cm-sheet" role="presentation" onClick={() => setMore(false)}>
          <div className="edu-cm-sheet-card" role="dialog" aria-modal="true" aria-label="Más secciones" onClick={(event) => event.stopPropagation()}>
            <span className="edu-cm-sheet-grab" aria-hidden="true" />
            <strong>Más de la comunidad</strong>
            <p className="edu-cm-sheet-lead">Elige a dónde quieres ir.</p>
            <div className="edu-cm-create-grid">
              {MORE.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`edu-cm-create-pick is-${item.tone}`}
                  onClick={() => setMore(false)}
                >
                  <span className="edu-cm-create-ico">
                    <Icon name={item.icon} />
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <ComposeDialog />
    </div>
  );
}

export default function CommunityShell() {
  return (
    <CommunityProvider>
      <CommunityFrame />
    </CommunityProvider>
  );
}
