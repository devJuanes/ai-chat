import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import ChatArea from '../components/ChatArea';
import { useWorkspace } from '../lib/workspace';

export default function ChatPage() {
  const ws = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const { onToggleSidebar } = useOutletContext() || {};
  const sentDraft = useRef(null);
  const sendRef = useRef(ws.send);
  sendRef.current = ws.send;

  useEffect(() => {
    const draft = location.state?.draft;
    if (!draft || sentDraft.current === draft) return;
    sentDraft.current = draft;
    sendRef.current(draft);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  return (
    <ChatArea
      conversation={ws.active}
      messages={ws.messages}
      onSend={ws.send}
      onRegenerate={ws.regenerate}
      onContinue={ws.continueGeneration}
      onFeedback={ws.feedback}
      onToggleSidebar={onToggleSidebar}
      streaming={ws.streaming}
      loading={ws.loading}
      error={ws.error}
      isAuthenticated={ws.isAuthenticated}
      models={ws.models}
      model={ws.model}
      onModelChange={ws.setModelId}
      view="chats"
      plan={ws.plan}
      usage={ws.usage}
      onShare={ws.shareConversation}
      onPin={ws.pinConversation}
      onArchive={ws.archiveConversation}
      onDelete={ws.deleteConversation}
      onUpgrade={() => navigate('/usage')}
      onOpenUsage={() => navigate('/usage')}
      activeProject={ws.activeProject}
      projectConversations={ws.projectConversations}
      onSelectConversation={(id) => ws.selectConversation(id, ws.projectId)}
      onNewChat={ws.newChat}
      projectHome={ws.route.section === 'project'}
      onRenameTitle={ws.renameConversation}
    />
  );
}
