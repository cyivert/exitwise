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
