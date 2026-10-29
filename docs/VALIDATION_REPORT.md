# Validation report — FortiOS 7.6 Administrator practice exam

Source: `FortiOS_Dump.pdf` (195 pages, 101 questions, answers printed as "Correct Answer: X").

| Item | Result |
|---|---|
| Questions in PDF | 101 |
| Questions in exam | **100**, all distinct |
| Left out | #95 — drag-and-drop ordering question (not representable as single/multiple choice without changing it or leaking the key) |
| Single / multiple answer | 60 / 40 |
| Options per question | 94 × four, 6 × five |
| Questions with exhibits | 49 (all load, correct file, correct dimensions) |
| Answer key | Matches PDF; cross-checked with a second, independent extractor — 0 mismatches |
| Question/option text | Verbatim from PDF (line-wrap hyphens rejoined, e.g. `load-balance-mode`); 4 option strings in #84 differ only because the second extractor drops "→" |

## Automated tests
- `npm run validate` — 31,331 checks, 0 failures (data integrity, 300 random attempts, grading independent of display order, reducer, timer maths).
- `node scripts/e2e.mjs` — 609 browser checks, 0 failures (all 100 questions and exhibits rendered, scripted scoring, review order, timer expiry, reload persistence, image-error retry, 390px mobile).
- Only a loose type-check was possible offline (no `@types/react`); `npm run build` performs the strict check.

## Unresolved / flagged
- **#84** says "Refer to the exhibit" but the PDF has no image for it. Shown as printed with a visible source-issue note.
- **#19, #46, #71, #74, #75** — the PDF's community vote lists rank a different answer first than its "Correct Answer". The exam grades against the PDF key; the review shows a note.
- The PDF has no written explanations; the review states this and only compares your selection with the key.
- Exhibits contain the PDF's baked-in "Brave-Dumps.com" watermark (originals preserved).
- Extraction scripts in `scripts/extraction/` are reference copies that use `/tmp` paths; the shipped `questions.json` is the verified output.
