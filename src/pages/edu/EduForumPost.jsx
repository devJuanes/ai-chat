import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { refreshPulse } from './pulse';
import { applyPageTitle } from '../../lib/pageTitle';
import { ago, kindLabel } from './community/format';
import { ImageField } from './community/liveui';
import { useCommunity } from './community/CommunityContext';
import Icon from './community/icons';
import PersonFace from './PersonFace';

export default function EduForumPost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const community = useCommunity();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState('');

  useEffect(() => {
    applyPageTitle(post?.title || 'Publicación', 'EduCreator');
  }, [post?.title]);

  useEffect(() => {
    let stop = false;
    setReady(false);
    setPost(null);
    api(`/api/edu/forum/${postId}`, { token: auth.getToken() })
      .then((json) => {
        if (stop) return;
        setPost(json.post);
        setComments(json.comments || []);
        community.upsert(json.post);
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude abrir la publicación');
      })
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [auth, postId, community.upsert]);

  useEffect(() => {
    if (post?.slug && post.slug !== postId) {
      navigate(`/edu/comunidad/${post.slug}`, { replace: true });
    }
  }, [navigate, post?.slug, postId]);

  useEffect(() => {
    if (!post?.id) return undefined;
    const timer = window.setInterval(() => {
      api(`/api/edu/forum/${post.slug || postId}`, { token: auth.getToken() })
        .then((json) => {
          setPost(json.post);
          setComments(json.comments || []);
          community.upsert(json.post);
        })
        .catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [auth, community.upsert, post?.id, post?.slug, postId]);

  const listed = community.posts.find((item) => item.id === post?.id);
  const view = post
    ? {
        ...post,
        likes: listed?.likes ?? post.likes,
        liked: listed?.liked ?? post.liked,
        saved: listed?.saved ?? post.saved,
        resolved: listed?.resolved ?? post.resolved,
        comments: Math.max(post.comments || 0, comments.length, listed?.comments || 0),
      }
    : null;

  const reply = async (event) => {
    event.preventDefault();
    if (busy || (draft.trim().length < 2 && !imageUrl)) return;
    setBusy(true);
    setError('');
    try {
      const json = await api(`/api/edu/forum/${postId}/comments`, {
        method: 'POST',
        token: auth.getToken(),
        body: { body: draft, image_url: imageUrl },
      });
      setComments((prev) => [...prev, json.comment]);
      setDraft('');
      setImageUrl('');
      refreshPulse(auth.getToken());
      if (view) community.upsert({ ...view, comments: (view.comments || 0) + 1 });
    } catch (err) {
      setError(err.message || 'No se pudo responder');
    } finally {
      setBusy(false);
    }
  };

  const accept = async (commentId) => {
    if (accepting) return;
    setAccepting(commentId);
    setError('');
    try {
      const json = await api(`/api/edu/forum/${postId}/accept`, {
        method: 'POST',
        token: auth.getToken(),
        body: { comment_id: commentId },
      });
      setPost((prev) => ({ ...prev, ...json.post }));
      setComments((prev) => prev.map((item) => ({ ...item, accepted: item.id === commentId })));
      community.upsert(json.post);
    } catch (err) {
      setError(err.message || 'No se pudo aceptar la respuesta');
    } finally {
      setAccepting('');
    }
  };

  const ordered = [...comments].sort((a, b) => {
    if (a.accepted === b.accepted) return new Date(a.created_at) - new Date(b.created_at);
    return a.accepted ? -1 : 1;
  });
  const canAccept = Boolean(view?.mine && (view.kind === 'pregunta' || view.kind === 'ayuda'));

  return (
    <div className="edu-cm-thread">
      <Link className="edu-forum-back" to="/edu/comunidad/foro">
        Volver al foro
      </Link>
      {!ready ? (
        <div className="edu-cm-feed" aria-hidden="true">
          <div className="edu-cm-skel is-tall" />
          <div className="edu-cm-skel" />
        </div>
      ) : null}
      {error ? <div className="edu-error">{error}</div> : null}
      {ready && !view && !error ? (
        <div className="edu-cm-empty">
          <strong>Esa publicación no está</strong>
          <Link className="edu-btn" to="/edu/comunidad">
            Volver a la comunidad
          </Link>
        </div>
      ) : null}
      {view ? (
        <div className="edu-cm-thread-layout">
          <div>
          <article className="edu-forum-thread">
            <header className="edu-cm-post-top">
              <PersonFace
                name={view.author_name}
                src={view.avatar_url}
                href={view.user_id ? `/edu/perfil/${view.user_id}` : ''}
              />
              <div className="edu-cm-post-who">
                <strong>
                  {view.user_id ? (
                    <Link to={`/edu/perfil/${view.user_id}`}>{view.author_name}</Link>
                  ) : (
                    view.author_name
                  )}
                </strong>
                <span>{ago(view.created_at)}</span>
              </div>
              <span className="edu-cm-kind">{kindLabel(view.kind)}</span>
            </header>
            <h1>{view.title}</h1>
            {view.resolved ? (
              <p className="edu-cm-resolved edu-cm-resolved-block">
                <Icon name="check" />
                Resuelto
              </p>
            ) : null}
            <p className="edu-forum-body">{view.body}</p>
            {view.tags?.length || view.tech ? (
              <div className="edu-cm-tags">
                {view.tech ? <span className="edu-cm-tag">{view.tech}</span> : null}
                {(view.tags || []).filter((tag) => tag !== view.tech).map((tag) => (
                  <span key={tag} className="edu-cm-tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {view.image_url ? <img className="edu-cm-post-image" src={view.image_url} alt="" /> : null}
            {view.code ? <pre className="edu-cm-codeblock">{view.code}</pre> : null}
            <footer className="edu-cm-actions">
              <button
                type="button"
                className={view.liked ? 'is-on' : undefined}
                aria-pressed={Boolean(view.liked)}
                onClick={() => community.toggleLike(view).catch((err) => setError(err.message || 'No se pudo registrar la reacción'))}
              >
                <Icon name="thumb" />
                {view.likes || 0}
              </button>
              <span>
                <Icon name="chat" />
                {ordered.length}
              </span>
              <button
                type="button"
                className={view.saved ? 'is-on' : undefined}
                aria-pressed={Boolean(view.saved)}
                onClick={() => community.toggleSave(view).catch((err) => setError(err.message || 'No se pudo guardar'))}
              >
                <Icon name="bookmark" />
                {view.saved ? 'Guardado' : 'Guardar'}
              </button>
            </footer>
          </article>
          <h2 className="edu-forum-replies">
            {ordered.length === 0
              ? 'Todavía no hay respuestas'
              : `${ordered.length} ${ordered.length === 1 ? 'respuesta' : 'respuestas'}`}
          </h2>
          <div className="edu-forum">
            {ordered.map((comment) => (
              <article key={comment.id} className={`edu-forum-card${comment.accepted ? ' is-accepted' : ''}`}>
                <header className="edu-forum-meta">
                  <PersonFace
                    name={comment.author_name}
                    src={comment.avatar_url}
                    href={comment.user_id ? `/edu/perfil/${comment.user_id}` : ''}
                  />
                  <span>
                    {comment.user_id ? (
                      <Link to={`/edu/perfil/${comment.user_id}`}>{comment.author_name}</Link>
                    ) : (
                      comment.author_name
                    )}
                    {' · '}
                    {ago(comment.created_at)}
                  </span>
                  {comment.accepted ? <span className="edu-cm-resolved">Respuesta aceptada</span> : null}
                </header>
                <p className="edu-forum-body">{comment.body}</p>
                {comment.image_url ? <img className="edu-cm-post-image" src={comment.image_url} alt="" /> : null}
                {canAccept && !comment.accepted ? (
                  <button
                    type="button"
                    className="edu-btn-ghost"
                    disabled={Boolean(accepting)}
                    onClick={() => accept(comment.id)}
                  >
                    {accepting === comment.id ? 'Aceptando…' : 'Aceptar respuesta'}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
          </div>
          <form className="edu-forum-form edu-cm-reply-dock" onSubmit={reply}>
            <h2>Responder</h2>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escribe una respuesta"
              maxLength={2000}
              aria-label="Respuesta"
            />
            <ImageField token={auth.getToken()} onUrl={setImageUrl} />
            <button className="edu-btn" type="submit" disabled={busy || (draft.trim().length < 2 && !imageUrl)}>
              {busy ? 'Enviando…' : 'Responder'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
