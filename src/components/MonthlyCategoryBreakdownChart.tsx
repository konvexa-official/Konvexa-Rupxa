import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { Expense } from '../types';
import { formatCurrency } from '../lib/formatters';
import { getCategoryIcon } from './Dashboard';
import {
  PieChart as PieIcon,
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  ArrowUpRight,
  Receipt,
  Plus,
} from 'lucide-react';

interface MonthlyCategoryBreakdownChartProps {
  expenses: Expense[];
  loading?: boolean;
  onOpenAddExpense?: () => void;
  onSelectCategory?: (category: string) => void;
}

// Curated domain palette aligned with Rupxa's gold, dark obsidian, and warm neutrals
export const CATEGORY_COLORS: Record<string, { fill: string; border: string; bg: string; text: string }> = {
  Food: {
    fill: '#D97706', // Warm Amber
    border: '#B45309',
    bg: 'rgba(217, 119, 6, 0.12)',
    text: '#D97706',
  },
  Shopping: {
    fill: '#B08D57', // Signature Rupxa Gold
    border: '#8E7040',
    bg: 'rgba(176, 141, 87, 0.15)',
    text: '#B08D57',
  },
  Travel: {
    fill: '#3B82F6', // Cobalt Blue
    border: '#2563EB',
    bg: 'rgba(59, 130, 246, 0.12)',
    text: '#3B82F6',
  },
  Bills: {
    fill: '#EF4444', // Crimson Red
    border: '#DC2626',
    bg: 'rgba(239, 68, 68, 0.12)',
    text: '#EF4444',
  },
  Entertainment: {
    fill: '#8B5CF6', // Royal Purple
    border: '#7C3AED',
    bg: 'rgba(139, 92, 246, 0.12)',
    text: '#8B5CF6',
  },
  Health: {
    fill: '#10B981', // Emerald
    border: '#059669',
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#10B981',
  },
  Education: {
    fill: '#06B6D4', // Cyan/Teal
    border: '#0891B2',
    bg: 'rgba(6, 182, 212, 0.12)',
    text: '#06B6D4',
  },
  Other: {
    fill: '#71717A', // Slate/Zinc
    border: '#52525B',
    bg: 'rgba(113, 113, 122, 0.12)',
    text: '#71717A',
  },
};

