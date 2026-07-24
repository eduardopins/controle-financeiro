import React from "react";
import { C } from "../lib/constants";

// Pega qualquer erro de renderização que aconteça em algum componente filho e,
// em vez de deixar o React derrubar a árvore inteira (tela branca sem
// explicação), mostra uma mensagem amigável com um botão pra recarregar.
// React só permite implementar isso com uma classe (não tem equivalente em
// hooks ainda), por isso é a única classe do projeto.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Erro não tratado na interface:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.bg }}>
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold mb-1.5" style={{ color: C.text }}>Algo deu errado.</p>
            <p className="text-xs mb-4" style={{ color: C.muted }}>
              Não conseguimos mostrar essa tela. Seus dados estão salvos — tente recarregar a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-medium px-4 py-2.5 rounded-xl"
              style={{ background: C.gold, color: "var(--gold-contrast)" }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
