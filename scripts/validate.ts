/* Data-integrity and logic checks. Run with: npm run validate */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Question } from '../src/types';
import { buildAttempt, remainingSeconds, EXAM_SIZE } from '../src/lib/exam';
import { gradeAttempt, isCorrect } from '../src/lib/grading';
import { checkQuestion, sanitizeBank } from '../src/lib/validate';
import { attemptReducer } from '../src/state';
import { mulberry32, shuffle } from '../src/lib/random';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bank: Question[] = JSON.parse(readFileSync(resolve(root, 'src/data/questions.json'), 'utf8'));
let failures = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error('  FAIL:', msg);
  }
}
function section(name: string) {
  console.log(`\n${name}`);
}

section('1. Question bank');
ok(bank.length === EXAM_SIZE, `bank has ${bank.length} questions, expected ${EXAM_SIZE}`);
ok(new Set(bank.map((q) => q.num)).size === bank.length, 'duplicate original question numbers');
ok(new Set(bank.map((q) => q.stem.map((b) => b.text).join('|') + q.options.map((o) => o.text).join('|'))).size === bank.length, 'duplicate question content');
for (const q of bank) {
  const problems = checkQuestion(q);
  ok(problems.length === 0, `#${q.num}: ${problems.join('; ')}`);
  ok(q.options.length === 4 || q.options.length === 5, `#${q.num}: unexpected option count ${q.options.length}`);
  const ids = q.options.map((o) => o.id).join('');
  ok(ids === 'ABCDE'.slice(0, q.options.length), `#${q.num}: option ids not sequential (${ids})`);
  const stem = q.stem.map((b) => b.text).join(' ');
  const m = stem.match(/\(Choose (one|two|three|four|five)/);
  const want = m ? { one: 1, two: 2, three: 3, four: 4, five: 5 }[m[1] as 'one'] : null;
  ok(want === q.answer.length, `#${q.num}: instruction says ${want}, key has ${q.answer.length}`);
  ok(q.type === (q.answer.length > 1 ? 'multiple' : 'single'), `#${q.num}: type/key mismatch`);
}
const withImg = bank.filter((q) => q.images.length > 0);
console.log(`  ${bank.length} questions · ${bank.filter((q) => q.type === 'multiple').length} multiple-answer · ${withImg.length} with exhibits`);

section('2. Images');
for (const q of withImg) {
  for (const img of q.images) {
    const p = resolve(root, 'public', img.src);
    ok(existsSync(p), `#${q.num}: missing ${img.src}`);
    if (existsSync(p)) {
      const buf = readFileSync(p);
      const isPng = buf.subarray(1, 4).toString() === 'PNG';
      ok(isPng, `#${q.num}: ${img.src} is not a PNG`);
      ok(isPng && buf.readUInt32BE(16) === img.width && buf.readUInt32BE(20) === img.height, `#${q.num}: ${img.src} dimensions differ from data`);
      ok(img.src.startsWith(`images/q${q.num}-`), `#${q.num}: image ${img.src} filed under another question`);
    }
  }
}
const exhibitWord = bank.filter((q) => /exhibit/i.test(q.stem.map((b) => b.text).join(' ')));
const missing = exhibitWord.filter((q) => q.images.length === 0).map((q) => q.num);
console.log(`  questions mentioning an exhibit but lacking an image in the PDF: ${missing.join(', ') || 'none'}`);
ok(missing.every((n) => bank.find((q) => q.num === n)!.flags.some((f) => f.code === 'missing-exhibit')), 'missing exhibit not flagged');

section('3. Randomization');
const a1 = buildAttempt(bank, { seed: 12345, durationMin: 120, now: 0 });
const a2 = buildAttempt(bank, { seed: 12345, durationMin: 120, now: 0 });
const a3 = buildAttempt(bank, { seed: 54321, durationMin: 120, now: 0 });
ok(JSON.stringify(a1.items) === JSON.stringify(a2.items), 'same seed must reproduce the same attempt');
ok(JSON.stringify(a1.items) !== JSON.stringify(a3.items), 'different seeds must differ');
const sameOrder = (x: typeof a1, y: typeof a1) => x.items.every((it, i) => it.num === y.items[i].num);
ok(!sameOrder(a1, a3), 'question order identical for different seeds');
let orderDiffs = 0;
const posCounts: Record<number, number> = {};
let correctAtA = 0;
let singleTotal = 0;
for (let seed = 1; seed <= 300; seed++) {
  const a = buildAttempt(bank, { seed, durationMin: null, now: 0 });
  ok(a.items.length === 100, `seed ${seed}: ${a.items.length} items`);
  ok(new Set(a.items.map((i) => i.num)).size === 100, `seed ${seed}: duplicate question in attempt`);
  for (const it of a.items) {
    const q = bank.find((x) => x.num === it.num)!;
    ok([...it.optionOrder].sort().join('') === q.options.map((o) => o.id).sort().join(''), `seed ${seed} #${it.num}: option order is not a permutation`);
    if (q.type === 'single') {
      singleTotal++;
      if (it.optionOrder[0] === q.answer[0]) correctAtA++;
      const pos = it.optionOrder.indexOf(q.answer[0]);
      posCounts[pos] = (posCounts[pos] ?? 0) + 1;
    }
  }
  if (!sameOrder(a, a1)) orderDiffs++;
}
ok(orderDiffs >= 299, 'attempts should almost always have a different question order');
const share = correctAtA / singleTotal;
console.log(`  single-answer key shown first in ${(share * 100).toFixed(1)}% of cases (uniform ≈ 22–25%)`);
ok(share > 0.18 && share < 0.3, 'answer position looks biased');
console.log('  correct-answer position histogram:', JSON.stringify(posCounts));
// Options are shuffled independently of questions: the same question gets different orders across seeds.
const q0 = bank[0].num;
const orders = new Set<string>();
for (let seed = 1; seed <= 50; seed++) orders.add(buildAttempt(bank, { seed, durationMin: null }).items.find((i) => i.num === q0)!.optionOrder.join(''));
ok(orders.size > 5, 'option order barely varies across seeds');
// Shuffle is a uniform permutation (chi-square-ish sanity check on 3 elements).
const rnd = mulberry32(7);
const perms: Record<string, number> = {};
for (let i = 0; i < 60000; i++) {
  const k = shuffle(['a', 'b', 'c'], rnd).join('');
  perms[k] = (perms[k] ?? 0) + 1;
}
ok(Object.values(perms).every((c) => Math.abs(c - 10000) < 500), 'shuffle is not uniform');

section('4. Grading (independent of display order)');
const byNum = new Map(bank.map((q) => [q.num, q] as const));
for (const seed of [1, 2, 3, 99, 2024]) {
  const a = buildAttempt(bank, { seed, durationMin: null });
  // A "user" who reads option TEXT and picks the key options: letters shown must not matter.
  for (const it of a.items) {
    const q = byNum.get(it.num)!;
    const keyTexts = new Set(q.answer.map((id) => q.options.find((o) => o.id === id)!.text));
    a.answers[it.num] = it.optionOrder.filter((id) => keyTexts.has(q.options.find((o) => o.id === id)!.text));
  }
  const r = gradeAttempt(bank, a);
  ok(r.correct === 100 && r.incorrect === 0 && r.unanswered === 0 && r.percent === 100, `seed ${seed}: perfect run scored ${r.correct}`);
}
{
  const a = buildAttempt(bank, { seed: 77, durationMin: null });
  const expected = { correct: 0, incorrect: 0, unanswered: 0 };
  a.items.forEach((it, i) => {
    const q = byNum.get(it.num)!;
    const wrong = q.options.map((o) => o.id).filter((id) => !q.answer.includes(id));
    switch (i % 6) {
      case 0: a.answers[it.num] = [...q.answer]; expected.correct++; break; // exact
      case 1: a.answers[it.num] = [...q.answer].reverse(); expected.correct++; break; // order irrelevant
      case 2: // missing one of the key (multi) or a wrong option (single)
        a.answers[it.num] = q.type === 'multiple' ? q.answer.slice(1) : [wrong[0]];
        expected.incorrect++; break;
      case 3: // key plus one extra wrong option
        a.answers[it.num] = [...q.answer, wrong[0]]; expected.incorrect++; break;
      case 4: expected.unanswered++; break; // no entry at all
      default: a.answers[it.num] = []; expected.unanswered++; // cleared answer
    }
  });
  const r = gradeAttempt(bank, a);
  ok(r.correct === expected.correct && r.incorrect === expected.incorrect && r.unanswered === expected.unanswered, `mixed run: got ${JSON.stringify({ c: r.correct, i: r.incorrect, u: r.unanswered })}, expected ${JSON.stringify(expected)}`);
  ok(r.correct + r.incorrect + r.unanswered === 100, 'counts must sum to 100');
  ok(r.percent === Math.round((expected.correct / 100) * 1000) / 10, 'percent mismatch');
  console.log(`  mixed run → ${r.correct}/100 (${r.percent}%), ${r.incorrect} incorrect, ${r.unanswered} unanswered`);
}
const multi = bank.find((q) => q.type === 'multiple')!;
ok(isCorrect(multi, multi.answer), 'full key should be correct');
ok(!isCorrect(multi, multi.answer.slice(1)), 'partial multi must be incorrect');
ok(!isCorrect(multi, [...multi.answer, multi.options.find((o) => !multi.answer.includes(o.id))!.id]), 'extra option must be incorrect');
ok(!isCorrect(multi, []), 'empty must be incorrect');
const single = bank.find((q) => q.type === 'single')!;
ok(isCorrect(single, single.answer) && !isCorrect(single, [single.options.find((o) => !single.answer.includes(o.id))!.id]), 'single grading');
ok(!isCorrect(single, [...single.answer, single.options.find((o) => !single.answer.includes(o.id))!.id]), 'single with two selections must be incorrect');

section('5. State reducer and timer');
{
  let s: ReturnType<typeof attemptReducer> = buildAttempt(bank, { seed: 5, durationMin: 1, now: 1_000 });
  const n = s!.items[0].num;
  s = attemptReducer(s, { type: 'select', num: n, optionId: 'A', multiple: false });
  s = attemptReducer(s, { type: 'select', num: n, optionId: 'B', multiple: false });
  ok(s!.answers[n].join() === 'B', 'single select replaces');
  s = attemptReducer(s, { type: 'select', num: n, optionId: 'A', multiple: true });
  s = attemptReducer(s, { type: 'select', num: n, optionId: 'C', multiple: true });
  ok(s!.answers[n].join() === 'B,A,C', 'multi select appends');
  s = attemptReducer(s, { type: 'select', num: n, optionId: 'A', multiple: true });
  ok(s!.answers[n].join() === 'B,C', 'multi select toggles off');
  s = attemptReducer(s, { type: 'clear', num: n });
  ok(!(n in s!.answers), 'clear removes answer');
  s = attemptReducer(s, { type: 'flag', num: n });
  ok(s!.flagged.includes(n), 'flag');
  s = attemptReducer(s, { type: 'goto', index: 999 });
  ok(s!.current === 99, 'goto clamps high');
  s = attemptReducer(s, { type: 'goto', index: -4 });
  ok(s!.current === 0, 'goto clamps low');
  ok(remainingSeconds(s!, 1_000) === 60 && remainingSeconds(s!, 31_000) === 30 && remainingSeconds(s!, 61_000) === 0 && remainingSeconds(s!, 999_999) === 0, 'timer arithmetic');
  s = attemptReducer(s, { type: 'submit', reason: 'timeout', now: 61_000 });
  const frozen = attemptReducer(s, { type: 'select', num: n, optionId: 'A', multiple: false });
  ok(frozen === s && s!.status === 'submitted' && s!.submitReason === 'timeout', 'submitted attempt is frozen');
}
{
  const broken = JSON.parse(JSON.stringify(bank)) as Question[];
  broken[0].answer = ['Z'];
  broken[1].options = broken[1].options.slice(0, 1);
  broken.push({ ...bank[2] });
  const { usable, issues } = sanitizeBank(broken);
  ok(usable.length === 98 && issues.length >= 3, `sanitizeBank should drop broken/duplicate questions (kept ${usable.length})`);
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