const FALLBACK_PALETTE = [
  { fill: '#F59E0B', border: '#D97706', bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B' },
  { fill: '#6366F1', border: '#4F46E5', bg: 'rgba(99, 102, 241, 0.12)', text: '#6366F1' },
  { fill: '#EC4899', border: '#DB2777', bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899' },
  { fill: '#14B8A6', border: '#0D9488', bg: 'rgba(20, 184, 166, 0.12)', text: '#14B8A6' },
];

export function getCategoryColor(category: string, index = 0) {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

interface CategoryAggregation {
  category: string;
  amount: number;
  count: number;
  percentage: number;
  average: number;
  highestExpense: { amount: number; description: string; date: string } | null;
  changeVsLastMonth?: {
    diff: number;
    pct: number;
    isIncrease: boolean;
  };
}

export const MonthlyCategoryBreakdownChart: React.FC<MonthlyCategoryBreakdownChartProps> = ({
  expenses,
  loading = false,
  onOpenAddExpense,
  onSelectCategory,
}) => {
  const { isDark } = useTheme();

  // Current active date context
  const now = useMemo(() => new Date(), []);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find all distinct months present in the expenses or create last 6 months
  const availableMonths = useMemo(() => {
    const monthKeysSet = new Set<string>();
    expenses.forEach((e) => {
      if (e.expense_date) {
        monthKeysSet.add(e.expense_date.substring(0, 7));
      }
    });

    // Ensure the last 6 months are always available in the selector
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeysSet.add(key);
    }

    const sorted = Array.from(monthKeysSet).sort().reverse();
    return sorted.map((key) => {
      const [y, m] = key.split('-').map(Number);
      const dateObj = new Date(y, m - 1, 1);
      const label = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const shortLabel = dateObj.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      return { key, label, shortLabel, year: y, monthIndex: m - 1 };
    });
  }, [expenses, now]);

  // Selected month state (defaults to current month)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);
  const [chartView, setChartView] = useState<'donut' | 'bars' | 'trend'>('donut');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Month navigation helpers
  const currentMonthIndex = availableMonths.findIndex((m) => m.key === selectedMonthKey);
  const hasNextMonth = currentMonthIndex > 0;
  const hasPrevMonth = currentMonthIndex < availableMonths.length - 1;

  const handlePrevMonth = () => {
    if (hasPrevMonth) {
      setSelectedMonthKey(availableMonths[currentMonthIndex + 1].key);
      setHoveredCategory(null);
    }
  };

  const handleNextMonth = () => {
    if (hasNextMonth) {
      setSelectedMonthKey(availableMonths[currentMonthIndex - 1].key);
      setHoveredCategory(null);
    }
  };

  // Selected month metadata
  const selectedMonthMeta = useMemo(() => {
    return (
      availableMonths.find((m) => m.key === selectedMonthKey) || {
        key: selectedMonthKey,
        label: selectedMonthKey,
        shortLabel: selectedMonthKey,
      }
    );
  }, [availableMonths, selectedMonthKey]);

  // Previous month key for MoM driver changes
  const prevMonthKey = useMemo(() => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonthKey]);

  // Aggregate current month & previous month data
  const {
    categoryAggregations,
    totalMonthlySpend,
    totalTransactions,
    topDrivers,
    rechartsDonutData,
    rechartsBarData,
    previousMonthTotal,
  } = useMemo(() => {
    const currentMonthExpenses = expenses.filter(
      (e) => e.expense_date && e.expense_date.startsWith(selectedMonthKey)
    );
    const prevMonthExpenses = expenses.filter(
      (e) => e.expense_date && e.expense_date.startsWith(prevMonthKey)
    );

    const prevCategoryTotals: Record<string, number> = {};
    let prevTotal = 0;
    prevMonthExpenses.forEach((e) => {
      const cat = e.category === 'Other' && e.custom_category ? e.custom_category : e.category;
      prevCategoryTotals[cat] = (prevCategoryTotals[cat] || 0) + e.amount;
      prevTotal += e.amount;
    });

    const categoryMap: Record<
      string,
      {
        category: string;
        amount: number;
        count: number;
        highestExpense: { amount: number; description: string; date: string } | null;
      }
    > = {};

    let total = 0;

    currentMonthExpenses.forEach((e) => {
      const cat = e.category === 'Other' && e.custom_category ? e.custom_category : e.category;
      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          amount: 0,
          count: 0,
          highestExpense: null,
        };
      }

      categoryMap[cat].amount += e.amount;
      categoryMap[cat].count += 1;
      total += e.amount;

      if (!categoryMap[cat].highestExpense || e.amount > categoryMap[cat].highestExpense!.amount) {
        categoryMap[cat].highestExpense = {
          amount: e.amount,
          description: e.description || 'Transaction',
          date: e.expense_date,
        };
      }
    });

    // Convert map to list sorted by spending volume (highest first)
    const list: CategoryAggregation[] = Object.values(categoryMap)
      .map((item, idx) => {
        const pct = total > 0 ? (item.amount / total) * 100 : 0;
        const avg = item.count > 0 ? item.amount / item.count : 0;

        let changeVsLastMonth: CategoryAggregation['changeVsLastMonth'];
        const prevAmount = prevCategoryTotals[item.category];
        if (prevAmount !== undefined && prevAmount > 0) {
          const diff = item.amount - prevAmount;
          const changePct = Math.round((Math.abs(diff) / prevAmount) * 100);
          changeVsLastMonth = {
            diff,
            pct: changePct,
            isIncrease: diff > 0,
          };
        } else if (prevAmount === undefined && item.amount > 0) {
          changeVsLastMonth = {
            diff: item.amount,
            pct: 100,
            isIncrease: true,
          };
        }

        return {
          ...item,
          percentage: pct,
          average: avg,
          changeVsLastMonth,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // Top drivers: Top 3 (or up to 4 if tied)
    const drivers = list.slice(0, 3);

    // Data for Recharts Donut
    const donutData = list.map((item, idx) => ({
      name: item.category,
      value: item.amount,
      count: item.count,
      percentage: item.percentage,
      color: getCategoryColor(item.category, idx).fill,
    }));

    // Data for Recharts Bar Chart
    const barData = list.map((item, idx) => ({
      name: item.category,
      amount: item.amount,
      count: item.count,
      percentage: Math.round(item.percentage),
      color: getCategoryColor(item.category, idx).fill,
    }));

    return {
      categoryAggregations: list,
      totalMonthlySpend: total,
      totalTransactions: currentMonthExpenses.length,
      topDrivers: drivers,
      rechartsDonutData: donutData,
      rechartsBarData: barData,
      previousMonthTotal: prevTotal,
    };
  }, [expenses, selectedMonthKey, prevMonthKey]);

  // Multi-month category trajectory data for the last 6 months
  const multiMonthTrendData = useMemo(() => {
    const last6 = availableMonths.slice(0, 6).reverse();
    const topCategoryNames = Array.from(
      new Set(categoryAggregations.slice(0, 5).map((c) => c.category))
    );

    return last6.map((m) => {
      const monthExpenses = expenses.filter(
        (e) => e.expense_date && e.expense_date.startsWith(m.key)
      );

      const row: Record<string, any> = {
        month: m.shortLabel,
        fullLabel: m.label,
        key: m.key,
        total: 0,
      };

      monthExpenses.forEach((e) => {
        const cat = e.category === 'Other' && e.custom_category ? e.custom_category : e.category;
        row[cat] = (row[cat] || 0) + e.amount;
        row.total += e.amount;
      });

      return row;
    });
  }, [availableMonths, expenses, categoryAggregations]);

  // Focused category for details card (either hovered or the #1 top driver)
  const focusedCategory = useMemo(() => {
    if (hoveredCategory) {
      return categoryAggregations.find((c) => c.category === hoveredCategory) || null;
    }
    return topDrivers[0] || null;
  }, [hoveredCategory, categoryAggregations, topDrivers]);

  // Overall MoM comparison for the selected month
  const monthOverMonthDifference = useMemo(() => {
    if (previousMonthTotal === 0 && totalMonthlySpend === 0) return null;
    if (previousMonthTotal === 0 && totalMonthlySpend > 0) {
      return { diff: totalMonthlySpend, pct: 100, isIncrease: true };
    }
    const diff = totalMonthlySpend - previousMonthTotal;
    const pct = Math.abs(Math.round((diff / previousMonthTotal) * 100));
    return {
      diff,
      pct,
      isIncrease: diff > 0,
      isNeutral: diff === 0,
    };
  }, [totalMonthlySpend, previousMonthTotal]);

  if (loading) {
    return (
      <div
        id="monthly-category-breakdown-loading"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs animate-pulse space-y-4"
      >
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border)]">
          <div className="h-6 w-48 bg-[var(--surface-secondary)] rounded-lg" />
          <div className="h-8 w-36 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-44 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-44 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-44 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
        <div className="h-64 bg-[var(--surface-secondary)] rounded-xl" />
      </div>
    );
  }

  return (
    <div
      id="monthly-category-breakdown-container"
      className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3.5 sm:p-6 transition-colors shadow-xs space-y-4 sm:space-y-6"
    >
      {/* 1. Header with Month Navigator & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-1.5 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30">
              <PieIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h2
              className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Category Spending Breakdown
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1">
            Monthly distribution &amp; key drivers shaping your outflow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Month Stepper Selector */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
            <button
              id="category-chart-prev-month-btn"
              type="button"
              onClick={handlePrevMonth}
              disabled={!hasPrevMonth}
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="relative px-2">
              <select
                id="category-chart-month-select"
                value={selectedMonthKey}
                onChange={(e) => {
                  setSelectedMonthKey(e.target.value);
                  setHoveredCategory(null);
                }}
                className="bg-transparent text-xs font-semibold text-[var(--text-primary)] appearance-none cursor-pointer pr-4 focus:outline-none"
              >
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key} className="bg-[var(--surface)] text-[var(--text-primary)]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="category-chart-next-month-btn"
              type="button"
              onClick={handleNextMonth}
              disabled={!hasNextMonth}
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chart View Switcher */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
            <button
              type="button"
              id="view-donut-tab"
              onClick={() => setChartView('donut')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                chartView === 'donut'
                  ? 'bg-[var(--surface)] text-[#B08D57] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <PieIcon className="w-3 h-3" />
              <span className="hidden sm:inline">Donut</span>
            </button>
            <button
              type="button"
              id="view-bars-tab"
              onClick={() => setChartView('bars')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                chartView === 'bars'
                  ? 'bg-[var(--surface)] text-[#B08D57] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              <span className="hidden sm:inline">Ranked</span>
            </button>
            <button
              type="button"
              id="view-trend-tab"
              onClick={() => setChartView('trend')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                chartView === 'trend'
                  ? 'bg-[var(--surface)] text-[#B08D57] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Trajectory</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Expense Drivers Spotlight Strip */}
      {totalMonthlySpend > 0 && topDrivers.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B08D57]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Top Expense Drivers ({selectedMonthMeta.shortLabel})
              </span>
            </div>
            {monthOverMonthDifference && (
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 ${
                  monthOverMonthDifference.isIncrease
                    ? 'text-rose-500'
                    : monthOverMonthDifference.isNeutral
                    ? 'text-[var(--text-muted)]'
                    : 'text-emerald-500'
                }`}
              >
                {monthOverMonthDifference.isIncrease ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>
                  {monthOverMonthDifference.isIncrease ? '+' : '-'}
                  {monthOverMonthDifference.pct}% vs last month
                </span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topDrivers.map((driver, index) => {
              const Icon = getCategoryIcon(driver.category);
              const colors = getCategoryColor(driver.category, index);
              const isSelected = hoveredCategory === driver.category;

              return (
                <div
                  key={driver.category}
                  id={`top-driver-card-${index}`}
                  onMouseEnter={() => setHoveredCategory(driver.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => onSelectCategory && onSelectCategory(driver.category)}
                  className={`p-3 sm:p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'border-[#B08D57] bg-[var(--surface-secondary)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  {/* Subtle top color accent line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: colors.fill }}
                  />

                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="p-2 rounded-xl shrink-0 transition-transform hover:scale-105"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {driver.category}
                          </h4>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                              index === 0
                                ? 'bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]'
                            }`}
                          >
                            #{index + 1}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-normal truncate">
                          {driver.count} transaction{driver.count === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className="text-sm font-bold font-mono tracking-tight text-[var(--text-primary)] block"
                        style={{ fontFamily: 'Space Grotesk, monospace' }}
                      >
                        {formatCurrency(driver.amount)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#B08D57]">
                        {driver.percentage.toFixed(1)}% of total
                      </span>
                    </div>
                  </div>

                  {/* Progress bar contribution */}
                  <div className="w-full bg-[var(--surface)] rounded-full h-1.5 overflow-hidden mt-2.5 border border-[var(--border)]/50">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(driver.percentage, 100)}%`,
                        backgroundColor: colors.fill,
                      }}
                    />
                  </div>

                  {/* Driver insight note */}
                  <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                    {driver.changeVsLastMonth ? (
                      <span
                        className={`flex items-center gap-0.5 font-medium ${
                          driver.changeVsLastMonth.isIncrease ? 'text-amber-500' : 'text-emerald-500'
                        }`}
                      >
                        {driver.changeVsLastMonth.isIncrease ? '▲' : '▼'}{' '}
                        {driver.changeVsLastMonth.pct}% vs prior month
                      </span>
                    ) : (
                      <span>Avg {formatCurrency(driver.average)}/entry</span>
                    )}

                    <span className="text-[var(--text-muted)] hover:text-[#B08D57] inline-flex items-center gap-0.5">
                      Details <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 3. Main Recharts Visualization Stage */}
      {totalMonthlySpend > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
          {/* Chart Display Area (7 cols on large screens) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            {chartView === 'donut' && (
              <div className="w-full h-56 sm:h-72 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-xl text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: data.color }}
                                />
                                <span className="font-bold">{data.name}</span>
                              </div>
                              <p className="font-mono font-bold text-sm text-[#B08D57]">
                                {formatCurrency(data.value)}
                              </p>
                              <p className="text-[10px] text-[var(--text-secondary)]">
                                {data.percentage.toFixed(1)}% of {selectedMonthMeta.shortLabel} total ({data.count} items)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={rechartsDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(_, index) => {
                        setHoveredCategory(rechartsDonutData[index]?.name || null);
                      }}
                      onMouseLeave={() => setHoveredCategory(null)}
                      stroke={isDark ? '#151412' : '#FFFFFF'}
                      strokeWidth={2}
                    >
                      {rechartsDonutData.map((entry, index) => {
                        const isHovered = hoveredCategory === entry.name;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            opacity={hoveredCategory ? (isHovered ? 1 : 0.45) : 0.95}
                            className="transition-all duration-200 cursor-pointer"
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center of Donut Summary Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {hoveredCategory || 'Total Spend'}
                  </span>
                  <span
                    className="text-base sm:text-lg font-bold font-mono tracking-tight text-[var(--text-primary)]"
                    style={{ fontFamily: 'Space Grotesk, monospace' }}
                  >
                    {hoveredCategory
                      ? formatCurrency(
                          categoryAggregations.find((c) => c.category === hoveredCategory)?.amount || 0
                        )
                      : formatCurrency(totalMonthlySpend)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">
                    {hoveredCategory
                      ? `${(
                          ((categoryAggregations.find((c) => c.category === hoveredCategory)?.amount || 0) /
                            totalMonthlySpend) *
                          100
                        ).toFixed(1)}% share`
                      : `${totalTransactions} entries`}
                  </span>
                </div>
              </div>
            )}

            {chartView === 'bars' && (
              <div className="w-full h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rechartsBarData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke={isDark ? '#2A2926' : '#E5E1D8'}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(val) => `₹${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`}
                      tick={{ fill: isDark ? '#A6A29A' : '#6F5738', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#2A2926' : '#D8D2C7' }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      tick={{ fill: isDark ? '#F5F2EA' : '#0B0B0B', fontSize: 11, fontWeight: 500 }}
                      axisLine={{ stroke: isDark ? '#2A2926' : '#D8D2C7' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-xl text-xs space-y-1">
                              <span className="font-bold block">{data.name}</span>
                              <p className="font-mono font-bold text-sm text-[#B08D57]">
                                {formatCurrency(data.amount)}
                              </p>
                              <p className="text-[10px] text-[var(--text-secondary)]">
                                {data.percentage}% of month · {data.count} transaction{data.count === 1 ? '' : 's'}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      radius={[0, 6, 6, 0]}
                      onMouseEnter={(data) => setHoveredCategory(data?.name ?? null)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {rechartsBarData.map((entry, index) => (
                        <Cell
                          key={`bar-${index}`}
                          fill={entry.color}
                          opacity={hoveredCategory ? (hoveredCategory === entry.name ? 1 : 0.45) : 0.9}
                          className="cursor-pointer transition-all"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartView === 'trend' && (
              <div className="w-full h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={multiMonthTrendData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={isDark ? '#2A2926' : '#E5E1D8'}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: isDark ? '#A6A29A' : '#6F5738', fontSize: 11 }}
                      axisLine={{ stroke: isDark ? '#2A2926' : '#D8D2C7' }}
                    />
                    <YAxis
                      tickFormatter={(val) => `₹${val >= 1000 ? Math.round(val / 1000) + 'k' : val}`}
                      tick={{ fill: isDark ? '#A6A29A' : '#6F5738', fontSize: 10 }}
                      axisLine={{ stroke: isDark ? '#2A2926' : '#D8D2C7' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                          return (
                            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-xl text-xs space-y-1.5 max-w-xs">
                              <span className="font-bold text-xs block pb-1 border-b border-[var(--border)]">
                                {label} Spending
                              </span>
                              {payload.map((p: any) => (
                                <div key={p.name} className="flex items-center justify-between gap-3 text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    <span>{p.name}</span>
                                  </div>
                                  <span className="font-mono font-semibold">{formatCurrency(p.value)}</span>
                                </div>
                              ))}
                              <div className="pt-1 border-t border-[var(--border)] flex justify-between font-bold text-xs">
                                <span>Total</span>
                                <span className="font-mono text-[#B08D57]">{formatCurrency(total)}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {categoryAggregations.slice(0, 5).map((cat, idx) => (
                      <Bar
                        key={cat.category}
                        dataKey={cat.category}
                        stackId="a"
                        fill={getCategoryColor(cat.category, idx).fill}
                        radius={idx === 0 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Interactive Category Breakdown List (5 cols on large screens) */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                All Categories ({categoryAggregations.length})
              </span>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Contribution
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
              {categoryAggregations.map((item, idx) => {
                const Icon = getCategoryIcon(item.category);
                const colors = getCategoryColor(item.category, idx);
                const isHovered = hoveredCategory === item.category;

                return (
                  <div
                    key={item.category}
                    onMouseEnter={() => setHoveredCategory(item.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={() => onSelectCategory && onSelectCategory(item.category)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isHovered
                        ? 'border-[#B08D57] bg-[var(--surface-secondary)]'
                        : 'border-[var(--border)]/70 bg-[var(--surface-secondary)]/50 hover:bg-[var(--surface-secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="p-1.5 rounded-lg shrink-0"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[var(--text-primary)] block truncate">
                          {item.category}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)] block">
                          {item.count} item{item.count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className="text-xs font-bold font-mono text-[var(--text-primary)] block"
                        style={{ fontFamily: 'Space Grotesk, monospace' }}
                      >
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#B08D57]">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Focused / Active Category Detail Callout */}
            {focusedCategory && (
              <div className="mt-3 p-3 rounded-xl border border-[#B08D57]/30 bg-[#B08D57]/5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#B08D57] flex items-center gap-1">
                    <Receipt className="w-3 h-3" />
                    {focusedCategory.category} Highlights
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Average: {formatCurrency(focusedCategory.average)}
                  </span>
                </div>
                {focusedCategory.highestExpense && (
                  <p className="text-[11px] text-[var(--text-secondary)] font-normal">
                    Peak spend: <span className="font-semibold text-[var(--text-primary)]">{focusedCategory.highestExpense.description}</span> ({formatCurrency(focusedCategory.highestExpense.amount)})
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State for Selected Month */
        <div className="py-12 px-4 rounded-xl border border-dashed border-[var(--border)] text-center flex flex-col items-center justify-center space-y-3">
          <div className="p-3 rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
            <Calendar className="w-6 h-6 text-[#B08D57]" />
          </div>
          <div>
            <h4
              className="text-sm font-bold text-[var(--text-primary)]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              No expenses recorded in {selectedMonthMeta.label}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] font-normal max-w-sm mt-1">
              Add transactions or switch to another month to inspect your category spending distribution and expense drivers.
            </p>
          </div>
          {onOpenAddExpense && (
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Record Expense</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
