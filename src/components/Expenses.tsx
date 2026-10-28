import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Expense } from '../types';
import { formatCurrency, formatDate } from '../lib/formatters';
import { deleteExpense } from '../lib/db';
import { getCategoryIcon } from './Dashboard';
import { BudgetExceededBanner } from './BudgetExceededBanner';
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
        const catMatch =
          (e.category || '').toLowerCase().includes(query) ||
          (e.custom_category || '').toLowerCase().includes(query);
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
    <div id="expenses-view" className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-8 sm:pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Expenses
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate hidden xs:block">
            Track, filter, and audit all personal transactions in real-time.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenBudgetSettings && (
            <button
              id="expenses-manage-budgets-btn"
              type="button"
              onClick={onOpenBudgetSettings}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[#B08D57] text-[var(--text-primary)] transition-all shadow-xs"
            >
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B08D57]" />
              <span className="hidden sm:inline">Budgets</span>
            </button>
          )}

          <button
            id="expenses-add-new-btn"
            type="button"
            onClick={onOpenAddExpense}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
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

      {/* Search and Filter Bar */}
      <div
        id="expenses-search-and-filter-card"
        className="p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs transition-colors"
      >
        {/* Main Search Input */}
        <div className="relative">
          <div className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] focus-within:border-[#B08D57] focus-within:ring-1 focus-within:ring-[#B08D57] transition-all">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center shrink-0">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            <input
              ref={searchInputRef}
              id="expenses-search-input"
              type="text"
              placeholder="Search expenses by name or category (e.g. Flight, Dinner, Bills, Food)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm font-medium outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
            />

            {/* Match Counter Badge */}
            {searchQuery.trim() && (
              <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30 shrink-0">
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
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {!searchQuery && (
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border)] shrink-0 select-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Category Filter Chips & Date Filter Row */}
        <div className="mt-3.5 pt-3.5 border-t border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] shrink-0 mr-1 hidden sm:inline-block">
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
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                    isCatSelected
                      ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{c}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        isCatSelected
                          ? 'bg-black/20 text-[#0B0B0B]'
                          : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
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
              <Calendar className="w-3.5 h-3.5 text-[#B08D57]" />
              <select
                id="filter-date-select"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] transition-colors"
              >
                <option value="all" className="bg-[var(--surface)] text-[var(--text-primary)]">All Dates</option>
                <option value="today" className="bg-[var(--surface)] text-[var(--text-primary)]">Today</option>
                <option value="month" className="bg-[var(--surface)] text-[var(--text-primary)]">This Month</option>
              </select>
            </div>

            {/* Reset Filters button if any filter is active */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[#B08D57] transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3 text-[#B08D57]" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Filter Summary Strip (if filtered) */}
        {isFilterActive && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <span>
                Showing <strong className="text-[var(--text-primary)] font-semibold">{filteredExpenses.length}</strong> of{' '}
                <strong className="text-[var(--text-primary)] font-semibold">{expenses.length}</strong> expenses
              </span>
              {searchQuery && (
                <span className="hidden sm:inline">
                  matching &ldquo;<span className="text-[#B08D57] font-semibold">{searchQuery}</span>&rdquo;
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)]">
                Filtered Spend:
              </span>
              <span className="font-mono font-bold text-sm text-[#B08D57]">
                {formatCurrency(filteredTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Expense List */}
      <div
        id="expenses-list-container"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs transition-colors"
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--surface-secondary)] animate-pulse" />
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div id="expenses-empty-state" className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#B08D57]/15 flex items-center justify-center mx-auto mb-3 text-[#B08D57] border border-[#B08D57]/30">
              {isFilterActive ? <Search className="w-6 h-6" /> : <ReceiptText className="w-6 h-6" />}
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {isFilterActive ? 'No matching expenses found' : 'No expenses found'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] font-normal max-w-sm mx-auto mt-1 mb-4">
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add an Expense</span>
              </button>
            ) : isFilterActive ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[#B08D57] transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters & Show All</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  id={`expense-row-${expense.id}`}
                  className="p-3 sm:px-6 flex items-center justify-between gap-3 transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate text-[var(--text-primary)]">
                        {expense.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
                        <span className="font-medium text-[var(--text-primary)]">
                          {expense.category === 'Other' && expense.custom_category
                            ? expense.custom_category
                            : expense.category}
                        </span>
                        <span>•</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        <span className="hidden xs:inline">•</span>
                        <span className="hidden xs:inline text-[9px] sm:text-[11px] font-medium px-1.5 py-0.2 rounded border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                          {expense.payment_method}
                        </span>
                        {expense.source === 'Message' && (
                          <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.2 rounded border border-[#B08D57]/30 bg-[#B08D57]/15 text-[#B08D57]">
                            SMS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <span
                      className="text-xs sm:text-lg font-bold font-mono tracking-tight text-[var(--text-primary)]"
                      style={{ fontFamily: 'Space Grotesk, monospace' }}
                    >
                      {formatCurrency(expense.amount)}
                    </span>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        id={`edit-expense-${expense.id}`}
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        title="Edit expense"
                        className="p-1.5 sm:p-2 rounded-lg text-[#B08D57] hover:bg-[#B08D57]/15 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        id={`delete-expense-${expense.id}`}
                        type="button"
                        onClick={() => setDeletingExpense(expense)}
                        title="Delete expense"
                        className="p-1.5 sm:p-2 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            id="delete-confirmation-card"
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-500 border border-red-500/30 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Delete Expense?
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 mb-4 font-normal leading-relaxed">
              Are you sure you want to delete &ldquo;{deletingExpense.description}&rdquo; for{' '}
              {formatCurrency(deletingExpense.amount)}? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                id="cancel-delete-btn"
                type="button"
                onClick={() => setDeletingExpense(null)}
                disabled={deleteLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:border-[#B08D57]"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
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
