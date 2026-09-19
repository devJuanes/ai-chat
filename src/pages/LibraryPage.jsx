import { useOutletContext } from 'react-router-dom';
import { useWorkspace } from '../lib/workspace';
import { LibraryIcon, MenuIcon } from '../components/Icons';

export default function LibraryPage() {
  const ws = useWorkspace();
  const { onToggleSidebar } = useOutletContext() || {};
  const archived = ws.conversations.filter((c) => c.archived_at);

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[56px] shrink-0 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border-2 border-black md:hidden"
          onClick={onToggleSidebar}
          aria-label="Menú"
        >
          <MenuIcon />
        </button>
        <div className="fp-mono">Biblioteca</div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
        <div className="mx-auto w-full max-w-[768px] px-6 py-10">
          <div className="mb-8">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36]">
              <LibraryIcon />
            </div>
            <h1
              className="fp-display"
              style={{ fontSize: 'clamp(36px, 7vw, 56px)' }}
            >
              Biblioteca
            </h1>
            <p className="mt-2 text-[15px] font-medium opacity-75">
              Chats archivados. Ábrelos o desarchívalos cuando quieras.
            </p>
          </div>

          {archived.length === 0 ? (
            <div className="fp-card border-dashed px-6 py-14 text-center text-[14px] font-medium opacity-55">
              No hay chats archivados
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {archived.map((c, i) => {
                const tones = [
                  'fp-card-pink',
                  'fp-card-matcha',
                  'fp-card-butter',
                  'fp-card',
                ];
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`fp-card ${tones[i % tones.length]} flex flex-col gap-1 px-4 py-3.5 text-left transition hover:-translate-y-0.5`}
                    onClick={() => ws.selectConversation(c.id, c.project_id)}
                  >
                    <span className="truncate text-[14px] font-bold">
                      {c.title}
                    </span>
                    <span className="truncate text-[13px] font-medium opacity-70">
                      {c.preview || 'Sin vista previa'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
