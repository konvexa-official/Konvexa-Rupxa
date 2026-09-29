import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Expense, SplitGroupSummary, ActiveTab } from '../types';
import { formatCurrency, formatDate } from '../lib/formatters';
import { MonthlyExpenseSummary } from './MonthlyExpenseSummary';
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
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

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
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B0B0B] dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Welcome, {user?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-xs sm:text-sm text-[#6F5738] dark:text-[#A6A29A] mt-1">
            Here is your financial pulse and shared expenses overview.
          </p>
        </div>

        <button
          id="dashboard-add-expense-btn"
          type="button"
          onClick={onOpenAddExpense}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] active:scale-95 transition-all self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Expenses */}
        <div
          id="summary-card-today"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-[#6F5738] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Expenses</span>
            <div className="p-2 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-28 bg-[#2A2926] rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span className="text-2xl font-bold font-mono tracking-tight text-[#0B0B0B] dark:text-white">
                {formatCurrency(todayTotal)}
              </span>
            ) : (
              <span className="text-sm font-medium text-[#6F5738] dark:text-[#A6A29A]">No expenses yet</span>
            )}
          </div>
          <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
            {todayExpenses.length} transaction{todayExpenses.length === 1 ? '' : 's'} recorded today
          </p>
        </div>

        {/* This Month */}
        <div
          id="summary-card-month"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-[#6F5738] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">This Month</span>
            <div className="p-2 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-28 bg-[#2A2926] rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span className="text-2xl font-bold font-mono tracking-tight text-[#0B0B0B] dark:text-white">
                {formatCurrency(monthTotal)}
              </span>
            ) : (
              <span className="text-sm font-medium text-[#6F5738] dark:text-[#A6A29A]">No expenses yet</span>
            )}
          </div>
          <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
            {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Number of Expenses */}
        <div
          id="summary-card-count"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-[#6F5738] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Number of Expenses</span>
            <div className="p-2 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-16 bg-[#2A2926] rounded animate-pulse" />
            ) : hasAnyExpenses ? (
              <span className="text-2xl font-bold font-mono tracking-tight text-[#0B0B0B] dark:text-white">
                {monthCount}
              </span>
            ) : (
              <span className="text-sm font-medium text-[#6F5738] dark:text-[#A6A29A]">0</span>
            )}
          </div>
          <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">Current month transactions</p>
        </div>

        {/* Split Amount */}
        <div
          id="summary-card-split"
          className={`p-5 rounded-2xl border transition-all ${
            isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-[#6F5738] dark:text-[#A6A29A] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Split Amount</span>
            <div className="p-2 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-7 w-28 bg-[#2A2926] rounded animate-pulse" />
            ) : splits.length > 0 ? (
              <span className="text-2xl font-bold font-mono tracking-tight text-[#B08D57]">
                {formatCurrency(totalSplitAssigned)}
              </span>
            ) : (
              <span className="text-sm font-medium text-[#6F5738] dark:text-[#A6A29A]">No active splits</span>
            )}
          </div>
          <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
            Across {splits.length} shared group{splits.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Monthly Expense Summary View - 6-Month Spending Trends */}
      <MonthlyExpenseSummary expenses={expenses} loading={loading} />

      {/* Recent Expenses Section */}
      <div
        id="dashboard-recent-expenses-container"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Recent Expenses
            </h2>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-0.5">
              Personal expenses recorded on your account
            </p>
          </div>

          {hasAnyExpenses && (
            <button
              id="view-all-expenses-btn"
              type="button"
              onClick={() => setActiveTab('expenses')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B08D57] hover:text-[#9F7E4C] transition-colors"
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
              <div key={i} className="h-16 rounded-xl bg-[#2A2926]/40 animate-pulse" />
            ))}
          </div>
        ) : !hasAnyExpenses ? (
          <div id="dashboard-empty-expenses" className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2A2926] flex items-center justify-center mx-auto mb-3 text-[#A6A29A] border border-[#6F5738]/20">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-[#0B0B0B] dark:text-white">No expenses yet</p>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] max-w-sm mx-auto mt-1 mb-4">
              Add your daily personal expenditures to track categories and monthly budgets.
            </p>
            <button
              id="empty-dashboard-add-btn"
              type="button"
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record your first expense</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2926] border-y border-[#2A2926]">
            {recentExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  id={`recent-expense-${expense.id}`}
                  onClick={() => onSelectExpense(expense)}
                  role="button"
                  tabIndex={0}
                  className="py-3.5 px-3 -mx-3 rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-colors hover:bg-[#2A2926]/10 dark:hover:bg-[#2A2926]/40"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-[#0B0B0B] dark:text-white">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#6F5738] dark:text-[#A6A29A] mt-0.5">
                        <span className="font-medium text-[#0B0B0B] dark:text-white">
                          {expense.category}
                        </span>
                        <span>•</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>•</span>
                        <span className={`text-[11px] px-1.5 py-0.2 rounded border ${
                          isDark
                            ? 'bg-[#2A2926] text-white border-[#2A2926]'
                            : 'bg-[#2A2926]/10 text-[#0B0B0B] border-[#2A2926]'
                        }`}>
                          {expense.payment_method}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-bold font-mono tracking-tight text-[#0B0B0B] dark:text-white">
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
            isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Shared Splits
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-0.5">
                Active group expenses shared with peers
              </p>
            </div>
            <button
              id="view-all-splits-btn"
              type="button"
              onClick={() => setActiveTab('splitter')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B08D57] hover:text-[#9F7E4C] transition-colors"
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
                    ? 'border-[#2A2926] bg-[#0B0B0B] hover:border-[#6F5738]'
                    : 'border-[#2A2926] bg-[#F5F2EA] hover:border-[#6F5738]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30">
                    {split.user_role === 'owner' ? 'Created by you' : 'Member'}
                  </span>
                  <span className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                    {split.member_count} member{split.member_count === 1 ? '' : 's'}
                  </span>
                </div>
                <h3 className="font-semibold text-sm truncate mb-1 text-[#0B0B0B] dark:text-white">{split.name}</h3>
                <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-[#2A2926]">
                  <span className="text-xs text-[#6F5738] dark:text-[#A6A29A]">Total</span>
                  <span className="font-mono font-bold text-sm text-[#B08D57]">{formatCurrency(split.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
