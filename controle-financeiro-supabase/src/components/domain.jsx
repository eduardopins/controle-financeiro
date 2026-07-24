import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CreditCard, Plus, Pencil, Trash2, LogOut, Wallet, PieChart as PieIcon, X, Check, Lock, AlertTriangle, Repeat, Clock, Sun, Moon, Paperclip, TrendingUp, TrendingDown, DollarSign, CheckSquare, Square, Share2, Percent, PiggyBank, ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";
import { C, CATEGORIES } from "../lib/constants";
import { brl, firstName, sortByName, monthKeyFromDate, currentMonthKey, diffMonths, diffDays, monthLabel, openInvoiceMonth, invoiceMonthForPurchase, isDueIn, monthlyValue, overridesMap, billingInfo, isIncomeDueIn, detectBank, shade, incomeMonthlyValue, projectMonthEnd, investmentBalance, estimatedYieldToDate, investmentMonthlyRate, getCategoryColor, parseBankCSV, monthKeysForPeriod, paidForInvoice, invoicePaymentStatus, formatShortDate } from "../lib/domain";
import { friendlyError, guardedHandler } from "../lib/errors";
import { uploadReceipt, uploadAvatar, saveProfileAvatar, logActivity, deleteExpense, deleteIncome, extractReceiptData, createProfile } from "../lib/data";
import { Switch, IconField, CurrencyInput, CurrencyIconField, Panel, Btn, Field, TextInput, Select, Modal, DateInput, FileInput, Amount, ProgressBar, Chip, EmptyState, ThemeToggle, Avatar, SwipeActions } from "./primitives";



/* ---------------------------------- LOGIN ---------------------------------- */

