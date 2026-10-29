// End-to-end test of the built exam (standalone/). Needs: npm i -D playwright && npx playwright install chromium
// Usage: node scripts/e2e.mjs            (builds nothing; run `npm run build:standalone` first)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'standalone');
const shots = resolve(root, 'docs/screenshots');
mkdirSync(shots, { recursive: true });
const bank = JSON.parse(readFileSync(resolve(root, 'src/data/questions.json'), 'utf8'));
const byNum = new Map(bank.map((q) => [q.num, q]));

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = existsSync(p) && statSync(p).isDirectory() ? resolve(p, 'index.html') : p;
  if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

let checks = 0, failures = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('  FAIL:', m); } };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function currentNum(page) {
  const t = await page.locator('.qhead .meta').innerText();
  return Number(t.match(/#(\d+)/)[1]);
}
async function optionTexts(page) {
  return page.locator('.option .option-text').allInnerTexts();
}
/** Picks options by their TEXT using the answer key (so the shuffled letters are irrelevant). */
async function answerWithKey(page, q, mode = 'correct') {
  const texts = await optionTexts(page);
  const keyTexts = q.answer.map((id) => q.options.find((o) => o.id === id).text);
  const wrongTexts = q.options.filter((o) => !q.answer.includes(o.id)).map((o) => o.text);
  let pick;
  if (mode === 'correct') pick = keyTexts;
  else if (mode === 'wrong') pick = q.type === 'single' ? [wrongTexts[0]] : [wrongTexts[0], wrongTexts[1] ?? keyTexts[0]].slice(0, q.chooseCount);
  else if (mode === 'partial') pick = keyTexts.slice(0, Math.max(1, keyTexts.length - 1)); // multi: one short
  else pick = [];
  for (const t of pick) {
    const idx = texts.indexOf(t);
    if (idx < 0) throw new Error(`option text not found on screen: ${t}`);
    await page.locator('.option').nth(idx).click();
  }
}
const nextBtn = (page) => page.getByRole('button', { name: 'Next', exact: true });

async function startExam(page, minutes) {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (minutes != null) await page.getByLabel('Duration in minutes').fill(String(minutes));
  await page.getByRole('button', { name: 'Start exam' }).click();
  await page.waitForSelector('.qcard');
}

// ------------------------------------------------------------------ 1. setup screen
console.log('\n1. Setup screen');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  ok((await page.locator('h1').innerText()) === 'FortiOS 7.6 Administrator — Randomized Practice Exam', 'exam title');
  ok((await page.getByLabel('Duration in minutes').inputValue()) === '120', 'default duration is 120');
  const facts = await page.locator('.facts').innerText();
  ok(/Questions\s*100/.test(facts) && /Multiple answers\s*40/.test(facts), 'facts show 100 questions / 40 multiple');
  await page.getByLabel('Duration in minutes').fill('0');
  ok(await page.getByRole('button', { name: 'Start exam' }).isDisabled(), 'invalid duration disables Start');
  await page.getByLabel('Duration in minutes').fill('120');
  await page.screenshot({ path: resolve(shots, '01-setup.png'), fullPage: true });
  await page.close();
}

// ------------------------------------------------------------------ 2. in-exam behaviour
console.log('\n2. In-exam behaviour');
const firstNums = [];
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (let run = 0; run < 3; run++) {
    await startExam(page);
    const seq = [];
    for (let i = 0; i < 5; i++) { seq.push(await currentNum(page)); await nextBtn(page).click(); }
    firstNums.push(seq.join(','));
  }
  ok(new Set(firstNums).size === 3, `three new exams must start in different orders: ${firstNums.join(' | ')}`);

  await startExam(page);
  ok((await page.locator('.progress').innerText()) === 'Question 1 of 100', 'progress indicator');
  const body = await page.locator('body').innerText();
  ok(!/PDF answer key|Correct Answer|Community votes/i.test(body), 'no answer key text visible during exam');
  ok(/100\s+unanswered/.test(await page.locator('.topbar-stats').innerText().then((t) => t.replace(/\n/g, ' '))), 'unanswered counter starts at 100');
  ok((await page.locator('.clock-value').innerText()).startsWith('1:59:') || (await page.locator('.clock-value').innerText()).startsWith('2:00:'), 'timer shows ~2:00:00');

  // answer Q1, check type controls
  let n = await currentNum(page);
  let q = byNum.get(n);
  const inputType = await page.locator('.option input').first().getAttribute('type');
  ok(inputType === (q.type === 'multiple' ? 'checkbox' : 'radio'), `input type matches question type for #${n}`);
  await answerWithKey(page, q, 'correct');
  ok(!/correct|incorrect|wrong/i.test(await page.locator('.qcard').innerText().then((t) => t.replace(/Choose.*?answers?/gi, ''))), 'selecting does not reveal correctness');
  ok(await page.locator('.port.is-answered').count() === 1, 'navigator marks answered');
  ok((await page.locator('.topbar-stats').innerText()).includes('99'), 'unanswered counter drops to 99');

  // selections persist across navigation
  const selBefore = await page.locator('.option.is-selected .option-text').allInnerTexts();
  await nextBtn(page).click();
  await page.getByRole('button', { name: 'Previous' }).click();
  const selAfter = await page.locator('.option.is-selected .option-text').allInnerTexts();
  ok(JSON.stringify(selBefore) === JSON.stringify(selAfter) && selBefore.length === q.answer.length, 'selection preserved after Next/Previous');

  // change answer
  if (q.type === 'single') {
    const texts = await optionTexts(page);
    await page.locator('.option').nth(texts.findIndex((t) => !selBefore.includes(t))).click();
    ok((await page.locator('.option.is-selected').count()) === 1, 'single-answer changes selection');
  } else {
    await page.locator('.option.is-selected').first().click();
    ok((await page.locator('.option.is-selected').count()) === q.answer.length - 1, 'multi-answer can deselect');
    ok((await page.locator('.qcard').innerText()).includes(`${q.answer.length - 1} of ${q.chooseCount} selected`), 'selection counter');
  }
  // clear answer
  await page.getByRole('button', { name: 'Clear answer' }).click();
  ok((await page.locator('.option.is-selected').count()) === 0 && (await page.locator('.port.is-answered').count()) === 0, 'Clear answer works');

  // flag
  await page.getByRole('button', { name: 'Flag for review' }).click();
  ok((await page.locator('.port.is-flagged').count()) === 1 && (await page.locator('.chip-flag').count()) === 1, 'flag marks navigator and card');
  ok((await page.locator('.port.is-current').getAttribute('aria-label')).includes('flagged'), 'navigator aria-label includes flagged');

  // jump via navigator
  await page.locator('.port').nth(49).click();
  ok((await page.locator('.progress').innerText()) === 'Question 50 of 100', 'navigator jump');
  ok(await page.getByRole('button', { name: 'Previous' }).isEnabled(), 'Previous enabled mid-exam');
  await page.locator('.port').nth(99).click();
  ok(await page.getByRole('button', { name: 'Review and submit' }).isVisible(), 'last question offers Review and submit');
  await page.locator('.port').first().click();
  ok(await page.getByRole('button', { name: 'Previous' }).isDisabled(), 'Previous disabled on first question');

  // submit dialog shows unanswered count, can be cancelled
  await page.getByRole('button', { name: 'Submit exam' }).first().click();
  const dlg = await page.getByRole('dialog').innerText();
  ok(/100 questions are unanswered/.test(dlg) && /1 question flagged/.test(dlg), `submit dialog counts: ${dlg.replace(/\n/g, ' ')}`);
  await page.keyboard.press('Escape');
  ok((await page.getByRole('dialog').count()) === 0, 'Esc closes dialog');
  ok((await page.locator('.progress').innerText()).startsWith('Question 1 of'), 'still in exam after cancel');

  // reload keeps answers
  await page.locator('.option').first().click();
  const keep = await currentNum(page);
  await page.reload();
  await page.waitForSelector('.qcard');
  ok((await currentNum(page)) === keep && (await page.locator('.option.is-selected').count()) >= 1, 'answers survive a page reload');
  await page.close();
}

