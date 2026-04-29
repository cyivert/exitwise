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
}

interface InterviewActions {
  setSession: (id: string, focus: SessionFocus) => void;
  addExchange: (exchange: InterviewExchange) => void;
  setStreamingText: (text: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setCurrentQuestion: (question: string, type: string) => void;
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
      setSession: (id, focus) => set({ sessionId: id, sessionFocus: focus }),
      addExchange: (exchange) => set((state) => ({ exchanges: [...state.exchanges, exchange] })),
      setStreamingText: (text) => set({ streamingText: text }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setCurrentQuestion: (question, type) => set({ currentQuestion: question, currentQuestionType: type }),
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
      }),
    }
  )
);
