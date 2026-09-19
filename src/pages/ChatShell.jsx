import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import ProjectModal from '../components/ProjectModal';
import { useChatController } from '../lib/chatStore';
import { CloseIcon, MenuIcon } from '../components/Icons';

function getInitialSidebar() {
  if (typeof window === 'undefined') return true;
  return !window.matchMedia('(max-width: 768px)').matches;
}

export default function ChatShell() {
  const store = useChatController();
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebar);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => setSidebarOpen(!mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const closeOnMobile = () => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setSidebarOpen(false);
    }
  };

  const handleCreateProject = async (payload) => {
    setCreatingProject(true);
    try {
      const project = await store.createProject(payload);
      if (project) setProjectModalOpen(false);
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div
      className={`grid h-dvh w-screen bg-pure-white ${
        sidebarOpen
          ? 'md:grid-cols-[var(--spacing-sidebar)_1fr]'
          : 'grid-cols-1'
      }`}
    >
      <button
        type="button"
        className="fixed left-3 top-3 z-60 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-hairline bg-pure-white text-graphite-ink md:hidden"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[var(--spacing-sidebar)] transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          conversations={store.conversations}
          projects={store.projects}
          activeId={store.active?.id}
          activeProject={store.activeProject}
          activeProjectId={store.projectId}
          view={store.view}
          streaming={store.streaming}
          onViewChange={(v) => {
            store.setView(v);
            closeOnMobile();
          }}
          onSelect={(id) => {
            store.selectConversation(id);
            closeOnMobile();
          }}
          onNewChat={() => {
            store.newChat();
            closeOnMobile();
          }}
          onSelectProject={(id) => {
            store.selectProject(id);
            closeOnMobile();
          }}
          onExitProject={() => {
            store.exitProject();
            closeOnMobile();
          }}
          onOpenCreateProject={() => setProjectModalOpen(true)}
          onOpenProfile={() => store.setShowProfile(true)}
        />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-deep-charcoal md:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ChatArea
        conversation={store.active}
        messages={store.messages}
        onSend={store.send}
        onRegenerate={store.regenerate}
        onContinue={store.continueGeneration}
        onFeedback={store.feedback}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        streaming={store.streaming}
        error={store.error}
        isAuthenticated={store.isAuthenticated}
        models={store.models}
        model={store.model}
        onModelChange={store.setModelId}
        view={store.view}
        plan={store.plan}
        usage={store.usage}
        onShare={store.shareConversation}
        onPin={store.pinConversation}
        onArchive={store.archiveConversation}
        onDelete={store.deleteConversation}
        onUpgrade={() => window.open(store.companyUrl, '_blank')}
        showProfile={store.showProfile}
        profileUser={store.profileUser}
        onSaveProfile={store.saveProfile}
        onCloseProfile={() => store.setShowProfile(false)}
        activeProject={store.activeProject}
        projectConversations={store.projectConversations}
        onSelectConversation={(id) => {
          store.selectConversation(id);
          closeOnMobile();
        }}
        onNewChat={store.newChat}
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSubmit={handleCreateProject}
        busy={creatingProject}
      />
    </div>
  );
}
