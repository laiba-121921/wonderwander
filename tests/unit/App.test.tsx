import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../src/App';

describe('App shell', () => {
  it('shows four tabs and the Today screen by default', () => {
    render(
      <MemoryRouter>
        <Shell />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.querySelectorAll('a')).toHaveLength(4); // Review became Appeals, under Me (PHASE_15_PLUS 1.3)
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });

  it.each([
    ['/map', 'Map'],
    ['/library', 'Library'],
    ['/me', 'Me'],
  ])('routes %s to the %s screen', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Shell />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
