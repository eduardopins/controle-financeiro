import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  CreditCard, Plus, Pencil, Trash2, LogOut, LayoutGrid, Wallet, PieChart as PieIcon,
  ListChecks, X, Check, Lock, ChevronRight, Download, AlertTriangle,
  Repeat, Target, Clock, Sun, Moon, Search, Paperclip, TrendingUp, TrendingDown,
  DollarSign, CheckSquare, Square, Zap, Share2, Percent, PiggyBank, ArrowDownCircle, ArrowUpCircle, Calendar, Camera, History, BellRing,
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
.app-input:focus { box-shadow: 0 0 0 2px var(--gold); }
button:focus-visible, a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
#printable-report { display: none; }
@media print {
  body * { visibility: hidden; }
  #printable-report, #printable-report * { visibility: visible; }
  #printable-report { display: block; position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
}
.theme-dark {
  --bg: #0A0C18; --bg-soft: #10132A; --surface: #151933; --surface-alt: #1C2140;
  --border: rgba(184,147,90,0.14); --border-strong: rgba(184,147,90,0.34);
  --gold: #6E7EB0; --gold-soft: #95A4D6; --gold-deep: #2E3552; --gold-contrast: #FFFFFF; --text: #F4F1E9; --muted: #8B92AC;
  --green: #5FA88C; --rose: #C97575; --amber: #CBA05A;
  --shadow: 0 10px 34px rgba(0,0,0,0.38);
}
.theme-light {
  --bg: #F7F4EE; --bg-soft: #FFFFFF; --surface: #FFFFFF; --surface-alt: #F1EBDD;
  --border: rgba(122,95,45,0.16); --border-strong: rgba(122,95,45,0.32);
  --gold: #4C5A8C; --gold-soft: #37426A; --gold-deep: #232A45; --gold-contrast: #FFFFFF; --text: #201D17; --muted: #726A59;
  --green: #2F7A5C; --rose: #A8504F; --amber: #8A6A2A;
  --shadow: 0 10px 28px rgba(70,55,25,0.10);
}
`;

const CATEGORIES = ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Compras", "Assinaturas", "Educação", "Outros"];
const CAT_COLORS = {
  "Alimentação": "#F2994A", "Moradia": "#4A90D9", "Transporte": "#27AE60",
  "Lazer": "#E84393", "Saúde": "#EB5757", "Compras": "#9B59B6", "Assinaturas": "#17A2A0",
  "Educação": "#6C5CE7", "Outros": "#9AA3B5",
};
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

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
function diffDays(dateA, dateB) {
  return Math.round((new Date(dateB + "T00:00:00") - new Date(dateA + "T00:00:00")) / 86400000);
}
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`; };
function addMonthsToKey(key, n) {
  const [y, m] = key.split("-").map(Number);
  const total = (m - 1) + n;
  const normalized = ((total % 12) + 12) % 12;
  return `${y + Math.floor(total / 12)}-${String(normalized + 1).padStart(2, "0")}`;
}
const last6Months = () => { const now = currentMonthKey(); return Array.from({ length: 6 }, (_, i) => addMonthsToKey(now, i - 5)); };

// "Mês de referência": como as compras do cartão feitas após o fechamento já caem na
// fatura seguinte, usamos o mês seguinte como o "mês corrente" nas telas de análise
// (Visão geral, Relatórios, Metas) — é a fatura que ainda está sendo formada/vai ser paga.
// "Mês de referência": como as compras do cartão feitas após o fechamento já caem na
// fatura seguinte, a "fatura atual" (a que ainda está aberta/sendo formada) pode já ser
// do mês seguinte ao calendário, dependendo do dia de fechamento de cada cartão.
// Usamos o fechamento mais adiantado entre os cartões (o que já "virou" primeiro) como
// referência única para as telas que somam vários cartões (e dinheiro) de uma vez.
function openInvoiceMonth(cards, todayStr = new Date().toISOString().slice(0, 10)) {
  const withClosing = (cards || []).filter((c) => c.closing_day);
  if (withClosing.length === 0) return currentMonthKey();
  const earliestClosing = Math.min(...withClosing.map((c) => c.closing_day));
  return invoiceMonthForPurchase(todayStr, earliestClosing);
}

