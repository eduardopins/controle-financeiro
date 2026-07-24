import React, { useState, useEffect } from "react";
import { THEME_CSS } from "./lib/constants";
import { currentMonthKey, isDueIn, monthlyValue, billingInfo, netUsedForCard } from "./lib/domain";
import { fetchCurrentCDI } from "./lib/data";



/* ---------------------------------- font injection ---------------------------------- */

export function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

export function useThemeStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = THEME_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  useEffect(() => {
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggle];
}
export function useCurrentCDI() {
  const [cdi, setCdi] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem("cdi-annual-rate") || "null"); } catch {}
      if (cached && cached.date === today) {
        setCdi(cached.rate);
        setLoading(false);
        return;
      }
      try {
        const rate = await fetchCurrentCDI();
        try { localStorage.setItem("cdi-annual-rate", JSON.stringify({ date: today, rate })); } catch {}
        setCdi(rate);
      } catch {
        if (cached) setCdi(cached.rate);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { cdi, loading };
}

export function showLocalNotification(title, body) {
  const opts = { body, icon: "/icon.svg" };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch {} });
  } else {
    try { new Notification(title, opts); } catch {}
  }
}
export function useBillAlerts(cards, expenses, payments) {
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    const now = currentMonthKey();
    const today = new Date().toISOString().slice(0, 10);
    cards.forEach((c) => {
      const used = netUsedForCard(expenses, payments, c.id, now);
      const pct = c.card_limit ? (used / c.card_limit) * 100 : 0;
      const { daysUntilDue } = billingInfo(c);
      const keyLimit = `notif-limit-${c.id}-${today}`;
      const keyDue = `notif-due-${c.id}-${today}`;
      if (pct >= 80 && !localStorage.getItem(keyLimit)) {
        showLocalNotification("Limite quase no fim", `${c.name}: ${pct.toFixed(0)}% do limite já usado.`);
        localStorage.setItem(keyLimit, "1");
      }
      if (daysUntilDue >= 0 && daysUntilDue <= 5 && !localStorage.getItem(keyDue)) {
        showLocalNotification("Fatura vencendo", `${c.name} vence em ${daysUntilDue} ${daysUntilDue === 1 ? "dia" : "dias"}.`);
        localStorage.setItem(keyDue, "1");
      }
    });
  }, [cards, expenses]);
}
export function useBudgetAlerts(profile, data) {
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const now = currentMonthKey();
    const today = new Date().toISOString().slice(0, 10);
    const myBudgets = data.budgets.filter((b) => b.profile_id === profile.id);
    const dueNow = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now));
    myBudgets.forEach((b) => {
      const spent = dueNow.filter((e) => e.category === b.category).reduce((s, e) => s + monthlyValue(e), 0);
      const pct = b.monthly_limit ? (spent / b.monthly_limit) * 100 : 0;
      const key = `notif-goal-${b.id}-${today}`;
      if (pct >= 100 && !localStorage.getItem(key)) {
        showLocalNotification("Meta estourada", `${b.category}: você já passou da meta (${pct.toFixed(0)}%).`);
        localStorage.setItem(key, "1");
      }
    });
  }, [profile.id, data.budgets, data.expenses]);
}

export function usePersistentTab(key, defaultValue) {
  const [tab, setTabState] = useState(() => {
    try { return localStorage.getItem(key) || defaultValue; } catch { return defaultValue; }
  });
  const setTab = (t) => {
    setTabState(t);
    try { localStorage.setItem(key, t); } catch {}
  };
  return [tab, setTab];
}

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isDesktop;
}

export function useKeyboardShortcuts({ onNewExpense, onNewIncome, onNavigate }) {
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "g" || e.key === "G") { e.preventDefault(); onNewExpense(); }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); onNewIncome(); }
      else if (["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); onNavigate(parseInt(e.key, 10) - 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewExpense, onNewIncome, onNavigate]);
}