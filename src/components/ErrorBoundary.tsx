import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BloomMark } from './Logo'

interface Props {
  children: ReactNode
  /** "page" fills the page; "panel" stays inside a smaller box such as the chat window. */
  size?: 'page' | 'panel'
}

/**
 * Catches an error while showing part of the site, so it shows a friendly message (with the error,
 * for reporting) instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Whimsy & Bloom: something went wrong', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const panel = this.props.size === 'panel'
    return (
      <div role="alert" className={panel ? 'flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface p-6 text-center' : 'mx-auto my-16 max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card'}>
        <BloomMark size={panel ? 36 : 48} className="mx-auto" />
        <p className="font-display text-2xl font-semibold text-green-ink">{panel ? 'The chat hit a snag' : 'Something went wrong'}</p>
        <p className="text-sm text-ink-2">Reloading usually fixes it. Nothing you sent has been lost.</p>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center rounded-full bg-green px-5 text-sm font-medium text-on-green">
          Reload
        </button>
        <p className="break-words text-[11px] text-muted">Error: {error.message || String(error)}</p>
      </div>
    )
  }
}
