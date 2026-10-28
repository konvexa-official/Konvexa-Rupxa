import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GroupExpense, SplitMember } from '../types';
import { formatCurrency, formatDateTime } from '../lib/formatters';
import { DeleteExpenseModal } from './DeleteExpenseModal';
import {
  X,
  Receipt,
  Calendar,
  CreditCard,
  Users,
  Edit2,
  Trash2,
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

  if (!isOpen || !expense || !user) return null;

  const isPaidByMe = expense.paid_by_user_id === user.id;
  const paidByMember = members.find((m) => m.user_id === expense.paid_by_user_id);
  const paidByName =
    (isPaidByMe ? (user.full_name || 'You') : null) ||
    expense.paid_by_profile?.full_name ||
    paidByMember?.profile?.full_name ||
    (isPaidByMe ? 'You' : 'Member');

  const rawName = expense.name?.trim();
  const rawRef = expense.reference?.trim() || null;
  const expenseTitle = rawName && rawName !== 'Expense' && rawName !== 'Untitled'
    ? rawName
    : (rawRef || `${expense.category} Expense`);
  const hasRef = Boolean(rawRef);

  const formattedDateTime = expense.created_at
    ? formatDateTime(expense.created_at)
    : 'Recently';

  // Permissions: Group owner can delete any expense; Normal member can delete only their own
  const isPayerOrCreator = expense.paid_by_user_id === user.id || expense.created_by === user.id;
  const canDelete = isOwner || isPayerOrCreator;

  const handleOpenDelete = () => {
    setIsDeleteModalOpen(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg my-auto rounded-xl sm:rounded-2xl border shadow-2xl transition-all max-h-[92vh] overflow-hidden flex flex-col ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white'
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#E6DFC8] dark:border-[#2A2926] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#C59B27]">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2
                className="text-base sm:text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Expense Details
              </h2>
              <p className="text-[11px] sm:text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Full split breakdown and settlement contributions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black/60 dark:text-[#A6A29A] hover:bg-[#FAF8F5] dark:hover:bg-[#2A2926] hover:text-black dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">

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
                  {formattedDateTime}
                </span>
              </div>
              <h3
                className="text-xl font-black mt-1 text-black dark:text-white tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {expenseTitle}
              </h3>
              {hasRef && rawRef !== expenseTitle && (
                <p className="text-xs text-[#8C6B1F] dark:text-[#E6CA65] font-semibold mt-0.5">
                  Ref: {rawRef}
                </p>
              )}
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
                id="open-delete-expense-modal-btn"
                onClick={handleOpenDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border border-rose-300 dark:border-rose-900/60"
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
                id="edit-expense-btn"
                onClick={() => {
                  onEdit(expense);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Expense</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Expense Confirmation Modal */}
      <DeleteExpenseModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        expense={expense}
        groupId={groupId}
        onDeleted={() => {
          onDeleted();
          onClose();
        }}
      />
    </div>
  );
};
