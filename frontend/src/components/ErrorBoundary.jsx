import { Component } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Free-tier models don't always return the exact shape a prompt asks
 * for. The rest of the app normalizes and guards against that, but this
 * boundary is the last line of defense — if something still slips
 * through, the user sees a recoverable message instead of a blank
 * white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Legal Buddy crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ margin: "auto", maxWidth: 420, padding: 24, textAlign: "center" }}>
          <AlertTriangle size={22} style={{ marginBottom: 10 }} aria-hidden="true" />
          <p style={{ marginBottom: 12 }}>
            Something went wrong displaying this. This can happen if the AI's
            response came back in an unexpected format.
          </p>
          <button className="upload-button" onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
