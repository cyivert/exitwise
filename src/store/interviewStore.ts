import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InterviewExchange, SessionFocus } from '../types';

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
  currentQuestionIndex: number;
}

interface InterviewActions {
  setSession: (id: string, focus: SessionFocus) => void;
  addExchange: (exchange: InterviewExchange) => void;
  setStreamingText: (text: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setCurrentQuestion: (question: string, type: string) => void;
  pushQuestionHistory: (question: string, type: string) => void;
  clearQuestionHistory: () => void;
  goBackQuestion: () => void;
  setCurrentQuestionIndex: (index: number) => void;
  setDraftResponse: (response: string) => void;
  reset: () => void;
}

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
      currentQuestionIndex: 0,
      setSession: (id, focus) => set({ sessionId: id, sessionFocus: focus }),
      addExchange: (exchange) => set((state) => ({ exchanges: [...state.exchanges, exchange] })),
      setStreamingText: (text) => set({ streamingText: text }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setCurrentQuestion: (question, type) => set({ currentQuestion: question, currentQuestionType: type }),
      setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
      pushQuestionHistory: (question, type) =>
        set((state) => ({
          questionHistory: [...state.questionHistory, { question, type }].slice(-8),
        })),
      clearQuestionHistory: () => set({ questionHistory: [], currentQuestionIndex: 0 }),
      goBackQuestion: () =>
        set((state) => {
          if (state.questionHistory.length === 0) return state;

          const nextHistory = [...state.questionHistory];
          const previous = nextHistory.pop();

          if (!previous) return state;

          return {
            currentQuestion: previous.question,
            currentQuestionType: previous.type,
            streamingText: '',
            isStreaming: false,
            questionHistory: nextHistory,
            currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
          };
        }),
      setDraftResponse: (draftResponse) => set({ draftResponse }),
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
        currentQuestionIndex: 0,
      }),
    }),
    {
      name: 'exitwise-interview',
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionFocus: state.sessionFocus,
        exchanges: state.exchanges,
        streamingText: state.streamingText,
        currentQuestion: state.currentQuestion,
        currentQuestionType: state.currentQuestionType,
        draftResponse: state.draftResponse,
        questionHistory: state.questionHistory,
        currentQuestionIndex: state.currentQuestionIndex,
      }),
    }
  )
);
