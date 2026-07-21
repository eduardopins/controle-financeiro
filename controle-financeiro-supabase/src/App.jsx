import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CreditCard, Plus, Pencil, Trash2, LogOut, LayoutGrid, Wallet, PieChart as PieIcon,
  ListChecks, X, Check, Lock, ChevronRight, Download, AlertTriangle,
  Repeat, Target, Clock, Sun, Moon,
} from "lucide-react";

/* ---------------------------------- tokens ---------------------------------- */

const C = {
  bg: "var(--bg)", bgSoft: "var(--bg-soft)", surface: "var(--surface)", surfaceAlt: "var(--surface-alt)",
  border: "var(--border)", borderStrong: "var(--border-strong)",
  gold: "var(--gold)", goldSoft: "var(--gold-soft)", text: "var(--text)", muted: "var(--muted)",
  green: "var(--green)", rose: "var(--rose)", amber: "var(--amber)", shadow: "var(--shadow)",
};

const THEME_CSS = `
body { font-family: 'Inter', sans-serif; }
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
  "Alimentação": "#E4C77E", "Moradia": "#7FA8C9", "Transporte": "#8FB89C",
  "Lazer": "#C98F9E", "Saúde": "#D08A5B", "Compras": "#A98FC9",
  "Educação": "#6FBFB0", "Outros": "#9AA1C4",
};
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ---------------------------------- utils ---------------------------------- */

const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
};
function detectBank(name) {
  const n = (name || "").toLowerCase();
  for (const key of Object.keys(BANK_BRANDS)) {
    if (n.includes(key)) return BANK_BRANDS[key];
  }
  return null;
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

function HeroPanel({ label, value }) {
  return (
    <div className="rounded-3xl p-6 mb-4 relative overflow-hidden" style={{ background: HERO_GRADIENT, boxShadow: "0 14px 34px rgba(76,29,149,0.35)" }}>
      <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", left: -25, bottom: -55, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <span className="text-xs relative" style={{ color: "rgba(255,255,255,0.75)" }}>{label}</span>
      <div className="mt-1 relative">
        <span className="text-3xl font-extrabold" style={{ color: "#fff", fontFamily: "'Manrope', sans-serif", fontVariantNumeric: "tabular-nums" }}>{brl(value)}</span>
      </div>
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
  const colors = { rose: C.rose, amber: C.amber, muted: C.muted };
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
  const presets = ["month", "1m", "3m", "6m", "12m", "custom"];
  return (
    <div className="mb-3">
      <div className="flex gap-1.5 flex-wrap mb-2">
        {presets.map((p) => (
          <button key={p} onClick={() => onChange(p)}
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
              <div style={{ color: active ? C.gold : C.muted }}>{t.icon}</div>
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
  const [profiles, cards, cardAccess, expenses, budgets] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("card_access").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("budgets").select("*"),
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
    await supabase.from("cards").update(rest).eq("id", cardId);
  }
  await supabase.from("card_access").delete().eq("card_id", cardId);
  if (memberIds.length) {
    await supabase.from("card_access").insert(memberIds.map((profile_id) => ({ card_id: cardId, profile_id })));
  }
}
async function deleteCard(card) {
  await supabase.from("cards").delete().eq("id", card.id);
}
async function saveExpense(exp) {
  const isNew = !exp.id;
  const payload = {
    card_id: exp.cardId, profile_id: exp.userId, category: exp.category, description: exp.description,
    total_amount: exp.totalAmount, purchase_date: exp.date, first_month: exp.firstMonth,
    installments: exp.installments, is_recurring: exp.isRecurring,
  };
  if (isNew) await supabase.from("expenses").insert(payload);
  else await supabase.from("expenses").update(payload).eq("id", exp.id);
}
async function deleteExpense(exp) {
  await supabase.from("expenses").delete().eq("id", exp.id);
}
async function saveBudget(profileId, category, monthly_limit) {
  await supabase.from("budgets").upsert({ profile_id: profileId, category, monthly_limit }, { onConflict: "profile_id,category" });
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
    <div className="sticky top-0 z-30" style={{ background: "var(--bg)", borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} color={C.gold} />
          <span className="text-sm font-semibold tracking-wide" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{profile.name}</span>
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

/* ---------------------------------- EXPENSE FORM ---------------------------------- */

function ExpenseForm({ cards, userId, onSave, onClose, initial }) {
  const [cardId, setCardId] = useState(initial?.card_id || cards[0]?.id || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description || "");
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount ?? "");
  const [date, setDate] = useState(initial?.purchase_date || new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState(initial?.installments || 1);
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring || false);

  const submit = () => {
    if (!cardId || !description.trim() || !totalAmount) return;
    onSave({
      id: initial?.id, cardId, userId, category, description: description.trim(),
      totalAmount: parseFloat(totalAmount), date, firstMonth: monthKeyFromDate(date),
      installments: isRecurring ? 1 : Math.max(1, parseInt(installments) || 1),
      isRecurring,
    });
    onClose();
  };

  return (
    <Modal title={initial ? "Editar gasto" : "Novo gasto"} onClose={onClose}>
      <Field label="Cartão">
        <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Descrição"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Supermercado" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Valor (R$)"><TextInput type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0,00" /></Field>
      </div>
      <Field label="Data da compra"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

      <label className="flex items-center gap-2 text-sm mb-3.5" style={{ color: C.text }}>
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        <Repeat size={14} color={C.muted} /> Gasto recorrente (todo mês, ex: assinatura)
      </label>

      {!isRecurring && (
        <Field label="Parcelas"><TextInput type="number" min="1" max="48" value={installments} onChange={(e) => setInstallments(e.target.value)} /></Field>
      )}
      {!isRecurring && installments > 1 && totalAmount && (
        <p className="text-xs mb-3" style={{ color: C.muted }}>{installments}x de <b style={{ color: C.goldSoft }}>{brl(totalAmount / installments)}</b></p>
      )}
      <Btn full onClick={submit} disabled={!cardId}>Salvar gasto</Btn>
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
  const toggle = (id) => setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = () => {
    if (!name.trim() || !limit) return;
    onSave({ id: initial?.id, name: name.trim(), card_limit: parseFloat(limit), closing_day: parseInt(closingDay), due_day: parseInt(dueDay), memberIds });
    onClose();
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
      <Field label="Limite total (R$)"><TextInput type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia de fechamento"><TextInput type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} /></Field>
        <Field label="Dia de vencimento"><TextInput type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
      </div>
      <Field label="Quem tem acesso a este cartão">
        <div className="flex flex-col gap-2 mt-1">
          {allProfiles.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm" style={{ color: C.text }}>
              <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
              {u.name}
            </label>
          ))}
        </div>
      </Field>
      <Btn full onClick={submit}>Salvar cartão</Btn>
    </Modal>
  );
}

/* ---------------------------------- CARD WIDGET ---------------------------------- */

function CardWidget({ card, used }) {
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
      </div>
    </div>
  );
}

/* ---------------------------------- EXPENSE ROW ---------------------------------- */

function ExpenseRow({ exp, cardName, personName, onEdit, onDelete, showPerson }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLORS[exp.category] }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: C.text }}>
          {exp.description}{exp.is_recurring && <Repeat size={11} color={C.muted} />}
        </div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {exp.category} · {cardName}{showPerson ? ` · ${personName}` : ""}
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

/* ---------------------------------- GOALS (individual, reusable) ---------------------------------- */

function GoalsScreen({ profile, data, refresh }) {
  const now = currentMonthKey();
  const dueNow = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now));
  const myBudgets = data.budgets.filter((b) => b.profile_id === profile.id);
  const [editingCat, setEditingCat] = useState(null);
  const [value, setValue] = useState("");

  const submit = async () => {
    if (!value) return;
    await saveBudget(profile.id, editingCat, parseFloat(value));
    setEditingCat(null); setValue("");
    await refresh();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title="Metas" subtitle="Teto mensal por categoria, só seu" />
      <Panel>
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const spent = dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0);
            const budget = myBudgets.find((b) => b.category === cat);
            const pct = budget ? (spent / budget.monthly_limit) * 100 : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span style={{ color: C.text }}>{cat}</span>
                  {editingCat === cat ? (
                    <div className="flex gap-1.5 items-center">
                      <TextInput type="number" style={{ width: 90, padding: "4px 8px" }} value={value} onChange={(e) => setValue(e.target.value)} placeholder={budget ? String(budget.monthly_limit) : "0"} autoFocus />
                      <button onClick={submit}><Check size={14} color={C.green} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingCat(cat); setValue(budget?.monthly_limit || ""); }} className="text-[11px]" style={{ color: C.muted }}>
                      {budget ? `${brl(spent)} / ${brl(budget.monthly_limit)}` : "definir meta"}
                    </button>
                  )}
                </div>
                {budget && <ProgressBar pct={pct} tone={pct > 100 ? "rose" : pct > 80 ? "gold" : "green"} />}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
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

  const cardName = (id) => data.cards.find((c) => c.id === id)?.name || "-";
  const personName = (id) => data.profiles.find((u) => u.id === id)?.name || "-";
  const range = periodToRange(period, customRange);

  const baseExpenses = isAdmin ? data.expenses : data.expenses.filter((e) => e.profile_id === profile.id);
  const filtered = baseExpenses
    .filter((e) => !isAdmin || filterPerson === "all" || e.profile_id === filterPerson)
    .filter((e) => filterCard === "all" || e.card_id === filterCard)
    .filter((e) => e.purchase_date >= range.start && e.purchase_date <= range.end)
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  const myCards = isAdmin ? data.cards : data.cards.filter((c) => c.memberIds.includes(profile.id));

  const handleSave = async (exp) => { await saveExpense(exp); await refresh(); };
  const handleDelete = async (exp) => { await deleteExpense(exp); await refresh(); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title="Histórico" subtitle={isAdmin ? "Lançamentos da família" : "Seus lançamentos"} />

      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <Select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="flex-1">
            <option value="all">Todas as pessoas</option>
            {data.profiles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={filterCard} onChange={(e) => setFilterCard(e.target.value)} className="flex-1">
            <option value="all">Todos os cartões</option>
            {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      )}
      <PeriodFilter value={period} onChange={setPeriod} customRange={customRange} onCustomChange={setCustomRange} />

      <div className="flex gap-2 mb-4">
        <Btn full onClick={() => { setEditing(null); setShowForm(true); }} disabled={myCards.length === 0}><Plus size={16} /> Novo gasto</Btn>
        <Btn variant="ghost" onClick={() => downloadCSV(toCSV(filtered, cardName, personName), `gastos-${period}.csv`)}><Download size={16} /></Btn>
      </div>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyState icon={<ListChecks size={28} />} text="Nenhum gasto neste período." />
        ) : (
          filtered.map((exp) => (
            <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} personName={personName(exp.profile_id)} showPerson={isAdmin}
              onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
          ))
        )}
      </Panel>

      {showForm && (
        <ExpenseForm cards={myCards} userId={isAdmin ? (editing?.profile_id || data.profiles[0].id) : profile.id} initial={editing}
          onSave={handleSave} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

/* ---------------------------------- MEMBER: OVERVIEW ---------------------------------- */

function MemberOverview({ profile, data }) {
  const now = currentMonthKey();
  const myCards = data.cards.filter((c) => c.memberIds.includes(profile.id));
  const myExpenses = data.expenses.filter((e) => e.profile_id === profile.id);
  const myMonthTotal = myExpenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title={`Olá, ${profile.name.split(" ")[0]}`} subtitle="Seu mês" />
      <HeroPanel label="Total do mês" value={myMonthTotal} />

      {myCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {myCards.map((c) => {
            const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
            return <CardWidget key={c.id} card={c} used={used} />;
          })}
        </div>
      ) : (
        <Panel><EmptyState icon={<CreditCard size={28} />} text="Você ainda não tem acesso a nenhum cartão." /></Panel>
      )}
    </div>
  );
}

/* ---------------------------------- ADMIN: OVERVIEW ---------------------------------- */

function AdminOverview({ data }) {
  const now = currentMonthKey();
  const totalMonth = data.expenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const byPerson = data.profiles.map((u) => ({ ...u, total: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0) }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28">
      <ScreenHeader title="Visão geral" subtitle="Este mês" />
      <div className="space-y-4">
        <HeroPanel label="Total do mês" value={totalMonth} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {byPerson.map((p) => (
            <Panel key={p.id}><span className="text-[11px]" style={{ color: C.muted }}>{p.name}</span><div className="mt-1"><Amount value={p.total} size="text-lg" /></div></Panel>
          ))}
        </div>
        <h4 className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: C.muted }}>Cartões</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.cards.map((c) => {
            const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
            return <CardWidget key={c.id} card={c} used={used} />;
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
  const handleDelete = async (card) => { await deleteCard(card); await refresh(); };

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
          const names = data.profiles.filter((u) => c.memberIds.includes(u.id)).map((u) => u.name).join(", ") || "ninguém ainda";
          return (
            <div key={c.id}>
              <CardWidget card={c} used={used} />
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

/* ---------------------------------- ADMIN: REPORTS ---------------------------------- */

function AdminReports({ data }) {
  const now = currentMonthKey();
  const dueNow = data.expenses.filter((e) => isDueIn(e, now));
  const byCategory = CATEGORIES.map((cat) => ({ name: cat, value: dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0) })).filter((d) => d.value > 0);

  const months = last6Months();
  const evolution = months.map((mk) => {
    const row = { month: monthLabel(mk) };
    data.profiles.forEach((u) => { row[u.name] = data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return row;
  });
  const personColors = [C.gold, C.green, C.rose, "#7FA8C9"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-5">
      <ScreenHeader title="Relatórios" subtitle="Como a família está gastando" />
      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Gastos por categoria (mês atual)</h4>
        {byCategory.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>Sem dados neste mês.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {byCategory.map((d, i) => <Cell key={i} fill={CAT_COLORS[d.name]} />)}
              </Pie>
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel>
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Evolução mensal por pessoa</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={evolution}>
            <XAxis dataKey="month" stroke={C.muted} fontSize={11} />
            <YAxis stroke={C.muted} fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            {data.profiles.map((u, i) => <Bar key={u.id} dataKey={u.name} stackId="a" fill={personColors[i % personColors.length]} radius={i === data.profiles.length - 1 ? [4, 4, 0, 0] : 0} />)}
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

/* ---------------------------------- DASHBOARDS ---------------------------------- */

function MemberApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Início", icon: <LayoutGrid size={18} /> },
    { id: "history", label: "Histórico", icon: <ListChecks size={18} /> },
    { id: "goals", label: "Metas", icon: <Target size={18} /> },
  ];
  return (
    <>
      <TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      {tab === "overview" && <MemberOverview profile={profile} data={data} />}
      {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
      {tab === "goals" && <GoalsScreen profile={profile} data={data} refresh={refresh} />}
      <BottomNav tabs={tabs} tab={tab} setTab={setTab} />
    </>
  );
}

function AdminApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Início", icon: <LayoutGrid size={18} /> },
    { id: "cards", label: "Cartões", icon: <CreditCard size={18} /> },
    { id: "history", label: "Histórico", icon: <ListChecks size={18} /> },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={18} /> },
    { id: "goals", label: "Metas", icon: <Target size={18} /> },
  ];
  return (
    <>
      <TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      {tab === "overview" && <AdminOverview data={data} />}
      {tab === "cards" && <AdminCards data={data} refresh={refresh} />}
      {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin />}
      {tab === "reports" && <AdminReports data={data} />}
      {tab === "goals" && <GoalsScreen profile={profile} data={data} refresh={refresh} />}
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
