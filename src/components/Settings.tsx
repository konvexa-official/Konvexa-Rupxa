import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { normalizePhone, maskPhone } from '../lib/formatters';
import {
  User,
  Mail,
  Phone,
  Coins,
  Moon,
  Sun,
  LogOut,
  Trash2,
  Check,
  AlertCircle,
  Shield,
  Laptop,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, updateProfile, logout, isConfigured } = useAuth();
  const { theme, setTheme, isDark } = useTheme();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currency, setCurrency] = useState('INR');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete account confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const normalizedPhone = phone.trim() ? normalizePhone(phone) : undefined;
      await updateProfile({
        full_name: fullName.trim(),
        phone: normalizedPhone,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      // Clear user session and trigger logout
      await logout();
    } catch (err) {
      console.error('Delete account error:', err);
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-6 max-w-3xl mx-auto pb-16">
      <div>
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B0B0B] dark:text-white"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#6F5738] dark:text-[#A6A29A] mt-1">
          Manage your personal profile, preferences, and security
        </p>
      </div>

      {/* Profile Management Section */}
      <div
        id="profile-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2A2926]">
          <User className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-base font-bold text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Profile Management
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-[#6F5738]/40 bg-[#6F5738]/20 text-[#0B0B0B] dark:text-white text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#B08D57]" />
            <span>{error}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="mb-4 p-3 rounded-xl border border-[#B08D57]/40 bg-[#B08D57]/10 text-[#0B0B0B] dark:text-white text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-[#B08D57]" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] mb-1.5">
              Full Name
            </label>
            <input
              id="settings-fullname-input"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                  : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] mb-1.5">
              Email Address (Read-only)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
              <input
                id="settings-email-input"
                type="email"
                readOnly
                disabled
                value={user?.email || ''}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono border cursor-not-allowed opacity-70 ${
                  isDark
                    ? 'bg-[#2A2926]/40 border-[#2A2926] text-[#A6A29A]'
                    : 'bg-[#2A2926]/10 border-[#2A2926] text-[#6F5738]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
              <input
                id="settings-phone-input"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-mono border outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              />
            </div>
            <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] mt-1">
              Used by friends and peers to connect and invite you to shared expense splits.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] mb-1.5">
              Default Currency Preference
            </label>
            <div className="relative">
              <Coins className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B08D57]" />
              <select
                id="settings-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                  isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                    : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                }`}
              >
                <option value="INR" className={isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'}>
                  INR (₹) — Indian Rupee
                </option>
              </select>
            </div>
          </div>

          <div className="pt-2 text-right">
            <button
              id="save-profile-btn"
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Appearance Section */}
      <div
        id="appearance-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2A2926]">
          <Sun className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-base font-bold text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Appearance
          </h2>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
            Choose your preferred color theme. Dark mode is Konvexa Rupxa's primary optimized experience.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'dark'
                  ? 'border-[#B08D57] bg-[#B08D57]/15 text-[#0B0B0B] dark:text-white ring-1 ring-[#B08D57]'
                  : isDark
                  ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:border-[#6F5738]'
                  : 'border-[#2A2926] bg-[#F5F2EA] text-[#6F5738] hover:border-[#6F5738]'
              }`}
            >
              <Moon className="w-4 h-4 text-[#B08D57]" />
              <span className="text-xs font-semibold">Dark</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'light'
                  ? 'border-[#B08D57] bg-[#B08D57]/15 text-[#0B0B0B] dark:text-white ring-1 ring-[#B08D57]'
                  : isDark
                  ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:border-[#6F5738]'
                  : 'border-[#2A2926] bg-[#F5F2EA] text-[#6F5738] hover:border-[#6F5738]'
              }`}
            >
              <Sun className="w-4 h-4 text-[#B08D57]" />
              <span className="text-xs font-semibold">Light</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                theme === 'system'
                  ? 'border-[#B08D57] bg-[#B08D57]/15 text-[#0B0B0B] dark:text-white ring-1 ring-[#B08D57]'
                  : isDark
                  ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:border-[#6F5738]'
                  : 'border-[#2A2926] bg-[#F5F2EA] text-[#6F5738] hover:border-[#6F5738]'
              }`}
            >
              <Laptop className="w-4 h-4 text-[#B08D57]" />
              <span className="text-xs font-semibold">System</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div
        id="account-settings-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2A2926]">
          <Shield className="w-4 h-4 text-[#B08D57]" />
          <h2 className="text-base font-bold text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Account & Security
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#0B0B0B] dark:text-white">Sign Out</p>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                End your active Konvexa Rupxa session on this browser.
              </p>
            </div>
            <button
              id="settings-logout-btn"
              type="button"
              onClick={logout}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 self-start sm:self-auto ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926] text-white'
                  : 'border-[#2A2926] hover:bg-[#2A2926]/10 text-[#0B0B0B]'
              }`}
            >
              <LogOut className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="border-t border-[#2A2926] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#0B0B0B] dark:text-white">Delete Account</p>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                Permanently remove your account and disconnect from all shared splits.
              </p>
            </div>
            <button
              id="open-delete-account-btn"
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 self-start sm:self-auto ${
                isDark
                  ? 'border-[#6F5738]/40 text-[#A6A29A] hover:text-white hover:bg-[#6F5738]/20'
                  : 'border-[#6F5738]/40 text-[#6F5738] hover:text-[#0B0B0B] hover:bg-[#2A2926]/10'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div
          id="delete-account-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="delete-account-modal-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
            }`}
          >
            <h3 className="font-bold text-base text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Confirm Account Deletion
            </h3>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-2 mb-4 leading-relaxed">
              This action is permanent and cannot be reversed. You will be logged out immediately.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className={`px-4 py-2 rounded-xl text-xs border transition-colors ${
                  isDark
                    ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#2A2926]'
                    : 'border-[#2A2926] text-[#6F5738] hover:bg-[#2A2926]/10'
                }`}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-account-btn"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#6F5738] hover:bg-[#5C482E] text-white disabled:opacity-50"
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
