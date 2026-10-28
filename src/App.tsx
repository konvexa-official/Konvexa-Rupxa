import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { DesktopSidebar, MobileBottomNav } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Expenses } from './components/Expenses';
import { Splitter } from './components/Splitter';
import { Notes } from './components/Notes';
import { Settings } from './components/Settings';
import { ExpenseModal } from './components/ExpenseModal';
import { JoinSplitInviteModal } from './components/JoinSplitInviteModal';
import { BudgetSettingsModal } from './components/BudgetSettingsModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { getUserExpenses, getUserSplitGroups, getCategoryBudgets } from './lib/db';
import { computeMonthlyBudgetStatuses } from './lib/budgetHelpers';
import { Expense, SplitGroupSummary, ActiveTab } from './types';

function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Application data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<SplitGroupSummary[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [dataLoading, setDataLoading] = useState(true);

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Budget Settings Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Deep-link join split parameter handling (?join_split=grp_123)
  const [pendingJoinGroupId, setPendingJoinGroupId] = useState<string | null>(null);
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null);

  // Detect ?join_split= or group route parameters in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join_split');
    if (joinId) {
      setPendingJoinGroupId(joinId);
    }
    const routeGroupId =
      params.get('split') ||
      params.get('split_id') ||
      params.get('group_id') ||
      params.get('groupId');
    if (routeGroupId) {
      setSelectedSplitId(routeGroupId);
      setActiveTab('splitter');
    }
    const tab = params.get('tab') as ActiveTab;
    if (tab && ['dashboard', 'expenses', 'splitter', 'notes', 'settings'].includes(tab)) {
      setActiveTab(tab);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const gid =
        p.get('split') ||
        p.get('split_id') ||
        p.get('group_id') ||
        p.get('groupId');
      if (gid) {
        setSelectedSplitId(gid);
        setActiveTab('splitter');
      } else {
        setSelectedSplitId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch real user data including expenses, split groups, and category budgets
  const loadData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [fetchedExpenses, fetchedSplits, fetchedBudgets] = await Promise.all([
        getUserExpenses(user.id),
        getUserSplitGroups(user.id),
        getCategoryBudgets(user.id),
      ]);
      setExpenses(fetchedExpenses);
      setSplits(fetchedSplits);
      setBudgets(fetchedBudgets);
    } catch (err) {
      console.error('Failed to load user financial data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Compute live budget status for global alerts
  const budgetSummary = computeMonthlyBudgetStatuses(expenses, budgets);
  const exceededBudgetCount = budgetSummary.exceededCategories.length;

  // Loading spinner state while checking auth
  if (authLoading) {
    return (
      <div
        id="rupxa-loading-screen"
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--background)] text-[var(--text-primary)] transition-colors"
      >
        <div className="w-12 h-12 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] flex items-center justify-center animate-pulse mb-4 shadow-lg shadow-[var(--accent)]/10">
          <div className="flex items-center justify-center font-bold text-lg">
            <span className="text-[var(--accent)]">K</span>
            <span className="text-[var(--text-primary)]">R</span>
          </div>
        </div>
        <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Loading Konvexa Rupxa...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSaved = () => {
    loadData();
  };

  return (
    <div
      id="rupxa-app-root"
      className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text-primary)] transition-colors"
    >
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        exceededBudgetCount={exceededBudgetCount}
        onOpenBudgetSettings={() => setIsBudgetModalOpen(true)}
      />

      {/* Main Body with Desktop Sidebar + Tab Content */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar */}
        <DesktopSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Primary Content View */}
        <main
          id="rupxa-primary-content"
          className="flex-1 px-3 sm:px-8 py-3.5 sm:py-8 max-w-7xl mx-auto w-full min-w-0 pb-20 md:pb-8"
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              expenses={expenses}
              splits={splits}
              loading={dataLoading}
              onOpenAddExpense={handleOpenAddExpense}
              onSelectExpense={handleEditExpense}
              setActiveTab={setActiveTab}
              onSelectSplit={(groupId) => {
                setSelectedSplitId(groupId);
                setActiveTab('splitter');
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'splitter');
                  url.searchParams.set('split', groupId);
                  window.history.pushState({ splitId: groupId }, '', url.toString());
                } catch (e) {
                  console.warn('Could not update history state:', e);
                }
              }}
              budgets={budgets}
              onOpenBudgetSettings={() => setIsBudgetModalOpen(true)}
            />
          )}

          {activeTab === 'expenses' && (
            <Expenses
              expenses={expenses}
              loading={dataLoading}
              onRefresh={loadData}
              onOpenAddExpense={handleOpenAddExpense}
              onEditExpense={handleEditExpense}
              budgets={budgets}
              onOpenBudgetSettings={() => setIsBudgetModalOpen(true)}
            />
          )}

          {activeTab === 'splitter' && (
            <Splitter
              splits={splits}
              loading={dataLoading}
              onRefresh={loadData}
              initialSelectedGroupId={selectedSplitId}
            />
          )}

          {activeTab === 'notes' && <Notes />}

          {activeTab === 'settings' && <Settings />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Add / Edit Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSaved={handleExpenseSaved}
        editingExpense={editingExpense}
        budgets={budgets}
        expenses={expenses}
      />

      {/* Monthly Budget Settings Modal */}
      <BudgetSettingsModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        currentBudgets={budgets}
        expenses={expenses}
        onBudgetsSaved={(newB) => {
          setBudgets(newB);
        }}
      />

      {/* Deep-link Split Invite Acceptance Dialog */}
      {pendingJoinGroupId && (
        <JoinSplitInviteModal
          groupId={pendingJoinGroupId}
          onJoined={(groupId) => {
            setPendingJoinGroupId(null);
            // Clean up the URL parameter without reloading
            window.history.replaceState({}, '', window.location.pathname);
            setSelectedSplitId(groupId);
            setActiveTab('splitter');
            loadData();
          }}
          onDismiss={() => {
            setPendingJoinGroupId(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      )}

      {/* PWA Install Banner & Offline Mode Indicator */}
      <PwaInstallPrompt />
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
