import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { successorChatService } from '../../services/api';
import { streamSuccessorQuery } from '../../services/gemini';
import { ROUTES } from '../../config/constants';
import type { SuccessorChat, SuccessorChatMessage } from '../../types';
import UserMenu from '../../components/shared/UserMenu';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function KnowledgeChatPage() {
  const { engagementId } = useParams<{ engagementId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [retirees, setRetirees] = useState<any[]>([]);
  const [chat, setChat] = useState<SuccessorChat | null>(null);
  const [messages, setMessages] = useState<SuccessorChatMessage[]>([]);
  const [selectedEngagement, setSelectedEngagement] = useState<any>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isLoadingRetirees, setIsLoadingRetirees] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    successorChatService.getRetirees().then(res => {
      if (res.data) setRetirees(Array.isArray(res.data) ? res.data : []);
      setIsLoadingRetirees(false);
    });
  }, []);

  useEffect(() => {
    if (!engagementId) {
      setChat(null);
      setMessages([]);
      setSelectedEngagement(null);
      return;
    }
    setIsLoadingChat(true);
    setChat(null);
    setMessages([]);
    successorChatService.getOrCreateChat(engagementId).then(res => {
      if (res.data) {
        setChat(res.data.chat);
        setMessages(res.data.messages || []);
        setSelectedEngagement(res.data.engagement);
      }
      setIsLoadingChat(false);
    });
  }, [engagementId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !chat || !engagementId || chat.status === 'confirmed') return;

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
      for await (const chunk of streamSuccessorQuery(chat.id, engagementId, question)) {
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
    if (res.data?.chat) setChat(res.data.chat);
  };

  const handleNewChat = async () => {
    if (!chat || isStreaming) return;
    const res = await successorChatService.resetChat(chat.id);
    if (res.data?.chat) {
      setChat(res.data.chat);
      setMessages([]);
    }
  };

  const isConfirmed = chat?.status === 'confirmed';

  return (
    <div className="h-screen bg-cream flex flex-col overflow-hidden">
      {/* Top nav */}
      <header className="bg-green-deep text-cream py-3 px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="p-1.5 hover:bg-green-mid rounded-full transition-colors"
            title="Back to Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div className="font-serif text-lg cursor-pointer" onClick={() => navigate(ROUTES.DASHBOARD)}>
            Exit<span className="text-amber italic">Wise</span>
          </div>
          <span className="text-green-pale text-sm hidden md:block">Knowledge Chat</span>
        </div>
        <UserMenu dark />
      </header>

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar: retiree list */}
        <aside className="w-60 bg-white border-r border-cream-dark flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-cream-dark">
            <p className="text-xs font-bold uppercase tracking-widest text-text-light">Knowledge Sources</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingRetirees ? (
              <p className="p-4 text-sm text-text-light">Loading...</p>
            ) : retirees.length === 0 ? (
              <p className="p-4 text-sm text-text-light italic">No released profiles in your organization.</p>
            ) : (
              retirees.map(r => {
                const isSelected = engagementId === r.engagement_id;
                return (
                  <button
                    key={r.engagement_id}
                    onClick={() => navigate(`/knowledge/${r.engagement_id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cream transition-colors border-b border-cream-dark/40 ${isSelected ? 'bg-cream border-l-2 border-l-amber' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-green-deep flex items-center justify-center text-cream text-xs font-bold shrink-0">
                      {getInitials(r.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-text-dark' : 'text-text-mid'}`}>
                        {r.full_name}
                      </p>
                      {r.job_title && (
                        <p className="text-xs text-text-light truncate">{r.job_title}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!engagementId || (!selectedEngagement && !isLoadingChat) ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="font-serif text-xl text-text-dark mb-2">Select a knowledge source</p>
                <p className="text-sm text-text-light">Choose a retiree from the left to begin.</p>
              </div>
            </div>
          ) : isLoadingChat ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-text-light text-sm">Loading conversation...</p>
            </div>
          ) : (
            <>
              {/* Chat top bar */}
              <div className="bg-white border-b border-cream-dark px-5 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-deep flex items-center justify-center text-cream text-xs font-bold shrink-0">
                    {selectedEngagement?.retiree_name ? getInitials(selectedEngagement.retiree_name) : '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-dark leading-tight">
                      {selectedEngagement?.retiree_name}
                      {selectedEngagement?.retiree_job_title && (
                        <span className="ml-2 font-normal text-text-light">· {selectedEngagement.retiree_job_title}</span>
                      )}
                    </p>
                    {isConfirmed && chat?.confirmed_at && (
                      <p className="text-xs text-green-mid">Confirmed {new Date(chat.confirmed_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConfirmed ? (
                    <button
                      onClick={handleNewChat}
                      disabled={isStreaming}
                      className="text-xs px-3 py-1.5 rounded-full border border-amber text-amber hover:bg-amber-light transition-colors disabled:opacity-50"
                    >
                      Start New Chat
                    </button>
                  ) : (
                    <button
                      onClick={handleConfirm}
                      disabled={isStreaming || messages.length === 0}
                      className="text-xs px-3 py-1.5 rounded-full border border-cream-dark text-text-mid hover:bg-cream transition-colors disabled:opacity-40"
                    >
                      End Chat
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                {messages.length === 0 && !isStreaming && (
                  <div className="text-center py-10">
                    <p className="text-text-light text-sm">
                      Ask anything about {selectedEngagement?.retiree_name}'s institutional knowledge.
                    </p>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-green-deep flex items-center justify-center text-cream text-xs font-bold shrink-0">
                        AI
                      </div>
                    )}
                    <div className={`max-w-xs md:max-w-sm rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-amber text-white rounded-br-sm'
                        : 'bg-white border border-cream-dark text-text-dark rounded-bl-sm shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-amber/20 flex items-center justify-center text-amber text-xs font-bold shrink-0">
                        {user?.full_name ? getInitials(user.full_name) : 'Me'}
                      </div>
                    )}
                  </div>
                ))}

                {isStreaming && (
                  <div className="flex items-end gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-green-deep flex items-center justify-center text-cream text-xs font-bold shrink-0">
                      AI
                    </div>
                    <div className="max-w-xs md:max-w-sm rounded-2xl rounded-bl-sm px-4 py-2.5 bg-white border border-cream-dark text-text-dark text-sm leading-relaxed shadow-sm">
                      {streamingText || <span className="text-text-light italic">Searching knowledge...</span>}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              {!isConfirmed ? (
                <div className="bg-white border-t border-cream-dark px-4 py-3 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Message..."
                      rows={1}
                      className="flex-1 px-4 py-2.5 bg-cream rounded-full border border-cream-dark resize-none focus:outline-none focus:ring-1 focus:ring-green-mid text-sm leading-snug"
                      disabled={isStreaming}
                      style={{ maxHeight: '80px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isStreaming}
                      className="w-9 h-9 rounded-full bg-amber flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-pale/30 border-t border-cream-dark px-4 py-3 text-center shrink-0">
                  <p className="text-xs text-green-mid">
                    Session confirmed ·{' '}
                    <button onClick={handleNewChat} className="underline hover:no-underline">
                      Start a new chat
                    </button>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
