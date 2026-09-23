import { useEffect, useMemo, useRef, useState } from 'react';
import Composer from './Composer';
import Message from './Message';
import ProjectBadge from './ProjectBadge';
import ShareModal from './ShareModal';
import AgentLoader from './AgentLoader';
import { BrandMascot } from './BrandMascot';
import LiveHtmlPreview, {
  extractHtmlFromText,
  isIncompleteHtml,
} from './LiveHtmlPreview';
import {
  ArchiveIcon,
  FolderIcon,
  MenuIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PlayIcon,
  ShareIcon,
  TrashIcon,
} from './Icons';
import NotificationBell from './NotificationBell';
import { isSizorEmbed } from '../lib/sizorEmbed';

function formatChatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

const SUGGESTIONS = [
  {
    title: 'Frase de posicionamiento',
    body: 'Ayúdame a escribir una frase corta de posicionamiento para un SaaS B2B que automatiza facturación para freelancers.',
    tone: 'fp-card-pink',
  },
  {
    title: 'Respuesta a cliente',
    body: 'Redacta una respuesta amable a un cliente que pide reembolso por un envío demorado.',
    tone: 'fp-card-matcha',
  },
  {
    title: 'Plan de lanzamiento',
    body: 'Arma un plan de 5 días para lanzar una landing de waitlist con anuncios y captura de email.',
    tone: 'fp-card-butter',
  },
  {
    title: 'Decisión de precios',
    body: 'Compara freemium vs. prueba de 14 días para una herramienta de productividad dirigida a equipos pequeños.',
    tone: 'fp-card-yellow',
  },
];

