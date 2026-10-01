import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Banknote,
  Send,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Profile } from '../types';
import { buildUpiIntentUrl, generateUpiQrCodeDataUrl } from '../lib/upiUtils';
import { formatCurrency } from '../lib/formatters';

interface UpiSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  fromProfile: Profile;
  toProfile: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    upi_id?: string | null;
  };
  debtAmount: number;
  onConfirmSettlement: (params: {
    amount: number;
    paymentMethod: 'UPI' | 'Cash' | 'Bank' | 'Other';
    upiRefId?: string;
    note?: string;
  }) => Promise<void>;
  isDark?: boolean;
}

export const UpiSettlementModal: React.FC<UpiSettlementModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  fromProfile,
  toProfile,
  debtAmount,
  onConfirmSettlement,
  isDark = true,
}) => {
  const [recipientUpi, setRecipientUpi] = useState<string>(toProfile.upi_id || '');
  const [amount, setAmount] = useState<number>(debtAmount);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | 'Bank'>('UPI');
  const [upiRefId, setUpiRefId] = useState<string>('');
  const [note, setNote] = useState<string>(`Rupxa Split - ${groupName}`);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(true);

  // Sync state when props change
  useEffect(() => {
    if (isOpen) {
      setRecipientUpi(toProfile.upi_id || '');
      setAmount(debtAmount);
      setNote(`Rupxa Split - ${groupName}`);
      setUpiRefId('');
      setShowQr(true);
    }
  }, [isOpen, toProfile.upi_id, debtAmount, groupName]);

  // Compute live UPI URL
  const activeUpi = recipientUpi.trim() || 'rupxa.settle@okhdfcbank';
  const upiIntentUrl = buildUpiIntentUrl({
    upiId: activeUpi,
    name: toProfile.full_name,
    amount: Number(amount) || 0,
    note: note || `Rupxa Split - ${groupName}`,
  });

  // Generate QR code whenever UPI URL changes
  useEffect(() => {
    let isMounted = true;
    if (recipientUpi.trim() && amount > 0) {
      generateUpiQrCodeDataUrl(upiIntentUrl)
        .then((url) => {
          if (isMounted) setQrDataUrl(url);
        })
        .catch(() => {
          if (isMounted) setQrDataUrl(null);
        });
    } else {
      setQrDataUrl(null);
    }
    return () => {
      isMounted = false;
    };
  }, [upiIntentUrl, recipientUpi, amount]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    if (!recipientUpi) return;
    navigator.clipboard.writeText(recipientUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(upiIntentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenUpiApp = () => {
    window.location.href = upiIntentUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    setIsSubmitting(true);
    try {
      await onConfirmSettlement({
        amount: Number(amount),
        paymentMethod,
        upiRefId: upiRefId.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to confirm settlement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl transition-all overflow-hidden my-6 ${
          isDark
            ? 'bg-[#0E0E0E] border-[#2A2926] text-white'
            : 'bg-white border-[#E6DFC8] text-black'
        }`}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#2A2926] dark:border-[#2A2926] flex items-center justify-between bg-gradient-to-r from-[#D4AF37]/15 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#DFB15B] to-[#C59B27] text-black flex items-center justify-center font-black shadow-md border border-[#B38A22]/50">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3
                className="text-lg font-black tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Settle via UPI
              </h3>
              <p className="text-xs text-[#A6A29A]">
                Instant 1-tap payment & on-screen QR Code
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {/* Transfer Summary Card */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              isDark
                ? 'bg-[#151515] border-[#2A2926]'
                : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}
          >
            {/* Payer (You) */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#2A2926] text-[#E6CA65] flex items-center justify-center text-xs font-bold shrink-0">
                {fromProfile.full_name?.[0]?.toUpperCase() || 'Y'}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-[#A6A29A] block">You</span>
                <span className="text-xs font-bold truncate block">
                  {fromProfile.full_name || 'You'}
                </span>
              </div>
            </div>

            {/* Arrow & Badge */}
            <div className="flex flex-col items-center gap-0.5 shrink-0 px-2">
              <span className="text-[10px] font-bold text-[#8C6B1F] dark:text-[#E6CA65] uppercase tracking-wider">
                Paying
              </span>
              <ArrowRight className="w-4 h-4 text-[#8C6B1F] dark:text-[#E6CA65]" />
            </div>

            {/* Recipient */}
            <div className="flex items-center gap-2.5 min-w-0 justify-end text-right">
              <div className="min-w-0">
                <span className="text-[11px] text-[#A6A29A] block">Recipient</span>
                <span className="text-xs font-bold truncate block text-emerald-400">
                  {toProfile.full_name}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-black flex items-center justify-center text-xs font-bold shrink-0">
                {toProfile.full_name?.[0]?.toUpperCase() || 'R'}
              </div>
            </div>
          </div>

          {/* Amount & Quick Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#A6A29A]">
                Settlement Amount (₹)
              </label>
              <span className="text-xs font-semibold text-[#8C6B1F] dark:text-[#E6CA65]">
                Owed: {formatCurrency(debtAmount)}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-[#8C6B1F] dark:text-[#E6CA65]">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className={`w-full pl-9 pr-4 py-3 rounded-xl border font-mono font-black text-xl tracking-tight transition-all outline-none ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] focus:border-[#D4AF37] text-white'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] focus:border-[#D4AF37] text-black'
                }`}
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAmount(debtAmount)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/25"
              >
                Full Debt ({formatCurrency(debtAmount)})
              </button>
              {debtAmount > 10 && (
                <button
                  type="button"
                  onClick={() => setAmount(Math.round(debtAmount / 2))}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/5 text-[#A6A29A] border border-white/10 hover:text-white"
                >
                  Half ({formatCurrency(Math.round(debtAmount / 2))})
                </button>
              )}
            </div>
          </div>

          {/* Recipient UPI ID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#A6A29A]">
                Recipient UPI ID (VPA)
              </label>
              {recipientUpi && (
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="text-[11px] font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline flex items-center gap-1"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy UPI</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={recipientUpi}
                onChange={(e) => setRecipientUpi(e.target.value)}
                placeholder="e.g. rahul@okhdfcbank or 9876543210@paytm"
                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono font-medium transition-all outline-none ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] focus:border-[#D4AF37] text-white'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] focus:border-[#D4AF37] text-black'
                }`}
              />
            </div>
            {!toProfile.upi_id && (
              <p className="text-[11px] text-[#A6A29A] flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0 text-[#8C6B1F] dark:text-[#E6CA65]" />
                <span>
                  {toProfile.full_name} hasn't added a UPI ID yet. You can enter it manually above.
                </span>
              </p>
            )}
          </div>

          {/* Dynamic UPI QR Section */}
          <div
            className={`p-4 rounded-2xl border transition-all text-center space-y-3 ${
              isDark
                ? 'bg-[#121212] border-[#2A2926]'
                : 'bg-[#F9F7F2] border-[#E6DFC8]'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#2A2926] pb-2 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-black dark:text-white">
                <QrCode className="w-4 h-4 text-[#8C6B1F] dark:text-[#E6CA65]" />
                <span>Scan with any UPI App</span>
              </span>
              <span className="text-[10px] text-[#A6A29A]">GPay · PhonePe · Paytm · BHIM</span>
            </div>

            {recipientUpi ? (
              <div className="flex flex-col items-center justify-center gap-3 py-2">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-[#D4AF37]/50 inline-block">
                    <img
                      src={qrDataUrl}
                      alt="UPI Payment QR Code"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 rounded-2xl bg-black/20 flex items-center justify-center text-xs text-[#A6A29A]">
                    Generating QR...
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={handleOpenUpiApp}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay in UPI App</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#2A2926] hover:bg-white/5 text-[#A6A29A] hover:text-white"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#A6A29A]">
                Enter {toProfile.full_name}'s UPI ID above to generate the instant payment QR code.
              </div>
            )}
          </div>

          {/* Record Settlement Details */}
          <div className="space-y-3 pt-2 border-t border-[#2A2926]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A6A29A] block">
              Confirm & Record Settlement
            </span>

            <div className="grid grid-cols-3 gap-2">
              {(['UPI', 'Cash', 'Bank'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === mode
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#8C6B1F] dark:text-[#E6CA65]'
                      : 'bg-white/5 border-[#2A2926] text-[#A6A29A] hover:text-white'
                  }`}
                >
                  {mode === 'UPI' && <QrCode className="w-3.5 h-3.5" />}
                  {mode === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                  {mode === 'Bank' && <CreditCard className="w-3.5 h-3.5" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#A6A29A] block mb-1">
                  UPI UTR / Reference ID (Optional)
                </label>
                <input
                  type="text"
                  value={upiRefId}
                  onChange={(e) => setUpiRefId(e.target.value)}
                  placeholder="e.g. 423982187391"
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-all outline-none ${
                    isDark
                      ? 'bg-[#151515] border-[#2A2926] text-white'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] text-[#A6A29A] block mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Lunch settled"
                  className={`w-full px-3 py-2 rounded-xl border text-xs transition-all outline-none ${
                    isDark
                      ? 'bg-[#151515] border-[#2A2926] text-white'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2926]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#A6A29A] hover:text-white border border-[#2A2926] hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-xl transition-all disabled:opacity-50 border border-[#B38A22]/50"
            >
              {isSubmitting ? (
                <span>Recording...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Mark as Settled (₹{amount})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
