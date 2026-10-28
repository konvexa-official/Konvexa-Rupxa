import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { normalizePhoneNumber, formatCurrency, formatDate } from '../lib/formatters';
import { createExpense } from '../lib/db';
import {
  User,
  Mail,
  Phone,
  Coins,
  Sun,
  Moon,
  Laptop,
  LogOut,
  Trash2,
  Check,
  CreditCard,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  History,
  Zap,
  QrCode,
  Shield,
} from 'lucide-react';
import {
  getExpenseDetectionSettings,
  saveExpenseDetectionSettings,
  getConnectedCards,
  addConnectedCard,
  disconnectCard,
  removeCard,
  getDetectionHistory,
  clearDetectionHistory,
  parseFinancialMessage,
  checkDuplicate,
  saveDetectionHistoryItem,
  sanitizeSnippet,
} from '../lib/expenseDetection';
import {
  ConnectedCard,
  ExpenseSourceSettings,
  DetectionHistoryItem,
  ParsedTransaction,
} from '../types';

export const Settings: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { theme, setTheme, isDark } = useTheme();

  // Profile form
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [upiId, setUpiId] = useState(user?.upi_id || '');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Automatic Expense Tracking from Messages
  const [detectionSettings, setDetectionSettings] = useState<ExpenseSourceSettings>(
    getExpenseDetectionSettings()
  );
  const [detectionHistory, setDetectionHistory] = useState<DetectionHistoryItem[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Manual Import Modal
  const [showManualImportModal, setShowManualImportModal] = useState(false);
  const [manualImportText, setManualImportText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [previewParsed, setPreviewParsed] = useState<ParsedTransaction | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Optional Import History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Optional Feature: Card Connection (Tokenized metadata only)
  const [connectedCards, setConnectedCards] = useState<ConnectedCard[]>([]);
  const [showCardConsentModal, setShowCardConsentModal] = useState(false);
  const [cardConsentChecked, setCardConsentChecked] = useState(false);
  const [cardStep, setCardStep] = useState<'consent' | 'form'>('consent');
  const [cardName, setCardName] = useState('');
  const [cardProvider, setCardProvider] = useState('HDFC Bank');
  const [last4, setLast4] = useState('');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState<string | null>(null);

  // Account deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setUpiId(user.upi_id || '');
      setConnectedCards(getConnectedCards(user.id));
      setDetectionHistory(getDetectionHistory(user.id));
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSaving(true);
    setSavedSuccess(false);

    try {
      const cleanPhone = phone ? normalizePhoneNumber(phone) : '';
      await updateProfile({
        full_name: fullName.trim(),
        phone: cleanPhone,
        upi_id: upiId.trim() || null,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError('Failed to update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Toggle automatic expense tracking
  const handleInitiateToggleMessageDetection = () => {
    if (!detectionSettings.message_detection_enabled) {
      // Must show explicit consent modal first
      setShowConsentModal(true);
    } else {
      // Immediate disable
      const updated = saveExpenseDetectionSettings({
        message_detection_enabled: false,
        auto_record: false,
      });
      setDetectionSettings(updated);
      setStatusNotice('Automatic expense tracking disabled.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  // User confirms consent modal
  const handleConfirmConsent = () => {
    const updated = saveExpenseDetectionSettings({
      message_detection_enabled: true,
      auto_record: true,
    });
    setDetectionSettings(updated);
    setShowConsentModal(false);
    setStatusNotice('Automatic expense tracking enabled.');
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Open manual import modal
  const handleOpenManualImport = () => {
    setManualImportText('');
    setPreviewParsed(null);
    setAnalysisError(null);
    setDuplicateWarning(null);
    setImportSuccess(null);
    setShowManualImportModal(true);
  };

  // Analyze pasted message
  const handleAnalyzeMessage = async () => {
    if (!manualImportText.trim() || !user) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setDuplicateWarning(null);
    setPreviewParsed(null);
    setImportSuccess(null);

    try {
      const parseResult = parseFinancialMessage(manualImportText.trim(), user.id);
      if (!parseResult.is_financial) {
        setAnalysisError(
          parseResult.ignore_reason ||
            'Could not detect a valid financial transaction in this message. Please check the text and try again.'
        );
        return;
      }

      const parsed = parseResult as ParsedTransaction;
      setPreviewParsed(parsed);

      // Check duplicate
      const dupCheck = await checkDuplicate(user.id, parsed);
      if (dupCheck.isDuplicate) {
        setDuplicateWarning(
          dupCheck.reason || 'This transaction has already been added to your Rupxa expenses.'
        );
      }
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Error analyzing message.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Save manual import expense
  const handleAddManualExpense = async () => {
    if (!user || !previewParsed || duplicateWarning) return;
    setSavingExpense(true);
    setAnalysisError(null);

    try {
      const created = await createExpense({
        user_id: user.id,
        amount: previewParsed.amount,
        category: previewParsed.category,
        description: previewParsed.merchant,
        expense_date: previewParsed.date,
        payment_method: previewParsed.payment_method,
        source: 'Message',
      });

      // Save to detection history
      const historyItem: DetectionHistoryItem = {
        id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        raw_snippet: sanitizeSnippet(manualImportText),
        parsed: previewParsed,
        status: 'recorded',
        status_reason: `Imported manually as ${previewParsed.category} expense.`,
        expense_id: created.id,
      };
      saveDetectionHistoryItem(historyItem);

      // Update settings metrics
      const updatedSettings = saveExpenseDetectionSettings({
        last_import_at: new Date().toISOString(),
        total_detected_count: (detectionSettings.total_detected_count || 0) + 1,
      });
      setDetectionSettings(updatedSettings);
      setDetectionHistory(getDetectionHistory(user.id));

      setImportSuccess(`Added ₹${previewParsed.amount.toLocaleString('en-IN')} for ${previewParsed.merchant}!`);
      setTimeout(() => {
        setShowManualImportModal(false);
        setImportSuccess(null);
        setPreviewParsed(null);
        setManualImportText('');
      }, 1400);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Failed to add expense.');
    } finally {
      setSavingExpense(false);
    }
  };

  // Clear detection history
  const handleClearHistory = () => {
    if (!user) return;
    clearDetectionHistory(user.id);
    setDetectionHistory([]);
  };

  // Add Card Flow
  const handleOpenAddCard = () => {
    setCardStep('consent');
    setCardConsentChecked(false);
    setCardError(null);
    setCardName('');
    setCardProvider('HDFC Bank');
    setLast4('');
    setCardType('credit');
    setShowCardConsentModal(true);
  };

  const handleConsentContinue = () => {
    if (!cardConsentChecked) return;
    setCardStep('form');
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const clean4 = last4.replace(/\D/g, '');
    if (clean4.length !== 4) {
      setCardError('Please enter exactly the last 4 digits of the card.');
      return;
    }

    setCardSubmitting(true);
    setCardError(null);

    try {
      const added = addConnectedCard({
        userId: user.id,
        provider: cardProvider,
        cardName: cardName.trim() || `${cardProvider} Card`,
        last4: clean4,
        cardType,
      });

      setConnectedCards(getConnectedCards(user.id));
      setShowCardConsentModal(false);
      setCardSuccess(`Connected ${added.card_name} (${cardProvider} •••• ${clean4})`);
      setTimeout(() => setCardSuccess(null), 4000);
    } catch (err: unknown) {
      setCardError(err instanceof Error ? err.message : 'Failed to save card.');
    } finally {
      setCardSubmitting(false);
    }
  };

  const handleDisconnectCard = (cardId: string) => {
    if (!user) return;
    disconnectCard(user.id, cardId);
    setConnectedCards(getConnectedCards(user.id));
  };

  const handleRemoveCard = (cardId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to remove this card connection?')) return;
    removeCard(user.id, cardId);
    setConnectedCards(getConnectedCards(user.id));
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await logout();
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-8 sm:pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Preferences & Settings
          </h1>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1">
            Manage your personal profile, expense detection, payment sources, and security
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div
        id="profile-settings-card"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3.5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-[var(--border)]">
          <User className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Profile Information
          </h2>
        </div>

        {profileError && (
          <div className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{profileError}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Full Name
            </label>
            <input
              id="settings-fullname-input"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Email Address (Read-only)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="settings-email-input"
                type="email"
                readOnly
                disabled
                value={user?.email || ''}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] cursor-not-allowed opacity-80"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="settings-phone-input"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57] transition-all placeholder-[var(--text-muted)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-normal">
              Used by friends and peers to connect and invite you to shared expense splits.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Default UPI ID (VPA)
            </label>
            <div className="relative">
              <QrCode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B08D57]" />
              <input
                id="settings-upi-input"
                type="text"
                placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57] transition-all placeholder-[var(--text-muted)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-normal">
              Enables friends to settle their split share with 1 tap via Google Pay, PhonePe, or Paytm.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Default Currency Preference
            </label>
            <div className="relative">
              <Coins className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B08D57]" />
              <select
                id="settings-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57]"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              id="save-profile-btn"
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Status Notice Toast / Inline banner if present */}
      {statusNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Automatic Expense Tracking */}
      <div
        id="automatic-expense-tracking-card"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3.5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <h2
              className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Automatic Expense Tracking
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-normal leading-relaxed">
              Automatically detect expenses from bank and UPI transaction messages.
            </p>
            <p className="text-xs text-[var(--text-secondary)] font-normal leading-relaxed">
              Your transaction details are processed on your device to help track expenses.
            </p>
          </div>

          {/* Toggle: Enable automatic expense tracking */}
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {detectionSettings.message_detection_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                id="toggle-auto-expense-tracking-btn"
                type="button"
                role="switch"
                aria-checked={detectionSettings.message_detection_enabled}
                onClick={handleInitiateToggleMessageDetection}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#B08D57] focus:ring-offset-2 ${
                  detectionSettings.message_detection_enabled
                    ? 'bg-[#B08D57]'
                    : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                    detectionSettings.message_detection_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Actions bar: Manual Import button + optional Import History link */}
        <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <button
            id="import-transaction-manually-btn"
            type="button"
            onClick={handleOpenManualImport}
            className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Import manually</span>
          </button>

          {detectionHistory.length > 0 && (
            <button
              id="view-import-history-link"
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[#B08D57] transition-colors flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>History ({detectionHistory.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* OPTIONAL FEATURE 2: Payment Sources (Cards & Accounts) */}
      <div
        id="payment-sources-settings-card"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3.5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#B08D57]" />
            <div>
              <h2
                className="text-sm sm:text-base font-bold text-[var(--text-primary)]"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Payment Sources
              </h2>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-normal">
                Cards & Accounts
              </p>
            </div>
          </div>

          <button
            id="open-add-card-btn"
            type="button"
            onClick={handleOpenAddCard}
            className="px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Add Card</span>
          </button>
        </div>

        {connectedCards.length === 0 ? (
          <div className="py-6 sm:py-8 text-center text-[var(--text-secondary)]">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#B08D57]" />
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">No connected cards yet</p>
            <p className="text-[11px] sm:text-xs mt-0.5">Add cards to automatically match transactions from bank messages.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {connectedCards.map((card) => (
              <div
                key={card.id}
                className="p-3 sm:p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#B08D57]/15 text-[#B08D57] flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">{card.card_name}</p>
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-mono">{card.provider} •••• {card.last4}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDisconnectCard(card.id)}
                    className="px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] transition-colors"
                  >
                    {card.status === 'active' ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(card.id)}
                    className="p-1 sm:p-1.5 text-rose-500 hover:text-rose-700 transition-colors"
                    title="Remove card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Theme Section */}
      <div
        id="theme-settings-card"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3.5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-[var(--border)]">
          <Sun className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Theme & Appearance
          </h2>
        </div>

        <div>
          <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2.5 sm:mb-3">
            Interface Theme
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md">
            <button
              id="theme-option-light"
              type="button"
              onClick={() => setTheme('light')}
              className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center gap-1.5 sm:gap-2 transition-all ${
                theme === 'light'
                  ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] font-bold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-[#0B0B0B]' : 'text-[#B08D57]'}`} />
              <span className="text-xs font-bold">Off-White</span>
            </button>

            <button
              id="theme-option-dark"
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center gap-1.5 sm:gap-2 transition-all ${
                theme === 'dark'
                  ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] font-bold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
              }`}
            >
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-[#0B0B0B]' : 'text-[#B08D57]'}`} />
              <span className="text-xs font-bold">Dark</span>
            </button>

            <button
              id="theme-option-system"
              type="button"
              onClick={() => setTheme('system')}
              className={`p-2.5 sm:p-3 rounded-xl border flex flex-col items-center gap-1.5 sm:gap-2 transition-all ${
                theme === 'system'
                  ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] font-bold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
              }`}
            >
              <Laptop className={`w-4 h-4 ${theme === 'system' ? 'text-[#0B0B0B]' : 'text-[#B08D57]'}`} />
              <span className="text-xs font-bold">System</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div
        id="account-settings-card"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3.5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-[var(--border)]">
          <Shield className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Account & Security
          </h2>
        </div>

        {cardSuccess && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{cardSuccess}</span>
          </div>
        )}

        {/* List of Connected Cards */}
        {connectedCards.length === 0 ? (
          <div className="py-8 px-4 text-center border border-dashed rounded-xl border-[var(--border)] bg-[var(--surface-secondary)]/50">
            <CreditCard className="w-8 h-8 mx-auto text-[#B08D57] mb-2 opacity-75" />
            <p className="text-xs font-bold text-[var(--text-primary)] mb-1">
              No cards connected
            </p>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto font-normal">
              Connecting a card helps organize eligible transaction metadata. Sensitive numbers and CVVs are never stored.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connectedCards.map((card) => {
              const isActive = card.status === 'active';

              return (
                <div
                  key={card.id}
                  id={`connected-card-${card.id}`}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isActive
                      ? 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                      : 'border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-8 rounded-lg bg-[#B08D57] text-[#0B0B0B] font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                      {card.provider.slice(0, 4).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">
                          {card.card_name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded font-bold uppercase ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
                          }`}
                        >
                          {isActive ? 'Active' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-xs font-mono font-medium text-[#B08D57] mt-0.5">
                        {card.provider} •••• {card.last4} ({card.card_type})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnectCard(card.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(card.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Theme Section */}
      <div
        id="theme-settings-card"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
          <Sun className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Theme & Appearance
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Interface Theme
          </label>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <button
              id="theme-option-light"
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'light'
                  ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] font-bold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-[#0B0B0B]' : 'text-[#B08D57]'}`} />
              <span className="text-xs font-bold">Off-White</span>
            </button>

            <button
              id="theme-option-dark"
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'dark'
                  ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] font-bold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
              }`}
            >
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-[#0B0B0B]' : 'text-[#B08D57]'}`} />
              <span className="text-xs font-bold">Dark</span>
            </button>

            <button
              id="theme-option-system"
              type="button"
              onClick={() => setTheme('system')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'system'
                  ? 'bg-[#B08D57] text-[#0B0B0B] border-[#B08D57] font-bold shadow-xs'
                  : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-[#B08D57] hover:text-[var(--text-primary)]'
              }`}
            >
              <Laptop className={`w-4 h-4 ${theme === 'system' ? 'text-[#0B0B0B]' : 'text-[#B08D57]'}`} />
              <span className="text-xs font-bold">System</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div
        id="account-settings-card"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-5 sm:p-6 transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
          <Shield className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Account & Security
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Sign Out</p>
              <p className="text-xs text-[var(--text-secondary)] font-normal">
                End your active Konvexa Rupxa session on this browser.
              </p>
            </div>
            <button
              id="settings-logout-btn"
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:border-[#B08D57] transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="border-t border-[var(--border)] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Delete Account</p>
              <p className="text-xs text-[var(--text-secondary)] font-normal">
                Permanently remove your account and disconnect from all shared splits.
              </p>
            </div>
            <button
              id="open-delete-account-btn"
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>



      {/* 1. SIMPLE CONSENT DIALOG */}
      {showConsentModal && (
        <div
          id="consent-dialog-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="consent-dialog-card"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3
                className="font-bold text-base text-[var(--text-primary)]"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Enable automatic expense tracking?
              </h3>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] font-normal leading-relaxed">
              Rupxa will process supported financial transaction messages to identify amounts, dates, and merchants. Your messages will not be uploaded as complete message histories.
            </p>

            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
              <span className="font-semibold text-[var(--text-primary)] block mb-0.5">Note on Browser Support</span>
              Direct background SMS reading is not available in web browsers. Use manual import to add transactions from messages, or enable automatic recording for imported messages.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
              <button
                id="consent-cancel-btn"
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
              >
                Cancel
              </button>
              <button
                id="consent-enable-btn"
                type="button"
                onClick={handleConfirmConsent}
                className="px-5 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MANUAL IMPORT MODAL */}
      {showManualImportModal && (
        <div
          id="manual-import-modal-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="manual-import-modal-card"
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] shrink-0">
              <div>
                <h3
                  className="font-bold text-base text-[var(--text-primary)]"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Import a transaction manually
                </h3>
                <p className="text-xs text-[var(--text-secondary)] font-normal mt-0.5">
                  Paste a bank or UPI transaction message to detect and record an expense.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualImportModal(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Text Area */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Transaction Message
                </label>
                <textarea
                  id="manual-import-textarea"
                  rows={3}
                  value={manualImportText}
                  onChange={(e) => {
                    setManualImportText(e.target.value);
                    if (previewParsed) setPreviewParsed(null);
                    if (analysisError) setAnalysisError(null);
                    if (duplicateWarning) setDuplicateWarning(null);
                  }}
                  placeholder="Paste bank debit alert, UPI payment message, or card transaction text here..."
                  className="w-full p-3 rounded-xl text-xs font-mono border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57] placeholder-[var(--text-muted)]"
                />
              </div>

              {/* Analyze Button */}
              <div className="flex justify-end">
                <button
                  id="analyze-message-btn"
                  type="button"
                  disabled={!manualImportText.trim() || analyzing}
                  onClick={handleAnalyzeMessage}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 disabled:opacity-50 transition-all shadow-xs"
                >
                  {analyzing ? 'Analyzing Message...' : 'Analyze Message'}
                </button>
              </div>

              {/* Error Banner */}
              {analysisError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {/* Success Notification */}
              {importSuccess && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {/* Detected Preview */}
              {previewParsed && (
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Detected Transaction
                    </span>
                    <span
                      className="text-base font-bold font-mono text-[#B08D57]"
                      style={{ fontFamily: 'Space Grotesk, monospace' }}
                    >
                      {formatCurrency(previewParsed.amount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Merchant</span>
                      <span className="font-semibold text-[var(--text-primary)] truncate block">
                        {previewParsed.merchant}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Date</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatDate(previewParsed.date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Category</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {previewParsed.category}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Payment Method</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {previewParsed.payment_method}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowManualImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>

              {previewParsed && !duplicateWarning && (
                <button
                  id="add-manual-expense-btn"
                  type="button"
                  disabled={savingExpense}
                  onClick={handleAddManualExpense}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs"
                >
                  {savingExpense ? 'Adding Expense...' : 'Add Expense'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. OPTIONAL IMPORT HISTORY MODAL */}
      {showHistoryModal && (
        <div
          id="import-history-modal-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="import-history-modal-card"
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#B08D57]" />
                <h3
                  className="font-bold text-base text-[var(--text-primary)]"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Import History
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              {detectionHistory.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
                  No transaction messages have been imported yet.
                </div>
              ) : (
                detectionHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-primary)] truncate">
                          {item.parsed?.merchant || 'Transaction Message'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            item.status === 'recorded'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : item.status === 'duplicate'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30'
                          }`}
                        >
                          {item.status === 'recorded'
                            ? 'Recorded'
                            : item.status === 'duplicate'
                            ? 'Duplicate'
                            : 'Ignored'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {formatDate(item.timestamp)}
                        {item.parsed?.category ? ` • ${item.parsed.category}` : ''}
                      </p>
                    </div>

                    {item.parsed && (
                      <span className="font-bold font-mono text-[var(--text-primary)] text-xs shrink-0">
                        {formatCurrency(item.parsed.amount)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between shrink-0">
              {detectionHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Clear History
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 transition-all shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Card Flow Modal */}
      {showCardConsentModal && (
        <div
          id="add-card-modal-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="add-card-modal-card"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#B08D57]" />
                <h3 className="font-bold text-base text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {cardStep === 'consent' ? 'Connect your card' : 'Card Metadata'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCardConsentModal(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Explicit Consent Screen */}
            {cardStep === 'consent' && (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl border border-[#B08D57]/30 bg-[#B08D57]/10 text-xs space-y-2">
                  <p className="font-bold text-[var(--text-primary)]">
                    Connecting a card can help Rupxa organize eligible transaction information.
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    Your full card number and CVV must never be stored by Rupxa. We only register safe tokenized identifiers (network, nickname, and last 4 digits).
                  </p>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] cursor-pointer">
                  <input
                    id="card-consent-checkbox"
                    type="checkbox"
                    checked={cardConsentChecked}
                    onChange={(e) => setCardConsentChecked(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--border)] text-[#B08D57] focus:ring-[#B08D57]"
                  />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    I understand and want to connect my card
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setShowCardConsentModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="consent-continue-btn"
                    type="button"
                    disabled={!cardConsentChecked}
                    onClick={handleConsentContinue}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 disabled:opacity-50 transition-all shadow-xs"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Safe Card Identifier Form */}
            {cardStep === 'form' && (
              <form onSubmit={handleSaveCard} className="mt-4 space-y-4">
                {cardError && (
                  <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{cardError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Card Nickname
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dining Rewards, Primary Credit"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57] placeholder-[var(--text-muted)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Bank / Network
                    </label>
                    <select
                      value={cardProvider}
                      onChange={(e) => setCardProvider(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57]"
                    >
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="SBI Card">SBI Card</option>
                      <option value="Axis Bank">Axis Bank</option>
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="American Express">Amex</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                      Card Type
                    </label>
                    <select
                      value={cardType}
                      onChange={(e) => setCardType(e.target.value as 'credit' | 'debit')}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57]"
                    >
                      <option value="credit">Credit Card</option>
                      <option value="debit">Debit Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Last 4 Digits Only
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="4821"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold tracking-widest border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] focus:ring-1 focus:ring-[#B08D57] placeholder-[var(--text-muted)]"
                  />
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-normal">
                    Preview: <strong className="text-[var(--text-primary)]">{cardProvider} •••• {last4 || '••••'}</strong>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                  Never enter your full 16-digit card number, CVV, PIN, or OTP. Rupxa never stores sensitive financial credentials.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCardStep('consent')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    id="save-card-btn"
                    type="submit"
                    disabled={cardSubmitting || last4.length !== 4}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 disabled:opacity-50 transition-all shadow-xs"
                  >
                    {cardSubmitting ? 'Connecting...' : 'Save Card'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div
          id="delete-account-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="delete-account-modal-card"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl"
          >
            <h3 className="font-bold text-base text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Confirm Account Deletion
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-2 mb-4 leading-relaxed font-normal">
              This action is permanent and cannot be reversed. You will be logged out immediately.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-account-btn"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
