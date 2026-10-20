import type { ReactNode } from 'react';
import { RoughFrame } from './RoughFrame';

export interface TapOptionProps {
  selected?: boolean;
  onSelect: () => void;
  seed?: number;
  children: ReactNode;
}

// A large tappable answer card for TAP drills (48 px minimum, BUILD_PLAN 10).
export function TapOption({ selected = false, onSelect, seed = 30, children }: TapOptionProps) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className="relative block min-h-12 w-full px-4 py-3 text-left text-body">
      <RoughFrame radius={18} fill={selected ? 'var(--butter)' : 'var(--paper-raised)'} seed={seed} strokeWidth={selected ? 2.5 : 2} sticker />
      <span className="relative block">{children}</span>
    </button>
  );
}
