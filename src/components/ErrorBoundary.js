import React from "react";

const CHUNK_RELOAD_KEY = "omca_chunk_reload_attempted";

const isChunkLoadError = (error) => {
  const message = String(error?.message || error || "");
  return (
    error?.name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unexpected token ['"<]/i.test(message)
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App ErrorBoundary caught error:", error, errorInfo);

    if (isChunkLoadError(error)) {
      try {
        const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY);
        if (!alreadyRetried) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
        }
      } catch (e) {
        // Ignore sessionStorage errors
      }
    }
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch (e) {
      // Ignore
    }
    window.location.reload();
  };

  handleGoLogin = () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch (e) {
      // Ignore
    }
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f8fafc",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "460px",
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "28px",
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
              textAlign: "center",
              border: "1px solid #e2e8f0",
            }}
          >
            <h4 style={{ margin: "0 0 10px", color: "#0f172a", fontWeight: 600 }}>
              Something went wrong loading this page
            </h4>
            <p style={{ margin: "0 0 20px", color: "#475569", fontSize: "14px", lineHeight: 1.5 }}>
              A new update may have been deployed or the page encountered an unexpected error.
              Click below to reload the latest version.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoLogin}
                style={{
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
