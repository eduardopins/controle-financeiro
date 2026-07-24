import { supabase } from "./supabaseClient";
import { monthKeyFromDate } from "./domain";



/* ---------------------------------- data layer (Supabase) ---------------------------------- */

export async function loadAll() {
  const thirtyDaysAgoISO = new Date(Date.now() - 30 * 86400000).toISOString();
  const queries = [
    ["profiles", supabase.from("profiles").select("*")],
    ["cards", supabase.from("cards").select("*")],
    ["card_access", supabase.from("card_access").select("*")],
    // Antes: uma única consulta trazia TODOS os gastos, inclusive os excluídos há
    // anos (a tela só mostra a lixeira dos últimos 30 dias, então isso era
    // transferido à toa). Agora o filtro é feito no banco, não no navegador.
    ["expenses_active", supabase.from("expenses").select("*").is("deleted_at", null)],
    ["expenses_deleted_recent", supabase.from("expenses").select("*").not("deleted_at", "is", null).gte("deleted_at", thirtyDaysAgoISO)],
    ["budgets", supabase.from("budgets").select("*")],
    ["incomes", supabase.from("incomes").select("*")],
    ["custom_categories", supabase.from("custom_categories").select("*")],
    ["investments", supabase.from("investments").select("*")],
    ["investment_access", supabase.from("investment_access").select("*")],
    ["investment_transactions", supabase.from("investment_transactions").select("*")],
    ["activity_log", supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100)],
    ["invoice_payments", supabase.from("invoice_payments").select("*")],
    ["expense_overrides", supabase.from("expense_overrides").select("*")],
    ["expense_reconciliations", supabase.from("expense_reconciliations").select("*")],
    ["pluggy_unmatched_transactions", supabase.from("pluggy_unmatched_transactions").select("*").eq("dismissed", false).order("transaction_date", { ascending: false })],
  ];
  const results = await Promise.all(queries.map(([, p]) => p));
  const [profiles, cards, cardAccess, expensesActive, expensesDeletedRecent, budgets, incomes, customCategories, investments, investmentAccess, investmentTx, activityLog, invoicePayments, expenseOverrides, reconciliations, unmatchedTx] = results;

  // Antes esses erros eram ignorados (só .data era lido) — se uma consulta falhasse
  // (RLS, rede, etc.), a tela só ficava com dados vazios sem avisar ninguém. Agora
  // qualquer falha vira um erro real, que o chamador pode mostrar para o usuário.
  const failed = queries.map(([name], i) => [name, results[i].error]).filter(([, err]) => err);
  if (failed.length > 0) {
    console.error("loadAll: falha ao carregar", failed.map(([name]) => name).join(", "), failed);
    const err = new Error(`Não foi possível carregar: ${failed.map(([name]) => name).join(", ")}`);
    err.cause = failed[0][1];
    throw err;
  }

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
    expenses: expensesActive.data || [],
    deletedExpenses: expensesDeletedRecent.data || [],
    budgets: budgets.data || [],
    incomes: incomes.data || [],
    customCategories: customCategories.data || [],
    investments: investmentsWithAccess,
    investmentTransactions: investmentTx.data || [],
    activityLog: activityLog.data || [],
    invoicePayments: invoicePayments.data || [],
    expenseOverrides: expenseOverrides.data || [],
    reconciliations: reconciliations.data || [],
    unmatchedTransactions: unmatchedTx.data || [],
  };
}

export async function saveInvoicePayment(payment) {
  const { error } = await supabase.from("invoice_payments").insert({
    card_id: payment.cardId, month_key: payment.monthKey, amount: payment.amount,
    paid_at: payment.paidAt, profile_id: payment.profileId,
  });
  if (error) throw error;
}
export async function updateInvoicePayment(id, amount) {
  const { error } = await supabase.from("invoice_payments").update({ amount }).eq("id", id);
  if (error) throw error;
}
export async function deleteInvoicePayment(payment) {
  const { error } = await supabase.from("invoice_payments").delete().eq("id", payment.id);
  if (error) throw error;
}
export async function saveExpenseOverride(expenseId, monthKey, amount) {
  const { error } = await supabase.from("expense_overrides")
    .upsert({ expense_id: expenseId, month_key: monthKey, amount, removed: false }, { onConflict: "expense_id,month_key" });
  if (error) throw error;
}
export async function removeExpenseForMonth(expenseId, monthKey) {
  const { error } = await supabase.from("expense_overrides")
    .upsert({ expense_id: expenseId, month_key: monthKey, amount: null, removed: true }, { onConflict: "expense_id,month_key" });
  if (error) throw error;
}
export async function deleteExpenseOverride(expenseId, monthKey) {
  const { error } = await supabase.from("expense_overrides").delete().eq("expense_id", expenseId).eq("month_key", monthKey);
  if (error) throw error;
}

