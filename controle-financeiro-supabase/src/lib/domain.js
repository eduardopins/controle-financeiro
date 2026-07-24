import { CATEGORIES, CAT_COLORS, MONTHS_PT, BANK_BRANDS, MIN_INVOICE_MONTH, FALLBACK_CAT_COLORS, PERSON_COLORS } from "./constants";



/* ---------------------------------- utils ---------------------------------- */

export const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const firstName = (n) => (n || "").split(" ")[0];
export function sortByName(list) {
  return [...list].sort((a, b) => firstName(a.name).localeCompare(firstName(b.name), "pt-BR"));
}
export const monthKeyFromDate = (dateStr) => dateStr.slice(0, 7);
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export function diffMonths(fromKey, toKey) {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
export function diffDays(dateA, dateB) {
  return Math.round((new Date(dateB + "T00:00:00") - new Date(dateA + "T00:00:00")) / 86400000);
}
export const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`; };
export function addMonthsToKey(key, n) {
  const [y, m] = key.split("-").map(Number);
  const total = (m - 1) + n;
  const normalized = ((total % 12) + 12) % 12;
  return `${y + Math.floor(total / 12)}-${String(normalized + 1).padStart(2, "0")}`;
}
export const last6Months = () => { const now = currentMonthKey(); return Array.from({ length: 6 }, (_, i) => addMonthsToKey(now, i - 5)); };

// "Mês de referência": como as compras do cartão feitas após o fechamento já caem na
// fatura seguinte, usamos o mês seguinte como o "mês corrente" nas telas de análise
// (Visão geral, Relatórios, Metas) — é a fatura que ainda está sendo formada/vai ser paga.
// "Mês de referência": como as compras do cartão feitas após o fechamento já caem na
// fatura seguinte, a "fatura atual" (a que ainda está aberta/sendo formada) pode já ser
// do mês seguinte ao calendário, dependendo do dia de fechamento de cada cartão.
// Usamos o fechamento mais adiantado entre os cartões (o que já "virou" primeiro) como
// referência única para as telas que somam vários cartões (e dinheiro) de uma vez.
export function openInvoiceMonth(cards, todayStr = new Date().toISOString().slice(0, 10)) {
  const withClosing = (cards || []).filter((c) => c.closing_day);
  if (withClosing.length === 0) return currentMonthKey();
  const earliestClosing = Math.min(...withClosing.map((c) => c.closing_day));
  return invoiceMonthForPurchase(todayStr, earliestClosing);
}

// Compras feitas depois do dia de fechamento do cartão caem na fatura do mês seguinte
// (o mês corrente já fechou); no dia do fechamento ou antes, ainda entram no mês atual.
export function invoiceMonthForPurchase(dateStr, closingDay) {
  const calendarMonth = monthKeyFromDate(dateStr);
  if (!closingDay) return calendarMonth;
  const day = parseInt(dateStr.split("-")[2], 10);
  return day > closingDay ? addMonthsToKey(calendarMonth, 1) : calendarMonth;
}

export function isDueIn(exp, monthKey) {
  const idx = diffMonths(exp.first_month, monthKey);
  if (exp.is_recurring) return idx >= 0;
  return idx >= 0 && idx < exp.installments;
}
export function monthlyValue(exp, monthKey, overrides) {
  if (monthKey && overrides) {
    const o = overrides.get(`${exp.id}|${monthKey}`);
    if (o) {
      if (o.removed) return 0;
      if (o.amount != null) return o.amount;
    }
  }
  return exp.is_recurring ? exp.total_amount : exp.total_amount / exp.installments;
}
export function overridesMap(list) {
  const m = new Map();
  (list || []).forEach((o) => m.set(`${o.expense_id}|${o.month_key}`, o));
  return m;
}
export function isRemovedForMonth(exp, monthKey, overrides) {
  if (!monthKey || !overrides) return false;
  const o = overrides.get(`${exp.id}|${monthKey}`);
  return !!(o && o.removed);
}
export function outstanding(exp, nowKey = currentMonthKey()) {
  if (exp.is_recurring) return isDueIn(exp, nowKey) ? exp.total_amount : 0;
  if (exp.is_refund) return exp.total_amount; // já é negativo — libera limite de verdade
  const done = Math.min(Math.max(diffMonths(exp.first_month, nowKey), 0), exp.installments);
  const monthly = exp.total_amount / exp.installments;
  return Math.max(exp.total_amount - done * monthly, 0);
}
export function billingInfo(card) {
  const now = new Date();
  const day = now.getDate();
  const closed = day > card.closing_day;
  let dueDate = new Date(now.getFullYear(), now.getMonth() + (day > card.due_day ? 1 : 0), card.due_day);
  const daysUntilDue = Math.ceil((dueDate - now) / 86400000);
  return { status: closed ? "fechada" : "aberta", daysUntilDue };
}
export function upcomingBills(cards, expenses, withinDays = 7) {
  const now = currentMonthKey();
  return cards.map((c) => {
    const { daysUntilDue } = billingInfo(c);
    const total = expenses.filter((e) => e.card_id === c.id && isDueIn(e, now)).reduce((s, e) => s + monthlyValue(e), 0);
    return { card: c, daysUntilDue, total };
  }).filter((b) => b.daysUntilDue <= withinDays && b.total > 0).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
export function toCSV(rows, cardName, personName) {
  const header = ["Data", "Descrição", "Categoria", "Pessoa", "Cartão", "Valor da parcela/mês", "Parcelas", "Recorrente"];
  const lines = rows.map((e) => [
    e.purchase_date, e.description, e.category, personName(e.profile_id), cardName(e.card_id),
    monthlyValue(e).toFixed(2), e.is_recurring ? "-" : `${e.installments}x`, e.is_recurring ? "sim" : "não",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
  return [header.join(";"), ...lines].join("\n");
}
export function toCSVAnnual(expenses, profileIds, year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const scoped = expenses.filter((e) => profileIds.includes(e.profile_id));
  const cats = [...new Set(scoped.map((e) => e.category))].sort();
  const monthTotal = (cat, mk) => scoped.filter((e) => e.category === cat && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0);
  const header = ["Categoria", ...months.map((mk) => monthLabel(mk)), "Total anual"];
  const rows = cats.map((cat) => {
    const values = months.map((mk) => monthTotal(cat, mk));
    return [cat, ...values.map((v) => v.toFixed(2)), values.reduce((s, v) => s + v, 0).toFixed(2)];
  });
  const totalRow = ["TOTAL", ...months.map((_, i) => rows.reduce((s, r) => s + parseFloat(r[i + 1]), 0).toFixed(2)), rows.reduce((s, r) => s + parseFloat(r[13]), 0).toFixed(2)];
  return [header, ...rows, totalRow].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
}
export function downloadCSV(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
export function isIncomeDueIn(inc, monthKey) {
  const idx = diffMonths(inc.first_month, monthKey);
  if (inc.is_recurring) return idx >= 0;
  return idx === 0;
}
export function nextInvoiceProjection(cardId, expenses, nowKey = currentMonthKey()) {
  const nextKey = addMonthsToKey(nowKey, 1);
  return expenses.filter((e) => e.card_id === cardId && isDueIn(e, nextKey)).reduce((s, e) => s + monthlyValue(e), 0);
}
export function categoryComparison(expenses, thisKey, prevKey, profileIds = null) {
  const scoped = profileIds ? expenses.filter((e) => profileIds.includes(e.profile_id)) : expenses;
  return allCategoryNames(scoped).map((cat) => {
    const current = scoped.filter((e) => e.category === cat && isDueIn(e, thisKey)).reduce((s, e) => s + monthlyValue(e), 0);
    const previous = scoped.filter((e) => e.category === cat && isDueIn(e, prevKey)).reduce((s, e) => s + monthlyValue(e), 0);
    return { category: cat, current, previous };
  }).filter((d) => d.current > 0 || d.previous > 0);
}
export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
export function detectBank(name) {
  const n = (name || "").toLowerCase();
  for (const key of Object.keys(BANK_BRANDS)) {
    if (n.includes(key)) return BANK_BRANDS[key];
  }
  return null;
}

export function anyCardAlert(cards, expenses, payments) {
  const now = currentMonthKey();
  return cards.some((c) => {
    const used = netUsedForCard(expenses, payments, c.id, now);
    const pct = c.card_limit ? (used / c.card_limit) * 100 : 0;
    const { daysUntilDue } = billingInfo(c);
    return pct >= 80 || daysUntilDue <= 5;
  });
}

export function accessibleCards(data, profileId) {
  return data.cards.filter((c) => c.memberIds.includes(profileId));
}

export function shade(hex, percent) {
  const f = parseInt(hex.slice(1), 16), t = percent < 0 ? 0 : 255, p = Math.abs(percent);
  const R = f >> 16, G = (f >> 8) & 0x00ff, B = f & 0x0000ff;
  return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

export function formatMoneyFromCents(cents) {
  const reais = Math.floor(cents / 100);
  const centsPart = (cents % 100).toString().padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${centsPart}`;
}
export function formatDateBR(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
export function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
export function pad2(n) { return String(n).padStart(2, "0"); }
export function periodPresetLabel(id) {
  return { month: "Este mês", last_month: "Mês passado", "3m": "Últimos 3 meses", "6m": "Últimos 6 meses", year: "Este ano", custom: "Personalizado" }[id];
}
export function paidForInvoice(payments, cardId, monthKey) {
  return (payments || []).filter((p) => p.card_id === cardId && p.month_key === monthKey).reduce((s, p) => s + p.amount, 0);
}
export function totalPaidForCard(payments, cardId, now) {
  return (payments || []).filter((p) => p.card_id === cardId && (!now || p.month_key >= now)).reduce((s, p) => s + p.amount, 0);
}
export function netUsedForCard(expenses, payments, cardId, now) {
  const used = expenses.filter((e) => e.card_id === cardId).reduce((s, e) => s + outstanding(e, now), 0);
  return Math.max(used - totalPaidForCard(payments, cardId, now), 0);
}
export function invoiceDueDate(monthKey, dueDay) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, dueDay);
}
export function invoicePaymentStatus(card, monthKey, invoiceTotal, paidTotal) {
  const fullyPaid = invoiceTotal > 0 && paidTotal >= invoiceTotal - 0.005;
  if (fullyPaid) return { label: "fatura paga", tone: "green" };
  const info = invoiceStatusInfo(card, monthKey);
  if (info.label === "futura") return { label: "fatura futura", tone: "muted" };
  if (info.label === "aberta") return { label: "fatura atual", tone: "gold" };
  return { label: "fatura vencida", tone: "rose" };
}
export function reconciliationMap(list) {
  const m = new Map();
  (list || []).forEach((r) => m.set(`${r.expense_id}|${r.month_key}`, r));
  return m;
}
export function reconciledInfo(exp, monthKey, recMap) {
  return recMap.get(`${exp.id}|${monthKey}`) || null;
}

