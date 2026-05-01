import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InterviewExchange, SessionFocus } from '../types';

// this store manages the state of the interview session, including the current question, response, and history of exchanges. 
// It also handles the streaming state for AI responses.
interface InterviewState {
  sessionId: string | null;
  sessionFocus: SessionFocus | null;
  exchanges: InterviewExchange[];
  streamingText: string;
  isStreaming: boolean;
  currentQuestion: string;
  currentQuestionType: string;
  draftResponse: string;
  questionHistory: Array<{ question: string; type: string }>;
  responseHistory: string[];
  currentQuestionIndex: number;
}

// Actions for managing interview state, including setting session info, adding exchanges, 
// managing streaming text and state, handling question flow, and resetting state.
interface InterviewActions {
  setSession: (id: string, focus: SessionFocus) => void;
  addExchange: (exchange: InterviewExchange) => void;
  setStreamingText: (text: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setCurrentQuestion: (question: string, type: string) => void;
  pushQuestionHistory: (question: string, type: string) => void;
  pushResponseHistory: (response: string) => void;
  clearQuestionHistory: () => void;
  resetQuestionFlow: () => void;
  goBackQuestion: () => void;
  setCurrentQuestionIndex: (index: number) => void;
  setDraftResponse: (response: string) => void;
  reset: () => void;
}

// This store for managing interview state, with persistence to localStorage. 
// The state includes session info, current question and response, history of exchanges, 
// and streaming state for AI responses.
export const useInterviewStore = create<InterviewState & InterviewActions>()(
  persist(
    (set) => ({
      sessionId: null,
      sessionFocus: null,
      exchanges: [],
      streamingText: '',
      isStreaming: false,
      currentQuestion: '',
      currentQuestionType: 'anchor',
      draftResponse: '',
      questionHistory: [],
      responseHistory: [],
      currentQuestionIndex: 0,
      setSession: (id, focus) => set({ sessionId: id, sessionFocus: focus }),                                   // set session id and focus at start of interview
      addExchange: (exchange) => set((state) => ({ exchanges: [...state.exchanges, exchange] })),               // add question/response exchange to history after each response is submitted
      setStreamingText: (text) => set({ streamingText: text }),                                                 // update streaming text as AI response streams in              
      setIsStreaming: (isStreaming) => set({ isStreaming }),                                                    // set streaming state to manage UI (e.g., disable buttons while streaming)    
      setCurrentQuestion: (question, type) => set({ currentQuestion: question, currentQuestionType: type }),    // set the current question and type (anchor, follow-up, etc.) to manage question flow and UI display
      setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),                                 // manage current question index for navigating question history
      pushQuestionHistory: (question, type) =>
        set((state) => ({
          questionHistory: [...state.questionHistory, { question, type }].slice(-8),  // keep only last 8 questions in history to limit memory usage
        })),
      pushResponseHistory: (response) =>
        set((state) => ({
          responseHistory: [...state.responseHistory, response].slice(-8), // keep only last 8 responses in history to limit memory usage
        })),
      clearQuestionHistory: () => set({ questionHistory: [], currentQuestionIndex: 0 }), // clear question history (e.g., when starting a new session or resetting)
      resetQuestionFlow: () => set({ // reset question flow to initial state, but keep session info and exchanges. used when user wants to restart the interview questions without losing progress on current session.
        currentQuestion: '',
        currentQuestionType: 'anchor',
        draftResponse: '',
        streamingText: '',
        isStreaming: false,
        questionHistory: [],
        responseHistory: [],
        currentQuestionIndex: 0,
      }),
      goBackQuestion: () =>     // navigate back to previous question in history, restoring the question, type, and response draft. used when user wants to revise their previous response or review the previous question.
        set((state) => {
          if (state.questionHistory.length === 0) return state;

          const nextHistory = [...state.questionHistory];
          const previous = nextHistory.pop();
          const nextResponseHistory = [...state.responseHistory];
          const previousResponse = nextResponseHistory.pop();

          if (!previous) return state;
          
          return {
            currentQuestion: previous.question,
            currentQuestionType: previous.type,
            draftResponse: previousResponse ?? '',
            streamingText: '',
            isStreaming: false,
            questionHistory: nextHistory,
            responseHistory: nextResponseHistory,
            currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
          };
        }),
      setDraftResponse: (draftResponse) => set({ draftResponse }), // update the draft response as user types, so that it can be restored if user navigates back to this question.
      reset: () => set({
        sessionId: null,
        sessionFocus: null,
        exchanges: [],
        streamingText: '',
        isStreaming: false,
        currentQuestion: '',
        currentQuestionType: 'anchor',
        draftResponse: '',
        questionHistory: [],
        responseHistory: [],
        currentQuestionIndex: 0,
      }),
    }),
    {
      name: 'exitwise-interview',
      partialize: (state) => ({     // only persist certain parts of the state to localStorage. we want to persist session info and question/response history, but not streaming state or current question/response which can be reset on page reload.
        sessionId: state.sessionId,
        sessionFocus: state.sessionFocus,
        exchanges: state.exchanges,
        streamingText: state.streamingText,
        currentQuestion: state.currentQuestion,
        currentQuestionType: state.currentQuestionType,
        draftResponse: state.draftResponse,
        questionHistory: state.questionHistory,
        responseHistory: state.responseHistory,
        currentQuestionIndex: state.currentQuestionIndex,
      }),
    }
  )
);
