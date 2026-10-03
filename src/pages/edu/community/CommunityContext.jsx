import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { readParticipation, writeParticipation } from './participation';

const CommunityContext = createContext(null);

export function CommunityProvider({ children }) {
  const auth = useAuth();
  const [posts, setPosts] = useState([]);
  const [replies, setReplies] = useState([]);
  const [meta, setMeta] = useState({ reactions: true, saves: true, fields: true });
  const [courses, setCourses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draftKind, setDraftKind] = useState('pregunta');
  const [freshId, setFreshId] = useState('');
  const [participation, setParticipation] = useState(readParticipation);

  const load = useCallback(async () => {
    const token = auth.getToken();
    setError('');
    const [forum, mine, shared, certs] = await Promise.all([
      api('/api/edu/forum', { token }),
      api('/api/edu/courses', { token }).catch(() => ({ courses: [] })),
      api('/api/edu/public', { token }).catch(() => ({ courses: [] })),
      api('/api/edu/certificates', { token }).catch(() => ({ certificates: [] })),
    ]);
    setPosts(forum.posts || []);
    setReplies(forum.replies || []);
    setMeta(forum.meta || { reactions: true, saves: true, fields: true });
    setCourses(mine.courses || []);
    setCatalog(shared.courses || []);
    setCertificates(certs.certificates || []);
  }, [auth]);

  const reload = useCallback(async () => {
    try {
      await load();
    } catch (err) {
      setError(err.message || 'No pude cargar la comunidad');
    }
  }, [load]);

  useEffect(() => {
    let stop = false;
    load()
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude cargar la comunidad');
      })
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [load]);

  const openCompose = useCallback((kind = 'pregunta') => {
    setDraftKind(kind);
    setComposing(true);
    setNotice('');
  }, []);

  const upsert = useCallback((next) => {
    if (!next?.id) return;
    setPosts((prev) => {
      const index = prev.findIndex((item) => item.id === next.id);
      if (index === -1) return [next, ...prev];
      const copy = [...prev];
      copy[index] = { ...copy[index], ...next };
      return copy;
    });
  }, []);

  const publish = useCallback(
    async (draft) => {
      const json = await api('/api/edu/forum', {
        method: 'POST',
        token: auth.getToken(),
        body: draft,
      });
      setPosts((prev) => [json.post, ...prev.filter((item) => item.id !== json.post.id)]);
      setFreshId(json.post.id);
      setComposing(false);
      return json.post;
    },
    [auth]
  );

  const toggleLike = useCallback(
    async (post) => {
      const liked = !post.liked;
      const likes = Math.max(0, (post.likes || 0) + (post.liked ? -1 : 1));
      upsert({ ...post, liked, likes });
      try {
        const json = await api(`/api/edu/forum/${post.id}/like`, {
          method: 'POST',
          token: auth.getToken(),
        });
        upsert({ ...post, ...json });
        return json;
      } catch (err) {
        upsert({ ...post, liked: post.liked, likes: post.likes || 0 });
        setNotice(err.message || 'No se pudo registrar la reacción');
        throw err;
      }
    },
    [auth, upsert]
  );

  const toggleSave = useCallback(
    async (post) => {
      const saved = !post.saved;
      upsert({ ...post, saved });
      try {
        const json = await api(`/api/edu/forum/${post.id}/save`, {
          method: 'POST',
          token: auth.getToken(),
        });
        upsert({ ...post, saved: json.saved });
        return json;
      } catch (err) {
        upsert({ ...post, saved: post.saved });
        setNotice(err.message || 'No se pudo guardar');
        throw err;
      }
    },
    [auth, upsert]
  );

  const markParticipation = useCallback((section, id, value) => {
    setParticipation((prev) => {
      const bucket = { ...prev[section] };
      if (!value) delete bucket[id];
      else bucket[id] = value;
      return writeParticipation({ ...prev, [section]: bucket });
    });
  }, []);

  const value = useMemo(
    () => ({
      posts,
      replies,
      meta,
      courses,
      catalog,
      certificates,
      error,
      notice,
      setNotice,
      ready,
      reload,
      composing,
      setComposing,
      draftKind,
      openCompose,
      freshId,
      publish,
      upsert,
      toggleLike,
      toggleSave,
      participation,
      markParticipation,
    }),
    [
      posts,
      replies,
      meta,
      courses,
      catalog,
      certificates,
      error,
      notice,
      ready,
      reload,
      composing,
      draftKind,
      openCompose,
      freshId,
      publish,
      upsert,
      toggleLike,
      toggleSave,
      participation,
      markParticipation,
    ]
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const value = useContext(CommunityContext);
  if (!value) throw new Error('useCommunity fuera de la comunidad');
  return value;
}
