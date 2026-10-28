import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Expense, ExpenseCategory, PaymentMethod } from '../types';
import { createExpense, updateExpense } from '../lib/db';
import { formatCurrency, parseMoney } from '../lib/formatters';
import { X, Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingExpense?: Expense | null;
  budgets?: Record<string, number>;
  expenses?: Expense[];
}

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Education',
  'Other',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Card',
  'Bank',
  'Other',
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingExpense,
  budgets = {},
  expenses = [],
}) => {
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form values
  useEffect(() => {
    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setDescription(editingExpense.description);
      setCategory(editingExpense.category);
      setCustomCategory(editingExpense.custom_category || '');
      setExpenseDate(editingExpense.expense_date);
      setPaymentMethod(editingExpense.payment_method);
    } else {
      setAmount('');
      setDescription('');
      setCategory('Food');
      setCustomCategory('');
      const now = new Date();
      setExpenseDate(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate()
        ).padStart(2, '0')}`
      );
      setPaymentMethod('UPI');
    }
    setError(null);
  }, [editingExpense, isOpen]);

  // Compute live budget threshold alert for the selected category
  const budgetAlert = useMemo(() => {
    const limit = budgets[category];
    if (!limit || limit <= 0) return null;

    const parsedAmt = parseMoney(amount);
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Current spend in this category this month (excluding the expense currently being edited)
    const currentMonthSpend = expenses
      .filter((e) => {
        if (editingExpense && e.id === editingExpense.id) return false;
        return (
          e.category === category &&
          e.expense_date &&
          e.expense_date.substring(0, 7) === currentYearMonth
        );
      })
      .reduce((sum, e) => sum + parseMoney(e.amount), 0);

    const projectedTotal = currentMonthSpend + parsedAmt;
    if (projectedTotal > limit) {
      const overBy = projectedTotal - limit;
      return {
        isOver: true,
        limit,
        projectedTotal,
        overBy,
      };
    }

    if (projectedTotal >= limit * 0.8) {
      return {
        isNear: true,
        limit,
        projectedTotal,
        remaining: limit - projectedTotal,
      };
    }

    return null;
  }, [budgets, category, amount, expenses, editingExpense]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const safeAmount = parseMoney(amount);
    if (safeAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!description.trim()) {
      setError('Description cannot be empty.');
      return;
    }

    const trimmedCustomCategory = customCategory.trim();
    if (category === 'Other') {
      if (!trimmedCustomCategory) {
        setError('Please enter a custom category name.');
        return;
      }
    }

    if (!expenseDate) {
      setError('Please select a valid date.');
      return;
    }
    if (!user) {
      setError('Authentication required.');
      return;
    }

    setLoading(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, user.id, {
          amount: safeAmount,
          category,
          custom_category: category === 'Other' ? trimmedCustomCategory : null,
          description: description.trim(),
          expense_date: expenseDate,
          payment_method: paymentMethod,
        });
      } else {
        await createExpense({
          user_id: user.id,
          amount: safeAmount,
          category,
          custom_category: category === 'Other' ? trimmedCustomCategory : null,
          description: description.trim(),
          expense_date: expenseDate,
          payment_method: paymentMethod,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save expense. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="expense-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        id="expense-modal-card"
        className="w-full max-w-md rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-4 sm:p-6 shadow-2xl transition-colors max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <h2
            className="text-lg font-bold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {editingExpense ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <button
            id="close-expense-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            id="expense-form-error"
            className="mt-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-semibold"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
              Amount (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#B08D57]">
                ₹
              </span>
              <input
                id="expense-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-bold font-mono border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
              Description
            </label>
            <input
              id="expense-description-input"
              type="text"
              required
              placeholder="Expense description (e.g., Grocery shopping, Uber ride)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
            />
          </div>

          {/* Category & Payment Method in grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
                Category
              </label>
              <select
                id="expense-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[var(--surface)] text-[var(--text-primary)]">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
                Payment Method
              </label>
              <select
                id="expense-payment-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] transition-colors"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm} className="bg-[var(--surface)] text-[var(--text-primary)]">
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Category Name (Required only when Category = Other) */}
          {category === 'Other' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
                Custom Category Name <span className="text-[#B08D57]">*</span>
              </label>
              <input
                id="expense-custom-category-input"
                type="text"
                required
                placeholder="Enter custom category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
              />
            </div>
          )}

          {/* Subtle Live Budget Target Alert Callout */}
          {budgetAlert && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
                budgetAlert.isOver
                  ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {budgetAlert.isOver ? 'Exceeds Monthly Budget Target' : 'Approaching Budget Target'}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 font-normal leading-relaxed">
                  {budgetAlert.isOver ? (
                    <>
                      This will bring your monthly <strong>{category}</strong> spending to{' '}
                      <span className="font-mono text-[var(--text-primary)] font-bold">{formatCurrency(budgetAlert.projectedTotal)}</span>, exceeding your{' '}
                      <span className="font-mono text-[var(--text-primary)] font-bold">{formatCurrency(budgetAlert.limit)}</span> target by{' '}
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">+{formatCurrency(budgetAlert.overBy)}</span>.
                    </>
                  ) : (
                    <>
                      This will bring your monthly <strong>{category}</strong> spending to{' '}
                      <span className="font-mono text-[var(--text-primary)] font-bold">{formatCurrency(budgetAlert.projectedTotal)}</span> of your{' '}
                      <span className="font-mono text-[var(--text-primary)] font-bold">{formatCurrency(budgetAlert.limit)}</span> target ({formatCurrency(budgetAlert.remaining || 0)} remaining).
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
              Expense Date
            </label>
            <input
              id="expense-date-input"
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] transition-colors"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              id="cancel-expense-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-expense-submit-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
