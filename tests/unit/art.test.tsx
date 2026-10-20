import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DomainFile } from '../../src/content/types';
import { BOSS_ART } from '../../src/art/bossArt';
import { BossFigure } from '../../src/art/BossFigure';
import { DOODLES, Doodle } from '../../src/art/Doodle';
import { PROP_KEYS } from '../../src/art/props';
import { EXPRESSIONS, POSES, StickFigure } from '../../src/art/StickFigure';
import { bossArtDoc } from '../../scripts/boss-art-doc';
import { DOMAINS } from '../../scripts/content/structure';
import { HAS_CONTENT, readContent } from '../content';

const bosses = DOMAINS.flatMap((d) => {
  const file = readContent<DomainFile>(`content/json/${d.id}.json`, { domain: {} as DomainFile['domain'], units: [] });
  return [...file.units.map((u) => u.miniBoss), file.domain.finalBoss];
});

describe('stick figures', () => {
  it('renders every pose and every expression', () => {
    for (const pose of POSES) for (const expression of EXPRESSIONS) {
      const { container, unmount } = render(<StickFigure pose={pose} expression={expression} />);
      expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(9);
      unmount();
    }
  });

  it('renders every prop without throwing', () => {
    for (const key of PROP_KEYS) {
      const { container, unmount } = render(<StickFigure props={[{ key, label: 'x' }]} />);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('is decorative unless labelled', () => {
    const { container } = render(<StickFigure />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const labelled = render(<StickFigure label="The Seeker" />);
    expect(labelled.getByRole('img', { name: 'The Seeker' })).toBeTruthy();
  });

  it('draws the same wobble for the same seed', () => {
    const a = render(<StickFigure seed={42} />).container.innerHTML;
    const b = render(<StickFigure seed={42} />).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe.skipIf(!HAS_CONTENT)('boss art registry', () => {
  it('has an entry for all 63 bosses and nothing else', () => {
    expect(bosses).toHaveLength(63);
    expect(Object.keys(BOSS_ART).sort()).toEqual(bosses.map((b) => b.id).sort());
  });

  it('matches the ART line for every final boss', () => {
    for (const b of bosses.filter((x) => x.alwaysEscalate)) expect(BOSS_ART[b.id]!.pose, b.id).toBe(b.art!.pose);
  });

  it('renders every boss', () => {
    for (const b of bosses) {
      const { container, unmount } = render(<BossFigure bossId={b.id} colour="var(--sky)" />);
      expect(container.querySelector('svg'), b.id).not.toBeNull();
      unmount();
    }
  });

  it('keeps the boss art table in the planning documents in sync with the registry', () => {
    expect(readFileSync('content/planning/BOSS_ART.md', 'utf8').replace(/\r\n/g, '\n')).toBe(bossArtDoc());
  });
});

describe('doodles', () => {
  it('renders all eight', () => {
    expect(DOODLES).toHaveLength(8);
    for (const d of DOODLES) expect(render(<Doodle name={d} />).container.querySelector('svg')).not.toBeNull();
  });
});
