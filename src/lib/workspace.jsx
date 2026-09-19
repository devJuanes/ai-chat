import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { api, streamChat } from './api';

const FALLBACK_MODELS = [
  { id: 'matu', name: 'Matu', tagline: 'Flagship de negocio' },
  { id: 'vo0', name: 'VO0', tagline: 'Respuestas relámpago' },
  { id: 'vo5', name: 'VO5', tagline: 'Estrategia profunda' },
  {
    id: 'matu-apex',
    name: 'Matu Forge',
    tagline: 'Ingeniero · ventas · ops (3 en 1)',
  },
  {
    id: 'matu-dev-3-5',
    name: 'Matu Dev 3.5',
    tagline: 'UI/UX · diseño web · frontend elite',
  },
  {
    id: 'matu-space-ultra',
    name: 'Matu Space Ultra',
    tagline: 'Ingeniería · razonamiento · agente frontier',
  },
  {
    id: 'matu-commerce',
    name: 'Matu Commerce',
    tagline: 'E-commerce · CRM · revenue ops',
  },
  {
    id: 'matu-marketing',
    name: 'Matu Marketing',
    tagline: 'Growth · copy · adquisición',
  },
];

function parsePath(pathname) {
  let m = pathname.match(/^\/p\/([^/]+)\/c\/([^/]+)/);
  if (m) {
    return {
      section: 'project-chat',
      projectId: m[1],
      conversationId: m[2] === 'new' ? null : m[2],
      isNew: m[2] === 'new',
    };
  }
  m = pathname.match(/^\/p\/([^/]+)/);
  if (m) {
    return {
      section: 'project',
      projectId: m[1],
      conversationId: null,
      isNew: true,
    };
  }
  m = pathname.match(/^\/c\/([^/]+)/);
  if (m) {
    return {
      section: 'chat',
      projectId: null,
      conversationId: m[1] === 'new' ? null : m[1],
      isNew: m[1] === 'new',
    };
  }
  if (pathname.startsWith('/explore')) {
    return { section: 'explore', projectId: null, conversationId: null, isNew: true };
  }
  if (pathname.startsWith('/search')) {
    return { section: 'search', projectId: null, conversationId: null, isNew: true };
  }
  if (pathname.startsWith('/usage')) {
    return { section: 'usage', projectId: null, conversationId: null, isNew: true };
  }
  if (pathname.startsWith('/library')) {
    return { section: 'library', projectId: null, conversationId: null, isNew: true };
  }
  if (pathname.startsWith('/settings')) {
    return { section: 'settings', projectId: null, conversationId: null, isNew: true };
  }
  return { section: 'chat', projectId: null, conversationId: null, isNew: true };
}

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const route = useMemo(() => parsePath(pathname), [pathname]);
  const auth = useAuth();

  const [conversations, setConversations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelId, setModelId] = useState('matu');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const skipLoadRef = useRef(false);
  const streamingRef = useRef(false);

  const token = auth.getToken();
  const projectId = route.projectId;
  const isNew = route.isNew || !route.conversationId;

  const refreshList = useCallback(async () => {
    if (!token) {
      setConversations([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const [live, archived] = await Promise.all([
        api('/api/conversations', { token }),
        api('/api/conversations?archived=1', { token }),
      ]);
      const map = new Map();
      for (const c of live.conversations || []) map.set(c.id, c);
      for (const c of archived.conversations || []) map.set(c.id, c);
      setConversations([...map.values()]);
    } catch (err) {
      console.error(err);
      if (/sesión inválida|invalid session|401|unauthorized|Debes iniciar sesión/i.test(err.message || '')) {
        await auth.signOut({ redirectTo: '/login' });
      }
    } finally {
      setListLoading(false);
    }
  }, [token, auth]);

  const refreshProjects = useCallback(async () => {
    if (!token) {
      setProjects([]);
      return;
    }
    try {
      const data = await api('/api/projects', { token });
      setProjects(data.projects || []);
    } catch (err) {
      console.warn('projects:', err.message);
    }
  }, [token]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const json = await api('/api/me', { token });
      auth.setProfile?.(json);
    } catch {
      /* ignore */
    }
  }, [token, auth]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/models', {
          token: token || undefined,
        });
        if (!data.models?.length) return;
        let next = data.models;
        if (!data.sizorOnly) {
          // No perder modelos nuevos del fallback si el API aún no los trae
          const ids = new Set(data.models.map((m) => m.id));
          next = [...data.models];
          for (const m of FALLBACK_MODELS) {
            if (ids.has(m.id)) continue;
            // vo5 es solo Pro/Team: no forzar en free
            if (m.id === 'vo5') continue;
            next.push(m);
          }
        }
        setModels(next);
        setModelId((prev) => {
          if (next.some((m) => m.id === prev)) return prev;
          return next[0]?.id || prev;
        });
      } catch {
        /* keep fallback */
      }
    })();
  }, [token]);

  useEffect(() => {
    refreshList();
    refreshProjects();
  }, [refreshList, refreshProjects]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      if (
        isNew ||
        route.section === 'project' ||
        route.section === 'explore' ||
        route.section === 'search' ||
        route.section === 'usage' ||
        route.section === 'library' ||
        route.section === 'settings'
      ) {
        if (!streamingRef.current) {
          setActive(null);
          setMessages([]);
        }
        setLoading(false);
        return;
      }
      if (!token || !route.conversationId) {
        setLoading(false);
        return;
      }

      // Evita pisar el stream al navegar de /new → /c/:id mid-response
      if (skipLoadRef.current) {
        skipLoadRef.current = false;
        setLoading(false);
        return;
      }
      if (streamingRef.current) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessages([]);
      setActive(null);
      try {
        const data = await api(`/api/conversations/${route.conversationId}`, {
          token,
        });
        if (cancelled || streamingRef.current) return;
        setActive(data.conversation);
        setMessages(data.messages || []);
        if (data.conversation?.model_id) {
          setModelId(data.conversation.model_id);
        }
      } catch (err) {
        if (!cancelled && !streamingRef.current) {
          setError(err.message);
          setActive(null);
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.conversationId, route.section, isNew, token]);

  const chatPath = useCallback(
    (convId, projId = projectId) => {
      if (projId) return `/p/${projId}/c/${convId}`;
      return `/c/${convId}`;
    },
    [projectId]
  );

  const send = useCallback(
    async (text) => {
      if (!token) {
        navigate('/login', { state: { from: pathname } });
        return null;
      }
      const trimmed = text.trim();
      if (!trimmed || streaming) return null;

      setError(null);
      const tempUserId = `local-${Date.now()}`;
      const userMsg = { id: tempUserId, role: 'user', content: trimmed };
      const tempAssistantId = `local-a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: tempAssistantId, role: 'assistant', content: '' },
      ]);
      streamingRef.current = true;
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let resolvedConvId = isNew ? null : route.conversationId;
      let assistantId = tempAssistantId;
      let finalContent = '';
      let finalMessageId = tempAssistantId;

      const upsertConversation = (meta, previewText, titleOverride) => {
        const id = meta.conversation_id;
        if (!id) return;
        const now = new Date().toISOString();
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === id);
          const next = {
            id,
            title:
              titleOverride ||
              meta.title ||
              (idx >= 0 ? prev[idx].title : null) ||
              'Nuevo chat',
            preview: previewText || (idx >= 0 ? prev[idx].preview : '') || '',
            project_id:
              meta.project_id ??
              (idx >= 0 ? prev[idx].project_id : null) ??
              projectId ??
              null,
            model_id: meta.model_id,
            updated_at: now,
            created_at: idx >= 0 ? prev[idx].created_at : now,
            pinned_at: idx >= 0 ? prev[idx].pinned_at : null,
            archived_at: idx >= 0 ? prev[idx].archived_at : null,
          };
          if (idx >= 0) {
            const copy = [...prev];
            copy.splice(idx, 1);
            return [next, ...copy];
          }
          return [next, ...prev];
        });
      };

      try {
        await streamChat({
          token,
          conversationId: resolvedConvId,
          modelId,
          projectId: isNew ? projectId : undefined,
          content: trimmed,
          signal: controller.signal,
          onMeta: (meta) => {
            resolvedConvId = meta.conversation_id;
            assistantId = meta.message_id;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === tempUserId) {
                  return { ...m, id: meta.user_message_id };
                }
                if (m.id === tempAssistantId) {
                  return { ...m, id: meta.message_id, model_id: meta.model_id };
                }
                return m;
              })
            );
            upsertConversation(meta, trimmed, meta.title);
            setActive((prev) => ({
              ...(prev || {}),
              id: meta.conversation_id,
              title: meta.title || prev?.title || 'Nuevo chat',
              model_id: meta.model_id,
              project_id: meta.project_id ?? prev?.project_id ?? projectId,
            }));
            if (isNew && meta.conversation_id) {
              skipLoadRef.current = true;
              navigate(
                chatPath(meta.conversation_id, meta.project_id || projectId),
                { replace: true }
              );
            }
          },
          onDelta: ({ content }) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId || m.id === tempAssistantId
                  ? { ...m, content: (m.content || '') + content }
                  : m
              )
            );
          },
          onDone: (data) => {
            finalContent = data.content || '';
            finalMessageId = data.message_id || assistantId;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.message_id || m.id === tempAssistantId
                  ? { ...m, id: data.message_id, content: data.content }
                  : m
              )
            );
            if (data.title || data.conversation_id) {
              setActive((prev) =>
                prev
                  ? {
                      ...prev,
                      title: data.title || prev.title,
                      id: data.conversation_id || prev.id,
                    }
                  : prev
              );
              upsertConversation(
                {
                  conversation_id: data.conversation_id || resolvedConvId,
                  title: data.title,
                  project_id: projectId,
                },
                (data.content || '').slice(0, 140),
                data.title
              );
            }
            refreshList();
            refreshMe();
          },
          onError: (data) => {
            setError(data.message || 'No se pudo generar la respuesta');
          },
        });
        return { content: finalContent, messageId: finalMessageId };
      } catch (err) {
        setError(err.message);
        setMessages((prev) =>
          prev.filter((m) => m.id !== tempAssistantId || m.content)
        );
        return null;
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      token,
      streaming,
      isNew,
      route.conversationId,
      modelId,
      projectId,
      navigate,
      pathname,
      chatPath,
      refreshList,
      refreshMe,
    ]
  );

  const regenerate = useCallback(
    async (assistantMessageId) => {
      if (!token || streaming || isNew || !route.conversationId) return;
      setError(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, content: '' } : m
        )
      );
      setStreaming(true);
      streamingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      let assistantId = assistantMessageId;

      try {
        await streamChat({
          token,
          conversationId: route.conversationId,
          modelId,
          regenerateOf: assistantMessageId,
          signal: controller.signal,
          onMeta: (meta) => {
            assistantId = meta.message_id;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, id: meta.message_id, content: '' }
                  : m
              )
            );
          },
          onDelta: ({ content }) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: (m.content || '') + content }
                  : m
              )
            );
          },
          onDone: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.message_id || m.id === assistantId
                  ? { ...m, id: data.message_id, content: data.content }
                  : m
              )
            );
            refreshList();
            refreshMe();
          },
          onError: (data) => {
            setError(data.message || 'No se pudo generar la respuesta');
          },
        });
      } catch (err) {
        setError(err.message);
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      token,
      streaming,
      isNew,
      route.conversationId,
      modelId,
      refreshList,
      refreshMe,
    ]
  );

  const continueGeneration = useCallback(
    async (assistantMessageId) => {
      if (!token || streaming) return;
      const convId = route.conversationId;
      if (!convId || isNew) {
        setError('Guarda el chat (espera a que termine de crear) y vuelve a continuar.');
        return;
      }
      setError(null);
      setStreaming(true);
      streamingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      const targetId =
        !assistantMessageId || String(assistantMessageId).startsWith('local-')
          ? 'last'
          : assistantMessageId;
      let assistantId = assistantMessageId;

      try {
        await streamChat({
          token,
          conversationId: convId,
          modelId,
          continueOf: targetId,
          signal: controller.signal,
          onMeta: (meta) => {
            assistantId = meta.message_id || assistantMessageId;
            // Si el server resolvió otro id, alinea el mensaje local
            if (meta.message_id && assistantMessageId && meta.message_id !== assistantMessageId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, id: meta.message_id }
                    : m
                )
              );
            }
          },
          onDelta: ({ content }) => {
            setMessages((prev) => {
              const id = assistantId || assistantMessageId;
              return prev.map((m) =>
                m.id === id || m.id === assistantMessageId
                  ? { ...m, content: (m.content || '') + content }
                  : m
              );
            });
          },
          onDone: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.message_id ||
                m.id === assistantId ||
                m.id === assistantMessageId
                  ? {
                      ...m,
                      id: data.message_id || assistantId || assistantMessageId,
                      content: data.content,
                    }
                  : m
              )
            );
            refreshList();
            refreshMe();
          },
          onError: (data) => {
            setError(data.message || 'No se pudo continuar la respuesta');
          },
        });
      } catch (err) {
        setError(err.message);
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      token,
      streaming,
      isNew,
      route.conversationId,
      modelId,
      refreshList,
      refreshMe,
    ]
  );

  const feedback = useCallback(
    async (messageId, rating) => {
      if (!token) return;
      await api(`/api/messages/${messageId}/feedback`, {
        token,
        method: 'POST',
        body: { rating },
      });
    },
    [token]
  );

  const patchConversation = useCallback(
    async (id, body) => {
      if (!token || !id) return null;
      const data = await api(`/api/conversations/${id}`, {
        token,
        method: 'PATCH',
        body,
      });
      setActive((prev) =>
        prev?.id === id ? { ...prev, ...data.conversation } : prev
      );
      await refreshList();
      return data;
    },
    [token, refreshList]
  );

  const shareConversation = useCallback(async () => {
    if (!active?.id) return null;
    const data = await patchConversation(active.id, { share: true });
    const path = data?.share_url;
    if (!path) return null;
    return `${window.location.origin}${path}`;
  }, [active?.id, patchConversation]);

  const renameConversation = useCallback(
    async (title) => {
      if (!active?.id) return;
      await patchConversation(active.id, { title });
    },
    [active?.id, patchConversation]
  );

  const pinConversation = useCallback(
    async (pin, conversationId) => {
      const id = conversationId || active?.id;
      if (!id || !token) return;
      const pinnedAt = pin ? new Date().toISOString() : null;
      const prevConversations = conversations;
      const prevActive = active;

      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, pinned_at: pinnedAt } : c
        );
        return [...next].sort((a, b) => {
          const ap = a.pinned_at ? 1 : 0;
          const bp = b.pinned_at ? 1 : 0;
          if (ap !== bp) return bp - ap;
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
        });
      });
      setActive((prev) =>
        prev?.id === id ? { ...prev, pinned_at: pinnedAt } : prev
      );

      try {
        await api(`/api/conversations/${id}`, {
          token,
          method: 'PATCH',
          body: { pin },
        });
      } catch (err) {
        setConversations(prevConversations);
        setActive(prevActive);
        setError(err.message || 'No se pudo fijar el chat');
      }
    },
    [active, conversations, token]
  );

  const archiveConversation = useCallback(
    async (archive) => {
      if (!active?.id) return;
      await patchConversation(active.id, { archive });
      if (archive) navigate(projectId ? `/p/${projectId}` : '/library');
    },
    [active?.id, patchConversation, navigate, projectId]
  );

  const deleteConversation = useCallback(async () => {
    if (!token || !active?.id) return;
    if (!window.confirm('¿Eliminar este chat de forma permanente?')) return;
    await api(`/api/conversations/${active.id}/hard`, {
      token,
      method: 'DELETE',
    });
    await refreshList();
    navigate(projectId ? `/p/${projectId}` : '/c/new');
  }, [token, active?.id, refreshList, navigate, projectId]);

  const createProject = useCallback(
    async ({ name, icon, color }) => {
      if (!token) return null;
      try {
        const data = await api('/api/projects', {
          token,
          method: 'POST',
          body: { name, icon, color },
        });
        await refreshProjects();
        if (data.project?.id) {
          navigate(`/p/${data.project.id}`);
        }
        return data.project;
      } catch (err) {
        setError(
          err.message?.includes('projects') ||
            /relation|does not exist|column/i.test(err.message || '')
            ? 'No se pudo crear el proyecto. Inténtalo de nuevo.'
            : err.message || 'No se pudo crear el proyecto'
        );
        return null;
      }
    },
    [token, refreshProjects, navigate]
  );

  const saveProfile = useCallback(
    async (name) => {
      if (!token) return;
      const json = await api('/api/me', {
        token,
        method: 'PATCH',
        body: { name },
      });
      auth.setProfile?.(json);
      if (json.user) auth.updateUser?.(json.user);
    },
    [token, auth]
  );

  const newChat = useCallback(() => {
    if (projectId) navigate(`/p/${projectId}/c/new`);
    else navigate('/c/new');
  }, [navigate, projectId]);

  const selectConversation = useCallback(
    (id, projId) => {
      const p = projId ?? conversations.find((c) => c.id === id)?.project_id;
      navigate(p ? `/p/${p}/c/${id}` : `/c/${id}`);
    },
    [navigate, conversations]
  );

  const selectProject = useCallback(
    (id) => {
      navigate(`/p/${id}`);
    },
    [navigate]
  );

  const exitProject = useCallback(() => {
    navigate('/c/new');
  }, [navigate]);

  const model = useMemo(
    () => models.find((m) => m.id === modelId) || models[0],
    [models, modelId]
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  );

  const projectConversations = useMemo(
    () =>
      projectId
        ? conversations.filter(
            (c) => c.project_id === projectId && !c.archived_at
          )
        : [],
    [conversations, projectId]
  );

  const value = useMemo(
    () => ({
      route,
      conversations,
      projects,
      active,
      messages,
      models,
      model,
      modelId,
      setModelId,
      projectId,
      activeProject,
      projectConversations,
      streaming,
      loading,
      listLoading,
      error,
      setError,
      send,
      regenerate,
      continueGeneration,
      feedback,
      newChat,
      selectConversation,
      selectProject,
      exitProject,
      createProject,
      shareConversation,
      renameConversation,
      pinConversation,
      archiveConversation,
      deleteConversation,
      saveProfile,
      refreshMe,
      plan: auth.profile?.plan,
      usage: auth.profile?.usage,
      organization: auth.profile?.organization,
      profileUser: auth.profile?.user || auth.user,
      companyUrl: auth.companyUrl,
      isAuthenticated: Boolean(token),
    }),
    [
      route,
      conversations,
      projects,
      active,
      messages,
      models,
      model,
      modelId,
      projectId,
      activeProject,
      projectConversations,
      streaming,
      loading,
      listLoading,
      error,
      send,
      regenerate,
      continueGeneration,
      feedback,
      newChat,
      selectConversation,
      selectProject,
      exitProject,
      createProject,
      shareConversation,
      renameConversation,
      pinConversation,
      archiveConversation,
      deleteConversation,
      saveProfile,
      refreshMe,
      auth.profile,
      auth.user,
      auth.companyUrl,
      token,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace debe usarse dentro de WorkspaceProvider');
  return ctx;
}

/** @deprecated use useWorkspace */
export function useChatController() {
  return useWorkspace();
}
