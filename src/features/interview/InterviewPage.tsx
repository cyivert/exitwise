import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../../store/interviewStore';
import { useAuthStore } from '../../store/authStore';
import { streamInterviewResponse } from '../../services/gemini';
import { interviewService } from '../../services/api';
import { ROUTES } from '../../config/constants';

export default function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    currentQuestion, 
    setCurrentQuestion, 
    streamingText, 
    setStreamingText, 
    isStreaming, 
    setIsStreaming,
    addExchange,
    setSession,
    sessionFocus
  } = useInterviewStore();

  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // init session from DB.
  useEffect(() => {
    if (sessionId) {
      interviewService.getSession(sessionId).then(res => {
        if (res.data) {
          setSession(res.data.id, res.data.session_focus);
          // if first time, start with anchor.
          if (!currentQuestion) {
            setCurrentQuestion(`Welcome to Session ${res.data.session_number}. Let's focus on ${res.data.session_focus}. To start, describe a complex situation you handled recently where your experience was the deciding factor.`, "anchor");
          }
        }
        setIsLoading(false);
      });
    }
  }, [sessionId]);

  const handleContinue = async () => {
    if (!response || isStreaming) return;

    const exchange = {
      id: crypto.randomUUID(),
      session_id: sessionId!,
      question_text: currentQuestion,
      question_type: 'anchor' as any,
      response_text: response,
      created_at: new Date().toISOString(),
      sequence_order: 0
    };

    // save to DB.
    await interviewService.saveExchange(exchange);
    addExchange(exchange);

    setIsStreaming(true);
    setStreamingText('');

    try {
      let fullResponse = '';
      for await (const chunk of streamInterviewResponse(sessionId!, response)) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }
      
      setCurrentQuestion(fullResponse, "probe");
      setResponse('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsStreaming(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-cream flex items-center justify-center font-serif text-2xl">Preparing legacy session...</div>;

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-[240px] bg-white border-r border-cream-dark p-6 hidden md:block">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-full bg-green-deep flex items-center justify-center text-white mb-4">
            {user?.full_name[0]}
          </div>
          <h4 className="font-serif text-lg">{user?.full_name}</h4>
          <p className="text-xs text-text-light uppercase tracking-tighter">{user?.job_title || 'Expert Retiree'}</p>
        </div>

        <nav className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map(num => (
            <div key={num} className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${num < 3 ? 'bg-green-light' : num === 3 ? 'bg-amber' : 'bg-cream-dark'}`} />
              <span className="text-sm">Session {num}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="flex-grow flex flex-col">
        <header className="p-6 flex justify-between items-center border-b border-cream-dark">
          <div className="font-serif text-xl cursor-pointer" onClick={() => navigate(ROUTES.DASHBOARD)}>
            Exit<span className="text-amber italic">Wise</span>
          </div>
          <div className="label-caps bg-amber-light px-3 py-1 rounded text-amber">{sessionFocus}</div>
        </header>

        <main className="flex-grow p-12 max-w-3xl mx-auto w-full">
          <div className="mb-12">
            <span className="label-caps text-amber block mb-4">Current Focus</span>
            <h2 className="text-4xl leading-tight mb-6 font-serif">
              {currentQuestion}
            </h2>
          </div>

          <div className="space-y-6">
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Take your time. We are capturing how you think, not just what you do."
              className="w-full h-48 p-6 bg-white border border-cream-dark rounded-lg focus:ring-1 focus:ring-green-mid outline-none resize-none text-lg shadow-inner font-serif"
              disabled={isStreaming}
            />
            
            <div className="flex justify-between items-center">
              <button 
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="text-text-light hover:text-text-dark transition-colors"
              >
                Save and exit
              </button>
              <button 
                onClick={handleContinue}
                className={`btn-primary px-12 py-3 ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isStreaming}
              >
                {isStreaming ? 'AI is thinking...' : 'Continue'}
              </button>
            </div>
          </div>

          {(streamingText || isStreaming) && (
            <div className="mt-12 p-8 bg-green-pale/30 border border-green-pale rounded-lg animate-in fade-in slide-in-from-bottom-4">
               <span className="label-caps text-green-mid block mb-4">ExitWise Follow-up</span>
               <p className="text-xl font-serif italic text-text-dark leading-relaxed">
                 {streamingText}
                 {isStreaming && <span className="inline-block w-2 h-5 bg-amber ml-1 animate-pulse" />}
               </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
