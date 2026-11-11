import { Component } from 'react';

// A page opened before a deploy asks for screen files that no longer exist (the "failed to load a module" family).
const STALE_PAGE = /dynamically imported module|Loading chunk|Importing a module script/i;

/** Catches render errors under one route. Shows fixed wording only: the real error goes to the console for us. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info);
    try {
      // Reload once a minute at most, so a real fault can't loop.
      if (STALE_PAGE.test(String(error?.message)) && Date.now() - Number(sessionStorage.getItem('craftme-reload') || 0) > 60000) {
        sessionStorage.setItem('craftme-reload', String(Date.now()));
        window.location.reload();
      }
    } catch { /* storage blocked: the Try again button remains */ }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="wrap page">
        <div className="empty" role="alert">
          <h3>Something went wrong on this page</h3>
          <p>Nothing was lost. Try again, or go back to the home page.</p>
          <button className="btn btn-primary" onClick={() => this.setState({ failed: false })}>Try again</button>
        </div>
      </main>
    );
  }
}
