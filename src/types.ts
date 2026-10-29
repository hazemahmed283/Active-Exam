export type StemBlock = { kind: 'text' | 'code'; text: string };

export interface QuestionImage {
  /** Path relative to the app root, e.g. "images/q4-1.png". */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface VoteEntry {
  answer: string;
  percent: number;
}

export interface SourceFlag {
  code: 'votes-differ' | 'missing-exhibit';
  note: string;
}

export interface QuestionOption {
  /** Original letter from the PDF (A, B, C, ...). Used as the stable identity of the option. */
  id: string;
  text: string;
}

export interface Question {
  /** Original question number in the PDF ("Question #N"). */
  num: number;
  type: 'single' | 'multiple';
  chooseCount: number;
  stem: StemBlock[];
  options: QuestionOption[];
  /** Original option ids that make up the PDF answer key. */
  answer: string[];
  images: QuestionImage[];
  /** Community vote list printed in the PDF (reference only; never used for grading). */
  votes: VoteEntry[];
  flags: SourceFlag[];
  /** First and last PDF page the question spans. */
  sourcePages: [number, number];
}

export interface AttemptItem {
  /** Original question number. */
  num: number;
  /** Option ids in the order they are displayed during this attempt. */
  optionOrder: string[];
}

export type AttemptStatus = 'in-progress' | 'submitted';

export interface Attempt {
  version: 1;
  seed: number;
  startedAt: number;
  durationSec: number | null;
  endsAt: number | null;
  items: AttemptItem[];
  /** question number -> selected option ids */
  answers: Record<number, string[]>;
  flagged: number[];
  current: number;
  status: AttemptStatus;
  submittedAt?: number;
  submitReason?: 'manual' | 'timeout';
}

export interface QuestionResult {
  num: number;
  selected: string[];
  correct: boolean;
  unanswered: boolean;
}

export interface GradeReport {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percent: number;
  results: QuestionResult[];
}
