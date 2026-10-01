import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { DesktopSidebar, MobileBottomNav } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Expenses } from './components/Expenses';
import { Splitter } from './components/Splitter';
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

  // Detect ?join_split= in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join_split');
    if (joinId) {
      setPendingJoinGroupId(joinId);
    }
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
        className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors ${
          isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl border border-[#B08D57] bg-[#0B0B0B] flex items-center justify-center animate-pulse mb-4 shadow-lg shadow-[#B08D57]/10">
          <div className="flex items-center justify-center font-bold text-lg">
            <span className="text-[#B08D57]">K</span>
            <span className="text-white">R</span>
          </div>
        </div>
        <p className="text-sm font-semibold tracking-tight text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
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
      className={`min-h-screen flex flex-col transition-colors ${
        isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#FAF8F5] text-black'
      }`}
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
          className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-7xl mx-auto w-full mb-16 md:mb-0"
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              expenses={expenses}
              splits={splits}
              loading={dataLoading}
              onOpenAddExpense={handleOpenAddExpense}
              onSelectExpense={handleEditExpense}
              setActiveTab={setActiveTab}
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
