import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CreditCard, Plus, Pencil, Trash2, LogOut, LayoutGrid, Wallet, PieChart as PieIcon,
  ListChecks, X, Check, Lock, ChevronRight, Download, AlertTriangle,
  Repeat, Target, Clock, Sun, Moon, Search, Paperclip, TrendingUp, TrendingDown,
  DollarSign, CheckSquare, Square, Zap, Share2, Percent,
} from "lucide-react";

/* ---------------------------------- tokens ---------------------------------- */

const C = {
  bg: "var(--bg)", bgSoft: "var(--bg-soft)", surface: "var(--surface)", surfaceAlt: "var(--surface-alt)",
  border: "var(--border)", borderStrong: "var(--border-strong)",
  gold: "var(--gold)", goldSoft: "var(--gold-soft)", text: "var(--text)", muted: "var(--muted)",
  green: "var(--green)", rose: "var(--rose)", amber: "var(--amber)", shadow: "var(--shadow)",
};

const THEME_CSS = `
html, body, #root { height: 100%; margin: 0; }
body { font-family: 'Inter', sans-serif; }
input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid var(--gold); cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
input[type=range]::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid var(--gold); cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
.theme-dark {
  --bg: #0A0C18; --bg-soft: #10132A; --surface: #151933; --surface-alt: #1C2140;
  --border: rgba(184,147,90,0.14); --border-strong: rgba(184,147,90,0.34);
  --gold: #B8935A; --gold-soft: #D8B885; --text: #F4F1E9; --muted: #8B92AC;
  --green: #5FA88C; --rose: #C97575; --amber: #CBA05A;
  --shadow: 0 10px 34px rgba(0,0,0,0.38);
}
.theme-light {
  --bg: #F7F4EE; --bg-soft: #FFFFFF; --surface: #FFFFFF; --surface-alt: #F1EBDD;
  --border: rgba(122,95,45,0.16); --border-strong: rgba(122,95,45,0.32);
  --gold: #8A6A34; --gold-soft: #6E5427; --text: #201D17; --muted: #726A59;
  --green: #2F7A5C; --rose: #A8504F; --amber: #8A6A2A;
  --shadow: 0 10px 28px rgba(70,55,25,0.10);
}
`;

const CATEGORIES = ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Compras", "Educação", "Outros"];
const CAT_COLORS = {
  "Alimentação": "#F59E0B", "Moradia": "#3B82F6", "Transporte": "#10B981",
  "Lazer": "#EC4899", "Saúde": "#EF4444", "Compras": "#8B5CF6",
  "Educação": "#06B6D4", "Outros": "#6B7280",
};
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ---------------------------------- utils ---------------------------------- */

const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const firstName = (n) => (n || "").split(" ")[0];
const monthKeyFromDate = (dateStr) => dateStr.slice(0, 7);
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
function diffMonths(fromKey, toKey) {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`; };
function addMonthsToKey(key, n) {
  const [y, m] = key.split("-").map(Number);
  const total = (m - 1) + n;
  return `${y + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
const last6Months = () => { const now = currentMonthKey(); return Array.from({ length: 6 }, (_, i) => addMonthsToKey(now, i - 5)); };

function isDueIn(exp, monthKey) {
  const idx = diffMonths(exp.first_month, monthKey);
  if (exp.is_recurring) return idx >= 0;
  return idx >= 0 && idx < exp.installments;
}
function monthlyValue(exp) {
  return exp.is_recurring ? exp.total_amount : exp.total_amount / exp.installments;
}
function outstanding(exp, nowKey = currentMonthKey()) {
  if (exp.is_recurring) return 0;
  const done = Math.min(Math.max(diffMonths(exp.first_month, nowKey), 0), exp.installments);
  const monthly = exp.total_amount / exp.installments;
  return Math.max(exp.total_amount - done * monthly, 0);
}
function billingInfo(card) {
  const now = new Date();
  const day = now.getDate();
  const closed = day > card.closing_day;
  let dueDate = new Date(now.getFullYear(), now.getMonth() + (day > card.due_day ? 1 : 0), card.due_day);
  const daysUntilDue = Math.ceil((dueDate - now) / 86400000);
  return { status: closed ? "fechada" : "aberta", daysUntilDue };
}
function toCSV(rows, cardName, personName) {
  const header = ["Data", "Descrição", "Categoria", "Pessoa", "Cartão", "Valor da parcela/mês", "Parcelas", "Recorrente"];
  const lines = rows.map((e) => [
    e.purchase_date, e.description, e.category, personName(e.profile_id), cardName(e.card_id),
    monthlyValue(e).toFixed(2), e.is_recurring ? "-" : `${e.installments}x`, e.is_recurring ? "sim" : "não",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
  return [header.join(";"), ...lines].join("\n");
}
function downloadCSV(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
function periodToRange(period, custom) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const end = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (period === "custom") return { start: custom.start || end, end: custom.end || end };
  if (period === "month") return { start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`, end };
  const monthsBack = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 }[period];
  const startDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, today.getDate());
  return { start: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`, end };
}

function isIncomeDueIn(inc, monthKey) {
  const idx = diffMonths(inc.first_month, monthKey);
  if (inc.is_recurring) return idx >= 0;
  return idx === 0;
}
function nextInvoiceProjection(cardId, expenses, nowKey = currentMonthKey()) {
  const nextKey = addMonthsToKey(nowKey, 1);
  return expenses.filter((e) => e.card_id === cardId && isDueIn(e, nextKey)).reduce((s, e) => s + monthlyValue(e), 0);
}
function categoryComparison(expenses, thisKey, prevKey, profileIds = null) {
  const scoped = profileIds ? expenses.filter((e) => profileIds.includes(e.profile_id)) : expenses;
  return allCategoryNames(scoped).map((cat) => {
    const current = scoped.filter((e) => e.category === cat && isDueIn(e, thisKey)).reduce((s, e) => s + monthlyValue(e), 0);
    const previous = scoped.filter((e) => e.category === cat && isDueIn(e, prevKey)).reduce((s, e) => s + monthlyValue(e), 0);
    return { category: cat, current, previous };
  }).filter((d) => d.current > 0 || d.previous > 0);
}
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

const BANK_BRANDS = {
  "nubank": { label: "Nubank", color: "#8A05BE", mono: "NU" },
  "itau": { label: "Itaú", color: "#EC7000", mono: "IT" },
  "itaú": { label: "Itaú", color: "#EC7000", mono: "IT" },
  "inter": { label: "Inter", color: "#FF7A00", mono: "IN" },
  "bradesco": { label: "Bradesco", color: "#CC092F", mono: "BR" },
  "santander": { label: "Santander", color: "#EC0000", mono: "SA" },
  "banco do brasil": { label: "Banco do Brasil", color: "#F8D117", mono: "BB", darkText: true },
  "caixa": { label: "Caixa", color: "#0070AD", mono: "CX" },
  "c6": { label: "C6 Bank", color: "#242424", mono: "C6" },
  "picpay": { label: "PicPay", color: "#21C25E", mono: "PP" },
  "mercado pago": { label: "Mercado Pago", color: "#00AAFF", mono: "MP" },
  "next": { label: "Next", color: "#00E28A", mono: "NX", darkText: true },
  "xp": { label: "XP", color: "#000000", mono: "XP" },
  "neon": { label: "Neon", color: "#00D2C3", mono: "NE", darkText: true },
  "will": { label: "Will Bank", color: "#FFD200", mono: "WB", darkText: true },
  "original": { label: "Banco Original", color: "#00A868", mono: "OR" },
  "btg": { label: "BTG Pactual", color: "#0B2545", mono: "BT" },
  "magalu": { label: "Magalu", color: "#0087FF", mono: "MG" },
  "luizacred": { label: "Magalu", color: "#0087FF", mono: "MG" },
};
function detectBank(name) {
  const n = (name || "").toLowerCase();
  for (const key of Object.keys(BANK_BRANDS)) {
    if (n.includes(key)) return BANK_BRANDS[key];
  }
  return null;
}

function anyCardAlert(cards, expenses) {
  const now = currentMonthKey();
  return cards.some((c) => {
    const used = expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
    const pct = c.card_limit ? (used / c.card_limit) * 100 : 0;
    const { daysUntilDue } = billingInfo(c);
    return pct >= 80 || daysUntilDue <= 5;
  });
}

/* ---------------------------------- font injection ---------------------------------- */

function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

function useThemeStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = THEME_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
}

function useTheme() {
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

function shade(hex, percent) {
  const f = parseInt(hex.slice(1), 16), t = percent < 0 ? 0 : 255, p = Math.abs(percent);
  const R = f >> 16, G = (f >> 8) & 0x00ff, B = f & 0x0000ff;
  return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}
const HERO_GRADIENT = "linear-gradient(135deg, #7C3AED, #4C1D95)";

function HeroPanel({ label, value, sub }) {
  return (
    <div className="rounded-3xl p-6 mb-4 relative overflow-hidden" style={{ background: HERO_GRADIENT, boxShadow: "0 14px 34px rgba(76,29,149,0.35)" }}>
      <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", left: -25, bottom: -55, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <span className="text-xs relative" style={{ color: "rgba(255,255,255,0.75)" }}>{label}</span>
      <div className="mt-1 relative">
        <span className="text-3xl font-extrabold" style={{ color: "#fff", fontFamily: "'Manrope', sans-serif", fontVariantNumeric: "tabular-nums" }}>{brl(value)}</span>
      </div>
      {sub && <div className="mt-1 relative text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>{sub}</div>}
    </div>
  );
}

function friendlyError(e) {
  const msg = (e?.message || "").toLowerCase();
  const code = e?.code || "";
  if (msg.includes("schema cache") || msg.includes("column")) return "O sistema está sendo atualizado. Tente novamente em alguns minutos.";
  if (msg.includes("row-level security") || msg.includes("permission denied") || code === "42501") return "Você não tem permissão para fazer essa ação.";
  if (msg.includes("duplicate key") || code === "23505") return "Esse item já existe.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Sem conexão com a internet. Verifique e tente de novo.";
  if (msg.includes("jwt") || msg.includes("expired") || msg.includes("token")) return "Sua sessão expirou. Saia e entre novamente.";
  if (!msg) return "Não foi possível salvar. Tente novamente.";
  return "Não foi possível salvar. Tente novamente em instantes.";
}

function Switch({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="relative shrink-0 transition-all" style={{ width: 40, height: 23, borderRadius: 999, background: checked ? C.gold : C.bgSoft, border: `1px solid ${checked ? C.gold : C.border}` }}>
      <span className="absolute rounded-full transition-all" style={{ width: 17, height: 17, background: "#fff", top: 2, left: checked ? 20 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
    </button>
  );
}
function IconField({ icon, ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }}>{icon}</span>
      <TextInput {...props} style={{ paddingLeft: 26, ...(props.style || {}) }} />
    </div>
  );
}

function formatMoneyFromCents(cents) {
  const reais = Math.floor(cents / 100);
  const centsPart = (cents % 100).toString().padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${centsPart}`;
}
function CurrencyInput({ value, onChange, placeholder = "0,00", style, autoFocus }) {
  const [display, setDisplay] = useState(() => {
    const cents = value !== "" && value != null && !isNaN(value) ? Math.round(parseFloat(value) * 100) : 0;
    return cents ? formatMoneyFromCents(cents) : "";
  });
  useEffect(() => {
    const cents = value !== "" && value != null && !isNaN(value) ? Math.round(parseFloat(value) * 100) : 0;
    setDisplay(cents ? formatMoneyFromCents(cents) : "");
  }, [value]);
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setDisplay(""); onChange(""); return; }
    const cents = parseInt(raw, 10);
    setDisplay(formatMoneyFromCents(cents));
    onChange(String(cents / 100));
  };
  return <TextInput inputMode="numeric" value={display} onChange={handleChange} placeholder={placeholder} style={style} autoFocus={autoFocus} />;
}
function CurrencyIconField({ icon, value, onChange, style }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }}>{icon}</span>
      <CurrencyInput value={value} onChange={onChange} style={{ paddingLeft: 26, ...(style || {}) }} />
    </div>
  );
}

/* ---------------------------------- UI atoms ---------------------------------- */

function Panel({ children, style, className = "" }) {
  return <div className={`rounded-2xl p-5 ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: C.shadow, ...style }}>{children}</div>;
}
function Btn({ children, onClick, variant = "primary", type = "button", full, disabled }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50";
  const styles = {
    primary: { background: C.gold, color: "#1A1607" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.rose, border: `1px solid rgba(221,124,134,0.35)` },
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${full ? "w-full" : ""}`} style={styles[variant]}>{children}</button>;
}
function Field({ label, children }) {
  return <label className="block mb-3.5"><span className="block text-xs mb-1.5 tracking-wide" style={{ color: C.muted }}>{label}</span>{children}</label>;
}
const inputStyle = { background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text };
const inputClass = "w-full rounded-lg px-3 py-2.5 text-base outline-none focus:ring-1";
function TextInput(props) { return <input {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} className={inputClass} style={inputStyle} />; }
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(6,8,20,0.75)" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{title}</h3>
          <button onClick={onClose}><X size={18} color={C.muted} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Amount({ value, size = "text-lg", tone }) {
  const color = tone === "rose" ? C.rose : tone === "green" ? C.green : C.text;
  return <span className={size} style={{ fontFamily: "'IBM Plex Mono', monospace", color, fontVariantNumeric: "tabular-nums" }}>{brl(value)}</span>;
}
function ProgressBar({ pct, tone = "gold" }) {
  const color = tone === "rose" ? C.rose : tone === "green" ? C.green : C.gold;
  return <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} /></div>;
}
function Chip({ tone = "muted", icon, children }) {
  const colors = { rose: C.rose, amber: C.amber, muted: C.muted, green: C.green };
  const color = colors[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${color}1F`, color }}>
      {icon}{children}
    </span>
  );
}
function ScreenHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{subtitle}</p>}
    </div>
  );
}
function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 gap-2">
      <div style={{ color: C.muted, opacity: 0.6 }}>{icon}</div>
      <p className="text-sm" style={{ color: C.muted }}>{text}</p>
    </div>
  );
}
function periodPresetLabel(id) {
  return { month: "Este mês", "1m": "1 mês", "3m": "3 meses", "6m": "6 meses", "12m": "12 meses", custom: "Personalizado" }[id];
}
function PeriodFilter({ value, onChange, customRange, onCustomChange }) {
  const [open, setOpen] = useState(false);
  const presets = ["month", "1m", "3m", "6m", "12m", "custom"];
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: open ? C.gold : "transparent", color: open ? "#1A1607" : C.muted, border: `1px solid ${open ? C.gold : C.border}` }}>
        <Clock size={12} /> {periodPresetLabel(value)}
        <ChevronRight size={13} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div className="w-full mt-2">
          <div className="flex gap-1.5 flex-wrap mb-2">
            {presets.map((p) => (
              <button key={p} onClick={() => { onChange(p); if (p !== "custom") setOpen(false); }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: value === p ? C.gold : "transparent", color: value === p ? "#1A1607" : C.muted, border: `1px solid ${value === p ? C.gold : C.border}` }}>
                {periodPresetLabel(p)}
              </button>
            ))}
          </div>
          {value === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <TextInput type="date" value={customRange.start} onChange={(e) => onCustomChange({ ...customRange, start: e.target.value })} />
              <TextInput type="date" value={customRange.end} onChange={(e) => onCustomChange({ ...customRange, end: e.target.value })} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------------------------- bottom navigation ---------------------------------- */

function BottomNav({ tabs, tab, setTab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ background: "var(--surface)", borderTop: `1px solid ${C.border}`, boxShadow: "0 -8px 24px rgba(0,0,0,0.12)" }}>
      <div className="max-w-3xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-1 py-2.5 transition-all">
              <div className="relative" style={{ color: active ? C.gold : C.muted }}>
                {t.icon}
                {t.badge && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full" style={{ background: C.rose }} />}
              </div>
              <span className="text-[10px] font-medium" style={{ color: active ? C.gold : C.muted }}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}

/* ---------------------------------- data layer (Supabase) ---------------------------------- */

async function loadAll() {
  const [profiles, cards, cardAccess, expenses, budgets, incomes, customCategories] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("card_access").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("incomes").select("*"),
    supabase.from("custom_categories").select("*"),
  ]);
  const cardsWithMembers = (cards.data || []).map((c) => ({
    ...c,
    memberIds: (cardAccess.data || []).filter((a) => a.card_id === c.id).map((a) => a.profile_id),
  }));
  return {
    profiles: profiles.data || [],
    cards: cardsWithMembers,
    expenses: expenses.data || [],
    budgets: budgets.data || [],
    incomes: incomes.data || [],
    customCategories: customCategories.data || [],
  };
}