// Compras feitas depois do dia de fechamento do cartão caem na fatura do mês seguinte
// (o mês corrente já fechou); no dia do fechamento ou antes, ainda entram no mês atual.
function invoiceMonthForPurchase(dateStr, closingDay) {
  const calendarMonth = monthKeyFromDate(dateStr);
  if (!closingDay) return calendarMonth;
  const day = parseInt(dateStr.split("-")[2], 10);
  return day > closingDay ? addMonthsToKey(calendarMonth, 1) : calendarMonth;
}

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
  if (exp.is_refund) return exp.total_amount; // já é negativo — libera limite de verdade
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
function upcomingBills(cards, expenses, withinDays = 7) {
  const now = currentMonthKey();
  return cards.map((c) => {
    const { daysUntilDue } = billingInfo(c);
    const total = expenses.filter((e) => e.card_id === c.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
    return { card: c, daysUntilDue, total };
  }).filter((b) => b.daysUntilDue <= withinDays && b.total > 0).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
function UpcomingBillsPanel({ cards, expenses }) {
  const bills = upcomingBills(cards, expenses);
  if (bills.length === 0) return null;
  return (
    <Panel className="mb-4">
      <h4 className="text-xs font-medium mb-3 tracking-wide uppercase flex items-center gap-1.5" style={{ color: C.muted }}>
        <BellRing size={12} color={C.gold} /> Próximos vencimentos
      </h4>
      <div className="space-y-2.5">
        {bills.map(({ card, daysUntilDue, total }) => (
          <div key={card.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate" style={{ color: C.text }}>{card.name}</span>
              <Chip tone={daysUntilDue <= 2 ? "rose" : "amber"}>{daysUntilDue === 0 ? "vence hoje" : `${daysUntilDue}d`}</Chip>
            </div>
            <Amount value={total} size="text-sm" tone="rose" />
          </div>
        ))}
      </div>
    </Panel>
  );
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

function anyCardAlert(cards, expenses, payments) {
  const now = currentMonthKey();
  return cards.some((c) => {
    const used = netUsedForCard(expenses, payments, c.id, now);
    const pct = c.card_limit ? (used / c.card_limit) * 100 : 0;
    const { daysUntilDue } = billingInfo(c);
    return pct >= 80 || daysUntilDue <= 5;
  });
}

function accessibleCards(data, profileId) {
  return data.cards.filter((c) => c.memberIds.includes(profileId));
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
const HERO_GRADIENT = "linear-gradient(135deg, var(--gold), var(--gold-deep))";

function HeroPanel({ label, value, sub }) {
  return (
    <div className="rounded-3xl p-6 mb-4 relative overflow-hidden" style={{ background: HERO_GRADIENT, boxShadow: "0 14px 34px rgba(0,0,0,0.35)" }}>
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
    primary: { background: C.gold, color: "var(--gold-contrast)" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.rose, border: `1px solid rgba(221,124,134,0.35)` },
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${full ? "w-full" : ""}`} style={styles[variant]}>{children}</button>;
}
function Field({ label, children }) {
  return <label className="block mb-3.5"><span className="block text-xs mb-1.5 tracking-wide" style={{ color: C.muted }}>{label}</span>{children}</label>;
}
const inputStyle = { background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text };
const inputClass = "w-full rounded-lg px-3 py-2.5 text-base outline-none app-input";
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
function formatDateBR(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function pad2(n) { return String(n).padStart(2, "0"); }

function DateInput({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const base = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  const openPicker = () => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(true);
  };
  const changeMonth = (delta) => {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevMonthDays = daysInMonth(viewYear, viewMonth - 1);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: prevMonthDays - firstWeekday + 1 + i, muted: true });
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d, muted: false });
  let nextDay = 1;
  while (cells.length % 7 !== 0) cells.push({ day: nextDay++, muted: true });

  const keyFor = (day) => `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
  const selectDay = (day) => { onChange(keyFor(day)); setOpen(false); };
  const today = new Date();
  const isToday = (day) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  return (
    <>
      <button type="button" onClick={openPicker} className={`${inputClass} flex items-center justify-between`} style={inputStyle}>
        <span style={{ color: value ? C.text : C.muted }}>{value ? formatDateBR(value) : (placeholder || "Selecionar data")}</span>
        <Calendar size={15} color={C.muted} />
      </button>
      {open && (
        <Modal title="Selecionar data" onClose={() => setOpen(false)}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => changeMonth(-1)}><ChevronRight size={16} color={C.muted} style={{ transform: "rotate(180deg)" }} /></button>
            <span className="text-sm font-medium capitalize" style={{ color: C.text }}>{MONTHS_FULL_PT[viewMonth]} de {viewYear}</span>
            <button type="button" onClick={() => changeMonth(1)}><ChevronRight size={16} color={C.muted} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_PT.map((w, i) => <div key={i} className="text-center text-[10px]" style={{ color: C.muted }}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {cells.map((c, i) => {
              const selected = !c.muted && value === keyFor(c.day);
              return (
                <button key={i} type="button" disabled={c.muted} onClick={() => selectDay(c.day)}
                  className="aspect-square rounded-lg text-xs flex items-center justify-center transition-all"
                  style={{
                    background: selected ? C.gold : "transparent",
                    color: c.muted ? C.border : selected ? "var(--gold-contrast)" : (isToday(c.day) ? C.gold : C.text),
                    border: isToday(c.day) && !selected ? `1px solid ${C.gold}` : "1px solid transparent",
                    cursor: c.muted ? "default" : "pointer",
                  }}>
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} style={{ color: C.muted }}>Limpar</button>
            <button type="button" onClick={() => { const t = new Date(); onChange(`${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`); setOpen(false); }} style={{ color: C.gold }}>Hoje</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function FileInput({ onFileSelected, accept, label }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all"
        style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}` }}>
        <Paperclip size={13} /> {label || "Escolher arquivo"}
      </button>
      <span className="text-xs truncate" style={{ color: fileName ? C.text : C.muted, maxWidth: 160 }}>{fileName || "Nenhum arquivo escolhido"}</span>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] || null; setFileName(f?.name || ""); onFileSelected(f); }} />
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
  const colors = { rose: C.rose, amber: C.amber, muted: C.muted, green: C.green, gold: C.gold };
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
  return { month: "Este mês", last_month: "Mês passado", "3m": "Últimos 3 meses", "6m": "Últimos 6 meses", year: "Este ano", custom: "Personalizado" }[id];
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
  const [profiles, cards, cardAccess, expenses, budgets, incomes, customCategories, investments, investmentAccess, investmentTx, activityLog, invoicePayments] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("card_access").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("incomes").select("*"),
    supabase.from("custom_categories").select("*"),
    supabase.from("investments").select("*"),
    supabase.from("investment_access").select("*"),
    supabase.from("investment_transactions").select("*"),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("invoice_payments").select("*"),
  ]);
  const cardsWithMembers = (cards.data || []).map((c) => ({
    ...c,
    memberIds: (cardAccess.data || []).filter((a) => a.card_id === c.id).map((a) => a.profile_id),
  }));
  const investmentsWithAccess = (investments.data || []).map((inv) => ({
    ...inv,
    memberIds: (investmentAccess.data || []).filter((a) => a.investment_id === inv.id).map((a) => a.profile_id),
  }));
  return {
    profiles: profiles.data || [],
    cards: cardsWithMembers,
    expenses: expenses.data || [],
    budgets: budgets.data || [],
    incomes: incomes.data || [],
    customCategories: customCategories.data || [],
    investments: investmentsWithAccess,
    investmentTransactions: investmentTx.data || [],
    activityLog: activityLog.data || [],
    invoicePayments: invoicePayments.data || [],
  };
}

async function saveInvoicePayment(payment) {
  const { error } = await supabase.from("invoice_payments").insert({
    card_id: payment.cardId, month_key: payment.monthKey, amount: payment.amount,
    paid_at: payment.paidAt, profile_id: payment.profileId,
  });
  if (error) throw error;
}
async function deleteInvoicePayment(payment) {
  const { error } = await supabase.from("invoice_payments").delete().eq("id", payment.id);
  if (error) throw error;
}
function paidForInvoice(payments, cardId, monthKey) {
  return (payments || []).filter((p) => p.card_id === cardId && p.month_key === monthKey).reduce((s, p) => s + p.amount, 0);
}
function totalPaidForCard(payments, cardId) {
  return (payments || []).filter((p) => p.card_id === cardId).reduce((s, p) => s + p.amount, 0);
}
function netUsedForCard(expenses, payments, cardId, now) {
  const used = expenses.filter((e) => e.card_id === cardId).reduce((s, e) => s + outstanding(e, now), 0);
  return Math.max(used - totalPaidForCard(payments, cardId), 0);
}
function invoiceDueDate(monthKey, dueDay) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, dueDay);
}
function invoicePaymentStatus(card, monthKey, invoiceTotal, paidTotal) {
  const info = invoiceStatusInfo(card, monthKey);
  if (info.label === "futura") return { label: "futura", tone: "muted" };
  if (info.label === "aberta") return { label: "fatura atual", tone: "gold" };
  if (invoiceTotal > 0 && paidTotal >= invoiceTotal - 0.005) return { label: "paga", tone: "green" };
  const dueDate = invoiceDueDate(monthKey, card.due_day);
  const overdue = new Date() > dueDate;
  if (overdue) return { label: "atrasada", tone: "rose" };
  return { label: "em aberto", tone: "amber" };
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
async function uploadAvatar(file, profileId) {
  const path = `${profileId}/${Date.now()}_${file.name}`.replace(/\s+/g, "_");
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
async function saveProfileAvatar(profileId, url) {
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profileId);
  if (error) throw error;
}
async function logActivity(profileId, action, description) {
  try { await supabase.from("activity_log").insert({ profile_id: profileId, action, description }); } catch {}
}
async function saveExpense(exp) {
  const isNew = !exp.id;
  const payload = {
    card_id: exp.cardId || null, profile_id: exp.userId, category: exp.category, description: exp.description,
    total_amount: exp.totalAmount, purchase_date: exp.date, first_month: exp.firstMonth,
    installments: exp.installments, is_recurring: exp.isRecurring, is_refund: exp.isRefund ?? false, receipt_url: exp.receiptUrl ?? null,
  };
  if (isNew) {
    payload.created_by = exp.createdBy || exp.userId;
    if (exp.splitGroupId) payload.split_group_id = exp.splitGroupId;
  }
  const { error } = isNew
    ? await supabase.from("expenses").insert(payload)
    : await supabase.from("expenses").update(payload).eq("id", exp.id);
  if (error) throw error;
}
async function deleteExpense(exp) {
  const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
  if (error) throw error;
}
async function toggleExpenseReconciled(id, value) {
  const { error } = await supabase.from("expenses").update({ reconciled: value }).eq("id", id);
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

function AvatarCropModal({ file, onCancel, onCropped }) {
  const FRAME = 230;
  const OUTPUT = 480;
  const [imgUrl, setImgUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = Math.max(FRAME / natural.w, FRAME / natural.h) || 1;
  const effectiveScale = baseScale * zoom;
  const dispW = natural.w * effectiveScale;
  const dispH = natural.h * effectiveScale;

  const clamp = (o) => {
    const maxX = Math.max((dispW - FRAME) / 2, 0);
    const maxY = Math.max((dispH - FRAME) / 2, 0);
    return { x: Math.min(Math.max(o.x, -maxX), maxX), y: Math.min(Math.max(o.y, -maxY), maxY) };
  };

  const onPointerDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY, origin: offset }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setOffset(clamp({ x: dragRef.current.origin.x + (e.clientX - dragRef.current.x), y: dragRef.current.origin.y + (e.clientY - dragRef.current.y) }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const confirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const ratio = OUTPUT / FRAME;
      const drawW = dispW * ratio, drawH = dispH * ratio;
      const drawX = OUTPUT / 2 - drawW / 2 + offset.x * ratio;
      const drawY = OUTPUT / 2 - drawH / 2 + offset.y * ratio;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      canvas.toBlob((blob) => {
        onCropped(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    };
    img.src = imgUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(6,8,20,0.75)" }}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow, maxHeight: "94vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>Ajustar foto</h3>
          <button onClick={onCancel}><X size={18} color={C.muted} /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: C.muted }}>A foto de perfil precisa ser quadrada. Arraste pra posicionar e use o zoom pra ajustar.</p>
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          className="relative mx-auto overflow-hidden rounded-2xl mb-4 select-none" style={{ width: FRAME, height: FRAME, background: C.bgSoft, touchAction: "none", cursor: "grab" }}>
          {imgUrl && (
            <img src={imgUrl} draggable={false} alt="" style={{
              position: "absolute", left: "50%", top: "50%", width: dispW, height: dispH,
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`, pointerEvents: "none",
            }} />
          )}
        </div>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs shrink-0" style={{ color: C.muted }}>Zoom</span>
          <input type="range" min="1" max="3" step="0.05" value={zoom}
            onChange={(e) => { setZoom(parseFloat(e.target.value)); setOffset((o) => clamp(o)); }} className="flex-1" />
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={onCancel} full>Cancelar</Btn>
          <Btn onClick={confirm} full>Usar foto</Btn>
        </div>
      </div>
    </div>
  );
}

function Avatar({ profile, size = 32, editable, onUpload, uploading }) {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const initial = firstName(profile?.name || "?").charAt(0).toUpperCase();

  const handleFileSelected = (file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (Math.abs(img.naturalWidth - img.naturalHeight) <= 2) onUpload(file);
      else setPendingFile(file);
    };
    img.src = url;
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center font-bold"
          style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`, color: "var(--gold-contrast)", fontFamily: "'Manrope', sans-serif", fontSize: size * 0.42 }}>
          {initial}
        </div>
      )}
      {editable && (
        <>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="absolute -right-0.5 -bottom-0.5 rounded-full flex items-center justify-center"
            style={{ width: Math.max(size * 0.42, 16), height: Math.max(size * 0.42, 16), background: C.gold, color: "var(--gold-contrast)", border: "2px solid var(--surface)" }}>
            <Camera size={Math.max(size * 0.22, 9)} />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ""; }} />
        </>
      )}
      {pendingFile && (
        <AvatarCropModal file={pendingFile} onCancel={() => setPendingFile(null)}
          onCropped={(f) => { setPendingFile(null); onUpload(f); }} />
      )}
    </div>
  );
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} className="w-8 h-8 rounded-full flex items-center justify-center transition-all" style={{ border: `1px solid ${C.border}` }}>
      {theme === "dark" ? <Sun size={14} color={C.gold} /> : <Moon size={14} color={C.gold} />}
    </button>
  );
}

function TopBar({ profile, onLogout, theme, onToggleTheme, data, refresh, showSearch, setShowSearch }) {
  const [uploading, setUploading] = useState(false);
  const handleAvatarUpload = async (file) => {
    setUploading(true);
    try {
      const url = await uploadAvatar(file, profile.id);
      await saveProfileAvatar(profile.id, url);
      await refresh();
    } catch (e) {
      alert("Não foi possível salvar a foto: " + friendlyError(e));
    } finally { setUploading(false); }
  };
  return (
    <div className="sticky top-0 z-30" style={{ background: "var(--bg)", borderBottom: `1px solid ${C.border}`, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar profile={profile} size={30} editable onUpload={handleAvatarUpload} uploading={uploading} />
          <span className="text-sm font-semibold tracking-wide" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{firstName(profile.name)}</span>
          {profile.role === "admin" && <Chip>admin</Chip>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowSearch(true)}><Search size={17} color={C.muted} /></button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button onClick={onLogout}><LogOut size={17} color={C.muted} /></button>
        </div>
      </div>
      {showSearch && <GlobalSearchModal profile={profile} data={data} onClose={() => setShowSearch(false)} />}
    </div>
  );
}

function GlobalSearchModal({ profile, data, onClose }) {
  const [query, setQuery] = useState("");
  const isAdmin = profile.role === "admin";
  const personName = (id) => firstName((data.profiles || []).find((u) => u.id === id)?.name) || "-";
  const q = query.trim().toLowerCase();

  const scopedExpenses = isAdmin ? data.expenses : data.expenses.filter((e) => e.profile_id === profile.id);
  const scopedIncomes = (data.incomes || []).filter((i) => isAdmin || i.profile_id === profile.id);
  const scopedInvestments = (data.investments || []).filter((inv) => isAdmin || inv.created_by === profile.id || inv.memberIds.includes(profile.id));
  const scopedInvestmentIds = scopedInvestments.map((inv) => inv.id);
  const scopedInvestmentTx = (data.investmentTransactions || []).filter((t) => scopedInvestmentIds.includes(t.investment_id));

  const expenseResults = q.length < 2 ? [] : scopedExpenses.filter((e) => e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const incomeResults = q.length < 2 ? [] : scopedIncomes.filter((i) => i.description.toLowerCase().includes(q))
    .sort((a, b) => b.income_date.localeCompare(a.income_date)).slice(0, 10);
  const investmentResults = q.length < 2 ? [] : scopedInvestments.filter((inv) => inv.name.toLowerCase().includes(q)).slice(0, 10);
  const investmentTxResults = q.length < 2 ? [] : scopedInvestmentTx.filter((t) => (t.description || "").toLowerCase().includes(q))
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)).slice(0, 10);

  const nothingFound = q.length >= 2 && expenseResults.length === 0 && incomeResults.length === 0 && investmentResults.length === 0 && investmentTxResults.length === 0;

  return (
    <Modal title="Buscar em tudo" onClose={onClose}>
      <div className="relative mb-3">
        <Search size={15} color={C.muted} className="absolute left-3 top-1/2 -translate-y-1/2" />
        <TextInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Gastos, receitas, investimentos..." style={{ paddingLeft: 34 }} />
      </div>

      {q.length < 2 && <p className="text-xs text-center py-4" style={{ color: C.muted }}>Digite ao menos 2 letras para buscar.</p>}
      {nothingFound && <p className="text-xs text-center py-4" style={{ color: C.muted }}>Nada encontrado para "{query}".</p>}

      {expenseResults.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Gastos</h5>
          {expenseResults.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="truncate" style={{ color: C.text }}>{e.description}</div>
                <div className="text-[10px]" style={{ color: C.muted }}>{e.category} · {formatShortDate(e.date)}{isAdmin ? ` · ${personName(e.profile_id)}` : ""}</div>
              </div>
              <Amount value={monthlyValue(e)} size="text-xs" tone={e.is_refund ? "green" : "rose"} />
            </div>
          ))}
        </div>
      )}
      {incomeResults.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Receitas</h5>
          {incomeResults.map((i) => (
            <div key={i.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="truncate" style={{ color: C.text }}>{i.description}</div>
                <div className="text-[10px]" style={{ color: C.muted }}>{formatShortDate(i.income_date)}{isAdmin ? ` · ${personName(i.profile_id)}` : ""}</div>
              </div>
              <Amount value={i.amount} size="text-xs" tone="green" />
            </div>
          ))}
        </div>
      )}
      {investmentResults.length > 0 && (
        <div className="mb-3">
          <h5 className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Caixinhas</h5>
          {investmentResults.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.text }}>{inv.name}</span>
              <Amount value={investmentBalance(inv.id, data.investmentTransactions || [])} size="text-xs" tone="green" />
            </div>
          ))}
        </div>
      )}
      {investmentTxResults.length > 0 && (
        <div>
          <h5 className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Movimentações</h5>
          {investmentTxResults.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="truncate" style={{ color: C.text }}>{t.description}</div>
                <div className="text-[10px]" style={{ color: C.muted }}>{formatShortDate(t.transaction_date)}</div>
              </div>
              <Amount value={t.amount} size="text-xs" tone={t.type === "deposit" ? "green" : "rose"} />
            </div>
          ))}
        </div>
      )}
    </Modal>
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

function ExpenseForm({ cards, userId, onSave, onClose, initial, allProfiles, customCategories, onAddCategory, startWithNoCard, creatorId, canRefund, onImportCSV, expenses }) {
  const [selectedUserId, setSelectedUserId] = useState(initial?.profile_id || userId);
  const [cardId, setCardId] = useState(() => {
    if (initial) return initial.card_id || "";
    return startWithNoCard ? "" : (cards[0]?.id || "");
  });
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [categoryTouched, setCategoryTouched] = useState(!!initial);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [description, setDescription] = useState(initial?.description || "");
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount != null ? String(Math.abs(initial.total_amount)) : "");
  const [date, setDate] = useState(initial?.purchase_date || new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState(initial?.installments || 1);
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring || false);
  const [isRefund, setIsRefund] = useState(initial?.is_refund || false);
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

  const suggestedCategory = (() => {
    if (!expenses || initial || categoryTouched) return null;
    const desc = description.trim().toLowerCase();
    if (desc.length < 3) return null;
    const matches = expenses.filter((e) => e.description && (e.description.toLowerCase().includes(desc) || desc.includes(e.description.toLowerCase())));
    if (matches.length === 0) return null;
    const counts = {};
    matches.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
    const [best] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best !== category ? best : null;
  })();

  const possibleDuplicate = (() => {
    if (!expenses || initial || !cardId || !description.trim() || totalNum <= 0) return null;
    const desc = description.trim().toLowerCase();
    return expenses.find((e) =>
      e.card_id === cardId &&
      Math.abs(e.total_amount - totalNum) < 0.01 &&
      e.description.trim().toLowerCase() === desc &&
      Math.abs(diffDays(e.purchase_date, date)) <= 5
    ) || null;
  })();
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
        cardId, category, description: description.trim(), date, firstMonth: invoiceMonthForPurchase(date, cards.find((c) => c.id === cardId)?.closing_day),
        installments: isRecurring ? 1 : Math.max(1, parseInt(installments) || 1), isRecurring, isRefund, createdBy: creatorId || userId,
      };
      let toSave;
      if (splitEnabled && splitWith && !isRefund) {
        const amountAPrecise = Math.round(amountA * 1000) / 1000;
        const amountBPrecise = Math.round((totalNum - amountAPrecise) * 1000) / 1000;
        const splitGroupId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
        toSave = [
          { ...base, id: initial?.id, userId: selectedUserId, totalAmount: amountAPrecise, receiptUrl, splitGroupId },
          { ...base, userId: splitWith, totalAmount: amountBPrecise, receiptUrl: null, splitGroupId },
        ];
      } else {
        toSave = [{ ...base, id: initial?.id, userId: selectedUserId, totalAmount: isRefund ? -Math.abs(totalNum) : totalNum, receiptUrl }];
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
          <FileInput accept="image/*" label="Escolher foto" onFileSelected={handleReceiptChange} />
          {importing && <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: C.muted }}><Clock size={11} /> Lendo comprovante...</p>}
          {importNote && !importing && <p className="text-xs mt-1.5" style={{ color: C.gold }}>{importNote}</p>}
          {onImportCSV && (
            <button type="button" onClick={onImportCSV} className="flex items-center gap-1.5 text-xs mt-2.5" style={{ color: C.gold }}>
              <Paperclip size={12} /> Ou importar um extrato do banco (CSV) de uma vez
            </button>
          )}
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
      {suggestedCategory && (
        <button type="button" onClick={() => { setCategory(suggestedCategory); setCategoryTouched(true); }}
          className="flex items-center gap-1.5 text-xs mb-3 -mt-2" style={{ color: C.gold }}>
          <PieIcon size={12} /> Sugestão: categoria "{suggestedCategory}" — toque para usar
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <Field label="Categoria">
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setCategoryTouched(true); }}>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Valor (R$)"><CurrencyInput value={totalAmount} onChange={setTotalAmount} /></Field>
      </div>
      {possibleDuplicate && (
        <div className="flex items-start gap-2 rounded-xl p-3 mb-3.5" style={{ background: "rgba(203,160,90,0.10)", border: `1px solid ${C.border}` }}>
          <AlertTriangle size={14} color={C.amber} className="shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: C.muted }}>
            Parece que você já lançou <b style={{ color: C.text }}>"{possibleDuplicate.description}"</b> de{" "}
            <b style={{ color: C.text }}>{brl(possibleDuplicate.total_amount)}</b> em {formatShortDate(possibleDuplicate.purchase_date)}. Confere se não é duplicado.
          </p>
        </div>
      )}

      {canRefund && (
        <label className="flex items-center gap-2.5 text-sm mb-3.5" style={{ color: C.text }}>
          <Switch checked={isRefund} onChange={setIsRefund} />
          <TrendingUp size={14} color={C.green} /> Isto é um reembolso (valor volta pra fatura)
        </label>
      )}

      <p className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.gold }}>Quando</p>
      <Field label="Data da compra"><DateInput value={date} onChange={setDate} /></Field>

      {!isRefund && (
        <>
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
        </>
      )}

      {!initial && !isRefund && splitCandidates.length > 0 && (
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
                style={{ background: `linear-gradient(to right, ${C.gold} 0%, ${C.gold} ${pct}%, #8C6FA8 ${pct}%, #8C6FA8 100%)` }} />
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
          <FileInput accept="image/*,application/pdf" onFileSelected={setReceiptFile} />
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
  const base = brand ? brand.color : "#C9A24C";
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

function buildDisplayRows(list, allExpenses) {
  const seen = new Set();
  const rows = [];
  for (const exp of list) {
    if (exp.split_group_id) {
      if (seen.has(exp.split_group_id)) continue;
      seen.add(exp.split_group_id);
      const parts = allExpenses.filter((e) => e.split_group_id === exp.split_group_id);
      if (parts.length > 1) {
        rows.push({ isGroup: true, groupId: exp.split_group_id, parts, primary: exp });
        continue;
      }
    }
    rows.push({ isGroup: false, exp });
  }
  return rows;
}

/* ---------------------------------- EXPENSE ROW ---------------------------------- */

function GroupedExpenseRow({ parts, cardName, personName, viewerProfileId, showPerson, onEdit, onDeleteGroup }) {
  const primary = parts[0];
  const total = parts.reduce((s, p) => s + monthlyValue(p), 0);
  const myPart = parts.find((p) => p.profile_id === viewerProfileId);
  const editTarget = myPart || primary;

  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(primary.category) }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: C.text }}>
          {primary.description}
          <Share2 size={11} color={C.muted} />
        </div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {formatShortDate(primary.purchase_date)} · {primary.category} · {cardName}
        </div>
        <div className="text-[11px] truncate mt-0.5">
          {showPerson ? (
            parts.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span style={{ color: C.muted }}> · </span>}
                <span style={{ color: p.id === viewerProfileId ? C.gold : C.muted }}>{personName(p.profile_id)}: {brl(monthlyValue(p))}</span>
              </span>
            ))
          ) : (
            <>
              <span style={{ color: C.muted }}>Total {brl(total)} · </span>
              <span style={{ color: C.gold, fontWeight: 600 }}>sua parte {brl(myPart ? monthlyValue(myPart) : 0)}</span>
            </>
          )}
        </div>
      </div>
      <Amount value={total} size="text-sm" />
      <button onClick={() => onEdit(editTarget)}><Pencil size={14} color={C.muted} /></button>
      <button onClick={() => onDeleteGroup(parts)}><Trash2 size={14} color={C.rose} /></button>
    </div>
  );
}

function ExpenseRow({ exp, cardName, personName, creatorName, contextMonth, onEdit, onDelete, showPerson, selectable, selected, onToggleSelect, onToggleReconciled }) {
  const installmentLabel = !exp.is_recurring && exp.installments > 1
    ? (contextMonth ? `${Math.min(Math.max(diffMonths(exp.first_month, contextMonth) + 1, 1), exp.installments)}/${exp.installments}` : `${exp.installments}x`)
    : null;
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}`, opacity: exp.reconciled ? 0.6 : 1 }}>
      {selectable && (
        <button onClick={() => onToggleSelect(exp.id)} className="shrink-0">
          {selected ? <CheckSquare size={16} color={C.gold} /> : <Square size={16} color={C.muted} />}
        </button>
      )}
      {!selectable && onToggleReconciled && exp.card_id && (
        <button onClick={() => onToggleReconciled(exp)} className="shrink-0" title={exp.reconciled ? "Conferido com o extrato" : "Marcar como conferido"}>
          {exp.reconciled ? <CheckSquare size={16} color={C.green} /> : <Square size={16} color={C.muted} />}
        </button>
      )}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(exp.category) }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: C.text }}>
          {exp.description}{exp.is_recurring && <Repeat size={11} color={C.muted} />}
          {exp.is_refund && <TrendingUp size={11} color={C.green} />}
          {exp.receipt_url && <a href={exp.receipt_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Paperclip size={11} color={C.muted} /></a>}
        </div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {formatShortDate(exp.purchase_date)} · {exp.category} · {cardName}{showPerson ? ` · ${personName}` : ""}
          {installmentLabel && ` · ${installmentLabel}`}
          {exp.is_recurring && " · recorrente"}
          {exp.is_refund && " · reembolso"}
          {exp.created_by && exp.created_by !== exp.profile_id && ` · lançado por ${creatorName}`}
        </div>
      </div>
      <Amount value={monthlyValue(exp)} size="text-sm" tone={exp.is_refund ? "green" : undefined} />
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
      <Field label="Data"><DateInput value={date} onChange={setDate} /></Field>
      <label className="flex items-center gap-2.5 text-sm mb-3.5" style={{ color: C.text }}>
        <Switch checked={isRecurring} onChange={setIsRecurring} />
        <Repeat size={14} color={C.muted} /> Receita recorrente (todo mês)
      </label>
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar receita"}</Btn>
    </Modal>
  );
}

function projectMonthEnd(expenses, profileIds, monthKey = currentMonthKey()) {
  const today = new Date();
  const daysElapsed = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dueNow = expenses.filter((e) => profileIds.includes(e.profile_id) && isDueIn(e, monthKey));
  const fixed = dueNow.filter((e) => e.is_recurring || e.installments > 1).reduce((s, e) => s + monthlyValue(e), 0);
  const adhocSoFar = dueNow.filter((e) => !e.is_recurring && e.installments <= 1).reduce((s, e) => s + monthlyValue(e), 0);
  const dailyRate = daysElapsed > 0 ? adhocSoFar / daysElapsed : 0;
  const projectedTotal = fixed + dailyRate * daysInMonth;
  return { projectedTotal, daysRemaining: daysInMonth - daysElapsed };
}

function IncomeSection({ profile, data, refresh, scopeIds, scopeLabel }) {
  const now = openInvoiceMonth(data.cards);
  const ids = scopeIds && scopeIds.length > 0 ? scopeIds : [profile.id];
  const myIncomes = (data.incomes || []).filter((i) => i.profile_id === profile.id);
  const incomeMonth = (data.incomes || []).filter((i) => ids.includes(i.profile_id) && isIncomeDueIn(i, now)).reduce((s, i) => s + incomeMonthlyValue(i), 0);
  const expenseMonth = data.expenses.filter((e) => ids.includes(e.profile_id) && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const saldo = incomeMonth - expenseMonth;
  const projection = projectMonthEnd(data.expenses, ids, now);
  const projectedSaldo = incomeMonth - projection.projectedTotal;
  const showProjection = projection.daysRemaining > 1 && Math.abs(projectedSaldo - saldo) > 1;
  const myInvestments = (data.investments || []).filter((inv) => inv.created_by === profile.id || inv.memberIds.includes(profile.id));
  const investedTotal = myInvestments.reduce((s, inv) => s + investmentBalance(inv.id, data.investmentTransactions || []), 0);

  const handleDelete = async (inc) => { if (!window.confirm("Excluir esta receita?")) return; await deleteIncome(inc); await refresh(); };

  return (
    <Panel className="mb-4" style={{
      background: `linear-gradient(160deg, ${saldo < 0 ? "rgba(168,80,79,0.10)" : "rgba(47,122,92,0.10)"}, ${C.surface} 55%)`,
      border: `1px solid ${saldo < 0 ? "rgba(168,80,79,0.32)" : "rgba(47,122,92,0.28)"}`,
    }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: saldo < 0 ? "rgba(168,80,79,0.16)" : "rgba(47,122,92,0.16)" }}>
            {saldo < 0 ? <TrendingDown size={19} color={C.rose} /> : <TrendingUp size={19} color={C.green} />}
          </div>
          <div>
            <span className="text-[11px]" style={{ color: C.muted }}>{scopeLabel || "saldo do mês"}</span>
            <div><Amount value={saldo} size="text-2xl" tone={saldo < 0 ? "rose" : "green"} /></div>
          </div>
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

      {showProjection && (
        <div className="flex items-start gap-2 pt-3">
          <TrendingUp size={13} color={C.gold} className="shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
            No ritmo atual, deve fechar o mês com{" "}
            <span className="font-semibold" style={{ color: projectedSaldo < 0 ? C.rose : C.green }}>{brl(projectedSaldo)}</span> de saldo.
          </p>
        </div>
      )}

      {myInvestments.length > 0 && (
        <div className="flex items-center justify-between pt-3 pb-1 text-xs" style={{ color: C.muted }}>
          <span className="flex items-center gap-1.5"><PiggyBank size={12} color={C.green} /> patrimônio investido</span>
          <Amount value={investedTotal} size="text-sm" tone="green" />
        </div>
      )}

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
    </Panel>
  );
}

/* ---------------------------------- GOALS (individual, reusable) ---------------------------------- */

/* ---------------------------------- INVESTMENTS ---------------------------------- */

function investmentBalance(investmentId, transactions) {
  const now = currentMonthKey();
  return transactions.filter((t) => t.investment_id === investmentId).reduce((s, t) => {
    const sign = t.type === "deposit" ? 1 : -1;
    if (t.is_recurring) {
      const occurrences = Math.max(diffMonths(monthKeyFromDate(t.transaction_date), now) + 1, 0);
      return s + sign * t.amount * occurrences;
    }
    return s + sign * t.amount;
  }, 0);
}
function investmentBalanceUpTo(investmentId, transactions, monthKey) {
  return transactions.filter((t) => t.investment_id === investmentId).reduce((s, t) => {
    const sign = t.type === "deposit" ? 1 : -1;
    const startKey = monthKeyFromDate(t.transaction_date);
    if (t.is_recurring) {
      if (startKey > monthKey) return s;
      return s + sign * t.amount * (diffMonths(startKey, monthKey) + 1);
    }
    return startKey <= monthKey ? s + sign * t.amount : s;
  }, 0);
}
function investmentMonthlyRate(inv, cdiAnnual) {
  if (!inv.cdi_percent || !cdiAnnual) return null;
  const annualEffective = (cdiAnnual / 100) * (inv.cdi_percent / 100);
  return (Math.pow(1 + annualEffective, 1 / 12) - 1) * 100;
}
function useCurrentCDI() {
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

async function fetchCurrentCDI() {
  const res = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json");
  if (!res.ok) throw new Error("Falha ao consultar o Banco Central");
  const data = await res.json();
  const dailyRate = parseFloat(data[0]?.valor);
  if (isNaN(dailyRate)) throw new Error("Resposta inesperada do Banco Central");
  return (Math.pow(1 + dailyRate / 100, 252) - 1) * 100;
}

function InvestmentForm({ allProfiles, viewerProfileId, onSave, onClose, initial }) {
  const [name, setName] = useState(initial?.name || "");
  const [cdiPercent, setCdiPercent] = useState(initial?.cdi_percent != null ? String(initial.cdi_percent) : "100");
  const [targetAmount, setTargetAmount] = useState(initial?.target_amount != null ? String(initial.target_amount) : "");
  const [targetDate, setTargetDate] = useState(initial?.target_date || "");
  const [memberIds, setMemberIds] = useState(initial?.memberIds || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const shareCandidates = allProfiles.filter((p) => p.id !== viewerProfileId);
  const toggle = (id) => setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true); setErr("");
    try {
      await onSave({
        id: initial?.id, name: name.trim(),
        cdi_percent: cdiPercent ? parseFloat(cdiPercent) : null,
        target_amount: targetAmount ? parseFloat(targetAmount) : null,
        target_date: targetDate || null,
        memberIds,
      });
      onClose();
    } catch (e) {
      setSaving(false);
      setErr(friendlyError(e));
    }
  };

  return (
    <Modal title={initial ? "Editar caixinha" : "Nova caixinha"} onClose={onClose}>
      <Field label="Nome da caixinha"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reserva de emergência" /></Field>
      <Field label="% do CDI"><IconField icon={<Percent size={13} />} type="number" step="1" value={cdiPercent} onChange={(e) => setCdiPercent(e.target.value)} placeholder="115" /></Field>
      <p className="text-[11px] -mt-2.5 mb-3.5" style={{ color: C.muted }}>O CDI atual é buscado automaticamente e vale pra todas as caixinhas — não precisa informar aqui.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta (R$, opcional)"><CurrencyInput value={targetAmount} onChange={setTargetAmount} /></Field>
        <Field label="Até quando (opcional)"><DateInput value={targetDate} onChange={setTargetDate} /></Field>
      </div>
      {shareCandidates.length > 0 && (
        <Field label="Compartilhar com outra pessoa (opcional)">
          <div className="flex flex-col gap-2 mt-1">
            {shareCandidates.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 text-sm" style={{ color: C.text }}>
                <Switch checked={memberIds.includes(p.id)} onChange={() => toggle(p.id)} />
                {firstName(p.name)}
              </label>
            ))}
          </div>
        </Field>
      )}
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar caixinha"}</Btn>
    </Modal>
  );
}

function InvestmentTransactionForm({ investmentId, profileId, defaultType, onSave, onClose }) {
  const [type, setType] = useState(defaultType || "deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!amount) return;
    setSaving(true); setErr("");
    try {
      let receiptUrl = null;
      if (receiptFile) receiptUrl = await uploadReceipt(receiptFile, profileId);
      await onSave({ investmentId, profileId, type, amount: parseFloat(amount), date, description: description.trim(), receiptUrl, isRecurring });
      onClose();
    } catch (e) {
      setSaving(false);
      setErr(friendlyError(e));
    }
  };

  return (
    <Modal title="Movimentar caixinha" onClose={onClose}>
      <div className="flex gap-2 mb-3.5">
        <button onClick={() => setType("deposit")} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium"
          style={{ background: type === "deposit" ? C.green : "transparent", color: type === "deposit" ? "#fff" : C.muted, border: `1px solid ${type === "deposit" ? C.green : C.border}` }}>
          <ArrowUpCircle size={15} /> Depositar
        </button>
        <button onClick={() => setType("withdraw")} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium"
          style={{ background: type === "withdraw" ? C.rose : "transparent", color: type === "withdraw" ? "#fff" : C.muted, border: `1px solid ${type === "withdraw" ? C.rose : C.border}` }}>
          <ArrowDownCircle size={15} /> Resgatar
        </button>
      </div>
      <Field label="Valor (R$)"><CurrencyInput value={amount} onChange={setAmount} /></Field>
      <Field label="Data"><DateInput value={date} onChange={setDate} /></Field>
      <Field label="Descrição (opcional)"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aporte mensal" /></Field>
      {type === "deposit" && (
        <label className="flex items-center gap-2 mb-3.5 text-xs" style={{ color: C.text }}>
          <Switch checked={isRecurring} onChange={() => setIsRecurring((v) => !v)} />
          <Repeat size={14} color={C.muted} /> Aporte recorrente (todo mês, a partir desta data)
        </label>
      )}
      <Field label="Comprovante (opcional)">
        <FileInput accept="image/*,application/pdf" onFileSelected={setReceiptFile} />
      </Field>
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</Btn>
    </Modal>
  );
}

function InvestmentCard({ inv, balance, transactions, profiles, viewerProfileId, isAdmin, cdiAnnual, onMove, onEdit, onDelete, onDeleteTx }) {
  const canManage = isAdmin || inv.created_by === viewerProfileId;
  const owners = profiles.filter((p) => inv.memberIds.includes(p.id) || p.id === inv.created_by).map((p) => firstName(p.name)).join(", ");
  const [showHistory, setShowHistory] = useState(false);
  const [txPeriod, setTxPeriod] = useState("all");
  const allTx = transactions.filter((t) => t.investment_id === inv.id).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  const txMonthKeys = txPeriod === "all" ? null : monthKeysForPeriod(txPeriod, { start: "", end: "" });
  const myTx = txMonthKeys ? allTx.filter((t) => txMonthKeys.includes(monthKeyFromDate(t.transaction_date))) : allTx;

  return (
    <Panel>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(84,176,138,0.15)" }}>
            <PiggyBank size={18} color={C.green} />
          </div>
          <div>
            <div className="font-medium text-sm" style={{ color: C.text }}>{inv.name}</div>
            <div className="text-[11px]" style={{ color: C.muted }}>acesso: {owners}</div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onEdit(inv)}><Pencil size={14} color={C.muted} /></button>
            <button onClick={() => onDelete(inv)}><Trash2 size={14} color={C.rose} /></button>
          </div>
        )}
      </div>
      {inv.cdi_percent != null && (
        <Chip tone="green" icon={<TrendingUp size={10} />}>{inv.cdi_percent}% do CDI</Chip>
      )}
      <span className="text-[11px] block mt-2" style={{ color: C.muted }}>saldo</span>
      <div className="mb-3"><Amount value={balance} size="text-2xl" tone="green" /></div>
      {inv.target_amount != null && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1.5 text-xs" style={{ color: C.muted }}>
            <span>meta{inv.target_date ? ` até ${formatShortDate(inv.target_date)}` : ""}</span>
            <span style={{ color: C.text }}>{brl(balance)} <span style={{ color: C.muted }}>de {brl(inv.target_amount)}</span></span>
          </div>
          <ProgressBar pct={(balance / inv.target_amount) * 100} tone={balance >= inv.target_amount ? "green" : "gold"} />
        </div>
      )}
      {(() => {
        const rate = investmentMonthlyRate(inv, cdiAnnual);
        return rate != null && (
          <p className="text-[11px] mb-3" style={{ color: C.muted }}>rende ~{rate.toFixed(2)}% ao mês · projeção {brl(balance * (1 + rate / 100))}</p>
        );
      })()}
      <div className="flex gap-2 mb-2">
        <Btn full variant="ghost" onClick={() => onMove(inv, "deposit")}><ArrowUpCircle size={14} color={C.green} /> Depositar</Btn>
        <Btn full variant="ghost" onClick={() => onMove(inv, "withdraw")}><ArrowDownCircle size={14} color={C.rose} /> Resgatar</Btn>
      </div>
      <button onClick={() => setShowHistory((v) => !v)} className="text-xs w-full text-center py-1.5" style={{ color: C.muted }}>
        {showHistory ? "Esconder extrato ▲" : `Ver extrato (${allTx.length}) ▼`}
      </button>
      {showHistory && (
        <div className="mt-1 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex justify-end mb-2">
            <Select value={txPeriod} onChange={(e) => setTxPeriod(e.target.value)} style={{ width: "auto", padding: "4px 8px", fontSize: 11 }}>
              <option value="all">Tudo</option>
              <option value="month">Este mês</option>
              <option value="3m">Últimos 3 meses</option>
              <option value="6m">Últimos 6 meses</option>
              <option value="year">Este ano</option>
            </Select>
          </div>
          {myTx.length === 0 ? (
            <p className="text-xs py-2" style={{ color: C.muted }}>Nenhuma movimentação ainda.</p>
          ) : (
            myTx.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                {t.type === "deposit" ? <ArrowUpCircle size={14} color={C.green} /> : <ArrowDownCircle size={14} color={C.rose} />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs truncate flex items-center gap-1.5" style={{ color: C.text }}>
                    {t.description || (t.type === "deposit" ? "Depósito" : "Resgate")}
                    {t.is_recurring && <Repeat size={11} color={C.muted} />}
                    {t.receipt_url && <a href={t.receipt_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Paperclip size={11} color={C.muted} /></a>}
                  </div>
                  <div className="text-[10px]" style={{ color: C.muted }}>{formatShortDate(t.transaction_date)}</div>
                </div>
                <Amount value={t.amount} size="text-xs" tone={t.type === "deposit" ? "green" : "rose"} />
                <button onClick={() => onDeleteTx(t)}><Trash2 size={12} color={C.rose} /></button>
              </div>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}

function InvestmentSimulator({ cdiAnnual, onClose, embedded }) {
  const [initial, setInitial] = useState(1000);
  const [monthly, setMonthly] = useState(200);
  const [cdiPercent, setCdiPercent] = useState(100);
  const [months, setMonths] = useState(12);

  const monthlyRate = investmentMonthlyRate({ cdi_percent: cdiPercent }, cdiAnnual);
  const i = (monthlyRate || 0) / 100;
  const n = Math.max(parseInt(months) || 0, 0);
  const p = parseFloat(initial) || 0;
  const a = parseFloat(monthly) || 0;
  const futureValue = i > 0
    ? p * Math.pow(1 + i, n) + a * ((Math.pow(1 + i, n) - 1) / i)
    : p + a * n;
  const totalContributed = p + a * n;
  const earned = futureValue - totalContributed;

  const content = (
    <>
      <Field label="Valor inicial (R$)"><CurrencyInput value={initial} onChange={setInitial} /></Field>
      <Field label="Aporte mensal (R$)"><CurrencyInput value={monthly} onChange={setMonthly} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="% do CDI"><TextInput type="number" value={cdiPercent} onChange={(e) => setCdiPercent(e.target.value)} /></Field>
        <Field label="Meses"><TextInput type="number" value={months} onChange={(e) => setMonths(e.target.value)} /></Field>
      </div>
      {cdiAnnual == null && <p className="text-[11px] mb-3" style={{ color: C.muted }}>CDI atual indisponível agora — a simulação usa a última taxa conhecida, se houver.</p>}
      <div className="rounded-xl p-4 mt-1" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: C.muted }}>valor final estimado</span>
          <Amount value={futureValue} size="text-lg" tone="green" />
        </div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: C.muted }}>total aportado</span>
          <span style={{ color: C.text }}>{brl(totalContributed)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: C.muted }}>rendimento gerado</span>
          <span style={{ color: C.green }}>{brl(earned)}</span>
        </div>
      </div>
    </>
  );

  if (embedded) return <Panel>{content}</Panel>;
  return <Modal title="Simulador de investimento" onClose={onClose}>{content}</Modal>;
}

function InvestmentsScreen({ profile, data, refresh, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [view, setView] = useState("caixinhas");
  const { cdi, loading: cdiLoading } = useCurrentCDI();

  const myInvestments = isAdmin
    ? data.investments
    : data.investments.filter((inv) => inv.created_by === profile.id || inv.memberIds.includes(profile.id));

  const totalBalance = myInvestments.reduce((s, inv) => s + investmentBalance(inv.id, data.investmentTransactions), 0);

  const handleSaveInvestment = async (inv) => { await saveInvestment({ ...inv, created_by: profile.id }); await refresh(); };
  const handleDeleteInvestment = async (inv) => { if (!window.confirm(`Excluir a caixinha "${inv.name}"? Isso também remove o histórico dela.`)) return; await deleteInvestment(inv); await refresh(); };
  const handleSaveTx = async (tx) => { await saveInvestmentTransaction(tx); await refresh(); };
  const handleDeleteTx = async (tx) => { if (!window.confirm("Excluir esta movimentação?")) return; await deleteInvestmentTransaction(tx); await refresh(); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16">
      <ScreenHeader title="Investimentos" subtitle="Caixinhas de renda fixa" />
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView("caixinhas")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: view === "caixinhas" ? C.gold : C.surface, color: view === "caixinhas" ? "var(--gold-contrast)" : C.muted, border: `1px solid ${view === "caixinhas" ? C.gold : C.border}` }}>
          <PiggyBank size={15} /> Caixinhas
        </button>
        <button onClick={() => setView("simulador")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: view === "simulador" ? C.gold : C.surface, color: view === "simulador" ? "var(--gold-contrast)" : C.muted, border: `1px solid ${view === "simulador" ? C.gold : C.border}` }}>
          <Percent size={15} /> Simulador
        </button>
      </div>

      {view === "simulador" ? (
        <InvestmentSimulator cdiAnnual={cdi} embedded />
      ) : (
        <>
          <HeroPanel label="Saldo total investido" value={totalBalance} />
          <div className="flex items-center gap-1.5 mb-4 text-xs" style={{ color: C.muted }}>
            <TrendingUp size={12} color={C.green} />
            {cdiLoading ? "Buscando CDI atual..." : cdi != null ? `CDI atual: ${cdi.toFixed(2)}% ao ano` : "Não foi possível buscar o CDI agora"}
          </div>
          <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Nova caixinha</Btn>
          <div className="mt-4 space-y-3">
            {myInvestments.length === 0 && <Panel><EmptyState icon={<PiggyBank size={28} />} text="Nenhuma caixinha ainda. Crie a primeira." /></Panel>}
            {myInvestments.map((inv) => (
              <InvestmentCard key={inv.id} inv={inv} balance={investmentBalance(inv.id, data.investmentTransactions)} transactions={data.investmentTransactions} profiles={data.profiles}
                viewerProfileId={profile.id} isAdmin={isAdmin} cdiAnnual={cdi}
                onMove={(i, type) => setMoveTarget({ inv: i, type })}
                onEdit={(i) => { setEditing(i); setShowForm(true); }}
                onDelete={handleDeleteInvestment} onDeleteTx={handleDeleteTx} />
            ))}
          </div>
        </>
      )}

      {showForm && <InvestmentForm allProfiles={data.profiles} viewerProfileId={profile.id} initial={editing} onSave={handleSaveInvestment} onClose={() => setShowForm(false)} />}
      {moveTarget && (
        <InvestmentTransactionForm investmentId={moveTarget.inv.id} profileId={profile.id} defaultType={moveTarget.type}
          onSave={handleSaveTx} onClose={() => setMoveTarget(null)} />
      )}
    </div>
  );
}

/* ---------------------------------- ---------------------------------- */

function GoalsScreen({ profile, data, refresh, embedded }) {
  const now = openInvoiceMonth(data.cards);
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
    <div className={embedded ? "pb-28 pt-3" : "max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16"}>
      {!embedded && <ScreenHeader title="Metas" subtitle="Seus limites por categoria" />}
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

function invoiceMonths(now) {
  return Array.from({ length: 14 }, (_, i) => addMonthsToKey(now, i - 1));
}
function invoiceStatusInfo(card, monthKey) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentInvoiceMonth = invoiceMonthForPurchase(todayStr, card.closing_day);
  const diff = diffMonths(monthKey, currentInvoiceMonth);
  if (diff > 0) return { label: "futura", tone: "muted" };
  if (diff === 0) return { label: "aberta", tone: "green" };
  return { label: "fechada", tone: "muted" };
}

const FALLBACK_CAT_COLORS = ["#F2994A", "#4A90D9", "#27AE60", "#E84393", "#EB5757", "#9B59B6", "#17A2A0", "#6C5CE7", "#F1C40F", "#FF7F6B"];
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
async function saveInvestment(inv) {
  const { memberIds, created_by, ...rest } = inv;
  const isNew = !inv.id;
  let invId = inv.id;
  if (isNew) {
    const { data, error } = await supabase.from("investments").insert({ ...rest, created_by }).select().single();
    if (error) throw error;
    invId = data.id;
  } else {
    const { error } = await supabase.from("investments").update(rest).eq("id", invId);
    if (error) throw error;
  }
  const { error: delErr } = await supabase.from("investment_access").delete().eq("investment_id", invId);
  if (delErr) throw delErr;
  if (memberIds.length) {
    const { error: accErr } = await supabase.from("investment_access").insert(memberIds.map((profile_id) => ({ investment_id: invId, profile_id })));
    if (accErr) throw accErr;
  }
}
async function deleteInvestment(inv) {
  const { error } = await supabase.from("investments").delete().eq("id", inv.id);
  if (error) throw error;
}
async function saveInvestmentTransaction(tx) {
  const payload = { investment_id: tx.investmentId, profile_id: tx.profileId, type: tx.type, amount: tx.amount, transaction_date: tx.date, description: tx.description || null, receipt_url: tx.receiptUrl || null, is_recurring: tx.isRecurring || false };
  const { error } = await supabase.from("investment_transactions").insert(payload);
  if (error) throw error;
}
async function deleteInvestmentTransaction(tx) {
  const { error } = await supabase.from("investment_transactions").delete().eq("id", tx.id);
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
      const closingDay = cards.find((c) => c.id === cardId)?.closing_day;
      const toImport = rows.filter((r) => r.include).map((r) => ({
        cardId, userId, category: r.category, description: r.description,
        totalAmount: r.amount, date: r.date, firstMonth: invoiceMonthForPurchase(r.date, closingDay),
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
          <FileInput accept=".csv,text/csv" label="Escolher CSV" onFileSelected={handleFile} />
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

function PayInvoiceModal({ card, monthKey, invoiceTotal, alreadyPaid, onConfirm, onClose }) {
  const remaining = Math.max(invoiceTotal - alreadyPaid, 0);
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining.toFixed(2)) : "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    try { await onConfirm(value); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Pagar fatura · ${card.name}`} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        Fatura de {monthLabel(monthKey)} · total {brl(invoiceTotal)}{alreadyPaid > 0 ? ` · já pago ${brl(alreadyPaid)}` : ""}
      </p>
      <Field label="Valor pago (R$)"><CurrencyInput value={amount} onChange={setAmount} /></Field>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setAmount(String(remaining.toFixed(2)))} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}` }}>
          Valor total restante
        </button>
      </div>
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Confirmar pagamento"}</Btn>
    </Modal>
  );
}

function ChoosePayCardModal({ cards, monthKey, expenses, payments, onChoose, onClose }) {
  return (
    <Modal title={`Pagar fatura de ${monthLabel(monthKey)}`} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>Escolha qual cartão você quer pagar.</p>
      <div className="space-y-2">
        {cards.map((c) => {
          const total = expenses.filter((e) => e.card_id === c.id && isDueIn(e, monthKey)).reduce((s, e) => s + monthlyValue(e), 0);
          const paid = paidForInvoice(payments, c.id, monthKey);
          const status = invoicePaymentStatus(c, monthKey, total, paid);
          return (
            <button key={c.id} onClick={() => onChoose(c)} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>{c.name}</div>
                <Chip tone={status.tone}>{status.label}</Chip>
              </div>
              <Amount value={total} size="text-sm" />
            </button>
          );
        })}
        {cards.length === 0 && <EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão disponível." />}
      </div>
    </Modal>
  );
}

function HistoryScreen({ profile, data, refresh, isAdmin }) {
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterCard, setFilterCard] = useState(() => {
    const cards = isAdmin ? data.cards : accessibleCards(data, profile.id);
    return cards.length === 1 ? cards[0].id : "all";
  });
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
  const monthRefs = useRef({});
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
  const [selectedMonth, setSelectedMonth] = useState(() => openInvoiceMonth(isAdmin ? data.cards : accessibleCards(data, profile.id)));

  const cardName = (id) => id ? (data.cards.find((c) => c.id === id)?.name || "-") : "Dinheiro/Pix";
  const personName = (id) => firstName(data.profiles.find((u) => u.id === id)?.name) || "-";
  const searching = query.trim().length > 0;

  const baseExpenses = isAdmin ? data.expenses : data.expenses.filter((e) => e.profile_id === profile.id);
  const filtered = baseExpenses
    .filter((e) => !isAdmin || filterPerson === "all" || e.profile_id === filterPerson)
    .filter((e) => filterCard === "all" || e.card_id === filterCard)
    .filter((e) => e.description.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  const myCards = isAdmin ? data.cards : accessibleCards(data, profile.id);

  const handleSave = async (expArr) => {
    const arr = Array.isArray(expArr) ? expArr : [expArr];
    const isEdit = !!editing;
    for (const e of arr) await saveExpense(e);
    await refresh();
    const desc = arr[0]?.description || "gasto";
    await logActivity(profile.id, isEdit ? "editou" : "criou", `${isEdit ? "Editou" : "Lançou"} o gasto "${desc}"`);
  };
  const handleDelete = async (exp) => {
    if (!window.confirm("Excluir este gasto?")) return;
    await deleteExpense(exp);
    await refresh();
    await logActivity(profile.id, "excluiu", `Excluiu o gasto "${exp.description}"`);
  };
  const handleToggleReconciled = async (exp) => { await toggleExpenseReconciled(exp.id, !exp.reconciled); await refresh(); };
  const handleDeleteGroup = async (parts) => {
    if (!window.confirm("Excluir este gasto dividido? As duas partes serão removidas.")) return;
    for (const p of parts) await deleteExpense(p);
    await refresh();
    await logActivity(profile.id, "excluiu", `Excluiu o gasto dividido "${parts[0]?.description}"`);
  };
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

  const invoiceScopedExpenses = baseExpenses.filter((e) => !isAdmin || filterPerson === "all" || e.profile_id === filterPerson);
  const invoiceCards = filterCard === "all" ? myCards : myCards.filter((c) => c.id === filterCard);
  const invoiceNow = openInvoiceMonth(myCards);
  const invoiceMonthsList = invoiceMonths(invoiceNow).filter((mk) => /^\d{4}-\d{2}$/.test(mk));
  const invoiceLineItems = invoiceScopedExpenses
    .filter((e) => (filterCard === "all" || e.card_id === filterCard) && isDueIn(e, selectedMonth))
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
  const invoiceTotal = invoiceLineItems.reduce((s, e) => s + monthlyValue(e), 0);
  const invoiceSingleCard = filterCard !== "all" ? invoiceCards.find((c) => c.id === filterCard) : null;
  const displayCard = invoiceSingleCard || invoiceCards[0] || myCards[0] || null;
  const invoiceStatus = displayCard ? invoiceStatusInfo(displayCard, selectedMonth) : null;
  const invoicePaidTotal = invoiceSingleCard ? paidForInvoice(data.invoicePayments, invoiceSingleCard.id, selectedMonth) : 0;
  const paymentStatus = invoiceSingleCard
    ? invoicePaymentStatus(invoiceSingleCard, selectedMonth, invoiceTotal, invoicePaidTotal)
    : (invoiceStatus ? { label: invoiceStatus.label === "aberta" ? "fatura atual" : invoiceStatus.label === "futura" ? "futura" : "fechada", tone: invoiceStatus.label === "aberta" ? "gold" : "muted" } : null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showPayPicker, setShowPayPicker] = useState(false);
  const handlePayInvoice = async (amount) => {
    await saveInvoicePayment({ cardId: invoiceSingleCard.id, monthKey: selectedMonth, amount, paidAt: new Date().toISOString().slice(0, 10), profileId: profile.id });
    await logActivity(profile.id, "pagou", `Registrou pagamento de ${brl(amount)} na fatura de ${monthLabel(selectedMonth)} (${invoiceSingleCard.name})`);
    await refresh();
  };

  useEffect(() => {
    if (viewMode !== "faturas") return;
    const now = openInvoiceMonth(myCards);
    const idx = invoiceMonthsList.indexOf(now);
    const anchorIdx = Math.max(idx - 1, 0);
    const anchorMonth = invoiceMonthsList[anchorIdx];
    const timer = setTimeout(() => {
      const el = anchorMonth && monthRefs.current[anchorMonth];
      if (el) el.scrollIntoView({ inline: "start", block: "nearest" });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, invoiceMonthsList.join(","), filterCard, filterPerson]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16">
      <ScreenHeader title={viewMode === "cards" ? "Cartões" : "Faturas"} subtitle={viewMode === "cards" ? "Limites, vencimentos e acessos" : (isAdmin ? "Todos os lançamentos" : "Seus lançamentos")} />

      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => setViewMode("faturas")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: viewMode === "faturas" ? C.gold : C.surface, color: viewMode === "faturas" ? "var(--gold-contrast)" : C.muted, border: `1px solid ${viewMode === "faturas" ? C.gold : C.border}` }}>
            <ListChecks size={15} /> Faturas
          </button>
          <button onClick={() => setViewMode("cards")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: viewMode === "cards" ? C.gold : C.surface, color: viewMode === "cards" ? "var(--gold-contrast)" : C.muted, border: `1px solid ${viewMode === "cards" ? C.gold : C.border}` }}>
            <CreditCard size={15} /> Cartões
          </button>
        </div>
      )}

      {viewMode === "cards" ? (
        <AdminCards data={data} refresh={refresh} embedded />
      ) : (
        <>
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
      {isAdmin && filterCard === "all" && data.cards.length > 1 && (
        <p className="text-[11px] -mt-2 mb-3" style={{ color: C.muted }}>Escolha um cartão acima pra ver o status da fatura e registrar pagamento.</p>
      )}

      <div className="relative mb-3">
        <Search size={15} color={C.muted} className="absolute left-3 top-1/2 -translate-y-1/2" />
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar em todos os meses..." style={{ paddingLeft: 34 }} />
      </div>

      <div className="flex gap-2 mb-4">
        <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Novo gasto</Btn>
        <div className="relative">
          <Btn variant="ghost" onClick={() => setShowExportMenu((v) => !v)}><Download size={16} /></Btn>
          {showExportMenu && (
            <div className="absolute right-0 mt-1.5 rounded-xl overflow-hidden z-20" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
              <button onClick={() => { downloadCSV(toCSV(filtered, cardName, personName), `gastos-${currentMonthKey()}.csv`); setShowExportMenu(false); }}
                className="block w-full text-left px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: C.text }}>Planilha (CSV)</button>
              <button onClick={() => { exportBackup(); setShowExportMenu(false); }}
                className="block w-full text-left px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>Backup (JSON)</button>
            </div>
          )}
        </div>
      </div>

      {searching ? (
        <>
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
            ) : selectMode ? (
              filtered.map((exp) => (
                <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} personName={personName(exp.profile_id)} creatorName={exp.created_by ? personName(exp.created_by) : ""} showPerson={isAdmin}
                  onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete}
                  selectable selected={selected.includes(exp.id)} onToggleSelect={toggleSelect} />
              ))
            ) : (
              buildDisplayRows(filtered, data.expenses).map((row) =>
                row.isGroup ? (
                  <GroupedExpenseRow key={row.groupId} parts={row.parts} cardName={cardName(row.primary.card_id)} personName={personName} viewerProfileId={profile.id} showPerson={isAdmin}
                    onEdit={(e) => { setEditing(e); setShowForm(true); }} onDeleteGroup={handleDeleteGroup} />
                ) : (
                  <ExpenseRow key={row.exp.id} exp={row.exp} cardName={cardName(row.exp.card_id)} personName={personName(row.exp.profile_id)} creatorName={row.exp.created_by ? personName(row.exp.created_by) : ""} showPerson={isAdmin}
                    onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} onToggleReconciled={handleToggleReconciled} />
                )
              )
            )}
          </Panel>
        </>
      ) : (
        invoiceMonthsList.length === 0 ? (
          <Panel><EmptyState icon={<CreditCard size={28} />} text="Nada por aqui ainda." /></Panel>
        ) : (
          <>
            <div className="flex gap-1.5 mb-3 items-center">
              <div ref={carouselRef} onMouseDown={onCarouselMouseDown} onMouseMove={onCarouselMouseMove} onMouseUp={stopDrag} onMouseLeave={stopDrag}
                className="flex gap-1.5 overflow-x-auto flex-1 pb-1 select-none" style={{ scrollbarWidth: "none", cursor: "grab", WebkitOverflowScrolling: "touch" }}>
                {invoiceMonthsList.map((mk) => {
                  const active = mk === selectedMonth;
                  const status = invoiceSingleCard ? invoiceStatusInfo(invoiceSingleCard, mk) : null;
                  const tone = status?.tone === "green" ? C.green : status?.tone === "amber" ? C.amber : C.muted;
                  return (
                    <button key={mk} ref={(el) => { monthRefs.current[mk] = el; }} onClick={() => setSelectedMonth(mk)} className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium transition-all capitalize"
                      style={{ background: active ? C.gold : "transparent", color: active ? "var(--gold-contrast)" : tone, border: `1px solid ${active ? C.gold : C.border}` }}>
                      {monthLabel(mk)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl p-6 mb-4 relative overflow-hidden" style={{ background: HERO_GRADIENT, boxShadow: "0 14px 34px rgba(0,0,0,0.35)" }}>
              <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] opacity-80" style={{ color: "var(--gold-contrast)" }}>Fatura de {monthLabel(selectedMonth)}</div>
                  <div className="text-2xl sm:text-3xl font-bold mt-1" style={{ color: "var(--gold-contrast)", fontFamily: "'IBM Plex Mono', monospace" }}>{brl(invoiceTotal)}</div>
                </div>
                {paymentStatus && (
                  <span className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold" style={{
                    background: paymentStatus.tone === "gold" ? "rgba(255,255,255,0.9)" : paymentStatus.tone === "green" ? "#2F7A5C" : paymentStatus.tone === "rose" ? "#C0504D" : paymentStatus.tone === "amber" ? "#CBA05A" : "rgba(255,255,255,0.15)",
                    color: paymentStatus.tone === "gold" ? "#1A1607" : "#fff",
                  }}>
                    {paymentStatus.label}
                  </span>
                )}
              </div>
              {displayCard && (
                <p className="relative text-xs mt-2" style={{ color: "var(--gold-contrast)", opacity: 0.85 }}>
                  {invoiceStatus.label === "aberta" ? "Fecha" : invoiceStatus.label === "futura" ? "Fecha" : "Fechou"} dia {displayCard.closing_day} · vence dia {displayCard.due_day}
                  {invoiceSingleCard && invoicePaidTotal > 0 && ` · ${brl(invoicePaidTotal)} pago${invoicePaidTotal < invoiceTotal ? ` de ${brl(invoiceTotal)}` : ""}`}
                </p>
              )}
              {isAdmin && (
                <div className="relative flex justify-end mt-4">
                  <button onClick={() => (invoiceSingleCard ? setShowPayModal(true) : setShowPayPicker(true))}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-5 text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.14)", color: "var(--gold-contrast)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <DollarSign size={15} /> Pagar fatura
                  </button>
                </div>
              )}
            </div>

            {showPayPicker && (
              <ChoosePayCardModal cards={invoiceCards.length ? invoiceCards : myCards} monthKey={selectedMonth} expenses={invoiceScopedExpenses} payments={data.invoicePayments}
                onChoose={(c) => { setFilterCard(c.id); setShowPayPicker(false); setShowPayModal(true); }} onClose={() => setShowPayPicker(false)} />
            )}
            {showPayModal && invoiceSingleCard && (
              <PayInvoiceModal card={invoiceSingleCard} monthKey={selectedMonth} invoiceTotal={invoiceTotal} alreadyPaid={invoicePaidTotal}
                onConfirm={handlePayInvoice} onClose={() => setShowPayModal(false)} />
            )}
            {invoiceLineItems.length > 0 && invoiceSingleCard && (
              <p className="text-[11px] mb-2 -mt-2" style={{ color: C.muted }}>
                {invoiceLineItems.filter((e) => e.reconciled).length} de {invoiceLineItems.length} conferidos com o extrato
              </p>
            )}

            <Panel>
              {invoiceLineItems.length === 0 ? (
                <EmptyState icon={<ListChecks size={28} />} text="Nenhum gasto nesta fatura." />
              ) : (
                buildDisplayRows(invoiceLineItems, data.expenses).map((row) =>
                  row.isGroup ? (
                    <GroupedExpenseRow key={row.groupId} parts={row.parts} cardName={cardName(row.primary.card_id)} personName={personName} viewerProfileId={profile.id} showPerson={isAdmin}
                      onEdit={(e) => { setEditing(e); setShowForm(true); }} onDeleteGroup={handleDeleteGroup} />
                  ) : (
                    <ExpenseRow key={row.exp.id} exp={row.exp} cardName={cardName(row.exp.card_id)} personName={personName(row.exp.profile_id)} creatorName={row.exp.created_by ? personName(row.exp.created_by) : ""} showPerson={isAdmin} contextMonth={selectedMonth}
                      onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} onToggleReconciled={handleToggleReconciled} />
                  )
                )
              )}
            </Panel>
          </>
        )
      )}
        </>
      )}

      {showForm && (
        <ExpenseForm cards={myCards} userId={editing?.profile_id || profile.id} initial={editing}
          onSave={handleSave} onClose={() => setShowForm(false)}
          allProfiles={data.profiles} creatorId={profile.id} canRefund={isAdmin} expenses={data.expenses}
          customCategories={data.customCategories} onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }}
          onImportCSV={myCards.length > 0 ? () => { setShowForm(false); setShowImportCSV(true); } : null} />
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
  grad.addColorStop(0, "#C9A24C"); grad.addColorStop(1, "#3D2811");
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

function MonthlyReviewBanner({ onOpen }) {
  const now = currentMonthKey();
  const dismissKey = `recurring-review-dismissed-${now}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  const today = new Date().getDate();
  if (dismissed || today > 5) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl p-4 mb-4" style={{ background: "rgba(203,160,90,0.10)", border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Repeat size={16} color={C.gold} className="shrink-0" />
        <span className="text-xs" style={{ color: C.text }}>Novo mês! Já conferiu suas recorrências?</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={onOpen} className="text-xs font-medium" style={{ color: C.gold }}>Revisar</button>
        <button onClick={() => { try { localStorage.setItem(dismissKey, "1"); } catch {} setDismissed(true); }}><X size={14} color={C.muted} /></button>
      </div>
    </div>
  );
}

