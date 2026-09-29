import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitMember, GroupExpense } from '../types';
import { addGroupExpense, updateGroupExpense } from '../lib/db';
import { parseMoney, formatCurrency } from '../lib/formatters';
import {
  X,
  Plus,
  Check,
  AlertCircle,
  Users,
  Receipt,
  Tag,
  CreditCard,
  Sliders,
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

  const [name, setName] = useState('');
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
      setName(editingExpense.name);
      setAmount(editingExpense.amount.toString());

      // Check if category is predefined or custom
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
      setName('');
      setAmount('');
      setCategorySelect('Food');
      setCustomCategory('');

      // Default paid by: current user if they are in members, else first member
      if (user && memberIds.includes(user.id)) {
        setPaidByUserId(user.id);
      } else if (members.length > 0) {
        setPaidByUserId(members[0].user_id);
      }

      // Default split between: all members selected
      setSelectedMemberIds([...memberIds]);
      setSplitType('equal');

      // Initialize empty custom shares
      const initialShares: Record<string, string> = {};
      memberIds.forEach((id) => {
        initialShares[id] = '0';
      });
      setCustomShares(initialShares);
    }
  }, [isOpen, editingExpense, members, user]);

  if (!isOpen || !user) return null;

  const parsedAmount = parseMoney(amount);

  // Handle select all / deselect all
  const handleSelectAll = () => {
    setSelectedMemberIds(members.map((m) => m.user_id));
  };

  const handleDeselectAll = () => {
    setSelectedMemberIds([]);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Calculate equal share info
  const calculateEqualShares = () => {
    if (selectedMemberIds.length === 0 || parsedAmount <= 0) return [];
    const count = selectedMemberIds.length;
    const perPerson = Math.floor((parsedAmount / count) * 100) / 100;
    const remainder = parseMoney(parsedAmount - perPerson * count);

    return selectedMemberIds.map((userId, idx) => ({
      userId,
      amount: idx === 0 ? parseMoney(perPerson + remainder) : perPerson,
    }));
  };

  // Calculate custom shares sum
  const customSharesSum = selectedMemberIds.reduce((sum, userId) => {
    return parseMoney(sum + parseMoney(customShares[userId] || '0'));
  }, 0);

  const customDifference = parseMoney(parsedAmount - customSharesSum);
  const isCustomBalanced = Math.abs(customDifference) <= 0.05;

  // Auto-distribute equally into custom share fields
  const handleAutoDistributeCustom = () => {
    if (selectedMemberIds.length === 0 || parsedAmount <= 0) return;
    const equalList = calculateEqualShares();
    const updated: Record<string, string> = { ...customShares };
    equalList.forEach((item) => {
      updated[item.userId] = item.amount.toFixed(2);
    });
    setCustomShares(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter an expense name.');
      return;
    }

    if (parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than ₹0.');
      return;
    }

    // Determine final category string
    let finalCategory = categorySelect;
    if (categorySelect === 'Other') {
      const trimmedCustom = customCategory.trim();
      if (!trimmedCustom) {
        setError('Please enter a custom category name for "Other".');
        return;
      }
      finalCategory = trimmedCustom;
    }

    if (!paidByUserId) {
      setError('Please select who paid for this expense.');
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError('Please select at least one member to split between.');
      return;
    }

    // Prepare shares
    let computedShares: Array<{ userId: string; amount: number }> = [];

    if (splitType === 'equal') {
      computedShares = calculateEqualShares();
    } else {
      if (!isCustomBalanced) {
        setError(
          `Sum of all member shares (₹${customSharesSum.toFixed(2)}) must equal the total expense amount (₹${parsedAmount.toFixed(2)}). Difference: ₹${Math.abs(customDifference).toFixed(2)}`
        );
        return;
      }
      computedShares = selectedMemberIds.map((userId) => ({
        userId,
        amount: parseMoney(customShares[userId] || '0'),
      }));
    }

    setLoading(true);

    try {
      if (editingExpense) {
        await updateGroupExpense({
          expenseId: editingExpense.id,
          groupId,
          name: trimmedName,
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
          name: trimmedName,
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
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#B08D57]/15 border border-[#B08D57]/30 flex items-center justify-center text-[#B08D57]">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg sm:text-xl font-bold tracking-tight text-[#0B0B0B] dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {editingExpense ? 'Edit Group Expense' : 'Add Group Expense'}
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                Record a shared expense and calculate transparent splits
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-[#6F5738] dark:text-[#A6A29A] hover:bg-[#2A2926]/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Expense Name */}
          <div>
            <label className="block text-xs font-semibold text-[#0B0B0B] dark:text-white mb-1.5">
              Expense name <span className="text-[#B08D57]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dinner, Taxi, Villa Booking, Groceries"
                disabled={loading}
                required
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-colors outline-none ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-white border-[#2A2926]/30 text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              />
            </div>
          </div>

          {/* 2. Amount */}
          <div>
            <label className="block text-xs font-semibold text-[#0B0B0B] dark:text-white mb-1.5">
              Amount (₹) <span className="text-[#B08D57]">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-base font-bold text-[#B08D57]">
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
                className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl text-base font-mono font-semibold border transition-colors outline-none ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-white border-[#2A2926]/30 text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              />
            </div>
          </div>

          {/* 3. Category */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-[#0B0B0B] dark:text-white">
              Category <span className="text-[#B08D57]">*</span>
            </label>
            <div className="relative">
              <select
                value={categorySelect}
                onChange={(e) => setCategorySelect(e.target.value)}
                disabled={loading}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-colors outline-none appearance-none pr-9 cursor-pointer ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-white border-[#2A2926]/30 text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              >
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#6F5738] dark:text-[#A6A29A]">
                ▼
              </div>
            </div>

            {/* If "Other" is selected, show manual category name input */}
            {categorySelect === 'Other' && (
              <div className="pt-1 animate-in fade-in slide-in-from-top-1">
                <label className="block text-xs font-semibold text-[#B08D57] mb-1.5">
                  Enter category name <span className="text-[#B08D57]">*</span>
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Beach Activities, Parking, Boat Ride, Medical"
                  disabled={loading}
                  required
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-colors outline-none ${
                    isDark
                      ? 'bg-[#151515] border-[#B08D57]/40 text-white focus:border-[#B08D57]'
                      : 'bg-white border-[#B08D57]/50 text-[#0B0B0B] focus:border-[#B08D57]'
                  }`}
                />
                <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
                  Specify your custom category (e.g. Parking, Boat Ride, Miscellaneous).
                </p>
              </div>
            )}
          </div>

          {/* 4. Paid By */}
          <div>
            <label className="block text-xs font-semibold text-[#0B0B0B] dark:text-white mb-1.5">
              Paid by <span className="text-[#B08D57]">*</span>
            </label>
            <div className="relative">
              <select
                value={paidByUserId}
                onChange={(e) => setPaidByUserId(e.target.value)}
                disabled={loading}
                required
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-colors outline-none appearance-none pr-9 cursor-pointer ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-white border-[#2A2926]/30 text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              >
                {members.map((mem) => {
                  const isCurrent = mem.user_id === user.id;
                  const displayName = mem.profile?.full_name || 'Member';
                  const identifier = mem.profile?.email ? ` (${mem.profile.email})` : '';
                  return (
                    <option key={mem.id} value={mem.user_id}>
                      {displayName} {isCurrent ? '(You)' : ''} {identifier}
                    </option>
                  );
                })}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-[#6F5738] dark:text-[#A6A29A]">
                ▼
              </div>
            </div>
            <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
              Select which verified group member paid upfront for this bill.
            </p>
          </div>

          {/* 5. Split Between */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#0B0B0B] dark:text-white">
                Split between ({selectedMemberIds.length} of {members.length} selected)
              </label>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={loading || selectedMemberIds.length === members.length}
                  className="text-[#B08D57] hover:underline disabled:opacity-40"
                >
                  Select All
                </button>
                <span className="text-[#2A2926]">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  disabled={loading || selectedMemberIds.length === 0}
                  className="text-[#6F5738] dark:text-[#A6A29A] hover:underline disabled:opacity-40"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div
              className={`rounded-xl border p-2 space-y-1.5 max-h-48 overflow-y-auto ${
                isDark ? 'border-[#2A2926] bg-[#151515]/50' : 'border-[#2A2926]/20 bg-white/60'
              }`}
            >
              {members.map((mem) => {
                const isSelected = selectedMemberIds.includes(mem.user_id);
                const isMe = mem.user_id === user.id;
                return (
                  <div
                    key={mem.id}
                    onClick={() => handleToggleMember(mem.user_id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-[#B08D57]/15 border border-[#B08D57]/30 text-white'
                          : 'bg-[#B08D57]/15 border border-[#B08D57]/30 text-[#0B0B0B]'
                        : isDark
                        ? 'hover:bg-[#2A2926]/30 text-[#A6A29A]'
                        : 'hover:bg-[#2A2926]/10 text-[#6F5738]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-[#B08D57]">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 opacity-50" />
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-[#0B0B0B] dark:text-white">
                          {mem.profile?.full_name || 'Member'}
                        </span>
                        {isMe && <span className="ml-1 text-[#B08D57] font-semibold">(You)</span>}
                        {mem.profile?.email && (
                          <span className="block text-[10px] text-[#6F5738] dark:text-[#A6A29A]">
                            {mem.profile.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {splitType === 'equal' && isSelected && parsedAmount > 0 && (
                      <span className="font-mono text-xs font-medium text-[#B08D57]">
                        {formatCurrency(
                          calculateEqualShares().find((s) => s.userId === mem.user_id)?.amount || 0
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Split Type: Equal vs Custom */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold text-[#0B0B0B] dark:text-white">
              Split type
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSplitType('equal')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  splitType === 'equal'
                    ? 'border-[#B08D57] bg-[#B08D57] text-[#0B0B0B] shadow-sm'
                    : isDark
                    ? 'border-[#2A2926] bg-[#151515] text-[#A6A29A] hover:border-[#6F5738]'
                    : 'border-[#2A2926]/30 bg-white text-[#6F5738] hover:border-[#6F5738]'
                }`}
              >
                <span>Equal Split</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSplitType('custom');
                  handleAutoDistributeCustom();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  splitType === 'custom'
                    ? 'border-[#B08D57] bg-[#B08D57] text-[#0B0B0B] shadow-sm'
                    : isDark
                    ? 'border-[#2A2926] bg-[#151515] text-[#A6A29A] hover:border-[#6F5738]'
                    : 'border-[#2A2926]/30 bg-white text-[#6F5738] hover:border-[#6F5738]'
                }`}
              >
                <span>Custom Split</span>
              </button>
            </div>

            {/* Custom Split breakdown inputs */}
            {splitType === 'custom' && (
              <div
                className={`p-3.5 rounded-xl border space-y-3 animate-in fade-in ${
                  isDark ? 'border-[#2A2926] bg-[#151515]' : 'border-[#2A2926]/20 bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0B0B0B] dark:text-white">
                    Member Shares
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoDistributeCustom}
                    className="text-[#B08D57] hover:underline text-[11px]"
                  >
                    Distribute Equally
                  </button>
                </div>

                {selectedMemberIds.length === 0 ? (
                  <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] italic">
                    Select members above to configure custom shares.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {members
                      .filter((m) => selectedMemberIds.includes(m.user_id))
                      .map((mem) => {
                        const val = customShares[mem.user_id] ?? '';
                        return (
                          <div
                            key={mem.id}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="truncate font-medium text-[#0B0B0B] dark:text-white flex-1">
                              {mem.profile?.full_name || 'Member'}
                              {mem.user_id === user.id && (
                                <span className="text-[#B08D57] ml-1">(You)</span>
                              )}
                            </span>

                            <div className="relative w-32 shrink-0">
                              <span className="absolute inset-y-0 left-2.5 flex items-center text-xs text-[#B08D57] font-semibold pointer-events-none">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={val}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setCustomShares((prev) => ({
                                    ...prev,
                                    [mem.user_id]: newVal,
                                  }));
                                }}
                                placeholder="0.00"
                                className={`w-full pl-6 pr-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border outline-none text-right ${
                                  isDark
                                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                                    : 'bg-[#F5F2EA] border-[#2A2926]/30 text-[#0B0B0B] focus:border-[#B08D57]'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Validation Status */}
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                    isCustomBalanced
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <div>
                    <span className="font-semibold">Sum of shares: </span>
                    <span className="font-mono font-bold">₹{customSharesSum.toFixed(2)}</span>
                    <span className="mx-1.5">/</span>
                    <span className="text-[11px] opacity-80">
                      Total: ₹{parsedAmount.toFixed(2)}
                    </span>
                  </div>

                  {!isCustomBalanced && (
                    <span className="font-mono text-[11px] font-semibold">
                      {customDifference > 0
                        ? `₹${customDifference.toFixed(2)} remaining`
                        : `₹${Math.abs(customDifference).toFixed(2)} over`}
                    </span>
                  )}

                  {isCustomBalanced && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Balanced
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#2A2926]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926]/30 text-white'
                  : 'border-[#2A2926]/30 hover:bg-[#2A2926]/10 text-[#0B0B0B]'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || (splitType === 'custom' && !isCustomBalanced)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0B0B0B] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
