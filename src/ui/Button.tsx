import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RoughFrame } from './RoughFrame';

type Variant = 'primary' | 'secondary' | 'quiet';

const FILL: Record<Variant, string | undefined> = {
  primary: 'var(--amber)',
  secondary: 'var(--paper-raised)',
  quiet: undefined,
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  seed?: number;
  children: ReactNode;
}

export function Button({ variant = 'primary', block = false, seed = 3, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`relative inline-flex min-h-12 items-center justify-center gap-2 px-5 py-2 text-body font-semibold text-ink transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'quiet' ? 'underline decoration-2 underline-offset-4' : ''
      } ${block ? 'w-full' : ''} ${className}`}
    >
      {variant !== 'quiet' && <RoughFrame radius={14} fill={FILL[variant]} seed={seed} sticker />}
      <span className="relative">{children}</span>
    </button>
  );
}
