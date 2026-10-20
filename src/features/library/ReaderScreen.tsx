import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadManifest, loadText, useLoad } from '../../content/load';
import { FONT_MAX, FONT_MIN, useReaderFont, useScrollMemory } from '../../lib/prefs';
import { Prose } from '../../ui/Prose';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Finds the paragraph containing the identifying phrase, matching on its first six words so punctuation differences do not matter.
export function findPassage(container: HTMLElement, phrase: string): HTMLElement | null {
  const words = norm(phrase).split(' ').slice(0, 6).join(' ');
  if (!words) return null;
  for (const el of container.querySelectorAll<HTMLElement>('p, li, blockquote')) {
    if (norm(el.textContent ?? '').includes(words)) return el;
  }
  return null;
}

export default function ReaderScreen() {
  const { textId = '' } = useParams();
  const [params] = useSearchParams();
  const find = params.get('find');
  const navigate = useNavigate();
  const text = useLoad(() => loadText(textId), [textId]);
  const manifest = useLoad(() => loadManifest(), []);
  const meta = manifest.data?.find((m) => m.id === textId);
  const [font, setFont] = useReaderFont();
  const progress = useScrollMemory(`text.${textId}`, Boolean(text.data), !find);
  const body = useRef<HTMLDivElement>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!text.data || !find || !body.current) return;
    const el = findPassage(body.current, find);
    setNotFound(!el);
    if (el) {
      el.classList.add('found');
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
    }
  }, [text.data, find]);

  if (text.error) return <p>That reading is not in the app.</p>;

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b-2 border-ink/15 bg-paper/95 px-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => navigate(-1)} className="min-h-12 text-small font-semibold">
            <span aria-hidden="true" className="mr-1.5">
              {'<'}
            </span>
            Back
          </button>
          <div className="flex items-center gap-1" role="group" aria-label="Text size">
            <button type="button" onClick={() => setFont(font - 1)} disabled={font <= FONT_MIN} className="min-h-12 min-w-12 text-small font-bold disabled:opacity-35" aria-label="Smaller text">
              A
            </button>
            <span className="w-10 text-center text-caption tabular-nums" aria-live="polite">
              {font}px
            </span>
            <button type="button" onClick={() => setFont(font + 1)} disabled={font >= FONT_MAX} className="min-h-12 min-w-12 text-title font-bold disabled:opacity-35" aria-label="Larger text">
              A
            </button>
          </div>
        </div>
        <div className="h-1 bg-ink/10" role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1 bg-amber" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      {meta && (
        <header className="mb-6">
          <h1 className="text-heading">{meta.title}</h1>
          <p className="mt-1 text-small text-ink-soft">
            {meta.author}
            {meta.translator ? `, translated by ${meta.translator}` : ''}
          </p>
        </header>
      )}
      {notFound && <p className="mb-4 text-caption text-ink-soft">The passage's opening words read differently in this translation, so look for it by the lesson's description.</p>}
      {text.data ? (
        <div ref={body}>
          <Prose markdown={text.data} fontSize={font} />
        </div>
      ) : (
        <p className="text-ink-soft">Opening...</p>
      )}
      {meta && (
        <p className="mt-10 text-caption text-ink-soft">
          Public domain. Source: <a href={meta.source}>{meta.source}</a>
        </p>
      )}
    </div>
  );
}
