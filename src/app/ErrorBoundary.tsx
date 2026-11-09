import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'

interface State {
  error: Error | null
}

/**
 * A new deployment can leave a tab holding an old index that points at old
 * chunk filenames. The safest recovery is a full reload, which lets the new
 * service worker serve the current build. Runtime errors also land here rather
 * than leaving a blank screen.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No clinical values are logged. Only the error message and component stack.
    console.error('myRheumApp crashed:', error.message, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    const isChunkError = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
      this.state.error.message,
    )

    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
        <div className="card-surface w-full max-w-md rounded-2xl p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-600">
            <ShieldAlert className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">
            {isChunkError ? 'A new version is available' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {isChunkError
              ? 'This tab was opened before an update finished. Reload to load the current version — your saved records are unaffected.'
              : 'The screen could not be rendered. Your records are still saved on this device. Reload to try again.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 dark:bg-teal-400 dark:text-navy-950"
          >
            <RefreshCw className="size-4" aria-hidden /> Reload app
          </button>
          <p className="mt-4 text-[10px] leading-relaxed text-muted">
            If reloading does not help, clear this site&apos;s storage in your browser settings. Export your data
            first if you have kept real records.
          </p>
        </div>
      </div>
    )
  }
}
