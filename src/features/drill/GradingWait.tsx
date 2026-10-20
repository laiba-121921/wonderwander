import { useEffect, useState } from 'react';
import { StickFigure } from '../../art/StickFigure';

const LINES = ['Checking every premise', 'Looking for hidden assumptions', 'Comparing with the key', 'Asking the auditor for a second opinion'];

// BUILD_PLAN 19.7: a stick figure reading, with rotating lines, while grading runs.
export function GradingWait() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % LINES.length), 2500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center py-8 text-center" role="status" aria-live="polite">
      <div className="motion-safe:animate-pulse">
        <StickFigure pose="read" expression="curious" props={[{ key: 'book', colour: 'var(--lilac)' }]} size={120} seed={3} />
      </div>
      <p className="mt-3 text-body text-ink-soft">{LINES[i]}...</p>
    </div>
  );
}
