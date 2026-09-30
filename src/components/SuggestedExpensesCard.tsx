import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SuggestedExpense } from '../types';
import {
  getSuggestedExpenses,
  dismissSuggestedExpense,
  dismissAllSuggestedExpenses,
  getExpenseDetectionSettings,
} from '../lib/expenseDetection';
import { createExpense } from '../lib/db';
import { formatCurrency, formatDate } from '../lib/formatters';
import {
  Sparkles,
  Plus,
  X,
  CreditCard,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';

interface SuggestedExpensesCardProps {
  onExpenseAdded?: () => void;
}

export const SuggestedExpensesCard: React.FC<SuggestedExpensesCardProps> = ({ onExpenseAdded }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [suggestions, setSuggestions] = useState<SuggestedExpense[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isConfirmAddModalOpen, setIsConfirmAddModalOpen] = useState(false);
  const [addingBatch, setAddingBatch] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const loadSuggestions = useCallback(() => {
    if (!user) return;
    const settings = getExpenseDetectionSettings();
    if (!settings.message_detection_enabled && !settings.cards_enabled) {
      setSuggestions([]);
      return;
    }
    const items = getSuggestedExpenses(user.id);
    setSuggestions(items);
  }, [user]);

  useEffect(() => {
    loadSuggestions();

    const handleStorageChange = () => {
      loadSuggestions();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadSuggestions]);

  if (suggestions.length === 0) return null;

  const messageSuggestions = suggestions.filter((s) => s.source === 'Message');
  const cardSuggestions = suggestions.filter((s) => s.source === 'Card');

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === suggestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(suggestions.map((s) => s.id));
    }
  };

  const handleAddSingle = async (sug: SuggestedExpense) => {
    if (!user) return;
    setAddingId(sug.id);

    try {
      await createExpense({
        user_id: user.id,
        amount: sug.amount,
        category: sug.category,
        description: sug.merchant,
        expense_date: sug.date,
        payment_method: sug.source === 'Card' ? 'Card' : 'UPI',
        source: sug.source,
      });

      dismissSuggestedExpense(user.id, sug.id);
      loadSuggestions();
      if (onExpenseAdded) onExpenseAdded();

      setSuccessNotice(`Added ${sug.merchant} (₹${sug.amount}) to expenses`);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      console.error('Failed to add suggested expense:', err);
    } finally {
      setAddingId(null);
    }
  };

  const handleIgnoreSingle = (id: string) => {
    if (!user) return;
    dismissSuggestedExpense(user.id, id);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    loadSuggestions();
  };

  const handleIgnoreAll = () => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to dismiss all detected expense suggestions?')) return;
    dismissAllSuggestedExpenses(user.id);
    setSelectedIds([]);
    loadSuggestions();
  };

  const handleAddSelectedBatch = async () => {
    if (!user || selectedIds.length === 0) return;
    setAddingBatch(true);

    try {
      const selectedItems = suggestions.filter((s) => selectedIds.includes(s.id));
      for (const item of selectedItems) {
        await createExpense({
          user_id: user.id,
          amount: item.amount,
          category: item.category,
          description: item.merchant,
          expense_date: item.date,
          payment_method: item.source === 'Card' ? 'Card' : 'UPI',
          source: item.source,
        });
        dismissSuggestedExpense(user.id, item.id);
      }

      setIsConfirmAddModalOpen(false);
      setSelectedIds([]);
      loadSuggestions();
      if (onExpenseAdded) onExpenseAdded();

      setSuccessNotice(`Successfully approved and added ${selectedItems.length} expenses`);
      setTimeout(() => setSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Failed to add selected batch:', err);
    } finally {
      setAddingBatch(false);
    }
  };

  const renderExpenseItem = (sug: SuggestedExpense, isCard: boolean) => {
    const isSelected = selectedIds.includes(sug.id);
    const isAdding = addingId === sug.id;
    const isToday = sug.date === new Date().toISOString().split('T')[0];

    return (
      <div
        key={sug.id}
        id={`suggested-expense-${sug.id}`}
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
          isSelected
            ? 'border-[#D4AF37] bg-[#D4AF37]/5 shadow-xs'
            : isDark
            ? 'border-[#2A2926] bg-[#151515]'
            : 'border-[#E6DFC8] bg-[#FAF8F5]'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(sug.id)}
            className="mt-1 rounded border-[#E6DFC8] text-[#C59B27] focus:ring-[#D4AF37]"
          />

          <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#C59B27] shrink-0">
            {isCard ? (
              <CreditCard className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-black dark:text-white truncate">
                {sug.merchant}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/30">
                {sug.category}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#292524] dark:text-[#A6A29A] mt-0.5 font-medium">
              <span>{isToday ? 'Today' : formatDate(sug.date)}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#8C6B1F] dark:text-[#E6CA65]">
                Source: {sug.source}
              </span>
            </div>
          </div>
        </div>

        {/* Amount & Manual Approval Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E6DFC8] dark:border-[#2A2926]">
          <span className="text-base font-black font-mono text-[#8C6B1F] dark:text-[#E6CA65]">
            {formatCurrency(sug.amount)}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              id={`add-btn-${sug.id}`}
              type="button"
              onClick={() => handleAddSingle(sug)}
              disabled={isAdding}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-xs border border-[#B38A22]/40 disabled:opacity-50"
            >
              {isAdding ? (
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              )}
              <span>{isCard ? 'Add Expense' : 'Add'}</span>
            </button>

            <button
              id={`ignore-btn-${sug.id}`}
              type="button"
              onClick={() => handleIgnoreSingle(sug.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#E6DFC8] dark:border-[#2A2926] text-black/70 dark:text-[#A6A29A] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Ignore"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ignore</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      id="suggested-expenses-container"
      className={`rounded-2xl border p-5 sm:p-6 mb-6 transition-all ${
        isDark
          ? 'bg-[#0B0B0B] border-[#2A2926] text-white shadow-xl'
          : 'bg-white border-[#E6DFC8] text-black shadow-xs'
      }`}
    >
      {/* Top Header with Global Bulk Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6DFC8] dark:border-[#2A2926]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#C59B27] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                className="text-base sm:text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Suggested Expenses ({suggestions.length})
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/30">
                Action Required
              </span>
            </div>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
              Rupxa detected potential expense information. Expenses are never added automatically without your manual approval.
            </p>
          </div>
        </div>

        {/* Global Bulk Actions */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              id="add-selected-expenses-btn"
              type="button"
              onClick={() => setIsConfirmAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-xs border border-[#B38A22]/40"
            >
              Add Selected ({selectedIds.length})
            </button>
          )}

          <button
            id="ignore-all-expenses-btn"
            type="button"
            onClick={handleIgnoreAll}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              isDark
                ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#2A2926]'
                : 'border-[#E6DFC8] text-black hover:bg-[#FAF8F5]'
            }`}
          >
            Ignore All
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successNotice && (
        <div className="mt-3 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Select All Checkbox bar */}
      <div className="flex items-center justify-between pt-3 pb-2 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-[#292524] dark:text-[#A6A29A]">
          <input
            type="checkbox"
            checked={selectedIds.length === suggestions.length && suggestions.length > 0}
            onChange={handleSelectAll}
            className="rounded border-[#E6DFC8] text-[#C59B27] focus:ring-[#D4AF37]"
          />
          <span>Select All</span>
        </label>
        <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
          Review and approve before adding
        </span>
      </div>

      {/* Section 1: Potential Expenses (from Messages) */}
      {messageSuggestions.length > 0 && (
        <div className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C59B27]" />
            <h3
              className="text-sm font-black text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Potential Expenses
            </h3>
            <span className="text-[10px] text-[#8C6B1F] dark:text-[#E6CA65] font-bold">
              ({messageSuggestions.length})
            </span>
          </div>
          <div className="space-y-2.5">
            {messageSuggestions.map((sug) => renderExpenseItem(sug, false))}
          </div>
        </div>
      )}

      {/* Section 2: Card Transactions (from Connected Cards) */}
      {cardSuggestions.length > 0 && (
        <div className="space-y-3 mt-4 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#C59B27]" />
            <h3
              className="text-sm font-black text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Card Transactions
            </h3>
            <span className="text-[10px] text-[#8C6B1F] dark:text-[#E6CA65] font-bold">
              ({cardSuggestions.length})
            </span>
          </div>
          <div className="space-y-2.5">
            {cardSuggestions.map((sug) => renderExpenseItem(sug, true))}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Multiple Add */}
      {isConfirmAddModalOpen && (
        <div
          id="confirm-batch-add-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="confirm-batch-add-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#C59B27] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3
                  className="font-black text-base text-black dark:text-white"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Add Selected Expenses?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !addingBatch && setIsConfirmAddModalOpen(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs text-[#292524] dark:text-[#A6A29A] font-medium leading-relaxed">
              <p>
                You are about to add <strong className="text-black dark:text-white font-bold">{selectedIds.length}</strong> selected detected items into your personal Rupxa expenses ledger.
              </p>
              <p>
                Each item will become an active expense and be calculated in your monthly totals and category tracking.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
              <button
                type="button"
                disabled={addingBatch}
                onClick={() => setIsConfirmAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E6DFC8] text-black hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                id="confirm-batch-add-submit-btn"
                type="button"
                disabled={addingBatch}
                onClick={handleAddSelectedBatch}
                className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 disabled:opacity-50 transition-all border border-[#B38A22]/40"
              >
                {addingBatch ? 'Adding Expenses...' : 'Confirm & Add All Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
