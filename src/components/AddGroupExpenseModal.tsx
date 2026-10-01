import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitMember, GroupExpense } from '../types';
import { addGroupExpense, updateGroupExpense } from '../lib/db';
import { parseMoney, formatCurrency } from '../lib/formatters';
import {
  X,
  Check,
  AlertCircle,
  Receipt,
  CreditCard,
  DollarSign,
  CheckSquare,
  Square,
} from 'lucide-react';

interface AddGroupExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  groupId: string;
  members: SplitMember[];
  editingExpense?: GroupExpense | null;
}

const PREDEFINED_CATEGORIES = [
  'Food',
  'Travel',
  'Shopping',
  'Hotel',
  'Tickets',
  'Bills',
  'Entertainment',
  'Other',
] as const;

export const AddGroupExpenseModal: React.FC<AddGroupExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  groupId,
  members,
  editingExpense,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [categorySelect, setCategorySelect] = useState<string>('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [paidByUserId, setPaidByUserId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form values
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    const memberIds = members.map((m) => m.user_id);

    if (editingExpense) {
      const existingRef = editingExpense.reference !== undefined && editingExpense.reference !== null
        ? editingExpense.reference
        : editingExpense.name || '';
      setReference(existingRef);
      setAmount(editingExpense.amount.toString());

      const isPredefined = PREDEFINED_CATEGORIES.includes(
        editingExpense.category as (typeof PREDEFINED_CATEGORIES)[number]
      );
      if (isPredefined && editingExpense.category !== 'Other') {
        setCategorySelect(editingExpense.category);
        setCustomCategory('');
      } else {
        setCategorySelect('Other');
        setCustomCategory(editingExpense.category);
      }

      setPaidByUserId(editingExpense.paid_by_user_id);
      setSplitType(editingExpense.split_type);

      const expMemberIds = editingExpense.shares.map((s) => s.user_id);
      setSelectedMemberIds(expMemberIds.length > 0 ? expMemberIds : memberIds);

      const sharesMap: Record<string, string> = {};
      editingExpense.shares.forEach((s) => {
        sharesMap[s.user_id] = s.amount.toString();
      });
      setCustomShares(sharesMap);
    } else {
      setReference('');
      setAmount('');
      setCategorySelect('Food');
      setCustomCategory('');
      setPaidByUserId(user?.id || (members[0]?.user_id ?? ''));
      setSelectedMemberIds(memberIds);
      setSplitType('equal');
      setCustomShares({});
    }
  }, [isOpen, editingExpense, members, user]);

  if (!isOpen) return null;

  // Toggle member selection in equal split
  const toggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length === 1) return; // Prevent 0 members
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== memberId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedMemberIds.length === members.length) {
      if (user) {
        setSelectedMemberIds([user.id]);
      } else if (members.length > 0) {
        setSelectedMemberIds([members[0].user_id]);
      }
    } else {
      setSelectedMemberIds(members.map((m) => m.user_id));
    }
  };

  const parsedAmount = parseMoney(amount);

  // Equal split share calculation
  const equalSharePerPerson =
    selectedMemberIds.length > 0 && parsedAmount > 0
      ? Math.round((parsedAmount / selectedMemberIds.length) * 100) / 100
      : 0;

  // Custom shares calculation
  const customSharesSum = selectedMemberIds.reduce((sum, memId) => {
    const val = parseMoney(customShares[memId] || '0');
    return sum + val;
  }, 0);

  const customDifference = Math.round((parsedAmount - customSharesSum) * 100) / 100;
  const isCustomBalanced = Math.abs(customDifference) <= 0.05;

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedReference = reference.trim();

    if (parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    const finalCategory =
      categorySelect === 'Other' ? customCategory.trim() || 'Other' : categorySelect;

    if (selectedMemberIds.length === 0) {
      setError('Select at least one member to split this expense with.');
      return;
    }

    if (splitType === 'custom' && !isCustomBalanced) {
      setError(
        `The sum of member shares (₹${customSharesSum.toFixed(
          2
        )}) must match the total expense amount (₹${parsedAmount.toFixed(2)}).`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const computedShares = selectedMemberIds.map((mId) => {
        const shareAmount =
          splitType === 'equal'
            ? equalSharePerPerson
            : parseMoney(customShares[mId] || '0');

        return {
          userId: mId,
          amount: shareAmount,
        };
      });

      if (editingExpense) {
        await updateGroupExpense({
          expenseId: editingExpense.id,
          groupId,
          name: trimmedReference,
          reference: trimmedReference || null,
          amount: parsedAmount,
          category: finalCategory,
          paidByUserId,
          splitType,
          shares: computedShares,
          actorId: user.id,
          actorProfile: user,
        });
      } else {
        await addGroupExpense({
          groupId,
          name: trimmedReference,
          reference: trimmedReference || null,
          amount: parsedAmount,
          category: finalCategory,
          paidByUserId,
          splitType,
          shares: computedShares,
          actorId: user.id,
          actorProfile: user,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save group expense. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg my-8 rounded-2xl border shadow-2xl transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white'
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#C59B27]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg sm:text-xl font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {editingExpense ? 'Edit Group Expense' : 'Add Group Expense'}
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Record a shared expense and calculate transparent splits
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-black/60 dark:text-[#A6A29A] hover:bg-[#FAF8F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5 font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Reference / Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white">
                Reference / Description
              </label>
              <span className="text-[10px] text-[#A6A29A] font-semibold uppercase tracking-wider">
                Optional
              </span>
            </div>
            <div className="relative">
              <input
                id="group-expense-reference-input"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="What is this amount for?"
                disabled={loading}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-colors outline-none font-medium ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37] focus:bg-white'
                }`}
              />
            </div>
          </div>

          {/* 2. Amount */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
              Amount (₹) <span className="text-[#C59B27]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-base font-black text-[#8C6B1F] dark:text-[#E6CA65]">
                ₹
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={loading}
                required
                className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl text-base font-mono font-bold border transition-colors outline-none ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37] focus:bg-white'
                }`}
              />
            </div>
          </div>

          {/* 3. Category */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white">
              Category <span className="text-[#C59B27]">*</span>
            </label>
            <div className="relative">
              <select
                value={categorySelect}
                onChange={(e) => setCategorySelect(e.target.value)}
                disabled={loading}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none appearance-none pr-9 cursor-pointer ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37] focus:bg-white'
                }`}
              >
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#292524] dark:text-[#A6A29A]">
                ▼
              </div>
            </div>

            {categorySelect === 'Other' && (
              <div className="pt-1 animate-in fade-in slide-in-from-top-1">
                <label className="block text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] mb-1.5">
                  Enter category name <span className="text-[#C59B27]">*</span>
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Beach Activities, Parking, Boat Ride, Medical"
                  disabled={loading}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors outline-none ${
                    isDark
                      ? 'bg-[#151515] border-[#D4AF37]/40 text-white focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#D4AF37]/50 text-black focus:border-[#D4AF37] focus:bg-white'
                  }`}
                />
              </div>
            )}
          </div>

          {/* 4. Paid By */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
              Paid by <span className="text-[#C59B27]">*</span>
            </label>
            <div className="relative">
              <select
                value={paidByUserId}
                onChange={(e) => setPaidByUserId(e.target.value)}
                disabled={loading}
                required
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none appearance-none pr-9 cursor-pointer ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37] focus:bg-white'
                }`}
              >
                {members.map((mem) => {
                  const isMe = mem.user_id === user?.id;
                  const nameStr = mem.profile?.full_name || 'Member';
                  return (
                    <option key={mem.user_id} value={mem.user_id}>
                      {nameStr} {isMe ? '(You)' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#292524] dark:text-[#A6A29A]">
                ▼
              </div>
            </div>
          </div>

          {/* 5. Split Distribution Mode */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white">
                Split Distribution
              </label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[#E6DFC8] dark:border-[#2A2926] bg-[#FAF8F5] dark:bg-[#151515]">
                <button
                  type="button"
                  onClick={() => setSplitType('equal')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    splitType === 'equal'
                      ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-xs'
                      : 'text-[#292524] dark:text-[#A6A29A] hover:text-black'
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType('custom')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                    splitType === 'custom'
                      ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-xs'
                      : 'text-[#292524] dark:text-[#A6A29A] hover:text-black'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Split Type: EQUAL */}
            {splitType === 'equal' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#292524] dark:text-[#A6A29A]">
                  <span className="font-medium">
                    Splitting equally among {selectedMemberIds.length} of {members.length} members
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[#8C6B1F] dark:text-[#E6CA65] font-bold hover:underline"
                  >
                    {selectedMemberIds.length === members.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {members.map((mem) => {
                    const isSelected = selectedMemberIds.includes(mem.user_id);
                    const isMe = mem.user_id === user?.id;
                    const memName = mem.profile?.full_name || 'Member';

                    return (
                      <div
                        key={mem.user_id}
                        onClick={() => toggleMember(mem.user_id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-black dark:text-white'
                            : 'border-[#E6DFC8] dark:border-[#2A2926] bg-[#FAF8F5] dark:bg-[#151515] opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#8C6B1F] dark:text-[#E6CA65] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-[#292524] dark:text-[#A6A29A] shrink-0" />
                          )}
                          <span className="text-xs font-bold truncate">
                            {memName} {isMe && '(You)'}
                          </span>
                        </div>

                        {isSelected && parsedAmount > 0 && (
                          <span className="text-xs font-mono font-bold text-[#8C6B1F] dark:text-[#E6CA65] shrink-0">
                            {formatCurrency(equalSharePerPerson)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Split Type: CUSTOM */}
            {splitType === 'custom' && (
              <div className="space-y-3">
                <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                  Specify the exact portion each participant owes for this expense:
                </p>

                <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                  {members.map((mem) => {
                    const isMe = mem.user_id === user?.id;
                    const memName = mem.profile?.full_name || 'Member';
                    const currentVal = customShares[mem.user_id] ?? '';

                    return (
                      <div
                        key={mem.user_id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                          isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate text-black dark:text-white">
                            {memName} {isMe && '(You)'}
                          </p>
                        </div>

                        <div className="w-32 relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-xs font-black text-[#8C6B1F] dark:text-[#E6CA65]">
                            ₹
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentVal}
                            onChange={(e) => {
                              setCustomShares({
                                ...customShares,
                                [mem.user_id]: e.target.value,
                              });
                            }}
                            placeholder="0.00"
                            className={`w-full pl-6 pr-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border outline-none text-right ${
                              isDark
                                ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                                : 'bg-white border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Validation Status */}
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center justify-between border font-bold ${
                    isCustomBalanced
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-400'
                  }`}
                >
                  <div>
                    <span className="font-bold">Sum of shares: </span>
                    <span className="font-mono font-black">₹{customSharesSum.toFixed(2)}</span>
                    <span className="mx-1.5">/</span>
                    <span className="text-[11px] opacity-80">
                      Total: ₹{parsedAmount.toFixed(2)}
                    </span>
                  </div>

                  {!isCustomBalanced && (
                    <span className="font-mono text-[11px] font-bold">
                      {customDifference > 0
                        ? `₹${customDifference.toFixed(2)} remaining`
                        : `₹${Math.abs(customDifference).toFixed(2)} over`}
                    </span>
                  )}

                  {isCustomBalanced && (
                    <span className="inline-flex items-center gap-1 font-bold text-[11px]">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Balanced
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926]/30 text-white'
                  : 'border-[#E6DFC8] hover:bg-[#FAF8F5] text-black'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || (splitType === 'custom' && !isCustomBalanced)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm border border-[#B38A22]/40"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[3]" />
              )}
              <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
