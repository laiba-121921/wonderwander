import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { useVoice } from './Voice';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | null;
  wordTarget?: number;
  showWordCount?: boolean;
  reading?: boolean; // Literata at reading size, for long writing
  voice?: boolean; // the in-app mic (PHASE_15_PLUS 2), on by default
  voiceColour?: string;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export const VOICE_HINT = 'Tap the mic to dictate, or hold it to record.';

// Calm zone: plain border, auto-growing, at least six lines. Voice first: dictation and recording live beside the label.
export function TextArea({
  label,
  value,
  onChange,
  hint = VOICE_HINT,
  wordTarget,
  showWordCount = false,
  reading = false,
  voice = true,
  voiceColour,
  id,
  className = '',
  ...rest
}: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = id ?? `ta-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const mic = useVoice({ value, onChange, colour: voiceColour });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [value]);

  const words = countWords(value);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <label htmlFor={fieldId} className="block text-small font-semibold">
          {label}
        </label>
        {voice && mic.button}
      </div>
      <div className="rounded-input border-2 border-ink bg-paper-raised">
        <textarea
          ref={ref}
          id={fieldId}
          rows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
          className={`block w-full resize-none rounded-input bg-transparent px-3 py-2.5 text-ink placeholder:text-ink-soft ${reading ? 'calm max-w-none' : 'text-body'}`}
        />
        {voice && mic.interim && (
          <p className="px-3 pb-2.5 text-body text-ink-soft italic" aria-live="polite">
            {mic.interim}
          </p>
        )}
      </div>
      {voice && mic.status}
      <div className="mt-1.5 flex justify-between gap-3 text-caption text-ink-soft">
        <span>{hint}</span>
        {(showWordCount || wordTarget) && (
          <span className="shrink-0 tabular-nums">
            {words}
            {wordTarget ? ` of ${wordTarget} words` : words === 1 ? ' word' : ' words'}
          </span>
        )}
      </div>
    </div>
  );
}
