import type { Attempt, Question } from '../types';
import { mulberry32, shuffle } from './random';

export const EXAM_SIZE = 100;
export const DEFAULT_DURATION_MIN = 120;

export interface BuildOptions {
  seed: number;
  /** How many questions to draw from the bank (capped at the bank size). */
  count?: number;
  /** Minutes allowed; null disables the timer. */
  durationMin: number | null;
  now?: number;
}

/**
 * Builds a randomized attempt. The question text, images, options and answer key stay together in the
 * bank; the attempt only stores *order* (question numbers and option ids), so grading never depends
 * on what the user saw.
 */
export function buildAttempt(bank: readonly Question[], opts: BuildOptions): Attempt {
  const now = opts.now ?? Date.now();
  const rand = mulberry32(opts.seed);
  const count = Math.min(opts.count ?? EXAM_SIZE, bank.length);
  const picked = shuffle(bank, rand).slice(0, count);
  const items = picked.map((q) => ({ num: q.num, optionOrder: shuffle(q.options.map((o) => o.id), rand) }));

  const nums = items.map((i) => i.num);
  if (new Set(nums).size !== nums.length) throw new Error('Duplicate question in attempt');

  const durationSec = opts.durationMin && opts.durationMin > 0 ? Math.round(opts.durationMin * 60) : null;
  return {
    version: 1,
    seed: opts.seed,
    startedAt: now,
    durationSec,
    endsAt: durationSec ? now + durationSec * 1000 : null,
    items,
    answers: {},
    flagged: [],
    current: 0,
    status: 'in-progress',
  };
}

export function isAnswered(attempt: Attempt, num: number): boolean {
  return (attempt.answers[num]?.length ?? 0) > 0;
}

export function countAnswered(attempt: Attempt): number {
  return attempt.items.filter((i) => isAnswered(attempt, i.num)).length;
}

/** Remaining whole seconds, or null if untimed. Never negative. */
export function remainingSeconds(attempt: Attempt, now: number = Date.now()): number | null {
  if (attempt.endsAt == null) return null;
  return Math.max(0, Math.ceil((attempt.endsAt - now) / 1000));
}
