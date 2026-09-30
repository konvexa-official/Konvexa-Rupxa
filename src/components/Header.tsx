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
  const { user, logout, isConfigured } = useAuth();
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
      className={`h-16 px-4 sm:px-8 border-b sticky top-0 z-30 transition-colors flex items-center justify-between backdrop-blur-md ${
        isDark
          ? 'bg-[#0B0B0B]/95 border-[#2A2926] text-white'
          : 'bg-[#FAF8F5]/95 border-[#E6DFC8] text-black'
      }`}
    >
      {/* Brand Logo & Name (visible mobile & desktop) */}
      <div className="flex items-center gap-3">
        <button
          id="header-brand-logo-btn"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-xl border border-[#D4AF37] bg-gradient-to-br from-[#DFB15B] to-[#C59B27] p-0.5 shadow-sm group-hover:scale-105 transition-all shrink-0 flex items-center justify-center font-bold text-sm tracking-tight text-black shadow-amber-900/10">
            <span>KR</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className="text-lg font-bold tracking-tight leading-none text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                KR
              </span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/50 leading-none">
                Konvexa Rupxa
              </span>
            </div>
            <span className="text-[10px] text-[#292524] dark:text-[#A6A29A] font-medium hidden sm:block leading-none mt-1">
              Your money, clearly mapped.
            </span>
          </div>
        </button>

        {/* Database backend badge */}
        <span
          className="ml-2 hidden md:inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border-[#D4AF37]/50"
          title={isConfigured ? 'Connected to Firebase Cloud Firestore' : 'Running on persistent storage engine'}
        >
          <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-[#C59B27] animate-pulse" />
          {isConfigured ? 'Firebase Live' : 'Persistent Storage'}
        </span>
      </div>

      {/* Right Controls: Budget Alert, Theme Toggle & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Subtle Budget Alert Notification Pill (if any target exceeded) */}
        {exceededBudgetCount > 0 && onOpenBudgetSettings && (
          <button
            id="header-budget-alert-btn"
            type="button"
            onClick={onOpenBudgetSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#D4AF37] bg-[#FFF9EE] dark:bg-amber-500/20 text-black dark:text-amber-200 text-xs font-bold transition-all shadow-xs hover:bg-[#FCEFD2]"
            title={`${exceededBudgetCount} monthly budget target${exceededBudgetCount === 1 ? '' : 's'} exceeded - click to adjust`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C59B27] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C59B27]" />
            </span>
            <span className="hidden sm:inline">Budget Alert</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-[#D4AF37] text-black font-extrabold">
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
          className={`p-2 rounded-xl border transition-all ${
            isDark
              ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:text-white hover:border-[#D4AF37]'
              : 'border-[#E6DFC8] bg-white text-black hover:text-[#C59B27] hover:border-[#D4AF37]'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4 text-[#C59B27]" />}
        </button>

        {/* User Avatar & Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="user-avatar-menu-trigger"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border transition-all ${
              isDark
                ? 'border-[#2A2926] bg-[#0B0B0B] hover:border-[#D4AF37]'
                : 'border-[#E6DFC8] bg-white hover:border-[#D4AF37] text-black shadow-xs'
            }`}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-[#D4AF37]/50"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black flex items-center justify-center text-xs font-black shadow-xs">
                {getInitials(user?.full_name)}
              </div>
            )}
            <span className="text-xs font-bold text-black dark:text-white max-w-[100px] truncate hidden sm:inline-block">
              {user?.full_name || 'User'}
            </span>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div
              id="user-profile-dropdown-menu"
              className={`absolute right-0 mt-2 w-56 rounded-2xl border shadow-xl py-1.5 z-50 transition-all ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white shadow-black/80'
                  : 'bg-white border-[#E6DFC8] text-black shadow-black/10'
              }`}
            >
              <div className="px-4 py-2.5 border-b border-[#E6DFC8] dark:border-[#2A2926]">
                <p className="text-xs font-bold truncate text-black dark:text-white">{user?.full_name}</p>
                <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] truncate font-medium">{user?.email}</p>
                {user?.phone && (
                  <p className="text-[10px] text-[#292524] dark:text-[#A6A29A] font-mono mt-0.5">{user?.phone}</p>
                )}
              </div>

              <div className="py-1">
                <button
                  id="menu-settings-btn"
                  onClick={() => {
                    setActiveTab('settings');
                    setMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                    isDark ? 'hover:bg-[#2A2926]/60 text-white' : 'hover:bg-[#FAF8F5] text-black'
                  }`}
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-[#C59B27]" />
                  <span>Profile & Settings</span>
                </button>
              </div>

              <div className="border-t border-[#E6DFC8] dark:border-[#2A2926] pt-1">
                <button
                  id="menu-logout-btn"
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                  }}
                  className="w-full px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2.5 transition-colors"
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
