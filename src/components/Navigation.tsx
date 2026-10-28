import React from 'react';
import { LayoutDashboard, ReceiptText, Users, StickyNote, Settings } from 'lucide-react';
import { ActiveTab } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'splitter', label: 'Splitter', icon: Users },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const DesktopSidebar: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside
      id="rupxa-desktop-sidebar"
      className="hidden md:flex flex-col w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] min-h-[calc(100vh-4rem)] p-4 transition-colors"
    >
      <div className="space-y-1.5 flex-1 pt-2">
        <div className="px-3 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Navigation
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-link-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#B08D57]' : 'text-[var(--text-secondary)]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export const MobileBottomNav: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      id="rupxa-mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 h-14 sm:h-16 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md z-30 px-1 sm:px-3 flex items-center justify-around transition-colors pb-[env(safe-area-inset-bottom,0px)]"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            id={`mobile-nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-xl transition-all relative ${
              isActive
                ? 'text-[#B08D57] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-[#B08D57]/15 text-[#B08D57]' : ''}`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            </div>
            <span className="text-[10px] sm:text-[11px] leading-tight font-medium mt-0.5">{item.label}</span>
            {isActive && (
              <span className="absolute -top-0.5 sm:-top-1 w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-[#B08D57]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