async function saveCard(card) {
  const { memberIds, ...rest } = card;
  const isNew = !card.id;
  let cardId = card.id;
  if (isNew) {
    const { data, error } = await supabase.from("cards").insert(rest).select().single();
    if (error) throw error;
    cardId = data.id;
  } else {
    const { error } = await supabase.from("cards").update(rest).eq("id", cardId);
    if (error) throw error;
  }
  const { error: delErr } = await supabase.from("card_access").delete().eq("card_id", cardId);
  if (delErr) throw delErr;
  if (memberIds.length) {
    const { error: accErr } = await supabase.from("card_access").insert(memberIds.map((profile_id) => ({ card_id: cardId, profile_id })));
    if (accErr) throw accErr;
  }
}
async function deleteCard(card) {
  const { error } = await supabase.from("cards").delete().eq("id", card.id);
  if (error) throw error;
}
async function uploadReceipt(file, profileId) {
  const path = `${profileId}/${Date.now()}_${file.name}`.replace(/\s+/g, "_");
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}
async function saveExpense(exp) {
  const isNew = !exp.id;
  const payload = {
    card_id: exp.cardId || null, profile_id: exp.userId, category: exp.category, description: exp.description,
    total_amount: exp.totalAmount, purchase_date: exp.date, first_month: exp.firstMonth,
    installments: exp.installments, is_recurring: exp.isRecurring, receipt_url: exp.receiptUrl ?? null,
  };
  const { error } = isNew
    ? await supabase.from("expenses").insert(payload)
    : await supabase.from("expenses").update(payload).eq("id", exp.id);
  if (error) throw error;
}
async function deleteExpense(exp) {
  const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
  if (error) throw error;
}
async function saveBudget(profileId, category, monthly_limit) {
  const { error } = await supabase.from("budgets").upsert({ profile_id: profileId, category, monthly_limit }, { onConflict: "profile_id,category" });
  if (error) throw error;
}
async function deleteBudget(budgetId) {
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
}
async function saveIncome(inc) {
  const payload = {
    profile_id: inc.profileId, description: inc.description, amount: inc.amount,
    income_date: inc.date, first_month: monthKeyFromDate(inc.date), is_recurring: inc.isRecurring,
  };
  const { error } = inc.id
    ? await supabase.from("incomes").update(payload).eq("id", inc.id)
    : await supabase.from("incomes").insert(payload);
  if (error) throw error;
}
async function deleteIncome(inc) {
  const { error } = await supabase.from("incomes").delete().eq("id", inc.id);
  if (error) throw error;
}

/* ---------------------------------- LOGIN ---------------------------------- */

function Login({ onLogin, theme, onToggleTheme }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("E-mail ou senha incorretos."); return; }
    onLogin(data.user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative" style={{ background: C.bg }}>
      <div className="absolute top-5 right-5">
        <button onClick={onToggleTheme} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
          {theme === "dark" ? <Sun size={15} color={C.gold} /> : <Moon size={15} color={C.gold} />}
        </button>
      </div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Wallet size={26} color={C.gold} />
          <span className="text-xl font-semibold tracking-wide" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>Controle Financeiro</span>
        </div>
        <Panel>
          <Field label="E-mail"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Field label="Senha">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
          <Btn full onClick={submit} disabled={loading || !email || !password}><Lock size={14} /> Entrar</Btn>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------- TOPBAR ---------------------------------- */

function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} className="w-8 h-8 rounded-full flex items-center justify-center transition-all" style={{ border: `1px solid ${C.border}` }}>
      {theme === "dark" ? <Sun size={14} color={C.gold} /> : <Moon size={14} color={C.gold} />}
    </button>
  );
}

