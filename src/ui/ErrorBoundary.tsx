import { Component, type ReactNode } from 'react';

// A screen that throws shows this instead of a blank page; drafts are already saved on the device.
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { failed: boolean; key: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error('screen failed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-card border-2 border-coral bg-coral-tint p-4">
        <p className="font-bold">This screen tripped over something.</p>
        <p className="mt-2 text-small">Anything you typed is saved on this phone. Reload to try again, or go back to Today.</p>
        <div className="mt-4 flex gap-4">
          <button type="button" className="min-h-12 font-semibold underline decoration-2 underline-offset-4" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="#/" className="inline-flex min-h-12 items-center font-semibold">
            Back to Today
          </a>
        </div>
      </div>
    );
  }
}
