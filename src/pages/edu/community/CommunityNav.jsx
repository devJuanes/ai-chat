import { NavLink, useLocation } from 'react-router-dom';
import { useEduPulse } from '../pulse';
import Icon from './icons';

const LINKS = [
  { to: '/edu/comunidad', label: 'Inicio', end: true, icon: 'home' },
  { to: '/edu/comunidad/foro', label: 'Foro', icon: 'chat' },
  { to: '/edu/comunidad/cursos', label: 'Cursos', icon: 'book' },
  { to: '/edu/comunidad/retos', label: 'Retos', icon: 'trophy' },
  { to: '/edu/comunidad/proyectos', label: 'Proyectos', icon: 'code' },
  { to: '/edu/comunidad/grupos', label: 'Grupos', icon: 'users' },
  { to: '/edu/comunidad/eventos', label: 'Eventos', icon: 'calendar' },
  { to: '/edu/comunidad/actividad', label: 'Actividad', icon: 'bolt' },
  { to: '/edu/comunidad/rachas', label: 'Rachas', icon: 'chart' },
];

const RESERVED = new Set(LINKS.map((link) => link.to.split('/').pop()).filter((part) => part && part !== 'comunidad'));

export default function CommunityNav() {
  const { pathname } = useLocation();
  const pulse = useEduPulse();
  const tail = pathname.split('/').filter(Boolean).pop();
  const onPost = /^\/edu\/comunidad\/[^/]+$/.test(pathname) && tail && !RESERVED.has(tail);
  const links = pulse.groups
    ? [
        ...LINKS.slice(0, 6),
        { to: '/edu/comunidad/grupos?mios=1', label: 'Mis grupos', icon: 'users' },
        ...LINKS.slice(6),
      ]
    : LINKS;

  return (
    <nav className="edu-cm-nav" aria-label="Secciones de comunidad">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={link.to.endsWith('/foro') && onPost ? 'is-on' : undefined}
        >
          <Icon name={link.icon} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
