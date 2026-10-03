import { useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { streamChat } from '../../lib/api';

export default function EduTutor() {
  const auth = useAuth();
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);

  const scroll = () => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  };

  const send = async (text) => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError('');
    setDraft('');
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content };
    const botId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: botId, role: 'assistant', content: '' }]);
    try {
      await streamChat({
        token: auth.getToken(),
        conversationId,
        modelId: 'edu-creator',
        content,
        onMeta: (meta) => {
          if (meta?.conversation_id) setConversationId(meta.conversation_id);
        },
        onDelta: ({ content: chunk }) => {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === botId ? { ...item, content: item.content + (chunk || '') } : item
            )
          );
          scroll();
        },
        onError: (data) => {
          throw new Error(data?.message || 'El tutor no pudo responder');
        },
      });
    } catch (err) {
      setError(err.message || 'No se pudo enviar');
    } finally {
      setBusy(false);
      scroll();
    }
  };

  return (
    <div className="edu-chat">
      <div className="edu-chat-log" ref={scroller}>
        <p className="edu-kicker">Tutor</p>
        <h1 className="edu-display edu-tutor-title">
          Pregunta. Practica. No te hace la tarea.
        </h1>
        <p className="edu-lead">
          El tutor aclara, da otro ejemplo y te deja el ejercicio. El curso
          completo se arma en Cursos.
        </p>
        {messages.map((item) => (
          <div key={item.id} className={`edu-bubble${item.role === 'user' ? ' me' : ''}`}>
            {item.content || (busy ? '…' : '')}
          </div>
        ))}
        {error ? <div className="edu-error">{error}</div> : null}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Pregúntale al tutor"
          aria-label="Mensaje para el tutor"
        />
        <button className="edu-btn" type="submit" disabled={busy || !draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