export async function syncPluggyCards() {
  const { data, error } = await supabase.functions.invoke("pluggy-sync-cards");
  if (error) throw error;
  return data;
}
export async function dismissUnmatchedTransaction(id) {
  const { error } = await supabase.from("pluggy_unmatched_transactions").update({ dismissed: true }).eq("id", id);
  if (error) throw error;
}
export async function syncPluggyTransactions() {
  const { data, error } = await supabase.functions.invoke("pluggy-sync-transactions");
  if (error) throw error;
  return data;
}
export async function applyPluggyValues(cardId, updates) {
  const { error } = await supabase.from("cards").update(updates).eq("id", cardId);
  if (error) throw error;
}

export async function saveCard(card) {
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
export async function deleteCard(card) {
  const { error } = await supabase.from("cards").delete().eq("id", card.id);
  if (error) throw error;
}
export async function uploadReceipt(file, profileId) {
  const path = `${profileId}/${Date.now()}_${file.name}`.replace(/\s+/g, "_");
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}
export async function uploadAvatar(file, profileId) {
  const path = `${profileId}/${Date.now()}_${file.name}`.replace(/\s+/g, "_");
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
export async function saveProfileAvatar(profileId, url) {
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profileId);
  if (error) throw error;
}
export async function logActivity(profileId, action, description) {
  try { await supabase.from("activity_log").insert({ profile_id: profileId, action, description }); } catch {}
}
export async function saveExpense(exp) {
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
export async function deleteExpense(exp) {
  const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", exp.id);
  if (error) throw error;
}
export async function restoreExpense(exp) {
  const { error } = await supabase.from("expenses").update({ deleted_at: null }).eq("id", exp.id);
  if (error) throw error;
}
export async function permanentlyDeleteExpense(exp) {
  const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
  if (error) throw error;
}
export async function setExpenseReconciled(expenseId, monthKey, profileId, value) {
  if (value) {
    const { error } = await supabase.from("expense_reconciliations")
      .upsert({ expense_id: expenseId, month_key: monthKey, reconciled_by: profileId, reconciled_at: new Date().toISOString() }, { onConflict: "expense_id,month_key" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("expense_reconciliations").delete().eq("expense_id", expenseId).eq("month_key", monthKey);
    if (error) throw error;
  }
}
export async function saveBudget(profileId, category, monthly_limit) {
  const { error } = await supabase.from("budgets").upsert({ profile_id: profileId, category, monthly_limit }, { onConflict: "profile_id,category" });
  if (error) throw error;
}
export async function deleteBudget(budgetId) {
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
}
export async function saveIncome(inc) {
  const payload = {
    profile_id: inc.profileId, description: inc.description, amount: inc.amount,
    income_date: inc.date, first_month: monthKeyFromDate(inc.date), is_recurring: inc.isRecurring,
  };
  const { error } = inc.id
    ? await supabase.from("incomes").update(payload).eq("id", inc.id)
    : await supabase.from("incomes").insert(payload);
  if (error) throw error;
}
export async function deleteIncome(inc) {
  const { error } = await supabase.from("incomes").delete().eq("id", inc.id);
  if (error) throw error;
}


export function loadTesseractScript() {
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
export async function extractReceiptData(file) {
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

export async function fetchCurrentCDI() {
  const res = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json");
  if (!res.ok) throw new Error("Falha ao consultar o Banco Central");
  const data = await res.json();
  const dailyRate = parseFloat(data[0]?.valor);
  if (isNaN(dailyRate)) throw new Error("Resposta inesperada do Banco Central");
  return (Math.pow(1 + dailyRate / 100, 252) - 1) * 100;
}

export async function saveCustomCategory(profileId, name) {
  const { error } = await supabase.from("custom_categories").insert({ profile_id: profileId, name });
  if (error) throw error;
}
export async function saveInvestment(inv) {
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
export async function deleteInvestment(inv) {
  const { error } = await supabase.from("investments").delete().eq("id", inv.id);
  if (error) throw error;
}
export async function saveInvestmentTransaction(tx) {
  const payload = { investment_id: tx.investmentId, profile_id: tx.profileId, type: tx.type, amount: tx.amount, transaction_date: tx.date, description: tx.description || null, receipt_url: tx.receiptUrl || null, is_recurring: tx.isRecurring || false };
  const { error } = await supabase.from("investment_transactions").insert(payload);
  if (error) throw error;
}
export async function deleteInvestmentTransaction(tx) {
  const { error } = await supabase.from("investment_transactions").delete().eq("id", tx.id);
  if (error) throw error;
}
export async function bulkUpdateCategory(ids, category) {
  const { error } = await supabase.from("expenses").update({ category }).in("id", ids);
  if (error) throw error;
}