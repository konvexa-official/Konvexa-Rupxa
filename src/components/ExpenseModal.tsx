import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { isDark } = useTheme();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
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
      setExpenseDate(editingExpense.expense_date);
      setPaymentMethod(editingExpense.payment_method);
    } else {
      setAmount('');
      setDescription('');
      setCategory('Food');
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
          description: description.trim(),
          expense_date: expenseDate,
          payment_method: paymentMethod,
        });
      } else {
        await createExpense({
          user_id: user.id,
          amount: safeAmount,
          category,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        id="expense-modal-card"
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white shadow-black/80'
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <h2
            className="text-lg font-black tracking-tight text-black dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {editingExpense ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <button
            id="close-expense-modal-btn"
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-[#A6A29A] hover:text-white hover:bg-[#2A2926]'
                : 'text-black/60 hover:text-black hover:bg-[#FAF8F5]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            id="expense-form-error"
            className="mt-4 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400 text-xs flex items-center gap-2 font-bold"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
              Amount (INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-[#8C6B1F] dark:text-[#E6CA65]">
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
                className={`w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-bold font-mono border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                }`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
              Description
            </label>
            <input
              id="expense-description-input"
              type="text"
              required
              placeholder="Expense description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                  : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
              }`}
            />
          </div>

          {/* Category & Payment Method in grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                Category
              </label>
              <select
                id="expense-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-white text-black'}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                Payment Method
              </label>
              <select
                id="expense-payment-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm} className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-white text-black'}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subtle Live Budget Target Alert Callout */}
          {budgetAlert && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                budgetAlert.isOver
                  ? 'bg-[#FFFBF0] dark:bg-amber-950/20 border-[#D4AF37] text-black dark:text-amber-300'
                  : 'bg-[#FAF8F5] dark:bg-[#1C160C] border-[#D4AF37]/50 text-black dark:text-[#E6CA65]'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${budgetAlert.isOver ? 'text-[#C59B27]' : 'text-[#8C6B1F]'}`} />
              <div>
                <p className="font-bold text-black dark:text-white">
                  {budgetAlert.isOver ? 'Exceeds Monthly Budget Target' : 'Approaching Budget Target'}
                </p>
                <p className="text-[11px] text-[#292524] dark:text-[#C8BFB5] mt-0.5 font-medium">
                  {budgetAlert.isOver ? (
                    <>
                      This will bring your monthly <strong>{category}</strong> spending to{' '}
                      <span className="font-mono text-black dark:text-white font-bold">{formatCurrency(budgetAlert.projectedTotal)}</span>, exceeding your{' '}
                      <span className="font-mono text-black dark:text-white font-bold">{formatCurrency(budgetAlert.limit)}</span> target by{' '}
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400">+{formatCurrency(budgetAlert.overBy)}</span>.
                    </>
                  ) : (
                    <>
                      This will bring your monthly <strong>{category}</strong> spending to{' '}
                      <span className="font-mono text-black dark:text-white font-bold">{formatCurrency(budgetAlert.projectedTotal)}</span> of your{' '}
                      <span className="font-mono text-black dark:text-white font-bold">{formatCurrency(budgetAlert.limit)}</span> target ({formatCurrency(budgetAlert.remaining || 0)} remaining).
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
              Expense Date
            </label>
            <input
              id="expense-date-input"
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                  : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
              }`}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              id="cancel-expense-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]'
                  : 'border-[#E6DFC8] hover:bg-[#FAF8F5] text-black'
              }`}
            >
              Cancel
            </button>
            <button
              id="save-expense-submit-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 border border-[#B38A22]/40"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
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
