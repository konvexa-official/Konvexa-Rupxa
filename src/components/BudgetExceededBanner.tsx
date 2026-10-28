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
      className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 sm:p-4 text-[var(--text-primary)] shadow-sm transition-all duration-300"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs sm:text-sm font-bold tracking-tight text-[var(--text-primary)]"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Monthly Budget Alert
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {exceededCategories.length === 1 ? '1 Limit Exceeded' : `${exceededCategories.length} Limits Exceeded`}
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed font-medium">
              {exceededCategories.length === 1 ? (
                <>
                  <strong className="text-[var(--text-primary)] font-semibold">{primaryCategory.category}</strong> spending (
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatCurrency(primaryCategory.spent_amount)}</span>) has exceeded your target of{' '}
                  <span className="font-mono font-bold text-[var(--text-primary)]">{formatCurrency(primaryCategory.limit_amount)}</span> by{' '}
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">+{formatCurrency(primaryCategory.exceeded_by)}</span>.
                </>
              ) : (
                <>
                  Spending targets exceeded in{' '}
                  <strong className="text-[var(--text-primary)] font-semibold">
                    {exceededCategories.map((c) => c.category).join(', ')}
                  </strong>{' '}
                  by a combined{' '}
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">+{formatCurrency(totalOverspend)}</span>.
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#B08D57] hover:brightness-105 text-[#0B0B0B] transition-all shadow-xs active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Adjust Budgets</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss alert"
            title="Dismiss notification"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
