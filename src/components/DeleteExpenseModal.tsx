import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GroupExpense } from '../types';
import { deleteGroupExpense } from '../lib/db';
import { formatCurrency } from '../lib/formatters';
import { AlertCircle, Trash2, X, AlertTriangle } from 'lucide-react';

export const DELETION_REASONS = [
  'Wrong amount',
  'Duplicate expense',
  'Added by mistake',
  'Wrong category',
  'Expense cancelled',
  'Other',
] as const;

export type DeletionReason = (typeof DELETION_REASONS)[number];

interface DeleteExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: GroupExpense | null;
  groupId: string;
  onDeleted: () => void;
}

export const DeleteExpenseModal: React.FC<DeleteExpenseModalProps> = ({
  isOpen,
  onClose,
  expense,
  groupId,
  onDeleted,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [selectedReason, setSelectedReason] = useState<DeletionReason | ''>('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const isFormValid =
    selectedReason !== '' &&
    (selectedReason !== 'Other' || customReason.trim().length > 0);

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to delete an expense.');
      return;
    }
    if (!isFormValid) {
      setError('Please provide a reason for deleting this expense.');
      return;
    }

    const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    const finalNote = selectedReason === 'Other' ? customReason.trim() : undefined;

    setLoading(true);
    setError(null);

    try {
      await deleteGroupExpense({
        expenseId: expense.id,
        groupId,
        actorId: user.id,
        actorProfile: user,
        reason: finalReason,
        note: finalNote,
      });

      onDeleted();
      onClose();
      // Reset state
      setSelectedReason('');
      setCustomReason('');
    } catch (err: unknown) {
      console.error('Failed to delete expense:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete expense. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="delete-expense-modal-backdrop"
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        id="delete-expense-modal-card"
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white shadow-black/80'
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3
                className="font-black text-base text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Delete this expense?
              </h3>
            </div>
          </div>
          <button
            type="button"
            id="close-delete-expense-modal-btn"
            onClick={() => !loading && onClose()}
            className="text-black/60 dark:text-[#A6A29A] hover:text-black dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expense mini-summary */}
        <div
          className={`mt-4 p-3 rounded-xl border flex items-center justify-between ${
            isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
          }`}
        >
          <div className="min-w-0 pr-3">
            <span className="font-bold text-xs truncate block text-black dark:text-white">
              {expense.name || expense.reference || 'Expense'}
            </span>
            {expense.reference && expense.reference !== expense.name && (
              <span className="text-[10px] text-[#8C6B1F] dark:text-[#E6CA65] font-semibold block truncate">
                Ref: {expense.reference}
              </span>
            )}
          </div>
          <span className="font-mono font-black text-sm text-[#8C6B1F] dark:text-[#E6CA65] shrink-0">
            {formatCurrency(expense.amount)}
          </span>
        </div>

        <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-3 mb-4 leading-relaxed">
          This will remove the expense from the group&apos;s active totals.
        </p>

        {error && (
          <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 mb-4 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleConfirmDelete} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-2">
              Why are you deleting it? <span className="text-[#C59B27]">*</span>
            </label>
            <div className="space-y-2">
              {DELETION_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${
                      isSelected
                        ? isDark
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white'
                          : 'border-[#D4AF37] bg-[#FAF8F5] text-black font-bold'
                        : isDark
                        ? 'border-[#2A2926] bg-[#151515] text-[#A6A29A] hover:border-[#6F5738]'
                        : 'border-[#E6DFC8] bg-white text-[#292524] hover:border-[#D4AF37]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deletion-reason"
                      value={reason}
                      checked={isSelected}
                      onChange={() => {
                        setSelectedReason(reason);
                        setError(null);
                      }}
                      className="accent-[#C59B27] w-3.5 h-3.5"
                      disabled={loading}
                    />
                    <span>{reason}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div className="animate-in fade-in space-y-1">
              <label className="block text-xs font-bold text-black dark:text-white">
                Enter reason <span className="text-[#C59B27]">*</span>
              </label>
              <input
                id="other-deletion-reason-input"
                type="text"
                required
                placeholder="Enter reason"
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                autoFocus
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-medium border outline-none transition-colors ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
            <button
              type="button"
              id="cancel-delete-expense-btn"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#151515] hover:text-white'
                  : 'border-[#E6DFC8] text-[#292524] hover:bg-[#FAF8F5]'
              }`}
            >
              Cancel
            </button>
            <button
              id="confirm-delete-expense-btn"
              type="submit"
              disabled={loading || !isFormValid}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Deleting...' : 'Delete Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
