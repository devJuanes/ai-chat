import { useMemo, useState } from 'react';
import { FILTERS, SORTS, filterPosts, sortPosts } from './format';
import { useCommunity } from './CommunityContext';
import PostCard from './PostCard';
import Icon from './icons';

function Skeleton() {
  return (
    <div className="edu-cm-feed" aria-hidden="true">
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
  const visible = useMemo(() => sortPosts(filterPosts(posts, kind), sort), [posts, kind, sort]);

  if (!ready) return <Skeleton />;

  return (
    <div className="edu-cm-feed">
      <div className="edu-cm-tools">
        <div className="edu-cm-filters" role="toolbar" aria-label="Filtrar publicaciones">
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
        <label className="edu-cm-sort">
          <span className="edu-sr">Ordenar</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar publicaciones">
            {SORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Icon name="chevron" />
        </label>
      </div>
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
