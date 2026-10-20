import { useEffect, useState, type ReactNode } from 'react';
import { StickFigure } from '../../art/StickFigure';
import { initContent } from '../../content/load';
import { Button } from '../../ui/Button';

// PHASE_15_PLUS 3.3: the first launch downloads the curriculum, with progress; later launches open from the phone.
export function PackGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ kind: 'loading'; done: number; total: number } | { kind: 'ready' } | { kind: 'error'; message: string }>({ kind: 'loading', done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    initContent((done, total) => live && setState({ kind: 'loading', done, total })).then(
      () => live && setState({ kind: 'ready' }),
      (e: Error) => live && setState({ kind: 'error', message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (state.kind === 'ready') return <>{children}</>;
  const pct = state.kind === 'loading' && state.total ? Math.round((100 * state.done) / state.total) : 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <StickFigure pose="read" expression="delighted" props={[{ key: 'book', colour: 'var(--lilac)' }]} size={130} seed={9} />
      {state.kind === 'loading' ? (
        <>
          <p className="mt-4 text-title">{state.total ? 'Fetching the curriculum' : 'Opening'}</p>
          {state.total > 0 && (
            <>
              <div className="mt-4 h-3 w-full max-w-64 overflow-hidden rounded-full border-2 border-ink" role="progressbar" aria-label="Download progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-small text-ink-soft">
                {state.done} of {state.total}. This happens once; after that it all works offline.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <p role="alert" className="mt-4 text-body">
            {state.message}
          </p>
          <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </Button>
        </>
      )}
    </main>
  );
}
