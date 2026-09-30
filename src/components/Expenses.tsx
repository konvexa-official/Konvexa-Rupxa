import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Expense, ExpenseCategory } from '../types';
import { formatCurrency, formatDate } from '../lib/formatters';
import { deleteExpense } from '../lib/db';
import { getCategoryIcon } from './Dashboard';
import { BudgetExceededBanner } from './BudgetExceededBanner';
import { SuggestedExpensesCard } from './SuggestedExpensesCard';
import { computeMonthlyBudgetStatuses } from '../lib/budgetHelpers';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Calendar,
  AlertTriangle,
  ReceiptText,
  X,
  RotateCcw,
  Target,
} from 'lucide-react';

interface ExpensesProps {
  expenses: Expense[];
  loading: boolean;
  onRefresh: () => void;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  budgets?: Record<string, number>;
  onOpenBudgetSettings?: () => void;
}

export const Expenses: React.FC<ExpensesProps> = ({
  expenses,
  loading,
  onRefresh,
  onOpenAddExpense,
  onEditExpense,
  budgets = {},
  onOpenBudgetSettings,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'month'>('all');
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute today's and current month markers for fast filtering
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // High-performance filter logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Search matching across description, category, payment method
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const descMatch = (e.description || '').toLowerCase().includes(query);
        const catMatch = (e.category || '').toLowerCase().includes(query);
        const payMatch = (e.payment_method || '').toLowerCase().includes(query);
        const amountMatch = (e.amount || '').toString().includes(query);

        if (!descMatch && !catMatch && !payMatch && !amountMatch) {
          return false;
        }
      }

      // Category matching
      if (selectedCategory !== 'All' && e.category !== selectedCategory) {
        return false;
      }

      // Date range matching
      if (dateRange === 'today' && e.expense_date !== todayStr) {
        return false;
      }
      if (dateRange === 'month') {
        const d = new Date(e.expense_date);
        if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, dateRange, todayStr, currentYear, currentMonth]);

  // Aggregate sum of currently filtered expenses
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  // Calculate expense counts per category for chip badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: expenses.length };
    expenses.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [expenses]);

  const handleDeleteConfirm = async () => {
    if (!deletingExpense || !user) return;
    setDeleteLoading(true);
    try {
      await deleteExpense(deletingExpense.id, user.id);
      setDeletingExpense(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setDateRange('all');
    searchInputRef.current?.focus();
  };

  const categories = [
    'All',
    'Food',
    'Travel',
    'Shopping',
    'Bills',
    'Entertainment',
    'Health',
    'Education',
    'Other',
  ];

  const isFilterActive = searchQuery.trim() !== '' || selectedCategory !== 'All' || dateRange !== 'all';

  // Compute monthly category budget targets vs actuals
  const budgetSummary = computeMonthlyBudgetStatuses(expenses, budgets);

  return (
    <div id="expenses-view" className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Expenses
          </h1>
          <p className="text-xs sm:text-sm text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            Track, filter, and audit all personal transactions in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onOpenBudgetSettings && (
            <button
              id="expenses-manage-budgets-btn"
              type="button"
              onClick={onOpenBudgetSettings}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold border border-[#D4AF37] bg-white dark:bg-[#1C160C] hover:bg-[#FAF8F5] text-black dark:text-white transition-all shadow-xs"
            >
              <Target className="w-4 h-4 text-[#C59B27]" />
              <span>Budgets</span>
            </button>
          )}

          <button
            id="expenses-add-new-btn"
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Subtle Visual Alert Banner when any category exceeds target */}
      {onOpenBudgetSettings && budgetSummary.hasExceeded && (
        <BudgetExceededBanner
          exceededCategories={budgetSummary.exceededCategories}
          onOpenSettings={onOpenBudgetSettings}
        />
      )}

      {/* Premium Search and Filter Bar */}
      <div
        id="expenses-search-and-filter-card"
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#0E0C0A] border-[#2A2926] shadow-lg shadow-black/40'
            : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        {/* Main Search Input */}
        <div className="relative">
          <div
            className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
              isDark
                ? 'bg-[#15120E] border-[#383126] focus-within:border-[#D4AF37] focus-within:ring-2 focus-within:ring-[#D4AF37]/20'
                : 'bg-[#FAF8F5] border-[#E6DFC8] focus-within:border-[#D4AF37] focus-within:ring-1 focus-within:ring-[#D4AF37]'
            }`}
          >
            {/* Search Icon with Luxury Gold Badge */}
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#C59B27] border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4 text-[#C59B27]" />
            </div>

            {/* Input Element */}
            <input
              ref={searchInputRef}
              id="expenses-search-input"
              type="text"
              placeholder="Search expenses by name or category (e.g. Flight, Dinner, Bills, Food)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm font-semibold outline-none text-black dark:text-white placeholder-[#8F8A80]"
            />

            {/* Match Counter Badge (When searching) */}
            {searchQuery.trim() && (
              <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 shrink-0">
                {filteredExpenses.length} {filteredExpenses.length === 1 ? 'match' : 'matches'}
              </span>
            )}

            {/* Clear Search Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                title="Clear search"
                className="p-1 rounded-md text-black/60 dark:text-[#A6A29A] hover:text-black dark:hover:text-white hover:bg-[#D4AF37]/20 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Keyboard shortcut hint when input is empty */}
            {!searchQuery && (
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-[#201B15] text-[#8F8A80] border border-[#E6DFC8] dark:border-[#2A2926] shrink-0 select-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Category Filter Chips & Date Filter Row */}
        <div className="mt-3.5 pt-3.5 border-t border-[#E6DFC8] dark:border-[#2A2926]/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] shrink-0 mr-1 hidden sm:inline-block">
              Category:
            </span>
            {categories.map((c) => {
              const isCatSelected = selectedCategory === c;
              const count = categoryCounts[c] || 0;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCategory(c)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                    isCatSelected
                      ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black border-[#B38A22]/40 shadow-xs'
                      : 'bg-[#FAF8F5] dark:bg-[#16120D] text-black dark:text-[#A6A29A] border-[#E6DFC8] dark:border-[#2A2926] hover:border-[#D4AF37]'
                  }`}
                >
                  <span>{c}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
                        isCatSelected
                          ? 'bg-black/20 text-black'
                          : 'bg-[#E6DFC8] dark:bg-[#2A2926]/50 text-black dark:text-[#7A756C]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Date Range & Reset Controls */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C59B27]" />
              <select
                id="filter-date-select"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border outline-none transition-colors ${
                  isDark
                    ? 'bg-[#15120E] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              >
                <option value="all" className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-white text-black'}>All Dates</option>
                <option value="today" className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-white text-black'}>Today</option>
                <option value="month" className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-white text-black'}>This Month</option>
              </select>
            </div>

            {/* Reset Filters button if any filter is active */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-black bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3 text-[#C59B27]" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Filter Summary Strip (if filtered) */}
        {isFilterActive && (
          <div className="mt-3 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#292524] dark:text-[#A6A29A] font-medium">
              <span>
                Showing <strong className="text-black dark:text-white">{filteredExpenses.length}</strong> of{' '}
                <strong className="text-black dark:text-white">{expenses.length}</strong> expenses
              </span>
              {searchQuery && (
                <span className="hidden sm:inline">
                  matching &ldquo;<span className="text-[#8C6B1F] dark:text-[#E6CA65] font-bold">{searchQuery}</span>&rdquo;
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#292524] dark:text-[#A6A29A]">
                Filtered Spend:
              </span>
              <span className="font-mono font-black text-sm text-[#8C6B1F] dark:text-[#E6CA65]">
                {formatCurrency(filteredTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Expense List */}
      <div
        id="expenses-list-container"
        className={`rounded-2xl border transition-colors ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#E6DFC8]/40 animate-pulse" />
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div id="expenses-empty-state" className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#D4AF37]/15 flex items-center justify-center mx-auto mb-3 text-[#C59B27] border border-[#D4AF37]/40">
              {isFilterActive ? <Search className="w-6 h-6 text-[#C59B27]" /> : <ReceiptText className="w-6 h-6 text-[#C59B27]" />}
            </div>
            <p className="text-sm font-bold text-black dark:text-white">
              {isFilterActive ? 'No matching expenses found' : 'No expenses found'}
            </p>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium max-w-sm mx-auto mt-1 mb-4">
              {expenses.length === 0
                ? 'Start managing your finances by adding your first daily expense.'
                : isFilterActive
                ? `No expenses match "${searchQuery || selectedCategory}". Try adjusting your search query or clear filters.`
                : 'No expenses recorded yet.'}
            </p>
            {expenses.length === 0 ? (
              <button
                id="empty-state-add-btn"
                type="button"
                onClick={onOpenAddExpense}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-sm transition-all border border-[#B38A22]/40"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Add an Expense</span>
              </button>
            ) : isFilterActive ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-sm transition-all border border-[#B38A22]/40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters & Show All</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-[#E6DFC8] dark:divide-[#2A2926]">
            {filteredExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  id={`expense-row-${expense.id}`}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-[#FAF8F5] dark:hover:bg-[#2A2926]/40"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#C59B27]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate text-black dark:text-white">
                        {expense.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#292524] dark:text-[#A6A29A] mt-1">
                        <span className="font-bold text-black dark:text-white">
                          {expense.category}
                        </span>
                        <span>•</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>•</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          isDark
                            ? 'bg-[#2A2926] text-white border-[#2A2926]'
                            : 'bg-[#FAF8F5] text-black border-[#E6DFC8]'
                        }`}>
                          {expense.payment_method}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#E6DFC8] dark:border-[#2A2926]">
                    <span className="text-lg font-black font-mono tracking-tight text-black dark:text-white">
                      {formatCurrency(expense.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        id={`edit-expense-${expense.id}`}
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        title="Edit expense"
                        className="p-2 rounded-lg text-[#C59B27] hover:text-[#8C6B1F] hover:bg-[#D4AF37]/15 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-expense-${expense.id}`}
                        type="button"
                        onClick={() => setDeletingExpense(expense)}
                        title="Delete expense"
                        className="p-2 rounded-lg text-black/60 dark:text-[#A6A29A] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingExpense && (
        <div
          id="delete-confirmation-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="delete-confirmation-card"
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Delete Expense?
            </h3>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] mt-1 mb-4 font-medium">
              Are you sure you want to delete &ldquo;{deletingExpense.description}&rdquo; for{' '}
              {formatCurrency(deletingExpense.amount)}? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                id="cancel-delete-btn"
                type="button"
                onClick={() => setDeletingExpense(null)}
                disabled={deleteLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#E6DFC8] hover:bg-[#FAF8F5] text-black"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
