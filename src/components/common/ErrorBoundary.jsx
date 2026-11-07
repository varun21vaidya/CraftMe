import { Component } from 'react';

/** Catches render errors under one route. Shows fixed wording only: the real error goes to the console for us. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info);
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
