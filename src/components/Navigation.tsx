import React from 'react';
import { LayoutDashboard, ReceiptText, Users, Settings } from 'lucide-react';
import { ActiveTab } from '../types';
import { useTheme } from '../context/ThemeContext';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'splitter', label: 'Splitter', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const DesktopSidebar: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { isDark } = useTheme();

  return (
    <aside
      id="rupxa-desktop-sidebar"
      className={`hidden md:flex flex-col w-64 shrink-0 border-r min-h-[calc(100vh-4rem)] p-4 transition-colors ${
        isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
      }`}
    >
      <div className="space-y-1.5 flex-1">
        <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A]">
          Menu
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-link-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#B08D57] text-[#0B0B0B] font-semibold shadow-sm'
                  : isDark
                  ? 'text-[#A6A29A] hover:text-white hover:bg-[#2A2926]/60'
                  : 'text-[#6F5738] hover:text-[#0B0B0B] hover:bg-[#2A2926]/20'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0B0B0B]' : isDark ? 'text-[#A6A29A]' : 'text-[#6F5738]'}`} />
              <span>{item.label}</span>
              {item.id === 'splitter' && (
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? 'bg-[#0B0B0B]/20 text-[#0B0B0B]'
                    : isDark
                    ? 'bg-[#2A2926] text-[#A6A29A] border border-[#6F5738]/30'
                    : 'bg-[#2A2926]/20 text-[#6F5738]'
                }`}>
                  Realtime
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer info */}
      <div
        className={`p-3.5 rounded-xl border text-xs ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-[#A6A29A]'
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#6F5738]'
        }`}
      >
        <p className="font-semibold text-[#0B0B0B] dark:text-white mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Konvexa Rupxa
        </p>
        <p className="text-[11px] leading-relaxed text-[#6F5738] dark:text-[#A6A29A]">
          Collaborative shared expenses with real-time sync & immutable history.
        </p>
      </div>
    </aside>
  );
};

export const MobileBottomNav: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { isDark } = useTheme();

  return (
    <nav
      id="rupxa-mobile-bottom-nav"
      className={`md:hidden fixed bottom-0 left-0 right-0 h-16 border-t z-30 px-2 flex items-center justify-around backdrop-blur-lg transition-colors ${
        isDark
          ? 'bg-[#0B0B0B]/95 border-[#2A2926] text-[#A6A29A]'
          : 'bg-[#F5F2EA]/95 border-[#2A2926] text-[#6F5738]'
      }`}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`mobile-nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
              isActive
                ? 'text-[#B08D57] font-semibold'
                : isDark
                ? 'text-[#A6A29A] hover:text-white'
                : 'text-[#6F5738] hover:text-[#0B0B0B]'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-[#B08D57]' : 'text-inherit'}`} />
            <span className="text-[10px] leading-none">{item.label}</span>
            {isActive && (
              <span className="absolute -top-1 w-1 h-1 rounded-full bg-[#B08D57]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