function TopBar({ profile, onLogout, theme, onToggleTheme }) {
  return (
    <div className="sticky top-0 z-30" style={{ background: "var(--bg)", borderBottom: `1px solid ${C.border}`, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} color={C.gold} />
          <span className="text-sm font-semibold tracking-wide" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{firstName(profile.name)}</span>
          {profile.role === "admin" && <Chip>admin</Chip>}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button onClick={onLogout}><LogOut size={17} color={C.muted} /></button>
        </div>
      </div>
    </div>
  );
}

function loadTesseractScript() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const existing = document.querySelector('script[data-tesseract]');
    if (existing) { existing.addEventListener("load", () => resolve(window.Tesseract)); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.setAttribute("data-tesseract", "1");
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("Não foi possível carregar o leitor de comprovantes."));
    document.head.appendChild(script);
  });
}
async function extractReceiptData(file) {
  const Tesseract = await loadTesseractScript();
  const { data: { text } } = await Tesseract.recognize(file, "por");
  const amounts = [...text.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => parseFloat(m[1].replace(/\./g, "").replace(",", ".")));
  const amount = amounts.length ? Math.max(...amounts) : null;
  const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  let date = null;
  if (dateMatch) {
    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = "20" + y;
    const candidate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!isNaN(new Date(candidate).getTime())) date = candidate;
  }
  return { amount, date };
}

/* ---------------------------------- EXPENSE FORM ---------------------------------- */

function ExpenseForm({ cards, userId, onSave, onClose, initial, allProfiles, customCategories, onAddCategory, startWithNoCard }) {
  const [selectedUserId, setSelectedUserId] = useState(initial?.profile_id || userId);
  const [cardId, setCardId] = useState(() => {
    if (initial) return initial.card_id || "";
    return startWithNoCard ? "" : (cards[0]?.id || "");
  });
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [description, setDescription] = useState(initial?.description || "");
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount ?? "");
  const [date, setDate] = useState(initial?.purchase_date || new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState(initial?.installments || 1);
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring || false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [existingReceipt, setExistingReceipt] = useState(initial?.receipt_url || null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState("");
  const [err, setErr] = useState("");
  const people = allProfiles || [];
  const splitCandidates = people.filter((p) => p.id !== selectedUserId);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitWith, setSplitWith] = useState(splitCandidates[0]?.id || "");
  const [splitPct, setSplitPct] = useState(50);
  const categoryOptions = [...CATEGORIES, ...(customCategories || []).filter((c) => c.profile_id === selectedUserId).map((c) => c.name)];

  const totalNum = parseFloat(totalAmount) || 0;
  const pct = Math.min(100, Math.max(0, parseFloat(splitPct) || 0));
  const amountA = totalNum * (pct / 100);
  const amountB = totalNum - amountA;
  const onChangePct = (v) => setSplitPct(v);
  const onChangeAmountA = (v) => { const n = parseFloat(v) || 0; setSplitPct(totalNum > 0 ? (n / totalNum) * 100 : 0); };
  const onChangeAmountB = (v) => { const n = parseFloat(v) || 0; setSplitPct(totalNum > 0 ? 100 - (n / totalNum) * 100 : 0); };

  const submitNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categoryOptions.includes(name)) { setCategory(name); setAddingCategory(false); setNewCategoryName(""); return; }
    try {
      await onAddCategory?.(selectedUserId, name);
      setCategory(name);
    } catch {
      // se falhar, a pessoa ainda pode digitar a categoria manualmente na próxima tentativa
    } finally {
      setAddingCategory(false); setNewCategoryName("");
    }
  };

  const handleReceiptChange = async (file) => {
    setReceiptFile(file);
    if (!file || initial) return;
    setImporting(true); setImportNote("");
    try {
      const { amount, date: foundDate } = await extractReceiptData(file);
      if (amount) setTotalAmount(String(amount));
      if (foundDate) setDate(foundDate);
      setImportNote(amount ? "Dados lidos do comprovante — confira antes de salvar." : "Não conseguimos identificar o valor automaticamente. Preencha manualmente.");
    } catch {
      setImportNote("Não foi possível ler o comprovante automaticamente. Preencha manualmente.");
    } finally {
      setImporting(false);
    }
  };

  const submit = async () => {
    if (!description.trim() || !totalAmount) return;
    setSaving(true); setErr("");
    try {
      let receiptUrl = existingReceipt;
      if (receiptFile) receiptUrl = await uploadReceipt(receiptFile, selectedUserId);
      const base = {
        cardId, category, description: description.trim(), date, firstMonth: monthKeyFromDate(date),
        installments: isRecurring ? 1 : Math.max(1, parseInt(installments) || 1), isRecurring,
      };
      let toSave;
      if (splitEnabled && splitWith) {
        const amountAPrecise = Math.round(amountA * 1000) / 1000;
        const amountBPrecise = Math.round((totalNum - amountAPrecise) * 1000) / 1000;
        toSave = [
          { ...base, id: initial?.id, userId: selectedUserId, totalAmount: amountAPrecise, receiptUrl },
          { ...base, userId: splitWith, totalAmount: amountBPrecise, receiptUrl: null },
        ];
      } else {
        toSave = [{ ...base, id: initial?.id, userId: selectedUserId, totalAmount: totalNum, receiptUrl }];
      }
      await onSave(toSave);
      onClose();
    } catch (e) {
      setSaving(false);
      setErr(friendlyError(e));
    }
  };

  return (
    <Modal title={initial ? "Editar gasto" : "Novo gasto"} onClose={onClose}>
      {!initial && (
        <Field label="Importar de foto ou print (opcional)">
          <input type="file" accept="image/*" onChange={(e) => handleReceiptChange(e.target.files?.[0] || null)}
            className="text-xs" style={{ color: C.muted }} />
          {importing && <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: C.muted }}><Clock size={11} /> Lendo comprovante...</p>}
          {importNote && !importing && <p className="text-xs mt-1.5" style={{ color: C.gold }}>{importNote}</p>}
        </Field>
      )}

      <p className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.gold }}>Quem e onde</p>
      <div className={people.length > 1 ? "grid grid-cols-2 gap-3 mb-3.5" : "mb-3.5"}>
        {people.length > 1 && (
          <Field label="Pessoa">
            <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {people.map((p) => <option key={p.id} value={p.id}>{firstName(p.name)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Cartão">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Dinheiro/Pix</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      </div>

      <p className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.gold }}>O que foi</p>
      <Field label="Descrição"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Supermercado" /></Field>
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <Field label="Categoria">
          {addingCategory ? (
            <div className="flex gap-1.5">
              <TextInput value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" autoFocus />
              <button onClick={submitNewCategory}><Check size={16} color={C.green} /></button>
              <button onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}><X size={16} color={C.muted} /></button>
            </div>
          ) : (
            <Select value={category} onChange={(e) => e.target.value === "__add__" ? setAddingCategory(true) : setCategory(e.target.value)}>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__add__">+ Nova categoria...</option>
            </Select>
          )}
        </Field>
        <Field label="Valor (R$)"><CurrencyInput value={totalAmount} onChange={setTotalAmount} /></Field>
      </div>

      <p className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.gold }}>Quando</p>
      <Field label="Data da compra"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

      <label className="flex items-center gap-2.5 text-sm mb-3.5" style={{ color: C.text }}>
        <Switch checked={isRecurring} onChange={setIsRecurring} />
        <Repeat size={14} color={C.muted} /> Gasto recorrente (todo mês, ex: assinatura)
      </label>

      {!isRecurring && (
        <Field label="Parcelas"><TextInput type="number" min="1" max="48" value={installments} onChange={(e) => setInstallments(e.target.value)} /></Field>
      )}
      {!isRecurring && installments > 1 && totalAmount && (
        <p className="text-xs mb-3" style={{ color: C.muted }}>{installments}x de <b style={{ color: C.goldSoft }}>{brl(totalAmount / installments)}</b></p>
      )}

      {!initial && splitCandidates.length > 0 && (
        <div className="mb-3.5">
          <p className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.gold }}>Dividir</p>
          <label className="flex items-center gap-2.5 text-sm mb-2" style={{ color: C.text }}>
            <Switch checked={splitEnabled} onChange={(v) => { setSplitEnabled(v); if (!splitWith) setSplitWith(splitCandidates[0]?.id || ""); }} />
            Dividir com outra pessoa
          </label>
          {splitEnabled && (
            <div className="rounded-xl p-3.5" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
              <Field label="Dividir com">
                <Select value={splitWith} onChange={(e) => setSplitWith(e.target.value)}>
                  {splitCandidates.map((p) => <option key={p.id} value={p.id}>{firstName(p.name)}</option>)}
                </Select>
              </Field>

              <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: C.text }}>
                <span className="font-medium">{firstName(people.find((p) => p.id === selectedUserId)?.name || "Você")}</span>
                <span className="font-medium">{firstName(splitCandidates.find((p) => p.id === splitWith)?.name || "")}</span>
              </div>
              <input type="range" min="0" max="100" step="1" value={pct} onChange={(e) => onChangePct(e.target.value)}
                className="w-full mb-1.5"
                style={{ background: `linear-gradient(to right, ${C.gold} 0%, ${C.gold} ${pct}%, #7C3AED ${pct}%, #7C3AED 100%)` }} />
              <div className="flex items-center justify-between text-xs mb-3" style={{ color: C.muted }}>
                <span>{brl(amountA)}</span>
                <span>{brl(amountB)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <Field label={`${firstName(people.find((p) => p.id === selectedUserId)?.name || "Você")}`}>
                  <CurrencyIconField icon={<DollarSign size={13} />} value={amountA ? String(amountA) : ""} onChange={(v) => onChangeAmountA(v)} />
                </Field>
                <Field label="Sua parte">
                  <IconField icon={<Percent size={13} />} type="number" min="0" max="100" value={splitPct} onChange={(e) => onChangePct(e.target.value)} />
                </Field>
                <Field label={`${firstName(splitCandidates.find((p) => p.id === splitWith)?.name || "")}`}>
                  <CurrencyIconField icon={<DollarSign size={13} />} value={amountB ? String(amountB) : ""} onChange={(v) => onChangeAmountB(v)} />
                </Field>
              </div>
            </div>
          )}
        </div>
      )}

      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      {initial && (
        <Field label="Comprovante (opcional)">
          {existingReceipt && !receiptFile && (
            <div className="flex items-center justify-between mb-2 text-xs" style={{ color: C.muted }}>
              <a href={existingReceipt} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 underline" style={{ color: C.gold }}>
                <Paperclip size={12} /> Ver comprovante atual
              </a>
              <button onClick={() => setExistingReceipt(null)}><X size={13} color={C.rose} /></button>
            </div>
          )}
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="text-xs" style={{ color: C.muted }} />
        </Field>
      )}
      <Btn full onClick={submit} disabled={saving || importing}>{saving ? "Salvando..." : "Salvar gasto"}</Btn>
    </Modal>
  );
}

