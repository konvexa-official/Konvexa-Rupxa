import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Expense, ExpenseCategory } from '../types';
import { formatCurrency, formatDate } from '../lib/formatters';
import { deleteExpense } from '../lib/db';
import { getCategoryIcon } from './Dashboard';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  AlertTriangle,
  ReceiptText,
  X,
  RotateCcw,
} from 'lucide-react';

interface ExpensesProps {
  expenses: Expense[];
  loading: boolean;
  onRefresh: () => void;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
}

export const Expenses: React.FC<ExpensesProps> = ({
  expenses,
  loading,
  onRefresh,
  onOpenAddExpense,
  onEditExpense,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'month'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation modal state
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Keyboard shortcut listener to focus search on '/' or 'Cmd+K' / 'Ctrl+K'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered expenses based on search query (name/category) and filters
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return expenses.filter((e) => {
      // Search matching by description (name), category, or amount
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDesc = (e.description || '').toLowerCase().includes(q);
        const matchesCat = (e.category || '').toLowerCase().includes(q);
        const matchesAmount = (e.amount || 0).toString().includes(q);
        const matchesMethod = (e.payment_method || '').toLowerCase().includes(q);
        if (!matchesDesc && !matchesCat && !matchesAmount && !matchesMethod) return false;
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
  }, [expenses, searchQuery, selectedCategory, dateRange]);

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

  return (
    <div id="expenses-view" className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B0B0B] dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Daily Expenses
          </h1>
          <p className="text-xs sm:text-sm text-[#6F5738] dark:text-[#A6A29A] mt-1">
            Track, search, and categorize your personal spending
          </p>
        </div>

        <button
          id="expenses-add-new-btn"
          type="button"
          onClick={onOpenAddExpense}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] active:scale-95 transition-all self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Premium Search and Filter Bar */}
      <div
        id="expenses-search-and-filter-card"
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#0E0C0A] border-[#2A2926] shadow-lg shadow-black/40'
            : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
        }`}
      >
        {/* Main Search Input */}
        <div className="relative">
          <div
            className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
              isDark
                ? 'bg-[#15120E] border-[#383126] focus-within:border-[#B08D57] focus-within:ring-2 focus-within:ring-[#B08D57]/20 focus-within:shadow-[0_0_20px_rgba(176,141,87,0.15)]'
                : 'bg-white border-[#2A2926]/40 focus-within:border-[#B08D57] focus-within:ring-2 focus-within:ring-[#B08D57]/20 shadow-xs'
            }`}
          >
            {/* Search Icon with Luxury Gold Badge */}
            <div className="w-8 h-8 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/40 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4" />
            </div>

            {/* Input Element */}
            <input
              ref={searchInputRef}
              id="expenses-search-input"
              type="text"
              placeholder="Search expenses by name or category (e.g. Flight, Dinner, Bills, Food)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm font-medium outline-none text-[#0B0B0B] dark:text-white placeholder-[#8F8A80] dark:placeholder-[#7A756C]"
            />

            {/* Match Counter Badge (When searching) */}
            {searchQuery.trim() && (
              <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30 shrink-0">
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
                className="p-1 rounded-md text-[#6F5738] dark:text-[#A6A29A] hover:text-[#0B0B0B] dark:hover:text-white hover:bg-[#B08D57]/20 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Keyboard shortcut hint when input is empty */}
            {!searchQuery && (
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded bg-[#2A2926]/40 dark:bg-[#201B15] text-[#8F8A80] dark:text-[#7A756C] border border-[#2A2926] shrink-0 select-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Category Filter Chips & Date Filter Row */}
        <div className="mt-3.5 pt-3.5 border-t border-[#2A2926]/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] shrink-0 mr-1 hidden sm:inline-block">
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
                      ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] shadow-sm shadow-[#B08D57]/25'
                      : 'bg-[#2A2926]/20 dark:bg-[#16120D] text-[#6F5738] dark:text-[#A6A29A] border-[#2A2926] hover:text-[#0B0B0B] dark:hover:text-white hover:border-[#6F5738]'
                  }`}
                >
                  <span>{c}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isCatSelected
                          ? 'bg-[#0B0B0B]/20 text-[#0B0B0B]'
                          : 'bg-[#2A2926]/50 text-[#8F8A80] dark:text-[#7A756C]'
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
              <Calendar className="w-3.5 h-3.5 text-[#6F5738] dark:text-[#A6A29A]" />
              <select
                id="filter-date-select"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border outline-none transition-colors ${
                  isDark
                    ? 'bg-[#15120E] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-white border-[#2A2926]/40 text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              >
                <option value="all" className="bg-[#0B0B0B] text-white">All Dates</option>
                <option value="today" className="bg-[#0B0B0B] text-white">Today</option>
                <option value="month" className="bg-[#0B0B0B] text-white">This Month</option>
              </select>
            </div>

            {/* Reset Filters button if any filter is active */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#B08D57] hover:bg-[#B08D57]/15 border border-[#B08D57]/30 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Filter Summary Strip (if filtered) */}
        {isFilterActive && (
          <div className="mt-3 pt-3 border-t border-[#2A2926]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#6F5738] dark:text-[#A6A29A]">
              <span>
                Showing <strong className="text-[#0B0B0B] dark:text-white">{filteredExpenses.length}</strong> of{' '}
                <strong className="text-[#0B0B0B] dark:text-white">{expenses.length}</strong> expenses
              </span>
              {searchQuery && (
                <span className="hidden sm:inline">
                  matching &ldquo;<span className="text-[#B08D57] font-semibold">{searchQuery}</span>&rdquo;
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#6F5738] dark:text-[#A6A29A]">
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
        className={`rounded-2xl border transition-colors ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
        }`}
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#2A2926]/40 animate-pulse" />
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div id="expenses-empty-state" className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#2A2926] flex items-center justify-center mx-auto mb-3 text-[#A6A29A] border border-[#6F5738]/30">
              {isFilterActive ? <Search className="w-6 h-6 text-[#B08D57]" /> : <ReceiptText className="w-6 h-6" />}
            </div>
            <p className="text-sm font-semibold text-[#0B0B0B] dark:text-white">
              {isFilterActive ? 'No matching expenses found' : 'No expenses found'}
            </p>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] max-w-sm mx-auto mt-1 mb-4">
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add an Expense</span>
              </button>
            ) : isFilterActive ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters & Show All</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-[#2A2926]">
            {filteredExpenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category);
              return (
                <div
                  key={expense.id}
                  id={`expense-row-${expense.id}`}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-[#2A2926]/10 dark:hover:bg-[#2A2926]/40"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-[#0B0B0B] dark:text-white">
                        {expense.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F5738] dark:text-[#A6A29A] mt-1">
                        <span className="font-medium text-[#0B0B0B] dark:text-white">
                          {expense.category}
                        </span>
                        <span>•</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>•</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          isDark
                            ? 'bg-[#2A2926] text-white border-[#2A2926]'
                            : 'bg-[#2A2926]/10 text-[#0B0B0B] border-[#2A2926]'
                        }`}>
                          {expense.payment_method}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#2A2926]">
                    <span className="text-lg font-bold font-mono tracking-tight text-[#0B0B0B] dark:text-white">
                      {formatCurrency(expense.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        id={`edit-expense-${expense.id}`}
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        title="Edit expense"
                        className="p-2 rounded-lg text-[#6F5738] dark:text-[#A6A29A] hover:text-[#B08D57] hover:bg-[#B08D57]/15 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`delete-expense-${expense.id}`}
                        type="button"
                        onClick={() => setDeletingExpense(expense)}
                        title="Delete expense"
                        className="p-2 rounded-lg text-[#6F5738] dark:text-[#A6A29A] hover:text-[#0B0B0B] dark:hover:text-white hover:bg-[#6F5738]/30 transition-colors"
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
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-[#6F5738]/25 text-[#B08D57] border border-[#6F5738]/40 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Delete Expense?
            </h3>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-1 mb-4">
              Are you sure you want to delete "{deletingExpense.description}" for{' '}
              {formatCurrency(deletingExpense.amount)}? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                id="cancel-delete-btn"
                type="button"
                onClick={() => setDeletingExpense(null)}
                disabled={deleteLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#6F5738] hover:bg-[#58452c] border border-[#B08D57]/40 transition-colors disabled:opacity-50"
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
