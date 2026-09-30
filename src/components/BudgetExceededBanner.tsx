import React, { useState } from 'react';
import { BudgetStatus } from '../types';
import { formatCurrency } from '../lib/formatters';
import { AlertTriangle, ArrowRight, X, SlidersHorizontal } from 'lucide-react';

interface BudgetExceededBannerProps {
  exceededCategories: BudgetStatus[];
  onOpenSettings: () => void;
}

export const BudgetExceededBanner: React.FC<BudgetExceededBannerProps> = ({
  exceededCategories,
  onOpenSettings,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (exceededCategories.length === 0 || dismissed) {
    return null;
  }

  const primaryCategory = exceededCategories[0];
  const totalOverspend = exceededCategories.reduce((sum, c) => sum + c.exceeded_by, 0);

  return (
    <div
      id="budget-exceeded-alert-banner"
      role="alert"
      className="relative overflow-hidden rounded-2xl border-2 border-[#D4AF37] bg-[#FFFDF7] dark:bg-[#1C160C] p-3.5 sm:p-4 text-black dark:text-white shadow-md shadow-amber-900/5 transition-all duration-300"
    >
      {/* Subtle luxury ambient highlight */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-90" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3">
          {/* Subtle pulsing indicator icon */}
          <div className="relative w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37] text-[#C59B27] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C59B27] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C59B27]" />
            </span>
            <AlertTriangle className="w-4 h-4 text-[#C59B27]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs sm:text-sm font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Monthly Budget Alert
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#FFF0D4] dark:bg-amber-500/20 text-[#8C6B1F] dark:text-amber-300 border border-[#D4AF37]">
                {exceededCategories.length === 1 ? '1 Limit Exceeded' : `${exceededCategories.length} Limits Exceeded`}
              </span>
            </div>

            <p className="text-xs text-[#292524] dark:text-[#E6E1D8] mt-0.5 leading-relaxed font-medium">
              {exceededCategories.length === 1 ? (
                <>
                  <strong className="text-black dark:text-white font-bold">{primaryCategory.category}</strong> spending (
                  <span className="font-mono font-bold text-[#8C6B1F] dark:text-amber-300">{formatCurrency(primaryCategory.spent_amount)}</span>) has exceeded your target of{' '}
                  <span className="font-mono font-bold text-black dark:text-white">{formatCurrency(primaryCategory.limit_amount)}</span> by{' '}
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">+{formatCurrency(primaryCategory.exceeded_by)}</span>.
                </>
              ) : (
                <>
                  Spending targets exceeded in{' '}
                  <strong className="text-black dark:text-white font-bold">
                    {exceededCategories.map((c) => c.category).join(', ')}
                  </strong>{' '}
                  by a combined{' '}
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">+{formatCurrency(totalOverspend)}</span>.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 text-black transition-all shadow-sm active:scale-95 border border-[#B38A22]/40"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-black" />
            <span>Adjust Budgets</span>
            <ArrowRight className="w-3 h-3 ml-0.5 text-black" />
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss alert"
            title="Dismiss notification"
            className="p-1.5 rounded-lg text-black/60 dark:text-[#A6A29A] hover:text-black dark:hover:text-white hover:bg-[#D4AF37]/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
