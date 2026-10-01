import React, { useState, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  QrCode,
  Users,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { SplitGroup, SplitMember, GroupExpense } from '../types';
import { PairwiseDebt, buildUpiIntentUrl } from '../lib/upiUtils';
import { formatCurrency } from '../lib/formatters';

interface ShareSplitSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: SplitGroup;
  members: SplitMember[];
  expenses: GroupExpense[];
  memberBalances: { [userId: string]: { paid: number; share: number; net: number } };
  debts: PairwiseDebt[];
  isDark?: boolean;
}

export const ShareSplitSummaryModal: React.FC<ShareSplitSummaryModalProps> = ({
  isOpen,
  onClose,
  group,
  members,
  expenses,
  memberBalances,
  debts,
  isDark = true,
}) => {
  const [includeUpiLinks, setIncludeUpiLinks] = useState<boolean>(true);
  const [includeExpenses, setIncludeExpenses] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Generate plain-text formatted digest for WhatsApp / Telegram / SMS
  const summaryText = useMemo(() => {
    const lines: string[] = [];

    lines.push(`🧾 *Rupxa Split Summary: ${group.name}*`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(
      `💰 Total Spend: ${formatCurrency(group.total_amount)} (${expenses.length} ${
        expenses.length === 1 ? 'expense' : 'expenses'
      })`
    );
    lines.push(`👥 Members: ${members.length}`);
    lines.push(``);

    // Member balances
    lines.push(`📊 *Net Balances:*`);
    members.forEach((m) => {
      const name = m.profile?.full_name || 'Member';
      const bal = memberBalances[m.user_id]?.net || 0;
      if (bal > 0.01) {
        lines.push(`• ${name}: +${formatCurrency(bal)} (gets back)`);
      } else if (bal < -0.01) {
        lines.push(`• ${name}: -${formatCurrency(Math.abs(bal))} (owes)`);
      } else {
        lines.push(`• ${name}: Settled (₹0)`);
      }
    });
    lines.push(``);

    // Simplified settlement debts
    if (debts.length > 0) {
      lines.push(`💸 *Who Owes Whom:*`);
      debts.forEach((debt) => {
        lines.push(`• ${debt.fromName} owes ${debt.toName}: ${formatCurrency(debt.amount)}`);
        if (includeUpiLinks) {
          if (debt.toUpiId) {
            const upiUrl = buildUpiIntentUrl({
              upiId: debt.toUpiId,
              name: debt.toName,
              amount: debt.amount,
              note: `Rupxa - ${group.name}`,
            });
            lines.push(`  👉 Pay UPI (${debt.toUpiId}): ${upiUrl}`);
          } else {
            lines.push(`  👉 Pay to ${debt.toName}`);
          }
        }
      });
      lines.push(``);
    } else {
      lines.push(`🎉 *All debts are fully settled!*`);
      lines.push(``);
    }

    // Recent Expenses
    if (includeExpenses && expenses.length > 0) {
      lines.push(`📋 *Recent Expenses:*`);
      expenses.slice(0, 5).forEach((e) => {
        const paidBy = e.paid_by_profile?.full_name || 'Member';
        lines.push(`• ${e.name}: ${formatCurrency(e.amount)} (Paid by ${paidBy})`);
      });
      if (expenses.length > 5) {
        lines.push(`• ... and ${expenses.length - 5} more`);
      }
      lines.push(``);
    }

    lines.push(`✨ Tracked with *Rupxa* — Your money, clearly mapped.`);
    return lines.join('\n');
  }, [group, members, expenses, memberBalances, debts, includeUpiLinks, includeExpenses]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(summaryText);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rupxa Split: ${group.name}`,
          text: summaryText,
        });
      } catch (err) {
        console.warn('Share cancelled or failed:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl transition-all overflow-hidden my-6 ${
          isDark
            ? 'bg-[#0E0E0E] border-[#2A2926] text-white'
            : 'bg-white border-[#E6DFC8] text-black'
        }`}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#2A2926] flex items-center justify-between bg-gradient-to-r from-[#D4AF37]/15 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black shadow-md">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="text-lg font-black tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Share Group Digest
              </h3>
              <p className="text-xs text-[#A6A29A]">
                1-Click formatted summary for WhatsApp, Telegram & Chat groups
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#A6A29A] hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Options Toggles */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeUpiLinks}
                onChange={(e) => setIncludeUpiLinks(e.target.checked)}
                className="w-4 h-4 rounded text-[#D4AF37] focus:ring-0 accent-[#D4AF37]"
              />
              <span className="font-bold text-black dark:text-white">Include UPI Links</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeExpenses}
                onChange={(e) => setIncludeExpenses(e.target.checked)}
                className="w-4 h-4 rounded text-[#D4AF37] focus:ring-0 accent-[#D4AF37]"
              />
              <span className="font-bold text-black dark:text-white">Include Recent Expenses</span>
            </label>
          </div>

          {/* Styled Text Preview Card */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A6A29A]">
              Live Digest Preview
            </span>
            <div
              className={`p-4 rounded-2xl border font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto ${
                isDark
                  ? 'bg-[#141414] border-[#2A2926] text-[#E6DFC8]'
                  : 'bg-[#FAF8F5] border-[#E6DFC8] text-[#292524]'
              }`}
            >
              {summaryText}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#2A2926]">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-[#2A2926] hover:bg-white/5 text-[#A6A29A] hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {'share' in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-[#2A2926] hover:bg-white/5 text-white transition-colors"
                >
                  <Share2 className="w-4 h-4 text-[#8C6B1F] dark:text-[#E6CA65]" />
                  <span>Share Sheet</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-black bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-105 shadow-xl transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Send to WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