// ------------------------------------------------------------------ 3. every question renders, every exhibit loads
console.log('\n3. All 100 questions render; exhibits load and match their question');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await startExam(page);
  const seen = new Set();
  let withImg = 0, missingNote = 0;
  for (let i = 0; i < 100; i++) {
    const n = await currentNum(page);
    const q = byNum.get(n);
    ok(!seen.has(n), `question #${n} shown twice in one attempt`);
    seen.add(n);
    const stem = await page.locator('.qbody').innerText();
    ok(q.stem.every((b) => stem.replace(/\s+/g, ' ').includes(b.text.replace(/\s+/g, ' '))), `#${n}: stem text matches dataset`);
    const texts = await optionTexts(page);
    ok(texts.length === q.options.length && [...texts].sort().join('\n') === q.options.map((o) => o.text).sort().join('\n'), `#${n}: option texts match dataset`);
    const imgs = page.locator('.exhibit img');
    const cnt = await imgs.count();
    ok(cnt === q.images.length, `#${n}: ${cnt} images shown, expected ${q.images.length}`);
    for (let k = 0; k < cnt; k++) {
      await imgs.nth(k).scrollIntoViewIfNeeded();
      const info = await imgs.nth(k).evaluate((el) => ({ ok: el.complete && el.naturalWidth > 0, w: el.naturalWidth, h: el.naturalHeight, src: el.getAttribute('src'), shown: el.getBoundingClientRect().width }));
      ok(info.ok, `#${n}: image failed to load`);
      ok(info.src.includes(`images/q${n}-`) && info.w === q.images[k].width && info.h === q.images[k].height, `#${n}: wrong image ${info.src} ${info.w}x${info.h}`);
      ok(info.shown >= Math.min(info.w, 300) * 0.95, `#${n}: exhibit too small (${info.shown}px)`);
    }
    if (cnt) withImg++;
    if (await page.locator('.source-note').count()) missingNote++;
    if (i < 99) await nextBtn(page).click();
  }
  ok(seen.size === 100, '100 distinct questions in one attempt');
  ok(withImg === 49, `49 image questions displayed (got ${withImg})`);
  ok(missingNote === 1, 'exactly one question carries the missing-exhibit source note during the exam');
  await page.close();
}

