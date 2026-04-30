import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInterviewStore } from '../../store/interviewStore';
import { useAuthStore } from '../../store/authStore';
import { streamInterviewResponse } from '../../services/gemini';
import { interviewService } from '../../services/api';
import { ROUTES } from '../../config/constants';
import type { QuestionType } from '../../types';
import { getInitials, isMeaningfulFollowUp, normalizeInterviewText, getQuestionProgression } from '../../utils/helpers';
import UserMenu from '../../components/shared/UserMenu';

function groupSessionExchanges(exchanges: any[]) {
  return exchanges.reduce<Record<number, any[]>>((groups, exchange) => {
    const sessionNumber = Number(exchange.session_number || 0);
    if (!groups[sessionNumber]) {
      groups[sessionNumber] = [];
    }
    groups[sessionNumber].push(exchange);
    return groups;
  }, {});
}

export default function InterviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    currentQuestion, 
    currentQuestionType,
    setCurrentQuestion, 
    setStreamingText, 
    isStreaming, 
    setIsStreaming,
    addExchange,
    setSession,
    sessionFocus,
    draftResponse,
    setDraftResponse,
    pushQuestionHistory,
    pushResponseHistory,
    resetQuestionFlow,
    goBackQuestion,
    questionHistory,
    currentQuestionIndex,
    setCurrentQuestionIndex,
  } = useInterviewStore();

  const [sessionData, setSessionData] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [experienceTranscript, setExperienceTranscript] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTransition, setSessionTransition] = useState<{
    fromSession: number;
    nextSessionId: string | null;
    nextFocus: string | null;
    isFinal: boolean;
  } | null>(null);

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
        resetQuestionFlow();
      }

      setSessionData(session);
      setSession(session.id, session.session_focus);
      const transcriptSource = Array.isArray(session.experience_transcript)
        ? session.experience_transcript
        : Array.isArray(session.experience_exchanges)
          ? session.experience_exchanges
          : [];
      setExperienceTranscript(transcriptSource);

      const sessionsRes = await interviewService.getSessions(session.engagement_id);
      if (!cancelled && Array.isArray(sessionsRes.data)) {
        setSessions(sessionsRes.data);
      } else if (!cancelled) {
        setSessions([]);
      }

      const latestStoreState = useInterviewStore.getState();
      const storedQuestionIsUsable = latestStoreState.sessionId === session.id && isMeaningfulFollowUp(latestStoreState.currentQuestion);
      const latestQuestion = session.latest_exchange?.ai_follow_up || session.latest_exchange?.question_text || '';

      if (!storedQuestionIsUsable) {
        const storedQuestionIndex = latestStoreState.sessionId === session.id ? (latestStoreState.currentQuestionIndex || 0) : 0;
        const anchorQuestion = getQuestionProgression(session.session_focus, session.session_number, storedQuestionIndex);
        const normalizedLatestQuestion = normalizeInterviewText(latestQuestion);
        const nextQuestion = isMeaningfulFollowUp(normalizedLatestQuestion) ? normalizedLatestQuestion : anchorQuestion;
        setCurrentQuestion(nextQuestion, latestQuestion ? 'probe' : 'anchor');
        setCurrentQuestionIndex(storedQuestionIndex);
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

  useEffect(() => {
    if (!sessionTransition) return;
    const delay = sessionTransition.isFinal ? 3800 : 3200;
    const timer = setTimeout(() => {
      if (sessionTransition.nextSessionId) {
        navigate(`/interview/${sessionTransition.nextSessionId}`);
      } else {
        navigate(ROUTES.DASHBOARD);
      }
      setSessionTransition(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [sessionTransition, navigate]);

  const currentSessionNumber = sessionData?.session_number ?? null;
  const sessionList = Array.isArray(sessions) ? sessions : [];
  const totalSessions = sessionList.length || 6;
  const remainingSessions = currentSessionNumber
    ? sessionList.filter((session) => session.session_number > currentSessionNumber && session.status !== 'complete').length
    : 0;
  const displayedQuestion = normalizeInterviewText(currentQuestion);
  const savedExperienceExchanges = Array.isArray(experienceTranscript) ? experienceTranscript : [];
  const groupedExperienceExchanges = groupSessionExchanges(savedExperienceExchanges);

  const handleContinue = async () => {
    if (!draftResponse || isStreaming || !sessionData) return;
    const nextIndex = currentQuestionIndex + 1;
    const isFinalQuestionInSession = nextIndex >= 3;

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
    setExperienceTranscript((current) => {
      const existingIndex = current.findIndex((item) => item.id === exchange.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = { ...next[existingIndex], ...exchange };
        return next;
      }
      return [...current, exchange];
    });
    pushResponseHistory(draftResponse);

    if (isFinalQuestionInSession) {
      const nextSession = sessionList.find((session) => session.session_number === sessionData.session_number + 1);
      resetQuestionFlow();
      setSessionTransition({
        fromSession: sessionData.session_number,
        nextSessionId: nextSession?.id ?? null,
        nextFocus: nextSession?.session_focus ?? null,
        isFinal: !nextSession,
      });
      return;
    }

    setIsStreaming(true);
    setStreamingText('');

    try {
      let fullResponse = '';
      for await (const chunk of streamInterviewResponse(sessionId!, draftResponse)) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }
      
      const cleanedFollowUp = normalizeInterviewText(fullResponse);
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
      setExperienceTranscript((current) => current.map((item) => item.id === exchange.id ? { ...item, ai_follow_up: nextQuestion } : item));
      setCurrentQuestion(nextQuestion, "probe");
      setStreamingText(cleanedFollowUp);
      setDraftResponse('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsStreaming(false);
    }
  };

  const focusCompletionMessages: Record<string, string> = {
    orientation:   'The foundation is set.',
    processes:     'The workflows are captured.',
    decisions:     'The decisions are mapped.',
    relationships: 'The network is charted.',
    edge_cases:    'The edge cases are preserved.',
    review:        'The legacy is complete.',
  };

  if (isLoading) return <div className="min-h-screen bg-cream flex items-center justify-center font-serif text-2xl">Preparing legacy session...</div>;

  return (
    <>
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
            <UserMenu />
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

          <div className="mt-12 p-8 bg-green-pale/20 border border-green-pale rounded-lg">
            <span className="label-caps text-green-mid block mb-4">Saved Answers This Experience</span>
            {savedExperienceExchanges.length > 0 ? (
              <div className="space-y-5 max-h-96 overflow-y-auto pr-2">
                {Array.from({ length: 6 }, (_, index) => index + 1).map((sessionNumber) => {
                  const sessionExchanges = groupedExperienceExchanges[sessionNumber] || [];
                  return (
                    <section key={sessionNumber} className="rounded-lg border border-green-pale bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-text-light">Session {sessionNumber}</p>
                          <p className="font-serif text-lg text-text-dark">Saved transcript</p>
                        </div>
                        <span className="text-xs text-text-light uppercase tracking-[0.18em]">
                          {sessionExchanges.length} turns
                        </span>
                      </div>

                      {sessionExchanges.length > 0 ? (
                        <div className="space-y-3">
                          {sessionExchanges.map((exchange) => (
                            <article key={exchange.id} className="rounded-md border border-green-pale/70 bg-white p-4">
                              <p className="text-xs uppercase tracking-[0.2em] text-text-light mb-2">
                                {sessionNumber}.{exchange.sequence_order || 1} {exchange.session_focus ? `• ${exchange.session_focus}` : ''}
                              </p>
                              <p className="text-sm font-medium text-text-dark mb-2">
                                Q: {normalizeInterviewText(exchange.question_text)}
                              </p>
                              <p className="text-lg font-serif italic text-text-dark leading-relaxed">
                                A: {normalizeInterviewText(exchange.response_text || 'No answer saved yet.')}
                              </p>
                              {exchange.ai_follow_up && (
                                <p className="mt-3 text-sm text-text-mid border-t border-green-pale pt-3">
                                  Follow-up: {normalizeInterviewText(exchange.ai_follow_up)}
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-text-mid">No saved answers yet for this session.</p>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <p className="text-text-mid">No saved answers yet for this experience.</p>
            )}
          </div>
        </main>
      </div>
    </div>

    {sessionTransition && (
      <div className="session-transition-overlay fixed inset-0 z-50 bg-green-deep flex items-center justify-center">
        <div className="session-transition-content text-center px-8 max-w-lg w-full">
          {sessionTransition.isFinal ? (
            <>
              <div className="text-amber font-serif text-6xl mb-6 select-none">✦</div>
              <p className="label-caps text-green-pale/60 mb-6">All Sessions Complete</p>
              <div className="flex gap-3 justify-center mb-10">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="session-dot-pop w-3 h-3 rounded-full bg-amber"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
              <h1 className="font-serif text-6xl text-cream mb-4">Legacy Complete.</h1>
              <p className="text-green-pale/70 text-lg leading-relaxed">
                Your knowledge has been preserved<br />for those who follow.
              </p>
            </>
          ) : (
            <>
              <p className="label-caps text-green-pale/60 mb-6">
                Session {sessionTransition.fromSession} Complete
              </p>
              <div className="flex gap-3 justify-center mb-10">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      i < sessionTransition.fromSession
                        ? 'session-dot-pop bg-amber'
                        : 'bg-green-mid/40'
                    }`}
                    style={i < sessionTransition.fromSession ? { animationDelay: `${i * 0.08}s` } : {}}
                  />
                ))}
              </div>
              <h1 className="font-serif text-5xl text-cream mb-4 leading-tight">
                {focusCompletionMessages[sessionData?.session_focus] ?? 'Well done.'}
              </h1>
              {sessionTransition.nextFocus && (
                <p className="text-amber text-xl italic mt-3 capitalize">
                  Next: {sessionTransition.nextFocus.replace('_', ' ')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
