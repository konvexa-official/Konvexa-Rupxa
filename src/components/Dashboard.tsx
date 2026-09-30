import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Expense, SplitGroupSummary, ActiveTab } from '../types';
import { formatCurrency, formatDate } from '../lib/formatters';
import { MonthlyExpenseSummary } from './MonthlyExpenseSummary';
import { MonthlyBudgetsCard } from './MonthlyBudgetsCard';
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
  budgets = {},
  onOpenBudgetSettings,
  onRefreshExpenses,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

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
    <div id="dashboard-view" className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Welcome Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Welcome, {user?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-xs sm:text-sm text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            Here is your financial pulse and shared expenses overview.
          </p>
        </div>

        <button
          id="dashboard-add-expense-btn"
          type="button"
          onClick={onOpenAddExpense}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all self-start sm:self-auto shadow-sm border border-[#B38A22]/40"
        >
          <Plus className="w-4 h-4 text-black stroke-[3]" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Subtle Visual Alert Banner when any category exceeds target */}
      {onOpenBudgetSettings && budgetSummary.hasExceeded && (
        <BudgetExceededBanner
          exceededCategories={budgetSummary.exceededCategories}
          onOpenSettings={onOpenBudgetSettings}
        />
      )}

      {/* Potential Expenses from Message or Card Detection */}
      <SuggestedExpensesCard onExpenseAdded={onRefreshExpenses} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Expenses */}
        <div
          id="summary-card-today"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#292524] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">Today&apos;s Expenses</span>
            <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40">
              <TrendingDown className="w-4 h-4 text-[#C59B27]" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-28 bg-[#E6DFC8]/50 rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span className="text-2xl font-black font-mono tracking-tight text-black dark:text-white">
                {formatCurrency(todayTotal)}
              </span>
            ) : (
              <span className="text-sm font-bold text-[#292524] dark:text-[#A6A29A]">No expenses yet</span>
            )}
          </div>
          <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            {todayExpenses.length} transaction{todayExpenses.length === 1 ? '' : 's'} recorded today
          </p>
        </div>

        {/* This Month */}
        <div
          id="summary-card-month"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#292524] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">This Month</span>
            <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40">
              <Calendar className="w-4 h-4 text-[#C59B27]" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-28 bg-[#E6DFC8]/50 rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span className="text-2xl font-black font-mono tracking-tight text-black dark:text-white">
                {formatCurrency(monthTotal)}
              </span>
            ) : (
              <span className="text-sm font-bold text-[#292524] dark:text-[#A6A29A]">No expenses yet</span>
            )}
          </div>
          <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Number of Expenses */}
        <div
          id="summary-card-count"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#292524] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">Number of Expenses</span>
            <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40">
              <Layers className="w-4 h-4 text-[#C59B27]" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-16 bg-[#E6DFC8]/50 rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span className="text-2xl font-black font-mono tracking-tight text-black dark:text-white">
                {monthCount}
              </span>
            ) : (
              <span className="text-sm font-bold text-[#292524] dark:text-[#A6A29A]">0</span>
            )}
          </div>
          <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-1">Current month transactions</p>
        </div>

        {/* Split Amount */}
        <div
          id="summary-card-split"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-[#292524] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">Split Amount</span>
            <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40">
              <Users className="w-4 h-4 text-[#C59B27]" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-28 bg-[#E6DFC8]/50 rounded animate-pulse" />
            ) : splits.length > 0 ? (
              <span className="text-2xl font-black font-mono tracking-tight text-[#8C6B1F] dark:text-[#E6CA65]">
                {formatCurrency(totalSplitAssigned)}
              </span>
            ) : (
              <span className="text-sm font-bold text-[#292524] dark:text-[#A6A29A]">No active splits</span>
            )}
          </div>
          <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            Across {splits.length} shared group{splits.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Monthly Category Budgets - Target Limits & Threshold Tracking */}
      {onOpenBudgetSettings && (
        <MonthlyBudgetsCard
          expenses={expenses}
          budgets={budgets}
          onOpenSettings={onOpenBudgetSettings}
          loading={loading}
        />
      )}

      {/* Monthly Expense Summary View - 6-Month Spending Trends */}
      <MonthlyExpenseSummary expenses={expenses} loading={loading} />

      {/* Recent Expenses Section */}
      <div
        id="dashboard-recent-expenses-container"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-lg font-black tracking-tight text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Recent Expenses
            </h2>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-0.5">
              Personal expenses recorded on your account
            </p>
          </div>

          {hasAnyExpenses && (
            <button
              id="view-all-expenses-btn"
              type="button"
              onClick={() => setActiveTab('expenses')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline transition-colors"
            >
              <span>View all expenses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Expenses List or Empty State */}
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#E6DFC8]/40 animate-pulse" />
            ))}
          </div>
        ) : !hasAnyExpenses ? (
          <div id="dashboard-empty-expenses" className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#D4AF37]/15 flex items-center justify-center mx-auto mb-3 text-[#C59B27] border border-[#D4AF37]/40">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-black dark:text-white">No expenses yet</p>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] max-w-sm mx-auto mt-1 mb-4">
              Add your daily personal expenditures to track categories and monthly budgets.
            </p>
            <button
              id="empty-dashboard-add-btn"
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record your first expense</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E6DFC8] dark:divide-[#2A2926] border-y border-[#E6DFC8] dark:border-[#2A2926]">
            {recentExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  id={`recent-expense-${expense.id}`}
                  onClick={() => onSelectExpense(expense)}
                  role="button"
                  tabIndex={0}
                  className="py-3.5 px-3 -mx-3 rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-colors hover:bg-[#FAF8F5] dark:hover:bg-[#2A2926]/40"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#C59B27]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate text-black dark:text-white">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#292524] dark:text-[#A6A29A] mt-0.5">
                        <span className="font-bold text-black dark:text-white">
                          {expense.category}
                        </span>
                        <span>•</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>•</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                          isDark
                            ? 'bg-[#2A2926] text-white border-[#2A2926]'
                            : 'bg-[#FAF8F5] text-black border-[#E6DFC8]'
                        }`}>
                          {expense.payment_method}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-black font-mono tracking-tight text-black dark:text-white">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Shared Splits Quick View */}
      {splits.length > 0 && (
        <div
          id="dashboard-splits-preview"
          className={`rounded-2xl border p-5 sm:p-6 transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Shared Splits
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-0.5">
                Active group expenses shared with peers
              </p>
            </div>
            <button
              id="view-all-splits-btn"
              type="button"
              onClick={() => setActiveTab('splitter')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline transition-colors"
            >
              <span>Open Splitter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {splits.slice(0, 3).map((split) => (
              <div
                key={split.id}
                onClick={() => setActiveTab('splitter')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isDark
                    ? 'border-[#2A2926] bg-[#0B0B0B] hover:border-[#D4AF37]'
                    : 'border-[#E6DFC8] bg-[#FAF8F5] hover:border-[#D4AF37]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/50">
                    {split.user_role === 'owner' ? 'Created by you' : 'Member'}
                  </span>
                  <span className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                    {split.member_count} member{split.member_count === 1 ? '' : 's'}
                  </span>
                </div>
                <h3 className="font-bold text-sm truncate mb-1 text-black dark:text-white">{split.name}</h3>
                <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926]">
                  <span className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">Total</span>
                  <span className="font-mono font-black text-sm text-[#8C6B1F] dark:text-[#E6CA65]">{formatCurrency(split.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
