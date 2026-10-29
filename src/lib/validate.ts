import type { Question } from '../types';

export interface BankIssue {
  num: number | null;
  message: string;
}

/** Structural checks on question data. Returns issues; an empty list means the question is usable. */
export function checkQuestion(q: Question): string[] {
  const issues: string[] = [];
  const ids = q.options.map((o) => o.id);
  if (q.options.length < 2) issues.push('fewer than two answer options');
  if (new Set(ids).size !== ids.length) issues.push('duplicate option ids');
  if (q.options.some((o) => !o.text.trim())) issues.push('an option has empty text');
  if (!q.stem.length || q.stem.every((b) => !b.text.trim())) issues.push('empty question text');
  if (!q.answer.length) issues.push('no answer key');
  if (q.answer.some((a) => !ids.includes(a))) issues.push('answer key references a missing option');
  if (new Set(q.answer).size !== q.answer.length) issues.push('duplicate ids in answer key');
  if (q.type === 'single' && q.answer.length !== 1) issues.push('single-answer question with a multi-answer key');
  if (q.type === 'multiple' && q.answer.length < 2) issues.push('multiple-answer question with a single-answer key');
  if (q.answer.length >= q.options.length && q.type === 'multiple' && q.answer.length > q.options.length) {
    issues.push('answer key larger than option list');
  }
  return issues;
}

/** Splits a raw bank into usable questions and reported problems (also catches duplicate numbers). */
export function sanitizeBank(raw: readonly Question[]): { usable: Question[]; issues: BankIssue[] } {
  const usable: Question[] = [];
  const issues: BankIssue[] = [];
  const seen = new Set<number>();
  for (const q of raw) {
    if (seen.has(q.num)) {
      issues.push({ num: q.num, message: 'duplicate question number (skipped)' });
      continue;
    }
    seen.add(q.num);
    const problems = checkQuestion(q);
    if (problems.length) {
      for (const p of problems) issues.push({ num: q.num, message: p });
      continue;
    }
    usable.push(q);
  }
  return { usable, issues };
}
