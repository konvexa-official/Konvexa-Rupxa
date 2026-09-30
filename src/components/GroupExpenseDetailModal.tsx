import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GroupExpense, SplitMember } from '../types';
import { formatCurrency } from '../lib/formatters';
import { deleteGroupExpense } from '../lib/db';
import {
  X,
  Receipt,
  Calendar,
  CreditCard,
  Users,
  Edit2,
  Trash2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

interface GroupExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: GroupExpense | null;
  groupId: string;
  members: SplitMember[];
  isOwner?: boolean;
  onEdit: (expense: GroupExpense) => void;
  onDeleted: () => void;
}

const DELETION_REASONS = [
  'Wrong amount',
  'Duplicate expense',
  'Added by mistake',
  'Wrong category',
  'Wrong group',
  'Expense was cancelled',
  'No longer applicable',
  'Other',
] as const;

export const GroupExpenseDetailModal: React.FC<GroupExpenseDetailModalProps> = ({
  isOpen,
  onClose,
  expense,
  groupId,
  members,
  isOwner = false,
  onEdit,
  onDeleted,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Deletion modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [briefExplanation, setBriefExplanation] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense || !user) return null;

  const paidByMember = members.find((m) => m.user_id === expense.paid_by_user_id);
  const paidByName =
    expense.paid_by_profile?.full_name ||
    paidByMember?.profile?.full_name ||
    'Member';

  const formattedDate = expense.created_at
    ? new Date(expense.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  // Permissions: Group owner can delete any expense; Normal member can delete only their own
  const isPayerOrCreator = expense.paid_by_user_id === user.id || expense.created_by === user.id;
  const canDelete = isOwner || isPayerOrCreator;

  const handleOpenDelete = () => {
    if (!canDelete) {
      setError('Only the group owner or the member who paid for this expense can delete it.');
      return;
    }
    setError(null);
    setSelectedReason('');
    setBriefExplanation('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) {
      setError('You do not have permission to delete this expense.');
      return;
    }

    if (!selectedReason) {
      setError('Please select a reason for deleting this expense.');
      return;
    }

    if (selectedReason === 'Other' && !briefExplanation.trim()) {
      setError('Please provide a brief explanation for deleting this expense.');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteGroupExpense({
        expenseId: expense.id,
        groupId,
        actorId: user.id,
        actorProfile: user,
        reason: selectedReason,
        note: briefExplanation.trim() || undefined,
      });

      setIsDeleteModalOpen(false);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete expense.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white'
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#C59B27]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Expense Details
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Full split breakdown and settlement contributions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg text-black/60 dark:text-[#A6A29A] hover:bg-[#FAF8F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {error && !isDeleteModalOpen && (
            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Summary Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40">
                  {expense.category}
                </span>
                <span className="text-xs text-[#292524] dark:text-[#A6A29A] flex items-center gap-1 font-semibold">
                  <Calendar className="w-3 h-3 text-[#C59B27]" />
                  {formattedDate}
                </span>
              </div>
              <h3
                className="text-xl font-black mt-1 text-black dark:text-white tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {expense.name}
              </h3>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] block font-bold">
                Total Amount
              </span>
              <span className="text-2xl font-black font-mono text-[#8C6B1F] dark:text-[#E6CA65]">
                {formatCurrency(expense.amount)}
              </span>
            </div>
          </div>

          {/* Paid By info */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              isDark ? 'border-[#2A2926] bg-[#151515]/60' : 'border-[#E6DFC8] bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#C59B27]" />
              <span className="text-[#292524] dark:text-[#A6A29A] font-semibold">Paid upfront by</span>
              <span className="font-bold text-black dark:text-white">
                {paidByName} {expense.paid_by_user_id === user.id ? '(You)' : ''}
              </span>
            </div>
            <span className="font-mono font-black text-[#8C6B1F] dark:text-[#E6CA65]">
              {formatCurrency(expense.amount)}
            </span>
          </div>

          {/* Split Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-black dark:text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C59B27]" />
                <span>Split Breakdown</span>
                <span className="text-[#292524] dark:text-[#A6A29A] font-medium">
                  ({expense.split_type === 'equal' ? 'Equal' : 'Custom'})
                </span>
              </span>
              <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-bold">
                {expense.shares.length} sharing
              </span>
            </div>

            <div
              className={`rounded-xl border divide-y overflow-hidden max-h-52 overflow-y-auto ${
                isDark
                  ? 'border-[#2A2926] bg-[#151515] divide-[#2A2926]'
                  : 'border-[#E6DFC8] bg-[#FAF8F5] divide-[#E6DFC8]'
              }`}
            >
              {expense.shares.map((share, idx) => {
                const mem = members.find((m) => m.user_id === share.user_id);
                const memName =
                  share.profile?.full_name || mem?.profile?.full_name || 'Member';
                const isMe = share.user_id === user.id;
                const percentage =
                  expense.amount > 0
                    ? Math.round((share.amount / expense.amount) * 100)
                    : 0;

                return (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-black dark:text-white">
                        {memName}
                      </span>
                      {isMe && <span className="ml-1 text-[#8C6B1F] dark:text-[#E6CA65] font-black">(You)</span>}
                      <span className="ml-2 text-[10px] text-[#292524] dark:text-[#A6A29A] font-bold">
                        {percentage}%
                      </span>
                    </div>

                    <span className="font-mono font-black text-black dark:text-white">
                      {formatCurrency(share.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-between border-t border-[#E6DFC8] dark:border-[#2A2926]">
            {canDelete ? (
              <button
                type="button"
                onClick={handleOpenDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Expense</span>
              </button>
            ) : (
              <span className="text-[11px] text-[#292524]/60 dark:text-[#A6A29A]/60 font-medium">
                Only creator or owner can delete
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  onEdit(expense);
                  onClose();
                }}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Expense</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          id="delete-expense-modal-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setIsDeleteModalOpen(false);
          }}
        >
          <div
            id="delete-expense-modal-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3
                  className="font-black text-base text-black dark:text-white"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Delete Expense?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setIsDeleteModalOpen(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-3 mb-4 leading-relaxed">
              Are you sure you want to delete this expense? This action will remove the expense from the group and update the group totals.
            </p>

            {error && (
              <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 mb-4 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
                  Reason for deleting <span className="text-[#C59B27]">*</span>
                </label>
                <div className="relative">
                  <select
                    id="deletion-reason-select"
                    value={selectedReason}
                    onChange={(e) => {
                      setSelectedReason(e.target.value);
                      setError(null);
                    }}
                    required
                    disabled={deleting}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors outline-none appearance-none pr-9 cursor-pointer ${
                      isDark
                        ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                    }`}
                  >
                    <option value="">Select reason ▼</option>
                    {DELETION_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#292524] dark:text-[#A6A29A]">
                    ▼
                  </div>
                </div>
              </div>

              {selectedReason === 'Other' && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
                    Please explain <span className="text-[#C59B27]">*</span>
                  </label>
                  <input
                    id="deletion-explanation-input"
                    type="text"
                    required
                    placeholder="Tell us why you are deleting this expense..."
                    value={briefExplanation}
                    onChange={(e) => {
                      setBriefExplanation(e.target.value);
                      setError(null);
                    }}
                    disabled={deleting}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isDark
                        ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
              )}

              {selectedReason !== 'Other' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] mb-1.5">
                    Brief explanation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Tell us why you are deleting this expense..."
                    value={briefExplanation}
                    onChange={(e) => setBriefExplanation(e.target.value)}
                    disabled={deleting}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isDark
                        ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                    }`}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926]">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    isDark
                      ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#2A2926]'
                      : 'border-[#E6DFC8] text-black hover:bg-[#FAF8F5]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  id="confirm-delete-expense-btn"
                  type="submit"
                  disabled={deleting || !selectedReason || (selectedReason === 'Other' && !briefExplanation.trim())}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {deleting ? 'Deleting...' : 'Delete Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
