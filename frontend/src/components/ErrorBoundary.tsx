import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last line of defence for the whole app.
 *
 * An error that escapes a component — including a throw inside an effect —
 * makes React unmount the entire tree, which in a single-page app means a blank
 * white page with no explanation. That is precisely how a build missing its
 * Supabase env vars used to fail: the menu's `.then()` chain threw before
 * `.catch()` was attached, and the restaurant disappeared.
 *
 * The boundary does not hide the bug: it keeps the page renderable, logs the
 * error with its component stack, and prints the message on screen so a broken
 * deployment explains itself instead of showing nothing.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[khang] the page failed to render:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-[#faf7f2] px-6 py-16 text-center">
        <div className="w-full max-w-lg">
          <div className="font-brush text-6xl leading-none text-khang-ink">康</div>
          <h1 className="mt-3 font-brush text-3xl tracking-tight text-khang-ink">Khang</h1>
          <p className="mt-4 font-body text-sm text-zinc-600">
            Something went wrong while drawing the page.
          </p>

          <pre className="mt-5 max-h-48 overflow-auto rounded-2xl bg-white p-4 text-left font-mono text-[11px] leading-relaxed text-red-700 ring-1 ring-black/5">
            {error.message}
          </pre>

          <button
            type="button"
            onClick={this.reload}
            className="mt-6 rounded-full bg-khang-ink px-7 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-khang-red"
          >
            Reload
          </button>

          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            If this is a fresh deployment, check that VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY are set and the build was run again.
          </p>
        </div>
      </div>
    );
  }
}
