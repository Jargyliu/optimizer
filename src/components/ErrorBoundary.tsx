import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null; info: string }

/** Shows what went wrong instead of a blank window, and lets the user recover. */
export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack || '' });
    console.error('Tickrate UI error:', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const details = `${error.name}: ${error.message}\n${error.stack ?? ''}\n${info}`;
    return (
      <div className={this.props.compact ? 'py-10' : 'grid h-full place-items-center bg-ink-950 p-10'}>
        <div className="max-w-[640px]">
          <p className="num text-[11px] uppercase tracking-[0.18em] text-bad">Something went wrong</p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">This screen hit an error</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">
            No changes were made because of it. You can try again, or copy the details and send them in a GitHub issue.
            The full log is in %ProgramData%\Tickrate\logs.
          </p>
          <pre className="num mt-4 max-h-56 overflow-auto rounded-xl border border-white/[0.07] bg-ink-900 p-3 text-[11px] leading-relaxed text-fg-muted">{error.message}</pre>
          <div className="mt-4 flex gap-2">
            <button className="h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink" onClick={() => this.setState({ error: null, info: '' })}>Try again</button>
            <button className="h-9 rounded-lg border border-white/[0.08] bg-ink-750 px-4 text-[13px]" onClick={() => navigator.clipboard?.writeText(details)}>Copy details</button>
            <button className="h-9 rounded-lg px-4 text-[13px] text-fg-muted hover:text-fg" onClick={() => location.reload()}>Reload app</button>
          </div>
        </div>
      </div>
    );
  }
}
