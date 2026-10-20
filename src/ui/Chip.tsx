import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RoughFrame } from './RoughFrame';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  colour?: string;
  seed?: number;
  children: ReactNode;
}

export function Chip({ selected = false, colour = 'var(--amber)', seed = 5, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={`relative inline-flex min-h-12 items-center justify-center px-5 text-small font-semibold text-ink ${className}`}
    >
      <RoughFrame radius="pill" fill={selected ? colour : 'var(--paper-raised)'} seed={seed} strokeWidth={selected ? 2.5 : 2} />
      <span className="relative">{children}</span>
    </button>
  );
}
