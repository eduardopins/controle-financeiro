import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CreditCard, Plus, Pencil, Trash2, LogOut, LayoutGrid, Wallet, PieChart as PieIcon,
  ListChecks, X, Check, Lock, User, ChevronRight, ShieldCheck, Download, AlertTriangle,
  Repeat, Target, Clock, Mail,
} from "lucide-react";

/* ---------------------------------- tokens ---------------------------------- */

const C = {
  bg: "#0F1226", bgSoft: "#151A38", surface: "#1B2148", surfaceAlt: "#242B58",
  border: "rgba(201,162,76,0.16)", borderStrong: "rgba(201,162,76,0.32)",
  gold: "#C9A24C", goldSoft: "#E4C77E", text: "#F1EEE3", muted: "#9AA1C4",
  green: "#54B08A", rose: "#DD7C86", amber: "#D9A441",
};

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

function PeriodFilter({ value, onChange, customRange, onCustomChange }) {
  const presets = [
    { id: "month", label: "Este mês" },
    { id: "1m", label: "1 mês" },
    { id: "3m", label: "3 meses" },
    { id: "6m", label: "6 meses" },
    { id: "12m", label: "12 meses" },
    { id: "custom", label: "Personalizado" },
  ];
  return (
    <div className="mb-3">
      <div className="flex gap-1.5 flex-wrap mb-2">
        {presets.map((p) => (
          <button key={p.id} onClick={() => onChange(p.id)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: value === p.id ? C.gold : "transparent", color: value === p.id ? "#1A1607" : C.muted, border: `1px solid ${value === p.id ? C.gold : C.border}` }}>
            {p.label}
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

function downloadCSV(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/* ---------------------------------- font injection ---------------------------------- */

function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

/* ---------------------------------- UI atoms ---------------------------------- */

function Panel({ children, style, className = "" }) {
  return <div className={`rounded-2xl p-5 ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}`, ...style }}>{children}</div>;
}
function Btn({ children, onClick, variant = "primary", type = "button", full, disabled }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50";
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
const inputClass = "w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1";
function TextInput(props) { return <input {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} className={inputClass} style={inputStyle} />; }
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(6,8,20,0.7)" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
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
  return <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} /></div>;
}
function Banner({ tone = "amber", icon, children }) {
  const color = tone === "rose" ? C.rose : C.amber;
  return (
    <div className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-3 text-xs" style={{ background: `${color}1A`, border: `1px solid ${color}55`, color }}>
      {icon}<span>{children}</span>
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
async function saveBudget(category, monthly_limit) {
  await supabase.from("budgets").upsert({ category, monthly_limit }, { onConflict: "category" });
}
async function setGuestStatus(profileId, isGuest, expiresAt) {
  await supabase.from("profiles").update({ is_guest: isGuest, guest_expires_at: expiresAt }).eq("id", profileId);
}

/* ---------------------------------- LOGIN ---------------------------------- */

function Login({ onLogin }) {
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
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: C.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Wallet size={24} color={C.gold} />
          <span className="text-xl font-semibold" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>Controle Financeiro</span>
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

function TopBar({ profile, onLogout, tabs, tab, setTab }) {
  return (
    <div className="sticky top-0 z-30" style={{ background: "rgba(15,18,38,0.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} color={C.gold} />
          <span className="text-sm font-semibold" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{profile.name}</span>
          {profile.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(201,162,76,0.15)", color: C.gold }}>admin</span>}
          {profile.is_guest && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(217,164,65,0.15)", color: C.amber }}>convidado</span>}
        </div>
        <button onClick={onLogout}><LogOut size={17} color={C.muted} /></button>
      </div>
      {tabs && (
        <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={{ background: tab === t.id ? C.surface : "transparent", color: tab === t.id ? C.gold : C.muted, border: `1px solid ${tab === t.id ? C.borderStrong : "transparent"}` }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
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
              {u.name}{u.is_guest && <span className="text-[10px]" style={{ color: C.amber }}>(convidado)</span>}
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
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.surfaceAlt}, ${C.bgSoft})`, border: `1px solid ${C.borderStrong}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{card.name}</span>
        <CreditCard size={16} color={C.gold} />
      </div>
      {pct >= 80 && <Banner tone="rose" icon={<AlertTriangle size={14} />}>Limite quase no fim ({pct.toFixed(0)}% usado)</Banner>}
      {daysUntilDue <= 5 && <Banner icon={<Clock size={14} />}>Vence em {daysUntilDue} {daysUntilDue === 1 ? "dia" : "dias"}</Banner>}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px]" style={{ color: C.muted }}>disponível</span>
        <Amount value={Math.max(card.card_limit - used, 0)} size="text-base" tone={tone === "rose" ? "rose" : undefined} />
      </div>
      <ProgressBar pct={pct} tone={tone} />
      <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: C.muted }}>
        <span>usado {brl(used)}</span><span>limite {brl(card.card_limit)}</span>
      </div>
      <div className="mt-2 text-[10px]" style={{ color: C.muted }}>
        fatura {status} · fecha dia {card.closing_day} · vence dia {card.due_day}
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
          {!exp.is_recurring && exp.installments > 1 && ` · parcelado em ${exp.installments}x`}
          {exp.is_recurring && " · recorrente"}
        </div>
      </div>
      <Amount value={monthlyValue(exp)} size="text-sm" />
      <button onClick={() => onEdit(exp)}><Pencil size={14} color={C.muted} /></button>
      <button onClick={() => onDelete(exp)}><Trash2 size={14} color={C.rose} /></button>
    </div>
  );
}

/* ---------------------------------- MEMBER DASHBOARD ---------------------------------- */

function MemberDashboard({ profile, data, refresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [period, setPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const now = currentMonthKey();

  const myCards = data.cards.filter((c) => c.memberIds.includes(profile.id));
  const myExpenses = data.expenses.filter((e) => e.profile_id === profile.id);
  const myMonthTotal = myExpenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const cardName = (id) => data.cards.find((c) => c.id === id)?.name || "-";
  const personName = () => profile.name;

  const range = periodToRange(period, customRange);
  const historyExpenses = myExpenses.filter((e) => e.purchase_date >= range.start && e.purchase_date <= range.end);

  const handleSave = async (exp) => { await saveExpense(exp); await refresh(); };
  const handleDelete = async (exp) => { await deleteExpense(exp); await refresh(); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-24">
      {profile.is_guest && profile.guest_expires_at && (
        <Banner icon={<Clock size={14} />}>Seu acesso é temporário e expira em {new Date(profile.guest_expires_at + "T00:00:00").toLocaleDateString("pt-BR")}.</Banner>
      )}
      <Panel className="mb-4" style={{ background: `linear-gradient(135deg, ${C.surfaceAlt}, ${C.surface})` }}>
        <span className="text-[11px]" style={{ color: C.muted }}>gasto este mês</span>
        <div className="mt-1"><Amount value={myMonthTotal} size="text-3xl" /></div>
      </Panel>

      {myCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {myCards.map((c) => {
            const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
            return <CardWidget key={c.id} card={c} used={used} />;
          })}
        </div>
      ) : (
        <Panel className="mb-4"><p className="text-sm" style={{ color: C.muted }}>Você ainda não tem acesso a nenhum cartão.</p></Panel>
      )}

      <Btn full onClick={() => { setEditing(null); setShowForm(true); }} disabled={myCards.length === 0}><Plus size={16} /> Novo gasto</Btn>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-medium tracking-wide uppercase" style={{ color: C.muted }}>Histórico de gastos</h4>
          <button onClick={() => downloadCSV(toCSV(historyExpenses, cardName, personName), `meus-gastos-${period}.csv`)} className="flex items-center gap-1 text-xs" style={{ color: C.gold }}>
            <Download size={12} /> CSV
          </button>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} customRange={customRange} onCustomChange={setCustomRange} />
        <Panel>
          {historyExpenses.length === 0 && <p className="text-sm py-2" style={{ color: C.muted }}>Nenhum gasto neste período.</p>}
          {historyExpenses.sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)).map((exp) => (
            <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
          ))}
        </Panel>
      </div>

      {showForm && <ExpenseForm cards={myCards} userId={profile.id} initial={editing} onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN: OVERVIEW ---------------------------------- */

function AdminOverview({ data }) {
  const now = currentMonthKey();
  const totalMonth = data.expenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const byPerson = data.profiles.map((u) => ({ ...u, total: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0) }));

  return (
    <div className="space-y-4">
      <Panel style={{ background: `linear-gradient(135deg, ${C.surfaceAlt}, ${C.surface})` }}>
        <span className="text-[11px]" style={{ color: C.muted }}>total da família este mês</span>
        <div className="mt-1"><Amount value={totalMonth} size="text-3xl" /></div>
      </Panel>
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
        {data.cards.length === 0 && <Panel><p className="text-sm" style={{ color: C.muted }}>Nenhum cartão cadastrado ainda.</p></Panel>}
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

  return (
    <div>
      <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Novo cartão</Btn>
      <div className="mt-4 space-y-3">
        {data.cards.map((c) => {
          const used = data.expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
          const names = data.profiles.filter((u) => c.memberIds.includes(u.id)).map((u) => u.name).join(", ") || "ninguém ainda";
          return (
            <Panel key={c.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-sm" style={{ color: C.text }}>{c.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>acesso: {names}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(c); setShowForm(true); }}><Pencil size={14} color={C.muted} /></button>
                  <button onClick={() => handleDelete(c)}><Trash2 size={14} color={C.rose} /></button>
                </div>
              </div>
              <ProgressBar pct={(used / c.card_limit) * 100} />
              <div className="flex justify-between mt-2 text-[11px]" style={{ color: C.muted }}><span>usado {brl(used)}</span><span>limite {brl(c.card_limit)}</span></div>
            </Panel>
          );
        })}
      </div>
      {showForm && <CardForm allProfiles={data.profiles} initial={editing} onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN: EXPENSES ---------------------------------- */

function AdminExpenses({ data, refresh }) {
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterCard, setFilterCard] = useState("all");
  const [period, setPeriod] = useState("month");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const cardName = (id) => data.cards.find((c) => c.id === id)?.name || "-";
  const personName = (id) => data.profiles.find((u) => u.id === id)?.name || "-";

  const range = periodToRange(period, customRange);
  const filtered = data.expenses
    .filter((e) => filterPerson === "all" || e.profile_id === filterPerson)
    .filter((e) => filterCard === "all" || e.card_id === filterCard)
    .filter((e) => e.purchase_date >= range.start && e.purchase_date <= range.end)
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  const handleSave = async (exp) => { await saveExpense(exp); await refresh(); };
  const handleDelete = async (exp) => { await deleteExpense(exp); await refresh(); };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="flex-1">
          <option value="all">Todas as pessoas</option>
          {data.profiles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <Select value={filterCard} onChange={(e) => setFilterCard(e.target.value)} className="flex-1">
          <option value="all">Todos os cartões</option>
          {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <PeriodFilter value={period} onChange={setPeriod} customRange={customRange} onCustomChange={setCustomRange} />
      <div className="flex gap-2 mb-4">
        <Btn full onClick={() => { setEditing(null); setShowForm(true); }} disabled={data.cards.length === 0}><Plus size={16} /> Novo gasto</Btn>
        <Btn variant="ghost" onClick={() => downloadCSV(toCSV(filtered, cardName, personName), `gastos-${period}.csv`)}><Download size={16} /></Btn>
      </div>
      <Panel>
        {filtered.length === 0 && <p className="text-sm py-2" style={{ color: C.muted }}>Nenhum lançamento encontrado.</p>}
        {filtered.map((exp) => (
          <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} personName={personName(exp.profile_id)} showPerson
            onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
        ))}
      </Panel>
      {showForm && <ExpenseForm cards={data.cards} userId={editing?.profile_id || data.profiles[0].id} initial={editing} onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN: REPORTS (+ metas) ---------------------------------- */

function AdminReports({ data, refresh }) {
  const now = currentMonthKey();
  const dueNow = data.expenses.filter((e) => isDueIn(e, now));
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetValue, setBudgetValue] = useState("");

  const byCategory = CATEGORIES.map((cat) => ({ name: cat, value: dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0) })).filter((d) => d.value > 0);

  const months = last6Months();
  const evolution = months.map((mk) => {
    const row = { month: monthLabel(mk) };
    data.profiles.forEach((u) => { row[u.name] = data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return row;
  });
  const personColors = [C.gold, C.green, C.rose, "#7FA8C9"];

  const saveBudgetValue = async () => {
    if (!budgetValue) return;
    await saveBudget(editingBudget, parseFloat(budgetValue));
    setEditingBudget(null); setBudgetValue("");
    await refresh();
  };

  return (
    <div className="space-y-5">
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
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase flex items-center gap-1.5" style={{ color: C.muted }}><Target size={13} /> Metas por categoria</h4>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const spent = dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0);
            const budget = data.budgets.find((b) => b.category === cat);
            const pct = budget ? (spent / budget.monthly_limit) * 100 : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: C.text }}>{cat}</span>
                  {editingBudget === cat ? (
                    <div className="flex gap-1.5 items-center">
                      <TextInput type="number" style={{ width: 90, padding: "4px 8px" }} value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} placeholder={budget ? budget.monthly_limit : "0"} />
                      <button onClick={saveBudgetValue}><Check size={13} color={C.green} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingBudget(cat); setBudgetValue(budget?.monthly_limit || ""); }} className="text-[11px]" style={{ color: C.muted }}>
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

/* ---------------------------------- ADMIN: ACCESS (convidados) ---------------------------------- */

function AdminAccess({ data, refresh }) {
  const [editing, setEditing] = useState(null);
  const [expiresAt, setExpiresAt] = useState("");

  const save = async (profileId, makeGuest) => {
    await setGuestStatus(profileId, makeGuest, makeGuest ? expiresAt : null);
    setEditing(null); setExpiresAt("");
    await refresh();
  };

  return (
    <div>
      <Banner icon={<Mail size={14} />}>
        Para criar um novo login (ex: um convidado novo), crie o usuário em Authentication → Users no Supabase e adicione uma linha correspondente na tabela profiles. Aqui você só controla se um perfil já existente é temporário e até quando.
      </Banner>
      <div className="space-y-3">
        {data.profiles.filter((p) => p.role !== "admin").map((p) => (
          <Panel key={p.id}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-sm" style={{ color: C.text }}>{p.name}</div>
                {p.is_guest && <div className="text-[11px]" style={{ color: C.amber }}>convidado · expira em {p.guest_expires_at ? new Date(p.guest_expires_at + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</div>}
              </div>
              {p.is_guest ? (
                <Btn variant="ghost" onClick={() => save(p.id, false)}>Tornar permanente</Btn>
              ) : editing === p.id ? (
                <div className="flex gap-1.5 items-center">
                  <TextInput type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  <button onClick={() => save(p.id, true)} disabled={!expiresAt}><Check size={16} color={C.green} /></button>
                </div>
              ) : (
                <Btn variant="ghost" onClick={() => setEditing(p.id)}>Tornar temporário</Btn>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- ADMIN DASHBOARD ---------------------------------- */

function AdminDashboard({ profile, data, refresh, onLogout }) {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Visão geral", icon: <LayoutGrid size={14} /> },
    { id: "cards", label: "Cartões", icon: <CreditCard size={14} /> },
    { id: "expenses", label: "Lançamentos", icon: <ListChecks size={14} /> },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={14} /> },
    { id: "access", label: "Acessos", icon: <User size={14} /> },
  ];
  return (
    <>
      <TopBar profile={profile} onLogout={onLogout} tabs={tabs} tab={tab} setTab={setTab} />
      <div className="max-w-3xl mx-auto px-4 py-5 pb-24">
        {tab === "overview" && <AdminOverview data={data} />}
        {tab === "cards" && <AdminCards data={data} refresh={refresh} />}
        {tab === "expenses" && <AdminExpenses data={data} refresh={refresh} />}
        {tab === "reports" && <AdminReports data={data} refresh={refresh} />}
        {tab === "access" && <AdminAccess data={data} refresh={refresh} />}
      </div>
    </>
  );
}

/* ---------------------------------- ROOT ---------------------------------- */

export default function App() {
  useFonts();
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
      if (p?.is_guest && p.guest_expires_at && p.guest_expires_at < new Date().toISOString().slice(0, 10)) {
        setError("Seu acesso temporário expirou.");
        await supabase.auth.signOut();
        return;
      }
      setProfile(p || null);
      await refresh();
    })();
  }, [authUser, refresh]);

  if (authUser === undefined) return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>Carregando…</div>;
  if (!authUser) return <Login onLogin={setAuthUser} />;
  if (!profile || !data) return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>{error || "Carregando…"}</div>;

  const handleLogout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {error && <div className="text-center text-xs py-1.5" style={{ background: "rgba(221,124,134,0.15)", color: C.rose }}>{error}</div>}
      {profile.role === "admin" ? (
        <AdminDashboard profile={profile} data={data} refresh={refresh} onLogout={handleLogout} />
      ) : (
        <>
          <TopBar profile={profile} onLogout={handleLogout} />
          <MemberDashboard profile={profile} data={data} refresh={refresh} />
        </>
      )}
    </div>
  );
}