function RecurringReviewModal({ profile, data, isAdmin, refresh, onClose }) {
  const scopeIds = isAdmin ? data.profiles.map((p) => p.id) : [profile.id];
  const personName = (id) => firstName(data.profiles.find((p) => p.id === id)?.name) || "-";
  const cardName = (id) => (id ? (data.cards.find((c) => c.id === id)?.name || "-") : "Dinheiro/Pix");
  const recurringExpenses = data.expenses.filter((e) => e.is_recurring && scopeIds.includes(e.profile_id));
  const recurringIncomes = (data.incomes || []).filter((i) => i.is_recurring && scopeIds.includes(i.profile_id));

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Cancelar a recorrência "${exp.description}"? Isso remove o lançamento.`)) return;
    await deleteExpense(exp);
    await logActivity(profile.id, "excluiu", `Cancelou a recorrência "${exp.description}"`);
    await refresh();
  };
  const handleDeleteIncome = async (inc) => {
    if (!window.confirm(`Cancelar a receita recorrente "${inc.description}"?`)) return;
    await deleteIncome(inc);
    await refresh();
  };

  return (
    <Modal title="Revisar recorrências" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>Confira se essas assinaturas e recorrências ainda fazem sentido esse mês.</p>
      {recurringExpenses.length === 0 && recurringIncomes.length === 0 ? (
        <EmptyState icon={<Repeat size={28} />} text="Nenhuma recorrência cadastrada." />
      ) : (
        <div className="space-y-1 mb-4">
          {recurringExpenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="truncate" style={{ color: C.text }}>{e.description}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{cardName(e.card_id)}{isAdmin ? ` · ${personName(e.profile_id)}` : ""}</div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Amount value={monthlyValue(e)} size="text-xs" tone="rose" />
                <button onClick={() => handleDeleteExpense(e)}><Trash2 size={14} color={C.rose} /></button>
              </div>
            </div>
          ))}
          {recurringIncomes.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-sm py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <div className="truncate" style={{ color: C.text }}>{i.description}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>receita{isAdmin ? ` · ${personName(i.profile_id)}` : ""}</div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Amount value={i.amount} size="text-xs" tone="green" />
                <button onClick={() => handleDeleteIncome(i)}><Trash2 size={14} color={C.rose} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Btn full onClick={onClose}>Tudo certo, continuar</Btn>
    </Modal>
  );
}

function MemberOverview({ profile, data, refresh }) {
  const myCards = accessibleCards(data, profile.id);
  const now = openInvoiceMonth(myCards);
  const [showRecurringReview, setShowRecurringReview] = useState(false);
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
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16">
      <div className="flex items-center justify-between">
        <ScreenHeader title={`Olá, ${profile.name.split(" ")[0]}`} subtitle={`Fatura de ${monthLabel(now)}`} />
        <button onClick={handleShare} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-4" style={{ border: `1px solid ${C.border}` }}>
          <Share2 size={15} color={C.gold} />
        </button>
      </div>
      <MonthlyReviewBanner onOpen={() => setShowRecurringReview(true)} />
      <HeroPanel label="Total do mês" value={myMonthTotal} />
      <IncomeSection profile={profile} data={data} refresh={refresh} />
      <UpcomingBillsPanel cards={myCards} expenses={data.expenses} />

      {myCards.length > 0 ? (
        <div className={`grid grid-cols-1 ${myCards.length > 1 ? "sm:grid-cols-2" : ""} gap-3`}>
          {myCards.map((c) => {
            const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
            return <CardWidget key={c.id} card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />;
          })}
        </div>
      ) : (
        <Panel><EmptyState icon={<CreditCard size={28} />} text="Você ainda não tem acesso a nenhum cartão." /></Panel>
      )}
      {showRecurringReview && <RecurringReviewModal profile={profile} data={data} isAdmin={false} refresh={refresh} onClose={() => setShowRecurringReview(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN: OVERVIEW ---------------------------------- */

function AdminOverview({ profile, data, refresh }) {
  const now = openInvoiceMonth(data.cards);
  const prevMonth = addMonthsToKey(now, -1);
  const [scopeIds, setScopeIds] = useState([]);
  const [showRecurringReview, setShowRecurringReview] = useState(false);
  const scopeActive = scopeIds.length > 0;
  const scopedExpenses = data.expenses.filter((e) => isDueIn(e, now) && (!scopeActive || scopeIds.includes(e.profile_id)));
  const totalMonth = scopedExpenses.reduce((s, e) => s + monthlyValue(e), 0);
  const byPerson = data.profiles.map((u) => ({
    ...u,
    total: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0),
    prevTotal: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, prevMonth)).reduce((s, e) => s + monthlyValue(e), 0),
  }));
  const adminIncomeMonth = (data.incomes || []).filter((i) => i.profile_id === profile.id && isIncomeDueIn(i, now)).reduce((s, i) => s + incomeMonthlyValue(i), 0);
  const adminExpenseMonth = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const scopedIncome = (data.incomes || []).filter((i) => isIncomeDueIn(i, now) && (!scopeActive || scopeIds.includes(i.profile_id))).reduce((s, i) => s + incomeMonthlyValue(i), 0);
  const scopedSaldo = scopedIncome - totalMonth;

  const toggleScope = (id) => setScopeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const buildHeading = (ids) => {
    if (ids.length === 0) return "Resumo geral";
    const names = data.profiles.filter((p) => ids.includes(p.id)).map((p) => firstName(p.name));
    if (ids.length === 1) return ids[0] === profile.id ? `Olá, ${names[0]}` : `Resumo de ${names[0]}`;
    return `Resumo de ${names.join(" e ")}`;
  };
  const handleShare = () => {
    const categories = allCategoryNames(scopedExpenses)
      .map((cat) => ({ name: cat, value: scopedExpenses.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0), color: getCategoryColor(cat) }))
      .filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    shareSummaryImage({ heading: buildHeading(scopeIds), monthLabelStr: monthLabel(now), total: totalMonth, saldo: scopedSaldo, categories });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16">
      <div className="flex items-center justify-between">
        <ScreenHeader title="Visão geral" subtitle={`Fatura de ${monthLabel(now)}`} />
        <button onClick={handleShare} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-4" style={{ border: `1px solid ${C.border}` }}>
          <Share2 size={15} color={C.gold} />
        </button>
      </div>
      <div className="space-y-4">
        <MonthlyReviewBanner onOpen={() => setShowRecurringReview(true)} />
        <HeroPanel label={scopeActive ? buildHeading(scopeIds) : "Total do mês"} value={totalMonth} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {byPerson.map((p) => {
            const active = scopeIds.includes(p.id);
            const delta = p.prevTotal > 0 ? ((p.total - p.prevTotal) / p.prevTotal) * 100 : null;
            const familyTotal = byPerson.reduce((s, x) => s + x.total, 0);
            const pctShare = familyTotal > 0 ? (p.total / familyTotal) * 100 : 0;
            return (
              <button key={p.id} onClick={() => toggleScope(p.id)} className="text-left rounded-2xl p-5 transition-all" style={{ background: C.surface, border: `1px solid ${active ? C.gold : C.border}`, boxShadow: C.shadow }}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <Avatar profile={p} size={28} />
                  <span className="text-[11px]" style={{ color: active ? C.gold : C.muted }}>{firstName(p.name)}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <Amount value={p.total} size="text-lg" />
                  {familyTotal > 0 && <span className="text-[11px]" style={{ color: C.muted }}>({pctShare.toFixed(0)}%)</span>}
                </div>
                {delta != null && (
                  <div className="flex items-center gap-1 text-[11px] mt-1.5" style={{ color: delta > 0 ? C.rose : C.green }}>
                    {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(delta).toFixed(0)}% vs mês passado
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <IncomeSection profile={profile} data={data} refresh={refresh} scopeIds={scopeIds} scopeLabel={scopeActive ? `saldo · ${buildHeading(scopeIds)}` : undefined} />
        <UpcomingBillsPanel cards={data.cards} expenses={data.expenses} />
        <h4 className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: C.muted }}>Cartões</h4>
        <div className={`grid grid-cols-1 ${data.cards.length > 1 ? "sm:grid-cols-2" : ""} gap-3`}>
          {data.cards.map((c) => {
            const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
            return <CardWidget key={c.id} card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />;
          })}
          {data.cards.length === 0 && <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão cadastrado ainda." /></Panel>}
        </div>
      </div>
      {showRecurringReview && <RecurringReviewModal profile={profile} data={data} isAdmin refresh={refresh} onClose={() => setShowRecurringReview(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN: CARDS ---------------------------------- */

function AdminCards({ data, refresh, embedded }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const now = openInvoiceMonth(data.cards);

  const handleSave = async (card) => { await saveCard(card); await refresh(); };
  const handleDelete = async (card) => { if (!window.confirm(`Excluir o cartão "${card.name}"? Isso também remove os gastos lançados nele.`)) return; await deleteCard(card); await refresh(); };

  const totalLimit = data.cards.reduce((s, c) => s + c.card_limit, 0);
  const totalAvailable = data.cards.reduce((s, c) => {
    const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
    return s + Math.max(c.card_limit - used, 0);
  }, 0);

  return (
    <div className={embedded ? "" : "max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16"}>
      {!embedded && <ScreenHeader title="Cartões" subtitle="Limites, vencimentos e acessos" />}
      {data.cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Panel><span className="text-[11px]" style={{ color: C.muted }}>limite total</span><div className="mt-1"><Amount value={totalLimit} size="text-lg" /></div></Panel>
          <Panel><span className="text-[11px]" style={{ color: C.muted }}>disponível total</span><div className="mt-1"><Amount value={totalAvailable} size="text-lg" tone="green" /></div></Panel>
        </div>
      )}
      <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Novo cartão</Btn>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.cards.length === 0 && <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão cadastrado ainda." /></Panel>}
        {data.cards.map((c) => {
          const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
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
  const fallback = ["#5C86A8", "#C7A24C", "#8C6FA8", "#4F9B93"];
  return fallback[fallbackIndex % fallback.length];
}
function monthKeysForPeriod(period, customRange, cards) {
  const now = openInvoiceMonth(cards);
  if (period === "last_month") return [addMonthsToKey(now, -1)];
  const map = { "3m": 3, "6m": 6 };
  if (map[period]) return Array.from({ length: map[period] }, (_, i) => addMonthsToKey(now, -i));
  if (period === "year") {
    const [, m] = now.split("-").map(Number);
    return Array.from({ length: m }, (_, i) => addMonthsToKey(now, -i));
  }
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
        style={{ background: allSelected ? C.gold : "transparent", color: allSelected ? "var(--gold-contrast)" : C.muted, border: `1px solid ${allSelected ? C.gold : C.border}` }}>
        Todos
      </button>
      {profiles.map((p) => {
        const active = selectedIds.includes(p.id);
        return (
          <button key={p.id} onClick={() => toggle(p.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: active ? C.gold : "transparent", color: active ? "var(--gold-contrast)" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
            {firstName(p.name)}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------- ADMIN: REPORTS ---------------------------------- */

function ReportTabs({ view, setView, isAdmin }) {
  const items = [
    { id: "charts", label: "Gráficos", icon: <PieIcon size={15} /> },
    { id: "goals", label: "Metas", icon: <Target size={15} /> },
    ...(isAdmin ? [{ id: "activity", label: "Atividade", icon: <History size={15} /> }] : []),
  ];
  return (
    <div className="flex gap-2 mb-4">
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button key={it.id} onClick={() => setView(it.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: active ? C.gold : C.surface, color: active ? "var(--gold-contrast)" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
            {it.icon} {it.label}
          </button>
        );
      })}
    </div>
  );
}

function ActivityLogScreen({ data, embedded }) {
  const personName = (id) => firstName((data.profiles || []).find((p) => p.id === id)?.name) || "-";
  const personProfile = (id) => (data.profiles || []).find((p) => p.id === id);
  const log = data.activityLog || [];
  return (
    <div className={embedded ? "" : "max-w-3xl mx-auto px-4 py-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16"}>
      <Panel>
        {log.length === 0 ? (
          <EmptyState icon={<History size={28} />} text="Nenhuma atividade registrada ainda." />
        ) : (
          <div className="space-y-3.5">
            {log.map((a) => (
              <div key={a.id} className="flex items-start gap-3 pb-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                <Avatar profile={personProfile(a.profile_id)} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm" style={{ color: C.text }}>{a.description}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {personName(a.profile_id)} · {formatShortDate(a.created_at.slice(0, 10))} às {a.created_at.slice(11, 16)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReportsScreen({ profile, data, refresh, isAdmin }) {
  const relevantCards = isAdmin ? data.cards : accessibleCards(data, profile.id);
  const now = openInvoiceMonth(relevantCards);
  const prevMonth = addMonthsToKey(now, -1);
  const [view, setView] = useState("charts");
  const [period, setPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [compareMonth, setCompareMonth] = useState(prevMonth);
  const [summaryYear, setSummaryYear] = useState(parseInt(now.split("-")[0]));
  const [compareMonths, setCompareMonths] = useState([]);

  const scopeProfiles = isAdmin
    ? (selectedIds.length === 0 ? data.profiles : data.profiles.filter((p) => selectedIds.includes(p.id)))
    : data.profiles.filter((p) => p.id === profile.id);
  const scopeIds = scopeProfiles.map((p) => p.id);

  const monthKeys = monthKeysForPeriod(period, customRange, relevantCards);
  const byCategory = categoryTotalsForMonths(data.expenses, monthKeys, scopeIds);
  const totalPeriod = byCategory.reduce((s, d) => s + d.value, 0);
  const comparison = categoryComparison(data.expenses, now, compareMonth, scopeIds);
  const compareOptions = Array.from({ length: 12 }, (_, i) => addMonthsToKey(now, -(i + 1)));

  const months = last6Months();
  const last12Months = Array.from({ length: 12 }, (_, i) => addMonthsToKey(now, -i));
  const toggleCompareMonth = (mk) => setCompareMonths((prev) => {
    if (prev.includes(mk)) return prev.filter((x) => x !== mk);
    if (prev.length >= 3) return prev;
    return [...prev, mk].sort();
  });
  const compareCategoryRows = (() => {
    if (compareMonths.length < 2) return [];
    const scoped = data.expenses.filter((e) => scopeIds.includes(e.profile_id));
    const cats = new Set();
    compareMonths.forEach((mk) => allCategoryNames(scoped.filter((e) => isDueIn(e, mk))).forEach((c) => cats.add(c)));
    return Array.from(cats).map((cat) => ({
      cat,
      values: compareMonths.map((mk) => scoped.filter((e) => e.category === cat && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0)),
    })).filter((r) => r.values.some((v) => v > 0));
  })();
  const evolution = months.map((mk) => {
    const row = { month: monthLabel(mk) };
    scopeProfiles.forEach((u) => { row[firstName(u.name)] = data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return row;
  });

  const scopeInvestments = (data.investments || []).filter((inv) => scopeIds.includes(inv.created_by) || scopeIds.some((id) => inv.memberIds.includes(id)));
  const wealthEvolution = months.map((mk) => {
    const total = scopeInvestments.reduce((s, inv) => s + investmentBalanceUpTo(inv.id, data.investmentTransactions || [], mk), 0);
    return { month: monthLabel(mk), total };
  });
  const hasInvestments = scopeInvestments.length > 0;

  const yearMonthKeys = (y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  const yearTotals = (y) => {
    const mks = yearMonthKeys(y);
    const expense = mks.reduce((s, mk) => s + scopeIds.reduce((s2, pid) => s2 + data.expenses.filter((e) => e.profile_id === pid && isDueIn(e, mk)).reduce((s3, e) => s3 + monthlyValue(e), 0), 0), 0);
    const income = mks.reduce((s, mk) => s + scopeIds.reduce((s2, pid) => s2 + (data.incomes || []).filter((i) => i.profile_id === pid && isIncomeDueIn(i, mk)).reduce((s3, i) => s3 + incomeMonthlyValue(i), 0), 0), 0);
    return { expense, income, saldo: income - expense };
  };
  const currentYearTotals = yearTotals(summaryYear);
  const prevYearTotals = yearTotals(summaryYear - 1);
  const yearPctDiff = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : null);

  const heroLabel = period === "month" ? `Total de ${monthLabel(now)}` : `Total (${periodPresetLabel(period)})`;
  const scopeLabel = !isAdmin ? "Seu relatório" : selectedIds.length === 0 ? "Todos" : scopeProfiles.map((p) => firstName(p.name)).join(" e ");

  if (view === "goals") {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-5 lg:max-w-6xl lg:px-10 lg:pt-8">
        <ScreenHeader title="Relatórios" subtitle={isAdmin ? "Panorama financeiro" : "Seu panorama financeiro"} />
        <ReportTabs view={view} setView={setView} isAdmin={isAdmin} />
        <GoalsScreen profile={profile} data={data} refresh={refresh} embedded />
      </div>
    );
  }

  if (view === "activity" && isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-28 lg:max-w-6xl lg:px-10 lg:pt-8">
        <ScreenHeader title="Relatórios" subtitle={isAdmin ? "Panorama financeiro" : "Seu panorama financeiro"} />
        <ReportTabs view={view} setView={setView} isAdmin={isAdmin} />
        <ActivityLogScreen data={data} embedded />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-4 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-16">
      <div className="flex items-center justify-between">
        <ScreenHeader title="Relatórios" subtitle={isAdmin ? `Panorama financeiro · ${scopeLabel}` : "Seu panorama financeiro"} />
        <button onClick={() => window.print()} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-4" style={{ border: `1px solid ${C.border}` }} title="Exportar PDF">
          <Download size={15} color={C.gold} />
        </button>
      </div>
      <div id="printable-report" style={{ color: "#111", background: "#fff" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Relatório financeiro</h1>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>{scopeLabel} · {heroLabel}</p>
        <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>{brl(totalPeriod)}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th style={{ padding: "6px 4px" }}>Categoria</th>
              <th style={{ padding: "6px 4px", textAlign: "right" }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((d) => (
              <tr key={d.name} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 4px" }}>{d.name}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{brl(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginTop: 24, marginBottom: 8 }}>Resumo anual · {summaryYear}</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr><td style={{ padding: "4px" }}>Receita</td><td style={{ padding: "4px", textAlign: "right" }}>{brl(currentYearTotals.income)}</td></tr>
            <tr><td style={{ padding: "4px" }}>Despesa</td><td style={{ padding: "4px", textAlign: "right" }}>{brl(currentYearTotals.expense)}</td></tr>
            <tr><td style={{ padding: "4px", fontWeight: 700 }}>Saldo</td><td style={{ padding: "4px", textAlign: "right", fontWeight: 700 }}>{brl(currentYearTotals.saldo)}</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 10, color: "#999", marginTop: 24 }}>Gerado em {formatShortDate(new Date().toISOString().slice(0, 10))} pelo Controle Financeiro.</p>
      </div>
      <ReportTabs view={view} setView={setView} isAdmin={isAdmin} />
      <HeroPanel label={heroLabel} value={totalPeriod} />

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.profiles.map((p) => {
            const active = selectedIds.includes(p.id);
            const personTotal = categoryTotalsForMonths(data.expenses, monthKeys, [p.id]).reduce((s, d) => s + d.value, 0);
            return (
              <button key={p.id} onClick={() => setSelectedIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                className="text-left rounded-2xl p-4 transition-all" style={{ background: C.surface, border: `1px solid ${active ? C.gold : C.border}`, boxShadow: C.shadow }}>
                <span className="text-[11px]" style={{ color: active ? C.gold : C.muted }}>{firstName(p.name)}</span>
                <div className="mt-1"><Amount value={personTotal} size="text-lg" /></div>
              </button>
            );
          })}
        </div>
      )}

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
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium tracking-wide uppercase" style={{ color: C.muted }}>Resumo anual</h4>
          <div className="flex items-center gap-2">
            <button onClick={() => setSummaryYear((y) => y - 1)}><ChevronRight size={14} color={C.muted} style={{ transform: "rotate(180deg)" }} /></button>
            <span className="text-xs font-medium" style={{ color: C.text }}>{summaryYear}</span>
            <button onClick={() => setSummaryYear((y) => Math.min(y + 1, parseInt(now.split("-")[0])))}><ChevronRight size={14} color={C.muted} /></button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl px-3.5 py-3 flex items-center justify-between sm:block" style={{ background: C.bgSoft }}>
            <div className="text-[11px] sm:mb-1" style={{ color: C.muted }}>receita</div>
            <Amount value={currentYearTotals.income} size="text-base sm:text-sm" tone="green" />
          </div>
          <div className="rounded-xl px-3.5 py-3 flex items-center justify-between sm:block" style={{ background: C.bgSoft }}>
            <div className="text-[11px] sm:mb-1" style={{ color: C.muted }}>despesa</div>
            <Amount value={currentYearTotals.expense} size="text-base sm:text-sm" tone="rose" />
          </div>
          <div className="rounded-xl px-3.5 py-3 flex items-center justify-between sm:block" style={{ background: C.bgSoft }}>
            <div className="text-[11px] sm:mb-1" style={{ color: C.muted }}>saldo</div>
            <Amount value={currentYearTotals.saldo} size="text-base sm:text-sm" tone={currentYearTotals.saldo < 0 ? "rose" : "green"} />
          </div>
        </div>
        {prevYearTotals.expense + prevYearTotals.income > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px]" style={{ color: C.muted }}>
            {(() => {
              const dIncome = yearPctDiff(currentYearTotals.income, prevYearTotals.income);
              const dExpense = yearPctDiff(currentYearTotals.expense, prevYearTotals.expense);
              return (
                <>
                  {dIncome != null && <span>receita {dIncome >= 0 ? "▲" : "▼"} {Math.abs(dIncome).toFixed(0)}% vs {summaryYear - 1}</span>}
                  {dExpense != null && <span>despesa {dExpense >= 0 ? "▲" : "▼"} {Math.abs(dExpense).toFixed(0)}% vs {summaryYear - 1}</span>}
                </>
              );
            })()}
          </div>
        )}
      </Panel>

      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Por categoria</h4>
        {byCategory.length === 0 ? (
          <EmptyState icon={<PieIcon size={28} />} text="Sem dados neste período." />
        ) : (
          <div>
            <div className="relative" style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} cornerRadius={6}>
                    {byCategory.map((d, i) => <Cell key={i} fill={getCategoryColor(d.name)} stroke="none" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px]" style={{ color: C.muted }}>total</span>
                <span className="text-lg font-extrabold" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{brl(totalPeriod)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {byCategory.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(d.name) }} />
                    {d.name}
                  </div>
                  <Amount value={d.value} size="text-sm" />
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Evolução mensal</h4>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={evolution} barGap={4}>
            <XAxis dataKey="month" stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} />
            <YAxis stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={38} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10 }} labelStyle={{ color: C.text }} itemStyle={{ color: C.text }} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
            {scopeProfiles.map((u, i) => (
              <Bar key={u.id} dataKey={firstName(u.name)} radius={[6, 6, 0, 0]} fill={personColorFor(u.name, i)} maxBarSize={22}>
                <LabelList dataKey={firstName(u.name)} position="top" formatter={(v) => (v > 0 ? compactNumber(v) : "")} fontSize={9} fill={C.muted} />
              </Bar>
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

      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Comparar meses específicos</h4>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {last12Months.map((mk) => {
            const active = compareMonths.includes(mk);
            return (
              <button key={mk} onClick={() => toggleCompareMonth(mk)} className="flex-1 min-w-[68px] px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                style={{ background: active ? C.gold : C.bgSoft, color: active ? "var(--gold-contrast)" : C.muted, border: `1px solid ${active ? C.gold : C.border}` }}>
                {monthLabel(mk)}
              </button>
            );
          })}
        </div>
        {compareMonths.length < 2 ? (
          <p className="text-xs" style={{ color: C.muted }}>Escolha 2 ou 3 meses acima para comparar categoria por categoria.</p>
        ) : compareCategoryRows.length === 0 ? (
          <EmptyState icon={<PieIcon size={28} />} text="Sem gastos nos meses escolhidos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th className="text-left py-2 text-[11px] font-medium uppercase" style={{ color: C.muted }}>Categoria</th>
                  {compareMonths.map((mk) => (
                    <th key={mk} className="text-right py-2 text-[11px] font-medium capitalize" style={{ color: C.muted }}>{monthLabel(mk)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareCategoryRows.map((r) => (
                  <tr key={r.cat} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="py-2" style={{ color: C.text }}>{r.cat}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className="text-right py-2"><Amount value={v} size="text-xs" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {hasInvestments && (
        <Panel>
          <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Evolução do patrimônio investido</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={wealthEvolution}>
              <XAxis dataKey="month" stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} />
              <YAxis stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={38} />
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10 }} labelStyle={{ color: C.text }} itemStyle={{ color: C.text }} />
              <Line type="monotone" dataKey="total" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: C.green }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}
    </div>
  );
}

function FloatingAddButton({ onAddExpense, onAddIncome }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed z-40 flex flex-col items-end gap-2.5 lg:hidden" style={{ right: 18, bottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>
      {open && (
        <>
          <button onClick={() => { setOpen(false); onAddExpense(); }} className="flex items-center justify-between gap-3 pl-4 pr-1.5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{ width: 148, background: C.surfaceAlt, color: C.text, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
            Gasto <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.gold, color: "var(--gold-contrast)" }}><Plus size={16} /></span>
          </button>
          <button onClick={() => { setOpen(false); onAddIncome(); }} className="flex items-center justify-between gap-3 pl-4 pr-1.5 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
            style={{ width: 148, background: C.surfaceAlt, color: C.text, border: `1px solid ${C.borderStrong}`, boxShadow: C.shadow }}>
            Receita <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}><Plus size={16} /></span>
          </button>
        </>
      )}
      <button onClick={() => setOpen((v) => !v)} className="rounded-full flex items-center justify-center transition-all active:scale-95"
        style={{ width: 54, height: 54, background: HERO_GRADIENT, boxShadow: "0 10px 24px rgba(0,0,0,0.4)", transform: open ? "rotate(45deg)" : "none" }}>
        <Zap size={22} color="#fff" style={{ display: open ? "none" : "block" }} />
        <Plus size={24} color="#fff" style={{ display: open ? "block" : "none" }} />
      </button>
      {open && <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />}
    </div>
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
function useBillAlerts(cards, expenses, payments) {
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
function useBudgetAlerts(profile, data) {
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

function Sidebar({ profile, tabs, tab, setTab, theme, onToggleTheme, onLogout, data, refresh, showSearch, setShowSearch, onAddExpense, onAddIncome }) {
  const [uploading, setUploading] = useState(false);
  const handleAvatarUpload = async (file) => {
    setUploading(true);
    try {
      const url = await uploadAvatar(file, profile.id);
      await saveProfileAvatar(profile.id, url);
      await refresh();
    } catch (e) {
      alert("Não foi possível salvar a foto: " + friendlyError(e));
    } finally { setUploading(false); }
  };
  return (
    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen px-4 py-6"
      style={{ background: "var(--bg-soft)", borderRight: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`, color: "var(--gold-contrast)" }}>
          <Wallet size={17} />
        </div>
        <span className="font-bold text-[13px] leading-tight flex-1" style={{ fontFamily: "'Manrope', sans-serif", color: C.text }}>Controle<br />Financeiro</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={onAddExpense} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: C.gold, color: "var(--gold-contrast)" }}>
          <Plus size={15} /> Gasto
        </button>
        <button onClick={onAddIncome} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}` }}>
          <Plus size={15} /> Receita
        </button>
      </div>

      <button onClick={() => setShowSearch(true)} className="flex items-center justify-between gap-2.5 px-3 py-2.5 mb-3 rounded-xl text-sm" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.muted }}>
        <span className="flex items-center gap-2.5"><Search size={15} /> Buscar em tudo...</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ border: `1px solid ${C.border}` }}>/</span>
      </button>
      {showSearch && <GlobalSearchModal profile={profile} data={data} onClose={() => setShowSearch(false)} />}

      <nav className="flex flex-col gap-1 flex-1">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left relative">
              <span style={{ color: active ? C.gold : C.muted }}>{t.icon}</span>
              <span style={{ color: active ? C.text : C.muted }}>{t.fullLabel || t.label}</span>
              {t.badge && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: C.rose }} />}
              {active && <span className="absolute inset-0 rounded-xl -z-10" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} />}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <Avatar profile={profile} size={32} editable onUpload={handleAvatarUpload} uploading={uploading} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{firstName(profile.name)}</div>
          {profile.role === "admin" && <div className="text-[10.5px]" style={{ color: C.muted }}>admin</div>}
        </div>
        <button onClick={onLogout} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all" style={{ border: `1px solid ${C.border}` }} title="Sair">
          <LogOut size={13} color={C.muted} />
        </button>
      </div>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-1 text-[10px]" style={{ color: C.muted }}>
        <span><b style={{ color: C.text }}>N</b> gasto</span>
        <span><b style={{ color: C.text }}>R</b> receita</span>
        <span><b style={{ color: C.text }}>/</b> buscar</span>
      </div>
    </div>
  );
}

function useKeyboardShortcuts({ onNewExpense, onNewIncome, onSearch }) {
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); onNewExpense(); }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); onNewIncome(); }
      else if (e.key === "/") { e.preventDefault(); onSearch(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewExpense, onNewIncome, onSearch]);
}

function MemberApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = usePersistentTab("tab-member", "overview");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickIncome, setShowQuickIncome] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const myCards = accessibleCards(data, profile.id);
  useBillAlerts(myCards, data.expenses, data.invoicePayments);
  useBudgetAlerts(profile, data);
  useKeyboardShortcuts({
    onNewExpense: () => setShowQuickAdd(true),
    onNewIncome: () => setShowQuickIncome(true),
    onSearch: () => setShowSearch(true),
  });
  const tabs = [
    { id: "overview", label: "Início", icon: <LayoutGrid size={18} /> },
    { id: "history", label: "Faturas", icon: <ListChecks size={18} />, badge: anyCardAlert(myCards, data.expenses, data.invoicePayments) },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={18} /> },
    { id: "investments", label: "Invest.", fullLabel: "Investimentos", icon: <PiggyBank size={18} /> },
  ];
  const handleQuickSave = async (expArr) => {
    const arr = Array.isArray(expArr) ? expArr : [expArr];
    for (const e of arr) await saveExpense(e);
    await refresh();
    await logActivity(profile.id, "criou", `Lançou o gasto "${arr[0]?.description || "gasto"}"`);
  };
  const handleQuickIncomeSave = async (inc) => { await saveIncome(inc); await refresh(); };
  return (
    <div className="lg:flex lg:items-start">
      <Sidebar profile={profile} tabs={tabs} tab={tab} setTab={setTab} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} data={data} refresh={refresh} showSearch={showSearch} setShowSearch={setShowSearch} onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
      <div className="lg:flex-1 lg:min-w-0">
        <div className="lg:hidden"><TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} data={data} refresh={refresh} showSearch={showSearch} setShowSearch={setShowSearch} /></div>
        {tab === "overview" && <MemberOverview profile={profile} data={data} refresh={refresh} />}
        {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
        {tab === "reports" && <ReportsScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
        {tab === "investments" && <InvestmentsScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
        <FloatingAddButton onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
        {showQuickAdd && <ExpenseForm cards={myCards} userId={profile.id} onSave={handleQuickSave} onClose={() => setShowQuickAdd(false)} allProfiles={data.profiles} creatorId={profile.id} expenses={data.expenses}
          customCategories={data.customCategories} onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }} />}
        {showQuickIncome && <IncomeForm profileId={profile.id} onSave={handleQuickIncomeSave} onClose={() => setShowQuickIncome(false)} />}
        <div className="lg:hidden"><BottomNav tabs={tabs} tab={tab} setTab={setTab} /></div>
      </div>
    </div>
  );
}

function AdminApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = usePersistentTab("tab-admin", "overview");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickIncome, setShowQuickIncome] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  useBillAlerts(data.cards, data.expenses, data.invoicePayments);
  useBudgetAlerts(profile, data);
  useKeyboardShortcuts({
    onNewExpense: () => setShowQuickAdd(true),
    onNewIncome: () => setShowQuickIncome(true),
    onSearch: () => setShowSearch(true),
  });
  const tabs = [
    { id: "overview", label: "Início", icon: <LayoutGrid size={18} /> },
    { id: "history", label: "Faturas", icon: <ListChecks size={18} />, badge: anyCardAlert(data.cards, data.expenses, data.invoicePayments) },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={18} /> },
    { id: "investments", label: "Invest.", fullLabel: "Investimentos", icon: <PiggyBank size={18} /> },
  ];
  const handleQuickSave = async (expArr) => {
    const arr = Array.isArray(expArr) ? expArr : [expArr];
    for (const e of arr) await saveExpense(e);
    await refresh();
    await logActivity(profile.id, "criou", `Lançou o gasto "${arr[0]?.description || "gasto"}"`);
  };
  const handleQuickIncomeSave = async (inc) => { await saveIncome(inc); await refresh(); };
  return (
    <div className="lg:flex lg:items-start">
      <Sidebar profile={profile} tabs={tabs} tab={tab} setTab={setTab} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} data={data} refresh={refresh} showSearch={showSearch} setShowSearch={setShowSearch} onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
      <div className="lg:flex-1 lg:min-w-0">
        <div className="lg:hidden"><TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} data={data} refresh={refresh} showSearch={showSearch} setShowSearch={setShowSearch} /></div>
        {tab === "overview" && <AdminOverview profile={profile} data={data} refresh={refresh} />}
        {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin />}
        {tab === "reports" && <ReportsScreen profile={profile} data={data} refresh={refresh} isAdmin />}
        {tab === "investments" && <InvestmentsScreen profile={profile} data={data} refresh={refresh} isAdmin />}
        <FloatingAddButton onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
        {showQuickAdd && <ExpenseForm cards={data.cards} userId={profile.id} onSave={handleQuickSave} onClose={() => setShowQuickAdd(false)} allProfiles={data.profiles} creatorId={profile.id} canRefund expenses={data.expenses}
          customCategories={data.customCategories} onAddCategory={async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }} />}
        {showQuickIncome && <IncomeForm profileId={profile.id} onSave={handleQuickIncomeSave} onClose={() => setShowQuickIncome(false)} />}
        <div className="lg:hidden"><BottomNav tabs={tabs} tab={tab} setTab={setTab} /></div>
      </div>
    </div>
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
    try {
      const d = await loadAll();
      setData(d);
      setProfile((prev) => (prev ? d.profiles.find((p) => p.id === prev.id) || prev : prev));
    } catch { setError("Não foi possível carregar os dados."); }
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
  if (!authUser) return <Login onLogin={(u) => { try { localStorage.setItem("tab-member", "overview"); localStorage.setItem("tab-admin", "overview"); } catch {} setAuthUser(u); }} theme={theme} onToggleTheme={toggleTheme} />;
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
