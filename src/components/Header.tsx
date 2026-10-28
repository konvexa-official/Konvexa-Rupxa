import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, LogOut, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  exceededBudgetCount?: number;
  onOpenBudgetSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  exceededBudgetCount = 0,
  onOpenBudgetSettings,
}) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header
      id="rupxa-main-header"
      className="h-13 sm:h-16 px-3 sm:px-8 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md sticky top-0 z-30 transition-colors flex items-center justify-between"
    >
      {/* Brand Logo & Name (visible mobile & desktop) */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          id="header-brand-logo-btn"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 sm:gap-2.5 text-left group transition-transform active:scale-95"
        >
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#B08D57] text-[#0B0B0B] font-black text-xs sm:text-sm flex items-center justify-center shadow-xs">
            <span>KR</span>
          </div>
          <div className="flex flex-col">
            <span
              className="text-sm sm:text-lg font-bold tracking-tight leading-tight text-[var(--text-primary)]"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Konvexa Rupxa
            </span>
            <span className="text-[11px] text-[var(--text-secondary)] font-normal hidden sm:block leading-none mt-0.5">
              Your money, clearly mapped.
            </span>
          </div>
        </button>
      </div>

      {/* Right Controls: Budget Alert, Theme Toggle & User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Subtle Budget Alert Notification Pill (if any target exceeded) */}
        {exceededBudgetCount > 0 && onOpenBudgetSettings && (
          <button
            id="header-budget-alert-btn"
            type="button"
            onClick={onOpenBudgetSettings}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-amber-600/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] sm:text-xs font-semibold transition-all hover:bg-amber-500/20"
            title={`${exceededBudgetCount} monthly budget target${exceededBudgetCount === 1 ? '' : 's'} exceeded - click to adjust`}
          >
            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Budget Alert</span>
            <span className="font-mono text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/20 font-bold">
              {exceededBudgetCount}
            </span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          id="header-theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#B08D57] transition-all"
        >
          {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B08D57]" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B08D57]" />}
        </button>

        {/* User Avatar & Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="user-avatar-menu-trigger"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 sm:gap-2 p-0.5 sm:p-1 sm:pl-1.5 sm:pr-2.5 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[#B08D57] transition-all"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                referrerPolicy="no-referrer"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-[#B08D57]/40"
              />
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#B08D57] text-[#0B0B0B] flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs">
                {getInitials(user?.full_name)}
              </div>
            )}
            <span className="text-xs font-semibold text-[var(--text-primary)] max-w-[100px] truncate hidden sm:inline-block">
              {user?.full_name || 'User'}
            </span>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              id="user-profile-dropdown-menu"
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-xl py-1.5 z-50 transition-all"
            >
              <div className="px-4 py-2.5 border-b border-[var(--border)]">
                <p className="text-xs font-semibold truncate text-[var(--text-primary)]">{user?.full_name}</p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate font-normal">{user?.email}</p>
                {user?.phone && (
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{user?.phone}</p>
                )}
              </div>

              <div className="py-1">
                <button
                  id="menu-settings-btn"
                  onClick={() => {
                    setActiveTab('settings');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-[#B08D57]" />
                  <span>Profile & Settings</span>
                </button>
              </div>

              <div className="border-t border-[var(--border)] pt-1">
                <button
                  id="menu-logout-btn"
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                  }}
                  className="w-full px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
