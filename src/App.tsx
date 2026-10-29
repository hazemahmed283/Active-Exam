import { useEffect, useMemo, useReducer, useState } from 'react';
import rawQuestions from './data/questions.json';
import excluded from './data/excluded.json';
import type { Question } from './types';
import { sanitizeBank } from './lib/validate';
import { clearAttempt, loadAttempt, saveAttempt } from './lib/storage';
import { attemptReducer } from './state';
import SetupScreen from './components/SetupScreen';
import ExamScreen from './components/ExamScreen';
import ResultsScreen from './components/ResultsScreen';
import ReviewScreen, { type ReviewMode } from './components/ReviewScreen';

const { usable: BANK, issues: BANK_ISSUES } = sanitizeBank(rawQuestions as Question[]);

export default function App() {
  const [attempt, dispatch] = useReducer(attemptReducer, null, () => {
    const saved = loadAttempt();
    if (!saved) return null;
    // Only resume attempts whose questions still exist in the bank.
    const known = new Set(BANK.map((q) => q.num));
    return saved.items.every((i) => known.has(i.num)) ? saved : null;
  });
  const [view, setView] = useState<'results' | 'review'>('results');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('wrong');

  // Persist every change so a refresh never loses answers.
  useEffect(() => {
    if (attempt) saveAttempt(attempt);
  }, [attempt]);

  // Warn before closing the tab while an exam is running.
  useEffect(() => {
    if (attempt?.status !== 'in-progress') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [attempt?.status]);

  const resumable = useMemo(() => (attempt?.status === 'in-progress' ? attempt : null), [attempt]);

  const newExam = () => {
    clearAttempt();
    dispatch({ type: 'discard' });
    setView('results');
  };

  if (!attempt) {
    return (
      <SetupScreen
        bank={BANK}
        bankIssues={BANK_ISSUES}
        excluded={excluded}
        onStart={(a) => {
          setView('results');
          dispatch({ type: 'start', attempt: a });
        }}
      />
    );
  }

  if (attempt.status === 'in-progress') {
    return <ExamScreen bank={BANK} attempt={attempt} dispatch={dispatch} resumed={resumable !== null} />;
  }

  if (view === 'review') {
    return (
      <ReviewScreen
        bank={BANK}
        attempt={attempt}
        mode={reviewMode}
        onModeChange={setReviewMode}
        onBack={() => setView('results')}
        onNewExam={newExam}
      />
    );
  }

  return (
    <ResultsScreen
      bank={BANK}
      attempt={attempt}
      onReview={(mode) => {
        setReviewMode(mode);
        setView('review');
      }}
      onNewExam={newExam}
    />
  );
}
