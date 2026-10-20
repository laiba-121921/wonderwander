import { useEffect, useRef, type ReactNode } from 'react';
import { RoughFrame } from './RoughFrame';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Bottom sheet. Closes on the backdrop, on Escape, or from the close button.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full max-w-md px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+40px)]"
        style={{ marginBottom: -24 }}
      >
        <RoughFrame radius={24} fill="var(--paper-raised)" seed={21} />
        <div className="relative">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/25" aria-hidden="true" />
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-title">{title}</h2>
            <button type="button" onClick={onClose} className="-mt-1 min-h-12 min-w-12 text-small underline decoration-2 underline-offset-4">
              Close
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
