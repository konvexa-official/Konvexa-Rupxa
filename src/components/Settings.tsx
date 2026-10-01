import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { normalizePhoneNumber } from '../lib/formatters';
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
  Shield,
  MessageSquare,
  CreditCard,
  Plus,
  AlertCircle,
  HelpCircle,
  Info,
  CheckCircle2,
  X,
  Sparkles,
  Sliders,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import {
  getExpenseDetectionSettings,
  saveExpenseDetectionSettings,
  getConnectedCards,
  addConnectedCard,
  disconnectCard,
  removeCard,
  parseTransactionMessage,
  addSuggestedExpense,
} from '../lib/expenseDetection';
import { ConnectedCard, ExpenseSourceSettings } from '../types';

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

  // User Controls: Manage Permissions modal
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  // Optional Feature 1: Expense Detection from Messages
  const [detectionSettings, setDetectionSettings] = useState<ExpenseSourceSettings>(
    getExpenseDetectionSettings()
  );
  const [showLearnMoreModal, setShowLearnMoreModal] = useState(false);
  const [testMessageText, setTestMessageText] = useState('');
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Optional Feature 2: Card Connection (Tokenized metadata only)
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

  // Toggle message expense detection
  const handleToggleMessageDetection = () => {
    const updated = saveExpenseDetectionSettings({
      message_detection_enabled: !detectionSettings.message_detection_enabled,
    });
    setDetectionSettings(updated);
  };

  // Local parser test
  const handleParseTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setParseError(null);
    setParseNotice(null);

    const parsed = parseTransactionMessage(testMessageText, user.id);
    if (!parsed) {
      setParseError(
        'Could not extract a valid transaction amount or merchant from this text. Please check the format.'
      );
      return;
    }

    try {
      addSuggestedExpense({
        user_id: user.id,
        merchant: parsed.merchant,
        amount: parsed.amount,
        date: parsed.date,
        category: parsed.category,
        source: 'Message',
      });
      setTestMessageText('');
      setParseNotice(`Identified ₹${parsed.amount} at ${parsed.merchant}. Suggested for your review in Potential Expenses!`);
      setTimeout(() => setParseNotice(null), 5000);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error adding suggestion.');
    }
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
    <div id="settings-view" className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E6DFC8] dark:border-[#2A2926]">
        <div>
          <h1
            className="text-2xl font-black tracking-tight text-black dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Preferences & Settings
          </h1>
          <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
            Manage your personal profile, expense detection, payment sources, and security
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div
        id="profile-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <User className="w-4 h-4 text-[#C59B27]" />
          <h2 className="text-base font-black text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Profile Information
          </h2>
        </div>

        {profileError && (
          <div className="mb-4 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{profileError}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 font-bold">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-1.5">
              Full Name
            </label>
            <input
              id="settings-fullname-input"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold border outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                  : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-1.5">
              Email Address (Read-only)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
              <input
                id="settings-email-input"
                type="email"
                readOnly
                disabled
                value={user?.email || ''}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono font-bold border cursor-not-allowed opacity-75 ${
                  isDark
                    ? 'bg-[#2A2926]/40 border-[#2A2926] text-[#A6A29A]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
              <input
                id="settings-phone-input"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono font-bold border outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              />
            </div>
            <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] mt-1 font-medium">
              Used by friends and peers to connect and invite you to shared expense splits.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-1.5">
              Default UPI ID (VPA)
            </label>
            <div className="relative">
              <QrCode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
              <input
                id="settings-upi-input"
                type="text"
                placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono font-bold border outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              />
            </div>
            <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] mt-1 font-medium">
              Enables friends to settle their split share with 1 tap via Google Pay, PhonePe, or Paytm.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-1.5">
              Default Currency Preference
            </label>
            <div className="relative">
              <Coins className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
              <select
                id="settings-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none appearance-none cursor-pointer ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
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
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* 7. USER CONTROLS */}
      <div
        id="user-controls-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926] mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C59B27]" />
            <h2
              className="text-base font-black text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              User Controls
            </h2>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#FAF8F5] text-[#292524] border-[#E6DFC8] dark:bg-[#151515] dark:text-[#A6A29A] dark:border-[#2A2926]">
            Privacy & Permissions
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Message Expense Detection: [ ON / OFF ] */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
              isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-black dark:text-white">
                Message Expense Detection
              </p>
              <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-0.5">
                {detectionSettings.message_detection_enabled
                  ? 'Active (User opted-in)'
                  : 'Disabled (Zero background access)'}
              </p>
            </div>
            <button
              id="user-control-toggle-detection-btn"
              type="button"
              onClick={handleToggleMessageDetection}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border self-start ${
                detectionSettings.message_detection_enabled
                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                  : 'bg-black/10 dark:bg-white/10 text-black dark:text-white border-[#E6DFC8] dark:border-[#2A2926] hover:bg-black/20'
              }`}
            >
              [ {detectionSettings.message_detection_enabled ? 'ON' : 'OFF'} ]
            </button>
          </div>

          {/* Connected Cards: [ Manage ] */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
              isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-black dark:text-white">
                Connected Cards
              </p>
              <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-0.5">
                {connectedCards.length} {connectedCards.length === 1 ? 'card' : 'cards'} registered
              </p>
            </div>
            <button
              id="user-control-manage-cards-btn"
              type="button"
              onClick={() => {
                document.getElementById('payment-sources-settings-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 border border-[#B38A22]/40 self-start"
            >
              [ Manage ]
            </button>
          </div>

          {/* Expense Import: [ Manage Permissions ] */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
              isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}
          >
            <div>
              <p className="text-xs font-bold text-black dark:text-white">
                Expense Import
              </p>
              <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium mt-0.5">
                Review data scope & permissions
              </p>
            </div>
            <button
              id="user-control-manage-permissions-btn"
              type="button"
              onClick={() => setShowPermissionsModal(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors self-start ${
                isDark
                  ? 'border-[#2A2926] text-white hover:bg-[#2A2926]'
                  : 'border-[#E6DFC8] text-black hover:bg-white'
              }`}
            >
              [ Manage Permissions ]
            </button>
          </div>
        </div>
      </div>

      {/* OPTIONAL FEATURE 1: Expense Sources (Message Expense Detection) */}
      <div
        id="expense-sources-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926] mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C59B27]" />
            <h2
              className="text-base font-black text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Expense Sources
            </h2>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              detectionSettings.message_detection_enabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-[#FAF8F5] text-[#292524] border-[#E6DFC8]'
            }`}
          >
            {detectionSettings.message_detection_enabled ? 'Detection Active' : 'Disabled'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-2">
              Expense Detection
            </h3>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E6DFC8] dark:border-[#2A2926] bg-[#FAF8F5] dark:bg-[#151515] cursor-pointer transition-colors">
              <input
                id="toggle-message-detection-checkbox"
                type="checkbox"
                checked={detectionSettings.message_detection_enabled}
                onChange={handleToggleMessageDetection}
                className="mt-0.5 rounded border-[#E6DFC8] text-[#C59B27] focus:ring-[#D4AF37]"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-black dark:text-white block">
                  Allow Rupxa to detect expenses from messages
                </span>
                <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium leading-relaxed">
                  Rupxa can identify potential expense information from supported messages and suggest it for your review.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLearnMoreModal(true);
                  }}
                  className="text-xs font-bold text-[#8C6B1F] dark:text-[#E6CA65] hover:underline inline-flex items-center gap-1 mt-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>[Learn More]</span>
                </button>
              </div>
            </label>
          </div>

          {/* Browser / Platform explanation */}
          <div className="p-3.5 rounded-xl border border-[#D4AF37]/30 bg-[#FFFDF7] dark:bg-[#1A160C] text-xs space-y-1 text-[#292524] dark:text-[#E6CA65]">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-3.5 h-3.5 text-[#C59B27]" />
              <span>Platform Transparency Note</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Standard web browsers do not grant automatic background access to private SMS or WhatsApp messages.
              Rupxa honors this zero-trust model: no silent background scanning is performed. When enabled, you can safely paste or share any bank transaction SMS below for instant local structured extraction.
            </p>
          </div>

          {/* Test / Manual import input when enabled */}
          {detectionSettings.message_detection_enabled && (
            <form onSubmit={handleParseTestMessage} className="space-y-3 pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white">
                  Import Transaction Message (Local Extraction)
                </label>
                <span className="text-[10px] text-[#292524] dark:text-[#A6A29A] font-semibold">
                  Zero Server Upload
                </span>
              </div>

              {parseNotice && (
                <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 font-bold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{parseNotice}</span>
                </div>
              )}

              {parseError && (
                <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 font-bold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <textarea
                rows={2}
                value={testMessageText}
                onChange={(e) => setTestMessageText(e.target.value)}
                placeholder="Paste transaction text (e.g., 'Rs. 450.00 spent on your Card at Starbucks on 30-Sep-2026. Avl bal...')"
                className={`w-full p-3 rounded-xl text-xs font-mono font-medium border outline-none ${
                  isDark
                    ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                }`}
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!testMessageText.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 disabled:opacity-50 transition-all border border-[#B38A22]/40 flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze & Suggest Expense</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* OPTIONAL FEATURE 2: Payment Sources (Cards & Accounts) */}
      <div
        id="payment-sources-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926] mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#C59B27]" />
            <div>
              <h2
                className="text-base font-black text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Payment Sources
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Cards & Accounts
              </p>
            </div>
          </div>

          <button
            id="open-add-card-btn"
            type="button"
            onClick={handleOpenAddCard}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-xs border border-[#B38A22]/40 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Add Card</span>
          </button>
        </div>

        {cardSuccess && (
          <div className="mb-4 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cardSuccess}</span>
          </div>
        )}

        {/* List of Connected Cards */}
        {connectedCards.length === 0 ? (
          <div className="py-8 px-4 text-center border border-dashed rounded-xl border-[#E6DFC8] dark:border-[#2A2926] bg-[#FAF8F5]/50 dark:bg-[#151515]/30">
            <CreditCard className="w-8 h-8 mx-auto text-[#C59B27] mb-2 opacity-75" />
            <p className="text-xs font-bold text-black dark:text-white mb-1">
              No cards connected
            </p>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] max-w-sm mx-auto font-medium">
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
                      ? isDark
                        ? 'border-[#2A2926] bg-[#151515]'
                        : 'border-[#E6DFC8] bg-[#FAF8F5]'
                      : 'border-dashed border-gray-300 bg-gray-50/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-8 rounded-lg bg-gradient-to-br from-[#DFB15B] to-[#C59B27] text-black font-black flex items-center justify-center text-xs shrink-0 shadow-xs border border-[#B38A22]/40">
                      {card.provider.slice(0, 4).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-black dark:text-white">
                          {card.card_name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded font-bold uppercase ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isActive ? 'Active' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-xs font-mono font-bold text-[#8C6B1F] dark:text-[#E6CA65] mt-0.5">
                        {card.provider} •••• {card.last4} ({card.card_type})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnectCard(card.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(card.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors"
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
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <Sun className="w-4 h-4 text-[#C59B27]" />
          <h2 className="text-base font-black text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Theme & Appearance
          </h2>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-3">
            Interface Theme
          </label>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <button
              id="theme-option-light"
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black border-[#B38A22] font-black shadow-xs'
                  : isDark
                  ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:border-[#D4AF37]'
                  : 'border-[#E6DFC8] bg-[#FAF8F5] text-black hover:border-[#D4AF37]'
              }`}
            >
              <Sun className="w-4 h-4 text-[#C59B27]" />
              <span className="text-xs font-bold">Off-White</span>
            </button>

            <button
              id="theme-option-dark"
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black border-[#B38A22] font-black shadow-xs'
                  : isDark
                  ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:border-[#D4AF37]'
                  : 'border-[#E6DFC8] bg-[#FAF8F5] text-black hover:border-[#D4AF37]'
              }`}
            >
              <Moon className="w-4 h-4 text-[#C59B27]" />
              <span className="text-xs font-bold">Dark</span>
            </button>

            <button
              id="theme-option-system"
              type="button"
              onClick={() => setTheme('system')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'system'
                  ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black border-[#B38A22] font-black shadow-xs'
                  : isDark
                  ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:border-[#D4AF37]'
                  : 'border-[#E6DFC8] bg-[#FAF8F5] text-black hover:border-[#D4AF37]'
              }`}
            >
              <Laptop className="w-4 h-4 text-[#C59B27]" />
              <span className="text-xs font-bold">System</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div
        id="account-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <Shield className="w-4 h-4 text-[#C59B27]" />
          <h2 className="text-base font-black text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Account & Security
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-black dark:text-white">Sign Out</p>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                End your active Konvexa Rupxa session on this browser.
              </p>
            </div>
            <button
              id="settings-logout-btn"
              type="button"
              onClick={logout}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 self-start sm:self-auto ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926] text-white'
                  : 'border-[#E6DFC8] hover:bg-[#FAF8F5] text-black'
              }`}
            >
              <LogOut className="w-3.5 h-3.5 text-[#C59B27]" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="border-t border-[#E6DFC8] dark:border-[#2A2926] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-black dark:text-white">Delete Account</p>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Permanently remove your account and disconnect from all shared splits.
              </p>
            </div>
            <button
              id="open-delete-account-btn"
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manage Permissions Modal */}
      {showPermissionsModal && (
        <div
          id="manage-permissions-modal-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="manage-permissions-modal-card"
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#C59B27]" />
                <h3 className="font-black text-base" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Manage Expense Import Permissions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPermissionsModal(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-[#292524] dark:text-[#A6A29A] font-medium leading-relaxed">
                Rupxa respects strict user privacy and zero-trust data constraints. You have full control over what is analyzed and can revoke any permission at any time.
              </p>

              {/* Status List */}
              <div className="space-y-2">
                {/* 1. Message Detection */}
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                }`}>
                  <div>
                    <span className="font-bold text-black dark:text-white block">
                      Message Expense Detection
                    </span>
                    <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
                      {detectionSettings.message_detection_enabled
                        ? 'Granted: You can import transaction text for local extraction'
                        : 'Revoked / Disabled (No access)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleMessageDetection}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      detectionSettings.message_detection_enabled
                        ? 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700'
                        : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                    }`}
                  >
                    {detectionSettings.message_detection_enabled ? 'Revoke Permission' : 'Enable'}
                  </button>
                </div>

                {/* 2. Connected Cards */}
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                }`}>
                  <div>
                    <span className="font-bold text-black dark:text-white block">
                      Card Sync Status
                    </span>
                    <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
                      {connectedCards.filter((c) => c.status === 'active').length} active card connection(s)
                    </span>
                  </div>
                  {connectedCards.some((c) => c.status === 'active') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        connectedCards.forEach((c) => disconnectCard(user.id, c.id));
                        setConnectedCards(getConnectedCards(user.id));
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold border border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      Disconnect All
                    </button>
                  )}
                </div>

                {/* 3. Browser Background Permissions */}
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#151515] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                }`}>
                  <div>
                    <span className="font-bold text-black dark:text-white block">
                      Silent Background Access
                    </span>
                    <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
                      Blocked by design. Rupxa never silently accesses SMS or WhatsApp.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Protected
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
              <button
                type="button"
                onClick={() => setShowPermissionsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 border border-[#B38A22]/40"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learn More Modal (Message Detection Privacy) */}
      {showLearnMoreModal && (
        <div
          id="learn-more-modal-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div
            id="learn-more-modal-card"
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#C59B27]" />
                <h3 className="font-black text-base" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Message Expense Detection Privacy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLearnMoreModal(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#292524] dark:text-[#A6A29A]">
              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#151515] border border-[#E6DFC8] dark:border-[#2A2926]">
                <strong className="text-black dark:text-white block mb-0.5">1. Never Silent Access</strong>
                Rupxa never silently scans your inbox or private conversations. Detection runs exclusively when you grant platform-supported permissions or explicitly share a message text.
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#151515] border border-[#E6DFC8] dark:border-[#2A2926]">
                <strong className="text-black dark:text-white block mb-0.5">2. Minimum Data Extracted</strong>
                Only structured transaction metadata is extracted: merchant, amount, date, and category. The raw message is never uploaded in bulk or permanently stored.
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#151515] border border-[#E6DFC8] dark:border-[#2A2926]">
                <strong className="text-black dark:text-white block mb-0.5">3. User Controls & Manual Approval</strong>
                Detected items are always placed into "Potential Expenses" as suggestions. Rupxa will never automatically add expenses to your balance without your explicit review and confirmation.
              </div>
            </div>

            <div className="mt-5 text-right pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
              <button
                type="button"
                onClick={() => setShowLearnMoreModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 border border-[#B38A22]/40"
              >
                I Understand
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
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#C59B27]" />
                <h3 className="font-black text-base" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {cardStep === 'consent' ? 'Connect your card' : 'Card Metadata'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCardConsentModal(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Explicit Consent Screen */}
            {cardStep === 'consent' && (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl border border-[#D4AF37]/40 bg-[#FFFDF7] dark:bg-[#1A160C] text-xs space-y-2">
                  <p className="font-bold text-black dark:text-white">
                    Connecting a card can help Rupxa organize eligible transaction information.
                  </p>
                  <p className="text-[#292524] dark:text-[#A6A29A]">
                    Your full card number and CVV must never be stored by Rupxa. We only register safe tokenized identifiers (network, nickname, and last 4 digits).
                  </p>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E6DFC8] dark:border-[#2A2926] cursor-pointer">
                  <input
                    id="card-consent-checkbox"
                    type="checkbox"
                    checked={cardConsentChecked}
                    onChange={(e) => setCardConsentChecked(e.target.checked)}
                    className="mt-0.5 rounded border-[#E6DFC8] text-[#C59B27] focus:ring-[#D4AF37]"
                  />
                  <span className="text-xs font-bold text-black dark:text-white">
                    I understand and want to connect my card
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926]">
                  <button
                    type="button"
                    onClick={() => setShowCardConsentModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E6DFC8] text-black hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    id="consent-continue-btn"
                    type="button"
                    disabled={!cardConsentChecked}
                    onClick={handleConsentContinue}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 disabled:opacity-50 transition-all border border-[#B38A22]/40"
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
                  <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{cardError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
                    Card Nickname
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dining Rewards, Primary Credit"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none ${
                      isDark
                        ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
                      Bank / Network
                    </label>
                    <select
                      value={cardProvider}
                      onChange={(e) => setCardProvider(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                        isDark
                          ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                          : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                      }`}
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
                      Card Type
                    </label>
                    <select
                      value={cardType}
                      onChange={(e) => setCardType(e.target.value as 'credit' | 'debit')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border outline-none ${
                        isDark
                          ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                          : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                      }`}
                    >
                      <option value="credit">Credit Card</option>
                      <option value="debit">Debit Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1.5">
                    Last 4 Digits Only
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="4821"
                    value={last4}
                    onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold tracking-widest border outline-none ${
                      isDark
                        ? 'bg-[#151515] border-[#2A2926] text-white focus:border-[#D4AF37]'
                        : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                    }`}
                  />
                  <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] mt-1 font-medium">
                    Preview: <strong className="text-black dark:text-white">{cardProvider} •••• {last4 || '••••'}</strong>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                  Never enter your full 16-digit card number, CVV, PIN, or OTP. Rupxa never stores sensitive financial credentials.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926]">
                  <button
                    type="button"
                    onClick={() => setCardStep('consent')}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E6DFC8] text-black hover:bg-[#FAF8F5]"
                  >
                    Back
                  </button>
                  <button
                    id="save-card-btn"
                    type="submit"
                    disabled={cardSubmitting || last4.length !== 4}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 disabled:opacity-50 transition-all border border-[#B38A22]/40"
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
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <h3 className="font-black text-base text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Confirm Account Deletion
            </h3>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] mt-2 mb-4 leading-relaxed font-medium">
              This action is permanent and cannot be reversed. You will be logged out immediately.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[#E6DFC8] text-black hover:bg-[#FAF8F5]"
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
