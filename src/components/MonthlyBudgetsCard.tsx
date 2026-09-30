import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Expense } from '../types';
import { computeMonthlyBudgetStatuses } from '../lib/budgetHelpers';
import { formatCurrency } from '../lib/formatters';
import { getCategoryIcon } from './Dashboard';
import {
  Target,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Plus,
  TrendingUp,
} from 'lucide-react';

interface MonthlyBudgetsCardProps {
  expenses: Expense[];
  budgets: Record<string, number>;
  onOpenSettings: () => void;
  loading?: boolean;
}

export const MonthlyBudgetsCard: React.FC<MonthlyBudgetsCardProps> = ({
  expenses,
  budgets,
  onOpenSettings,
  loading = false,
}) => {
  const { isDark } = useTheme();

  const summary = computeMonthlyBudgetStatuses(expenses, budgets);
  const { statuses, totalBudget, hasExceeded, exceededCategories, categoriesWithBudgetCount } = summary;

  // Filter to show categories that either have a budget set OR have spending this month
  const activeBudgetStatuses = statuses.filter((s) => s.limit_amount > 0);
  const unsetStatuses = statuses.filter((s) => s.limit_amount === 0 && s.spent_amount > 0);

  const totalSpentOnBudgeted = activeBudgetStatuses.reduce((sum, s) => sum + s.spent_amount, 0);
  const overallPercentage = totalBudget > 0 ? Math.round((totalSpentOnBudgeted / totalBudget) * 100) : 0;

  return (
    <div
      id="monthly-category-budgets-card"
      className={`rounded-2xl border p-5 sm:p-6 transition-all ${
        isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E6DFC8] dark:border-[#2A2926]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40">
              <Target className="w-4 h-4 text-[#C59B27]" />
            </div>
            <h2
              className="text-lg font-black tracking-tight text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Monthly Category Budgets
            </h2>
          </div>
          <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            Current month spending limits and real-time threshold tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {hasExceeded && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FFF3DC] text-[#8C6B1F] dark:bg-amber-500/20 dark:text-amber-300 border border-[#D4AF37]">
              <span className="w-2 h-2 rounded-full bg-[#C59B27] animate-pulse" />
              <span>{exceededCategories.length} Exceeded</span>
            </span>
          )}

          <button
            id="configure-budgets-btn"
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
            <span>{categoriesWithBudgetCount > 0 ? 'Adjust Targets' : 'Set Budgets'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-10 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[#E6DFC8]/40 animate-pulse" />
          ))}
        </div>
      ) : categoriesWithBudgetCount === 0 ? (
        /* Empty State */
        <div className="py-10 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37]/15 text-[#C59B27] border border-[#D4AF37]/40 flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-black dark:text-white">
            No monthly category targets set
          </p>
          <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium max-w-sm mx-auto mt-1 mb-4">
            Set custom spending limits for categories like Food, Travel, or Bills. We&apos;ll subtly alert you if you exceed your target.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-sm transition-all border border-[#B38A22]/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Define Category Targets</span>
          </button>
        </div>
      ) : (
        <div className="pt-5 space-y-5">
          {/* Top Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] block">
                Total Budget
              </span>
              <span className="text-sm font-black font-mono text-black dark:text-white mt-0.5 block truncate">
                {formatCurrency(totalBudget)}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] block">
                Total Spent
              </span>
              <span className="text-sm font-black font-mono text-black dark:text-white mt-0.5 block truncate">
                {formatCurrency(totalSpentOnBudgeted)}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] block">
                Remaining Total
              </span>
              <span
                className={`text-sm font-black font-mono mt-0.5 block truncate ${
                  totalSpentOnBudgeted > totalBudget ? 'text-rose-600 dark:text-rose-400' : 'text-[#8C6B1F] dark:text-[#E6CA65]'
                }`}
              >
                {totalSpentOnBudgeted > totalBudget
                  ? `-${formatCurrency(totalSpentOnBudgeted - totalBudget)}`
                  : formatCurrency(Math.max(0, totalBudget - totalSpentOnBudgeted))}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] block">
                Overall Status
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasExceeded ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-[#C59B27] shrink-0" />
                    <span className="text-xs font-bold text-[#8C6B1F] dark:text-amber-400 truncate">
                      {exceededCategories.length} Over Limit
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">
                      {overallPercentage}% On Track
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Category Progress Bars */}
          <div className="space-y-3.5">
            {activeBudgetStatuses.map((item) => {
              const Icon = getCategoryIcon(item.category);
              const isOver = item.is_exceeded;
              const isNear = item.is_near_limit;
              const barPercent = Math.min(100, item.percentage);

              return (
                <div
                  key={item.category}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isOver
                      ? 'border-[#D4AF37] bg-[#FFFBF0] dark:bg-amber-950/20 shadow-xs'
                      : isDark
                      ? 'bg-[#151515] border-[#2A2926]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          isOver
                            ? 'bg-[#D4AF37]/20 text-[#8C6B1F] border-[#D4AF37]'
                            : 'bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border-[#D4AF37]/40'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-[#C59B27]" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-black dark:text-white truncate">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOver ? (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#FFF0D4] text-[#8C6B1F] dark:bg-amber-500/20 dark:text-amber-400 border border-[#D4AF37] flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-rose-600" />
                          <span>Exceeded by {formatCurrency(item.exceeded_by)} ({item.percentage}%)</span>
                        </span>
                      ) : isNear ? (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#FFF9EE] text-[#8C6B1F] dark:bg-yellow-500/20 dark:text-yellow-400 border border-[#D4AF37]/50">
                          Near Limit ({item.percentage}%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300">
                          {item.percentage}% used
                        </span>
                      )}

                      <span className="text-xs font-mono font-bold text-[#292524] dark:text-[#A6A29A]">
                        <strong className="text-black dark:text-white">
                          {formatCurrency(item.spent_amount)}
                        </strong>{' '}
                        / {formatCurrency(item.limit_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Track */}
                  <div className="w-full h-2 rounded-full bg-[#E6DFC8] dark:bg-[#201D19] overflow-hidden relative">
                    <div
                      style={{ width: `${barPercent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? 'bg-gradient-to-r from-[#DFB15B] via-[#C59B27] to-rose-600'
                          : isNear
                          ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27]'
                          : 'bg-gradient-to-r from-[#DFB15B] via-[#D4AF37] to-[#C59B27]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unbudgeted Active Spending Categories Info */}
          {unsetStatuses.length > 0 && (
            <div className="pt-2 text-xs flex flex-wrap items-center justify-between gap-2 text-[#292524] dark:text-[#A6A29A] font-medium">
              <span>
                Other active categories this month without target:{' '}
                <span className="font-bold text-black dark:text-white">
                  {unsetStatuses.map((s) => `${s.category} (${formatCurrency(s.spent_amount)})`).join(', ')}
                </span>
              </span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline"
              >
                + Set targets for these
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
