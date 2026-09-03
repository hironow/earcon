import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps one broken section from blanking the whole demo; shows the message and a reset. */
export class ErrorBoundary extends Component<{ children: ReactNode; label: string }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="section" role="alert" data-testid="error-boundary">
        <div className="section__head">
          <h2 className="section__title">{this.props.label} が落ちた</h2>
        </div>
        <div className="config">
          <pre className="row__json" style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <div className="config__actions">
            <button className="btn btn--primary" onClick={() => this.setState({ error: null })}>
              この区画を立て直す
            </button>
          </div>
        </div>
      </section>
    )
  }
}
