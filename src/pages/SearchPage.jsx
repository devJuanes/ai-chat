import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useWorkspace } from '../lib/workspace';
import ProjectBadge from '../components/ProjectBadge';
import {
  ChatBubbleIcon,
  FolderIcon,
  MenuIcon,
  SearchIcon,
} from '../components/Icons';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export default function SearchPage() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) {
      return { chats: [], projects: [] };
    }
    const chats = (ws.conversations || [])
      .filter((c) => {
        if (c.archived_at) return false;
        const hay = `${c.title || ''} ${c.preview || ''}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 40);
    const projects = (ws.projects || [])
      .filter((p) => (p.name || '').toLowerCase().includes(query))
      .slice(0, 20);
    return { chats, projects };
  }, [query, ws.conversations, ws.projects]);

  const hasQuery = Boolean(query);
  const empty =
    hasQuery && results.chats.length === 0 && results.projects.length === 0;

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
        <div className="fp-mono">Buscar</div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-8 sm:px-8">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40" />
            <input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar chats, proyectos o vistas previas…"
              className="fp-input w-full py-3.5 pl-10 pr-4"
            />
          </div>

          {!hasQuery ? (
            <p className="text-center text-[14px] font-medium opacity-55">
              Escribe para buscar en tus chats y proyectos.
            </p>
          ) : empty ? (
            <p className="text-center text-[14px] font-medium opacity-55">
              Sin resultados para “{q.trim()}”
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {results.projects.length > 0 && (
                <section>
                  <h2 className="fp-mono mb-2 opacity-55">Proyectos</h2>
                  <ul className="flex flex-col gap-2">
                    {results.projects.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="fp-card flex w-full items-center gap-3 px-3 py-2.5 text-left hover:-translate-y-0.5"
                          onClick={() => {
                            ws.selectProject(p.id);
                            navigate(`/p/${p.id}`);
                          }}
                        >
                          <ProjectBadge project={p} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold">
                              {p.name}
                            </div>
                            <div className="fp-mono mt-0.5 opacity-50">
                              Proyecto
                            </div>
                          </div>
                          <FolderIcon className="h-4 w-4 shrink-0 opacity-40" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {results.chats.length > 0 && (
                <section>
                  <h2 className="fp-mono mb-2 opacity-55">Chats</h2>
                  <ul className="flex flex-col gap-2">
                    {results.chats.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="fp-card flex w-full items-start gap-3 px-3 py-2.5 text-left hover:-translate-y-0.5"
                          onClick={() => {
                            ws.selectConversation(c.id, c.project_id || null);
                          }}
                        >
                          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center opacity-60">
                            <ChatBubbleIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold">
                              {c.title || 'Sin título'}
                            </div>
                            <div className="mt-0.5 line-clamp-1 text-[13px] font-medium opacity-65">
                              {c.preview || 'Sin vista previa'}
                            </div>
                          </div>
                          <span className="fp-mono shrink-0 pt-0.5 opacity-45">
                            {formatDate(c.updated_at || c.created_at)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
