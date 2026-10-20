import type { ReactNode } from 'react';

export const DOODLES = ['star', 'swirl', 'sun', 'moon', 'lantern', 'kite', 'padlock', 'owl'] as const;
export type DoodleName = (typeof DOODLES)[number];

const ART: Record<DoodleName, ReactNode> = {
  star: <path d="M24 6 L28.5 18.5 L41.5 19 L31 27 L35 40 L24 32.5 L13 40.5 L17 27.5 L6.5 19.5 L19.5 18.5 Z" fill="var(--butter)" />,
  swirl: <path d="M24 25 C24 22 28 22 28 25 C28 30 20 30 20 24 C20 17 32 17 32 25 C32 34 15 35 15 24 C15 12 37 11 38 25" fill="none" />,
  sun: (
    <>
      <circle cx="24" cy="24" r="8.5" fill="var(--amber)" />
      <path d="M24 5 L24 10 M24 38 L24 43 M5 24 L10 24 M38 24 L43 24 M10.5 10.5 L14 14 M34 34 L37.5 37.5 M37.5 10.5 L34 14 M14 34 L10.5 37.5" fill="none" />
    </>
  ),
  moon: <path d="M30 7 C19 8 12 17 13.5 27 C15 37 25 43 35 40 C26 37 21 30 22 22 C23 15 26 10 30 7 Z" fill="var(--lilac)" />,
  lantern: (
    <>
      <circle cx="24" cy="27" r="15" fill="var(--amber)" opacity="0.25" stroke="none" />
      <path d="M24 5 L24 10 M19 10 L29 10" fill="none" />
      <path d="M18 13 L30 13 L31.5 36 L16.5 36 Z" fill="var(--butter)" />
      <path d="M24 19 C21.5 23 22 27 24 29 C26 27 26.5 23 24 19 Z" fill="var(--amber)" />
      <path d="M15 37.5 L33 37.5" fill="none" />
    </>
  ),
  kite: (
    <>
      <path d="M26 4 L38 17 L26 33 L14 17 Z" fill="var(--bubblegum)" />
      <path d="M14 17 L38 17 M26 4 L26 33" fill="none" />
      <path d="M26 33 C22 37 29 39 24 43 M22 38 L20 36 M26 41 L28 43" fill="none" />
    </>
  ),
  padlock: (
    <>
      <path d="M16 21 L16 15 C16 7 32 7 32 15 L32 21" fill="none" />
      <path d="M11.5 21 L36.5 21.5 L36 41 L12 40.5 Z" fill="var(--peach)" />
      <path d="M24 28 L24 34" fill="none" />
    </>
  ),
  owl: (
    <>
      <path d="M13 13 L17 18 M35 13 L31 18" fill="none" />
      <path d="M24 12 C35 12 37 22 37 29 C37 38 31 42 24 42 C17 42 11 38 11 29 C11 22 13 12 24 12 Z" fill="var(--grape)" fillOpacity="0.25" />
      <circle cx="18.5" cy="24" r="4.5" fill="var(--paper-raised)" />
      <circle cx="29.5" cy="24" r="4.5" fill="var(--paper-raised)" />
      <circle cx="18.5" cy="24" r="1.2" fill="var(--ink)" />
      <circle cx="29.5" cy="24" r="1.2" fill="var(--ink)" />
      <path d="M22.5 29 L24 32 L25.5 29 Z" fill="var(--amber)" />
      <path d="M17 36 C21 38 27 38 31 36" fill="none" />
    </>
  ),
};

export function Doodle({ name, size = 40, label }: { name: DoodleName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      stroke="var(--ink)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ART[name]}
    </svg>
  );
}