export function Login({ onLogin, theme, onToggleTheme }) {
  const [mode, setMode] = useState("login"); // login | forgot | forgotSent | signup | signupSent
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const resetToLogin = () => { setMode("login"); setErr(""); setPassword(""); setConfirmPassword(""); };

  const submit = async () => {
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("E-mail ou senha incorretos."); return; }
    onLogin(data.user);
  };

  const submitForgot = async () => {
    if (!email) { setErr("Informe seu e-mail primeiro."); return; }
    setLoading(true); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) { setErr(friendlyError(error)); return; }
    setMode("forgotSent");
  };

  const submitSignup = async () => {
    if (!name.trim()) { setErr("Informe seu nome."); return; }
    if (password.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (password !== confirmPassword) { setErr("As senhas não coincidem."); return; }
    setLoading(true); setErr("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setLoading(false); setErr(friendlyError(error)); return; }
    // Se o projeto exige confirmação por e-mail, ainda não existe sessão aqui —
    // a pessoa confirma o e-mail primeiro e só depois consegue entrar de fato.
    if (!data.session) { setLoading(false); setMode("signupSent"); return; }
    try { await createProfile(data.user.id, name.trim()); } catch (e) { console.error("Falha ao criar perfil:", e); }
    setLoading(false);
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
          {mode === "forgotSent" && (
            <>
              <p className="text-sm mb-4" style={{ color: C.text }}>
                Se <strong>{email}</strong> tiver uma conta, enviamos um link pra redefinir a senha. Confira sua caixa de entrada (e o spam).
              </p>
              <Btn full variant="ghost" onClick={resetToLogin}>Voltar para o login</Btn>
            </>
          )}
          {mode === "forgot" && (
            <>
              <p className="text-xs mb-3" style={{ color: C.muted }}>Informe seu e-mail e enviaremos um link pra você criar uma senha nova.</p>
              <Field label="E-mail"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
              {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
              <Btn full onClick={submitForgot} disabled={loading || !email}>Enviar link</Btn>
              <button onClick={resetToLogin} className="text-xs mt-3 block mx-auto" style={{ color: C.muted }}>Voltar</button>
            </>
          )}
          {mode === "signupSent" && (
            <>
              <p className="text-sm mb-4" style={{ color: C.text }}>
                Quase lá! Enviamos um link de confirmação pra <strong>{email}</strong>. Depois de confirmar, é só entrar normalmente.
              </p>
              <Btn full variant="ghost" onClick={resetToLogin}>Voltar para o login</Btn>
            </>
          )}
          {mode === "signup" && (
            <>
              <p className="text-xs mb-3" style={{ color: C.muted }}>Crie sua conta. Depois disso, quem já administra a conta precisa liberar acesso aos cartões e caixinhas pra você — por padrão você entra sem ver nada ainda.</p>
              <Field label="Seu nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
              <Field label="E-mail"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Senha"><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <Field label="Confirmar senha">
                <TextInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitSignup()} />
              </Field>
              {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
              <Btn full onClick={submitSignup} disabled={loading || !name || !email || !password || !confirmPassword}>Criar conta</Btn>
              <button onClick={resetToLogin} className="text-xs mt-3 block mx-auto" style={{ color: C.muted }}>Já tenho conta</button>
            </>
          )}
          {mode === "login" && (
            <>
              <Field label="E-mail"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
              <Field label="Senha">
                <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
              </Field>
              {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
              <Btn full onClick={submit} disabled={loading || !email || !password}><Lock size={14} /> Entrar</Btn>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button onClick={() => { setMode("forgot"); setErr(""); }} className="text-xs" style={{ color: C.muted }}>Esqueci minha senha</button>
                <button onClick={() => { setMode("signup"); setErr(""); }} className="text-xs" style={{ color: C.muted }}>Criar conta</button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

// Modal simples pra trocar a senha estando logado (diferente do fluxo de
// "esqueci minha senha" — aqui a pessoa já está autenticada e só quer atualizar
// a senha por conta própria, sem precisar de link por e-mail).
export function AccountSettingsModal({ profile, onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não coincidem."); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setErr(friendlyError(error)); return; }
    setDone(true);
    setPassword(""); setConfirm("");
  };

  return (
    <Modal title="Configurações da conta" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>Logado como <strong style={{ color: C.text }}>{profile.name}</strong></p>
      <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Trocar senha</h4>
      {done && <p className="text-xs mb-3" style={{ color: C.green }}>Senha atualizada com sucesso.</p>}
      <Field label="Nova senha"><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Field label="Confirmar nova senha"><TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving || !password || !confirm}>{saving ? "Salvando..." : "Salvar nova senha"}</Btn>
    </Modal>
  );
}

export function SetNewPassword({ onDone, theme, onToggleTheme }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password.length < 6) { setErr("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não coincidem."); return; }
    setLoading(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(friendlyError(error)); return; }
    setDone(true);
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
          {done ? (
            <>
              <p className="text-sm mb-4" style={{ color: C.text }}>Senha atualizada! Pode continuar usando o app normalmente.</p>
              <Btn full onClick={onDone}>Continuar</Btn>
            </>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: C.muted }}>Escolha uma nova senha pra sua conta.</p>
              <Field label="Nova senha">
                <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </Field>
              <Field label="Confirmar nova senha">
                <TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
              </Field>
              {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
              <Btn full onClick={submit} disabled={loading || !password || !confirm}><Lock size={14} /> Salvar nova senha</Btn>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function TopBar({ profile, onLogout, theme, onToggleTheme, data, refresh, isAdmin, onShowActivity, onShowSettings }) {
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
          <button onClick={onShowSettings} className="flex items-center gap-2" aria-label="Configurações da conta">
            <span className="text-sm font-semibold tracking-wide" style={{ color: C.text, fontFamily: "'Manrope', sans-serif" }}>{firstName(profile.name)}</span>
            {profile.role === "admin" && <Chip>admin</Chip>}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={onShowActivity} aria-label="Atividade recente" title="Atividade recente"
              className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
              <History size={14} color={C.muted} />
            </button>
          )}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button onClick={onLogout} aria-label="Sair da conta" title="Sair"
            className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: `1px solid ${C.border}` }}>
            <LogOut size={14} color={C.muted} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- EXPENSE FORM ---------------------------------- */

export function ExpenseForm({ cards, userId, onSave, onClose, initial, allProfiles, customCategories, onAddCategory, startWithNoCard, creatorId, canRefund, onImportCSV, expenses }) {
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
    const trimmedDesc = description.trim();
    if (!trimmedDesc) { setErr("Informe uma descrição para o gasto."); return; }
    if (!(totalNum > 0)) { setErr("Informe um valor válido, maior que zero."); return; }
    if (!date) { setErr("Informe a data da compra."); return; }
    if (splitEnabled && splitWith && !isRefund && (amountA <= 0 || amountB <= 0)) { setErr("A divisão precisa deixar um valor maior que zero para cada pessoa."); return; }
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
              {sortByName(people).map((p) => <option key={p.id} value={p.id}>{firstName(p.name)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Cartão">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Dinheiro/Pix</option>
            {cards.filter((c) => !c.archived || c.id === cardId).map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (arquivado)" : ""}</option>)}
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
                  {sortByName(splitCandidates).map((p) => <option key={p.id} value={p.id}>{firstName(p.name)}</option>)}
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

export function CardForm({ allProfiles, onSave, onClose, initial }) {
  const [name, setName] = useState(initial?.name || "");
  const [limit, setLimit] = useState(initial?.card_limit ?? "");
  const [closingDay, setClosingDay] = useState(initial?.closing_day || 1);
  const [dueDay, setDueDay] = useState(initial?.due_day || 10);
  const [memberIds, setMemberIds] = useState(initial?.memberIds || []);
  const [archived, setArchived] = useState(initial?.archived || false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (id) => setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!name.trim()) { setErr("Informe o nome do cartão."); return; }
    if (!(parseFloat(limit) > 0)) { setErr("Informe um limite válido, maior que zero."); return; }
    const cd = parseInt(closingDay), dd = parseInt(dueDay);
    if (!(cd >= 1 && cd <= 31)) { setErr("O dia de fechamento precisa ser entre 1 e 31."); return; }
    if (!(dd >= 1 && dd <= 31)) { setErr("O dia de vencimento precisa ser entre 1 e 31."); return; }
    setSaving(true); setErr("");
    try {
      await onSave({ id: initial?.id, name: name.trim(), card_limit: parseFloat(limit), closing_day: parseInt(closingDay), due_day: parseInt(dueDay), memberIds, archived });
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
          {sortByName(allProfiles).map((u) => (
            <label key={u.id} className="flex items-center gap-2.5 text-sm" style={{ color: C.text }}>
              <Switch checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
              {firstName(u.name)}
            </label>
          ))}
        </div>
      </Field>
      {initial && (
        <label className="flex items-center gap-2.5 text-sm mb-3.5" style={{ color: C.text }}>
          <Switch checked={archived} onChange={() => setArchived((v) => !v)} />
          Arquivar (some da lista de cartões ativos, mas mantém todo o histórico)
        </label>
      )}
      {err && <p className="text-xs mb-3" style={{ color: C.rose }}>{err}</p>}
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar cartão"}</Btn>
    </Modal>
  );
}

/* ---------------------------------- CARD WIDGET ---------------------------------- */

export function CardWidget({ card, used, nextAmount }) {
  const pct = card.card_limit ? (used / card.card_limit) * 100 : 0;
  const tone = pct > 85 ? "rose" : pct > 60 ? "gold" : "green";
  const { status, daysUntilDue } = billingInfo(card);
  const brand = detectBank(card.name);
  const base = brand ? brand.color : "#C9A24C";
  const gradient = `linear-gradient(135deg, ${base}, ${shade(base, -0.4)})`;

  return (
    <div className="rounded-xl overflow-hidden" style={{ boxShadow: C.shadow }}>
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
          <span className="text-[11px]" style={{ color: C.muted }}>
            disponível · <span style={{ color: tone === "rose" ? C.rose : tone === "gold" ? C.gold : C.green, fontWeight: 700 }}>{pct.toFixed(0)}% usado</span>
          </span>
          <Amount value={Math.max(card.card_limit - used, 0)} size="text-base" tone={tone === "rose" ? "rose" : undefined} />
        </div>
        <ProgressBar pct={pct} tone={tone} />
        <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: C.muted }}>
          <span>usado {brl(used)}</span>
          <span>limite {brl(card.card_limit)}</span>
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

/* ---------------------------------- EXPENSE ROW ---------------------------------- */

export function GroupedExpenseRow({ parts, cardName, personName, viewerProfileId, showPerson, onEdit, onDeleteGroup, onToggleReconciled, contextMonth, reconciliations }) {
  const primary = parts[0];
  const total = parts.reduce((s, p) => s + monthlyValue(p), 0);
  const myPart = parts.find((p) => p.profile_id === viewerProfileId);
  const editTarget = myPart || primary;
  const recInfos = contextMonth && reconciliations ? parts.map((p) => reconciliations.get(`${p.id}|${contextMonth}`)) : [];
  const allReconciled = contextMonth ? recInfos.every(Boolean) && recInfos.length > 0 : false;
  const primaryRecInfo = recInfos[0];

  const row = (
    <div className="animate-item-enter flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}`, opacity: allReconciled ? 0.6 : 1 }}>
      {onToggleReconciled && contextMonth && (
        <button onClick={() => onToggleReconciled(parts, contextMonth, !allReconciled)} className="shrink-0" title={allReconciled ? "Conferido" : "Marcar como conferido"}>
          {allReconciled ? <CheckSquare size={16} color={C.green} /> : <Square size={16} color={C.muted} />}
        </button>
      )}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(primary.category) }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: C.text }}>
          {primary.description}
          <Share2 size={11} color={C.muted} />
        </div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {formatShortDate(primary.purchase_date)} · {primary.category} · {cardName}
          {allReconciled && (
            primaryRecInfo?.source === "openfinance"
              ? <span style={{ color: C.green }}> · verificado via Open Finance</span>
              : ` · conferido${primaryRecInfo?.reconciled_by ? ` por ${personName(primaryRecInfo.reconciled_by)}` : ""}`
          )}
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
      <button onClick={() => onEdit(editTarget)} aria-label="Editar gasto" className="hidden lg:inline-flex"><Pencil size={14} color={C.muted} /></button>
      <button onClick={() => onDeleteGroup(parts)} aria-label="Excluir gasto dividido" className="hidden lg:inline-flex"><Trash2 size={14} color={C.rose} /></button>
    </div>
  );
  return (
    <SwipeActions actions={[
      { icon: <Pencil size={16} color="#fff" />, label: "Editar gasto", onClick: () => onEdit(editTarget), background: C.gold },
      { icon: <Trash2 size={16} color="#fff" />, label: "Excluir gasto dividido", onClick: () => onDeleteGroup(parts), background: C.rose },
    ]}>
      {row}
    </SwipeActions>
  );
}

export function ExpenseRow({ exp, cardName, personName, creatorName, contextMonth, onEdit, onDelete, showPerson, selectable, selected, onToggleSelect, onToggleReconciled, overrides, onEditMonthOverride, reconciliations, resolveProfileName }) {
  const installmentLabel = !exp.is_recurring && exp.installments > 1
    ? (contextMonth ? `${Math.min(Math.max(diffMonths(exp.first_month, contextMonth) + 1, 1), exp.installments)}/${exp.installments}` : `${exp.installments}x`)
    : null;
  const hasOverride = !!(contextMonth && overrides && overrides.has(`${exp.id}|${contextMonth}`));
  const displayAmount = monthlyValue(exp, contextMonth, overrides);
  const recInfo = contextMonth && reconciliations ? reconciliations.get(`${exp.id}|${contextMonth}`) : null;
  const isReconciled = !!recInfo;
  const row = (
    <div className="animate-item-enter flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.border}`, opacity: isReconciled ? 0.6 : 1 }}>
      {selectable && (
        <button onClick={() => onToggleSelect(exp.id)} className="shrink-0">
          {selected ? <CheckSquare size={16} color={C.gold} /> : <Square size={16} color={C.muted} />}
        </button>
      )}
      {!selectable && onToggleReconciled && contextMonth && (
        <button onClick={() => onToggleReconciled(exp, contextMonth, !isReconciled)} className="shrink-0" title={isReconciled ? "Conferido" : "Marcar como conferido"}>
          {isReconciled ? <CheckSquare size={16} color={C.green} /> : <Square size={16} color={C.muted} />}
        </button>
      )}
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(exp.category) }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: C.text }}>
          {exp.description}{exp.is_recurring && <Repeat size={11} color={C.muted} title="Conta recorrente" style={{ marginLeft: 1 }} />}
          {exp.is_refund && <TrendingUp size={11} color={C.green} />}
          {exp.receipt_url && <a href={exp.receipt_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Paperclip size={11} color={C.muted} /></a>}
        </div>
        <div className="text-[11px] truncate" style={{ color: C.muted }}>
          {formatShortDate(exp.purchase_date)} · {exp.category} · {cardName}{showPerson ? ` · ${personName}` : ""}
          {installmentLabel && ` · ${installmentLabel}`}
          {exp.is_recurring && " · recorrente"}
          {exp.is_refund && " · reembolso"}
          {hasOverride && <span style={{ color: C.gold }}> · valor ajustado neste mês</span>}
          {exp.created_by && exp.created_by !== exp.profile_id && ` · lançado por ${creatorName}`}
          {isReconciled && (
            recInfo.source === "openfinance"
              ? <span style={{ color: C.green }}> · verificado via Open Finance</span>
              : ` · conferido${recInfo.reconciled_by && resolveProfileName ? ` por ${resolveProfileName(recInfo.reconciled_by)}` : ""}`
          )}
        </div>
      </div>
      <Amount value={displayAmount} size="text-sm" tone={exp.is_refund ? "green" : hasOverride ? "gold" : undefined} />
      <button onClick={() => onEdit(exp)} aria-label="Editar gasto" className="hidden lg:inline-flex ml-1"><Pencil size={14} color={hasOverride ? C.gold : C.muted} /></button>
      <button onClick={() => onDelete(exp)} aria-label="Excluir gasto" className="hidden lg:inline-flex ml-1"><Trash2 size={14} color={C.rose} /></button>
    </div>
  );
  if (selectable) return row; // no modo de seleção em massa, tocar na linha marca/desmarca — desliza atrapalharia
  return (
    <SwipeActions actions={[
      { icon: <Pencil size={16} color="#fff" />, label: "Editar gasto", onClick: () => onEdit(exp), background: C.gold },
      { icon: <Trash2 size={16} color="#fff" />, label: "Excluir gasto", onClick: () => onDelete(exp), background: C.rose },
    ]}>
      {row}
    </SwipeActions>
  );
}

export function IncomeForm({ profileId, onSave, onClose, initial }) {
  const [description, setDescription] = useState(initial?.description || "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [date, setDate] = useState(initial?.income_date || new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring || false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!description.trim()) { setErr("Informe uma descrição para a receita."); return; }
    if (!(parseFloat(amount) > 0)) { setErr("Informe um valor válido, maior que zero."); return; }
    if (!date) { setErr("Informe a data."); return; }
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

export function IncomeSection({ profile, data, refresh, scopeIds, scopeLabel }) {
  const now = openInvoiceMonth(data.cards);
  const ids = scopeIds && scopeIds.length > 0 ? scopeIds : [profile.id];
  const myIncomes = (data.incomes || []).filter((i) => i.profile_id === profile.id);
  const incomeMonth = (data.incomes || []).filter((i) => ids.includes(i.profile_id) && isIncomeDueIn(i, now)).reduce((s, i) => s + incomeMonthlyValue(i), 0);
  const expenseMonth = data.expenses.filter((e) => ids.includes(e.profile_id) && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e, now, overridesMap(data.expenseOverrides)), 0);
  const saldo = incomeMonth - expenseMonth;
  const projection = projectMonthEnd(data.expenses, ids, now);
  const projectedSaldo = incomeMonth - projection.projectedTotal;
  const showProjection = projection.daysRemaining > 1 && Math.abs(projectedSaldo - saldo) > 1;
  const myInvestments = (data.investments || []).filter((inv) => inv.created_by === profile.id || inv.memberIds.includes(profile.id));
  const investedTotal = myInvestments.reduce((s, inv) => s + investmentBalance(inv.id, data.investmentTransactions || []), 0);

  const handleDelete = guardedHandler(async (inc) => { if (!window.confirm("Excluir esta receita?")) return; await deleteIncome(inc); await refresh(); }, "excluir a receita");

  return (
    <Panel className="mb-4" style={{
      background: `linear-gradient(160deg, ${saldo < 0 ? "rgba(168,80,79,0.10)" : "rgba(47,122,92,0.10)"}, ${C.surface} 55%)`,
      border: `1px solid ${saldo < 0 ? "rgba(168,80,79,0.32)" : "rgba(47,122,92,0.28)"}`,
    }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: saldo < 0 ? "rgba(168,80,79,0.16)" : "rgba(47,122,92,0.16)" }}>
            {saldo < 0 ? <TrendingDown size={19} color={C.rose} /> : <TrendingUp size={19} color={C.green} />}
          </div>
          <div>
            <span className="text-[11px]" style={{ color: C.muted }}>{scopeLabel || "saldo do mês"}</span>
            <div><Amount value={saldo} size="text-2xl" tone={saldo < 0 ? "rose" : "green"} animate /></div>
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
                <button onClick={() => handleDelete(inc)} aria-label="Excluir receita"><Trash2 size={13} color={C.rose} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function InvestmentForm({ allProfiles, viewerProfileId, onSave, onClose, initial }) {
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
    if (!name.trim()) { setErr("Informe o nome da caixinha."); return; }
    if (targetAmount && !(parseFloat(targetAmount) > 0)) { setErr("A meta precisa ser um valor maior que zero."); return; }
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
            {sortByName(shareCandidates).map((p) => (
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

export function InvestmentTransactionForm({ investmentId, profileId, defaultType, onSave, onClose }) {
  const [type, setType] = useState(defaultType || "deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!(parseFloat(amount) > 0)) { setErr("Informe um valor válido, maior que zero."); return; }
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

export function InvestmentCard({ inv, balance, transactions, profiles, viewerProfileId, isAdmin, cdiAnnual, onMove, onEdit, onDelete, onDeleteTx }) {
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
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(84,176,138,0.15)" }}>
            <PiggyBank size={18} color={C.green} />
          </div>
          <div>
            <div className="font-medium text-sm" style={{ color: C.text }}>{inv.name}</div>
            <div className="text-[11px]" style={{ color: C.muted }}>acesso: {owners}</div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onEdit(inv)} aria-label="Editar caixinha"><Pencil size={14} color={C.muted} /></button>
            <button onClick={() => onDelete(inv)} aria-label="Excluir caixinha"><Trash2 size={14} color={C.rose} /></button>
          </div>
        )}
      </div>
      {inv.cdi_percent != null && (
        <Chip tone="green" icon={<TrendingUp size={10} />}>{inv.cdi_percent}% do CDI</Chip>
      )}
      <span className="text-[11px] block mt-2" style={{ color: C.muted }}>saldo</span>
      <div className="mb-3"><Amount value={balance} size="text-2xl" tone="green" animate /></div>
      {(() => {
        const rate = investmentMonthlyRate(inv, cdiAnnual);
        const estYield = rate != null ? estimatedYieldToDate(inv.id, transactions, rate) : 0;
        return estYield > 0.01 && (
          <p className="text-[11px] mb-3 flex items-center gap-1.5" style={{ color: C.green }}>
            <TrendingUp size={11} /> ~{brl(estYield)} de rendimento estimado até agora
          </p>
        );
      })()}
      {inv.target_amount != null && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1.5 text-xs" style={{ color: C.muted }}>
            <span>meta{inv.target_date ? ` até ${formatShortDate(inv.target_date)}` : ""}</span>
            <span style={{ color: C.text }}>{brl(balance)} <span style={{ color: C.muted }}>de {brl(inv.target_amount)}</span></span>
          </div>
          <ProgressBar pct={(balance / inv.target_amount) * 100} tone={balance >= inv.target_amount ? "green" : "gold"} />
          {inv.target_date && balance < inv.target_amount && (() => {
            const monthsLeft = Math.max(diffMonths(currentMonthKey(), monthKeyFromDate(inv.target_date)), 1);
            const neededPerMonth = (inv.target_amount - balance) / monthsLeft;
            return (
              <p className="text-[11px] mt-1.5" style={{ color: C.gold }}>
                Aporte ~{brl(neededPerMonth)}/mês ({monthsLeft} {monthsLeft === 1 ? "mês" : "meses"} restante{monthsLeft > 1 ? "s" : ""})
              </p>
            );
          })()}
        </div>
      )}
      {(() => {
        const recurringDeposit = transactions.find((t) => t.investment_id === inv.id && t.is_recurring && t.type === "deposit");
        return recurringDeposit && (
          <div className="flex items-center gap-1.5 mb-3 text-[11px]" style={{ color: C.muted }}>
            <Repeat size={11} color={C.gold} /> aporte automático de {brl(recurringDeposit.amount)}/mês configurado — confere se o depósito de verdade já foi feito
          </div>
        );
      })()}
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
                <button onClick={() => onDeleteTx(t)} aria-label="Excluir movimentação"><Trash2 size={12} color={C.rose} /></button>
              </div>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}

export function InvestmentSimulator({ cdiAnnual, onClose, embedded }) {
  const [initial, setInitial] = useState(1000);
  const [scenarios, setScenarios] = useState([200, 400]);
  const [cdiPercent, setCdiPercent] = useState(100);
  const [months, setMonths] = useState(12);

  const monthlyRate = investmentMonthlyRate({ cdi_percent: cdiPercent }, cdiAnnual);
  const i = (monthlyRate || 0) / 100;
  const n = Math.max(parseInt(months) || 0, 0);
  const p = parseFloat(initial) || 0;

  const compute = (monthly) => {
    const a = parseFloat(monthly) || 0;
    const futureValue = i > 0
      ? p * Math.pow(1 + i, n) + a * ((Math.pow(1 + i, n) - 1) / i)
      : p + a * n;
    const totalContributed = p + a * n;
    return { futureValue, totalContributed, earned: futureValue - totalContributed };
  };

  const updateScenario = (idx, value) => setScenarios((prev) => prev.map((s, i2) => i2 === idx ? value : s));
  const addScenario = () => setScenarios((prev) => prev.length < 3 ? [...prev, (parseFloat(prev[prev.length - 1]) || 0) + 100] : prev);
  const removeScenario = (idx) => setScenarios((prev) => prev.length > 1 ? prev.filter((_, i2) => i2 !== idx) : prev);

  const content = (
    <>
      <Field label="Valor inicial (R$)"><CurrencyInput value={initial} onChange={setInitial} /></Field>
      <div className="grid grid-cols-2 gap-2 mb-1">
        <Field label="% do CDI"><TextInput type="number" value={cdiPercent} onChange={(e) => setCdiPercent(e.target.value)} /></Field>
        <Field label="Meses"><TextInput type="number" value={months} onChange={(e) => setMonths(e.target.value)} /></Field>
      </div>
      {cdiAnnual == null && <p className="text-[11px] mb-3" style={{ color: C.muted }}>CDI atual indisponível agora — a simulação usa a última taxa conhecida, se houver.</p>}

      <p className="text-[10px] font-semibold tracking-wide uppercase mb-2 mt-3" style={{ color: C.gold }}>Comparar cenários de aporte mensal</p>
      <div className={`grid gap-2 mb-3 ${scenarios.length > 1 ? "grid-cols-2" : ""} ${scenarios.length > 2 ? "sm:grid-cols-3" : ""}`}>
        {scenarios.map((s, idx) => {
          const result = compute(s);
          return (
            <div key={idx} className="rounded-xl p-3" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <CurrencyInput value={s} onChange={(v) => updateScenario(idx, v)} />
                {scenarios.length > 1 && <button onClick={() => removeScenario(idx)}><X size={14} color={C.muted} /></button>}
              </div>
              <div className="text-[10px] mb-1" style={{ color: C.muted }}>valor final</div>
              <Amount value={result.futureValue} size="text-sm" tone="green" />
              <div className="text-[10px] mt-2" style={{ color: C.muted }}>rendimento: <span style={{ color: C.green }}>{brl(result.earned)}</span></div>
            </div>
          );
        })}
      </div>
      {scenarios.length < 3 && (
        <button onClick={addScenario} className="flex items-center gap-1.5 text-xs mb-4" style={{ color: C.gold }}>
          <Plus size={13} /> Comparar mais um cenário
        </button>
      )}
    </>
  );

  if (embedded) return <Panel>{content}</Panel>;
  return <Modal title="Simulador de investimento" onClose={onClose}>{content}</Modal>;
}

export function ImportCSVModal({ cards, userId, expenses, onImport, onClose }) {
  const [rows, setRows] = useState(null);
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseBankCSV(text);
    // Marca como possível duplicata (e já desmarca pra não importar) qualquer linha
    // muito parecida com um gasto que já existe nesse cartão perto da mesma data —
    // evita lançar a mesma compra duas vezes ao reimportar um extrato.
    const existing = (expenses || []).filter((e) => e.card_id === cardId);
    const withDuplicateCheck = parsed.map((r) => {
      const isDup = existing.some((e) =>
        Math.abs(Math.abs(e.total_amount) - Math.abs(r.amount)) < 0.01 &&
        Math.abs(diffDays(e.purchase_date, r.date)) <= 3
      );
      return { ...r, include: !isDup, possibleDuplicate: isDup };
    });
    setRows(withDuplicateCheck);
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

  const duplicateCount = rows?.filter((r) => r.possibleDuplicate).length || 0;

  return (
    <Modal title="Importar extrato (CSV)" onClose={onClose}>
      {!rows ? (
        <>
          <p className="text-xs mb-3" style={{ color: C.muted }}>Envie o arquivo CSV do extrato (data, descrição e valor). Depois você confere cada lançamento antes de importar de verdade.</p>
          <FileInput accept=".csv,text/csv" label="Escolher CSV" maxSizeMB={5} onFileSelected={handleFile} />
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
          {duplicateCount > 0 && (
            <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: C.amber }}>
              <AlertTriangle size={12} /> {duplicateCount} parecem já estar lançados nesse cartão — vieram desmarcados, mas você pode incluir se quiser.
            </p>
          )}
          <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded-lg p-2" style={{ background: C.bgSoft, opacity: r.include ? 1 : 0.4, border: r.possibleDuplicate ? `1px solid ${C.amber}` : "1px solid transparent" }}>
                <button onClick={() => toggleRow(i)}>{r.include ? <CheckSquare size={14} color={C.gold} /> : <Square size={14} color={C.muted} />}</button>
                <div className="flex-1 min-w-0">
                  <div className="truncate flex items-center gap-1" style={{ color: C.text }}>
                    {r.description}
                    {r.possibleDuplicate && <AlertTriangle size={11} color={C.amber} title="Parece já estar lançado" />}
                  </div>
                  <div style={{ color: C.muted }}>{r.date}{r.possibleDuplicate && <span style={{ color: C.amber }}> · possível duplicata</span>}</div>
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

export function PayInvoiceModal({ card, monthKey, invoiceTotal, alreadyPaid, payments, onConfirm, onUpdatePayment, onDeletePayment, onClose }) {
  const remaining = Math.max(invoiceTotal - alreadyPaid, 0);
  const [amount, setAmount] = useState(remaining > 0 ? String(remaining.toFixed(2)) : "");
  const [saving, setSaving] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const submit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    try { await onConfirm(value); onClose(); } finally { setSaving(false); }
  };
  const saveEdit = async () => {
    const value = parseFloat(editAmount);
    if (!value || value <= 0) return;
    setSaving(true);
    try { await onUpdatePayment(editingPayment.id, value); setEditingPayment(null); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Pagar fatura · ${card.name}`} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        Fatura de {monthLabel(monthKey)} · total {brl(invoiceTotal)}{alreadyPaid > 0 ? ` · já pago ${brl(alreadyPaid)}` : ""}
      </p>
      {payments && payments.length > 0 && (
        <div className="mb-4">
          <h5 className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Pagamentos registrados</h5>
          <div className="space-y-1.5">
            {payments.map((p) => (
              editingPayment?.id === p.id ? (
                <div key={p.id} className="flex items-center gap-2">
                  <CurrencyInput value={editAmount} onChange={setEditAmount} />
                  <button onClick={saveEdit} disabled={saving}><Check size={15} color={C.green} /></button>
                  <button onClick={() => setEditingPayment(null)}><X size={15} color={C.muted} /></button>
                </div>
              ) : (
                <div key={p.id} className="flex items-center justify-between text-sm py-1">
                  <span style={{ color: C.muted }}>{formatShortDate(p.paid_at)}</span>
                  <div className="flex items-center gap-2">
                    <Amount value={p.amount} size="text-sm" tone="green" />
                    <button onClick={() => { setEditingPayment(p); setEditAmount(String(p.amount.toFixed(2))); }}><Pencil size={13} color={C.muted} /></button>
                    <button onClick={() => onDeletePayment(p)} aria-label="Excluir pagamento"><Trash2 size={13} color={C.rose} /></button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
      <Field label="Registrar novo pagamento (R$)"><CurrencyInput value={amount} onChange={setAmount} /></Field>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setAmount(String(remaining.toFixed(2)))} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: C.bgSoft, color: C.text, border: `1px solid ${C.border}` }}>
          Valor total restante
        </button>
      </div>
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Confirmar pagamento"}</Btn>
    </Modal>
  );
}

export function ChoosePayCardModal({ cards, monthKey, expenses, payments, onChoose, onClose }) {
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

export function ScopeChoiceModal({ title, monthLabelText, onAll, onThisMonth, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>Essa conta se repete em vários meses. O que você quer fazer?</p>
      <div className="space-y-2">
        <button onClick={onThisMonth} className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
          Só em {monthLabelText}
        </button>
        <button onClick={onAll} className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
          Em todos os meses
        </button>
      </div>
    </Modal>
  );
}

export function MonthOverrideModal({ exp, monthKey, currentAmount, hasOverride, onSave, onRemove, onRemoveMonth, onClose }) {
  const [amount, setAmount] = useState(String(currentAmount.toFixed(2)));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    try { await onSave(value); onClose(); } finally { setSaving(false); }
  };
  const remove = async () => {
    setSaving(true);
    try { await onRemove(); onClose(); } finally { setSaving(false); }
  };
  const removeMonth = async () => {
    if (!window.confirm(`Não lançar "${exp.description}" em ${monthLabel(monthKey)}? Os outros meses continuam normais.`)) return;
    setSaving(true);
    try { await onRemoveMonth(); onClose(); } finally { setSaving(false); }
  };

  return (
    <Modal title="Ajustar valor deste mês" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>
        "{exp.description}" · {monthLabel(monthKey)}. O valor padrão (usado em todos os outros meses) continua sendo {brl(exp.total_amount)}.
      </p>
      <Field label={`Valor só em ${monthLabel(monthKey)} (R$)`}><CurrencyInput value={amount} onChange={setAmount} /></Field>
      <Btn full onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar valor deste mês"}</Btn>
      {hasOverride && (
        <button onClick={remove} disabled={saving} className="w-full text-xs text-center mt-3" style={{ color: C.muted }}>Remover ajuste (voltar ao valor padrão)</button>
      )}
      <button onClick={removeMonth} disabled={saving} className="w-full text-xs text-center mt-3" style={{ color: C.rose }}>Não lançar esse gasto neste mês</button>
    </Modal>
  );
}

export function TrashModal({ deletedExpenses, cardName, personName, onRestore, onPermanentDelete, onClose }) {
  return (
    <Modal title="Lixeira" onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: C.muted }}>Gastos excluídos ficam aqui por 30 dias antes de sumir de vez.</p>
      {deletedExpenses.length === 0 ? (
        <EmptyState icon={<Trash2 size={28} />} text="Nada na lixeira agora." />
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {deletedExpenses.map((exp) => {
            const daysLeft = Math.max(30 - Math.floor((Date.now() - new Date(exp.deleted_at).getTime()) / 86400000), 0);
            return (
              <div key={exp.id} className="flex items-center justify-between gap-2 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: C.text }}>{exp.description}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {formatShortDate(exp.purchase_date)} · {cardName(exp.card_id)} · {brl(exp.total_amount)} · some em {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onRestore(exp)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.gold }}>Restaurar</button>
                  <button onClick={() => onPermanentDelete(exp)}><Trash2 size={15} color={C.rose} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------- MEMBER: OVERVIEW ---------------------------------- */

export function MonthlyReviewBanner({ onOpen }) {
  const now = currentMonthKey();
  const dismissKey = `recurring-review-dismissed-${now}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  const today = new Date().getDate();
  if (dismissed || today > 5) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl p-4 mb-4" style={{ background: "rgba(203,160,90,0.10)", border: `1px solid ${C.border}` }}>
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

export function RecurringReviewModal({ profile, data, isAdmin, refresh, onClose }) {
  const scopeIds = isAdmin ? data.profiles.map((p) => p.id) : [profile.id];
  const personName = (id) => firstName(data.profiles.find((p) => p.id === id)?.name) || "-";
  const cardName = (id) => (id ? (data.cards.find((c) => c.id === id)?.name || "-") : "Dinheiro/Pix");
  const recurringExpenses = data.expenses.filter((e) => e.is_recurring && scopeIds.includes(e.profile_id));
  const recurringIncomes = (data.incomes || []).filter((i) => i.is_recurring && scopeIds.includes(i.profile_id));

  const handleDeleteExpense = guardedHandler(async (exp) => {
    if (!window.confirm(`Cancelar a recorrência "${exp.description}"? Isso remove o lançamento.`)) return;
    await deleteExpense(exp);
    await logActivity(profile.id, "excluiu", `Cancelou a recorrência "${exp.description}"`);
    await refresh();
  }, "cancelar a recorrência");
  const handleDeleteIncome = guardedHandler(async (inc) => {
    if (!window.confirm(`Cancelar a receita recorrente "${inc.description}"?`)) return;
    await deleteIncome(inc);
    await refresh();
  }, "cancelar a receita recorrente");

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
                <button onClick={() => handleDeleteExpense(e)} aria-label="Cancelar recorrência"><Trash2 size={14} color={C.rose} /></button>
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
                <button onClick={() => handleDeleteIncome(i)} aria-label="Cancelar receita recorrente"><Trash2 size={14} color={C.rose} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Btn full onClick={onClose}>Tudo certo, continuar</Btn>
    </Modal>
  );
}

export function RecentReconciliationBanner({ expenses, reconciliations, profileId, profiles }) {
  const cutoff = Date.now() - 7 * 86400000;
  const myExpenseIds = new Set(expenses.filter((e) => e.profile_id === profileId).map((e) => e.id));
  const recent = (reconciliations || []).filter((r) =>
    myExpenseIds.has(r.expense_id) && r.reconciled_by && r.reconciled_by !== profileId &&
    r.reconciled_at && new Date(r.reconciled_at).getTime() >= cutoff
  );
  if (recent.length === 0) return null;
  const byPerson = {};
  recent.forEach((r) => { byPerson[r.reconciled_by] = (byPerson[r.reconciled_by] || 0) + 1; });
  const parts = Object.entries(byPerson).map(([pid, count]) => {
    const name = firstName(profiles.find((p) => p.id === pid)?.name || "Alguém");
    return `${name} conferiu ${count} gasto${count > 1 ? "s" : ""} seu${count > 1 ? "s" : ""}`;
  });
  return (
    <div className="flex items-center gap-2.5 rounded-xl p-4 mb-4" style={{ background: "rgba(95,168,140,0.10)", border: `1px solid ${C.border}` }}>
      <CheckSquare size={16} color={C.green} className="shrink-0" />
      <span className="text-xs" style={{ color: C.text }}>{parts.join(" · ")} recentemente.</span>
    </div>
  );
}

/* ---------------------------------- DASHBOARDS ---------------------------------- */

export function Sidebar({ profile, tabs, tab, setTab, theme, onToggleTheme, onLogout, data, refresh, onAddExpense, onAddIncome, isAdmin, onShowActivity, onShowSettings }) {
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

      <nav className="flex flex-col gap-1 flex-1">
        {tabs.map((t, i) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left relative">
              <span style={{ color: active ? C.gold : C.muted }}>{t.icon}</span>
              <span style={{ color: active ? C.text : C.muted }} className="flex-1">{t.fullLabel || t.label}</span>
              <span className="text-[10px] shrink-0" style={{ color: C.border }}>{i + 1}</span>
              {t.badge && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: C.rose }} />}
              {active && <span className="absolute inset-0 rounded-xl -z-10" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} />}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <Avatar profile={profile} size={32} editable onUpload={handleAvatarUpload} uploading={uploading} />
        <button onClick={onShowSettings} className="min-w-0 flex-1 text-left" aria-label="Configurações da conta">
          <div className="text-xs font-semibold truncate" style={{ color: C.text }}>{firstName(profile.name)}</div>
          {profile.role === "admin" && <div className="text-[10.5px]" style={{ color: C.muted }}>admin</div>}
        </button>
        {isAdmin && (
          <button onClick={onShowActivity} aria-label="Atividade recente" className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all" style={{ border: `1px solid ${C.border}` }} title="Atividade recente">
            <History size={13} color={C.muted} />
          </button>
        )}
        <button onClick={onLogout} aria-label="Sair da conta" className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all" style={{ border: `1px solid ${C.border}` }} title="Sair">
          <LogOut size={13} color={C.muted} />
        </button>
      </div>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-1 text-[10px]" style={{ color: C.muted }}>
        <span><b style={{ color: C.text }}>G</b> gasto</span>
        <span><b style={{ color: C.text }}>R</b> receita</span>
        <span><b style={{ color: C.text }}>1-5</b> navegar</span>
      </div>
    </div>
  );
}