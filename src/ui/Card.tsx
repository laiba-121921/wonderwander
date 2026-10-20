import type { HTMLAttributes, ReactNode } from 'react';
import { RoughFrame } from './RoughFrame';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  fill?: string;
  seed?: number;
  children: ReactNode;
}

export function Card({ fill = 'var(--paper-raised)', seed = 11, className = '', children, ...rest }: CardProps) {
  return (
    <div {...rest} className={`relative p-4 ${className}`}>
      <RoughFrame radius={18} fill={fill} seed={seed} sticker />
      <div className="relative">{children}</div>
    </div>
  );
}
