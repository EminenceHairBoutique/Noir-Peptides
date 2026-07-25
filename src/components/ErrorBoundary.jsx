import React from "react";
import { Link } from "react-router-dom";
import { reportClientError } from "../lib/errorReporter";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, _info) {
    reportClientError(error, "boundary");
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[70vh] pt-28 pb-24 bg-se-black text-se-bone">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-overline">Noir Peptides</p>
          <h1 className="mt-3 font-display text-[clamp(1.5rem,4vw,2.5rem)] tracking-[0.06em]">
            SOMETHING WENT WRONG
          </h1>
          <p className="mt-3 text-[13px] text-se-bone/50 leading-relaxed">
            A page error occurred. Your cart and browsing session are safe.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary"
            >
              Try Again
            </button>

            <Link to="/" className="btn-outline">
              Return Home
            </Link>
          </div>

          <p className="mt-8 text-[11px] text-se-steel font-accent">
            If this keeps happening, contact support.
          </p>
        </div>
      </div>
    );
  }
}