// ------------------------------------------------------------------ 4. a scripted attempt, grading, results, review
console.log('\n4. Scripted attempt → grading → results → review');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await startExam(page);
  const plan = []; // mode per position
  const expected = { correct: 0, incorrect: 0, unanswered: 0 };
  const wrongNums = [];
  let sawImageQuestion = false;
  for (let i = 0; i < 100; i++) {
    const n = await currentNum(page);
    const q = byNum.get(n);
    let mode;
    if (i % 10 === 3) mode = 'none';
    else if (i % 10 === 6) mode = 'wrong';
    else if (i % 10 === 8 && q.type === 'multiple') mode = 'partial';
    else if (i % 10 === 9 && q.type === 'multiple') mode = 'extra';
    else mode = 'correct';
    if (mode === 'extra') {
      await answerWithKey(page, q, 'correct');
      const texts = await optionTexts(page);
      const extraText = q.options.find((o) => !q.answer.includes(o.id)).text;
      await page.locator('.option').nth(texts.indexOf(extraText)).click();
      mode = 'wrong';
    } else await answerWithKey(page, q, mode === 'none' ? 'none' : mode);
    if (q.images.length) sawImageQuestion = true;
    plan.push(mode);
    if (mode === 'correct') expected.correct++;
    else if (mode === 'none') expected.unanswered++;
    else { expected.incorrect++; wrongNums.push(n); }
    if (i < 99) await nextBtn(page).click();
  }
  ok(sawImageQuestion, 'attempt contained exhibits');
  await page.screenshot({ path: resolve(shots, '02-exam-last.png') });
  await page.getByRole('button', { name: 'Review and submit' }).click();
  const dlg = (await page.getByRole('dialog').innerText()).replace(/\n/g, ' ');
  ok(new RegExp(`${expected.unanswered} questions are unanswered`).test(dlg), `dialog unanswered count (${dlg})`);
  await page.getByRole('dialog').getByRole('button', { name: 'Submit exam' }).click();
  await page.waitForSelector('.score');

  const scoreText = (await page.locator('.score').innerText()).replace(/\s+/g, ' ');
  ok(scoreText.startsWith(`${expected.correct} / 100`), `score ${scoreText} vs expected ${expected.correct}`);
  const pct = await page.locator('.score-pct').innerText();
  ok(pct === `${expected.correct}%`, `percent ${pct}`);
  const tally = (await page.locator('.tally').innerText()).replace(/\s+/g, ' ');
  ok(tally.includes(`Correct ${expected.correct}`) && tally.includes(`Incorrect ${expected.incorrect}`) && tally.includes(`Unanswered ${expected.unanswered}`), `tally ${tally}`);
  console.log(`  score ${scoreText}, ${tally}`);
  await page.screenshot({ path: resolve(shots, '03-results.png'), fullPage: true });

  // review: incorrect + unanswered only
  await page.getByRole('button', { name: /Review incorrect and unanswered/ }).click();
  await page.waitForSelector('.rcard');
  const cards = await page.locator('.rcard').count();
  ok(cards === expected.incorrect + expected.unanswered, `review shows ${cards} cards`);
  ok((await page.locator('.rcard-correct').count()) === 0, 'wrong-only review excludes correct questions');
  // every card: key tags present, own selection tags for answered ones, PDF number, explanation limits
  const first = page.locator('.rcard').first();
  ok((await first.locator('.tag-key').count()) >= 1, 'key tag present');
  ok((await first.innerText()).includes('Original PDF question #'), 'PDF number shown');
  ok((await first.innerText()).includes('The PDF contains no written rationale'), 'explanation limited by source');
  ok((await page.locator('.rcard').first().evaluate((el) => !!el.querySelector('.why'))), 'mismatch explanation present');
  // option order in review must equal the order used in the exam: option texts per card equal to attempt (verified via data)
  for (let c = 0; c < Math.min(cards, 6); c++) {
    const card = page.locator('.rcard').nth(c);
    const n = Number((await card.locator('.rhead .meta').innerText()).match(/#(\d+)/)[1]);
    const q = byNum.get(n);
    const keyTexts = (await card.locator('.ropt.is-key .option-text').allInnerTexts()).sort();
    const want = q.answer.map((id) => q.options.find((o) => o.id === id).text).sort();
    ok(JSON.stringify(keyTexts) === JSON.stringify(want), `review #${n}: highlighted key options match PDF key`);
  }
  await page.screenshot({ path: resolve(shots, '04-review-wrong.png') });
  // all questions: wrong first, then correct section
  await page.getByRole('button', { name: /All questions/ }).click();
  await page.waitForSelector('#right-h');
  const order = await page.locator('.rcard').evaluateAll((els) => els.map((e) => e.className.includes('rcard-correct')));
  const firstCorrect = order.indexOf(true);
  ok(firstCorrect === expected.incorrect + expected.unanswered && order.slice(firstCorrect).every(Boolean) && order.length === 100, 'all-review lists incorrect/unanswered first, then correct');
  // vote-differs notes show only in review
  const votesDiffer = await page.locator('.source-note', { hasText: 'community vote list' }).count();
  console.log(`  vote-disagreement notes visible in review: ${votesDiffer}`);
  await page.close();
}

// ------------------------------------------------------------------ 5. timer expiry auto-submits
console.log('\n5. Timer expiry');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Duration in minutes').fill('1');
  await page.getByRole('button', { name: 'Start exam' }).click();
  await page.waitForSelector('.qcard');
  const n = await currentNum(page);
  await answerWithKey(page, byNum.get(n), 'correct');
  await page.clock.fastForward(30_000);
  ok((await page.locator('.clock-value').innerText()) === '00:30' || (await page.locator('.clock-value').innerText()) === '00:29', 'clock counts down');
  ok((await page.locator('.clock-low').count()) === 1, 'low-time styling under 5 minutes');
  await page.clock.fastForward(31_000);
  await page.waitForSelector('.score', { timeout: 5000 });
  ok((await page.locator('.notice-warn').innerText()).includes('Time ran out'), 'timeout notice');
  const s = (await page.locator('.score').innerText()).replace(/\s+/g, ' ');
  ok(s.startsWith('1 / 100'), `auto-submitted score ${s}`);
  // refresh after submit still shows results; new exam clears
  await page.reload();
  await page.waitForSelector('.score');
  await page.getByRole('button', { name: 'Start a new randomized exam' }).click();
  ok((await page.locator('h1').innerText()).includes('Randomized Practice Exam'), 'new exam returns to setup');
  // no-timer exam hides the clock
  await page.getByLabel('No time limit').check();
  await page.getByRole('button', { name: 'Start exam' }).click();
  await page.waitForSelector('.qcard');
  ok((await page.locator('.clock').count()) === 0, 'untimed exam has no clock');
  await ctx.close();
}

