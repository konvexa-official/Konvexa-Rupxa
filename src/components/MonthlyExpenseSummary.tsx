import React, { useState, useMemo } from 'react';
import { Expense } from '../types';
import { formatCurrency } from '../lib/formatters';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
} from 'lucide-react';

interface MonthlyExpenseSummaryProps {
  expenses: Expense[];
  loading?: boolean;
}

interface MonthData {
  key: string; // 'YYYY-MM'
  year: number;
  monthIndex: number;
  shortName: string; // 'Apr'
  fullName: string; // 'April 2026'
  isCurrentMonth: boolean;
  total: number;
  count: number;
  categories: Record<string, number>;
  topCategory: { name: string; amount: number; percentage: number } | null;
}

/**
 * Calculates a round, human-friendly ceiling for the chart y-axis.
 */
function getNiceCeiling(max: number): number {
  if (max <= 0) return 10000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const factor = max / magnitude;
  let niceFactor = 1;
  if (factor <= 1) niceFactor = 1;
  else if (factor <= 2) niceFactor = 2;
  else if (factor <= 2.5) niceFactor = 2.5;
  else if (factor <= 5) niceFactor = 5;
  else niceFactor = 10;
  return niceFactor * magnitude;
}

/**
 * Format compact currency for chart axis ticks (e.g. ₹10K, ₹1.5L)
 */
