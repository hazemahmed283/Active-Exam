import { useMemo, useState } from 'react';
import type { Attempt, Question } from '../types';
import type { BankIssue } from '../lib/validate';
import { buildAttempt, DEFAULT_DURATION_MIN, EXAM_SIZE } from '../lib/exam';
import { newSeed } from '../lib/random';
import { loadAttempt } from '../lib/storage';

interface Props {
  bank: Question[];
  bankIssues: BankIssue[];
  excluded: { num: number; reason: string }[];
  onStart: (attempt: Attempt) => void;
}

export default function SetupScreen({ bank, bankIssues, excluded, onStart }: Props) {
  const [minutes, setMinutes] = useState(String(DEFAULT_DURATION_MIN));
  const [untimed, setUntimed] = useState(false);

  const count = Math.min(EXAM_SIZE, bank.length);
  const multi = useMemo(() => bank.filter((q) => q.type === 'multiple').length, [bank]);
  const withExhibits = useMemo(() => bank.filter((q) => q.images.length > 0).length, [bank]);
  const parsed = Number(minutes);
  const minutesValid = untimed || (Number.isFinite(parsed) && parsed >= 1 && parsed <= 600);

  const start = () => {
    if (!minutesValid || count === 0) return;
    onStart(buildAttempt(bank, { seed: newSeed(), count, durationMin: untimed ? null : Math.round(parsed) }));
  };

  // A saved, already-submitted attempt is handled by App; setup only appears when nothing is active.
  const hadSaved = loadAttempt() !== null;

  return (
    <main className="shell setup">
      <header className="setup-head">
        <h1>FortiOS 7.6 Administrator — Randomized Practice Exam</h1>
        <p className="lede">
          {count} questions from the supplied PDF, in a new random order every time, with the answer options shuffled too.
        </p>
      </header>

      <section className="panel" aria-labelledby="facts">
        <h2 id="facts">This exam</h2>
        <dl className="facts">
          <div>
            <dt>Questions</dt>
            <dd>{count}</dd>
          </div>
          <div>
            <dt>Single answer</dt>
            <dd>{count - multi}</dd>
          </div>
          <div>
            <dt>Multiple answers</dt>
            <dd>{multi}</dd>
          </div>
          <div>
            <dt>With exhibits</dt>
            <dd>{withExhibits}</dd>
          </div>
        </dl>
        {count < EXAM_SIZE && (
          <p className="notice notice-warn" role="alert">
            Only {count} usable questions could be loaded, so this exam has {count} questions instead of {EXAM_SIZE}.
          </p>
        )}
        {bankIssues.length > 0 && (
          <details className="notice notice-warn">
            <summary>{bankIssues.length} data problem(s) found — affected questions were left out</summary>
            <ul>
              {bankIssues.map((b, i) => (
                <li key={i}>
                  Question #{b.num}: {b.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="panel" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ul className="plain">
          <li>
            <strong>Single-answer</strong> questions use round buttons: pick exactly one option.
          </li>
          <li>
            <strong>Multiple-answer</strong> questions use square boxes: pick every option that applies. The answer counts
            only if your selection matches the answer key exactly — a missing or extra option makes it incorrect.
          </li>
          <li>Nothing is marked right or wrong until you submit. You can change answers, flag questions, and jump around freely.</li>
          <li>Unanswered questions score zero. Your progress is saved in this browser if the page reloads.</li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="timer">
        <h2 id="timer">Timer</h2>
        <div className="timer-setup">
          <label className="field">
            <span>Duration in minutes</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={minutes}
              disabled={untimed}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={!minutesValid}
              aria-describedby="minutes-help"
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} />
            <span>No time limit</span>
          </label>
        </div>
        <p id="minutes-help" className={minutesValid ? 'help' : 'help help-error'}>
          {minutesValid
            ? untimed
              ? 'The exam will not be timed.'
              : `The exam is submitted automatically when ${Math.round(parsed)} minute${Math.round(parsed) === 1 ? '' : 's'} run out.`
            : 'Enter a whole number of minutes from 1 to 600.'}
        </p>
      </section>

      <div className="setup-actions">
        <button type="button" className="btn btn-primary btn-large" onClick={start} disabled={!minutesValid || count === 0}>
          Start exam
        </button>
        {hadSaved && <span className="help">A previous attempt is stored in this browser; starting replaces it.</span>}
      </div>

      {excluded.length > 0 && (
        <details className="source-details">
          <summary>About the source PDF</summary>
          <p>
            The PDF contains {bank.length + excluded.length} questions. Exactly {EXAM_SIZE} are used.
          </p>
          <ul>
            {excluded.map((e) => (
              <li key={e.num}>
                <strong>Left out — original question #{e.num}:</strong> {e.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