// ------------------------------------------------------------------ 6. image error handling + mobile + missing exhibit
console.log('\n6. Image load error, mobile layout, source issue note');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/images/q*.png', (r) => r.abort());
  await startExam(page);
  // find an image question
  let guard = 0;
  while ((await page.locator('.exhibit').count()) === 0 && guard++ < 100) await nextBtn(page).click();
  await page.waitForSelector('.exhibit-error');
  ok((await page.locator('.exhibit-error').innerText()).includes('could not be loaded'), 'broken exhibit shows a clear error');
  ok((await page.locator('.exhibit-error button').count()) === 1, 'retry button offered');
  await page.unroute('**/images/q*.png');
  await page.locator('.exhibit-error button').first().click();
  await page.waitForSelector('.exhibit img');
  await page.waitForFunction(() => { const i = document.querySelector('.exhibit img'); return i && i.complete && i.naturalWidth > 0; });
  ok(true, 'retry restores the exhibit');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!overflow, 'no horizontal page overflow on a 390px phone');
  await page.getByRole('button', { name: 'Question map' }).click();
  ok(await page.locator('.map-col.is-open').isVisible(), 'question map opens on mobile');
  await page.screenshot({ path: resolve(shots, '05-mobile-map.png') });
  await page.locator('.port').nth(10).click();
  ok((await page.locator('.progress').innerText()) === 'Question 11 of 100', 'mobile navigator jump closes the map');
  await ctx.close();

  // desktop: exam screenshot with an exhibit, and the missing-exhibit question
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await startExam(page2);
  let g = 0;
  while (!(await page2.locator('.exhibit').count()) && g++ < 100) await nextBtn(page2).click();
  await page2.screenshot({ path: resolve(shots, '06-exam-exhibit.png') });
  // open lightbox
  await page2.locator('.exhibit-button').first().click();
  ok(await page2.locator('.lightbox img').isVisible(), 'lightbox opens');
  await page2.keyboard.press('Escape').catch(() => {});
  await page2.getByRole('button', { name: 'Close' }).click();
  // locate #84 via navigator scan
  let found = false;
  for (let i = 0; i < 100 && !found; i++) {
    await page2.locator('.port').nth(i).click();
    if ((await currentNum(page2)) === 84) found = true;
  }
  ok(found, 'found question #84');
  ok((await page2.locator('.source-note').innerText()).includes('no exhibit image'), '#84 shows the missing-exhibit source issue');
  await page2.close();
}

await browser.close();
server.close();
console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
