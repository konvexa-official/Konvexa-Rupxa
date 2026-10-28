import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Expense, SplitGroupSummary, ActiveTab } from '../types';
import { formatCurrency, formatDate } from '../lib/formatters';
import { MonthlyExpenseSummary } from './MonthlyExpenseSummary';
import { MonthlyBudgetsCard } from './MonthlyBudgetsCard';
import { MonthlyCategoryBreakdownChart } from './MonthlyCategoryBreakdownChart';
import { BudgetExceededBanner } from './BudgetExceededBanner';
import { SuggestedExpensesCard } from './SuggestedExpensesCard';
import { computeMonthlyBudgetStatuses } from '../lib/budgetHelpers';
import {
  Plus,
  ArrowRight,
  TrendingDown,
  Calendar,
  Layers,
  Users,
  Utensils,
  Plane,
  ShoppingBag,
  FileText,
  Film,
  HeartPulse,
  GraduationCap,
  CircleDollarSign,
} from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
  splits: SplitGroupSummary[];
  loading: boolean;
  onOpenAddExpense: () => void;
  onSelectExpense: (expense: Expense) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onSelectSplit?: (groupId: string) => void;
  budgets?: Record<string, number>;
  onOpenBudgetSettings?: () => void;
  onRefreshExpenses?: () => void;
}

export const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Food':
      return Utensils;
    case 'Travel':
      return Plane;
    case 'Shopping':
      return ShoppingBag;
    case 'Bills':
      return FileText;
    case 'Entertainment':
      return Film;
    case 'Health':
      return HeartPulse;
    case 'Education':
      return GraduationCap;
    default:
      return CircleDollarSign;
  }
};

