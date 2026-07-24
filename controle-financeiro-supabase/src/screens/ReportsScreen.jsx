import React, { useState, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { ChevronRight, Download, TrendingUp, TrendingDown, PieChart as PieIcon, History } from "lucide-react";
import { C } from "../lib/constants";
import { brl, firstName, sortByName, monthLabel, addMonthsToKey, last6Months, openInvoiceMonth, isDueIn, monthlyValue, toCSVAnnual, downloadCSV, isIncomeDueIn, categoryComparison, accessibleCards, periodPresetLabel, incomeMonthlyValue, investmentBalanceUpTo, getCategoryColor, allCategoryNames, compactNumber, personColorFor, monthKeysForPeriod, categoryTotalsForMonths, formatShortDate } from "../lib/domain";
import { useIsDesktop } from "../hooks";
import { HeroPanel, Panel, Amount, ScreenHeader, EmptyState, Avatar, ReportTabs } from "../components/primitives";

// Só usada aqui dentro (na sub-aba "Atividade" dos Relatórios), por isso mora
// neste arquivo em vez de screens.jsx — evita um import circular de volta pra
// quem carrega este componente sob demanda.
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

export default function ReportsScreen({ profile, data, refresh, isAdmin }) {
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
                <Amount value={personTotal} size="text-lg" animate />
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
            <Amount value={currentYearTotals.income} size="text-base sm:text-sm" tone="green" animate />
          </div>
          <div className="rounded-xl px-3.5 py-3 flex items-center justify-between sm:block" style={{ background: C.bgSoft }}>
            <div className="text-[11px] sm:mb-1" style={{ color: C.muted }}>despesa</div>
            <Amount value={currentYearTotals.expense} size="text-base sm:text-sm" tone="rose" animate />
          </div>
          <div className="rounded-xl px-3.5 py-3 flex items-center justify-between sm:block" style={{ background: C.bgSoft }}>
            <div className="text-[11px] sm:mb-1" style={{ color: C.muted }}>saldo</div>
            <Amount value={currentYearTotals.saldo} size="text-base sm:text-sm" tone={currentYearTotals.saldo < 0 ? "rose" : "green"} animate />
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

