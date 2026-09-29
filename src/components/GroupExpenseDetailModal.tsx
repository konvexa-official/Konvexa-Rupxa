import React, { useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { GroupExpense, SplitMember } from '../types';
import { formatCurrency } from '../lib/formatters';
import { deleteGroupExpense } from '../lib/db';
import {
  X,
  Receipt,
  Calendar,
  Tag,
  CreditCard,
  Users,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface GroupExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: GroupExpense | null;
  groupId: string;
  members: SplitMember[];
  onEdit: (expense: GroupExpense) => void;
  onDeleted: () => void;
}

export const GroupExpenseDetailModal: React.FC<GroupExpenseDetailModalProps> = ({
  isOpen,
  onClose,
  expense,
  groupId,
  members,
  onEdit,
  onDeleted,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await deleteGroupExpense({
        expenseId: expense.id,
        groupId,
        actorId: user.id,
        actorProfile: user,
      });

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
      setConfirmDelete(false);
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
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#B08D57]/15 border border-[#B08D57]/30 flex items-center justify-center text-[#B08D57]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Expense Details
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                Full split breakdown and settlement contributions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg text-[#6F5738] dark:text-[#A6A29A] hover:bg-[#2A2926]/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Summary Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#2A2926]/30 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30">
                  {expense.category}
                </span>
                <span className="text-xs text-[#6F5738] dark:text-[#A6A29A] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </span>
              </div>
              <h3
                className="text-xl font-bold mt-1 text-[#0B0B0B] dark:text-white tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {expense.name}
              </h3>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] block">
                Total Amount
              </span>
              <span className="text-2xl font-bold font-mono text-[#B08D57]">
                {formatCurrency(expense.amount)}
              </span>
            </div>
          </div>

          {/* Paid By info */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              isDark ? 'border-[#2A2926] bg-[#151515]/60' : 'border-[#2A2926]/20 bg-white/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#B08D57]" />
              <span className="text-[#6F5738] dark:text-[#A6A29A]">Paid upfront by</span>
              <span className="font-semibold text-[#0B0B0B] dark:text-white">
                {paidByName} {expense.paid_by_user_id === user.id ? '(You)' : ''}
              </span>
            </div>
            <span className="font-mono font-semibold text-[#B08D57]">
              {formatCurrency(expense.amount)}
            </span>
          </div>

          {/* Split Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0B0B0B] dark:text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Split Breakdown</span>
                <span className="text-[#6F5738] dark:text-[#A6A29A] font-normal">
                  ({expense.split_type === 'equal' ? 'Equal' : 'Custom'})
                </span>
              </span>
              <span className="text-[11px] text-[#6F5738] dark:text-[#A6A29A]">
                {expense.shares.length} sharing
              </span>
            </div>

            <div
              className={`rounded-xl border divide-y overflow-hidden max-h-52 overflow-y-auto ${
                isDark
                  ? 'border-[#2A2926] bg-[#151515] divide-[#2A2926]'
                  : 'border-[#2A2926]/30 bg-white divide-[#2A2926]/20'
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
                      <span className="font-semibold text-[#0B0B0B] dark:text-white">
                        {memName}
                      </span>
                      {isMe && <span className="ml-1 text-[#B08D57] font-semibold">(You)</span>}
                      <span className="ml-2 text-[10px] text-[#6F5738] dark:text-[#A6A29A]">
                        {percentage}%
                      </span>
                    </div>

                    <span className="font-mono font-semibold text-[#0B0B0B] dark:text-white">
                      {formatCurrency(share.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete confirmation dialog */}
          {confirmDelete && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs space-y-2.5 animate-in fade-in">
              <p className="font-semibold text-red-600 dark:text-red-400">
                Are you sure you want to delete this expense?
              </p>
              <p className="text-[#6F5738] dark:text-[#A6A29A]">
                This will recalculate the group total and remove member shares. An immutable record
                will be logged in the activity audit trail.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                    isDark
                      ? 'border-[#2A2926] text-white hover:bg-[#2A2926]/30'
                      : 'border-[#2A2926]/30 text-[#0B0B0B] hover:bg-[#2A2926]/10'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-between border-t border-[#2A2926]">
            {!confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  onEdit(expense);
                  onClose();
                }}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] active:scale-95 transition-all shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Expense</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
