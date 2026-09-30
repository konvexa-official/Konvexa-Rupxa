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
        isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#FAF8F5] border-[#E6DFC8] text-black'
      }`}
    >
      <div className="space-y-1.5 flex-1">
        <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#8C6B1F] dark:text-[#E6CA65]">
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-sm border border-[#B38A22]/40'
                  : isDark
                  ? 'text-white/80 hover:text-white hover:bg-[#2A2926]/60'
                  : 'text-black hover:bg-[#F3EEDF] hover:text-black'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-black' : isDark ? 'text-[#E6CA65]' : 'text-[#C59B27]'}`} />
              <span>{item.label}</span>
              {item.id === 'splitter' && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? 'bg-black/20 text-black'
                    : isDark
                    ? 'bg-[#2A2926] text-[#E6CA65] border border-[#D4AF37]/30'
                    : 'bg-[#D4AF37]/20 text-[#8C6B1F] border border-[#D4AF37]/40'
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
            : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-[#C59B27]" />
          <p className="font-bold text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Konvexa Rupxa
          </p>
        </div>
        <p className="text-[11px] leading-relaxed text-[#292524] dark:text-[#A6A29A]">
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
          : 'bg-[#FAF8F5]/95 border-[#E6DFC8] text-black'
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
                ? 'text-black font-black'
                : isDark
                ? 'text-[#A6A29A] hover:text-white'
                : 'text-black/70 hover:text-black'
            }`}
          >
            <div className={`p-1 rounded-lg ${isActive ? 'bg-[#D4AF37]/25 text-[#C59B27]' : ''}`}>
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#8C6B1F] dark:text-[#E6CA65]' : 'text-inherit'}`} />
            </div>
            <span className="text-[10px] leading-none mt-0.5">{item.label}</span>
            {isActive && (
              <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-[#C59B27]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