function formatCompactCurrency(val: number): string {
  if (val === 0) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${Math.round(val / 1000)}k`;
  return `₹${Math.round(val)}`;
}

export const MonthlyExpenseSummary: React.FC<MonthlyExpenseSummaryProps> = ({
  expenses,
  loading = false,
}) => {
  // Compute the 6-month window (from 5 months ago to current month)
  const { monthsData, totalSixMonths, averageMonthly, peakMonth, momTrend } = useMemo<{
    monthsData: MonthData[];
    totalSixMonths: number;
    averageMonthly: number;
    peakMonth: MonthData | null;
    momTrend: { percentage: number; isIncrease: boolean; isNeutral: boolean };
  }>(() => {
    const now = new Date();
    const months: MonthData[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const shortName = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      months.push({
        key,
        year,
        monthIndex,
        shortName,
        fullName,
        isCurrentMonth: i === 0,
        total: 0,
        count: 0,
        categories: {},
        topCategory: null,
      });
    }

    // Populate with real expenses
    expenses.forEach((expense) => {
      if (!expense.expense_date) return;
      const dateKey = expense.expense_date.substring(0, 7);
      const targetMonth = months.find((m) => m.key === dateKey);
      if (targetMonth) {
        targetMonth.total += expense.amount;
        targetMonth.count += 1;
        const catKey =
          expense.category === 'Other' && expense.custom_category
            ? expense.custom_category
            : expense.category;
        targetMonth.categories[catKey] =
          (targetMonth.categories[catKey] || 0) + expense.amount;
      }
    });

    // Compute top category for each month
    months.forEach((m) => {
      let topCatName = '';
      let topCatAmount = 0;
      Object.entries(m.categories).forEach(([cat, amt]) => {
        if (amt > topCatAmount) {
          topCatAmount = amt;
          topCatName = cat;
        }
      });
      if (topCatName) {
        m.topCategory = {
          name: topCatName,
          amount: topCatAmount,
          percentage: m.total > 0 ? Math.round((topCatAmount / m.total) * 100) : 0,
        };
      }
    });

    // Aggregates
    const totalSixMonths = months.reduce((sum, m) => sum + m.total, 0);
    const averageMonthly = Math.round(totalSixMonths / 6);

    let peakMonth: MonthData | null = null;
    months.forEach((m) => {
      if (!peakMonth || m.total > peakMonth.total) {
        peakMonth = m;
      }
    });

    // MoM trend: current month vs previous month
    const curMonth = months[5];
    const prevMonth = months[4];
    let momTrend = { percentage: 0, isIncrease: false, isNeutral: true };

    if (prevMonth && prevMonth.total > 0 && curMonth) {
      const diff = curMonth.total - prevMonth.total;
      const pct = Math.abs(Math.round((diff / prevMonth.total) * 100));
      momTrend = {
        percentage: pct,
        isIncrease: diff > 0,
        isNeutral: diff === 0,
      };
    } else if (curMonth && curMonth.total > 0 && (!prevMonth || prevMonth.total === 0)) {
      momTrend = {
        percentage: 100,
        isIncrease: true,
        isNeutral: false,
      };
    }

    return {
      monthsData: months,
      totalSixMonths,
      averageMonthly,
      peakMonth,
      momTrend,
    };
  }, [expenses]);

  // Selected or hovered month for inspection
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Active month: selected key fallback to current month (last item)
  const activeMonth = useMemo(() => {
    if (selectedKey) {
      const found = monthsData.find((m) => m.key === selectedKey);
      if (found) return found;
    }
    return monthsData[monthsData.length - 1];
  }, [selectedKey, monthsData]);

  // Max value calculation for proportional bars
  const maxMonthValue = useMemo(() => {
    const maxVal = Math.max(...monthsData.map((m) => m.total), 0);
    return maxVal;
  }, [monthsData]);

  const yCeiling = useMemo(() => {
    return getNiceCeiling(maxMonthValue);
  }, [maxMonthValue]);

  // Grid tick ratios (1.0, 0.75, 0.5, 0.25, 0)
  const gridLevels = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div
      id="monthly-expense-summary-card"
      className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-6 transition-colors shadow-xs"
    >
      {/* Header and Summary Trends */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-5 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-1.5 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h2
              className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Monthly Expense Summary
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-medium mt-0.5 sm:mt-1">
            Total spending trajectory and categorical breakdown across the last 6 months
          </p>
        </div>

        {/* 6-Month Quick Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 6-Month Total */}
          <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
              6-Mo Total
            </span>
            <span className="text-sm font-bold font-mono text-[var(--text-primary)] mt-0.5 block truncate">
              {loading ? '—' : formatCurrency(totalSixMonths)}
            </span>
          </div>

          {/* Monthly Average */}
          <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
              Monthly Avg
            </span>
            <span className="text-sm font-bold font-mono text-[var(--text-primary)] mt-0.5 block truncate">
              {loading ? '—' : formatCurrency(averageMonthly)}
            </span>
          </div>

          {/* Highest Month */}
          <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
              Peak Month
            </span>
            <span className="text-sm font-bold font-mono text-[#B08D57] mt-0.5 block truncate">
              {loading ? '—' : peakMonth ? peakMonth.shortName : '—'}
            </span>
          </div>

          {/* MoM Trend */}
          <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
              MoM Trend
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {momTrend.isNeutral ? (
                <>
                  <Minus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">0%</span>
                </>
              ) : momTrend.isIncrease ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                    +{momTrend.percentage}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    -{momTrend.percentage}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="pt-10 sm:pt-12 pb-2">
        {loading ? (
          <div className="h-60 rounded-xl bg-[var(--surface-secondary)] animate-pulse flex items-center justify-center">
            <span className="text-xs font-medium text-[var(--text-muted)]">Loading trend data...</span>
          </div>
        ) : (
          <div className="relative">
            {/* Chart Grid & Bars Container */}
            <div className="h-60 sm:h-64 flex gap-2 sm:gap-4">
              {/* Left Y-Axis Guides */}
              <div className="w-12 sm:w-16 h-48 flex flex-col justify-between items-end pr-2 select-none text-[10px] sm:text-[11px] font-mono font-medium text-[var(--text-secondary)]">
                {gridLevels.map((lvl) => (
                  <span key={lvl} className="leading-none">
                    {formatCompactCurrency(yCeiling * lvl)}
                  </span>
                ))}
              </div>

              {/* Chart Visual Grid & Columns */}
              <div className="flex-1 relative flex flex-col justify-end">
                {/* Horizontal reference grid lines */}
                <div className="absolute inset-0 h-48 pointer-events-none flex flex-col justify-between">
                  {gridLevels.map((lvl, index) => (
                    <div
                      key={lvl}
                      className={`w-full border-b ${
                        index === gridLevels.length - 1
                          ? 'border-[var(--border)]'
                          : 'border-[var(--border)]/50 border-dashed'
                      }`}
                    />
                  ))}
                </div>

                {/* Bar Columns Container */}
                <div className="relative z-10 h-48 flex items-end justify-between gap-2 sm:gap-4 px-1 sm:px-3">
                  {monthsData.map((m, index) => {
                    const isSelected = activeMonth?.key === m.key;
                    const isHovered = hoveredKey === m.key;
                    const isTooltipVisible = isHovered || (isSelected && hoveredKey === null);

                    const heightPercent =
                      yCeiling > 0 ? Math.min(100, (m.total / yCeiling) * 100) : 0;
                    const hasSpend = m.total > 0;

                    let tooltipAlignClass = 'left-1/2 -translate-x-1/2 origin-bottom';
                    let caretAlignClass = 'left-1/2 -translate-x-1/2';
                    if (index === 0) {
                      tooltipAlignClass = 'left-0 sm:left-1/2 sm:-translate-x-1/2 origin-bottom-left sm:origin-bottom';
                      caretAlignClass = 'left-5 sm:left-1/2 sm:-translate-x-1/2';
                    } else if (index === 1) {
                      tooltipAlignClass = 'left-[-12px] sm:left-1/2 sm:-translate-x-1/2 origin-bottom';
                      caretAlignClass = 'left-8 sm:left-1/2 sm:-translate-x-1/2';
                    } else if (index === monthsData.length - 2) {
                      tooltipAlignClass = 'right-[-12px] sm:left-1/2 sm:-translate-x-1/2 origin-bottom';
                      caretAlignClass = 'right-8 sm:right-auto sm:left-1/2 sm:-translate-x-1/2';
                    } else if (index === monthsData.length - 1) {
                      tooltipAlignClass = 'right-0 sm:left-1/2 sm:-translate-x-1/2 origin-bottom-right sm:origin-bottom';
                      caretAlignClass = 'right-5 sm:right-auto sm:left-1/2 sm:-translate-x-1/2';
                    }

                    return (
                      <div
                        key={m.key}
                        onClick={() => setSelectedKey(m.key)}
                        onMouseEnter={() => setHoveredKey(m.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        onFocus={() => {
                          setHoveredKey(m.key);
                          setSelectedKey(m.key);
                        }}
                        onBlur={() => setHoveredKey(null)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${m.fullName}: ${formatCurrency(m.total)}`}
                        className="group flex-1 h-full flex flex-col justify-end items-center cursor-pointer outline-none relative"
                      >
                        {/* Custom Rich Tooltip */}
                        <div
                          style={{
                            bottom: `calc(${Math.min(100, Math.max(10, heightPercent))}% + 14px)`,
                          }}
                          className={`absolute z-30 pointer-events-none transition-all duration-200 w-44 sm:w-52 rounded-xl p-3 border-2 border-[#B08D57] shadow-xl ${tooltipAlignClass} ${
                            isTooltipVisible
                              ? 'opacity-100 scale-100 translate-y-0 visible'
                              : 'opacity-0 scale-95 translate-y-1 invisible'
                          } bg-[var(--surface)] text-[var(--text-primary)]`}
                        >
                          <div className="absolute top-0 left-3 right-3 h-[2px] bg-[#B08D57] rounded-full" />

                          <div
                            className={`absolute -bottom-1.5 w-3 h-3 rotate-45 border-r border-b border-[#B08D57] bg-[var(--surface)] ${caretAlignClass}`}
                          />

                          <div className="relative z-10 flex flex-col gap-1.5 text-left">
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className="text-xs font-bold text-[var(--text-primary)] tracking-tight truncate"
                                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                              >
                                {m.fullName}
                              </span>
                              {m.isCurrentMonth && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30 leading-none shrink-0">
                                  Current
                                </span>
                              )}
                            </div>

                            <div className="pt-1 border-t border-[var(--border)]">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[9px] uppercase font-semibold tracking-wider text-[var(--text-secondary)]">
                                  Exact Spend
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                  {m.count} {m.count === 1 ? 'txn' : 'txns'}
                                </span>
                              </div>
                              <div className="text-sm sm:text-base font-bold font-mono text-[#B08D57] tracking-tight mt-0.5">
                                {formatCurrency(m.total)}
                              </div>
                            </div>

                            {m.total > 0 && m.topCategory ? (
                              <div className="text-[10px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border)] flex items-center justify-between gap-1 font-medium">
                                <span className="truncate">Top: <strong className="text-[var(--text-primary)] font-semibold">{m.topCategory.name}</strong></span>
                                <span className="font-mono text-[#B08D57] shrink-0 font-bold">
                                  {formatCurrency(m.topCategory.amount)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--text-muted)] italic pt-1 border-t border-[var(--border)]">
                                No expenses this month
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bar Track & Fill */}
                        <div
                          className={`w-full max-w-[48px] h-full flex flex-col justify-end items-center rounded-t-lg transition-colors p-1 ${
                            isSelected || isHovered
                              ? 'bg-[#B08D57]/20 ring-1 ring-[#B08D57]'
                              : 'hover:bg-[var(--surface-secondary)]'
                          }`}
                        >
                          {hasSpend ? (
                            <div
                              style={{ height: `${Math.max(6, heightPercent)}%` }}
                              className={`w-full rounded-t-md transition-all duration-300 relative ${
                                isSelected || isHovered
                                  ? 'bg-[#B08D57] ring-1 ring-[#B08D57]'
                                  : m.isCurrentMonth
                                  ? 'bg-[#B08D57]'
                                  : 'bg-[#B08D57]/70 group-hover:bg-[#B08D57]'
                              }`}
                            >
                              <div className="w-full h-1 bg-white/20 rounded-t-md" />
                            </div>
                          ) : (
                            <div className="w-full h-1.5 bg-[var(--border)] rounded-full my-0.5 group-hover:bg-[#B08D57]/60 transition-colors" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Month Labels */}
                <div className="flex items-center justify-between gap-2 sm:gap-4 px-1 sm:px-3 pt-3 border-t border-[var(--border)]">
                  {monthsData.map((m) => {
                    const isSelected = activeMonth?.key === m.key;
                    const isHovered = hoveredKey === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSelectedKey(m.key)}
                        onMouseEnter={() => setHoveredKey(m.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        className={`flex-1 text-center transition-colors py-1 rounded-lg ${
                          isSelected || isHovered
                            ? 'text-[#B08D57] font-bold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="block text-xs sm:text-sm font-semibold tracking-tight">
                          {m.shortName}
                        </span>
                        {m.isCurrentMonth ? (
                          <span className="inline-block text-[9px] font-semibold uppercase tracking-wider text-[#B08D57] mt-0.5">
                            Current
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] text-[var(--text-muted)] font-mono mt-0.5">
                            &apos;{String(m.year).slice(-2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Month Deep-Dive Panel */}
      {activeMonth && (
        <div
          id="active-month-breakdown"
          className="mt-4 pt-4 border-t border-[var(--border)] rounded-xl p-3.5 sm:p-4 bg-[var(--surface-secondary)] transition-colors"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B08D57]/15 border border-[#B08D57]/30 flex items-center justify-center text-[#B08D57] shrink-0 font-bold text-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {activeMonth.fullName}
                  </h3>
                  {activeMonth.isCurrentMonth && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  {activeMonth.count} transaction{activeMonth.count === 1 ? '' : 's'} recorded
                  {totalSixMonths > 0 && (
                    <>
                      {' · '}
                      <span className="font-mono font-semibold">
                        {Math.round((activeMonth.total / totalSixMonths) * 100)}% of 6-mo total
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-secondary)] block">
                Total Month Spent
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
                {formatCurrency(activeMonth.total)}
              </span>
            </div>
          </div>

          {activeMonth.total > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <span className="text-[var(--text-secondary)] font-medium">Top Spending Category:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {activeMonth.topCategory?.name} (
                  <span className="font-mono text-[#B08D57]">
                    {formatCurrency(activeMonth.topCategory?.amount)}
                  </span>
                  )
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                <span className="text-[var(--text-secondary)] font-medium">Avg per Transaction:</span>
                <span className="font-bold font-mono text-[var(--text-primary)]">
                  {formatCurrency(
                    activeMonth.count > 0 ? activeMonth.total / activeMonth.count : 0
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
