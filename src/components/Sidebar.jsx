import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import ProjectBadge from './ProjectBadge';
import AgentLoader from './AgentLoader';
import BrandLogo from './BrandLogo';
import {
  ArchiveIcon,
  ChatBubbleIcon,
  ChevronDownIcon,
  CompassIcon,
  LibraryIcon,
  LogoutIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from './Icons';

function displayName(auth) {
  return (
    auth.profile?.user?.name ||
    auth.user?.name ||
    auth.user?.email?.split('@')[0] ||
    'Usuario'
  );
}

export default function Sidebar({
  conversations,
  projects = [],
  activeId,
  activeProject,
  activeProjectId,
  view = 'chats',
  onViewChange,
  onSelect,
  onNewChat,
  onSelectProject,
  onExitProject,
  onOpenCreateProject,
  onOpenProfile,
  streaming = false,
}) {
  const auth = useAuth();
  const [filter, setFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const inProject = Boolean(activeProjectId);
  const name = displayName(auth);

  const visible = conversations.filter((c) => {
    if (view === 'library') return Boolean(c.archived_at);
    if (c.archived_at) return false;
    if (inProject) return c.project_id === activeProjectId;
    // Chats generales: sin proyecto
    return !c.project_id;
  }).filter((c) =>
    (c.title || '').toLowerCase().includes(filter.trim().toLowerCase())
  );

  const goChats = () => {
    onExitProject?.();
    onViewChange?.('chats');
  };

  const navBtn = (id, label, Icon, onClick) => (
    <button
      key={id}
      type="button"
      className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-[14px] text-graphite-ink hover:bg-hover-veil ${
        view === id && !inProject ? 'bg-hover-veil-strong font-medium' : ''
      }`}
      onClick={onClick || (() => onViewChange?.(id))}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="flex h-dvh flex-col overflow-hidden border-r border-hairline bg-sidebar-mist text-[14px]">
      <div className="flex flex-col gap-2.5 px-3 pb-2 pt-3">
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-hairline bg-pure-white shadow-[2px_2px_0_#000]">
            <BrandLogo size={32} decorative />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-graphite-ink">Matu AI</div>
            <div className="truncate text-[12px] text-hollow">Espacio de trabajo</div>
          </div>
        </div>

        <div className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-hollow" />
          <input
            type="text"
            placeholder={
              inProject
                ? 'Buscar en el proyecto'
                : view === 'library'
                  ? 'Buscar archivados'
                  : 'Buscar chats'
            }
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Buscar chats"
            className="w-full rounded-[10px] border border-hairline bg-pure-white py-2 pl-8 pr-2.5 text-[14px] text-graphite-ink placeholder:text-hollow focus:border-graphite-ink"
          />
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-1" aria-label="Principal">
        {navBtn('chats', 'Chats', ChatBubbleIcon, goChats)}
        {navBtn('explore', 'Explorar', CompassIcon, () => {
          onExitProject?.();
          onViewChange?.('explore');
        })}
        {navBtn('library', 'Biblioteca', LibraryIcon, () => {
          onExitProject?.();
          onViewChange?.('library');
        })}
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-[14px] font-medium text-graphite-ink hover:bg-hover-veil"
          onClick={onNewChat}
        >
          <PencilIcon />
          <span>{inProject ? 'Nuevo chat en proyecto' : 'Nuevo chat'}</span>
        </button>
      </nav>

      <div className="mx-3 mt-2 h-px bg-hairline" />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3 scrollbar-quiet">
        {inProject ? (
          <>
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-2 rounded-[12px] border border-hairline bg-pure-white px-2.5 py-2 text-left hover:bg-hover-veil"
              onClick={goChats}
            >
              <span className="text-[12px] text-hollow">←</span>
              <span className="text-[13px] text-mid-ash">Volver a chats</span>
            </button>

            <div className="mb-3 flex items-center gap-2.5 rounded-[12px] bg-hover-veil px-2.5 py-2.5">
              <ProjectBadge project={activeProject} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">
                  {activeProject?.name || 'Proyecto'}
                </div>
                <div className="truncate text-[12px] text-hollow">
                  Contexto compartido entre chats
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-pure-white text-graphite-ink hover:bg-hover-veil-strong"
                title="Nuevo chat en este proyecto"
                aria-label="Nuevo chat en este proyecto"
                onClick={onNewChat}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="px-2.5 pb-2 text-xs font-medium text-hollow">
              Chats del proyecto
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-2.5">
              <span className="text-xs font-medium text-hollow">Proyectos</span>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-mid-ash hover:bg-hover-veil hover:text-graphite-ink"
                title="Nuevo proyecto"
                aria-label="Nuevo proyecto"
                onClick={onOpenCreateProject}
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {(projects || []).length === 0 ? (
              <button
                type="button"
                className="mb-3 w-full rounded-[12px] border border-dashed border-hairline px-3 py-3 text-left hover:bg-hover-veil"
                onClick={onOpenCreateProject}
              >
                <div className="text-[13px] font-medium text-graphite-ink">
                  Crear tu primer proyecto
                </div>
                <div className="mt-0.5 text-[12px] text-hollow">
                  Agrupa chats con contexto compartido
                </div>
              </button>
            ) : (
              <div className="mb-3 flex flex-col gap-0.5">
                {(projects || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left hover:bg-hover-veil"
                    onClick={() => onSelectProject?.(p.id)}
                  >
                    <ProjectBadge project={p} size={26} />
                    <span className="truncate text-[14px]">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="px-2.5 pb-2 pt-1 text-xs font-medium text-hollow">
              {view === 'library' ? 'Archivados' : 'Recientes'}
            </div>
          </>
        )}

        {view === 'explore' && !inProject ? (
          <div className="px-2.5 py-2 text-[13px] leading-relaxed text-mid-ash">
            Abre Explorar en el panel principal para ver modelos y prompts.
          </div>
        ) : visible.length === 0 ? (
          <div className="px-2.5 py-2.5 text-[14px] text-hollow">
            {filter
              ? 'Sin coincidencias'
              : view === 'library'
                ? 'No hay chats archivados'
                : inProject
                  ? 'Aún no hay chats. Pulsa + para crear uno.'
                  : 'Aún no hay conversaciones'}
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-0.5 rounded-[10px] px-2.5 py-1.5 text-left text-graphite-ink hover:bg-hover-veil ${
                    c.id === activeId ? 'bg-hover-veil-strong' : ''
                  }`}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="flex items-center gap-1.5 truncate text-[14px] font-medium leading-tight">
                    {c.pinned_at ? (
                      <span className="text-[10px] text-hollow" title="Fijado">
                        ●
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {streaming && c.id === activeId ? (
                      <AgentLoader size="sm" className="shrink-0" />
                    ) : null}
                  </span>
                  <span className="truncate text-[13px] leading-tight text-hollow">
                    {c.preview || '…'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-3 pb-3 pt-2">
        <div className="h-px bg-hairline" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="inline-flex h-9 w-full max-w-full items-center gap-2 rounded-[12px] border border-hairline bg-pure-white px-2.5 text-[14px] font-medium text-graphite-ink hover:border-black/15"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sidebar-mist text-[11px] font-semibold">
              {(name || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{name}</span>
            <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-hollow" />
          </button>

          {menuOpen && (
            <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-full min-w-[220px] overflow-hidden rounded-[12px] border border-hairline bg-pure-white p-1.5 shadow-sm">
              <div className="px-2.5 py-2">
                <div className="truncate text-[14px] font-medium">{name}</div>
                <div className="truncate text-[12px] text-hollow">
                  {auth.user?.email}
                </div>
              </div>
              <div className="my-1 h-px bg-hairline" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left hover:bg-hover-veil"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenProfile?.();
                }}
              >
                <UserIcon />
                <span>Mi perfil</span>
              </button>
              <a
                className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left no-underline text-graphite-ink hover:bg-hover-veil"
                href={auth.companyUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <ArchiveIcon />
                <span>Mejorar plan</span>
              </a>
              <div className="my-1 h-px bg-hairline" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-mid-ash hover:bg-hover-veil hover:text-graphite-ink"
                onClick={() => {
                  setMenuOpen(false);
                  auth.signOut({ redirectTo: '/' });
                }}
              >
                <LogoutIcon />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>

        {!auth.user && (
          <Link
            to="/login"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-hairline bg-pure-white px-4 text-[14px] font-medium text-graphite-ink no-underline hover:border-black/15"
          >
            <UserIcon className="text-mid-ash" />
            <span>Iniciar sesión</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
