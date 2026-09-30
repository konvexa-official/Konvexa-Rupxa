import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Expense, ExpenseCategory } from '../types';
import { BUDGET_CATEGORIES } from '../lib/budgetHelpers';
import { formatCurrency, parseMoney } from '../lib/formatters';
import { saveCategoryBudgets } from '../lib/db';
import { getCategoryIcon } from './Dashboard';
import {
  X,
  Check,
  Target,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface BudgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBudgets: Record<string, number>;
  expenses: Expense[];
  onBudgetsSaved: (newBudgets: Record<string, number>) => void;
}

const PRESET_AMOUNTS = [3000, 5000, 10000, 15000, 25000];

export const BudgetSettingsModal: React.FC<BudgetSettingsModalProps> = ({
  isOpen,
  onClose,
  currentBudgets,
  expenses,
  onBudgetsSaved,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Local state for category inputs: category -> string amount
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compute current month expenses per category to display context
  const currentMonthSpend = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map: Record<string, number> = {};

    expenses.forEach((e) => {
      if (e.expense_date && e.expense_date.substring(0, 7) === currentYearMonth) {
        map[e.category] = (map[e.category] || 0) + parseMoney(e.amount);
      }
    });
    return map;
  }, [expenses]);

  // Synchronize initial budget inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      BUDGET_CATEGORIES.forEach((cat) => {
        const val = currentBudgets[cat];
        initial[cat] = val && val > 0 ? val.toString() : '';
      });
      setBudgetInputs(initial);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentBudgets]);

  if (!isOpen) return null;

  const handleInputChange = (category: string, value: string) => {
    const clean = value.replace(/[^0-9.]/g, '');
    setBudgetInputs((prev) => ({ ...prev, [category]: clean }));
  };

  const handlePresetClick = (category: string, amount: number) => {
    setBudgetInputs((prev) => ({ ...prev, [category]: amount.toString() }));
  };

  const handleClearCategory = (category: string) => {
    setBudgetInputs((prev) => ({ ...prev, [category]: '' }));
  };

  const totalBudgetPlanned = Object.values(budgetInputs).reduce(
    (sum, val) => sum + parseMoney(val),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to configure budget targets.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const newBudgets: Record<string, number> = {};
      Object.entries(budgetInputs).forEach(([cat, val]) => {
        const num = parseMoney(val);
        if (num > 0) {
          newBudgets[cat] = num;
        }
      });

      await saveCategoryBudgets(user.id, newBudgets);
      onBudgetsSaved(newBudgets);
      setSuccessMsg('Budget targets saved successfully!');

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save budgets. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="budget-settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        id="budget-settings-card"
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl transition-all overflow-hidden ${
          isDark
            ? 'bg-[#0E0C0A] border-[#2A2926] text-white shadow-black/80'
            : 'bg-white border-[#E6DFC8] text-black'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E6DFC8] dark:border-[#2A2926] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#8C6B1F] dark:text-[#E6CA65] flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-[#C59B27]" />
            </div>
            <div>
              <h2
                className="text-base sm:text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Monthly Category Budgets
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Set monthly targets per category. We&apos;ll subtly alert you if you exceed them.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-black/60 dark:text-[#A6A29A] hover:text-black dark:hover:text-white hover:bg-[#FAF8F5] dark:hover:bg-[#2A2926]/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Info Strip */}
          <div
            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
              isDark ? 'bg-[#15120E] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}
          >
            <div className="flex items-center gap-2 text-[#292524] dark:text-[#A6A29A] font-medium">
              <Sparkles className="w-4 h-4 text-[#C59B27]" />
              <span>Leave blank or ₹0 for any category you do not wish to limit.</span>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-[10px] uppercase font-bold text-[#292524] dark:text-[#A6A29A]">
                Total Target:
              </span>
              <span className="font-black text-[#8C6B1F] dark:text-[#E6CA65] text-sm">
                {formatCurrency(totalBudgetPlanned)}
              </span>
            </div>
          </div>

          {/* Category Input Rows */}
          <div className="space-y-3">
            {BUDGET_CATEGORIES.map((cat: ExpenseCategory) => {
              const Icon = getCategoryIcon(cat);
              const val = budgetInputs[cat] || '';
              const limitNum = parseMoney(val);
              const spentNum = currentMonthSpend[cat] || 0;
              const isOver = limitNum > 0 && spentNum > limitNum;
              const isNear = limitNum > 0 && spentNum >= limitNum * 0.8 && !isOver;

              return (
                <div
                  key={cat}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isOver
                      ? 'border-[#D4AF37] bg-[#FFFBF0] dark:bg-amber-950/20'
                      : isDark
                      ? 'bg-[#14110E] border-[#2A2926] hover:border-[#D4AF37]/50'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] hover:border-[#D4AF37]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Category Label & Current Month Spend */}
                    <div className="flex items-center gap-3 min-w-0 sm:w-1/3">
                      <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[#C59B27]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-black dark:text-white truncate">
                            {cat}
                          </span>
                          {isOver && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FFF0D4] dark:bg-amber-500/20 text-[#8C6B1F] dark:text-amber-400 border border-[#D4AF37]">
                              Exceeded
                            </span>
                          )}
                          {isNear && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FFF9EE] dark:bg-yellow-500/20 text-[#8C6B1F] dark:text-yellow-400 border border-[#D4AF37]/50">
                              Near Limit
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
                          Spent this mo:{' '}
                          <span className="font-mono font-bold text-black dark:text-white">
                            {formatCurrency(spentNum)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Input Field & Presets */}
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-end gap-2">
                      {/* Presets */}
                      <div className="hidden lg:flex items-center gap-1">
                        {PRESET_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handlePresetClick(cat, amt)}
                            className="text-[10px] font-mono font-bold px-2 py-1 rounded-md bg-white dark:bg-[#1E1914] text-black dark:text-white hover:border-[#D4AF37] border border-[#E6DFC8] dark:border-[#2A2926] transition-colors"
                          >
                            ₹{amt >= 1000 ? `${amt / 1000}k` : amt}
                          </button>
                        ))}
                      </div>

                      {/* Currency Input Container */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`relative flex items-center rounded-xl border px-3 py-1.5 w-full sm:w-36 transition-colors ${
                            isDark
                              ? 'bg-[#0B0B0B] border-[#2A2926] focus-within:border-[#D4AF37]'
                              : 'bg-white border-[#E6DFC8] focus-within:border-[#D4AF37] focus-within:ring-1 focus-within:ring-[#D4AF37]'
                          }`}
                        >
                          <span className="text-xs text-[#8C6B1F] dark:text-[#E6CA65] font-mono font-bold mr-1 select-none">
                            ₹
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="No limit"
                            value={val}
                            onChange={(e) => handleInputChange(cat, e.target.value)}
                            className="w-full bg-transparent text-xs sm:text-sm font-mono font-bold outline-none text-black dark:text-white placeholder-[#8F8A80] dark:placeholder-[#666]"
                          />
                        </div>

                        {val && (
                          <button
                            type="button"
                            onClick={() => handleClearCategory(cat)}
                            title="Clear target"
                            className="p-1 rounded text-black/60 dark:text-[#A6A29A] hover:text-black hover:bg-[#FAF8F5] transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#E6DFC8] dark:border-[#2A2926] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setBudgetInputs({});
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-black/70 dark:text-[#A6A29A] hover:text-black dark:hover:text-white hover:bg-[#FAF8F5] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#C59B27]" />
            <span>Clear All Targets</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E6DFC8] dark:border-[#2A2926] hover:bg-[#FAF8F5] text-black dark:text-[#A6A29A] transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 shadow-sm transition-all disabled:opacity-50 border border-[#B38A22]/40"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{loading ? 'Saving...' : 'Save Targets'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
