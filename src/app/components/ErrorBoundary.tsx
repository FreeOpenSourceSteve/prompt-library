import { Component } from 'react';
import type { ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="standalone-state">
          <h1>Prompt Library could not display this page</h1>
          <p>
            Your saved prompts remain in local storage. Reopen the library to
            try again.
          </p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Reload library
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