export const Dashboard: React.FC<DashboardProps> = ({
  expenses,
  splits,
  loading,
  onOpenAddExpense,
  onSelectExpense,
  setActiveTab,
  onSelectSplit,
  budgets = {},
  onOpenBudgetSettings,
  onRefreshExpenses,
}) => {
  const { user } = useAuth();

  // Compute monthly category budget targets vs actuals
  const budgetSummary = computeMonthlyBudgetStatuses(expenses, budgets);

  // Calculate today's date in local YYYY-MM-DD
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Metrics computation from REAL data only
  const todayExpenses = expenses.filter((e) => e.expense_date === todayStr);
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.expense_date);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthCount = monthExpenses.length;

  // Split amount: sum of current user's assigned amount in all groups
  const totalSplitAssigned = splits.reduce((sum, s) => sum + s.user_amount, 0);

  const hasAnyExpenses = expenses.length > 0;
  const recentExpenses = expenses.slice(0, 5);

  return (
    <div id="dashboard-view" className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-8 sm:pb-12">
      {/* 1. Greeting & Quick Action Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Welcome, {user?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate hidden xs:block">
            Financial clarity, budget boundaries, and collaborative splits.
          </p>
        </div>

        <button
          id="dashboard-add-expense-btn"
          type="button"
          onClick={onOpenAddExpense}
          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Visual Budget Exceeded Alert Banner */}
      {onOpenBudgetSettings && budgetSummary.hasExceeded && (
        <BudgetExceededBanner
          exceededCategories={budgetSummary.exceededCategories}
          onOpenSettings={onOpenBudgetSettings}
        />
      )}

      {/* 7. Suggested Expenses / Insights */}
      <SuggestedExpensesCard onExpenseAdded={onRefreshExpenses} />

      {/* 2. Main Financial Summary Strip - Compact 2-column mobile grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Today's Expenses */}
        <div
          id="summary-card-today"
          className="p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] transition-colors shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              Today&apos;s Expenses
            </span>
            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 shrink-0">
              <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1">
            {loading ? (
              <div className="h-6 sm:h-7 w-20 sm:w-28 bg-[var(--surface-secondary)] rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span
                className="text-base xs:text-lg sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] truncate block"
                style={{ fontFamily: 'Space Grotesk, monospace' }}
              >
                {formatCurrency(todayTotal)}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">No expenses</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate">
            {todayExpenses.length} transaction{todayExpenses.length === 1 ? '' : 's'} today
          </p>
        </div>

        {/* This Month */}
        <div
          id="summary-card-month"
          className="p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] transition-colors shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              This Month
            </span>
            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1">
            {loading ? (
              <div className="h-6 sm:h-7 w-20 sm:w-28 bg-[var(--surface-secondary)] rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span
                className="text-base xs:text-lg sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] truncate block"
                style={{ fontFamily: 'Space Grotesk, monospace' }}
              >
                {formatCurrency(monthTotal)}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">No expenses</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate">
            {now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* Number of Expenses */}
        <div
          id="summary-card-count"
          className="p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] transition-colors shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              Transactions
            </span>
            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1">
            {loading ? (
              <div className="h-6 sm:h-7 w-12 sm:w-16 bg-[var(--surface-secondary)] rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span
                className="text-base xs:text-lg sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] truncate block"
                style={{ fontFamily: 'Space Grotesk, monospace' }}
              >
                {monthCount}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">0</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate">
            In {now.toLocaleDateString('en-IN', { month: 'short' })}
          </p>
        </div>

        {/* 5. Split Liabilities / Split Amount */}
        <div
          id="summary-card-split"
          className="p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] transition-colors shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              Split Liabilities
            </span>
            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-0.5 sm:mt-1">
            {loading ? (
              <div className="h-6 sm:h-7 w-20 sm:w-28 bg-[var(--surface-secondary)] rounded animate-pulse" />
            ) : splits.length > 0 ? (
              <span
                className="text-base xs:text-lg sm:text-2xl font-bold font-mono tracking-tight text-[#B08D57] truncate block"
                style={{ fontFamily: 'Space Grotesk, monospace' }}
              >
                {formatCurrency(totalSplitAssigned)}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-medium text-[var(--text-muted)]">None</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate">
            {splits.length} shared group{splits.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Monthly Category Breakdown & Top Expense Drivers (Recharts) */}
      <MonthlyCategoryBreakdownChart
        expenses={expenses}
        loading={loading}
        onOpenAddExpense={onOpenAddExpense}
        onSelectCategory={(_cat) => {
          setActiveTab('expenses');
        }}
      />

      {/* 4. Budget Overview - Monthly Category Budgets */}
      {onOpenBudgetSettings && (
        <MonthlyBudgetsCard
          expenses={expenses}
          budgets={budgets}
          onOpenSettings={onOpenBudgetSettings}
          loading={loading}
        />
      )}

      {/* 3. Monthly Spending Trends - 6-Month Trajectory */}
      <MonthlyExpenseSummary expenses={expenses} loading={loading} />

      {/* 5. Split Groups Preview */}
      {splits.length > 0 && (
        <div
          id="dashboard-splits-preview"
          className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-6 transition-colors shadow-xs"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2
              className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Shared Splits
            </h2>
            <button
              id="view-all-splits-btn"
              type="button"
              onClick={() => setActiveTab('splitter')}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-[#B08D57] hover:underline transition-colors"
            >
              <span>Open Splitter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
            {splits.slice(0, 3).map((split) => (
              <div
                key={split.id}
                id={`dashboard-split-card-${split.id}`}
                onClick={() => {
                  if (onSelectSplit) {
                    onSelectSplit(split.id);
                  } else {
                    setActiveTab('splitter');
                  }
                }}
                className="p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[#B08D57] cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30">
                    {split.user_role === 'owner' ? 'Created by you' : 'Member'}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] font-normal">
                    {split.member_count} member{split.member_count === 1 ? '' : 's'}
                  </span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm truncate mb-0.5 text-[var(--text-primary)]">{split.name}</h3>
                <div className="flex items-baseline justify-between mt-2 sm:mt-3 pt-2 border-t border-[var(--border)]">
                  <span className="text-xs text-[var(--text-secondary)]">Total</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-[#B08D57]">{formatCurrency(split.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Recent Activity / Expenses Section */}
      <div
        id="dashboard-recent-expenses-container"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2
            className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Recent Expenses
          </h2>

          {hasAnyExpenses && (
            <button
              id="view-all-expenses-btn"
              type="button"
              onClick={() => setActiveTab('expenses')}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-[#B08D57] hover:underline transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Expenses List or Empty State */}
        {loading ? (
          <div className="space-y-2.5 sm:space-y-3 py-2 sm:py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 sm:h-16 rounded-xl bg-[var(--surface-secondary)] animate-pulse" />
            ))}
          </div>
        ) : !hasAnyExpenses ? (
          <div id="dashboard-empty-expenses" className="py-8 sm:py-12 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#B08D57]/15 flex items-center justify-center mx-auto mb-2.5 text-[#B08D57] border border-[#B08D57]/30">
              <CircleDollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">No expenses yet</p>
            <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-0.5 mb-3">
              Add your daily personal expenditures to track categories and monthly budgets.
            </p>
            <button
              id="empty-dashboard-add-btn"
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record first expense</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {recentExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  id={`recent-expense-${expense.id}`}
                  onClick={() => onSelectExpense(expense)}
                  role="button"
                  tabIndex={0}
                  className="py-2.5 px-2 sm:py-3.5 sm:px-3 -mx-2 sm:-mx-3 rounded-lg sm:rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate text-[var(--text-primary)]">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        <span className="font-medium text-[var(--text-primary)]">
                          {expense.category === 'Other' && expense.custom_category
                            ? expense.custom_category
                            : expense.category}
                        </span>
                        <span>•</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        <span className="hidden xs:inline">•</span>
                        <span className="hidden xs:inline text-[10px] sm:text-[11px] font-medium px-1.5 py-0.2 rounded border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                          {expense.payment_method}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className="text-xs sm:text-base font-bold font-mono tracking-tight text-[var(--text-primary)]"
                      style={{ fontFamily: 'Space Grotesk, monospace' }}
                    >
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
