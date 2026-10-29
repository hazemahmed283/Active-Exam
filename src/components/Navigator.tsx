import type { Attempt } from '../types';
import { isAnswered } from '../lib/exam';

interface Props {
  attempt: Attempt;
  onGo: (index: number) => void;
}

/** Question map. Shows answered / unanswered / flagged / current — never correctness. */
export default function Navigator({ attempt, onGo }: Props) {
  return (
    <nav className="navigator" aria-label="Question navigator">
      <ol className="ports">
        {attempt.items.map((item, i) => {
          const answered = isAnswered(attempt, item.num);
          const flagged = attempt.flagged.includes(item.num);
          const current = i === attempt.current;
          const state = [answered ? 'answered' : 'unanswered', flagged ? 'flagged for review' : ''].filter(Boolean).join(', ');
          return (
            <li key={item.num}>
              <button
                type="button"
                className={['port', answered ? 'is-answered' : '', flagged ? 'is-flagged' : '', current ? 'is-current' : ''].join(' ')}
                aria-label={`Question ${i + 1}, ${state}${current ? ', current' : ''}`}
                aria-current={current ? 'step' : undefined}
                onClick={() => onGo(i)}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="legend">
        <li>
          <span className="swatch swatch-unanswered" /> Unanswered
        </li>
        <li>
          <span className="swatch swatch-answered" /> Answered
        </li>
        <li>
          <span className="swatch swatch-flagged" /> Flagged
        </li>
        <li>
          <span className="swatch swatch-current" /> Current
        </li>
      </ul>
    </nav>
  );
}
