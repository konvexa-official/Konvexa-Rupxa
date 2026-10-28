import React from 'react';
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
      className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-6 transition-colors shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-5 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-1.5 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h2
              className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Monthly Category Budgets
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-medium mt-0.5 sm:mt-1">
            Current month spending limits and real-time threshold tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {hasExceeded && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{exceededCategories.length} Exceeded</span>
            </span>
          )}

          <button
            id="configure-budgets-btn"
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{categoriesWithBudgetCount > 0 ? 'Adjust Targets' : 'Set Budgets'}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-10 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--surface-secondary)] animate-pulse" />
          ))}
        </div>
      ) : categoriesWithBudgetCount === 0 ? (
        /* Empty State */
        <div className="py-10 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            No monthly category targets set
          </p>
          <p className="text-xs text-[var(--text-secondary)] font-medium max-w-sm mx-auto mt-1 mb-4">
            Set custom spending limits for categories like Food, Travel, or Bills. We&apos;ll subtly alert you if you exceed your target.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Define Category Targets</span>
          </button>
        </div>
      ) : (
        <div className="pt-5 space-y-5">
          {/* Top Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
                Total Budget
              </span>
              <span className="text-sm font-bold font-mono text-[var(--text-primary)] mt-0.5 block truncate">
                {formatCurrency(totalBudget)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
                Total Spent
              </span>
              <span className="text-sm font-bold font-mono text-[var(--text-primary)] mt-0.5 block truncate">
                {formatCurrency(totalSpentOnBudgeted)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
                Remaining Total
              </span>
              <span
                className={`text-sm font-bold font-mono mt-0.5 block truncate ${
                  totalSpentOnBudgeted > totalBudget ? 'text-red-500' : 'text-[#B08D57]'
                }`}
              >
                {totalSpentOnBudgeted > totalBudget
                  ? `-${formatCurrency(totalSpentOnBudgeted - totalBudget)}`
                  : formatCurrency(Math.max(0, totalBudget - totalSpentOnBudgeted))}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block">
                Overall Status
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasExceeded ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 truncate">
                      {exceededCategories.length} Over Limit
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
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
                      ? 'border-red-500/40 bg-red-500/5'
                      : isNear
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-[var(--border)] bg-[var(--surface-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          isOver
                            ? 'bg-red-500/15 text-red-500 border-red-500/30'
                            : isNear
                            ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                            : 'bg-[#B08D57]/15 text-[#B08D57] border-[#B08D57]/30'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOver ? (
                        <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-red-500" />
                          <span>Exceeded by {formatCurrency(item.exceeded_by)} ({item.percentage}%)</span>
                        </span>
                      ) : isNear ? (
                        <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Near Limit ({item.percentage}%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          {item.percentage}% used
                        </span>
                      )}

                      <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-primary)] font-bold">
                          {formatCurrency(item.spent_amount)}
                        </strong>{' '}
                        / {formatCurrency(item.limit_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Track */}
                  <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden relative">
                    <div
                      style={{ width: `${barPercent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? 'bg-red-500'
                          : isNear
                          ? 'bg-amber-500'
                          : 'bg-[#B08D57]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unbudgeted Active Spending Categories Info */}
          {unsetStatuses.length > 0 && (
            <div className="pt-2 text-xs flex flex-wrap items-center justify-between gap-2 text-[var(--text-secondary)] font-medium">
              <span>
                Other active categories this month without target:{' '}
                <span className="font-semibold text-[var(--text-primary)]">
                  {unsetStatuses.map((s) => `${s.category} (${formatCurrency(s.spent_amount)})`).join(', ')}
                </span>
              </span>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs font-semibold text-[#B08D57] hover:underline"
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
