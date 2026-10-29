import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import type { Attempt, Question } from '../types';
import type { Action } from '../state';
import { countAnswered, isAnswered, remainingSeconds } from '../lib/exam';
import { formatClock, pluralize } from '../lib/format';
import QuestionBody from './QuestionBody';
import OptionList from './OptionList';
import Navigator from './Navigator';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  bank: Question[];
  attempt: Attempt;
  dispatch: Dispatch<Action>;
  resumed: boolean;
}

/** Re-renders once per second while an exam with a deadline is running; submits at zero. */
function useCountdown(attempt: Attempt, onExpire: () => void) {
  const endsAt = attempt.endsAt;
  const [remaining, setRemaining] = useState<number | null>(() => remainingSeconds(attempt));
  const expired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const r = remainingSeconds({ endsAt } as Attempt);
      setRemaining(r);
      if (r === 0 && !expired.current) {
        expired.current = true;
        expire.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return remaining;
}

export default function ExamScreen({ bank, attempt, dispatch, resumed }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const byNum = useMemo(() => new Map(bank.map((q) => [q.num, q] as const)), [bank]);
  const total = attempt.items.length;
  const item = attempt.items[attempt.current];
  const question = byNum.get(item.num)!;
  const selected = attempt.answers[item.num] ?? [];
  const flagged = attempt.flagged.includes(item.num);
  const answered = countAnswered(attempt);
  const unanswered = total - answered;

  const submit = useCallback(
    (reason: 'manual' | 'timeout') => {
      setConfirming(false);
      dispatch({ type: 'submit', reason, now: Date.now() });
    },
    [dispatch],
  );

  const remaining = useCountdown(attempt, () => submit('timeout'));

  // Announce time milestones politely for screen readers.
  useEffect(() => {
    if (remaining === 300) setAnnounce('5 minutes remaining');
    else if (remaining === 60) setAnnounce('1 minute remaining');
  }, [remaining]);

  // Move focus to the question heading and reset scroll when the question changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [attempt.current]);

  const go = (index: number) => {
    dispatch({ type: 'goto', index });
    setMapOpen(false);
  };

  const flaggedCount = attempt.flagged.length;
  const low = remaining !== null && remaining <= 300;

  return (
    <div className="exam">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-title">
            <span className="brand">FortiOS 7.6 Administrator</span>
            <span className="progress" aria-live="off">
              Question {attempt.current + 1} of {total}
            </span>
          </div>
          <div className="topbar-stats" aria-label="Progress summary">
            <span>
              <strong>{answered}</strong> answered
            </span>
            <span>
              <strong>{unanswered}</strong> unanswered
            </span>
            {flaggedCount > 0 && (
              <span>
                <strong>{flaggedCount}</strong> flagged
              </span>
            )}
          </div>
          <div className="topbar-actions">
            {remaining !== null && (
              <div className={`clock ${low ? 'clock-low' : ''}`} role="timer" aria-label="Time remaining">
                <span className="clock-label">Time left</span>
                <span className="clock-value">{formatClock(remaining)}</span>
              </div>
            )}
            <button type="button" className="btn map-toggle" aria-expanded={mapOpen} onClick={() => setMapOpen((v) => !v)}>
              Question map
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
              Submit exam
            </button>
          </div>
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-label="Questions answered"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
        >
          <div className="meter-fill" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </header>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      <div className="exam-grid">
        <main className="question-col">
          {resumed && attempt.current === 0 && answered > 0 && (
            <p className="notice">Welcome back — your earlier answers were restored.</p>
          )}
          <article className="qcard" aria-labelledby="q-heading">
            <div className="qhead">
              <h1 id="q-heading" tabIndex={-1} ref={headingRef}>
                Question {attempt.current + 1}
              </h1>
              <span className={`chip ${question.type === 'multiple' ? 'chip-multi' : ''}`}>
                {question.type === 'multiple' ? `Select ${question.chooseCount}` : 'Select one'}
              </span>
              {flagged && <span className="chip chip-flag">Flagged for review</span>}
              <span className="meta">
                PDF question #{question.num} · PDF page{question.sourcePages[0] === question.sourcePages[1] ? '' : 's'}{' '}
                {question.sourcePages[0] === question.sourcePages[1]
                  ? question.sourcePages[0]
                  : `${question.sourcePages[0]}–${question.sourcePages[1]}`}
              </span>
            </div>

            <QuestionBody question={question} />

            <OptionList
              question={question}
              optionOrder={item.optionOrder}
              selected={selected}
              onToggle={(optionId) =>
                dispatch({ type: 'select', num: item.num, optionId, multiple: question.type === 'multiple' })
              }
            />

            {question.type === 'multiple' && (
              <p className="help" aria-live="polite">
                {selected.length} of {question.chooseCount} selected
              </p>
            )}

            <div className="qtools">
              <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'flag', num: item.num })} aria-pressed={flagged}>
                {flagged ? 'Remove flag' : 'Flag for review'}
              </button>
              <button
                type="button"
                className="btn btn-small"
                disabled={!isAnswered(attempt, item.num)}
                onClick={() => dispatch({ type: 'clear', num: item.num })}
              >
                Clear answer
              </button>
            </div>
          </article>

          <div className="pager">
            <button type="button" className="btn" disabled={attempt.current === 0} onClick={() => go(attempt.current - 1)}>
              Previous
            </button>
            {attempt.current < total - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => go(attempt.current + 1)}>
                Next
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
                Review and submit
              </button>
            )}
          </div>
        </main>

        <aside className={`map-col ${mapOpen ? 'is-open' : ''}`} aria-label="Question map">
          <div className="map-panel">
            <h2>Question map</h2>
            <p className="help">
              {answered} of {total} answered{flaggedCount ? ` · ${flaggedCount} flagged` : ''}
            </p>
            <Navigator attempt={attempt} onGo={go} />
          </div>
        </aside>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Submit your exam?"
          confirmLabel="Submit exam"
          cancelLabel="Keep working"
          onConfirm={() => submit('manual')}
          onCancel={() => setConfirming(false)}
        >
          <p>
            {unanswered === 0 ? (
              <>You have answered all {total} questions.</>
            ) : (
              <>
                <strong>{pluralize(unanswered, 'question')}</strong> {unanswered === 1 ? 'is' : 'are'} unanswered and will
                count as incorrect.
              </>
            )}
          </p>
          {flaggedCount > 0 && <p>{pluralize(flaggedCount, 'question')} flagged for review.</p>}
          <p>Once submitted, you cannot change your answers.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