/* ---------------------------------- CARD FORM (admin) ---------------------------------- */

function CardForm({ allProfiles, onSave, onClose, initial }) {
  const [name, setName] = useState(initial?.name || "");
  const [limit, setLimit] = useState(initial?.card_limit ?? "");
  const [closingDay, setClosingDay] = useState(initial?.closing_day || 1);
  const [dueDay, setDueDay] = useState(initial?.due_day || 10);
  const [memberIds, setMemberIds] = useState(initial?.memberIds || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (id) => setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!name.trim() || !limit) return;
    setSaving(true); setErr("");
    try {
      await onSave({ id: initial?.id, name: name.trim(), card_limit: parseFloat(limit), closing_day: parseInt(closingDay), due_day: parseInt(dueDay), memberIds });
      onClose();
    } catch (e) {
      setSaving(false);
      setErr(friendlyError(e));
    }
  };

  return (
    <Modal title={initial ? "Editar cartão" : "Novo cartão"} onClose={onClose}>
      <Field label="Nome do cartão"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank Roxinho" /></Field>
      {detectBank(name) && (
        <div className="flex items-center gap-2 -mt-2.5 mb-3.5 text-xs" style={{ color: C.muted }}>
          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: detectBank(name).color }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: detectBank(name).darkText ? "#1A1607" : "#FFFFFF" }}>{detectBank(name).mono}</span>
          </div>
          Identificamos: {detectBank(name).label}
        </div>
      )}
      <Field label="Limite total (R$)"><CurrencyInput value={limit} onChange={setLimit} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia de fechamento"><TextInput type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} /></Field>
        <Field label="Dia de vencimento"><TextInput type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
      </div>
      <Field label="Quem tem acesso a este cartão">
        <div className="flex flex-col gap-2 mt-1">
          {allProfiles.map((u) => (
            <label key={u.id} className="flex items-center gap-2.5 text-sm" style={{ color: C.text }}>
              <Switch checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
              {firstName(u.name)}
            </label>
          ))}
        </div>
      </Field>
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar cartão"}</Btn>
    </Modal>
  );
}

/* ---------------------------------- CARD WIDGET ---------------------------------- */

function CardWidget({ card, used, nextAmount }) {
  const pct = card.card_limit ? (used / card.card_limit) * 100 : 0;
  const tone = pct > 85 ? "rose" : pct > 60 ? "gold" : "green";
  const { status, daysUntilDue } = billingInfo(card);
  const brand = detectBank(card.name);
  const base = brand ? brand.color : "#7C3AED";
  const gradient = `linear-gradient(135deg, ${base}, ${shade(base, -0.4)})`;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ boxShadow: C.shadow }}>
      {/* face do cartão */}
      <div className="relative p-4" style={{ background: gradient, minHeight: 118 }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.10)" }} />
        <div className="flex items-start justify-between relative">
          <div className="rounded-md" style={{ width: 30, height: 22, background: "linear-gradient(135deg, #F4E4B5, #C9A24C)" }} />
          <div className="flex items-center gap-1.5">
            {pct >= 80 && <Chip tone="rose" icon={<AlertTriangle size={10} />}>{pct.toFixed(0)}%</Chip>}
            {daysUntilDue <= 5 && <Chip tone="amber" icon={<Clock size={10} />}>{daysUntilDue}d</Chip>}
          </div>
        </div>
        <div className="mt-4 relative text-sm" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 2 }}>
          •••• •••• •••• ••••
        </div>
        <div className="flex items-end justify-between mt-3 relative">
          <div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 }}>CARTÃO</div>
            <div className="text-xs font-semibold truncate max-w-[140px]" style={{ color: "#fff", fontFamily: "'Manrope', sans-serif" }}>{card.name}</div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 }}>VENCE</div>
            <div className="text-xs font-semibold" style={{ color: "#fff", fontFamily: "'Manrope', sans-serif" }}>dia {card.due_day}</div>
          </div>
        </div>
      </div>
      {/* detalhes / limite */}
      <div className="p-4" style={{ background: C.surface }}>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px]" style={{ color: C.muted }}>disponível</span>
          <Amount value={Math.max(card.card_limit - used, 0)} size="text-base" tone={tone === "rose" ? "rose" : undefined} />
        </div>
        <ProgressBar pct={pct} tone={tone} />
        <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: C.muted }}>
          <span>usado {brl(used)}</span><span>limite {brl(card.card_limit)}</span>
        </div>
        <div className="mt-2 text-[10px]" style={{ color: C.muted }}>
          fatura {status} · fecha dia {card.closing_day}
        </div>
        {nextAmount > 0 && (
          <div className="mt-1.5 text-[11px] flex items-center gap-1" style={{ color: C.muted }}>
            <TrendingUp size={11} /> próxima fatura ~ {brl(nextAmount)}
          </div>
        )}
      </div>
    </div>
  );
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

/* ---------------------------------- EXPENSE ROW ---------------------------------- */

function ExpenseRow({ exp, cardName, personName, onEdit, onDelete, showPerson, selectable, selected, onToggleSelect }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
      {selectable && (
        <button onClick={() => onToggleSelect(exp.id)} className="shrink-0">
          {selected ? <CheckSquare size={16} color={C.gold} /> : <Square size={16} color={C.muted} />}
        </button>
      )}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(exp.category) }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: C.text }}>
          {exp.description}{exp.is_recurring && <Repeat size={11} color={C.muted} />}
          {exp.receipt_url && <a href={exp.receipt_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Paperclip size={11} color={C.muted} /></a>}
        </div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {formatShortDate(exp.purchase_date)} · {exp.category} · {cardName}{showPerson ? ` · ${personName}` : ""}
          {!exp.is_recurring && exp.installments > 1 && ` · ${exp.installments}x`}
          {exp.is_recurring && " · recorrente"}
        </div>
      </div>
      <Amount value={monthlyValue(exp)} size="text-sm" />
      <button onClick={() => onEdit(exp)}><Pencil size={14} color={C.muted} /></button>
      <button onClick={() => onDelete(exp)}><Trash2 size={14} color={C.rose} /></button>
    </div>
  );
}

function incomeMonthlyValue(inc) { return inc.amount; }

function IncomeForm({ profileId, onSave, onClose, initial }) {
  const [description, setDescription] = useState(initial?.description || "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [date, setDate] = useState(initial?.income_date || new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring || false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!description.trim() || !amount) return;
    setSaving(true); setErr("");
    try {
      await onSave({ id: initial?.id, profileId, description: description.trim(), amount: parseFloat(amount), date, isRecurring });
      onClose();
    } catch (e) {
      setSaving(false);
      setErr(friendlyError(e));
    }
  };

  return (
    <Modal title={initial ? "Editar receita" : "Nova receita"} onClose={onClose}>
      <Field label="Descrição"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Salário" /></Field>
      <Field label="Valor (R$)"><CurrencyInput value={amount} onChange={setAmount} /></Field>
      <Field label="Data"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <label className="flex items-center gap-2.5 text-sm mb-3.5" style={{ color: C.text }}>
        <Switch checked={isRecurring} onChange={setIsRecurring} />
        <Repeat size={14} color={C.muted} /> Receita recorrente (todo mês)
      </label>
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar receita"}</Btn>
    </Modal>
  );
}

function IncomeSection({ profile, data, refresh }) {
  const now = currentMonthKey();
  const [showForm, setShowForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const myCards = data.cards.filter((c) => c.memberIds.includes(profile.id));
  const myIncomes = (data.incomes || []).filter((i) => i.profile_id === profile.id);
  const incomeMonth = myIncomes.filter((i) => isIncomeDueIn(i, now)).reduce((s, i) => s + incomeMonthlyValue(i), 0);
  const expenseMonth = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const saldo = incomeMonth - expenseMonth;

  const handleSave = async (inc) => { await saveIncome(inc); await refresh(); };
  const handleDelete = async (inc) => { if (!window.confirm("Excluir esta receita?")) return; await deleteIncome(inc); await refresh(); };
  const handleSaveExpense = async (expArr) => { for (const e of (Array.isArray(expArr) ? expArr : [expArr])) await saveExpense(e); await refresh(); };

  return (
    <Panel className="mb-4" style={{
      background: `linear-gradient(160deg, ${saldo < 0 ? "rgba(168,80,79,0.10)" : "rgba(47,122,92,0.10)"}, ${C.surface} 55%)`,
      border: `1px solid ${saldo < 0 ? "rgba(168,80,79,0.32)" : "rgba(47,122,92,0.28)"}`,
    }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: saldo < 0 ? "rgba(168,80,79,0.16)" : "rgba(47,122,92,0.16)" }}>
            {saldo < 0 ? <TrendingDown size={19} color={C.rose} /> : <TrendingUp size={19} color={C.green} />}
          </div>
          <div>
            <span className="text-[11px]" style={{ color: C.muted }}>saldo do mês</span>
            <div><Amount value={saldo} size="text-2xl" tone={saldo < 0 ? "rose" : "green"} /></div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowExpenseForm(true)} className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2" style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}` }}>
            <Plus size={14} /> Gasto
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2" style={{ background: C.gold, color: "#1A1607" }}>
            <Plus size={14} /> Receita
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="rounded-xl px-3 py-2.5" style={{ background: C.bgSoft }}>
          <div className="flex items-center gap-1.5 text-[10px] mb-1" style={{ color: C.muted }}>
            <TrendingUp size={11} color={C.green} /> entrou
          </div>
          <Amount value={incomeMonth} size="text-sm" tone="green" />
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: C.bgSoft }}>
          <div className="flex items-center gap-1.5 text-[10px] mb-1" style={{ color: C.muted }}>
            <TrendingDown size={11} color={C.rose} /> saiu
          </div>
          <Amount value={expenseMonth} size="text-sm" tone="rose" />
        </div>
      </div>

      {myIncomes.length > 0 && (
        <div className="space-y-2.5 pt-3">
          {myIncomes.sort((a, b) => b.income_date.localeCompare(a.income_date)).map((inc) => (
            <div key={inc.id} className="flex items-center justify-between text-sm">
              <span style={{ color: C.text }}>{inc.description}{inc.is_recurring && <Repeat size={11} className="inline ml-1.5" color={C.muted} />}</span>
              <div className="flex items-center gap-2.5">
                <Amount value={inc.amount} size="text-xs" tone="green" />
                <button onClick={() => handleDelete(inc)}><Trash2 size={13} color={C.rose} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && <IncomeForm profileId={profile.id} onSave={handleSave} onClose={() => setShowForm(false)} />}
      {showExpenseForm && (
        <ExpenseForm cards={myCards} userId={profile.id} onSave={handleSaveExpense} onClose={() => setShowExpenseForm(false)}
          allProfiles={data.profiles} customCategories={data.customCategories} startWithNoCard
          onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }} />
      )}
    </Panel>
  );
}

