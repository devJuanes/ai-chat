import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import LoadingRing from '../../components/LoadingRing';
import BrandLogo from '../../components/BrandLogo';
import { applyPageTitle, eduSectionTitle } from '../../lib/pageTitle';
import EduHeader from './EduHeader';
import { CourseMenuProvider } from './courseMenu';
import './edu.css';

function MenuIcon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="3" />
        <path d="M4 19c.6-2.4 2.4-4 5-4s4.4 1.6 5 4" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16 15c1.8.3 3.2 1.5 3.8 4" />
      </svg>
    );
  }
  if (name === 'folder') {
    return (
      <svg {...common}>
        <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="9" r="4" />
      <path d="M8.5 13.5 7 20l5-2 5 2-1.5-6.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c.8-3.2 3.2-5 6.5-5s5.7 1.8 6.5 5" />
    </svg>
  );
}

function givenNames(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ') || 'Estudiante';
}

const MAIN = [
  { to: '/edu', label: 'Inicio', end: true, icon: 'home' },
  { to: '/edu/crear', label: 'Crear', icon: 'plus' },
  { to: '/edu/comunidad', label: 'Comunidad', icon: 'people' },
  { to: '/edu/soporte', label: 'Soporte', avatar: true },
];

const PROGRESS = [
  { to: '/edu/rutas', label: 'Rutas', icon: 'folder' },
  { to: '/edu/certificados', label: 'Certificados', icon: 'badge' },
];

export default function EduLayout() {
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const section = eduSectionTitle(location.pathname);

  useEffect(() => {
    if (!section) return;
    applyPageTitle(section, 'EduCreator');
  }, [section]);

  if (auth.loading) {
    return (
      <div className="edu-app" style={{ display: 'grid', placeItems: 'center' }}>
        <LoadingRing />
      </div>
    );
  }

  if (!auth.user?.id || !auth.getToken()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  const name = givenNames(auth.user?.name || auth.user?.email?.split('@')[0]);

  return (
    <div className="edu-app">
      <header className="edu-topbar">
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú">
          Menú
        </button>
        <strong>{section || 'EduCreator'}</strong>
      </header>
      {open ? (
        <button
          type="button"
          className="edu-scrim"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside className={`edu-aside${open ? ' open' : ''}`}>
        <NavLink to="/edu" className="edu-brand" onClick={() => setOpen(false)}>
          <span className="edu-mark">
            <BrandLogo size={36} decorative />
          </span>
          <span className="edu-brand-copy">
            <span className="edu-word">EduCreator</span>
            <span className="edu-lema">Aprende usando la IA.</span>
          </span>
        </NavLink>
        <nav className="edu-nav" aria-label="EduCreator">
          {MAIN.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
            >
              {link.avatar ? (
                <img src="/avatar-matuai.png" alt="" />
              ) : (
                <MenuIcon name={link.icon} />
              )}
              {link.label}
            </NavLink>
          ))}
          <p className="edu-nav-label">Tu progreso</p>
          {PROGRESS.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={() => setOpen(false)}>
              <MenuIcon name={link.icon} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="edu-aside-foot">
          <div className="edu-user">
            <UserIcon />
            <span>{name}</span>
          </div>
        </div>
      </aside>
      <CourseMenuProvider>
        <div className="edu-main">
          <EduHeader onMenu={() => setOpen(true)} />
          <div className="edu-main-body">
            <Outlet />
          </div>
        </div>
      </CourseMenuProvider>
    </div>
  );
}
