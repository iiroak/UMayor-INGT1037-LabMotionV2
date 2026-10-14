import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installViewportGuard } from "./viewportGuard";
import "./styles.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LabMotion render error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto mt-[15vh] max-w-md p-6 text-center">
          <h1 className="text-title font-bold">Algo salió mal</h1>
          <p className="text-body text-text-secondary">Recarga la página para continuar. Tus pruebas registradas siguen guardadas en este navegador.</p>
          <button type="button" className="mt-4 h-12 rounded-full bg-fab px-6 font-semibold text-fab-content" onClick={() => window.location.reload()}>Recargar</button>
        </main>
      );
    }
    return this.props.children;
  }
}

installViewportGuard();

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el elemento root");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
