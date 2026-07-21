import React, { useState, useEffect, useCallback } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CreditCard, Plus, Pencil, Trash2, LogOut, LayoutGrid, Wallet, PieChart as PieIcon,
  ListChecks, X, Lock, Mail,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";

/* ---------------------------------- tokens ---------------------------------- */

const C = {
  bg: "#0F1226", bgSoft: "#151A38", surface: "#1B2148", surfaceAlt: "#242B58",
  border: "rgba(201,162,76,0.16)", borderStrong: "rgba(201,162,76,0.32)",
  gold: "#C9A24C", goldSoft: "#E4C77E", text: "#F1EEE3", muted: "#9AA1C4",
  green: "#54B08A", rose: "#DD7C86",
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
const currentMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const monthKeyFromDate = (dateStr) => { const [y, m] = dateStr.split("-"); return `${y}-${m}`; };
const diffMonths = (fromKey, toKey) => {
  const [fy, fm] = fromKey.split("-").map(Number); const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`; };
const addMonthsToKey = (key, n) => {
  const [y, m] = key.split("-").map(Number); const total = (m - 1) + n;
  return `${y + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};
const last6Months = () => { const now = currentMonthKey(); const arr = []; for (let i = 5; i >= 0; i--) arr.push(addMonthsToKey(now, -i)); return arr; };

function outstanding(exp, nowKey = currentMonthKey()) {
  const done = Math.min(Math.max(diffMonths(exp.first_month, nowKey), 0), exp.installments);
  const monthly = exp.total_amount / exp.installments;
  return Math.max(exp.total_amount - done * monthly, 0);
}
function isDueIn(exp, monthKey) {
  const idx = diffMonths(exp.first_month, monthKey);
  return idx >= 0 && idx < exp.installments;
}
const monthlyValue = (exp) => exp.total_amount / exp.installments;

/* ---------------------------------- data layer (Supabase) ---------------------------------- */

function useAppData(session) {
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [cards, setCards] = useState([]);
  const [cardAccess, setCardAccess] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [{ data: me, error: meErr }, { data: profs }, { data: crd }, { data: acc }, { data: exp }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("profiles").select("*"),
        supabase.from("cards").select("*"),
        supabase.from("card_access").select("*"),
        supabase.from("expenses").select("*"),
      ]);
      if (meErr) throw meErr;
      setProfile(me);
      setProfiles(profs || []);
      setCards(crd || []);
      setCardAccess(acc || []);
      setExpenses(exp || []);
      setError(null);
    } catch (e) {
      setError(e.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { reload(); }, [reload]);

  return { profile, profiles, cards, cardAccess, expenses, loading, error, reload };
}

function cardMemberIds(cardAccess, cardId) {
  return cardAccess.filter((a) => a.card_id === cardId).map((a) => a.profile_id);
}

/* ---------------------------------- small UI atoms ---------------------------------- */

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

function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

/* ---------------------------------- LOGIN ---------------------------------- */

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr("E-mail ou senha incorretos.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: C.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Wallet size={24} color={C.gold} />
          <span className="text-xl font-semibold" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>Controle Financeiro</span>
        </div>
        <Panel>
          <Field label="E-mail">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </Field>
          <Field label="Senha">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>
          {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
          <Btn full onClick={submit} disabled={loading || !email || !password}>
            <Lock size={14} /> {loading ? "Entrando…" : "Entrar"}
          </Btn>
        </Panel>
        <p className="text-center text-[11px] mt-4" style={{ color: C.muted }}>
          <Mail size={11} className="inline mr-1" /> Use o e-mail e senha criados no Supabase (Authentication → Users)
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- TOPBAR ---------------------------------- */

function TopBar({ user, onLogout, tabs, tab, setTab }) {
  return (
    <div className="sticky top-0 z-30" style={{ background: "rgba(15,18,38,0.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} color={C.gold} />
          <span className="text-sm font-semibold" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{user.name}</span>
          {user.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(201,162,76,0.15)", color: C.gold }}>admin</span>}
        </div>
        <button onClick={onLogout}><LogOut size={17} color={C.muted} /></button>
      </div>
      {tabs && (
        <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={{ background: tab === t.id ? C.surface : "transparent", color: tab === t.id ? C.gold : C.muted, border: `1px solid ${tab === t.id ? C.borderStrong : "transparent"}` }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- FORMS ---------------------------------- */

function ExpenseForm({ cards, profileId, onSave, onClose, initial }) {
  const [cardId, setCardId] = useState(initial?.card_id || cards[0]?.id || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description || "");
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount ?? "");
  const [date, setDate] = useState(initial?.purchase_date || new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState(initial?.installments || 1);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!cardId || !description.trim() || !totalAmount) return;
    setSaving(true);
    await onSave({
      id: initial?.id, card_id: cardId, profile_id: profileId, category, description: description.trim(),
      total_amount: parseFloat(totalAmount), purchase_date: date, first_month: monthKeyFromDate(date),
      installments: Math.max(1, parseInt(installments) || 1),
    });
    setSaving(false);
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
        <Field label="Valor total (R$)"><TextInput type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0,00" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da compra"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Parcelas"><TextInput type="number" min="1" max="48" value={installments} onChange={(e) => setInstallments(e.target.value)} /></Field>
      </div>
      {installments > 1 && totalAmount && (
        <p className="text-xs mb-3" style={{ color: C.muted }}>{installments}x de <b style={{ color: C.goldSoft }}>{brl(totalAmount / installments)}</b></p>
      )}
      <Btn full onClick={submit} disabled={!cardId || saving}>{saving ? "Salvando…" : "Salvar gasto"}</Btn>
    </Modal>
  );
}

function CardForm({ allUsers, onSave, onClose, initial, initialMemberIds }) {
  const [name, setName] = useState(initial?.name || "");
  const [limit, setLimit] = useState(initial?.card_limit ?? "");
  const [closingDay, setClosingDay] = useState(initial?.closing_day || 1);
  const [dueDay, setDueDay] = useState(initial?.due_day || 10);
  const [memberIds, setMemberIds] = useState(initialMemberIds || []);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!name.trim() || !limit) return;
    setSaving(true);
    await onSave({ id: initial?.id, name: name.trim(), card_limit: parseFloat(limit), closing_day: parseInt(closingDay), due_day: parseInt(dueDay) }, memberIds);
    setSaving(false);
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
          {allUsers.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm" style={{ color: C.text }}>
              <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}
            </label>
          ))}
        </div>
      </Field>
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Salvar cartão"}</Btn>
    </Modal>
  );
}

/* ---------------------------------- CARD WIDGET / ROW ---------------------------------- */

function CardWidget({ card, used }) {
  const pct = card.card_limit ? (used / card.card_limit) * 100 : 0;
  const tone = pct > 85 ? "rose" : pct > 60 ? "gold" : "green";
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.surfaceAlt}, ${C.bgSoft})`, border: `1px solid ${C.borderStrong}` }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium" style={{ color: C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{card.name}</span>
        <CreditCard size={16} color={C.gold} />
      </div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px]" style={{ color: C.muted }}>disponível</span>
        <Amount value={Math.max(card.card_limit - used, 0)} size="text-base" tone={tone === "rose" ? "rose" : undefined} />
      </div>
      <ProgressBar pct={pct} tone={tone} />
      <div className="flex items-center justify-between mt-2 text-[11px]" style={{ color: C.muted }}>
        <span>usado {brl(used)}</span><span>limite {brl(card.card_limit)}</span>
      </div>
      <div className="mt-2 text-[10px]" style={{ color: C.muted }}>fecha dia {card.closing_day} · vence dia {card.due_day}</div>
    </div>
  );
}

function ExpenseRow({ exp, cardName, personName, onEdit, onDelete, showPerson }) {
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLORS[exp.category] }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" style={{ color: C.text }}>{exp.description}</div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {exp.category} · {cardName}{showPerson ? ` · ${personName}` : ""}{exp.installments > 1 && ` · parcela em ${exp.installments}x`}
        </div>
      </div>
      <Amount value={monthlyValue(exp)} size="text-sm" />
      <button onClick={() => onEdit(exp)}><Pencil size={14} color={C.muted} /></button>
      <button onClick={() => onDelete(exp)}><Trash2 size={14} color={C.rose} /></button>
    </div>
  );
}

/* ---------------------------------- MEMBER DASHBOARD ---------------------------------- */

function MemberDashboard({ profile, cards, cardAccess, expenses, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const now = currentMonthKey();

  const myCards = cards; // RLS já retorna só os cartões que ela tem acesso
  const myExpenses = expenses; // RLS já retorna só os próprios gastos
  const myMonthTotal = myExpenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const cardName = (id) => cards.find((c) => c.id === id)?.name || "—";

  const saveExpense = async (exp) => {
    if (exp.id) await supabase.from("expenses").update(exp).eq("id", exp.id);
    else await supabase.from("expenses").insert(exp);
    await reload();
  };
  const deleteExpense = async (exp) => { await supabase.from("expenses").delete().eq("id", exp.id); await reload(); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-24">
      <Panel className="mb-4" style={{ background: `linear-gradient(135deg, ${C.surfaceAlt}, ${C.surface})` }}>
        <span className="text-[11px]" style={{ color: C.muted }}>gasto este mês</span>
        <div className="mt-1"><Amount value={myMonthTotal} size="text-3xl" /></div>
      </Panel>

      {myCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {myCards.map((c) => {
            const used = expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
            return <CardWidget key={c.id} card={c} used={used} />;
          })}
        </div>
      ) : (
        <Panel className="mb-4"><p className="text-sm" style={{ color: C.muted }}>Você ainda não tem acesso a nenhum cartão. Peça para o administrador liberar.</p></Panel>
      )}

      <Btn full onClick={() => { setEditing(null); setShowForm(true); }} disabled={myCards.length === 0}><Plus size={16} /> Novo gasto</Btn>

      <div className="mt-6">
        <h4 className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: C.muted }}>Meus lançamentos</h4>
        <Panel>
          {myExpenses.length === 0 && <p className="text-sm py-2" style={{ color: C.muted }}>Nenhum gasto lançado ainda.</p>}
          {[...myExpenses].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)).map((exp) => (
            <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={deleteExpense} />
          ))}
        </Panel>
      </div>

      {showForm && <ExpenseForm cards={myCards} profileId={profile.id} initial={editing} onSave={saveExpense} onClose={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN DASHBOARD ---------------------------------- */

function AdminOverview({ cards, expenses, profiles }) {
  const now = currentMonthKey();
  const totalMonth = expenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
  const byPerson = profiles.map((u) => ({ ...u, total: expenses.filter((e) => e.profile_id === u.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0) }));

  return (
    <div className="space-y-4">
      <Panel style={{ background: `linear-gradient(135deg, ${C.surfaceAlt}, ${C.surface})` }}>
        <span className="text-[11px]" style={{ color: C.muted }}>total da família este mês</span>
        <div className="mt-1"><Amount value={totalMonth} size="text-3xl" /></div>
      </Panel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {byPerson.map((p) => <Panel key={p.id}><span className="text-[11px]" style={{ color: C.muted }}>{p.name}</span><div className="mt-1"><Amount value={p.total} size="text-lg" /></div></Panel>)}
      </div>
      <h4 className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: C.muted }}>Cartões</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => {
          const used = expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
          return <CardWidget key={c.id} card={c} used={used} />;
        })}
        {cards.length === 0 && <Panel><p className="text-sm" style={{ color: C.muted }}>Nenhum cartão cadastrado ainda.</p></Panel>}
      </div>
    </div>
  );
}

function AdminCards({ cards, cardAccess, expenses, profiles, reload }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const now = currentMonthKey();

  const saveCard = async (card, memberIds) => {
    let cardId = card.id;
    if (cardId) {
      await supabase.from("cards").update(card).eq("id", cardId);
    } else {
      const { data, error } = await supabase.from("cards").insert(card).select().single();
      if (error) { alert(error.message); return; }
      cardId = data.id;
    }
    await supabase.from("card_access").delete().eq("card_id", cardId);
    if (memberIds.length) await supabase.from("card_access").insert(memberIds.map((pid) => ({ card_id: cardId, profile_id: pid })));
    await reload();
  };
  const deleteCard = async (card) => { await supabase.from("cards").delete().eq("id", card.id); await reload(); };

  return (
    <div>
      <Btn full onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Novo cartão</Btn>
      <div className="mt-4 space-y-3">
        {cards.map((c) => {
          const used = expenses.filter((e) => e.card_id === c.id).reduce((s, e) => s + outstanding(e, now), 0);
          const ids = cardMemberIds(cardAccess, c.id);
          const names = profiles.filter((u) => ids.includes(u.id)).map((u) => u.name).join(", ") || "ninguém ainda";
          return (
            <Panel key={c.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-sm" style={{ color: C.text }}>{c.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>acesso: {names}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(c); setShowForm(true); }}><Pencil size={14} color={C.muted} /></button>
                  <button onClick={() => deleteCard(c)}><Trash2 size={14} color={C.rose} /></button>
                </div>
              </div>
              <ProgressBar pct={(used / c.card_limit) * 100} />
              <div className="flex justify-between mt-2 text-[11px]" style={{ color: C.muted }}><span>usado {brl(used)}</span><span>limite {brl(c.card_limit)}</span></div>
            </Panel>
          );
        })}
      </div>
      {showForm && <CardForm allUsers={profiles} initial={editing} initialMemberIds={editing ? cardMemberIds(cardAccess, editing.id) : []} onSave={saveCard} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function AdminExpenses({ cards, expenses, profiles, reload }) {
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterCard, setFilterCard] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const cardName = (id) => cards.find((c) => c.id === id)?.name || "—";
  const personName = (id) => profiles.find((u) => u.id === id)?.name || "—";

  const filtered = expenses
    .filter((e) => filterPerson === "all" || e.profile_id === filterPerson)
    .filter((e) => filterCard === "all" || e.card_id === filterCard)
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  const saveExpense = async (exp) => {
    if (exp.id) await supabase.from("expenses").update(exp).eq("id", exp.id);
    else await supabase.from("expenses").insert(exp);
    await reload();
  };
  const deleteExpense = async (exp) => { await supabase.from("expenses").delete().eq("id", exp.id); await reload(); };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="flex-1">
          <option value="all">Todas as pessoas</option>
          {profiles.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <Select value={filterCard} onChange={(e) => setFilterCard(e.target.value)} className="flex-1">
          <option value="all">Todos os cartões</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <Btn full onClick={() => { setEditing(null); setShowForm(true); }} disabled={cards.length === 0}><Plus size={16} /> Novo gasto</Btn>
      <Panel className="mt-4">
        {filtered.length === 0 && <p className="text-sm py-2" style={{ color: C.muted }}>Nenhum lançamento encontrado.</p>}
        {filtered.map((exp) => (
          <ExpenseRow key={exp.id} exp={exp} cardName={cardName(exp.card_id)} personName={personName(exp.profile_id)} showPerson
            onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={deleteExpense} />
        ))}
      </Panel>
      {showForm && (
        <ExpenseForm cards={cards} profileId={editing?.profile_id || profiles[0]?.id} initial={editing} onSave={saveExpense} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function AdminReports({ expenses, profiles }) {
  const now = currentMonthKey();
  const dueNow = expenses.filter((e) => isDueIn(e, now));
  const byCategory = CATEGORIES.map((cat) => ({ name: cat, value: dueNow.filter((e) => e.category === cat).reduce((s, e) => s + monthlyValue(e), 0) })).filter((d) => d.value > 0);

  const months = last6Months();
  const evolution = months.map((mk) => {
    const row = { month: monthLabel(mk) };
    profiles.forEach((u) => { row[u.name] = expenses.filter((e) => e.profile_id === u.id && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return row;
  });
  const personColors = [C.gold, C.green, C.rose, "#7FA8C9"];

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
        <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Evolução mensal por pessoa</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={evolution}>
            <XAxis dataKey="month" stroke={C.muted} fontSize={11} />
            <YAxis stroke={C.muted} fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            {profiles.map((u, i) => <Bar key={u.id} dataKey={u.name} stackId="a" fill={personColors[i % personColors.length]} radius={i === profiles.length - 1 ? [4, 4, 0, 0] : 0} />)}
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function AdminDashboard({ profile, profiles, cards, cardAccess, expenses, reload }) {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Visão geral", icon: <LayoutGrid size={14} /> },
    { id: "cards", label: "Cartões", icon: <CreditCard size={14} /> },
    { id: "expenses", label: "Lançamentos", icon: <ListChecks size={14} /> },
    { id: "reports", label: "Relatórios", icon: <PieIcon size={14} /> },
  ];
  return (
    <>
      <TopBar user={profile} onLogout={() => supabase.auth.signOut()} tabs={tabs} tab={tab} setTab={setTab} />
      <div className="max-w-3xl mx-auto px-4 py-5 pb-24">
        {tab === "overview" && <AdminOverview cards={cards} expenses={expenses} profiles={profiles} />}
        {tab === "cards" && <AdminCards cards={cards} cardAccess={cardAccess} expenses={expenses} profiles={profiles} reload={reload} />}
        {tab === "expenses" && <AdminExpenses cards={cards} expenses={expenses} profiles={profiles} reload={reload} />}
        {tab === "reports" && <AdminReports expenses={expenses} profiles={profiles} />}
      </div>
    </>
  );
}

/* ---------------------------------- ROOT ---------------------------------- */

export default function App() {
  useFonts();
  const [session, setSession] = useState(undefined); // undefined = checking, null = no session

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const { profile, profiles, cards, cardAccess, expenses, loading, error, reload } = useAppData(session);

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>Carregando…</div>;
  }
  if (!session) return <Login />;
  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>Carregando seus dados…</div>;
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: C.bg, color: C.rose }}>
        <div>
          <p className="mb-2 font-medium">Não foi possível carregar seu perfil.</p>
          <p className="text-sm" style={{ color: C.muted }}>{error}</p>
          <p className="text-xs mt-3" style={{ color: C.muted }}>Confira se existe uma linha para este usuário na tabela `profiles` do Supabase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {profile.role === "admin" ? (
        <AdminDashboard profile={profile} profiles={profiles} cards={cards} cardAccess={cardAccess} expenses={expenses} reload={reload} />
      ) : (
        <>
          <TopBar user={profile} onLogout={() => supabase.auth.signOut()} />
          <MemberDashboard profile={profile} cards={cards} cardAccess={cardAccess} expenses={expenses} reload={reload} />
        </>
      )}
    </div>
  );
}