function formatTokens(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function ChatArea({
  conversation,
  messages,
  onSend,
  onRegenerate,
  onFeedback,
  onContinue,
  onToggleSidebar,
  streaming,
  error,
  isAuthenticated,
  models,
  model,
  onModelChange,
  view = 'chats',
  plan,
  usage,
  onShare,
  onPin,
  onArchive,
  onDelete,
  onUpgrade,
  onOpenUsage,
  activeProject,
  projectConversations = [],
  onSelectConversation,
  onNewChat,
  projectHome = false,
  onRenameTitle,
  loading = false,
}) {
  const scrollRef = useRef(null);
  const menuRef = useRef(null);
  const titleInputRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [projectTab, setProjectTab] = useState('chats');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [livePreviewOpen, setLivePreviewOpen] = useState(true);

  const liveHtml = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') {
        return extractHtmlFromText(messages[i].content);
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    setLivePreviewOpen(true);
  }, [conversation?.id]);

  useEffect(() => {
    if (streaming && liveHtml) setLivePreviewOpen(true);
  }, [streaming, liveHtml]);

  const showLivePreview = Boolean(liveHtml) && livePreviewOpen;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [conversation?.id]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (projectHome) setProjectTab('chats');
  }, [projectHome, activeProject?.id]);

  useEffect(() => {
    setEditingTitle(false);
    setTitleDraft(conversation?.title || '');
  }, [conversation?.id, conversation?.title]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const isEmpty = !messages || messages.length === 0;
  const visibleSuggestions = useMemo(
    () => (isSizorEmbed() ? SUGGESTIONS.slice(0, 2) : SUGGESTIONS),
    []
  );
  const inProjectHome =
    projectHome &&
    Boolean(activeProject) &&
    isEmpty &&
    view !== 'explore' &&
    view !== 'library';
  const title = inProjectHome
    ? activeProject.name
    : view === 'explore'
      ? 'Explorar'
      : view === 'library' && isEmpty
        ? 'Biblioteca'
        : conversation?.title || 'Nuevo chat';

  const tokensUsed = usage?.tokens_total ?? 0;
  const tokenLimit = plan?.monthly_token_limit;
  const planName = plan?.name || plan?.id || 'Free';

  const handleShare = async () => {
    if (inProjectHome && activeProject) {
      setShareUrl(`${window.location.origin}/p/${activeProject.id}`);
      setShareOpen(true);
      return;
    }
    const url = await onShare?.();
    if (url) {
      setShareUrl(url);
      setShareOpen(true);
    }
  };

  const commitTitle = async () => {
    const next = titleDraft.trim().slice(0, 80);
    setEditingTitle(false);
    if (!next || !conversation?.id || next === conversation.title) return;
    await onRenameTitle?.(next);
  };

  return (
    <main className="fp-page flex h-dvh min-w-0 flex-col">
      <header className="fp-page-header flex h-[52px] shrink-0 items-center gap-2 px-2.5 sm:h-[56px] sm:px-4">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border-2 border-black bg-[#f4ed36] md:hidden"
          onClick={onToggleSidebar}
          aria-label="Alternar menú"
        >
          <MenuIcon />
        </button>

        {activeProject ? (
          <div className="flex min-w-0 items-center gap-2">
            <ProjectBadge project={activeProject} size={22} />
            {editingTitle && conversation?.id ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  }
                  if (e.key === 'Escape') {
                    setEditingTitle(false);
                    setTitleDraft(conversation?.title || '');
                  }
                }}
                className="fp-input min-w-0 flex-1 truncate py-1 text-[14px] font-bold"
              />
            ) : (
              <button
                type="button"
                className="group flex min-w-0 items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-left hover:bg-black/5"
                onClick={() => {
                  if (!conversation?.id || inProjectHome) return;
                  setTitleDraft(conversation.title || '');
                  setEditingTitle(true);
                }}
                title={conversation?.id ? 'Editar título' : undefined}
              >
                <span className="min-w-0 truncate text-[14px] font-bold">
                  {title}
                </span>
                {conversation?.id && !inProjectHome ? (
                  <PencilIcon className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-50" />
                ) : null}
              </button>
            )}
          </div>
        ) : editingTitle && conversation?.id ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              }
              if (e.key === 'Escape') {
                setEditingTitle(false);
                setTitleDraft(conversation?.title || '');
              }
            }}
            className="fp-input min-w-0 max-w-[min(420px,50vw)] flex-1 truncate py-1 text-[14px] font-bold"
          />
        ) : (
          <button
            type="button"
            className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-1 py-1 text-left hover:bg-black/5 sm:max-w-[min(420px,50vw)] sm:flex-none"
            onClick={() => {
              if (!conversation?.id) return;
              setTitleDraft(conversation.title || '');
              setEditingTitle(true);
            }}
            title={conversation?.id ? 'Editar título' : undefined}
          >
            <span className="fp-mono min-w-0 truncate text-[11px] text-black/70 sm:text-[12px]">
              {title}
            </span>
            {conversation?.id ? (
              <PencilIcon className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-50" />
            ) : null}
          </button>
        )}

        <div className="flex-1" />

        {isAuthenticated ? <NotificationBell className="shrink-0" /> : null}

        {liveHtml && !livePreviewOpen ? (
          <button
            type="button"
            className="hidden h-8 items-center gap-1.5 rounded-full border-2 border-black bg-[#f4ed36] px-3 text-[11px] font-bold lg:inline-flex"
            onClick={() => setLivePreviewOpen(true)}
            title="Abrir vista previa"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            Preview
          </button>
        ) : null}

        {isAuthenticated && !inProjectHome && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              className="fp-pill inline-flex h-8 items-center gap-1.5 px-3.5 text-[11px]"
              onClick={onUpgrade}
              title="Mejorar plan"
            >
              Mejorar · {planName}
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-full border-2 border-black bg-white px-3 text-[11px] font-bold tabular-nums transition hover:bg-[#f4ed36]"
              title="Ver consumo de tokens"
              onClick={() => onOpenUsage?.()}
            >
              {formatTokens(tokensUsed)}
              {tokenLimit > 0 ? ` / ${formatTokens(tokenLimit)}` : ''}
            </button>
          </div>
        )}

        {(conversation?.id || inProjectHome) && (
          <>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 text-[12px] font-bold transition hover:bg-[#f4ed36]"
              title="Compartir"
              aria-label="Compartir"
              onClick={handleShare}
            >
              <ShareIcon />
              <span className="hidden sm:inline">Compartir</span>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white transition hover:bg-[#f4ed36]"
                title="Más opciones"
                aria-label="Más opciones"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreIcon />
              </button>
              {menuOpen && (
                <div className="fp-user-menu absolute right-0 top-[calc(100%+6px)] z-40 min-w-[210px] p-1.5">
                  {conversation?.id ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[14px] font-medium hover:bg-black/5"
                        onClick={() => {
                          setTitleDraft(conversation.title || '');
                          setEditingTitle(true);
                          setMenuOpen(false);
                        }}
                      >
                        <PencilIcon />
                        <span>Editar título</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[14px] font-medium hover:bg-black/5"
                        onClick={() => {
                          onPin?.(!conversation.pinned_at);
                          setMenuOpen(false);
                        }}
                      >
                        <PinIcon />
                        <span>
                          {conversation.pinned_at ? 'Desfijar' : 'Fijar chat'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[14px] font-medium hover:bg-black/5"
                        onClick={() => {
                          onArchive?.(!conversation.archived_at);
                          setMenuOpen(false);
                        }}
                      >
                        <ArchiveIcon />
                        <span>
                          {conversation.archived_at
                            ? 'Desarchivar'
                            : 'Archivar'}
                        </span>
                      </button>
                      <div className="my-1 h-px bg-black/15" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[14px] font-medium opacity-70 hover:bg-black/5 hover:opacity-100"
                        onClick={() => {
                          onDelete?.();
                          setMenuOpen(false);
                        }}
                      >
                        <TrashIcon />
                        <span>Eliminar chat</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[14px] font-medium hover:bg-black/5"
                      onClick={() => {
                        onNewChat?.();
                        setMenuOpen(false);
                      }}
                    >
                      <FolderIcon />
                      <span>Nuevo chat en el proyecto</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </header>

      <ShareModal
        open={shareOpen}
        url={shareUrl}
        title={inProjectHome ? 'Compartir proyecto' : 'Compartir chat'}
        onClose={() => setShareOpen(false)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-quiet"
        ref={scrollRef}
      >
        {view === 'explore' ? (
          <div className="mx-auto my-auto flex w-full max-w-[var(--spacing-content)] flex-col gap-6 px-6 py-10">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight">
                Explorar modelos
              </h1>
              <p className="mt-1 text-base text-mid-ash">
                Elige un modelo y empieza con un prompt listo.
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(models || []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`rounded-[12px] border border-hairline p-4 text-left hover:bg-hover-veil ${
                    m.id === model?.id ? 'bg-hover-veil-strong' : ''
                  }`}
                  onClick={() => onModelChange?.(m.id)}
                >
                  <div className="text-[15px] font-semibold">{m.name}</div>
                  <div className="mt-1 text-[13px] text-mid-ash">
                    {m.tagline}
                  </div>
                </button>
              ))}
            </div>
            <div>
              <h2 className="mb-2 text-[14px] font-medium text-hollow">
                Prompts sugeridos
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {visibleSuggestions.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    className="rounded-[12px] border border-hairline p-4 text-left hover:bg-hover-veil"
                    onClick={() => onSend(s.body)}
                  >
                    <div className="text-[14px] font-semibold">{s.title}</div>
                    <div className="mt-1 text-[13px] text-mid-ash">{s.body}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : inProjectHome ? (
          <div className="mx-auto flex w-full max-w-[720px] flex-col px-6 pb-10 pt-6">
            <div className="mb-5">
              <Composer
                onSend={onSend}
                disabled={streaming}
                models={models}
                model={model}
                onModelChange={onModelChange}
                placeholder={`+ Nuevo chat en ${activeProject.name}`}
              />
            </div>

            <div className="mb-3 flex items-center gap-1">
              <button
                type="button"
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  projectTab === 'chats'
                    ? 'bg-[#efefef] text-graphite-ink'
                    : 'text-mid-ash hover:bg-hover-veil hover:text-graphite-ink'
                }`}
                onClick={() => setProjectTab('chats')}
              >
                Chats
              </button>
              <button
                type="button"
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  projectTab === 'sources'
                    ? 'bg-[#efefef] text-graphite-ink'
                    : 'text-mid-ash hover:bg-hover-veil hover:text-graphite-ink'
                }`}
                onClick={() => setProjectTab('sources')}
              >
                Fuentes
              </button>
            </div>

            {projectTab === 'chats' ? (
              projectConversations.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-hairline px-5 py-10 text-center">
                  <p className="text-[14px] text-mid-ash">
                    Escribe arriba para crear el primer chat de este proyecto.
                  </p>
                  <p className="mt-1 text-[13px] text-hollow">
                    Los chats del proyecto comparten contexto entre sí.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {projectConversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex items-start gap-3 border-b border-hairline px-1 py-3.5 text-left transition-colors hover:bg-[#fafafa]"
                      onClick={() => onSelectConversation?.(c.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate text-[15px] font-medium text-graphite-ink">
                            {c.title}
                          </div>
                          {streaming && conversation?.id === c.id ? (
                            <AgentLoader size="sm" className="shrink-0" />
                          ) : null}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[13px] text-hollow">
                          {c.preview || 'Sin vista previa'}
                        </div>
                      </div>
                      <span className="shrink-0 pt-0.5 text-[12px] text-hollow">
                        {formatChatDate(c.updated_at || c.created_at)}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-[16px] border border-dashed border-hairline px-5 py-10 text-center">
                <p className="text-[14px] text-mid-ash">
                  Pronto podrás añadir fuentes a este proyecto.
                </p>
                <p className="mt-1 text-[13px] text-hollow">
                  Documentos y enlaces para dar contexto a todos los chats.
                </p>
              </div>
            )}
          </div>
        ) : loading && isEmpty ? (
          <div className="mx-auto flex w-full max-w-[var(--spacing-content)] flex-col gap-6 px-6 pb-8 pt-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex items-end gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}
              >
                <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
                <div
                  className={`flex min-w-0 flex-col gap-2 ${i % 2 === 0 ? 'items-end' : 'items-start'}`}
                >
                  <div className="skeleton h-3 w-10 rounded-full" />
                  <div
                    className="skeleton h-16 rounded-2xl"
                    style={{ width: `${200 + (i % 3) * 70}px` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="mx-auto my-auto flex w-full max-w-[var(--spacing-content)] flex-col items-center gap-4 px-4 pb-8 pt-6 text-center sm:gap-5 sm:px-6 sm:pb-12 sm:pt-8">
            <BrandMascot className="h-16 w-14 sm:h-20 sm:w-[72px]" />
            <div>
              <p className="fp-mono mb-2 opacity-50">
                {view === 'library' ? 'Archivados' : 'Nuevo chat'}
              </p>
              <h1
                className="fp-display"
                style={{ fontSize: 'clamp(26px, 7vw, 44px)' }}
              >
                {view === 'library' ? 'Biblioteca' : '¿En qué te ayudo?'}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[14px] font-medium leading-snug opacity-70 sm:text-[15px]">
                {view === 'library'
                  ? 'Aquí aparecen los chats archivados. Selecciona uno en el menú.'
                  : 'Borradores, estrategia y respuestas rápidas — elige un atajo o escribe abajo.'}
              </p>
            </div>
            {view !== 'library' && (
              <div className="mt-1 grid w-full grid-cols-1 gap-2.5 sm:mt-2 sm:grid-cols-2 sm:gap-3">
                {visibleSuggestions.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    className={`fp-card ${s.tone} flex flex-col gap-1.5 p-3.5 text-left transition hover:-translate-y-0.5 sm:p-4`}
                    onClick={() => onSend(s.body)}
                  >
                    <span className="text-[13px] font-bold sm:text-[14px]">
                      {s.title}
                    </span>
                    <span className="line-clamp-3 text-[12px] font-medium leading-snug opacity-75 sm:line-clamp-none sm:text-[13px]">
                      {s.body}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!isAuthenticated && (
              <p className="mt-2 text-[14px] font-medium opacity-55">
                Inicia sesión para guardar chats y usar los modelos de tu
                espacio.
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[var(--spacing-content)] flex-col gap-4 px-3 pb-6 pt-4 sm:gap-5 sm:px-6 sm:pb-8 sm:pt-6">
            {messages.map((m, i) => {
              const isLastAssistant =
                streaming &&
                m.role === 'assistant' &&
                i === messages.length - 1;
              const incomplete =
                m.role === 'assistant' &&
                i === messages.length - 1 &&
                !streaming &&
                isIncompleteHtml(m.content);
              return (
                <Message
                  key={m.id}
                  message={m}
                  streaming={isLastAssistant}
                  incomplete={incomplete}
                  onRegenerate={() => onRegenerate(m.id)}
                  onContinue={
                    incomplete && onContinue
                      ? () => onContinue(m.id)
                      : undefined
                  }
                  onFeedback={(rating) => onFeedback(m.id, rating)}
                />
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-auto mb-2 w-full max-w-[var(--spacing-content)] rounded-[10px] border border-hairline bg-sidebar-mist px-3 py-2 text-[14px] text-mid-ash">
          {error}
        </div>
      )}

      {view !== 'library' && !inProjectHome && !loading && (
        <div className="fp-page border-t border-black/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:border-0 sm:px-6 sm:pb-4 sm:pt-0">
          <Composer
            onSend={onSend}
            disabled={streaming}
            models={models}
            model={model}
            onModelChange={onModelChange}
            placeholder={
              activeProject ? `Mensaje en ${activeProject.name}…` : undefined
            }
          />
        </div>
      )}
        </div>

        {showLivePreview ? (
          <LiveHtmlPreview
            html={liveHtml}
            streaming={streaming}
            incomplete={isIncompleteHtml(
              messages[messages.length - 1]?.role === 'assistant'
                ? messages[messages.length - 1]?.content
                : ''
            )}
            onClose={() => setLivePreviewOpen(false)}
            onContinue={
              onContinue && messages[messages.length - 1]?.id
                ? () => onContinue(messages[messages.length - 1].id)
                : undefined
            }
            title="matu · preview"
            conversationId={conversation?.id || null}
          />
        ) : null}
      </div>
    </main>
  );
}