/* ---------------------------------- GOALS (individual, reusable) ---------------------------------- */

function GoalsScreen({ profile, data, refresh }) {
  const now = currentMonthKey();
  const dueNow = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now));
  const myBudgets = data.budgets.filter((b) => b.profile_id === profile.id);
  const myCategories = [...CATEGORIES, ...(data.customCategories || []).filter((c) => c.profile_id === profile.id).map((c) => c.name)];
  const [editingCat, setEditingCat] = useState(null);
  const [value, setValue] = useState("");

  const submit = async () => {
    if (!value) return;
    await saveBudget(profile.id, editingCat, parseFloat(value));
    setEditingCat(null); setValue("");
    await refresh();
  };
  const remove = async (budget) => {
    if (!window.confirm("Excluir esta meta?")) return;
    await deleteBudget(budget.id);
    await refresh();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title="Metas" subtitle="Seus limites por categoria" />
      <div className="space-y-3">
        {myCategories.map((cat) => {
          const spent = dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0);
          const budget = myBudgets.find((b) => b.category === cat);
          const pct = budget ? (spent / budget.monthly_limit) * 100 : 0;
          const isEditing = editingCat === cat;
          return (
            <Panel key={cat}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCategoryColor(cat) }} />
                  <span className="text-sm font-medium" style={{ color: C.text }}>{cat}</span>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setEditingCat(cat); setValue(budget?.monthly_limit || ""); }}><Pencil size={14} color={C.muted} /></button>
                    {budget && <button onClick={() => remove(budget)}><Trash2 size={14} color={C.rose} /></button>}
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="flex gap-2 items-center">
                  <CurrencyInput value={value} onChange={setValue} placeholder="Valor da meta (R$)" />
                  <Btn onClick={submit}><Check size={14} /></Btn>
                </div>
              ) : budget ? (
                <>
                  <div className="flex items-baseline justify-between mb-1.5 text-sm">
                    <span style={{ color: C.muted }}>gasto até agora</span>
                    <span style={{ color: C.text }}>{brl(spent)} <span style={{ color: C.muted }}>de {brl(budget.monthly_limit)}</span></span>
                  </div>
                  <ProgressBar pct={pct} tone={pct > 100 ? "rose" : pct > 80 ? "gold" : "green"} />
                </>
              ) : (
                <p className="text-xs" style={{ color: C.muted }}>Nenhuma meta definida para esta categoria.</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function invoiceMonths(expenses, cardIds) {
  const now = currentMonthKey();
  const forward = Array.from({ length: 12 }, (_, i) => addMonthsToKey(now, i));
  const pastSet = new Set();
  expenses.filter((e) => cardIds.includes(e.card_id)).forEach((e) => {
    if (e.is_recurring) {
      let mk = e.first_month;
      let guard = 0;
      while (diffMonths(mk, now) > 0 && guard < 600) {
        pastSet.add(mk);
        mk = addMonthsToKey(mk, 1);
        guard++;
      }
    } else {
      for (let i = 0; i < e.installments; i++) {
        const mk = addMonthsToKey(e.first_month, i);
        if (diffMonths(mk, now) > 0) pastSet.add(mk);
      }
    }
  });
  const past = Array.from(pastSet).sort();
  return [...past, ...forward];
}
function invoiceStatusInfo(card, monthKey) {
  const now = currentMonthKey();
  const diff = diffMonths(monthKey, now);
  if (diff > 0) return { label: "futura", tone: "muted" };
  if (diff === 0) return billingInfo(card).status === "fechada" ? { label: "fechada", tone: "amber" } : { label: "aberta", tone: "green" };
  return { label: "paga", tone: "muted" };
}

const FALLBACK_CAT_COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#EC4899", "#EF4444", "#8B5CF6", "#06B6D4", "#6B7280", "#84CC16", "#F472B6"];
function getCategoryColor(name) {
  if (CAT_COLORS[name]) return CAT_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_CAT_COLORS[hash % FALLBACK_CAT_COLORS.length];
}
function allCategoryNames(expenses) {
  return Array.from(new Set([...CATEGORIES, ...expenses.map((e) => e.category)]));
}

async function saveCustomCategory(profileId, name) {
  const { error } = await supabase.from("custom_categories").insert({ profile_id: profileId, name });
  if (error) throw error;
}
async function bulkUpdateCategory(ids, category) {
  const { error } = await supabase.from("expenses").update({ category }).in("id", ids);
  if (error) throw error;
}

function parseBankCSV(text) {
  const delimiter = text.includes(";") ? ";" : ",";
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const splitLine = (line) => {
    const result = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === delimiter && !inQuotes) { result.push(cur); cur = ""; continue; }
      cur += ch;
    }
    result.push(cur);
    return result.map((s) => s.trim());
  };
  const first = splitLine(lines[0]).map((s) => s.toLowerCase());
  const looksLikeHeader = first.some((c) => c.includes("data") || c.includes("date")) && first.some((c) => c.includes("valor") || c.includes("amount") || c.includes("value"));
  let dateIdx = 0, descIdx = 1, amountIdx = 2, startLine = 0;
  if (looksLikeHeader) {
    dateIdx = first.findIndex((c) => c.includes("data") || c.includes("date"));
    amountIdx = first.findIndex((c) => c.includes("valor") || c.includes("amount") || c.includes("value"));
    descIdx = first.findIndex((c) => c.includes("descri") || c.includes("histor") || c.includes("memo"));
    if (descIdx === -1) descIdx = first.findIndex((_, i) => i !== dateIdx && i !== amountIdx);
    startLine = 1;
  }
  const rows = [];
  for (let i = startLine; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 2) continue;
    const rawDate = cols[dateIdx] || "";
    const rawDesc = cols[descIdx] || "Sem descrição";
    const rawAmount = (cols[amountIdx] || "0").replace(/[R$\s]/g, "");
    let amount = parseFloat(rawAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(amount)) amount = parseFloat(rawAmount.replace(",", "")) || 0;
    amount = Math.abs(amount);
    let date = new Date().toISOString().slice(0, 10);
    const isoDate = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    const brDate = rawDate.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
    if (isoDate) date = `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
    else if (brDate) { let [, d, m, y] = brDate; if (y.length === 2) y = "20" + y; date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
    if (amount > 0) rows.push({ date, description: rawDesc || "Sem descrição", amount, category: CATEGORIES[CATEGORIES.length - 1], include: true });
  }
  return rows;
}

function ImportCSVModal({ cards, userId, onImport, onClose }) {
  const [rows, setRows] = useState(null);
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setRows(parseBankCSV(text));
  };
  const toggleRow = (i) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, include: !r.include } : r)));
  const updateCategory = (i, cat) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, category: cat } : r)));

  const confirmImport = async () => {
    setSaving(true); setErr("");
    try {
      const toImport = rows.filter((r) => r.include).map((r) => ({
        cardId, userId, category: r.category, description: r.description,
        totalAmount: r.amount, date: r.date, firstMonth: monthKeyFromDate(r.date),
        installments: 1, isRecurring: false, receiptUrl: null,
      }));
      await onImport(toImport);
      onClose();
    } catch (e) {
      setSaving(false);
      setErr(friendlyError(e));
    }
  };

  return (
    <Modal title="Importar extrato (CSV)" onClose={onClose}>
      {!rows ? (
        <>
          <p className="text-xs mb-3" style={{ color: C.muted }}>Envie o arquivo CSV do extrato (data, descrição e valor). Depois você confere cada lançamento antes de importar de verdade.</p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} className="text-xs" style={{ color: C.muted }} />
        </>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: C.muted }}>Não consegui reconhecer nenhum lançamento nesse arquivo.</p>
      ) : (
        <>
          <Field label="Cartão de destino">
            <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <p className="text-xs mb-2" style={{ color: C.muted }}>{rows.filter((r) => r.include).length} de {rows.length} lançamentos serão importados</p>
          <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded-lg p-2" style={{ background: C.bgSoft, opacity: r.include ? 1 : 0.4 }}>
                <button onClick={() => toggleRow(i)}>{r.include ? <CheckSquare size={14} color={C.gold} /> : <Square size={14} color={C.muted} />}</button>
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ color: C.text }}>{r.description}</div>
                  <div style={{ color: C.muted }}>{r.date}</div>
                </div>
                <Select value={r.category} onChange={(e) => updateCategory(i, e.target.value)} style={{ padding: "4px 6px", fontSize: 11 }}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Amount value={r.amount} size="text-xs" />
              </div>
            ))}
          </div>
          {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
          <Btn full onClick={confirmImport} disabled={saving || cards.length === 0 || rows.filter((r) => r.include).length === 0}>
            {saving ? "Importando..." : "Confirmar importação"}
          </Btn>
        </>
      )}
    </Modal>
  );
}

/* ---------------------------------- HISTORY (reusable) ---------------------------------- */

function HistoryScreen({ profile, data, refresh, isAdmin }) {
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterCard, setFilterCard] = useState("all");
  const [period, setPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkCategory, setBulkCategory] = useState(CATEGORIES[0]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const carouselRef = useRef(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const onCarouselMouseDown = (e) => {
    const el = carouselRef.current;
    if (!el) return;
    dragState.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
  };
  const stopDrag = () => {
    dragState.current.isDown = false;
    if (carouselRef.current) carouselRef.current.style.cursor = "grab";
  };
  const onCarouselMouseMove = (e) => {
    const el = carouselRef.current;
    if (!el || !dragState.current.isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  };
  const [viewMode, setViewMode] = useState("faturas");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const cardName = (id) => id ? (data.cards.find((c) => c.id === id)?.name || "-") : "Dinheiro/Pix";
  const personName = (id) => firstName(data.profiles.find((u) => u.id === id)?.name) || "-";
  const range = periodToRange(period, customRange);

  const baseExpenses = isAdmin ? data.expenses : data.expenses.filter((e) => e.profile_id === profile.id);
  const filtered = baseExpenses
    .filter((e) => !isAdmin || filterPerson === "all" || e.profile_id === filterPerson)
    .filter((e) => filterCard === "all" || e.card_id === filterCard)
    .filter((e) => e.purchase_date >= range.start && e.purchase_date <= range.end)
    .filter((e) => !query.trim() || e.description.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  const myCards = isAdmin ? data.cards : data.cards.filter((c) => c.memberIds.includes(profile.id));

  const handleSave = async (expArr) => { for (const e of (Array.isArray(expArr) ? expArr : [expArr])) await saveExpense(e); await refresh(); };
  const handleDelete = async (exp) => { if (!window.confirm("Excluir este gasto?")) return; await deleteExpense(exp); await refresh(); };
  const toggleSelect = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const applyBulk = async () => {
    setBulkSaving(true);
    try {
      await bulkUpdateCategory(selected, bulkCategory);
      setSelected([]); setSelectMode(false);
      await refresh();
    } catch (e) {
      // erro silencioso vira apenas cancelamento da seleção; formulário principal já cobre feedback de erro
    } finally {
      setBulkSaving(false);
    }
  };
  const exportBackup = () => {
    const payload = isAdmin
      ? { profiles: data.profiles, cards: data.cards, expenses: data.expenses, budgets: data.budgets, incomes: data.incomes }
      : { expenses: filtered, budgets: data.budgets.filter((b) => b.profile_id === profile.id), incomes: (data.incomes || []).filter((i) => i.profile_id === profile.id) };
    downloadJSON(payload, `backup-${currentMonthKey()}.json`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title="Faturas" subtitle={isAdmin ? "Todos os lançamentos" : "Seus lançamentos"} />

      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <Field label="Pessoa">
              <Select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
                <option value="all">Todas</option>
                {data.profiles.map((u) => <option key={u.id} value={u.id}>{firstName(u.name)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex-1 min-w-0">
            <Field label="Cartão">
              <Select value={filterCard} onChange={(e) => setFilterCard(e.target.value)}>
                <option value="all">Todos</option>
                {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      )}

      {viewMode === "lista" && (
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => setViewMode("faturas")} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}` }}>
            Faturas
          </button>
          <button onClick={() => setViewMode("lista")} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: C.gold, color: "#1A1607", border: `1px solid ${C.gold}` }}>
            Buscar tudo
          </button>
        </div>
      )}

      {viewMode === "faturas" && (() => {
        const scopedExpenses = baseExpenses.filter((e) => !isAdmin || filterPerson === "all" || e.profile_id === filterPerson);
        const invoiceCards = filterCard === "all" ? myCards : myCards.filter((c) => c.id === filterCard);
        const months = invoiceMonths(scopedExpenses, invoiceCards.map((c) => c.id));
        const lineItems = scopedExpenses
          .filter((e) => invoiceCards.some((c) => c.id === e.card_id) && isDueIn(e, selectedMonth))
          .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
        const total = lineItems.reduce((s, e) => s + monthlyValue(e), 0);
        const singleCard = invoiceCards.length === 1 ? invoiceCards[0] : null;
        const statusInfo = singleCard ? invoiceStatusInfo(singleCard, selectedMonth) : null;

        return invoiceCards.length === 0 ? (
          <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão disponível." /></Panel>
        ) : (
          <>
            <div className="flex gap-1.5 mb-3 items-center">
              <button onClick={() => setViewMode("faturas")} className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: C.gold, color: "#1A1607", border: `1px solid ${C.gold}` }}>
                Faturas
              </button>
              <button onClick={() => setViewMode("lista")} className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}` }}>
                Buscar tudo
              </button>
              <div className="w-px h-5 shrink-0" style={{ background: C.border }} />
              <div ref={carouselRef} onMouseDown={onCarouselMouseDown} onMouseMove={onCarouselMouseMove} onMouseUp={stopDrag} onMouseLeave={stopDrag}
                className="flex gap-1.5 overflow-x-auto flex-1 pb-1 select-none" style={{ scrollbarWidth: "none", cursor: "grab", WebkitOverflowScrolling: "touch" }}>
                {months.map((mk) => {
                  const active = mk === selectedMonth;
                  const status = singleCard ? invoiceStatusInfo(singleCard, mk) : null;
                  const tone = status?.tone === "green" ? C.green : status?.tone === "amber" ? C.amber : C.muted;
                  return (
                    <button key={mk} onClick={() => setSelectedMonth(mk)} className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium transition-all capitalize"
                      style={{ background: active ? C.gold : "transparent", color: active ? "#1A1607" : tone, border: `1px solid ${active ? C.gold : C.border}` }}>
                      {monthLabel(mk)}
                    </button>
                  );
                })}
              </div>
            </div>

            <HeroPanel
              label={`Fatura de ${monthLabel(selectedMonth)}`}
              value={total}
              sub={statusInfo ? `${statusInfo.label === "aberta" ? "Fecha" : statusInfo.label === "futura" ? "Fecha" : "Fechou"} dia ${singleCard.closing_day} · vence dia ${singleCard.due_day}` : undefined}
            />

            <Panel>
              {lineItems.length === 0 ? (
                <EmptyState icon={<ListChecks size={28} />} text="Nenhum gasto nesta fatura." />
              ) : (
                lineItems.map((exp) => (
                  <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} personName={personName(exp.profile_id)} showPerson={isAdmin}
                    onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
                ))
              )}
            </Panel>
          </>
        );
      })()}

      {viewMode === "lista" && (
        <>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <PeriodFilter value={period} onChange={setPeriod} customRange={customRange} onCustomChange={setCustomRange} />
            <div className="relative flex-1 min-w-[160px]">
              <Search size={15} color={C.muted} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." style={{ paddingLeft: 34 }} />
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Novo gasto</Btn>
            <Btn variant="ghost" onClick={() => setShowImportCSV(true)} disabled={myCards.length === 0}><Paperclip size={16} /></Btn>
            <div className="relative">
              <Btn variant="ghost" onClick={() => setShowExportMenu((v) => !v)}><Download size={16} /></Btn>
              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 rounded-xl overflow-hidden z-20" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
                  <button onClick={() => { downloadCSV(toCSV(filtered, cardName, personName), `gastos-${period}.csv`); setShowExportMenu(false); }}
                    className="block w-full text-left px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: C.text }}>Planilha (CSV)</button>
                  <button onClick={() => { exportBackup(); setShowExportMenu(false); }}
                    className="block w-full text-left px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>Backup (JSON)</button>
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => { setSelectMode((v) => !v); setSelected([]); }} className="flex items-center gap-1.5 text-xs" style={{ color: selectMode ? C.gold : C.muted }}>
                <CheckSquare size={13} /> {selectMode ? "Cancelar seleção" : "Selecionar vários"}
              </button>
              {selectMode && selected.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} style={{ padding: "6px 8px", fontSize: 12 }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Btn onClick={applyBulk} disabled={bulkSaving}>{bulkSaving ? "..." : `Aplicar (${selected.length})`}</Btn>
                </div>
              )}
            </div>
          )}

          <Panel>
            {filtered.length === 0 ? (
              <EmptyState icon={<ListChecks size={28} />} text="Nenhum gasto encontrado." />
            ) : (
              filtered.map((exp) => (
                <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} personName={personName(exp.profile_id)} showPerson={isAdmin}
                  onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete}
                  selectable={isAdmin && selectMode} selected={selected.includes(exp.id)} onToggleSelect={toggleSelect} />
              ))
            )}
          </Panel>
        </>
      )}

      {showForm && (
        <ExpenseForm cards={myCards} userId={editing?.profile_id || profile.id} initial={editing}
          onSave={handleSave} onClose={() => setShowForm(false)}
          allProfiles={data.profiles}
          customCategories={data.customCategories} onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }} />
      )}
      {showImportCSV && (
        <ImportCSVModal cards={myCards} userId={profile.id} onImport={handleSave} onClose={() => setShowImportCSV(false)} />
      )}
    </div>
  );
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawSummaryCanvas({ heading, monthLabelStr, total, saldo, categories }) {
  const canvas = document.createElement("canvas");
  canvas.width = 800; canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 800, 1000);
  grad.addColorStop(0, "#7C3AED"); grad.addColorStop(1, "#3B1466");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 800, 1000);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.arc(760, 90, 190, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(30, 960, 160, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 22px sans-serif";
  ctx.fillText("CONTROLE FINANCEIRO", 50, 80);

  ctx.fillStyle = "#fff";
  ctx.font = "800 46px sans-serif";
  ctx.fillText(heading, 50, 160);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "400 24px sans-serif";
  ctx.fillText(monthLabelStr, 50, 195);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRectPath(ctx, 50, 240, 700, 140, 20); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "500 20px sans-serif"; ctx.fillText("Total gasto no mês", 80, 285);
  ctx.fillStyle = "#fff"; ctx.font = "800 54px sans-serif"; ctx.fillText(brl(total), 80, 345);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRectPath(ctx, 50, 410, 700, 110, 20); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "500 20px sans-serif"; ctx.fillText("Saldo do mês", 80, 450);
  ctx.fillStyle = saldo < 0 ? "#F1A9A8" : "#8CE0BE";
  ctx.font = "800 38px sans-serif"; ctx.fillText(brl(saldo), 80, 493);

  let y = 575;
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "600 20px sans-serif"; ctx.fillText("Principais categorias", 50, y); y += 40;
  categories.slice(0, 5).forEach((c) => {
    ctx.fillStyle = c.color;
    ctx.beginPath(); ctx.arc(65, y - 7, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "500 22px sans-serif"; ctx.textAlign = "left"; ctx.fillText(c.name, 90, y);
    ctx.textAlign = "right"; ctx.fillText(brl(c.value), 750, y); ctx.textAlign = "left";
    y += 44;
  });

  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "400 16px sans-serif";
  ctx.fillText("Gerado pelo Controle Financeiro", 50, 960);

  return canvas;
}
async function shareSummaryImage(params) {
  const canvas = drawSummaryCanvas(params);
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], "resumo-financeiro.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Resumo do mês" }); return; } catch {}
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "resumo-financeiro.png"; link.click();
  }, "image/png");
}

/* ---------------------------------- MEMBER: OVERVIEW ---------------------------------- */

function MemberOverview({ profile, data, refresh }) {
  const now = currentMonthKey();
  const myCards = data.cards.filter((c) => c.memberIds.includes(profile.id));
  const myExpenses = data.expenses.filter((e) => e.profile_id === profile.id);
  const myMonthTotal = myExpenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const myIncomeMonth = (data.incomes || []).filter((i) => i.profile_id === profile.id && isIncomeDueIn(i, now)).reduce((s, i) => s + incomeMonthlyValue(i), 0);

  const handleShare = () => {
    const dueNow = myExpenses.filter((e) => isDueIn(e, now));
    const categories = allCategoryNames(dueNow)
      .map((cat) => ({ name: cat, value: dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0), color: getCategoryColor(cat) }))
      .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    shareSummaryImage({ heading: `Olá, ${firstName(profile.name)}`, monthLabelStr: monthLabel(now), total: myMonthTotal, saldo: myIncomeMonth - myMonthTotal, categories });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <div className="flex items-center justify-between">
        <ScreenHeader title={`Olá, ${profile.name.split(" ")[0]}`} subtitle="Seu mês" />
        <button onClick={handleShare} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-4" style={{ border: `1px solid ${C.border}` }}>
          <Share2 size={15} color={C.gold} />
        </button>
      </div>
      <HeroPanel label="Total do mês" value={myMonthTotal} />
      <IncomeSection profile={profile} data={data} refresh={refresh} />

      {myCards.length > 0 ? (
        <div className={`grid grid-cols-1 ${myCards.length > 1 ? "sm:grid-cols-2" : ""} gap-3`}>
          {myCards.map((c) => {
            const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
            return <CardWidget key={c.id} card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />;
          })}
        </div>
      ) : (
        <Panel><EmptyState icon={<CreditCard size={28} />} text="Você ainda não tem acesso a nenhum cartão." /></Panel>
      )}
    </div>
  );
}

/* ---------------------------------- ADMIN: OVERVIEW ---------------------------------- */

function AdminOverview({ profile, data, refresh }) {
  const now = currentMonthKey();
  const totalMonth = data.expenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const byPerson = data.profiles.map((u) => ({ ...u, total: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0) }));
  const adminIncomeMonth = (data.incomes || []).filter((i) => i.profile_id === profile.id && isIncomeDueIn(i, now)).reduce((s, i) => s + incomeMonthlyValue(i), 0);
  const adminExpenseMonth = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareSelected, setShareSelected] = useState([]);

  const buildHeading = (ids) => {
    if (ids.length === 0 || ids.length === data.profiles.length) return "Resumo geral";
    const names = data.profiles.filter((p) => ids.includes(p.id)).map((p) => firstName(p.name));
    if (ids.length === 1) return ids[0] === profile.id ? `Olá, ${names[0]}` : `Resumo de ${names[0]}`;
    return `Resumo de ${names.join(" e ")}`;
  };
  const shareScope = (scopeIds, heading) => {
    setShowShareMenu(false);
    const dueNow = data.expenses.filter((e) => isDueIn(e, now) && (!scopeIds || scopeIds.includes(e.profile_id)));
    const categories = allCategoryNames(dueNow)
      .map((cat) => ({ name: cat, value: dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0), color: getCategoryColor(cat) }))
      .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    const total = dueNow.reduce((s, e) => s + monthlyValue(e), 0);
    const scopedIncome = (data.incomes || []).filter((i) => isIncomeDueIn(i, now) && (!scopeIds || scopeIds.includes(i.profile_id))).reduce((s, i) => s + incomeMonthlyValue(i), 0);
    shareSummaryImage({ heading, monthLabelStr: monthLabel(now), total, saldo: scopedIncome - total, categories });
  };
  const toggleShare = (id) => setShareSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <div className="flex items-center justify-between">
        <ScreenHeader title="Visão geral" subtitle="Este mês" />
        <div className="relative shrink-0 mb-4">
          <button onClick={() => { setShowShareMenu((v) => !v); setShareSelected([]); }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
            <Share2 size={15} color={C.gold} />
          </button>
          {showShareMenu && (
            <div className="absolute right-0 mt-1.5 rounded-xl p-3 z-20" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow, width: 200 }}>
              <p className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.muted }}>Incluir no resumo</p>
              <div className="space-y-2 mb-3">
                {data.profiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs" style={{ color: C.text }}>
                    <Switch checked={shareSelected.includes(p.id)} onChange={() => toggleShare(p.id)} />
                    {p.id === profile.id ? `${firstName(p.name)} (eu)` : firstName(p.name)}
                  </label>
                ))}
              </div>
              <p className="text-[10px] mb-2" style={{ color: C.muted }}>{shareSelected.length === 0 ? "Ninguém marcado = todos" : `${shareSelected.length} selecionado(s)`}</p>
              <Btn full onClick={() => shareScope(shareSelected.length ? shareSelected : null, buildHeading(shareSelected))}>Gerar</Btn>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <HeroPanel label="Total do mês" value={totalMonth} />
        <IncomeSection profile={profile} data={data} refresh={refresh} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {byPerson.map((p) => (
            <Panel key={p.id}><span className="text-[11px]" style={{ color: C.muted }}>{firstName(p.name)}</span><div className="mt-1"><Amount value={p.total} size="text-lg" /></div></Panel>
          ))}
        </div>
        <h4 className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: C.muted }}>Cartões</h4>
        <div className={`grid grid-cols-1 ${data.cards.length > 1 ? "sm:grid-cols-2" : ""} gap-3`}>
          {data.cards.map((c) => {
            const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
            return <CardWidget key={c.id} card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />;
          })}
          {data.cards.length === 0 && <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão cadastrado ainda." /></Panel>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN: CARDS ---------------------------------- */

function AdminCards({ data, refresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const now = currentMonthKey();

  const handleSave = async (card) => { await saveCard(card); await refresh(); };
  const handleDelete = async (card) => { if (!window.confirm(`Excluir o cartão "${card.name}"? Isso também remove os gastos lançados nele.`)) return; await deleteCard(card); await refresh(); };

  const totalAvailable = data.cards.reduce((s, c) => {
    const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s2, e) => s2 + outstanding(e, now), 0);
    return s + Math.max(c.card_limit - used, 0);
  }, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title="Cartões" subtitle="Limites, vencimentos e acessos" />
      {data.cards.length > 0 && <HeroPanel label="Limite disponível total" value={totalAvailable} />}
      <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Novo cartão</Btn>
      <div className="mt-4 space-y-4">
        {data.cards.length === 0 && <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão cadastrado ainda." /></Panel>}
        {data.cards.map((c) => {
          const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
          const names = data.profiles.filter((u) => c.memberIds.includes(u.id)).map((u) => firstName(u.name)).join(", ") || "ninguém ainda";
          return (
            <div key={c.id}>
              <CardWidget card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />
              <Panel className="mt-2 !py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] truncate" style={{ color: C.muted }}>acesso: {names}</span>
                  <div className="flex gap-3 shrink-0 ml-2">
                    <button onClick={() => { setEditing(c); setShowForm(true); }}><Pencil size={14} color={C.muted} /></button>
                    <button onClick={() => handleDelete(c)}><Trash2 size={14} color={C.rose} /></button>
                  </div>
                </div>
              </Panel>
            </div>
          );
        })}
      </div>
      {showForm && <CardForm allProfiles={data.profiles} initial={editing} onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function compactNumber(v) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(v)}`;
}
const PERSON_COLOR_MAP = { eduardo: "#10B981", nilvane: "#EC4899" };
function personColorFor(name, fallbackIndex) {
  const key = firstName(name).toLowerCase();
  if (PERSON_COLOR_MAP[key]) return PERSON_COLOR_MAP[key];
  const fallback = ["#7C3AED", "#3B82F6", "#F59E0B", "#06B6D4"];
  return fallback[fallbackIndex % fallback.length];
}
function monthKeysForPeriod(period, customRange) {
  const now = currentMonthKey();
  const map = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
  if (map[period]) return Array.from({ length: map[period] }, (_, i) => addMonthsToKey(now, -i));
  if (period === "custom" && customRange.start && customRange.end) {
    const startKey = monthKeyFromDate(customRange.start);
    const endKey = monthKeyFromDate(customRange.end);
    const span = diffMonths(startKey, endKey);
    return Array.from({ length: Math.max(span + 1, 1) }, (_, i) => addMonthsToKey(startKey, i));
  }
  return [now];
}
function categoryTotalsForMonths(expenses, monthKeys, profileIds = null) {
  const scoped = profileIds ? expenses.filter((e) => profileIds.includes(e.profile_id)) : expenses;
  return allCategoryNames(scoped).map((cat) => {
    let value = 0;
    monthKeys.forEach((mk) => { value += scoped.filter((e) => e.category === cat && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return { name: cat, value };
  }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
}

function PersonFilter({ profiles, selectedIds, onChange }) {
  const allSelected = selectedIds.length === 0;
  const toggle = (id) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };
  return (
    <div className="flex gap-1.5 flex-wrap mb-3">
      <button onClick={() => onChange([])}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: allSelected ? C.gold : "transparent", color: allSelected ? "#1A1607" : C.muted, border: `1px solid ${allSelected ? C.gold : C.border}` }}>
        Todos
      </button>
      {profiles.map((p) => {
        const active = selectedIds.includes(p.id);
        return (
          <button key={p.id} onClick={() => toggle(p.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: active ? C.gold : "transparent", color: active ? "#1A1607" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
            {firstName(p.name)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- ADMIN: REPORTS ---------------------------------- */

function ReportsScreen({ profile, data, isAdmin }) {
  const now = currentMonthKey();
  const prevMonth = addMonthsToKey(now, -1);
  const [period, setPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [selectedIds, setSelectedIds] = useState([]);

  const scopeProfiles = isAdmin
    ? (selectedIds.length === 0 ? data.profiles : data.profiles.filter((p) => selectedIds.includes(p.id)))
    : data.profiles.filter((p) => p.id === profile.id);
  const scopeIds = scopeProfiles.map((p) => p.id);

  const monthKeys = monthKeysForPeriod(period, customRange);
  const byCategory = categoryTotalsForMonths(data.expenses, monthKeys, scopeIds);
  const totalPeriod = byCategory.reduce((s, d) => s + d.value, 0);
  const comparison = categoryComparison(data.expenses, now, prevMonth, scopeIds);

  const months = last6Months();
  const evolution = months.map((mk) => {
    const row = { month: monthLabel(mk) };
    scopeProfiles.forEach((u) => { row[firstName(u.name)] = data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return row;
  });

  const heroLabel = period === "month" ? "Total do mês" : `Total (${periodPresetLabel(period)})`;
  const scopeLabel = !isAdmin ? "Seu relatório" : selectedIds.length === 0 ? "Todos" : scopeProfiles.map((p) => firstName(p.name)).join(" e ");

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-4">
      <ScreenHeader title="Relatórios" subtitle={isAdmin ? `Panorama financeiro · ${scopeLabel}` : "Seu panorama financeiro"} />
      <div className="flex flex-wrap gap-1.5 items-center mb-3">
        {isAdmin && (
          <>
            <button onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: selectedIds.length === 0 ? C.gold : "transparent", color: selectedIds.length === 0 ? "#1A1607" : C.muted, border: `1px solid ${selectedIds.length === 0 ? C.gold : C.border}` }}>
              Todos
            </button>
            {data.profiles.map((p) => {
              const active = selectedIds.includes(p.id);
              return (
                <button key={p.id} onClick={() => setSelectedIds((prev) => {
                  if (prev.includes(p.id)) return prev.filter((x) => x !== p.id);
                  const next = [...prev, p.id];
                  return next.length > 2 ? next.slice(1) : next;
                })}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: active ? C.gold : "transparent", color: active ? "#1A1607" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
                  {firstName(p.name)}
                </button>
              );
            })}
          </>
        )}
        <PeriodFilter value={period} onChange={setPeriod} customRange={customRange} onCustomChange={setCustomRange} />
      </div>
      <HeroPanel label={heroLabel} value={totalPeriod} />

      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Por categoria</h4>
        {byCategory.length === 0 ? (
          <EmptyState icon={<PieIcon size={28} />} text="Sem dados neste período." />
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} cornerRadius={6}>
                  {byCategory.map((d, i) => <Cell key={i} fill={getCategoryColor(d.name)} stroke="none" />)}
                </Pie>
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: -8 }}>
              <span className="text-[10px]" style={{ color: C.muted }}>total</span>
              <span className="text-lg font-extrabold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{brl(totalPeriod)}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
              {byCategory.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: getCategoryColor(d.name) }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Comparado ao mês anterior</h4>
        {comparison.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>Sem dados suficientes para comparar.</p>
        ) : (
          <div className="space-y-2.5">
            {comparison.map((d) => {
              const diff = d.previous > 0 ? ((d.current - d.previous) / d.previous) * 100 : (d.current > 0 ? 100 : 0);
              const up = diff > 0;
              return (
                <div key={d.category} className="flex items-center justify-between text-sm">
                  <span style={{ color: C.text }}>{d.category}</span>
                  <div className="flex items-center gap-2">
                    <Amount value={d.current} size="text-xs" />
                    {d.previous > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px]" style={{ color: up ? C.rose : C.green }}>
                        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(diff).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Evolução mensal</h4>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={evolution} barGap={4}>
            <XAxis dataKey="month" stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} />
            <YAxis stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={38} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
            {scopeProfiles.map((u, i) => (
              <Bar key={u.id} dataKey={firstName(u.name)} radius={[6, 6, 0, 0]} fill={personColorFor(u.name, i)} maxBarSize={22} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        {scopeProfiles.length > 1 && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mt-3">
            {scopeProfiles.map((u, i) => (
              <div key={u.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                <span className="w-2 h-2 rounded-full" style={{ background: personColorFor(u.name, i) }} />
                {firstName(u.name)}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function FloatingAddButton({ onClick }) {
  return (
    <button onClick={onClick} className="fixed z-40 rounded-full flex items-center justify-center transition-all active:scale-95"
      style={{ right: 18, bottom: "calc(78px + env(safe-area-inset-bottom, 0px))", width: 54, height: 54, background: HERO_GRADIENT, boxShadow: "0 10px 24px rgba(76,29,149,0.45)" }}>
      <Zap size={22} color="#fff" />
    </button>
  );
}

function showLocalNotification(title, body) {
  const opts = { body, icon: "/icon.svg" };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch {} });
  } else {
    try { new Notification(title, opts); } catch {}
  }
}
function useBillAlerts(cards, expenses) {
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
    if (Notification.permission !== "granted") return;
    const now = currentMonthKey();
    const today = new Date().toISOString().slice(0, 10);
    cards.forEach((c) => {
      const used = expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
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

function usePersistentTab(key, defaultValue) {
  const [tab, setTabState] = useState(() => {
    try { return localStorage.getItem(key) || defaultValue; } catch { return defaultValue; }
  });
  const setTab = (t) => {
    setTabState(t);
    try { localStorage.setItem(key, t); } catch {}
  };
  return [tab, setTab];
}

/* ---------------------------------- DASHBOARDS ---------------------------------- */

function MemberApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = usePersistentTab("tab-member", "overview");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const myCards = data.cards.filter((c) => c.memberIds.includes(profile.id));
  useBillAlerts(myCards, data.expenses);
  const tabs = [
    { id: "history", label: "Faturas", icon: <ListChecks size={18} />, badge: anyCardAlert(myCards, data.expenses) },
    { id: "overview", label: "Início", icon: <LayoutGrid size={18} /> },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={18} /> },
    { id: "goals", label: "Metas", icon: <Target size={18} /> },
  ];
  const handleQuickSave = async (expArr) => { for (const e of (Array.isArray(expArr) ? expArr : [expArr])) await saveExpense(e); await refresh(); };
  return (
    <>
      <TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      {tab === "overview" && <MemberOverview profile={profile} data={data} refresh={refresh} />}
      {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
      {tab === "reports" && <ReportsScreen profile={profile} data={data} isAdmin={false} />}
      {tab === "goals" && <GoalsScreen profile={profile} data={data} refresh={refresh} />}
      <FloatingAddButton onClick={() => setShowQuickAdd(true)} />
      {showQuickAdd && <ExpenseForm cards={myCards} userId={profile.id} onSave={handleQuickSave} onClose={() => setShowQuickAdd(false)} allProfiles={data.profiles}
        customCategories={data.customCategories} onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }} />}
      <BottomNav tabs={tabs} tab={tab} setTab={setTab} />
    </>
  );
}

function AdminApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = usePersistentTab("tab-admin", "overview");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  useBillAlerts(data.cards, data.expenses);
  const tabs = [
    { id: "cards", label: "Cartões", icon: <CreditCard size={18} /> },
    { id: "history", label: "Faturas", icon: <ListChecks size={18} />, badge: anyCardAlert(data.cards, data.expenses) },
    { id: "overview", label: "Início", icon: <LayoutGrid size={18} /> },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={18} /> },
    { id: "goals", label: "Metas", icon: <Target size={18} /> },
  ];
  const handleQuickSave = async (expArr) => { for (const e of (Array.isArray(expArr) ? expArr : [expArr])) await saveExpense(e); await refresh(); };
  return (
    <>
      <TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      {tab === "overview" && <AdminOverview profile={profile} data={data} refresh={refresh} />}
      {tab === "cards" && <AdminCards data={data} refresh={refresh} />}
      {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin />}
      {tab === "reports" && <ReportsScreen profile={profile} data={data} isAdmin />}
      {tab === "goals" && <GoalsScreen profile={profile} data={data} refresh={refresh} />}
      <FloatingAddButton onClick={() => setShowQuickAdd(true)} />
      {showQuickAdd && <ExpenseForm cards={data.cards} userId={profile.id} onSave={handleQuickSave} onClose={() => setShowQuickAdd(false)} allProfiles={data.profiles}
        customCategories={data.customCategories} onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }} />}
      <BottomNav tabs={tabs} tab={tab} setTab={setTab} />
    </>
  );
}

/* ---------------------------------- ROOT ---------------------------------- */

export default function App() {
  useFonts();
  useThemeStyles();
  const [theme, toggleTheme] = useTheme();
  const [authUser, setAuthUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const scrollY = window.scrollY;
    try { setData(await loadAll()); } catch { setError("Não foi possível carregar os dados."); }
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setAuthUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) { setProfile(null); return; }
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      setProfile(p || null);
      await refresh();
    })();
  }, [authUser, refresh]);

  useEffect(() => {
    if (!authUser) return;
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(interval);
    };
  }, [authUser, refresh]);

  if (authUser === undefined) return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>Carregando…</div>;
  if (!authUser) return <Login onLogin={setAuthUser} theme={theme} onToggleTheme={toggleTheme} />;
  if (!profile || !data) return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>{error || "Carregando…"}</div>;

  const handleLogout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {error && <div className="text-center text-xs py-1.5" style={{ background: "rgba(221,124,134,0.15)", color: C.rose }}>{error}</div>}
      {profile.role === "admin" ? (
        <AdminApp profile={profile} data={data} refresh={refresh} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <MemberApp profile={profile} data={data} refresh={refresh} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
      )}
    </div>
  );
}
