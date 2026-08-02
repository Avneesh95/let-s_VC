import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-dvh flex items-center justify-center bg-paper px-4">
          <div className="text-center flex flex-col items-center gap-3 max-w-sm">
            <span className="font-display font-semibold text-2xl text-ink tracking-tight">
              chat<span className="text-brand">/</span>app
            </span>
            <p className="text-ink/60 text-sm">
              Something went wrong. Try reloading the page — if it keeps happening, your camera
              or microphone permissions might be the cause.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 bg-brand hover:bg-brand-dark transition-colors text-white font-semibold rounded-lg px-5 py-2 text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
