import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ago, excerpt, kindLabel, shortName } from './format';
import { useCommunity } from './CommunityContext';
import Icon from './icons';
import PersonFace from '../PersonFace';

function PostMedia({ post }) {
  const [imageOn, setImageOn] = useState(true);
  const topic = post.tech || post.tags?.[0] || kindLabel(post.kind);

  if (post.image_url && imageOn) {
    return (
      <img
        className="edu-cm-media"
        src={post.image_url}
        alt=""
        onError={() => setImageOn(false)}
      />
    );
  }

  return (
    <div className={`edu-cm-media edu-cm-media-mark is-${post.kind || 'debate'}`} aria-hidden="true">
      <span className="edu-cm-media-dots">
        <i />
        <i />
        <i />
      </span>
      <strong>{topic}</strong>
    </div>
  );
}

export default function PostCard({ post }) {
  const { freshId, toggleLike, toggleSave } = useCommunity();

  return (
    <article className={`edu-cm-post${freshId === post.id ? ' is-new' : ''}`}>
      <div className="edu-cm-post-copy">
        <header className="edu-cm-post-top">
          <PersonFace
            name={post.author_name}
            src={post.avatar_url}
            href={post.user_id ? `/edu/perfil/${post.user_id}` : ''}
          />
          <div className="edu-cm-post-who">
            <strong>
              {post.user_id ? (
                <Link to={`/edu/perfil/${post.user_id}`}>{shortName(post.author_name)}</Link>
              ) : (
                shortName(post.author_name)
              )}
            </strong>
            <span>{ago(post.created_at)}</span>
          </div>
          <span className="edu-cm-kind">{kindLabel(post.kind)}</span>
          {post.resolved ? <span className="edu-cm-resolved">Resuelto</span> : null}
        </header>
        <Link to={`/edu/comunidad/${post.slug || post.id}`} className="edu-cm-post-title">
          {post.title}
        </Link>
        {excerpt(post.body) ? (
          <Link to={`/edu/comunidad/${post.slug || post.id}`} className="edu-cm-post-excerpt">
            {excerpt(post.body)}
          </Link>
        ) : null}
        <footer className="edu-cm-actions">
          <button
            type="button"
            className={post.liked ? 'is-on' : undefined}
            aria-pressed={Boolean(post.liked)}
            aria-label={post.liked ? 'Quitar reacción' : 'Reaccionar'}
            onClick={() => toggleLike(post).catch(() => {})}
          >
            <Icon name="thumb" />
            {post.likes || 0}
          </button>
          <Link to={`/edu/comunidad/${post.slug || post.id}`} aria-label="Ver respuestas">
            <Icon name="chat" />
            {post.comments || 0}
          </Link>
          <button
            type="button"
            className={post.saved ? 'is-on' : undefined}
            aria-pressed={Boolean(post.saved)}
            onClick={() => toggleSave(post).catch(() => {})}
          >
            <Icon name="bookmark" />
            {post.saved ? 'Guardado' : 'Guardar'}
          </button>
        </footer>
      </div>
      <PostMedia post={post} />
    </article>
  );
}
