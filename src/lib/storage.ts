import type { Attempt } from '../types';

const KEY = 'fortios76-practice-exam:attempt:v1';

function looksLikeAttempt(x: unknown): x is Attempt {
  const a = x as Attempt;
  return (
    !!a &&
    a.version === 1 &&
    Array.isArray(a.items) &&
    a.items.every((i) => typeof i.num === 'number' && Array.isArray(i.optionOrder)) &&
    typeof a.answers === 'object' &&
    Array.isArray(a.flagged) &&
    typeof a.current === 'number' &&
    (a.status === 'in-progress' || a.status === 'submitted')
  );
}

export function loadAttempt(): Attempt | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksLikeAttempt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAttempt(attempt: Attempt): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(attempt));
  } catch {
    /* storage may be unavailable (private mode / quota); the exam keeps working in memory */
  }
}

export function clearAttempt(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
