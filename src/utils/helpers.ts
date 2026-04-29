import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// /caveman: tailwind merge helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.substring(0, length) + '...' : str;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function normalizeInterviewText(text: string) {
  const decoded = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return decoded
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMeaningfulFollowUp(text: string) {
  const normalized = normalizeInterviewText(text);

  if (!normalized) return false;
  if (/^exitwise$/i.test(normalized)) return false;
  if (normalized.length < 24) return false;

  return /\?/.test(normalized) || normalized.split(' ').length >= 5;
}

export function getSessionFallbackQuestion(sessionFocus: string, sessionNumber: number) {
  const prompts: Record<string, string> = {
    orientation: 'What was the first major turn in your career that changed how you make decisions?',
    processes: 'Walk me through the process step by step, including the checks, handoffs, and the part people usually miss.',
    decisions: 'Tell me about a decision with real consequences and explain exactly how you weighed the options.',
    relationships: 'Which relationships mattered most in getting work done, and how did you build or protect that trust?',
    edge_cases: 'What exception, workaround, or failure case breaks the normal process, and how do you spot it early?',
    review: 'If someone had to step in tomorrow, what would you want them to know first to avoid trouble?',
  };

  return `Session ${sessionNumber}: ${prompts[sessionFocus] || prompts.review}`;
}

export function getSessionFollowUpQuestions(sessionFocus: string, sessionNumber: number) {
  const sequences: Record<string, string[]> = {
    orientation: [
      'What was the first major turn in your career that changed how you make decisions?',
      'What did you start doing differently after that turning point?',
      'What advice would you give someone making the same kind of move?',
      'What habits or instincts did that experience sharpen for you?',
      'What do people usually underestimate when they hit that same stage?',
    ],
    processes: [
      'Walk me through the process step by step, including the checks, handoffs, and the part people usually miss.',
      'Which step is most likely to break if someone is rushed or unavailable?',
      'What do you want documented so the next person can run this process without guessing?',
      'What exceptions come up often enough that they should be part of the normal training?',
      'Where do people usually lose time or create errors in this flow?',
    ],
    decisions: [
      'Tell me about a decision with real consequences and explain exactly how you weighed the options.',
      'What information changed your mind or made the choice clear?',
      'What would have happened if you had chosen the other path?',
      'What was the hardest tradeoff in that decision?',
      'What would make that same decision easier for the next person?',
    ],
    relationships: [
      'Which relationships mattered most in getting work done, and how did you build or protect that trust?',
      'What signals told you when a relationship was getting strained or weaker?',
      'What should the next person remember about working with those people?',
      'What do people get wrong when they first work with those relationships?',
      'What keeps those relationships healthy over time?',
    ],
    edge_cases: [
      'What exception, workaround, or failure case breaks the normal process, and how do you spot it early?',
      'What is the first warning that tells you the normal path will not work?',
      'What should someone do the moment they realize they are in the exception case?',
      'What part of the workaround is easy to forget under pressure?',
      'What is the safest way to tell normal from exceptional cases?',
    ],
    review: [
      'If someone had to step in tomorrow, what would you want them to know first to avoid trouble?',
      'What is the most common thing new people miss when they take over?',
      'What would you leave in a handoff note if you only had one page?',
      'What are the first three things you would brief in person?',
      'What would you want repeated back to you to make sure it stuck?',
    ],
  };

  const basePrompts = sequences[sessionFocus] || sequences.review;
  return basePrompts.map((prompt, index) => `Session ${sessionNumber}.${index + 1}: ${prompt}`);
}

export function getQuestionProgression(sessionFocus: string, sessionNumber: number, questionIndex: number) {
  const prompts = getSessionFollowUpQuestions(sessionFocus, sessionNumber);
  if (questionIndex < prompts.length) {
    return prompts[questionIndex];
  }

  const overflowPrompt = questionIndex - prompts.length + 1;
  return `Session ${sessionNumber}.${questionIndex + 1}: Tell me more about the part of this handoff that people usually misunderstand (${overflowPrompt}).`;
}
