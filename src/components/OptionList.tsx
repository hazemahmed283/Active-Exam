import type { Question } from '../types';
import { letterFor } from '../lib/format';

interface Props {
  question: Question;
  optionOrder: string[];
  selected: string[];
  onToggle: (optionId: string) => void;
}

/** Radio buttons for single-answer questions, checkboxes for multiple-answer ones. */
export default function OptionList({ question, optionOrder, selected, onToggle }: Props) {
  const multiple = question.type === 'multiple';
  const byId = new Map(question.options.map((o) => [o.id, o] as const));
  const groupName = `q-${question.num}`;
  return (
    <fieldset className="options">
      <legend className="sr-only">
        {multiple ? `Select ${question.chooseCount} answers` : 'Select one answer'}
      </legend>
      {optionOrder.map((id, idx) => {
        const opt = byId.get(id);
        if (!opt) return null;
        const checked = selected.includes(id);
        return (
          <label key={id} className={`option ${checked ? 'is-selected' : ''}`}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={groupName}
              value={id}
              checked={checked}
              onChange={() => onToggle(id)}
            />
            <span className="option-letter" aria-hidden="true">
              {letterFor(idx)}
            </span>
            <span className="option-text">{opt.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
