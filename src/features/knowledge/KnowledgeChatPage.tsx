import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { successorChatService } from '../../services/api';
import { streamSuccessorQuery } from '../../services/gemini';
import { ROUTES } from '../../config/constants';
import type { SuccessorChat, SuccessorChatMessage } from '../../types';

export default function KnowledgeChatPage() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [chat, setChat] = useState<SuccessorChat | null>(null);
  const [messages, setMessages] = useState<SuccessorChatMessage[]>([]);
  const [engagement, setEngagement] = useState<any>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!engagementId) return;
    successorChatService.getOrCreateChat(engagementId).then(res => {
      if (res.data) {
        setChat(res.data.chat);
        setMessages(res.data.messages || []);
        setEngagement(res.data.engagement);
      }
      setIsLoading(false);
    });
  }, [engagementId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !chat || chat.status === 'confirmed') return;

    const question = input.trim();
    const userMessage: SuccessorChatMessage = {
      id: crypto.randomUUID(),
      chat_id: chat.id,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    await successorChatService.saveMessage({ chat_id: chat.id, role: 'user', content: question });

    try {
      let fullResponse = '';
      for await (const chunk of streamSuccessorQuery(chat.id, engagementId!, question)) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }

      const assistantMessage: SuccessorChatMessage = {
        id: crypto.randomUUID(),
        chat_id: chat.id,
        role: 'assistant',
        content: fullResponse,
        created_at: new Date().toISOString(),
      };

      await successorChatService.saveMessage({ chat_id: chat.id, role: 'assistant', content: fullResponse });
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingText('');
    } catch {
      setStreamingText('');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleConfirm = async () => {
    if (!chat || isStreaming) return;
    const res = await successorChatService.confirmChat(chat.id);
    if (res.data?.chat) {
      setChat(res.data.chat);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center font-serif text-2xl">
        Loading knowledge profile...
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-mid mb-4">Knowledge profile not found or not yet released.</p>
          <button onClick={() => navigate(ROUTES.DASHBOARD)} className="btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const isConfirmed = chat.status === 'confirmed';

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-green-deep text-cream py-4 px-8 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="p-2 hover:bg-green-mid rounded-full transition-colors"
            title="Back to Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div className="font-serif text-xl cursor-pointer" onClick={() => navigate(ROUTES.DASHBOARD)}>
            Exit<span className="text-amber italic">Wise</span>
          </div>
          <span className="text-green-pale text-sm hidden md:block">Knowledge Chat</span>
        </div>
        <div className="flex items-center gap-3">
          {isConfirmed ? (
            <span className="text-xs uppercase tracking-widest text-green-pale font-bold px-3 py-1 border border-green-mid rounded">
              Session Confirmed
            </span>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isStreaming}
              className="px-4 py-2 bg-amber text-white rounded text-sm font-medium hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm & End Session
            </button>
          )}
        </div>
      </header>

      {engagement && (
        <div className="bg-white border-b border-cream-dark px-8 py-3">
          <p className="text-sm text-text-light">
            Knowledge from:{' '}
            <span className="font-medium text-text-dark">{engagement.retiree_name}</span>
            {engagement.retiree_job_title && (
              <span className="text-text-light"> · {engagement.retiree_job_title}</span>
            )}
          </p>
          {isConfirmed && chat.confirmed_at && (
            <p className="text-xs text-green-mid mt-0.5">
              Session confirmed {new Date(chat.confirmed_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-16">
              <p className="font-serif text-2xl text-text-dark mb-3">
                Knowledge is ready.
              </p>
              <p className="text-text-light">
                Ask anything about{' '}
                {engagement?.retiree_name ? `${engagement.retiree_name}'s` : 'the retiree\'s'}{' '}
                processes, decisions, relationships, or institutional knowledge.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xl rounded-lg px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-green-deep text-cream'
                    : 'bg-white border border-cream-dark text-text-dark shadow-sm'
                }`}
              >
                <p className={`text-xs uppercase tracking-widest mb-2 ${msg.role === 'user' ? 'text-green-pale' : 'text-amber'}`}>
                  {msg.role === 'user' ? (user?.full_name || 'You') : 'ExitWise AI'}
                </p>
                <p className="font-serif leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-xl rounded-lg px-5 py-4 bg-white border border-cream-dark text-text-dark shadow-sm">
                <p className="text-xs uppercase tracking-widest mb-2 text-amber">ExitWise AI</p>
                {streamingText ? (
                  <p className="font-serif leading-relaxed whitespace-pre-wrap">{streamingText}</p>
                ) : (
                  <p className="text-text-light text-sm italic">Searching knowledge profile...</p>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {!isConfirmed && (
        <div className="border-t border-cream-dark bg-white p-4 md:p-6">
          <div className="max-w-3xl mx-auto flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about processes, decisions, relationships, or anything captured in the knowledge transfer..."
              className="flex-1 p-4 border border-cream-dark rounded-lg resize-none h-20 focus:outline-none focus:ring-1 focus:ring-green-mid font-serif text-base"
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="btn-primary px-6 self-end disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStreaming ? '...' : 'Send'}
            </button>
          </div>
          <p className="max-w-3xl mx-auto mt-2 text-xs text-text-light">
            Press Enter to send · Shift+Enter for new line · Click "Confirm & End Session" when done
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="border-t border-cream-dark bg-green-pale/30 px-8 py-4 text-center">
          <p className="text-sm text-green-mid font-medium">
            Session confirmed. This transcript is saved for your reference only.
          </p>
        </div>
      )}
    </div>
  );
}
