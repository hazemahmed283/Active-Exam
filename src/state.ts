import type { Attempt } from './types';

export type Action =
  | { type: 'start'; attempt: Attempt }
  | { type: 'select'; num: number; optionId: string; multiple: boolean }
  | { type: 'clear'; num: number }
  | { type: 'flag'; num: number }
  | { type: 'goto'; index: number }
  | { type: 'submit'; reason: 'manual' | 'timeout'; now: number }
  | { type: 'discard' };

export function attemptReducer(state: Attempt | null, action: Action): Attempt | null {
  switch (action.type) {
    case 'start':
      return action.attempt;
    case 'discard':
      return null;
    default:
  }
  if (!state) return state;
  // Once submitted, answers are frozen.
  if (state.status === 'submitted') return state;

  switch (action.type) {
    case 'select': {
      const current = state.answers[action.num] ?? [];
      let next: string[];
      if (action.multiple) {
        next = current.includes(action.optionId)
          ? current.filter((id) => id !== action.optionId)
          : [...current, action.optionId];
      } else {
        next = [action.optionId];
      }
      return { ...state, answers: { ...state.answers, [action.num]: next } };
    }
    case 'clear': {
      const answers = { ...state.answers };
      delete answers[action.num];
      return { ...state, answers };
    }
    case 'flag': {
      const flagged = state.flagged.includes(action.num)
        ? state.flagged.filter((n) => n !== action.num)
        : [...state.flagged, action.num];
      return { ...state, flagged };
    }
    case 'goto': {
      const index = Math.min(Math.max(0, action.index), state.items.length - 1);
      return { ...state, current: index };
    }
    case 'submit':
      return { ...state, status: 'submitted', submittedAt: action.now, submitReason: action.reason };
    default:
      return state;
  }
}
