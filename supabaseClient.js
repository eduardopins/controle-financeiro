import React, { useState, useEffect, useRef, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import { CreditCard, Plus, Pencil, Trash2, LayoutGrid, PieChart as PieIcon, ListChecks, Check, ChevronRight, Download, AlertTriangle, Search, TrendingUp, TrendingDown, DollarSign, CheckSquare, Share2, Percent, PiggyBank, History, BellRing } from "lucide-react";
import { C, CATEGORIES, HERO_GRADIENT, FALLBACK_CAT_COLORS } from "./lib/constants";
import { brl, firstName, sortByName, currentMonthKey, monthLabel, addMonthsToKey, last6Months, openInvoiceMonth, isDueIn, monthlyValue, overridesMap, isRemovedForMonth, toCSV, toCSVAnnual, downloadCSV, isIncomeDueIn, nextInvoiceProjection, categoryComparison, downloadJSON, anyCardAlert, accessibleCards, periodPresetLabel, incomeMonthlyValue, investmentBalance, estimatedYieldToDate, investmentBalanceUpTo, investmentMonthlyRate, invoiceMonths, invoiceStatusInfo, getCategoryColor, allCategoryNames, shareSummaryImage, compactNumber, personColorFor, monthKeysForPeriod, categoryTotalsForMonths, paidForInvoice, netUsedForCard, invoiceDueDate, invoicePaymentStatus, reconciliationMap, formatShortDate, buildDisplayRows } from "./lib/domain";
import { friendlyError, guardedHandler } from "./lib/errors";
import { saveInvoicePayment, updateInvoicePayment, deleteInvoicePayment, saveExpenseOverride, removeExpenseForMonth, deleteExpenseOverride, syncPluggyCards, dismissUnmatchedTransaction, syncPluggyTransactions, applyPluggyValues, saveCard, deleteCard, logActivity, saveExpense, deleteExpense, restoreExpense, permanentlyDeleteExpense, setExpenseReconciled, saveBudget, deleteBudget, saveIncome, saveCustomCategory, saveInvestment, deleteInvestment, saveInvestmentTransaction, deleteInvestmentTransaction, bulkUpdateCategory } from "./lib/data";
import { useCurrentCDI, useBillAlerts, useBudgetAlerts, usePersistentTab, useIsDesktop, useKeyboardShortcuts } from "./hooks";
import { HeroPanel, CurrencyInput, Panel, Btn, Field, TextInput, Select, Amount, ProgressBar, Chip, ScreenHeader, EmptyState, BottomNav, Avatar, ReportTabs, UpcomingBillsPanel, FloatingAddButton } from "./components/primitives";
import { TopBar, ExpenseForm, CardForm, CardWidget, GroupedExpenseRow, ExpenseRow, IncomeForm, IncomeSection, InvestmentForm, InvestmentTransactionForm, InvestmentCard, InvestmentSimulator, ImportCSVModal, PayInvoiceModal, ChoosePayCardModal, ScopeChoiceModal, MonthOverrideModal, TrashModal, MonthlyReviewBanner, RecurringReviewModal, RecentReconciliationBanner, Sidebar } from "./components/domain";



export function InvestmentsScreen({ profile, data, refresh, isAdmin }) {
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
  const handleDeleteInvestment = guardedHandler(async (inv) => { if (!window.confirm(`Excluir a caixinha "${inv.name}"? Isso também remove o histórico dela.`)) return; await deleteInvestment(inv); await refresh(); }, "excluir a caixinha");
  const handleSaveTx = async (tx) => { await saveInvestmentTransaction(tx); await refresh(); };
  const handleDeleteTx = guardedHandler(async (tx) => { if (!window.confirm("Excluir esta movimentação?")) return; await deleteInvestmentTransaction(tx); await refresh(); }, "excluir a movimentação");

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

          {myInvestments.length > 1 && totalBalance > 0 && (
            <Panel className="mb-4">
              <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Composição da carteira</h4>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={myInvestments.map((inv, i) => ({ name: inv.name, value: Math.max(investmentBalance(inv.id, data.investmentTransactions), 0) })).filter((d) => d.value > 0)}
                      dataKey="value" nameKey="name" innerRadius={32} outerRadius={52} paddingAngle={2}>
                      {myInvestments.map((inv, i) => <Cell key={inv.id} fill={FALLBACK_CAT_COLORS[i % FALLBACK_CAT_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {myInvestments.map((inv, i) => {
                    const bal = Math.max(investmentBalance(inv.id, data.investmentTransactions), 0);
                    const pct = totalBalance > 0 ? (bal / totalBalance) * 100 : 0;
                    return bal > 0 && (
                      <div key={inv.id} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: FALLBACK_CAT_COLORS[i % FALLBACK_CAT_COLORS.length] }} />
                        <span className="truncate flex-1" style={{ color: C.text }}>{inv.name}</span>
                        <span style={{ color: C.muted }}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}

          {myInvestments.length > 0 && (
            <Panel className="mb-4">
              <h4 className="text-xs font-medium mb-3 tracking-wide uppercase" style={{ color: C.muted }}>Aporte vs. rendimento (últimos 6 meses)</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={last6Months().map((mk) => {
                  const prevMk = addMonthsToKey(mk, -1);
                  let contrib = 0, yieldDelta = 0;
                  myInvestments.forEach((inv) => {
                    const balThis = investmentBalanceUpTo(inv.id, data.investmentTransactions, mk);
                    const balPrev = investmentBalanceUpTo(inv.id, data.investmentTransactions, prevMk);
                    const rate = investmentMonthlyRate(inv, cdi);
                    const yThis = rate != null ? estimatedYieldToDate(inv.id, data.investmentTransactions, rate, mk) : 0;
                    const yPrev = rate != null ? estimatedYieldToDate(inv.id, data.investmentTransactions, rate, prevMk) : 0;
                    yieldDelta += yThis - yPrev;
                    contrib += (balThis - balPrev) - (yThis - yPrev);
                  });
                  return { month: monthLabel(mk), aporte: Math.max(contrib, 0), rendimento: Math.max(yieldDelta, 0) };
                })} barGap={4}>
                  <XAxis dataKey="month" stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke={C.muted} fontSize={11} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={38} />
                  <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10 }} labelStyle={{ color: C.text }} itemStyle={{ color: C.text }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="aporte" name="Aporte" fill={C.gold} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rendimento" name="Rendimento" fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          )}

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

export function GoalsScreen({ profile, data, refresh, embedded }) {
  const now = openInvoiceMonth(data.cards);
  const dueNow = data.expenses.filter((e) => e.profile_id === profile.id && isDueIn(e, now));
  const myBudgets = data.budgets.filter((b) => b.profile_id === profile.id);
  const myCategories = [...CATEGORIES, ...(data.customCategories || []).filter((c) => c.profile_id === profile.id).map((c) => c.name)];
  const [editingCat, setEditingCat] = useState(null);
  const [value, setValue] = useState("");

  const submit = guardedHandler(async () => {
    if (!value) return;
    await saveBudget(profile.id, editingCat, parseFloat(value));
    setEditingCat(null); setValue("");
    await refresh();
  }, "salvar a meta");
  const remove = guardedHandler(async (budget) => {
    if (!window.confirm("Excluir esta meta?")) return;
    await deleteBudget(budget.id);
    await refresh();
  }, "excluir a meta");

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

export function HistoryScreen({ profile, data, refresh, isAdmin }) {
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterCard, setFilterCard] = useState("all");
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

  const baseExpenses = useMemo(() => isAdmin ? data.expenses : data.expenses.filter((e) => e.profile_id === profile.id), [isAdmin, data.expenses, profile.id]);
  const filtered = useMemo(() => baseExpenses
    .filter((e) => !isAdmin || filterPerson === "all" || e.profile_id === filterPerson)
    .filter((e) => filterCard === "all" || e.card_id === filterCard)
    .filter((e) => e.description.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date)), [baseExpenses, isAdmin, filterPerson, filterCard, query]);

  const myCards = isAdmin ? data.cards : accessibleCards(data, profile.id);

  const handleSave = async (expArr) => {
    const arr = Array.isArray(expArr) ? expArr : [expArr];
    const isEdit = !!editing;
    for (const e of arr) await saveExpense(e);
    await refresh();
    const desc = arr[0]?.description || "gasto";
    await logActivity(profile.id, isEdit ? "editou" : "criou", `${isEdit ? "Editou" : "Lançou"} o gasto "${desc}"`);
  };
  const [showTrash, setShowTrash] = useState(false);
  const handleDelete = guardedHandler(async (exp) => {
    if (!window.confirm("Excluir este gasto? Ele fica na lixeira por 30 dias, dá pra restaurar depois.")) return;
    await deleteExpense(exp);
    await refresh();
    await logActivity(profile.id, "excluiu", `Excluiu o gasto "${exp.description}"`);
  }, "excluir o gasto");
  const handleRestore = guardedHandler(async (exp) => {
    await restoreExpense(exp);
    await refresh();
    await logActivity(profile.id, "restaurou", `Restaurou o gasto "${exp.description}" da lixeira`);
  }, "restaurar o gasto");
  const handlePermanentDelete = guardedHandler(async (exp) => {
    if (!window.confirm(`Excluir "${exp.description}" de vez? Não dá pra desfazer.`)) return;
    await permanentlyDeleteExpense(exp);
    await refresh();
  }, "excluir o gasto definitivamente");
  const handleToggleReconciled = guardedHandler(async (exp, monthKey, value) => { await setExpenseReconciled(exp.id, monthKey, profile.id, value); await refresh(); }, "atualizar a conferência");
  const handleToggleReconciledGroup = guardedHandler(async (parts, monthKey, value) => {
    for (const p of parts) await setExpenseReconciled(p.id, monthKey, profile.id, value);
    await refresh();
  }, "atualizar a conferência");
  const [overrideTarget, setOverrideTarget] = useState(null);
  const expenseOverridesMap = overridesMap(data.expenseOverrides);
  const reconciliationsMap = reconciliationMap(data.reconciliations);
  const handleSaveOverride = guardedHandler(async (monthKey, amount) => {
    await saveExpenseOverride(overrideTarget.id, monthKey, amount);
    await logActivity(profile.id, "ajustou", `Ajustou o valor de "${overrideTarget.description}" em ${monthLabel(monthKey)} para ${brl(amount)}`);
    await refresh();
  }, "ajustar o valor do mês");
  const handleRemoveOverride = guardedHandler(async (monthKey) => {
    await deleteExpenseOverride(overrideTarget.id, monthKey);
    await refresh();
  }, "remover o ajuste");
  const handleRemoveMonth = guardedHandler(async (monthKey) => {
    await removeExpenseForMonth(overrideTarget.id, monthKey);
    await logActivity(profile.id, "ajustou", `Removeu "${overrideTarget.description}" da fatura de ${monthLabel(monthKey)} (fica normal nos outros meses)`);
    await refresh();
  }, "remover o gasto deste mês");
  const isMultiMonth = (exp) => exp.is_recurring || exp.installments > 1;
  const [editScopeTarget, setEditScopeTarget] = useState(null);
  const [deleteScopeTarget, setDeleteScopeTarget] = useState(null);
  const handleEditClick = (exp) => {
    if (isMultiMonth(exp)) setEditScopeTarget(exp);
    else { setEditing(exp); setShowForm(true); }
  };
  const handleDeleteClick = (exp) => {
    if (isMultiMonth(exp)) setDeleteScopeTarget(exp);
    else handleDelete(exp);
  };
  const handleDeleteGroup = guardedHandler(async (parts) => {
    if (!window.confirm("Excluir este gasto dividido? As duas partes serão removidas.")) return;
    for (const p of parts) await deleteExpense(p);
    await refresh();
    await logActivity(profile.id, "excluiu", `Excluiu o gasto dividido "${parts[0]?.description}"`);
  }, "excluir o gasto dividido");
  const toggleSelect = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const applyBulk = async () => {
    setBulkSaving(true);
    try {
      await bulkUpdateCategory(selected, bulkCategory);
      setSelected([]); setSelectMode(false);
      await refresh();
    } catch (e) {
      alert(`Não foi possível alterar a categoria em massa. ${friendlyError(e)}`);
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
  const invoiceCardIdsForMonths = [...new Set([...invoiceScopedExpenses.map((e) => e.card_id).filter(Boolean), ...myCards.map((c) => c.id)])];
  const invoiceNow = openInvoiceMonth(myCards);
  const invoiceMonthsList = invoiceMonths(invoiceScopedExpenses, invoiceCardIdsForMonths, invoiceNow).filter((mk) => /^\d{4}-\d{2}$/.test(mk));
  const invoiceLineItems = invoiceScopedExpenses
    .filter((e) => (filterCard === "all" || e.card_id === filterCard) && isDueIn(e, selectedMonth) && !isRemovedForMonth(e, selectedMonth, expenseOverridesMap))
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
  const invoiceTotal = invoiceLineItems.reduce((s, e) => s + monthlyValue(e, selectedMonth, expenseOverridesMap), 0);
  const invoiceSingleCard = filterCard !== "all" ? invoiceCards.find((c) => c.id === filterCard) : null;
  const displayCard = invoiceSingleCard || invoiceCards[0] || myCards[0] || null;
  const invoiceStatus = displayCard ? invoiceStatusInfo(displayCard, selectedMonth) : null;
  const invoicePaidTotal = displayCard ? paidForInvoice(data.invoicePayments, displayCard.id, selectedMonth) : 0;
  const paymentStatus = displayCard ? invoicePaymentStatus(displayCard, selectedMonth, invoiceTotal, invoicePaidTotal) : null;
  const [showPayModal, setShowPayModal] = useState(false);
  const [showPayPicker, setShowPayPicker] = useState(false);
  const [payTargetCard, setPayTargetCard] = useState(null);
  const payCard = invoiceSingleCard || payTargetCard;
  const payCardTotal = payCard ? invoiceScopedExpenses.filter((e) => e.card_id === payCard.id && isDueIn(e, selectedMonth)).reduce((s, e) => s + monthlyValue(e), 0) : 0;
  const payCardPaidTotal = payCard ? paidForInvoice(data.invoicePayments, payCard.id, selectedMonth) : 0;
  const handlePayInvoice = guardedHandler(async (amount) => {
    await saveInvoicePayment({ cardId: payCard.id, monthKey: selectedMonth, amount, paidAt: new Date().toISOString().slice(0, 10), profileId: profile.id });
    await logActivity(profile.id, "pagou", `Registrou pagamento de ${brl(amount)} na fatura de ${monthLabel(selectedMonth)} (${payCard.name})`);
    await refresh();
  }, "registrar o pagamento");

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
      {isAdmin && data.deletedExpenses.length > 0 && (
        <button onClick={() => setShowTrash(true)} className="flex items-center gap-1.5 text-xs mb-3 -mt-2" style={{ color: C.muted }}>
          <Trash2 size={12} /> Lixeira ({data.deletedExpenses.length})
        </button>
      )}
      {showTrash && (
        <TrashModal deletedExpenses={data.deletedExpenses} cardName={cardName} personName={personName}
          onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} onClose={() => setShowTrash(false)} />
      )}

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
        <AdminCards data={data} refresh={refresh} embedded profile={profile} />
      ) : (
        <>
      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <Field label="Pessoa">
              <Select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
                <option value="all">Todas</option>
                {sortByName(data.profiles).map((u) => <option key={u.id} value={u.id}>{firstName(u.name)}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex-1 min-w-0">
            <Field label="Cartão">
              <Select value={filterCard} onChange={(e) => setFilterCard(e.target.value)}>
                <option value="all">Todos</option>
                {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (arquivado)" : ""}</option>)}
              </Select>
            </Field>
          </div>
        </div>
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
                  onEdit={(e) => { setEditing(e); setShowForm(true); }} onDelete={handleDelete} />
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
                  const status = displayCard ? invoiceStatusInfo(displayCard, mk) : null;
                  const tone = status?.tone === "green" ? C.green : status?.tone === "amber" ? C.amber : C.muted;
                  return (
                    <button key={mk} ref={(el) => { monthRefs.current[mk] = el; }} onClick={() => setSelectedMonth(mk)} className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all capitalize"
                      style={{ background: active ? C.gold : "transparent", color: active ? "var(--gold-contrast)" : tone, border: `1px solid ${active ? C.gold : C.border}` }}>
                      {monthLabel(mk)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl p-5 mb-4 relative overflow-hidden" style={{ background: HERO_GRADIENT, boxShadow: "0 14px 34px rgba(0,0,0,0.35)" }}>
              <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
              <div className="relative flex items-start justify-between gap-3 flex-wrap">
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
              <div className="relative flex items-center justify-between gap-3 mt-3 flex-wrap">
                {displayCard ? (
                  <p className="text-xs" style={{ color: "var(--gold-contrast)", opacity: 0.85 }}>
                    {invoiceStatus.label === "aberta" ? "Fecha" : invoiceStatus.label === "futura" ? "Fecha" : "Fechou"} dia {displayCard.closing_day} · vence dia {displayCard.due_day}
                    {invoiceSingleCard && invoicePaidTotal > 0 && ` · ${brl(invoicePaidTotal)} pago${invoicePaidTotal < invoiceTotal ? ` de ${brl(invoiceTotal)}` : ""}`}
                  </p>
                ) : <span />}
                {isAdmin && (
                  <button onClick={() => (invoiceSingleCard ? setShowPayModal(true) : setShowPayPicker(true))}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-2 px-4 text-sm font-semibold shrink-0"
                    style={{ background: "rgba(255,255,255,0.14)", color: "var(--gold-contrast)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <DollarSign size={15} /> Pagar fatura
                  </button>
                )}
              </div>
            </div>

            {showPayPicker && (
              <ChoosePayCardModal cards={invoiceCards.length ? invoiceCards : myCards} monthKey={selectedMonth} expenses={invoiceScopedExpenses} payments={data.invoicePayments}
                onChoose={(c) => { setPayTargetCard(c); setShowPayPicker(false); setShowPayModal(true); }} onClose={() => setShowPayPicker(false)} />
            )}
            {showPayModal && payCard && (
              <PayInvoiceModal card={payCard} monthKey={selectedMonth} invoiceTotal={payCardTotal} alreadyPaid={payCardPaidTotal}
                payments={(data.invoicePayments || []).filter((p) => p.card_id === payCard.id && p.month_key === selectedMonth)}
                onConfirm={handlePayInvoice}
                onUpdatePayment={guardedHandler(async (id, amount) => { await updateInvoicePayment(id, amount); await refresh(); }, "atualizar o pagamento")}
                onDeletePayment={guardedHandler(async (p) => { if (!window.confirm("Excluir esse pagamento registrado?")) return; await deleteInvoicePayment(p); await refresh(); }, "excluir o pagamento")}
                onClose={() => { setShowPayModal(false); setPayTargetCard(null); }} />
            )}
            {overrideTarget && (
              <MonthOverrideModal exp={overrideTarget} monthKey={selectedMonth}
                currentAmount={monthlyValue(overrideTarget, selectedMonth, expenseOverridesMap)}
                hasOverride={expenseOverridesMap.has(`${overrideTarget.id}|${selectedMonth}`)}
                onSave={(amount) => handleSaveOverride(selectedMonth, amount)}
                onRemove={() => handleRemoveOverride(selectedMonth)}
                onRemoveMonth={() => handleRemoveMonth(selectedMonth)}
                onClose={() => setOverrideTarget(null)} />
            )}
            {editScopeTarget && (
              <ScopeChoiceModal title="Editar gasto" monthLabelText={monthLabel(selectedMonth)}
                onThisMonth={() => { setOverrideTarget(editScopeTarget); setEditScopeTarget(null); }}
                onAll={() => { setEditing(editScopeTarget); setShowForm(true); setEditScopeTarget(null); }}
                onClose={() => setEditScopeTarget(null)} />
            )}
            {deleteScopeTarget && (
              <ScopeChoiceModal title="Excluir gasto" monthLabelText={monthLabel(selectedMonth)}
                onThisMonth={async () => {
                  await removeExpenseForMonth(deleteScopeTarget.id, selectedMonth);
                  await logActivity(profile.id, "ajustou", `Removeu "${deleteScopeTarget.description}" da fatura de ${monthLabel(selectedMonth)} (fica normal nos outros meses)`);
                  await refresh();
                  setDeleteScopeTarget(null);
                }}
                onAll={() => { handleDelete(deleteScopeTarget); setDeleteScopeTarget(null); }}
                onClose={() => setDeleteScopeTarget(null)} />
            )}
            {invoiceLineItems.length > 0 && invoiceSingleCard && (
              <>
                <p className="text-[11px] mb-2 -mt-2" style={{ color: C.muted }}>
                  {invoiceLineItems.filter((e) => reconciliationsMap.has(`${e.id}|${selectedMonth}`)).length} de {invoiceLineItems.length} conferidos com o extrato
                </p>
                {(() => {
                  const reconciledCount = invoiceLineItems.filter((e) => reconciliationsMap.has(`${e.id}|${selectedMonth}`)).length;
                  const daysToDue = Math.ceil((invoiceDueDate(selectedMonth, invoiceSingleCard.due_day) - new Date()) / 86400000);
                  const notPaid = paymentStatus?.label !== "fatura paga";
                  if (reconciledCount === 0 && notPaid && daysToDue <= 5 && daysToDue >= 0) {
                    return (
                      <div className="flex items-center gap-2 rounded-xl p-3 mb-3" style={{ background: "rgba(203,160,90,0.10)", border: `1px solid ${C.border}` }}>
                        <AlertTriangle size={14} color={C.amber} className="shrink-0" />
                        <p className="text-xs" style={{ color: C.muted }}>
                          Vence em {daysToDue === 0 ? "hoje" : `${daysToDue} dia${daysToDue > 1 ? "s" : ""}`} e nada foi conferido ainda — vale bater com o extrato antes de pagar.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}

            <Panel>
              {invoiceLineItems.length === 0 ? (
                <EmptyState icon={<ListChecks size={28} />} text="Nenhum gasto nesta fatura." />
              ) : (
                buildDisplayRows(invoiceLineItems, data.expenses).map((row) =>
                  row.isGroup ? (
                    <GroupedExpenseRow key={row.groupId} parts={row.parts} cardName={cardName(row.primary.card_id)} personName={personName} viewerProfileId={profile.id} showPerson={isAdmin} contextMonth={selectedMonth} reconciliations={reconciliationsMap}
                      onEdit={(e) => { setEditing(e); setShowForm(true); }} onDeleteGroup={handleDeleteGroup} onToggleReconciled={handleToggleReconciledGroup} />
                  ) : (
                    <ExpenseRow key={row.exp.id} exp={row.exp} cardName={cardName(row.exp.card_id)} personName={personName(row.exp.profile_id)} creatorName={row.exp.created_by ? personName(row.exp.created_by) : ""} resolveProfileName={personName} showPerson={isAdmin} contextMonth={selectedMonth} overrides={expenseOverridesMap} reconciliations={reconciliationsMap}
                      onEdit={handleEditClick} onDelete={handleDeleteClick} onToggleReconciled={handleToggleReconciled} onEditMonthOverride={(e) => setOverrideTarget(e)} />
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
          customCategories={data.customCategories} onAddCategory={guardedHandler(async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }, "adicionar a categoria")}
          onImportCSV={myCards.length > 0 ? () => { setShowForm(false); setShowImportCSV(true); } : null} />
      )}
      {showImportCSV && (
        <ImportCSVModal cards={myCards} userId={profile.id} onImport={handleSave} onClose={() => setShowImportCSV(false)} />
      )}
    </div>
  );
}

export function MemberOverview({ profile, data, refresh }) {
  const myCards = accessibleCards(data, profile.id);
  const now = openInvoiceMonth(myCards);
  const [showRecurringReview, setShowRecurringReview] = useState(false);
  const myExpenses = data.expenses.filter((e) => e.profile_id === profile.id);
  const myMonthTotal = myExpenses.filter((e) => isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e, now, overridesMap(data.expenseOverrides)), 0);
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
      <RecentReconciliationBanner expenses={data.expenses} reconciliations={data.reconciliations} profileId={profile.id} profiles={data.profiles} />
      <HeroPanel label="Total do mês" value={myMonthTotal} />
      <IncomeSection profile={profile} data={data} refresh={refresh} />
      <UpcomingBillsPanel cards={myCards.filter((c) => !c.archived)} expenses={data.expenses} />

      {myCards.filter((c) => !c.archived).length > 0 ? (
        <div className={`grid grid-cols-1 ${myCards.filter((c) => !c.archived).length > 1 ? "sm:grid-cols-2" : ""} gap-3`}>
          {myCards.filter((c) => !c.archived).map((c) => {
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

export function AdminOverview({ profile, data, refresh }) {
  const now = openInvoiceMonth(data.cards);
  const prevMonth = addMonthsToKey(now, -1);
  const [scopeIds, setScopeIds] = useState([]);
  const [showRecurringReview, setShowRecurringReview] = useState(false);
  const scopeActive = scopeIds.length > 0;
  const scopedExpenses = useMemo(() => data.expenses.filter((e) => isDueIn(e, now) && (!scopeActive || scopeIds.includes(e.profile_id))), [data.expenses, now, scopeActive, scopeIds]);
  const ovMap = useMemo(() => overridesMap(data.expenseOverrides), [data.expenseOverrides]);
  const totalMonth = scopedExpenses.reduce((s, e) => s + monthlyValue(e, now, ovMap), 0);
  const byPerson = useMemo(() => sortByName(data.profiles).map((u) => ({
    ...u,
    total: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e, now, ovMap), 0),
    prevTotal: data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, prevMonth)).reduce((s, e) => s + monthlyValue(e, prevMonth, ovMap), 0),
  })), [data.profiles, data.expenses, now, prevMonth, ovMap]);
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
        <RecentReconciliationBanner expenses={data.expenses} reconciliations={data.reconciliations} profileId={profile.id} profiles={data.profiles} />
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
        <UpcomingBillsPanel cards={data.cards.filter((c) => !c.archived)} expenses={data.expenses} />
        <h4 className="text-xs font-medium mb-1 tracking-wide uppercase" style={{ color: C.muted }}>Cartões</h4>
        <div className={`grid grid-cols-1 ${data.cards.filter((c) => !c.archived).length > 1 ? "sm:grid-cols-2" : ""} gap-3`}>
          {data.cards.filter((c) => !c.archived).map((c) => {
            const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
            return <CardWidget key={c.id} card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />;
          })}
          {data.cards.filter((c) => !c.archived).length === 0 && <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão cadastrado ainda." /></Panel>}
        </div>
      </div>
      {showRecurringReview && <RecurringReviewModal profile={profile} data={data} isAdmin refresh={refresh} onClose={() => setShowRecurringReview(false)} />}
    </div>
  );
}

/* ---------------------------------- ADMIN: CARDS ---------------------------------- */

export function AdminCards({ data, refresh, embedded, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const now = openInvoiceMonth(data.cards);

  const handleSave = async (card) => { await saveCard(card); await refresh(); };
  const handleDelete = guardedHandler(async (card) => { if (!window.confirm(`Excluir o cartão "${card.name}"? Isso também remove os gastos lançados nele.`)) return; await deleteCard(card); await refresh(); }, "excluir o cartão");
  const [syncSummary, setSyncSummary] = useState(null);
  const [quickAddTx, setQuickAddTx] = useState(null);
  const handleSync = async () => {
    setSyncing(true); setSyncError(""); setSyncSummary(null);
    try {
      await syncPluggyCards();
      const txResult = await syncPluggyTransactions();
      setSyncSummary(txResult?.summary || null);
      await refresh();
    }
    catch (e) { setSyncError(friendlyError(e)); }
    finally { setSyncing(false); }
  };
  const handleDismissTx = guardedHandler(async (tx) => { await dismissUnmatchedTransaction(tx.id); await refresh(); }, "dispensar a transação");
  const handleSaveFromTx = async (expArr) => {
    const arr = Array.isArray(expArr) ? expArr : [expArr];
    for (const e of arr) await saveExpense(e);
    await handleDismissTx(quickAddTx);
    setQuickAddTx(null);
    await refresh();
  };
  const handleApplyPluggy = guardedHandler(async (card) => {
    const updates = {};
    if (card.pluggy_close_date) updates.closing_day = new Date(card.pluggy_close_date + "T00:00:00").getDate();
    if (card.pluggy_due_date) updates.due_day = new Date(card.pluggy_due_date + "T00:00:00").getDate();
    if (card.pluggy_credit_limit != null) updates.card_limit = card.pluggy_credit_limit;
    await applyPluggyValues(card.id, updates);
    await refresh();
  }, "aplicar os dados do banco");

  const activeCards = data.cards.filter((c) => !c.archived);
  const totalLimit = activeCards.reduce((s, c) => s + c.card_limit, 0);
  const totalAvailable = activeCards.reduce((s, c) => {
    const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
    return s + Math.max(c.card_limit - used, 0);
  }, 0);
  const sortedCards = [...data.cards].sort((a, b) => (a.archived === b.archived ? 0 : a.archived ? 1 : -1));
  const anyLinked = data.cards.some((c) => c.pluggy_account_id);

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
      {anyLinked && (
        <button onClick={handleSync} disabled={syncing} className="w-full flex items-center justify-center gap-2 mt-2 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.bgSoft, border: `1px solid ${C.border}`, color: C.text }}>
          <BellRing size={14} color={C.gold} /> {syncing ? "Sincronizando..." : "Sincronizar com o banco (Open Finance)"}
        </button>
      )}
      {syncError && <p className="text-xs mt-2" style={{ color: C.rose }}>{syncError}</p>}
      {syncSummary && (
        <Panel className="mt-2">
          <h4 className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>Conferência automática</h4>
          <div className="space-y-1.5 text-xs">
            {syncSummary.map((s, i) => (
              <div key={i} style={{ color: C.text }}>
                <b>{s.nome}</b> <span style={{ color: C.muted }}>({s.tipo}):</span>{" "}
                {s.ok ? (
                  <>
                    <span style={{ color: C.green }}>{s.matched} conferido{s.matched === 1 ? "" : "s"} agora</span>
                    {s.ambiguous > 0 && <span style={{ color: C.amber }}> · {s.ambiguous} precisam de conferência manual</span>}
                    {s.unmatched > 0 && <span style={{ color: C.muted }}> · {s.unmatched} sem gasto lançado no app</span>}
                  </>
                ) : <span style={{ color: C.rose }}>erro — {typeof s.error === "string" ? s.error : JSON.stringify(s.error)}</span>}
              </div>
            ))}
          </div>
        </Panel>
      )}
      {data.unmatchedTransactions.length > 0 && (
        <Panel className="mt-2">
          <h4 className="text-[10px] uppercase tracking-wide mb-2" style={{ color: C.muted }}>
            Transações do banco sem gasto lançado ({data.unmatchedTransactions.length})
          </h4>
          <div className="space-y-2">
            {data.unmatchedTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="min-w-0">
                  <div className="text-sm truncate" style={{ color: C.text }}>{tx.description || "Sem descrição"}</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {formatShortDate(tx.transaction_date)} · {tx.card_id ? (data.cards.find((c) => c.id === tx.card_id)?.name || "cartão") : "Pix/dinheiro"} · {brl(tx.amount)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setQuickAddTx(tx)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ background: C.gold, color: "var(--gold-contrast)" }}>+ Adicionar</button>
                  <button onClick={() => handleDismissTx(tx)} className="text-xs" style={{ color: C.muted }}>Ignorar</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {quickAddTx && (
        <ExpenseForm
          cards={data.cards} userId={profile?.id} allProfiles={data.profiles} customCategories={data.customCategories}
          creatorId={profile?.id} canRefund={false}
          initial={{
            description: quickAddTx.description || "", total_amount: quickAddTx.amount, purchase_date: quickAddTx.transaction_date,
            card_id: quickAddTx.card_id, category: CATEGORIES[0], installments: 1,
          }}
          onSave={handleSaveFromTx} onClose={() => setQuickAddTx(null)}
        />
      )}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.cards.length === 0 && <Panel><EmptyState icon={<CreditCard size={28} />} text="Nenhum cartão cadastrado ainda." /></Panel>}
        {sortedCards.map((c) => {
          const used = netUsedForCard(data.expenses, data.invoicePayments, c.id, now);
          const names = data.profiles.filter((u) => c.memberIds.includes(u.id)).map((u) => firstName(u.name)).join(", ") || "ninguém ainda";
          const closeDiff = c.pluggy_close_date && new Date(c.pluggy_close_date + "T00:00:00").getDate() !== c.closing_day;
          const dueDiff = c.pluggy_due_date && new Date(c.pluggy_due_date + "T00:00:00").getDate() !== c.due_day;
          const limitDiff = c.pluggy_credit_limit != null && Math.abs(c.pluggy_credit_limit - c.card_limit) > 1;
          return (
            <div key={c.id} style={{ opacity: c.archived ? 0.55 : 1 }}>
              <CardWidget card={c} used={used} nextAmount={nextInvoiceProjection(c.id, data.expenses, now)} />
              <Panel className="mt-2 !py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] truncate flex items-center gap-1.5" style={{ color: C.muted }}>
                    acesso: {names}
                    {c.archived && <Chip tone="muted">arquivado</Chip>}
                  </span>
                  <div className="flex gap-3 shrink-0 ml-2">
                    <button onClick={() => { setEditing(c); setShowForm(true); }}><Pencil size={14} color={C.muted} /></button>
                    <button onClick={() => handleDelete(c)}><Trash2 size={14} color={C.rose} /></button>
                  </div>
                </div>
              </Panel>
              {c.pluggy_account_id && (
                <Panel className="mt-2 !py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: C.muted }}>Comparar com o banco</span>
                    {c.pluggy_synced_at && <span className="text-[10px]" style={{ color: C.muted }}>sync {formatShortDate(c.pluggy_synced_at.slice(0, 10))}</span>}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span style={{ color: C.muted }}>Fechamento</span>
                      <span style={{ color: closeDiff ? C.rose : C.text }}>
                        app: dia {c.closing_day} {c.pluggy_close_date && `· banco: dia ${new Date(c.pluggy_close_date + "T00:00:00").getDate()}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: C.muted }}>Vencimento</span>
                      <span style={{ color: dueDiff ? C.rose : C.text }}>
                        app: dia {c.due_day} {c.pluggy_due_date && `· banco: dia ${new Date(c.pluggy_due_date + "T00:00:00").getDate()}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: C.muted }}>Limite</span>
                      <span style={{ color: limitDiff ? C.rose : C.text }}>
                        app: {brl(c.card_limit)} {c.pluggy_credit_limit != null && `· banco: ${brl(c.pluggy_credit_limit)}`}
                      </span>
                    </div>
                    {c.pluggy_available_limit != null && (
                      <div className="flex items-center justify-between">
                        <span style={{ color: C.muted }}>Disponível (banco)</span>
                        <Amount value={c.pluggy_available_limit} size="text-xs" tone="green" />
                      </div>
                    )}
                  </div>
                  {(closeDiff || dueDiff || limitDiff) && (
                    <button onClick={() => handleApplyPluggy(c)} className="text-xs font-medium mt-2" style={{ color: C.gold }}>Usar valores do banco</button>
                  )}
                </Panel>
              )}
            </div>
          );
        })}
      </div>
      {showForm && <CardForm allProfiles={data.profiles} initial={editing} onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

export function ActivityLogScreen({ data, embedded }) {
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

export function ReportsScreen({ profile, data, refresh, isAdmin }) {
  const isDesktop = useIsDesktop();
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

  const scopeProfiles = useMemo(() => sortByName(isAdmin
    ? (selectedIds.length === 0 ? data.profiles : data.profiles.filter((p) => selectedIds.includes(p.id)))
    : data.profiles.filter((p) => p.id === profile.id)), [isAdmin, selectedIds, data.profiles, profile.id]);
  const scopeIds = useMemo(() => scopeProfiles.map((p) => p.id), [scopeProfiles]);

  const monthKeys = useMemo(() => monthKeysForPeriod(period, customRange, relevantCards), [period, customRange, relevantCards]);
  const byCategory = useMemo(() => categoryTotalsForMonths(data.expenses, monthKeys, scopeIds), [data.expenses, monthKeys, scopeIds]);
  const totalPeriod = byCategory.reduce((s, d) => s + d.value, 0);
  const comparison = useMemo(() => categoryComparison(data.expenses, now, compareMonth, scopeIds), [data.expenses, now, compareMonth, scopeIds]);
  const compareOptions = Array.from({ length: 12 }, (_, i) => addMonthsToKey(now, -(i + 1)));

  const months = last6Months();
  const last12Months = Array.from({ length: 12 }, (_, i) => addMonthsToKey(now, -i));
  const toggleCompareMonth = (mk) => setCompareMonths((prev) => {
    if (prev.includes(mk)) return prev.filter((x) => x !== mk);
    if (prev.length >= 3) return prev;
    return [...prev, mk].sort();
  });
  const compareCategoryRows = useMemo(() => {
    if (compareMonths.length < 2) return [];
    const scoped = data.expenses.filter((e) => scopeIds.includes(e.profile_id));
    const cats = new Set();
    compareMonths.forEach((mk) => allCategoryNames(scoped.filter((e) => isDueIn(e, mk))).forEach((c) => cats.add(c)));
    return Array.from(cats).map((cat) => ({
      cat,
      values: compareMonths.map((mk) => scoped.filter((e) => e.category === cat && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0)),
    })).filter((r) => r.values.some((v) => v > 0));
  }, [compareMonths, data.expenses, scopeIds]);
  const evolution = useMemo(() => months.map((mk) => {
    const row = { month: monthLabel(mk) };
    scopeProfiles.forEach((u) => { row[firstName(u.name)] = data.expenses.filter((e) => e.profile_id === u.id && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return row;
  }), [months, scopeProfiles, data.expenses]);

  const scopeInvestments = useMemo(() => (data.investments || []).filter((inv) => scopeIds.includes(inv.created_by) || scopeIds.some((id) => inv.memberIds.includes(id))), [data.investments, scopeIds]);
  const wealthEvolution = useMemo(() => months.map((mk) => {
    const total = scopeInvestments.reduce((s, inv) => s + investmentBalanceUpTo(inv.id, data.investmentTransactions || [], mk), 0);
    return { month: monthLabel(mk), total };
  }), [months, scopeInvestments, data.investmentTransactions]);
  const hasInvestments = scopeInvestments.length > 0;

  const yearMonthKeys = (y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  const yearTotals = (y) => {
    const mks = yearMonthKeys(y);
    const expense = mks.reduce((s, mk) => s + scopeIds.reduce((s2, pid) => s2 + data.expenses.filter((e) => e.profile_id === pid && isDueIn(e, mk)).reduce((s3, e) => s3 + monthlyValue(e), 0), 0), 0);
    const income = mks.reduce((s, mk) => s + scopeIds.reduce((s2, pid) => s2 + (data.incomes || []).filter((i) => i.profile_id === pid && isIncomeDueIn(i, mk)).reduce((s3, i) => s3 + incomeMonthlyValue(i), 0), 0), 0);
    return { expense, income, saldo: income - expense };
  };
  const currentYearTotals = useMemo(() => yearTotals(summaryYear), [summaryYear, scopeIds, data.expenses, data.incomes]);
  const prevYearTotals = useMemo(() => yearTotals(summaryYear - 1), [summaryYear, scopeIds, data.expenses, data.incomes]);
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
          {sortByName(data.profiles).map((p) => {
            const active = selectedIds.includes(p.id);
            const personTotal = categoryTotalsForMonths(data.expenses, monthKeys, [p.id]).reduce((s, d) => s + d.value, 0);
            return (
              <button key={p.id} onClick={() => setSelectedIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                className="text-left rounded-2xl p-4 transition-all" style={{ background: C.surface, border: `1px solid ${active ? C.gold : C.border}`, boxShadow: C.shadow }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar profile={p} size={24} />
                  <span className="text-[11px]" style={{ color: active ? C.gold : C.muted }}>{firstName(p.name)}</span>
                </div>
                <Amount value={personTotal} size="text-lg" />
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
        <button onClick={() => downloadCSV(toCSVAnnual(data.expenses, scopeIds, summaryYear), `resumo-anual-${summaryYear}.csv`)}
          className="flex items-center gap-1.5 text-xs font-medium mt-3" style={{ color: C.gold }}>
          <Download size={13} /> Exportar resumo anual por categoria (CSV)
        </button>
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
        <ResponsiveContainer width="100%" height={isDesktop ? 300 : 250}>
          <BarChart data={evolution} barGap={isDesktop ? 4 : 6} barCategoryGap={isDesktop ? "18%" : "30%"}>
            <XAxis dataKey="month" stroke={C.muted} fontSize={isDesktop ? 12 : 10} axisLine={false} tickLine={false} interval={0} />
            <YAxis stroke={C.muted} fontSize={12} axisLine={false} tickLine={false} tickFormatter={compactNumber} width={42} />
            <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10 }} labelStyle={{ color: C.text }} itemStyle={{ color: C.text }} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
            {scopeProfiles.map((u, i) => (
              <Bar key={u.id} dataKey={firstName(u.name)} radius={[6, 6, 0, 0]} fill={personColorFor(u.name, i)} maxBarSize={isDesktop ? 40 : 16}>
                <LabelList dataKey={firstName(u.name)} position="top" formatter={(v) => (v > 0 ? compactNumber(v) : "")} fontSize={isDesktop ? 12 : 8} fill={C.muted} />
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
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {last12Months.map((mk) => {
            const active = compareMonths.includes(mk);
            return (
              <button key={mk} onClick={() => toggleCompareMonth(mk)} className="px-2 py-2 rounded-lg text-xs font-medium capitalize transition-all"
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
          <>
            {/* Celular: um card por categoria, mês/valor bem separados */}
            <div className="sm:hidden space-y-3">
              {compareCategoryRows.map((r) => (
                <div key={r.cat} className="rounded-xl p-3" style={{ background: C.bgSoft, border: `1px solid ${C.border}` }}>
                  <div className="text-sm font-medium mb-2" style={{ color: C.text }}>{r.cat}</div>
                  <div className="space-y-1.5">
                    {compareMonths.map((mk, i) => (
                      <div key={mk} className="flex items-center justify-between">
                        <span className="text-xs capitalize" style={{ color: C.muted }}>{monthLabel(mk)}</span>
                        <Amount value={r.values[i]} size="text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Telas maiores: tabela */}
            <div className="hidden sm:block overflow-x-auto">
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
          </>
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

export function MemberApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = usePersistentTab("tab-member", "overview");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickIncome, setShowQuickIncome] = useState(false);
  const myCards = accessibleCards(data, profile.id);
  useBillAlerts(myCards, data.expenses, data.invoicePayments);
  useBudgetAlerts(profile, data);
  useKeyboardShortcuts({
    onNewExpense: () => setShowQuickAdd(true),
    onNewIncome: () => setShowQuickIncome(true),
    onNavigate: (i) => setTab(["overview", "history", "reports", "investments"][i] || tab),
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
      <Sidebar profile={profile} tabs={tabs} tab={tab} setTab={setTab} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} data={data} refresh={refresh} onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
      <div className="lg:flex-1 lg:min-w-0">
        <div className="lg:hidden"><TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} data={data} refresh={refresh} /></div>
        {tab === "overview" && <MemberOverview profile={profile} data={data} refresh={refresh} />}
        {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
        {tab === "reports" && <ReportsScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
        {tab === "investments" && <InvestmentsScreen profile={profile} data={data} refresh={refresh} isAdmin={false} />}
        <FloatingAddButton onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
        {showQuickAdd && <ExpenseForm cards={myCards} userId={profile.id} onSave={handleQuickSave} onClose={() => setShowQuickAdd(false)} allProfiles={data.profiles} creatorId={profile.id} expenses={data.expenses}
          customCategories={data.customCategories} onAddCategory={guardedHandler(async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }, "adicionar a categoria")} />}
        {showQuickIncome && <IncomeForm profileId={profile.id} onSave={handleQuickIncomeSave} onClose={() => setShowQuickIncome(false)} />}
        <div className="lg:hidden"><BottomNav tabs={tabs} tab={tab} setTab={setTab} /></div>
      </div>
    </div>
  );
}

export function AdminApp({ profile, data, refresh, onLogout, theme, onToggleTheme }) {
  const [tab, setTab] = usePersistentTab("tab-admin", "overview");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showQuickIncome, setShowQuickIncome] = useState(false);
  useBillAlerts(data.cards, data.expenses, data.invoicePayments);
  useBudgetAlerts(profile, data);
  useKeyboardShortcuts({
    onNewExpense: () => setShowQuickAdd(true),
    onNewIncome: () => setShowQuickIncome(true),
    onNavigate: (i) => setTab(["overview", "history", "reports", "investments"][i] || tab),
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
      <Sidebar profile={profile} tabs={tabs} tab={tab} setTab={setTab} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout} data={data} refresh={refresh} onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
      <div className="lg:flex-1 lg:min-w-0">
        <div className="lg:hidden"><TopBar profile={profile} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} data={data} refresh={refresh} /></div>
        {tab === "overview" && <AdminOverview profile={profile} data={data} refresh={refresh} />}
        {tab === "history" && <HistoryScreen profile={profile} data={data} refresh={refresh} isAdmin />}
        {tab === "reports" && <ReportsScreen profile={profile} data={data} refresh={refresh} isAdmin />}
        {tab === "investments" && <InvestmentsScreen profile={profile} data={data} refresh={refresh} isAdmin />}
        <FloatingAddButton onAddExpense={() => setShowQuickAdd(true)} onAddIncome={() => setShowQuickIncome(true)} />
        {showQuickAdd && <ExpenseForm cards={data.cards} userId={profile.id} onSave={handleQuickSave} onClose={() => setShowQuickAdd(false)} allProfiles={data.profiles} creatorId={profile.id} canRefund expenses={data.expenses}
          customCategories={data.customCategories} onAddCategory={guardedHandler(async (pid, name) => { await saveCustomCategory(pid, name); await refresh(); }, "adicionar a categoria")} />}
        {showQuickIncome && <IncomeForm profileId={profile.id} onSave={handleQuickIncomeSave} onClose={() => setShowQuickIncome(false)} />}
        <div className="lg:hidden"><BottomNav tabs={tabs} tab={tab} setTab={setTab} /></div>
      </div>
    </div>
  );
}