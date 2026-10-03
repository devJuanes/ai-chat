import { useMemo, useState } from 'react';
import { FILTERS, SORTS, filterPosts, sortPosts } from './format';
import { useCommunity } from './CommunityContext';
import PostCard from './PostCard';
import Icon from './icons';

function Skeleton() {
  return (
    <div className="edu-cm-feed" aria-busy="true" aria-label="Cargando comunidad">
      <div className="edu-cm-skel is-line" />
      <div className="edu-cm-skel" />
      <div className="edu-cm-skel" />
      <div className="edu-cm-skel is-short" />
    </div>
  );
}

export default function Feed() {
  const { posts, ready, error, reload, openCompose } = useCommunity();
  const [kind, setKind] = useState('todos');
  const [sort, setSort] = useState('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visible = useMemo(() => sortPosts(filterPosts(posts, kind), sort), [posts, kind, sort]);
  const sortLabel = SORTS.find((item) => item.id === sort)?.label || 'Más recientes';
  const kindLabel = FILTERS.find((item) => item.id === kind)?.label || 'Todos';

  if (!ready) return <Skeleton />;

  return (
    <div className="edu-cm-feed">
      <div className="edu-cm-tools">
        <button type="button" className="edu-cm-filter-btn" onClick={() => setFiltersOpen(true)}>
          <Icon name="filter" />
          {kindLabel} · {sortLabel}
        </button>
      </div>
      {filtersOpen ? (
        <div className="edu-cm-sheet" role="presentation" onClick={() => setFiltersOpen(false)}>
          <div
            className="edu-cm-sheet-card"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            onClick={(event) => event.stopPropagation()}
          >
            <strong>Filtros</strong>
            <p>Tipo</p>
            <div className="edu-cm-sheet-picks">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={kind === item.id}
                  onClick={() => setKind(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p>Orden</p>
            <div className="edu-cm-sheet-picks">
              {SORTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={sort === item.id}
                  onClick={() => setSort(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" className="edu-btn" onClick={() => setFiltersOpen(false)}>
              Listo
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="edu-error">
          {error}
          <button type="button" className="edu-btn-ghost" onClick={() => reload()}>
            Reintentar
          </button>
        </div>
      ) : null}
      {!error && posts.length === 0 ? (
        <div className="edu-cm-empty">
          <strong>Todavía no hay publicaciones</strong>
          <p>Sé el primero en compartir algo con la comunidad.</p>
          <button type="button" className="edu-btn" onClick={() => openCompose('pregunta')}>
            Crear publicación
          </button>
        </div>
      ) : null}
      {!error && posts.length > 0 && visible.length === 0 ? (
        <div className="edu-cm-empty">
          <strong>Nada con este filtro</strong>
          <p>Prueba con Todos o abre una publicación nueva.</p>
          <button type="button" className="edu-btn" onClick={() => openCompose(kind === 'todos' ? 'pregunta' : kind)}>
            Crear publicación
          </button>
        </div>
      ) : null}
      {visible.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
