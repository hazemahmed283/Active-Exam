import { useMemo } from 'react';
import type { Attempt, Question, QuestionResult } from '../types';
import { gradeAttempt } from '../lib/grading';
import { letterFor } from '../lib/format';
import QuestionBody from './QuestionBody';

export type ReviewMode = 'wrong' | 'all';

interface Props {
  bank: Question[];
  attempt: Attempt;
  mode: ReviewMode;
  onModeChange: (m: ReviewMode) => void;
  onBack: () => void;
  onNewExam: () => void;
}

function ReviewCard({ q, result, order, position }: { q: Question; result: QuestionResult; order: string[]; position: number }) {
  const byId = new Map(q.options.map((o) => [o.id, o] as const));
  const shown = new Map(order.map((id, i) => [id, letterFor(i)] as const));
  const label = (ids: string[]) =>
    [...ids]
      .sort((a, b) => (shown.get(a) ?? '').localeCompare(shown.get(b) ?? ''))
      .map((id) => `${shown.get(id)}`)
      .join(', ');
  const text = (id: string) => `${shown.get(id)}. ${byId.get(id)?.text ?? ''}`;

  const key = new Set(q.answer);
  const sel = new Set(result.selected);
  const missed = q.answer.filter((id) => !sel.has(id));
  const extra = result.selected.filter((id) => !key.has(id));
  const hit = result.selected.filter((id) => key.has(id));

  const status = result.correct ? 'correct' : result.unanswered ? 'unanswered' : 'incorrect';
  const statusText = { correct: 'Correct', incorrect: 'Incorrect', unanswered: 'Unanswered' }[status];

  return (
    <article className={`rcard rcard-${status}`} id={`review-${q.num}`}>
      <header className="rhead">
        <h3>
          Question {position}
          <span className={`status status-${status}`}>
            <span aria-hidden="true">{status === 'correct' ? '✓' : status === 'incorrect' ? '✕' : '–'}</span> {statusText}
          </span>
        </h3>
        <span className="meta">
          Original PDF question #{q.num} · PDF page{q.sourcePages[0] === q.sourcePages[1] ? ` ${q.sourcePages[0]}` : `s ${q.sourcePages[0]}–${q.sourcePages[1]}`}
        </span>
      </header>

      <QuestionBody question={q} review />

      <ul className="review-options" aria-label="Answer options in the order shown during your exam">
        {order.map((id, i) => {
          const isKey = key.has(id);
          const isSel = sel.has(id);
          const cls = [isKey ? 'is-key' : '', isSel ? 'is-picked' : '', isSel && !isKey ? 'is-wrong-pick' : ''].join(' ');
          return (
            <li key={id} className={`ropt ${cls}`}>
              <span className="option-letter" aria-hidden="true">
                {letterFor(i)}
              </span>
              <span className="option-text">{byId.get(id)?.text}</span>
              <span className="tags">
                {isSel && <span className="tag tag-pick">{isKey ? 'Your answer ✓' : 'Your answer ✕'}</span>}
                {isKey && <span className="tag tag-key">PDF answer key</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="answers-summary">
        <p>
          <strong>Your selection:</strong>{' '}
          {result.unanswered ? 'No answer given.' : result.selected.map(text).sort().join(' · ')}
        </p>
        <p>
          <strong>PDF answer key:</strong> {q.answer.map(text).sort().join(' · ')}
        </p>
      </div>

      {!result.correct && (
        <section className="why" aria-label="Why your selection does not match the key">
          <h4>Why your selection does not match the key</h4>
          {result.unanswered ? (
            <p>You did not answer this question, and unanswered questions are scored as incorrect.</p>
          ) : q.type === 'single' ? (
            <p>
              You selected {label(result.selected)}, but the PDF answer key lists {label(q.answer)} as the single correct
              answer.
            </p>
          ) : (
            <>
              <p>
                This question needs the complete set of {q.chooseCount} answers ({label(q.answer)}); there is no partial credit.
              </p>
              <ul>
                {hit.length > 0 && <li>Matches the key: {label(hit)}.</li>}
                {extra.length > 0 && <li>Selected but not in the key: {label(extra)}.</li>}
                {missed.length > 0 && <li>In the key but not selected: {label(missed)}.</li>}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="source" aria-label="Explanation from the PDF">
        <h4>Explanation from the PDF</h4>
        <p>
          The PDF’s answer key gives <strong>{label(q.answer)}</strong> ({q.answer.map((id) => byId.get(id)?.text).join(' / ')}).
          The PDF contains no written rationale for this question, so this explanation is limited to the source material:
          the key above is reported as printed, and no further technical justification is added.
        </p>
        {q.votes.length > 0 && (
          <p className="votes">
            Community votes printed in the PDF (reference only, not used for grading):{' '}
            {q.votes
              .map((v) => `${[...v.answer].join('')} ${v.percent}%`)
              .join(' · ')}{' '}
            — letters refer to the original PDF option letters, not the shuffled letters above.
          </p>
        )}
      </section>
    </article>
  );
}

export default function ReviewScreen({ bank, attempt, mode, onModeChange, onBack, onNewExam }: Props) {
  const report = useMemo(() => gradeAttempt(bank, attempt), [bank, attempt]);
  const byNum = useMemo(() => new Map(bank.map((q) => [q.num, q] as const)), [bank]);
  const orderOf = useMemo(() => new Map(attempt.items.map((i, idx) => [i.num, { order: i.optionOrder, pos: idx + 1 }] as const)), [attempt]);

  const wrong = report.results.filter((r) => !r.correct);
  const right = report.results.filter((r) => r.correct);

  const renderList = (list: QuestionResult[]) =>
    list.map((r) => {
      const o = orderOf.get(r.num)!;
      return <ReviewCard key={r.num} q={byNum.get(r.num)!} result={r} order={o.order} position={o.pos} />;
    });

  return (
    <main className="shell review">
      <header className="review-head">
        <div>
          <h1>Review</h1>
          <p className="lede">
            Score {report.correct}/{report.total} ({report.percent}%) · options appear in the order you saw them.
          </p>
        </div>
        <div className="review-actions">
          <button type="button" className="btn" onClick={onBack}>
            Back to results
          </button>
          <button type="button" className="btn" onClick={onNewExam}>
            New randomized exam
          </button>
        </div>
      </header>

      <div className="tabs" role="group" aria-label="Review filter">
        <button type="button" className="tab" aria-pressed={mode === 'wrong'} onClick={() => onModeChange('wrong')}>
          Incorrect and unanswered ({wrong.length})
        </button>
        <button type="button" className="tab" aria-pressed={mode === 'all'} onClick={() => onModeChange('all')}>
          All questions ({report.total})
        </button>
      </div>

      <section aria-labelledby="wrong-h">
        <h2 id="wrong-h" className="section-title">
          Incorrect and unanswered ({wrong.length})
        </h2>
        {wrong.length === 0 ? <p className="notice">Nothing to review here — every question was answered correctly.</p> : renderList(wrong)}
      </section>

      {mode === 'all' && (
        <section aria-labelledby="right-h">
          <h2 id="right-h" className="section-title">
            Answered correctly ({right.length})
          </h2>
          {right.length === 0 ? <p className="notice">No questions were answered correctly.</p> : renderList(right)}
        </section>
      )}
    </main>
  );
}
