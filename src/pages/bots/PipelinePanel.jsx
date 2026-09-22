import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

export default function PipelinePanel({ token, onError, onNotice }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api('/api/pipeline', { token });
      setColumns(res.columns || []);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const moveTo = async (conversationId, stage) => {
    try {
      await api(`/api/pipeline/${conversationId}`, {
        token,
        method: 'PATCH',
        body: { stage },
      });
      onNotice?.('Lead movido');
      await load();
    } catch (err) {
      onError?.(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[14px] opacity-50">
        Cargando tablero…
      </div>
    );
  }

  const total = columns.reduce((n, c) => n + (c.cards?.length || 0), 0);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-[18px] font-semibold tracking-tight">
          Pipeline Kanban
        </h2>
        <p className="text-[13px] opacity-70">
          Califica leads. La IA sugiere etapas; tú puedes mover las tarjetas.
          {total ? ` · ${total} chats` : ''}
        </p>
      </div>

      {total === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-[22px] font-semibold">Sin conversaciones aún</p>
          <p className="mt-2 max-w-md text-[14px] opacity-55">
            Cuando lleguen mensajes de Meta, aparecerán aquí para calificarlos.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div
              key={col.id}
              className="flex w-[240px] shrink-0 flex-col rounded-xl border-2 border-black bg-[#faf8f5]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging && dragging !== col.id) {
                  // dragging stores conversation id
                  moveTo(dragging, col.id);
                }
                setDragging(null);
              }}
            >
              <div className="flex items-center justify-between border-b-2 border-black px-3 py-2">
                <span className="text-[13px] font-semibold">{col.label}</span>
                <span className="rounded-full bg-black px-2 py-0.5 text-[10px] text-[#f4ed36]">
                  {col.cards?.length || 0}
                </span>
              </div>
              <ul className="flex max-h-[min(60vh,520px)] flex-col gap-2 overflow-y-auto p-2">
                {(col.cards || []).map((card) => (
                  <li key={card.id}>
                    <div
                      draggable
                      onDragStart={() => setDragging(card.id)}
                      onDragEnd={() => setDragging(null)}
                      className="cursor-grab rounded-lg border-2 border-black bg-white px-2.5 py-2 active:cursor-grabbing"
                    >
                      <Link
                        to={`/inbox/${card.id}`}
                        className="block truncate text-[13px] font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {card.title || 'Chat'}
                      </Link>
                      <p className="mt-0.5 line-clamp-2 text-[11px] opacity-60">
                        {card.preview || '—'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="fp-mono rounded border border-black/20 px-1 text-[9px] uppercase opacity-50">
                          {card.source}
                        </span>
                        <span className="fp-mono rounded border border-black/20 px-1 text-[9px] uppercase opacity-50">
                          {card.assignee === 'human' ? 'humano' : 'bot'}
                        </span>
                      </div>
                      <select
                        className="mt-2 w-full rounded border border-black/30 bg-[#faf8f5] px-1 py-0.5 text-[10px]"
                        value={col.id}
                        onChange={(e) => moveTo(card.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            → {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
