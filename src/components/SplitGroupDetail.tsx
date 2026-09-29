import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitGroup, SplitMember, SplitActivity, PublicUserSearchResult, GroupExpense } from '../types';
import {
  getSplitGroupDetails,
  updateMemberAmount,
  addMemberToSplitGroup,
  removeMemberFromSplitGroup,
  updateSplitGroupDetails,
  subscribeToGroupUpdates,
  searchUserByContact,
  deleteGroupExpense,
} from '../lib/db';
import { formatCurrency, formatTime, formatTimelineGroup, parseMoney } from '../lib/formatters';
import { AddGroupExpenseModal } from './AddGroupExpenseModal';
import { GroupExpenseDetailModal } from './GroupExpenseDetailModal';
import {
  ArrowLeft,
  Share2,
  Users,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  LogOut,
  Clock,
  Search,
  Copy,
  CheckCircle2,
  AlertCircle,
  Shield,
  History,
  Receipt,
  Calendar,
  Tag,
  CreditCard,
  ChevronRight,
  Sliders,
  DollarSign,
  Layers,
} from 'lucide-react';

interface SplitGroupDetailProps {
  groupId: string;
  onBack: () => void;
}

export const SplitGroupDetail: React.FC<SplitGroupDetailProps> = ({ groupId, onBack }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [group, setGroup] = useState<SplitGroup | null>(null);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [activity, setActivity] = useState<SplitActivity[]>([]);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit Group Expense Modal state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GroupExpense | null>(null);

  // Group Expense Details Modal state
  const [selectedDetailExpense, setSelectedDetailExpense] = useState<GroupExpense | null>(null);
  const [isDetailExpenseOpen, setIsDetailExpenseOpen] = useState(false);

  // Amount editing state for manual share adjustment
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editAmountVal, setEditAmountVal] = useState<string>('');
  const [amountSubmitting, setAmountSubmitting] = useState(false);

  // Group details edit modal (owner only)
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupTotal, setEditGroupTotal] = useState('');

  // Add member modal
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PublicUserSearchResult | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [newMemberAmount, setNewMemberAmount] = useState('0');

  // Share group modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch full details
  const fetchDetails = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getSplitGroupDetails(groupId, user.id);
      if (data) {
        setGroup(data.group);
        setMembers(data.members);
        setActivity(data.activity);
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error('Failed to load group details:', err);
      setError('Could not load group details.');
    } finally {
      setLoading(false);
    }
  }, [groupId, user]);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    fetchDetails();

    // Subscribe to realtime updates for this specific group
    const unsubscribe = subscribeToGroupUpdates(groupId, () => {
      // Whenever an expense or member or activity change happens in real-time, re-fetch
      fetchDetails();
    });

    return () => {
      unsubscribe();
    };
  }, [groupId, fetchDetails]);

  // Check roles
  const isOwner = group?.created_by === user?.id;
  const currentMember = members.find((m) => m.user_id === user?.id);

  // Calculations: Total expenses is dynamically calculated from all group expenses
  const calculatedTotalExpenses = useMemo(() => {
    if (expenses.length > 0) {
      return parseMoney(expenses.reduce((sum, e) => sum + e.amount, 0));
    }
    return parseMoney(group?.total_amount || 0);
  }, [expenses, group]);

  // Calculate per-member contributions and balances
  const memberBalances = useMemo(() => {
    const balances: Record<
      string,
      { paid: number; share: number; net: number }
    > = {};

    members.forEach((m) => {
      // How much this member paid upfront across all group expenses
      const paid = expenses
        .filter((e) => e.paid_by_user_id === m.user_id)
        .reduce((sum, e) => sum + e.amount, 0);

      // How much this member's share is across all group expenses
      const share = expenses.reduce((sum, e) => {
        const s = e.shares?.find((sh) => sh.user_id === m.user_id);
        return sum + (s ? s.amount : 0);
      }, 0);

      const net = parseMoney(paid - share);

      balances[m.user_id] = {
        paid: parseMoney(paid),
        share: parseMoney(expenses.length > 0 ? share : m.amount),
        net,
      };
    });

    return balances;
  }, [members, expenses]);

  // Handle Amount Edit Save (for manual adjustments)
  const handleSaveAmount = async (targetUserId: string) => {
    if (!user) return;
    const safeAmount = parseMoney(editAmountVal);
    if (safeAmount < 0) return;

    setAmountSubmitting(true);
    setError(null);

    try {
      await updateMemberAmount({
        groupId,
        targetUserId,
        newAmount: safeAmount,
        actorId: user.id,
        actorProfile: user,
      });

      setEditingMemberId(null);
      await fetchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update member amount.');
      }
    } finally {
      setAmountSubmitting(false);
    }
  };

  // Search User by contact
  const handleSearchUser = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    setSearchAttempted(true);
    setSearchResult(null);
    setError(null);

    try {
      const result = await searchUserByContact(searchQuery, user.id);
      setSearchResult(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Search failed.');
      }
    } finally {
      setSearching(false);
    }
  };

  // Add Member submit
  const handleAddMemberSubmit = async () => {
    if (!user || !searchResult) return;
    setAmountSubmitting(true);
    setError(null);

    try {
      await addMemberToSplitGroup({
        groupId,
        actorId: user.id,
        actorProfile: user,
        newUserId: searchResult.id,
        amount: parseMoney(newMemberAmount),
      });

      setIsAddMemberOpen(false);
      setSearchQuery('');
      setSearchResult(null);
      setNewMemberAmount('0');
      await fetchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to add member to split group.');
      }
    } finally {
      setAmountSubmitting(false);
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetUserId: string) => {
    if (!user) return;
    const isSelf = targetUserId === user.id;

    if (!isSelf && !isOwner) {
      setError('Only the group owner can remove other members.');
      return;
    }

    const confirmMsg = isSelf
      ? 'Are you sure you want to leave this split group?'
      : 'Are you sure you want to remove this member?';

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    try {
      await removeMemberFromSplitGroup({
        groupId,
        actorId: user.id,
        actorProfile: user,
        targetUserId,
      });

      if (isSelf) {
        onBack();
      } else {
        await fetchDetails();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to remove member.');
      }
    }
  };

  // Save Group Details
  const handleSaveGroupDetails = async () => {
    if (!user || !isOwner) return;
    const cleanName = editGroupName.trim();
    const safeTotal = parseMoney(editGroupTotal);

    if (!cleanName) {
      setError('Group name cannot be empty.');
      return;
    }

    setAmountSubmitting(true);
    setError(null);

    try {
      await updateSplitGroupDetails({
        groupId,
        actorId: user.id,
        actorProfile: user,
        name: cleanName,
        totalAmount: safeTotal,
      });

      setIsEditingGroup(false);
      await fetchDetails();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update group details.');
      }
    } finally {
      setAmountSubmitting(false);
    }
  };

  // Copy share invite link
  const handleCopyInvite = () => {
    const inviteLink = `${window.location.origin}?join_split=${groupId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Group activity by timeline dates
  const groupedActivity = useMemo(() => {
    const groups: { [key: string]: SplitActivity[] } = {};
    activity.forEach((act) => {
      const key = formatTimelineGroup(act.created_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(act);
    });
    return groups;
  }, [activity]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-4">
        <div className="h-8 w-40 bg-[#2A2926]/40 rounded-xl animate-pulse" />
        <div className="h-32 rounded-2xl bg-[#2A2926]/40 animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#2A2926]/40 animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <p className="text-base font-semibold text-[#0B0B0B] dark:text-white">Split group not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#B08D57] text-[#0B0B0B] hover:bg-[#9F7E4C]"
        >
          Back to Splitter
        </button>
      </div>
    );
  }

  return (
    <div id="split-group-detail-view" className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          id="back-to-splitter-btn"
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
            isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#6F5738] hover:text-[#0B0B0B]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Splits</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Share Split Button */}
          <button
            id="share-split-modal-btn"
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#2A2926] hover:border-[#6F5738] transition-colors ${
              isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>Share Split</span>
          </button>

          {/* If Owner: Edit Group Details */}
          {isOwner && (
            <button
              id="edit-group-details-btn"
              type="button"
              onClick={() => {
                setEditGroupName(group.name);
                setEditGroupTotal(group.total_amount.toString());
                setIsEditingGroup(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#2A2926] hover:border-[#6F5738] transition-colors ${
                isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F5F2EA] text-[#0B0B0B]'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>Edit Details</span>
            </button>
          )}

          {/* If normal member: Leave Group */}
          {!isOwner && currentMember && (
            <button
              id="leave-split-btn"
              type="button"
              onClick={() => handleRemoveMember(user!.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#6F5738]/40 hover:bg-[#6F5738]/20 transition-colors ${
                isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#6F5738] hover:text-[#0B0B0B]'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          id="split-detail-error"
          className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center justify-between animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#A6A29A] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Group Page Header Card */}
      <div
        id="split-group-header-card"
        className={`p-6 sm:p-7 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white'
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-sm'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-[#2A2926]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isOwner
                    ? 'bg-[#B08D57]/15 text-[#B08D57] border-[#6F5738]/30'
                    : 'bg-[#6F5738]/20 text-[#A6A29A] border-[#6F5738]/30'
                }`}
              >
                {isOwner ? 'Created by you (Owner)' : 'Member'}
              </span>
              <span className="text-xs text-[#6F5738] dark:text-[#A6A29A] flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{members.length} members</span>
              </span>
              <span className="text-xs text-[#6F5738] dark:text-[#A6A29A] flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</span>
              </span>
            </div>

            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B0B0B] dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {group.name}
            </h1>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
              Shared expenses, real-time recalculation & transparent split contributions
            </p>
          </div>

          <div className="text-left sm:text-right bg-[#151515]/30 dark:bg-[#151515]/60 p-4 rounded-xl border border-[#2A2926] sm:min-w-[200px]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A] block mb-1">
              Total Expenses
            </span>
            <span
              id="group-total-expenses-display"
              className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#B08D57]"
            >
              {formatCurrency(calculatedTotalExpenses)}
            </span>
            <span className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] block mt-1">
              {expenses.length === 0 ? 'No expenses added yet' : `Calculated across ${expenses.length} bills`}
            </span>
          </div>
        </div>

        {/* Action Buttons Bar: Clear "+ Add Expense" & "+ Add Member" buttons */}
        <div className="pt-5 flex flex-wrap items-center gap-3">
          <button
            id="add-expense-main-btn"
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] active:scale-95 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Expense</span>
          </button>

          <button
            id="add-member-header-btn"
            type="button"
            onClick={() => {
              setIsAddMemberOpen(true);
              setSearchQuery('');
              setSearchResult(null);
              setSearchAttempted(false);
            }}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
              isDark
                ? 'border-[#2A2926] bg-[#151515] hover:border-[#6F5738] text-white'
                : 'border-[#2A2926]/40 bg-white hover:border-[#6F5738] text-[#0B0B0B]'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>+ Add Member</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
              isDark
                ? 'border-[#2A2926] bg-[#151515] hover:border-[#6F5738] text-white'
                : 'border-[#2A2926]/40 bg-white hover:border-[#6F5738] text-[#0B0B0B]'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>Invite Link</span>
          </button>
        </div>
      </div>

      {/* 2. Group Expenses Section */}
      <div
        id="split-expenses-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#B08D57]/15 text-[#B08D57] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2
                className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Group Expenses ({expenses.length})
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                All expenses logged inside {group.name}
              </p>
            </div>
          </div>

          <button
            id="add-expense-secondary-btn"
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Expense List */}
        {expenses.length === 0 ? (
          <div
            id="empty-expenses-state"
            className={`py-12 px-4 rounded-xl border border-dashed text-center flex flex-col items-center justify-center ${
              isDark ? 'border-[#2A2926] bg-[#151515]/30' : 'border-[#2A2926]/30 bg-white/40'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#B08D57]/10 border border-[#B08D57]/20 flex items-center justify-center text-[#B08D57] mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3
              className="text-base font-bold text-[#0B0B0B] dark:text-white mb-1"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              No expenses added yet
            </h3>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] max-w-sm mb-4">
              Add meals, travel, hotel, parking, or tickets. You can add unlimited expenses inside this group.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setIsAddExpenseOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add First Expense</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {expenses.map((exp) => {
              const paidByMember = members.find((m) => m.user_id === exp.paid_by_user_id);
              const paidByName =
                exp.paid_by_profile?.full_name ||
                paidByMember?.profile?.full_name ||
                'Member';
              const isPaidByMe = exp.paid_by_user_id === user?.id;

              const formattedDate = exp.created_at
                ? new Date(exp.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Recently';

              return (
                <div
                  key={exp.id}
                  id={`group-expense-item-${exp.id}`}
                  onClick={() => {
                    setSelectedDetailExpense(exp);
                    setIsDetailExpenseOpen(true);
                  }}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] hover:border-[#6F5738]'
                      : 'bg-[#F5F2EA] border-[#2A2926]/40 hover:border-[#6F5738] shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#B08D57]/10 border border-[#B08D57]/20 flex items-center justify-center text-[#B08D57] shrink-0 mt-0.5">
                      <Receipt className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0B0B0B] dark:text-white truncate">
                          {exp.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30">
                          {exp.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#6F5738] dark:text-[#A6A29A] flex-wrap">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          <span>
                            Paid by <strong className="font-semibold text-[#0B0B0B] dark:text-white">{paidByName}</strong>
                            {isPaidByMe && ' (You)'}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </span>
                        <span>•</span>
                        <span>
                          {exp.shares.length} {exp.shares.length === 1 ? 'member' : 'members'} ({exp.split_type})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-[#B08D57] block">
                        {formatCurrency(exp.amount)}
                      </span>
                      <span className="text-[10px] text-[#6F5738] dark:text-[#A6A29A]">
                        Click for breakdown
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#6F5738] dark:text-[#A6A29A]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Members Section (Real database members only) */}
      <div
        id="split-members-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#B08D57]/15 text-[#B08D57] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2
                className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Members ({members.length})
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">
                Actual verified participants in this split group
              </p>
            </div>
          </div>

          <button
            id="add-member-open-btn"
            type="button"
            onClick={() => {
              setIsAddMemberOpen(true);
              setSearchQuery('');
              setSearchResult(null);
              setSearchAttempted(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Member</span>
          </button>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {members.map((member) => {
            const isSelf = member.user_id === user?.id;
            const displayName = member.profile?.full_name || (isSelf ? user?.full_name : 'Member');
            const contactIdentifier = member.profile?.email || member.profile?.phone || '';
            const bal = memberBalances[member.user_id] || { paid: 0, share: member.amount, net: 0 };

            return (
              <div
                key={member.id}
                id={`member-card-${member.user_id}`}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  isSelf
                    ? isDark
                      ? 'bg-[#0B0B0B] border-[#B08D57]/60 ring-1 ring-[#B08D57]/30'
                      : 'bg-[#F5F2EA] border-[#B08D57]/60 ring-1 ring-[#B08D57]/30'
                    : isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926]'
                    : 'bg-[#F5F2EA] border-[#2A2926]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#2A2926] text-white border border-[#6F5738]/30 flex items-center justify-center font-bold text-xs shrink-0">
                        {displayName ? displayName[0]?.toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate text-[#0B0B0B] dark:text-white">
                            {displayName}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-[#B08D57] text-[#0B0B0B]">
                              You
                            </span>
                          )}
                          {member.user_id === group.created_by && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30">
                              Creator
                            </span>
                          )}
                        </div>
                        {contactIdentifier && (
                          <span className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] block truncate">
                            {contactIdentifier}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remove button if owner and not removing owner */}
                    {isOwner && !isSelf && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id)}
                        title="Remove member"
                        className={`p-1 rounded transition-colors ${
                          isDark
                            ? 'text-[#A6A29A] hover:text-white hover:bg-[#6F5738]/30'
                            : 'text-[#6F5738] hover:text-[#0B0B0B] hover:bg-[#2A2926]/20'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Member balance info */}
                <div className="mt-4 pt-3 border-t border-[#2A2926] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6F5738] dark:text-[#A6A29A]">Paid Upfront:</span>
                    <span className="font-mono font-semibold text-[#0B0B0B] dark:text-white">
                      {formatCurrency(bal.paid)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6F5738] dark:text-[#A6A29A]">Share of Expenses:</span>
                    <span className="font-mono font-semibold text-[#0B0B0B] dark:text-white">
                      {formatCurrency(bal.share)}
                    </span>
                  </div>

                  {/* Net status */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2A2926]/40">
                    <span className="font-semibold text-[#0B0B0B] dark:text-white">Net Balance:</span>
                    {bal.net > 0 ? (
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(bal.net)} (to receive)
                      </span>
                    ) : bal.net < 0 ? (
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        -{formatCurrency(Math.abs(bal.net))} (to pay)
                      </span>
                    ) : (
                      <span className="font-mono text-[#6F5738] dark:text-[#A6A29A]">
                        Settled (₹0.00)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Activity History Section */}
      <div
        id="split-activity-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#B08D57]" />
            <h2
              className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Activity History
            </h2>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              isDark
                ? 'bg-[#2A2926] text-[#A6A29A] border-[#2A2926]'
                : 'bg-[#2A2926]/10 text-[#6F5738] border-[#2A2926]'
            }`}
          >
            Immutable Audit Log
          </span>
        </div>

        {activity.length === 0 ? (
          <div id="activity-empty-state" className="py-8 text-center">
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">No activity yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivity).map(([dateGroup, items]) => (
              <div key={dateGroup} className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#B08D57]">
                  {dateGroup}
                </div>
                <div className="space-y-2 pl-2 border-l border-[#2A2926]">
                  {items.map((act) => (
                    <div
                      key={act.id}
                      id={`activity-item-${act.id}`}
                      className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                        isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-[#B08D57] mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium text-[#0B0B0B] dark:text-white">
                            {act.description}
                          </p>
                          {act.old_value && act.new_value && (
                            <p className="font-mono text-[11px] text-[#B08D57] mt-0.5">
                              {formatCurrency(act.old_value)} → {formatCurrency(act.new_value)}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] shrink-0 font-mono">
                        {formatTime(act.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <AddGroupExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        onSaved={fetchDetails}
        groupId={groupId}
        members={members}
        editingExpense={editingExpense}
      />

      {/* Expense Split Details Modal */}
      <GroupExpenseDetailModal
        isOpen={isDetailExpenseOpen}
        onClose={() => {
          setIsDetailExpenseOpen(false);
          setSelectedDetailExpense(null);
        }}
        expense={selectedDetailExpense}
        groupId={groupId}
        members={members}
        onEdit={(exp) => {
          setSelectedDetailExpense(null);
          setIsDetailExpenseOpen(false);
          setEditingExpense(exp);
          setIsAddExpenseOpen(true);
        }}
        onDeleted={fetchDetails}
      />

      {/* Share Split Modal */}
      {isShareModalOpen && (
        <div
          id="share-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="share-modal-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2926]">
              <h3 className="font-bold text-base text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Share Split Invitation
              </h3>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className={`transition-colors ${
                  isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#6F5738] hover:text-[#0B0B0B]'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-3 mb-4">
              Share this invite link with any Konvexa Rupxa user to let them join "{group.name}" directly.
            </p>

            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono select-all ${
                isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
              }`}
            >
              <span className="truncate">{`${window.location.origin}?join_split=${groupId}`}</span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="p-1.5 rounded-lg bg-[#B08D57] text-[#0B0B0B] hover:bg-[#9F7E4C] shrink-0 transition-colors"
                title="Copy link"
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {copiedLink && (
              <p className="text-xs text-[#B08D57] mt-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Link copied to clipboard!</span>
              </p>
            )}

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  isDark
                    ? 'bg-[#2A2926] hover:bg-[#6F5738]/40 text-white border-[#2A2926]'
                    : 'bg-[#2A2926]/10 hover:bg-[#2A2926]/20 text-[#0B0B0B] border-[#2A2926]'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div
          id="add-member-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="add-member-modal-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2926]">
              <h3 className="font-bold text-base text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Add Member to Split
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className={`transition-colors ${
                  isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#6F5738] hover:text-[#0B0B0B]'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-3 mb-3">
              Search by email or phone number to find existing Konvexa Rupxa users.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                <input
                  id="add-member-search-input"
                  type="text"
                  placeholder="Email or phone number"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchAttempted(false);
                    setSearchResult(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchUser();
                    }
                  }}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                      : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                  }`}
                />
              </div>
              <button
                id="do-search-member-btn"
                type="button"
                onClick={handleSearchUser}
                disabled={searching || !searchQuery.trim()}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'bg-[#2A2926] hover:bg-[#6F5738]/40 border-[#2A2926] text-white'
                    : 'bg-[#2A2926]/10 hover:bg-[#2A2926]/20 border-[#2A2926] text-[#0B0B0B]'
                }`}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResult && (
              <div
                className={`mt-4 p-3 rounded-xl border space-y-3 ${
                  isDark ? 'border-[#2A2926] bg-[#0B0B0B]' : 'border-[#2A2926] bg-[#F5F2EA]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 flex items-center justify-center font-bold text-xs">
                      {searchResult.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#0B0B0B] dark:text-white">{searchResult.full_name}</p>
                      <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A]">{searchResult.masked_identifier}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[#6F5738] dark:text-[#A6A29A] mb-1">
                    Initial Assigned Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newMemberAmount}
                    onChange={(e) => setNewMemberAmount(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono outline-none focus:border-[#B08D57] ${
                      isDark
                        ? 'border-[#2A2926] bg-[#0B0B0B] text-white'
                        : 'border-[#2A2926] bg-[#F5F2EA] text-[#0B0B0B]'
                    }`}
                  />
                </div>

                <button
                  id="confirm-add-member-btn"
                  type="button"
                  onClick={handleAddMemberSubmit}
                  disabled={amountSubmitting}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-[#B08D57] hover:bg-[#9F7E4C] text-[#0B0B0B] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Group</span>
                </button>
              </div>
            )}

            {searchAttempted && !searching && !searchResult && (
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-3 text-center">
                No Konvexa Rupxa user found with this contact.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Edit Group Details Modal (Owner only) */}
      {isEditingGroup && (
        <div
          id="edit-group-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="edit-group-modal-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2926]">
              <h3 className="font-bold text-base text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Edit Group Details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingGroup(false)}
                className={`transition-colors ${
                  isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#6F5738] hover:text-[#0B0B0B]'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6F5738] dark:text-[#A6A29A] mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                      : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6F5738] dark:text-[#A6A29A] mb-1">
                  Estimated Total (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editGroupTotal}
                  onChange={(e) => setEditGroupTotal(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                      : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGroup(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                    isDark
                      ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#2A2926]'
                      : 'border-[#2A2926] text-[#6F5738] hover:bg-[#2A2926]/10'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroupDetails}
                  disabled={amountSubmitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#B08D57] text-[#0B0B0B] hover:bg-[#9F7E4C] disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
