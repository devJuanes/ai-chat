import { useMemo } from 'react';
import { useCommunity } from './CommunityContext';
import Feed from './Feed';
import Sidebar from './Sidebar';

export default function CommunityHome() {
  const { posts, replies, catalog, ready } = useCommunity();
  const answers = useMemo(() => {
    const fromPosts = posts.reduce((sum, post) => sum + (post.comments || 0), 0);
    return Math.max(fromPosts, replies.length);
  }, [posts, replies]);

  const showPulse = ready && (posts.length > 0 || catalog.length > 0);

  return (
    <div className="edu-cm-grid">
      <div className="edu-cm-main">
        {showPulse ? (
          <div className="edu-cm-pulse" aria-label="Pulso de la comunidad">
            <span>
              <strong>{posts.length}</strong> publicaciones
            </span>
            <span>
              <strong>{answers}</strong> respuestas
            </span>
            <span>
              <strong>{catalog.length}</strong> cursos públicos
            </span>
          </div>
        ) : null}
        <Feed />
      </div>
      <Sidebar />
    </div>
  );
}
