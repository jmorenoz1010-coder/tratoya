import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[TratoYA ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F4F6F8", fontFamily: "Inter, sans-serif", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", maxWidth: 440, textAlign: "center", boxShadow: "0 4px 24px rgba(7,25,47,.1)", border: "1px solid #E5E9EE" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
          <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 22, fontWeight: 800, color: "#07192F", marginBottom: 8 }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: 14, color: "#6B7785", lineHeight: 1.6, marginBottom: 22 }}>
            Ocurrió un error inesperado. Tu información está segura. Por favor recarga la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "#A8C400", color: "#07192F", border: "none", borderRadius: 10, padding: "11px 26px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Recargar página
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{ marginTop: 18, background: "#F4F6F8", padding: 12, borderRadius: 8, fontSize: 11, textAlign: "left", overflow: "auto", color: "#D9534F" }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
