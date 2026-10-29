import type { Attempt, GradeReport, Question, QuestionResult } from '../types';

/** Exact answer-set match: no partial credit, extra selections make the answer wrong. */
export function isCorrect(q: Question, selected: readonly string[]): boolean {
  const key = new Set(q.answer);
  const sel = new Set(selected);
  if (key.size !== sel.size) return false;
  for (const id of key) if (!sel.has(id)) return false;
  return true;
}

/** Grades an attempt against the answer key. Depends only on option ids, never on display order. */
export function gradeAttempt(bank: readonly Question[], attempt: Attempt): GradeReport {
  const byNum = new Map(bank.map((q) => [q.num, q] as const));
  const results: QuestionResult[] = attempt.items.map((item) => {
    const q = byNum.get(item.num);
    if (!q) throw new Error(`Question #${item.num} missing from bank`);
    const valid = new Set(q.options.map((o) => o.id));
    const selected = (attempt.answers[item.num] ?? []).filter((id) => valid.has(id));
    const unanswered = selected.length === 0;
    return { num: item.num, selected, unanswered, correct: !unanswered && isCorrect(q, selected) };
  });
  const correct = results.filter((r) => r.correct).length;
  const unanswered = results.filter((r) => r.unanswered).length;
  const total = results.length;
  return {
    total,
    correct,
    unanswered,
    incorrect: total - correct - unanswered,
    percent: total ? Math.round((correct / total) * 1000) / 10 : 0,
    results,
  };
}
