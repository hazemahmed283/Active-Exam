import { useMemo } from 'react';
import type { Attempt, Question } from '../types';
import { gradeAttempt } from '../lib/grading';
import { formatClock } from '../lib/format';
import type { ReviewMode } from './ReviewScreen';

interface Props {
  bank: Question[];
  attempt: Attempt;
  onReview: (mode: ReviewMode) => void;
  onNewExam: () => void;
}

export default function ResultsScreen({ bank, attempt, onReview, onNewExam }: Props) {
  const report = useMemo(() => gradeAttempt(bank, attempt), [bank, attempt]);
  const byNum = useMemo(() => new Map(bank.map((q) => [q.num, q] as const)), [bank]);

  const split = useMemo(() => {
    const out = { single: { c: 0, t: 0 }, multiple: { c: 0, t: 0 } };
    for (const r of report.results) {
      const q = byNum.get(r.num)!;
      out[q.type].t++;
      if (r.correct) out[q.type].c++;
    }
    return out;
  }, [report, byNum]);

  const pct = (n: number) => (report.total ? (n / report.total) * 100 : 0);
  const spent = attempt.submittedAt ? Math.round((attempt.submittedAt - attempt.startedAt) / 1000) : null;
  const needReview = report.incorrect + report.unanswered;

  return (
    <main className="shell results">
      {attempt.submitReason === 'timeout' && (
        <p className="notice notice-warn" role="status">
          Time ran out, so the exam was submitted automatically with the answers you had selected.
        </p>
      )}
      <header className="results-head">
        <h1>Exam results</h1>
        <p className="lede">FortiOS 7.6 Administrator — Randomized Practice Exam</p>
      </header>

      <section className="score-block" aria-labelledby="score-h">
        <h2 id="score-h" className="sr-only">
          Score
        </h2>
        <p className="score" aria-label={`Score ${report.correct} out of ${report.total}`}>
          <span className="score-num">{report.correct}</span>
          <span className="score-of">/ {report.total}</span>
        </p>
        <p className="score-pct">{report.percent}%</p>
      </section>

      <section className="panel" aria-labelledby="breakdown">
        <h2 id="breakdown">Breakdown</h2>
        <div
          className="stack"
          role="img"
          aria-label={`${report.correct} correct, ${report.incorrect} incorrect, ${report.unanswered} unanswered`}
        >
          <span className="seg seg-correct" style={{ width: `${pct(report.correct)}%` }} />
          <span className="seg seg-wrong" style={{ width: `${pct(report.incorrect)}%` }} />
          <span className="seg seg-blank" style={{ width: `${pct(report.unanswered)}%` }} />
        </div>
        <dl className="tally">
          <div>
            <dt>
              <span className="dot dot-correct" /> Correct
            </dt>
            <dd>{report.correct}</dd>
          </div>
          <div>
            <dt>
              <span className="dot dot-wrong" /> Incorrect
            </dt>
            <dd>{report.incorrect}</dd>
          </div>
          <div>
            <dt>
              <span className="dot dot-blank" /> Unanswered
            </dt>
            <dd>{report.unanswered}</dd>
          </div>
        </dl>
        <table className="split">
          <caption className="sr-only">Accuracy by question type</caption>
          <thead>
            <tr>
              <th scope="col">Question type</th>
              <th scope="col">Correct</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Single answer</th>
              <td>
                {split.single.c} / {split.single.t}
              </td>
              <td>{split.single.t ? Math.round((split.single.c / split.single.t) * 100) : 0}%</td>
            </tr>
            <tr>
              <th scope="row">Multiple answers</th>
              <td>
                {split.multiple.c} / {split.multiple.t}
              </td>
              <td>{split.multiple.t ? Math.round((split.multiple.c / split.multiple.t) * 100) : 0}%</td>
            </tr>
          </tbody>
        </table>
        <p className="help">
          Multiple-answer questions count only when the whole set matches the answer key. Time used:{' '}
          {spent !== null ? formatClock(spent) : '—'}
          {attempt.durationSec ? ` of ${formatClock(attempt.durationSec)}` : ' (untimed)'}. Attempt seed: {attempt.seed}.
        </p>
      </section>

      <div className="results-actions">
        <button type="button" className="btn btn-primary" onClick={() => onReview('wrong')} disabled={needReview === 0}>
          Review incorrect and unanswered ({needReview})
        </button>
        <button type="button" className="btn" onClick={() => onReview('all')}>
          Review all questions ({report.total})
        </button>
        <button type="button" className="btn" onClick={onNewExam}>
          Start a new randomized exam
        </button>
      </div>
    </main>
  );
}
