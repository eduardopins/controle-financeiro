import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Check } from "lucide-react";
import { C } from "../lib/constants";

const ToastContext = createContext(null);

// Uso: const { showToast } = useToast();
// showToast({ message: "Gasto excluído", actionLabel: "Desfazer", onAction: () => restoreExpense(exp) });
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa ser usado dentro de <ToastProvider>");
  return ctx;
}

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(({ message, actionLabel, onAction, duration = 6000 }) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, actionLabel, onAction }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center px-4 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="animate-item-enter pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm w-full"
            style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow, color: C.text }}>
            <Check size={14} color={C.green} className="shrink-0" />
            <span className="flex-1">{t.message}</span>
            {t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id); }}
                className="text-xs font-semibold shrink-0"
                style={{ color: C.gold }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
