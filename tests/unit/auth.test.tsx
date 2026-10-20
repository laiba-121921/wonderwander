import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const session = { current: null as null | { user: { id: string } } };
const profileRow = { current: null as null | Record<string, unknown> };

// Any query chain (select, eq, maybeSingle, upsert...) resolves to no rows, as a fresh project would, except the
// profile when a test sets one.
function query(data: unknown = null): unknown {
  return new Proxy(() => undefined, {
    get: (_, k) => (k === 'then' ? (resolve: (v: unknown) => void) => resolve({ data, error: null }) : () => query(data)),
  });
}

vi.mock('../../src/lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: session.current } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: (table: string) => query(table === 'profile' ? profileRow.current : null),
    rpc: () => query(true),
  },
}));

const { default: App } = await import('../../src/App');
const { signInMessage } = await import('../../src/features/auth/SignInScreen');

describe('sign-in gate', () => {
  it('shows only the sign-in screen when signed out, with no sign-up', async () => {
    session.current = null;
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/sign up|create account|register/i)).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('shows the app when a session exists and its first run is done', async () => {
    session.current = { user: { id: 'u' } };
    profileRow.current = { onboarded: true };
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument());
  });

  it('starts a new account on the first run instead (PHASE_15_PLUS 4.2)', async () => {
    session.current = { user: { id: 'new' } };
    profileRow.current = { onboarded: false };
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'What should the app call you?' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});

describe('sign-in messages', () => {
  it('explains each failure plainly', () => {
    expect(signInMessage(null, true)).toBeNull();
    expect(signInMessage({ message: 'Invalid login credentials', status: 400 }, true)).toMatch(/do not match/);
    expect(signInMessage({ message: 'x', status: 429 }, true)).toMatch(/Wait a minute/);
    expect(signInMessage({ message: 'fetch failed' }, false)).toMatch(/offline/);
  });
});
