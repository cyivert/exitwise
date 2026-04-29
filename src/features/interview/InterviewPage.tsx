import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../../store/interviewStore';
import { useAuthStore } from '../../store/authStore';
import { streamInterviewResponse } from '../../services/gemini';
import { interviewService } from '../../services/api';
import { ROUTES } from '../../config/constants';
import type { QuestionType } from '../../types';
import { getInitials, isMeaningfulFollowUp, normalizeInterviewText, getQuestionProgression } from '../../utils/helpers';

export default function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    currentQuestion, 
    currentQuestionType,
    setCurrentQuestion, 
    streamingText, 
    setStreamingText, 
    isStreaming, 
    setIsStreaming,
    addExchange,
    setSession,
    sessionFocus,
    draftResponse,
    setDraftResponse,
    pushQuestionHistory,
    clearQuestionHistory,
    goBackQuestion,
    questionHistory,
    currentQuestionIndex,
    setCurrentQuestionIndex,
  } = useInterviewStore();

  const [sessionData, setSessionData] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // init session from DB.
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!sessionId) return;

      setIsLoading(true);

      const sessionRes = await interviewService.getSession(sessionId);
      const session = sessionRes.data;

      if (!session || cancelled) {
        setIsLoading(false);
        return;
      }

      const storeState = useInterviewStore.getState();
      if (storeState.sessionId && storeState.sessionId !== session.id) {
        clearQuestionHistory();
      }

      setSessionData(session);
      setSession(session.id, session.session_focus);

      const sessionsRes = await interviewService.getSessions(session.engagement_id);
      if (!cancelled && Array.isArray(sessionsRes.data)) {
        setSessions(sessionsRes.data);
      } else if (!cancelled) {
        setSessions([]);
      }

      const latestStoreState = useInterviewStore.getState();
      const hasStoredQuestionForSession = latestStoreState.sessionId === session.id && Boolean(latestStoreState.currentQuestion);
      const latestQuestion = session.latest_exchange?.ai_follow_up || session.latest_exchange?.question_text || '';

      if (!hasStoredQuestionForSession) {
        const anchorQuestion = getQuestionProgression(session.session_focus, session.session_number, 0);
        const normalizedLatestQuestion = normalizeInterviewText(latestQuestion);
        const nextQuestion = isMeaningfulFollowUp(normalizedLatestQuestion) ? normalizedLatestQuestion : anchorQuestion;
        setCurrentQuestion(nextQuestion, latestQuestion ? 'probe' : 'anchor');
        setCurrentQuestionIndex(0);
        setDraftResponse('');
        setStreamingText('');
      }

      setIsLoading(false);
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setCurrentQuestion, setDraftResponse, setSession, setStreamingText]);

  const currentSessionNumber = sessionData?.session_number ?? null;
  const sessionList = Array.isArray(sessions) ? sessions : [];
  const totalSessions = sessionList.length || 6;
  const remainingSessions = currentSessionNumber
    ? sessionList.filter((session) => session.session_number > currentSessionNumber && session.status !== 'complete').length
    : 0;
  const displayedQuestion = normalizeInterviewText(currentQuestion);
  const displayedFollowUp = normalizeInterviewText(streamingText);

  const handleContinue = async () => {
    if (!draftResponse || isStreaming || !sessionData) return;

    const exchange = {
      id: crypto.randomUUID(),
      session_id: sessionId!,
      question_text: currentQuestion,
      question_type: currentQuestionType as QuestionType,
      response_text: draftResponse,
      created_at: new Date().toISOString(),
      sequence_order: sessionData.session_number,
    };

    // save to DB.
    await interviewService.saveExchange(exchange);
    addExchange(exchange);

    setIsStreaming(true);
    setStreamingText('');

    try {
      let fullResponse = '';
      for await (const chunk of streamInterviewResponse(sessionId!, draftResponse)) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }
      
      const cleanedFollowUp = normalizeInterviewText(fullResponse);
      const nextIndex = currentQuestionIndex + 1;
      const scriptedFallback = getQuestionProgression(sessionData.session_focus, sessionData.session_number, nextIndex);
      const nextQuestion = isMeaningfulFollowUp(cleanedFollowUp)
        ? cleanedFollowUp
        : scriptedFallback;

      pushQuestionHistory(currentQuestion, currentQuestionType);
      setCurrentQuestionIndex(nextIndex);
      await interviewService.saveExchange({
        ...exchange,
        ai_follow_up: nextQuestion,
      });
      setCurrentQuestion(nextQuestion, "probe");
      setStreamingText(nextQuestion);
      setDraftResponse('');
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
      <aside className="w-60 bg-white border-r border-cream-dark p-6 hidden md:block">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-full bg-green-deep flex items-center justify-center text-white mb-4">
            {getInitials(user?.full_name || 'Retiree')}
          </div>
          <h4 className="font-serif text-lg">{user?.full_name}</h4>
          <p className="text-xs text-text-light uppercase tracking-tighter">{user?.job_title || 'Expert Retiree'}</p>
        </div>

        <div className="mb-8 rounded-lg border border-cream-dark bg-cream/40 p-4">
          <p className="label-caps text-amber mb-1">Session Progress</p>
          <p className="font-serif text-lg text-text-dark">
            Session {currentSessionNumber ?? '?'} of {totalSessions}
          </p>
          <p className="text-xs text-text-light mt-1">
            {remainingSessions} more {remainingSessions === 1 ? 'session' : 'sessions'} after this one.
          </p>
        </div>

        <nav className="space-y-4">
          {sessionList.map((session) => {
            const isCurrentSession = session.id === sessionId;
            const isComplete = session.status === 'complete';

            return (
              <div key={session.id} className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-light' : isCurrentSession ? 'bg-amber' : 'bg-cream-dark'}`} />
                <span className={`text-sm ${isCurrentSession ? 'font-medium text-text-dark' : 'text-text-mid'}`}>
                  Session {session.session_number}: {session.session_focus}
                </span>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="grow flex flex-col">
        <header className="p-6 flex justify-between items-center border-b border-cream-dark">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate(ROUTES.DASHBOARD)}
              className="p-2 hover:bg-cream rounded-full transition-colors"
              title="Back to Dashboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="font-serif text-xl cursor-pointer" onClick={() => navigate(ROUTES.DASHBOARD)}>
              Exit<span className="text-amber italic">Wise</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="label-caps bg-amber-light px-3 py-1 rounded text-amber">{sessionFocus}</div>
          </div>
        </header>

        <main className="grow p-12 max-w-3xl mx-auto w-full">
          <div className="mb-12">
            <span className="label-caps text-amber block mb-4">Current Focus</span>
            <h2 className="text-4xl leading-tight mb-6 font-serif">
              {displayedQuestion}
            </h2>
          </div>

          <div className="space-y-6">
            <textarea
              value={draftResponse}
              onChange={(e) => setDraftResponse(e.target.value)}
              placeholder="Take your time. We are capturing how you think, not just what you do."
              className="w-full h-48 p-6 bg-white border border-cream-dark rounded-lg focus:ring-1 focus:ring-green-mid outline-none resize-none text-lg shadow-inner font-serif"
              disabled={isStreaming}
            />
            
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <button 
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="text-text-light hover:text-text-dark transition-colors"
              >
                Save and exit
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    goBackQuestion();
                    setDraftResponse('');
                    setStreamingText('');
                  }}
                  disabled={questionHistory.length === 0 || isStreaming}
                  className="px-5 py-3 rounded border border-cream-dark text-text-mid hover:text-text-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                >
                  Back
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
          </div>

          {(streamingText || isStreaming) && (
            <div className="mt-12 p-8 bg-green-pale/30 border border-green-pale rounded-lg animate-in fade-in slide-in-from-bottom-4">
               <span className="label-caps text-green-mid block mb-4">ExitWise Follow-up</span>
               <p className="text-xl font-serif italic text-text-dark leading-relaxed">
                 {displayedFollowUp}
                 {isStreaming && <span className="inline-block w-2 h-5 bg-amber ml-1 animate-pulse" />}
               </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
