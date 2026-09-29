import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, LogOut, User, Settings as SettingsIcon } from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
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
          : 'bg-[#F5F2EA]/95 border-[#2A2926] text-[#0B0B0B]'
      }`}
    >
      {/* Brand Logo & Name (visible mobile & desktop) */}
      <div className="flex items-center gap-3">
        <button
          id="header-brand-logo-btn"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-xl border border-[#B08D57]/70 bg-[#0B0B0B] p-0.5 shadow-sm group-hover:border-[#B08D57] transition-colors shrink-0 flex items-center justify-center font-bold text-sm tracking-tight">
            <span className="text-[#B08D57]">K</span>
            <span className="text-white">R</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className="text-lg font-bold tracking-tight leading-none text-[#0B0B0B] dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                KR
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 leading-none">
                Konvexa Rupxa
              </span>
            </div>
            <span className="text-[10px] text-[#6F5738] dark:text-[#A6A29A] hidden sm:block leading-none mt-1">
              Your money, clearly mapped.
            </span>
          </div>
        </button>

        {/* Database backend badge */}
        <span
          className="ml-2 hidden md:inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border bg-[#B08D57]/10 text-[#B08D57] border-[#6F5738]/30"
          title={isConfigured ? 'Connected to remote Supabase database' : 'Running on local persistent database engine'}
        >
          <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-[#B08D57]" />
          {isConfigured ? 'Supabase Live' : 'Persistent Storage'}
        </span>
      </div>

      {/* Right Controls: Theme Toggle & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Toggle */}
        <button
          id="header-theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className={`p-2 rounded-xl border transition-all ${
            isDark
              ? 'border-[#2A2926] bg-[#0B0B0B] text-[#A6A29A] hover:text-white hover:border-[#6F5738]'
              : 'border-[#2A2926] bg-[#F5F2EA] text-[#6F5738] hover:text-[#0B0B0B] hover:border-[#6F5738]'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4 text-[#B08D57]" /> : <Moon className="w-4 h-4 text-[#6F5738]" />}
        </button>

        {/* User Avatar & Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="user-avatar-menu-trigger"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border transition-all ${
              isDark
                ? 'border-[#2A2926] bg-[#0B0B0B] hover:border-[#6F5738]'
                : 'border-[#2A2926] bg-[#F5F2EA] hover:border-[#6F5738]'
            }`}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-[#2A2926]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#B08D57] text-[#0B0B0B] flex items-center justify-center text-xs font-bold">
                {getInitials(user?.full_name)}
              </div>
            )}
            <span className="text-xs font-medium max-w-[100px] truncate hidden sm:inline-block">
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
                  : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-black/20'
              }`}
            >
              <div className="px-4 py-2.5 border-b border-[#2A2926]">
                <p className="text-xs font-semibold truncate text-[#0B0B0B] dark:text-white">{user?.full_name}</p>
                <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] truncate">{user?.email}</p>
                {user?.phone && (
                  <p className="text-[10px] text-[#6F5738] dark:text-[#A6A29A] font-mono mt-0.5">{user?.phone}</p>
                )}
              </div>

              <div className="py-1">
                <button
                  id="menu-settings-btn"
                  onClick={() => {
                    setActiveTab('settings');
                    setMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors ${
                    isDark ? 'hover:bg-[#2A2926]/60 text-white' : 'hover:bg-[#2A2926]/10 text-[#0B0B0B]'
                  }`}
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-[#6F5738] dark:text-[#A6A29A]" />
                  <span>Profile & Settings</span>
                </button>
              </div>

              <div className="border-t border-[#2A2926] pt-1">
                <button
                  id="menu-logout-btn"
                  onClick={async () => {
                    setMenuOpen(false);
                    await logout();
                  }}
                  className="w-full px-4 py-2 text-xs font-medium text-[#6F5738] dark:text-[#A6A29A] hover:text-[#0B0B0B] dark:hover:text-white hover:bg-[#6F5738]/20 flex items-center gap-2.5 transition-colors"
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
