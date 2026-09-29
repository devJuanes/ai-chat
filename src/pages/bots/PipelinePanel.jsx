import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import LoadingRing from '../../components/LoadingRing';

export default function PipelinePanel({ token, onError, onNotice }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [stageId, setStageId] = useState(null);

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
      <LoadingRing className="min-h-[40vh]" />
    );
  }

  const total = columns.reduce((n, c) => n + (c.cards?.length || 0), 0);
  const activeId = columns.some((c) => c.id === stageId)
    ? stageId
    : columns[0]?.id;
  const activeCol = columns.find((c) => c.id === activeId);

  const renderCard = (card, col) => (
    <li key={card.id}>
      <div
        draggable
        onDragStart={() => setDragging(card.id)}
        onDragEnd={() => setDragging(null)}
        className="rounded-lg border-2 border-black bg-white px-3 py-3 sm:cursor-grab sm:px-2.5 sm:py-2 sm:active:cursor-grabbing"
      >
        <Link
          to={`/inbox/${card.id}`}
          className="block break-words text-[15px] font-medium hover:underline sm:truncate sm:text-[13px]"
          onClick={(e) => e.stopPropagation()}
        >
          {card.title || 'Chat'}
        </Link>
        <p className="mt-1 line-clamp-3 text-[13px] leading-snug opacity-60 sm:mt-0.5 sm:line-clamp-2 sm:text-[11px]">
          {card.preview || '—'}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="fp-mono rounded border border-black/20 px-1 text-[10px] uppercase opacity-50 sm:text-[9px]">
            {card.source}
          </span>
          <span className="fp-mono rounded border border-black/20 px-1 text-[10px] uppercase opacity-50 sm:text-[9px]">
            {card.assignee === 'human' ? 'humano' : 'bot'}
          </span>
        </div>
        <select
          className="mt-3 min-h-11 w-full rounded-lg border-2 border-black bg-[#faf8f5] px-2 text-[14px] sm:mt-2 sm:min-h-0 sm:rounded sm:border sm:border-black/30 sm:px-1 sm:py-0.5 sm:text-[10px]"
          value={col.id}
          onChange={(e) => moveTo(card.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Mover a otra etapa"
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              → {c.label}
            </option>
          ))}
        </select>
      </div>
    </li>
  );

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
        <>
          <div className="sm:hidden">
            <div className="mb-3 flex flex-wrap gap-2">
              {columns.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  className={`min-h-11 rounded-full border-2 border-black px-3 text-[13px] font-medium ${
                    col.id === activeId
                      ? 'bg-black text-[#f4ed36]'
                      : 'bg-white text-black'
                  }`}
                  aria-pressed={col.id === activeId}
                  onClick={() => setStageId(col.id)}
                >
                  {col.label}
                  <span className="ml-1.5 opacity-70">
                    {col.cards?.length || 0}
                  </span>
                </button>
              ))}
            </div>
            {activeCol ? (
              (activeCol.cards || []).length === 0 ? (
                <p className="rounded-xl border-2 border-black bg-white px-3 py-6 text-center text-[14px] opacity-60">
                  Sin chats en {activeCol.label}.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(activeCol.cards || []).map((card) =>
                    renderCard(card, activeCol)
                  )}
                </ul>
              )
            ) : null}
          </div>
          <div className="hidden gap-3 overflow-x-auto pb-4 sm:flex">
            {columns.map((col) => (
              <div
                key={col.id}
                className="flex w-[240px] shrink-0 flex-col rounded-xl border-2 border-black bg-[#faf8f5]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragging && dragging !== col.id) {
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
                  {(col.cards || []).map((card) => renderCard(card, col))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
