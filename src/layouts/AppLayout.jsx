import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { WorkspaceProvider, useWorkspace } from '../lib/workspace';
import AgentLoader from '../components/AgentLoader';
import ProjectBadge from '../components/ProjectBadge';
import ProjectModal from '../components/ProjectModal';
import {
  ArchiveIcon,
  BotIcon,
  ChatBubbleIcon,
  ChevronDownIcon,
  CompassIcon,
  FilmIcon,
  InboxIcon,
  LibraryIcon,
  LogoutIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from '../components/Icons';
import { CloseIcon, MenuIcon } from '../components/Icons';
import BrandLogo from '../components/BrandLogo';
import { isSizorEmbed } from '../lib/sizorEmbed';

const PROJECTS_PREVIEW = 6;

function displayName(auth, profileUser) {
  return (
    profileUser?.name ||
    auth.user?.name ||
    auth.user?.email?.split('@')[0] ||
    'Usuario'
  );
}

function ChatListItem({
  conversation: c,
  active,
  generating = false,
  onSelect,
  onPin,
  leading = null,
  className = '',
  titleClassName = '',
}) {
  const pinned = Boolean(c.pinned_at);
  return (
    <div
      className={`group fp-chat-item flex w-full max-w-full min-w-0 items-center gap-0.5 overflow-hidden transition-colors ${
        active ? 'fp-chat-active' : ''
      } ${className}`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
        onClick={onSelect}
      >
        {leading}
        <span
          className={`fp-chat-title min-w-0 flex-1 truncate text-[13.5px] leading-tight ${
            generating ? 'opacity-70' : ''
          } ${titleClassName}`}
        >
          {c.title || 'Nuevo chat'}
        </span>
        {generating ? (
          <AgentLoader size="sm" className="shrink-0" />
        ) : null}
      </button>
      <button
        type="button"
        className={`mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] transition ${
          pinned
            ? 'text-[#f4ed36] opacity-80 hover:bg-black/20 hover:opacity-100 group-hover:opacity-100'
            : 'text-white/40 opacity-0 hover:bg-black/20 hover:text-[#f4ed36] group-hover:opacity-100'
        }`}
        title={pinned ? 'Desfijar' : 'Fijar chat'}
        aria-label={pinned ? 'Desfijar' : 'Fijar chat'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPin?.(!pinned, c.id);
        }}
      >
        <PinIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SkeletonRows({ count = 4 }) {
  return (
    <div className="mb-3 flex flex-col gap-1.5 px-1" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-1 py-1">
          <div className="skeleton h-[22px] w-[22px] shrink-0 rounded-md" />
          <div
            className="skeleton h-3.5 flex-1"
            style={{ maxWidth: `${58 + (i % 3) * 12}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children, open, onToggle }) {
  return (
    <button
      type="button"
      className="fp-section mb-1 flex w-full items-center gap-1 px-2 py-1 text-left"
      onClick={onToggle}
    >
      <span className="flex-1">{children}</span>
      <ChevronDownIcon
        className={`h-3 w-3 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
      />
    </button>
  );
}

function ShellSidebar({
  onOpenCreateProject,
  onCloseMobile,
  filter,
  setFilter,
  embed = false,
  className = '',
}) {
  const auth = useAuth();
  const ws = useWorkspace();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(() => new Set());
  const [sections, setSections] = useState({
    pinned: true,
    projects: true,
    chats: true,
  });
  const userMenuRef = useRef(null);
  const name = displayName(auth, ws.profileUser);
  const planName = ws.plan?.name || ws.plan?.id || 'Gratis';
  const q = filter.trim().toLowerCase();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!ws.projectId) return;
    setExpandedProjects((prev) => {
      if (prev.has(ws.projectId)) return prev;
      const next = new Set(prev);
      next.add(ws.projectId);
      return next;
    });
  }, [ws.projectId]);

  const toggleProjectChats = (projectId, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const pinned = useMemo(
    () =>
      ws.conversations.filter(
        (c) =>
          c.pinned_at &&
          !c.archived_at &&
          (c.title || '').toLowerCase().includes(q)
      ),
    [ws.conversations, q]
  );

  const projects = useMemo(
    () =>
      ws.projects.filter((p) => (p.name || '').toLowerCase().includes(q)),
    [ws.projects, q]
  );

  const chats = useMemo(
    () =>
      ws.conversations.filter((c) => {
        if (pathname.startsWith('/library')) return Boolean(c.archived_at);
        if (c.archived_at || c.project_id || c.pinned_at) return false;
        return (c.title || '').toLowerCase().includes(q);
      }),
    [ws.conversations, pathname, q]
  );

  const visibleProjects = showAllProjects
    ? projects
    : projects.slice(0, PROJECTS_PREVIEW);

  const toggleSection = (key) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  const linkClass = (active) =>
    `fp-nav-btn flex items-center gap-2.5 px-2.5 py-2 text-[14px] transition-colors ${
      active ? 'fp-nav-active' : ''
    }`;

  return (
    <aside
      className={`fp-aside flex h-full max-h-dvh flex-col overflow-hidden text-[14px] ${className}`}
    >      <div className="flex flex-col gap-3 px-3 pb-2 pt-3.5">
        <div className="flex items-center gap-2.5 px-1.5">
          <span className="fp-mark inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
            <BrandLogo size={36} decorative />
          </span>
          <div className="min-w-0">
            <div className="fp-brand truncate">Matu AI</div>
            <div className="fp-brand-sub truncate">Espacio de trabajo</div>
          </div>
        </div>

        <button
          type="button"
          className="fp-search relative flex w-full items-center py-2.5 pl-9 pr-3 text-left text-[13px]"
          onClick={() => {
            onCloseMobile?.();
            navigate('/search');
          }}
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          Buscar
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-1" aria-label="Principal">
        <button
          type="button"
          className="fp-nav-btn flex items-center gap-2.5 px-2.5 py-2 text-left text-[14px] font-medium"
          onClick={() => {
            ws.exitProject();
            onCloseMobile?.();
          }}
        >
          <PencilIcon />
          <span>Nuevo chat</span>
        </button>
        <NavLink
          to="/search"
          className={({ isActive }) => linkClass(isActive)}
          onClick={onCloseMobile}
        >
          <SearchIcon />
          <span>Buscar</span>
        </NavLink>
        <NavLink
          to="/explore"
          className={({ isActive }) => linkClass(isActive)}
          onClick={onCloseMobile}
        >
          <CompassIcon />
          <span>Explorar</span>
        </NavLink>
        <NavLink
          to="/imagine"
          className={({ isActive }) => linkClass(isActive)}
          onClick={onCloseMobile}
        >
          <FilmIcon />
          <span>Imagine</span>
        </NavLink>
        <NavLink
          to="/bots"
          className={({ isActive }) => linkClass(isActive)}
          onClick={onCloseMobile}
        >
          <BotIcon />
          <span>Agentes</span>
        </NavLink>
        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            linkClass(isActive || pathname.startsWith('/inbox/'))
          }
          onClick={onCloseMobile}
        >
          <InboxIcon />
          <span>Inbox</span>
        </NavLink>
        <NavLink
          to="/library"
          className={({ isActive }) => linkClass(isActive)}
          onClick={onCloseMobile}
        >
          <LibraryIcon />
          <span>Biblioteca</span>
        </NavLink>
      </nav>

      <div className="fp-divider mx-3 mt-2 h-px" />

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-2 pt-3 scrollbar-quiet">
        <SectionLabel
          open={sections.pinned}
          onToggle={() => toggleSection('pinned')}
        >
          Fijado
        </SectionLabel>
        {sections.pinned && (
          <div className="mb-3 flex flex-col gap-0.5">
            {ws.listLoading && pinned.length === 0 ? (
              <SkeletonRows count={2} />
            ) : pinned.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-white/50">
                Fija un chat para verlo aquí
              </div>
            ) : (
              pinned.map((c) => {
                const project = c.project_id
                  ? ws.projects.find((p) => p.id === c.project_id)
                  : null;
                return (
                  <ChatListItem
                    key={c.id}
                    conversation={c}
                    active={ws.active?.id === c.id}
                    generating={ws.streaming && ws.active?.id === c.id}
                    onSelect={() => {
                      ws.selectConversation(c.id, c.project_id);
                      onCloseMobile?.();
                    }}
                    onPin={ws.pinConversation}
                    leading={
                      project ? (
                        <ProjectBadge project={project} size={22} />
                      ) : (
                        <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center text-white/70">
                          <ChatBubbleIcon className="h-3.5 w-3.5" />
                        </span>
                      )
                    }
                  />
                );
              })
            )}
          </div>
        )}

        <div className="mb-1 flex items-center gap-1 px-2">
          <button
            type="button"
            className="fp-section flex flex-1 items-center gap-1 py-1 text-left"
            onClick={() => toggleSection('projects')}
          >
            <span className="flex-1">Proyectos</span>
            <ChevronDownIcon
              className={`h-3 w-3 shrink-0 transition-transform ${
                sections.projects ? '' : '-rotate-90'
              }`}
            />
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-white/70 hover:bg-black/20 hover:text-[#f4ed36]"
            title="Nuevo proyecto"
            aria-label="Nuevo proyecto"
            onClick={onOpenCreateProject}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {sections.projects && (
          <div className="mb-3 flex flex-col gap-0.5">
            {ws.listLoading && projects.length === 0 ? (
              <SkeletonRows count={3} />
            ) : projects.length === 0 ? (
              <button
                type="button"
                className="w-full rounded-[6px] border-2 border-dashed border-white/40 bg-black/15 px-3 py-3 text-left transition hover:border-[#f4ed36] hover:bg-black/25"
                onClick={onOpenCreateProject}
              >
                <div className="text-[13px] font-bold text-[#f9f5f2]">
                  Crear tu primer proyecto
                </div>
                <div className="mt-0.5 text-[12px] text-white/55">
                  Agrupa chats con contexto compartido
                </div>
              </button>
            ) : (
              <>
                {visibleProjects.map((p) => {
                  const isActiveProject = ws.projectId === p.id;
                  const chatsExpanded = expandedProjects.has(p.id);
                  const projectChats = ws.conversations.filter(
                    (c) =>
                      c.project_id === p.id &&
                      !c.archived_at &&
                      (c.title || '').toLowerCase().includes(q)
                  );
                  const hasChats = projectChats.length > 0;
                  return (
                    <div key={p.id} className="flex flex-col gap-0.5">
                      <div
                        className={`group flex items-center gap-0.5 rounded-[6px] pr-1 transition-colors ${
                          isActiveProject
                            ? 'bg-black/30'
                            : 'hover:bg-black/15'
                        }`}
                      >
                        <button
                          type="button"
                          className={`inline-flex h-7 w-5 shrink-0 items-center justify-center rounded-md text-white/50 transition-colors hover:text-[#f4ed36] ${
                            hasChats
                              ? 'opacity-100'
                              : 'pointer-events-none opacity-0'
                          }`}
                          title={
                            chatsExpanded ? 'Ocultar chats' : 'Mostrar chats'
                          }
                          aria-label={
                            chatsExpanded
                              ? 'Ocultar chats del proyecto'
                              : 'Mostrar chats del proyecto'
                          }
                          aria-expanded={chatsExpanded}
                          onClick={(e) => toggleProjectChats(p.id, e)}
                        >
                          <ChevronDownIcon
                            className={`h-3 w-3 transition-transform ${
                              chatsExpanded ? '' : '-rotate-90'
                            }`}
                          />
                        </button>
                        <NavLink
                          to={`/p/${p.id}`}
                          onClick={onCloseMobile}
                          className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-1 text-left"
                        >
                          <ProjectBadge project={p} size={22} />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] text-[#f9f5f2]">
                            {p.name}
                          </span>
                        </NavLink>
                        <span className="hidden shrink-0 items-center gap-0.5 text-white/50 group-hover:inline-flex">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/20 hover:text-[#f4ed36]"
                            title="Más"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreIcon className="h-3.5 w-3.5" />
                          </span>
                        </span>
                      </div>
                      {chatsExpanded &&
                        projectChats.map((c) => (
                          <ChatListItem
                            key={c.id}
                            conversation={c}
                            active={ws.active?.id === c.id}
                            generating={ws.streaming && ws.active?.id === c.id}
                            className="pl-5"
                            titleClassName={
                              ws.active?.id === c.id ? 'font-medium' : ''
                            }
                            onSelect={() => {
                              ws.selectConversation(c.id, p.id);
                              onCloseMobile?.();
                            }}
                            onPin={ws.pinConversation}
                          />
                        ))}
                    </div>
                  );
                })}
                {projects.length > PROJECTS_PREVIEW && (
                  <button
                    type="button"
                    className="px-2 py-1.5 text-left text-[12px] text-white/50 hover:text-[#f4ed36]"
                    onClick={() => setShowAllProjects((v) => !v)}
                  >
                    {showAllProjects ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <SectionLabel
          open={sections.chats}
          onToggle={() => toggleSection('chats')}
        >
          {pathname.startsWith('/library') ? 'Archivados' : 'Chats'}
        </SectionLabel>
        {sections.chats && (
          <>
            {ws.listLoading && chats.length === 0 ? (
              <SkeletonRows count={5} />
            ) : chats.length === 0 ? (
              <div className="px-2 py-2.5 text-[13px] text-white/50">
                {q
                  ? 'Sin coincidencias'
                  : pathname.startsWith('/library')
                    ? 'No hay chats archivados'
                    : 'Aún no hay conversaciones'}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {chats.map((c) => (
                  <li key={c.id}>
                    <ChatListItem
                      conversation={c}
                      active={ws.active?.id === c.id}
                      generating={ws.streaming && ws.active?.id === c.id}
                      onSelect={() => {
                        ws.selectConversation(c.id, null);
                        onCloseMobile?.();
                      }}
                      onPin={ws.pinConversation}
                      leading={
                        <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center text-white/70">
                          <ChatBubbleIcon className="h-3.5 w-3.5" />
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div
        className="relative z-30 min-w-0 shrink-0 overflow-visible px-3 pb-3 pt-2"
        ref={userMenuRef}
      >
        <div className="fp-divider mb-2 h-px" />
        <div className="fp-user-card flex min-w-0 items-center gap-1.5 overflow-hidden px-2 py-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-[6px] px-1 py-0.5 text-left hover:bg-black/15"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black bg-[#f4ed36] text-[11px] font-bold text-black">
              {(name || 'U')
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join('')
                .toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="block truncate text-[13px] font-bold text-[#f9f5f2]">
                {name}
              </span>
              <span className="fp-brand-sub block truncate">{planName}</span>
            </span>
          </button>
          {!embed ? (
            <button
              type="button"
              className="fp-pill shrink-0 px-2 py-1.5 text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onCloseMobile?.();
                navigate('/usage');
              }}
            >
              Mejorar
            </button>
          ) : null}
        </div>

        {menuOpen ? (
          <div
            role="menu"
            className="fp-user-menu absolute bottom-[calc(100%+6px)] left-3 right-3 z-50 overflow-hidden p-1.5"
          >
            <div className="px-2.5 py-2">
              <div className="truncate text-[14px] font-bold">{name}</div>
              <div className="truncate text-[12px] opacity-55">
                {auth.user?.email}
              </div>
            </div>
            <div className="my-1 h-px bg-black/15" />
            <NavLink
              to="/settings/perfil"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-[6px] px-2.5 py-2 no-underline hover:bg-black/5 ${
                  isActive ? 'bg-black/5 font-bold' : ''
                }`
              }
              onClick={() => {
                setMenuOpen(false);
                onCloseMobile?.();
              }}
            >
              <UserIcon />
              <span>Mi perfil</span>
            </NavLink>
            {!embed ? (
              <NavLink
                to="/settings/facturacion"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-[6px] px-2.5 py-2 no-underline hover:bg-black/5 ${
                    isActive ? 'bg-black/5 font-bold' : ''
                  }`
                }
                onClick={() => {
                  setMenuOpen(false);
                  onCloseMobile?.();
                }}
              >
                <ArchiveIcon />
                <span>Facturación</span>
              </NavLink>
            ) : null}
            {!embed ? (
              <>
                <div className="my-1 h-px bg-black/15" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left opacity-70 hover:bg-black/5 hover:opacity-100"
                  onClick={() => {
                    setMenuOpen(false);
                    auth.signOut({ redirectTo: '/' });
                  }}
                >
                  <LogoutIcon />
                  <span>Cerrar sesión</span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function LayoutInner() {
  const embed = isSizorEmbed();
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window === 'undefined'
      ? !embed
      : embed
        ? false
        : !window.matchMedia('(max-width: 768px)').matches
  );
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [filter, setFilter] = useState('');
  const ws = useWorkspace();

  useEffect(() => {
    if (embed) return undefined;
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => setSidebarOpen(!mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [embed]);

  const closeOnMobile = () => {
    if (embed) {
      setMenuModalOpen(false);
      return;
    }
    if (window.matchMedia('(max-width: 768px)').matches) {
      setSidebarOpen(false);
    }
  };

  const handleCreateProject = async (payload) => {
    setCreatingProject(true);
    try {
      const project = await ws.createProject(payload);
      if (project) setProjectModalOpen(false);
    } finally {
      setCreatingProject(false);
    }
  };

  const toggleMenu = () => {
    if (embed) setMenuModalOpen((v) => !v);
    else setSidebarOpen((v) => !v);
  };

  if (embed) {
    return (
      <div className="fp-app relative h-dvh w-screen">
        <div className="min-h-0 min-w-0 h-full">
          <Outlet context={{ onToggleSidebar: toggleMenu, sizorEmbed: true }} />
        </div>

        {menuModalOpen ? (
          <div className="fixed inset-0 z-[80] flex items-stretch justify-end sm:items-center sm:justify-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              aria-label="Cerrar menú"
              onClick={() => setMenuModalOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menú MatuAI"
              className="relative z-10 flex h-full w-full max-w-[320px] flex-col overflow-hidden border-l-2 border-black bg-[#1a1a1a] shadow-2xl sm:h-[min(92dvh,720px)] sm:rounded-2xl sm:border-2"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                <span className="text-[13px] font-bold text-[#f9f5f2]">
                  Menú
                </span>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/20 text-[#f9f5f2] hover:bg-white/10"
                  aria-label="Cerrar"
                  onClick={() => setMenuModalOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ShellSidebar
                  embed
                  onOpenCreateProject={() => {
                    setMenuModalOpen(false);
                    setProjectModalOpen(true);
                  }}
                  onCloseMobile={closeOnMobile}
                  filter={filter}
                  setFilter={setFilter}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        ) : null}

        <ProjectModal
          open={projectModalOpen}
          onClose={() => setProjectModalOpen(false)}
          onSubmit={handleCreateProject}
          busy={creatingProject}
        />
      </div>
    );
  }

  return (
    <div
      className={`fp-app grid h-dvh w-screen ${
        sidebarOpen ? 'md:grid-cols-[280px_1fr]' : 'grid-cols-1'
      }`}
    >
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed left-3 top-3 z-60 inline-flex h-9 w-9 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] text-black md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        >
          <CloseIcon />
        </button>
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[100vw] overflow-hidden transition-transform duration-200 md:static md:w-auto md:max-w-none md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <ShellSidebar
          onOpenCreateProject={() => setProjectModalOpen(true)}
          onCloseMobile={closeOnMobile}
          filter={filter}
          setFilter={setFilter}
        />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-deep-charcoal md:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="min-w-0 min-h-0">
        <Outlet context={{ onToggleSidebar: toggleMenu, sizorEmbed: false }} />
      </div>

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSubmit={handleCreateProject}
        busy={creatingProject}
      />
    </div>
  );
}

export default function AppLayout() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="fp-app grid h-dvh place-items-center bg-[#f9f5f2]">
        <p className="text-[14px] font-bold opacity-60">Cargando sesión…</p>
      </div>
    );
  }

  if (!auth.user?.id || !auth.getToken()) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return (
    <WorkspaceProvider>
      <LayoutInner />
    </WorkspaceProvider>
  );
}