export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export function buildDisplayRows(list, allExpenses) {
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

export function incomeMonthlyValue(inc) { return inc.amount; }

export function projectMonthEnd(expenses, profileIds, monthKey = currentMonthKey()) {
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

/* ---------------------------------- GOALS (individual, reusable) ---------------------------------- */

/* ---------------------------------- INVESTMENTS ---------------------------------- */

export function investmentBalance(investmentId, transactions) {
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
// Estima o rendimento acumulado desde cada aporte, aplicando a taxa mensal
// configurada. É uma estimativa (o app não recebe extrato real do banco).
export function estimatedYieldToDate(investmentId, transactions, monthlyRatePercent, nowKey = currentMonthKey()) {
  if (!monthlyRatePercent) return 0;
  const i = monthlyRatePercent / 100;
  let grown = 0, principal = 0;
  transactions.filter((t) => t.investment_id === investmentId).forEach((t) => {
    const sign = t.type === "deposit" ? 1 : -1;
    const startKey = monthKeyFromDate(t.transaction_date);
    if (t.is_recurring) {
      const occurrences = Math.max(diffMonths(startKey, nowKey) + 1, 0);
      for (let k = 0; k < occurrences; k++) {
        const occMonth = addMonthsToKey(startKey, k);
        const monthsGrown = diffMonths(occMonth, nowKey);
        grown += sign * t.amount * Math.pow(1 + i, monthsGrown);
        principal += sign * t.amount;
      }
    } else if (startKey <= nowKey) {
      const monthsGrown = diffMonths(startKey, nowKey);
      grown += sign * t.amount * Math.pow(1 + i, monthsGrown);
      principal += sign * t.amount;
    }
  });
  return grown - principal;
}
export function investmentBalanceUpTo(investmentId, transactions, monthKey) {
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
export function investmentMonthlyRate(inv, cdiAnnual) {
  if (!inv.cdi_percent || !cdiAnnual) return null;
  const annualEffective = (cdiAnnual / 100) * (inv.cdi_percent / 100);
  return (Math.pow(1 + annualEffective, 1 / 12) - 1) * 100;
}
export function invoiceMonths(expenses, cardIds, now) {
  const forward = Array.from({ length: 13 }, (_, i) => addMonthsToKey(now, i));
  const pastSet = new Set([addMonthsToKey(now, -1)]);
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
  const past = Array.from(pastSet).filter((mk) => mk >= MIN_INVOICE_MONTH).sort();
  return [...past, ...forward];
}
export function invoiceStatusInfo(card, monthKey) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentInvoiceMonth = invoiceMonthForPurchase(todayStr, card.closing_day);
  const diff = diffMonths(currentInvoiceMonth, monthKey);
  if (diff > 0) return { label: "futura", tone: "muted" };
  if (diff === 0) return { label: "aberta", tone: "green" };
  return { label: "fechada", tone: "muted" };
}
export function getCategoryColor(name) {
  if (CAT_COLORS[name]) return CAT_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_CAT_COLORS[hash % FALLBACK_CAT_COLORS.length];
}
export function allCategoryNames(expenses) {
  return Array.from(new Set([...CATEGORIES, ...expenses.map((e) => e.category)]));
}

export function parseBankCSV(text) {
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

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function drawSummaryCanvas({ heading, monthLabelStr, total, saldo, categories }) {
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
export async function shareSummaryImage(params) {
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

export function compactNumber(v) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `${Math.round(v)}`;
}
export function personColorFor(name, fallbackIndex) {
  return PERSON_COLORS[fallbackIndex % PERSON_COLORS.length];
}
export function monthKeysForPeriod(period, customRange, cards) {
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
export function categoryTotalsForMonths(expenses, monthKeys, profileIds = null) {
  const scoped = profileIds ? expenses.filter((e) => profileIds.includes(e.profile_id)) : expenses;
  return allCategoryNames(scoped).map((cat) => {
    let value = 0;
    monthKeys.forEach((mk) => { value += scoped.filter((e) => e.category === cat && isDueIn(e, mk)).reduce((s, e) => s + monthlyValue(e), 0); });
    return { name: cat, value };
  }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
}