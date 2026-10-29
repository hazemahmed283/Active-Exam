# FortiOS 7.6 Administrator — Randomized Practice Exam

100 questions taken from `FortiOS_Dump.pdf`, original wording, answer key and exhibits preserved. New random question and option order every attempt; exact-match grading; full review.

## Quick start (no install)
Open `standalone/index.html` in a modern browser (Chrome, Edge, Firefox, Safari). Works offline.

## Development
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # strict type-check + production build in dist/
npm run validate       # data + logic checks
npm run build:standalone   # regenerate standalone/
# optional browser test:
npm i -D playwright && npx playwright install chromium
npm run build:standalone && node scripts/e2e.mjs
```

## How it works
- `src/data/questions.json` — questions, options, answer key (original PDF letters), exhibits, source flags. `public/images/` — exhibits.
- `src/lib/exam.ts` — seeded shuffle of questions and options; an attempt stores only order (question numbers, option ids).
- `src/lib/grading.ts` — exact set match on option ids, so grading is independent of what was displayed. No partial credit; unanswered = incorrect.
- Progress is saved in `localStorage`; the timer (default 120 min, configurable, or off) auto-submits at zero.
- Answers, correctness and community votes are never shown before submission.

See `docs/VALIDATION_REPORT.md` for extraction results and known issues (#84 missing exhibit, #95 excluded, five questions where PDF votes disagree with its key).
