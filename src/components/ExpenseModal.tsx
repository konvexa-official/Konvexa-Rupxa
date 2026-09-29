import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Expense, ExpenseCategory, PaymentMethod } from '../types';
import { createExpense, updateExpense } from '../lib/db';
import { parseMoney } from '../lib/formatters';
import { X, Check, AlertCircle } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingExpense?: Expense | null;
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

const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'Cash', 'Card', 'Bank', 'Other'];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingExpense,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form values
  useEffect(() => {
    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setCategory(editingExpense.category);
      setDescription(editingExpense.description);
      setExpenseDate(editingExpense.expense_date);
      setPaymentMethod(editingExpense.payment_method);
    } else {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      setAmount('');
      setCategory('Food');
      setDescription('');
      setExpenseDate(todayStr);
      setPaymentMethod('UPI');
    }
    setError(null);
  }, [editingExpense, isOpen]);

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
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-black/20'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#2A2926]">
          <h2
            className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
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
                : 'text-[#6F5738] hover:text-[#0B0B0B] hover:bg-[#2A2926]/20'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            id="expense-form-error"
            className="mt-4 p-3 rounded-xl border border-[#6F5738]/40 bg-[#6F5738]/20 text-[#0B0B0B] dark:text-white text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-[#B08D57]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
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
                className={`w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-semibold font-mono border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                    : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                }`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
              Description
            </label>
            <input
              id="expense-description-input"
              type="text"
              required
              placeholder="Expense description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                  : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
              }`}
            />
          </div>

          {/* Category & Payment Method in grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                Category
              </label>
              <select
                id="expense-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                Payment Method
              </label>
              <select
                id="expense-payment-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm} className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
              Expense Date
            </label>
            <input
              id="expense-date-input"
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                  : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
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
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]'
                  : 'border-[#2A2926] hover:bg-[#2A2926]/10 text-[#6F5738]'
              }`}
            >
              Cancel
            </button>
            <button
              id="save-expense-submit-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0B0B0B]/30 border-t-[#0B0B0B] rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
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
