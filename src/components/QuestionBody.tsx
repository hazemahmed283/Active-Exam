import type { Question } from '../types';
import ExhibitImage from './ExhibitImage';

interface Props {
  question: Question;
  /** In review mode we can also show the vote-disagreement note; during the exam only the missing-exhibit note. */
  review?: boolean;
}

/** Original question text (as printed in the PDF) plus its exhibits. */
export default function QuestionBody({ question, review = false }: Props) {
  const notes = question.flags.filter((f) => review || f.code === 'missing-exhibit');
  // The PDF prints each exhibit above the question text, so the same order is used here.
  const exhibits = question.images.map((img, i) => (
    <ExhibitImage
      key={img.src}
      image={img}
      label={question.images.length > 1 ? `Exhibit ${i + 1} of ${question.images.length}` : 'Exhibit'}
    />
  ));
  return (
    <div className="qbody">
      {exhibits.length > 0 && <div className="exhibits">{exhibits}</div>}
      {question.stem.map((b, i) =>
        b.kind === 'code' ? (
          <pre key={i} className="code">
            {b.text}
          </pre>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
      {notes.map((n) => (
        <p key={n.code} className="source-note" role="note">
          <strong>{n.code === 'missing-exhibit' ? 'Source issue: ' : 'Source note: '}</strong>
          {n.note}
        </p>
      ))}
    </div>
  );
}
