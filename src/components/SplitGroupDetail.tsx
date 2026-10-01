import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitGroup, SplitMember, SplitActivity, PublicUserSearchResult, GroupExpense, SplitSettlement } from '../types';
import {
  getSplitGroupDetails,
  updateMemberAmount,
  addMemberToSplitGroup,
  removeMemberFromSplitGroup,
  updateSplitGroupDetails,
  subscribeToGroupUpdates,
  searchUserByContact,
  deleteGroupExpense,
  recordSettlement,
} from '../lib/db';
import { formatCurrency, formatDateTime, formatTime, formatTimelineGroup, parseMoney } from '../lib/formatters';
import { AddGroupExpenseModal } from './AddGroupExpenseModal';
import { GroupExpenseDetailModal } from './GroupExpenseDetailModal';
import { UpiSettlementModal } from './UpiSettlementModal';
import { ShareSplitSummaryModal } from './ShareSplitSummaryModal';
import { calculatePairwiseDebts, PairwiseDebt } from '../lib/upiUtils';
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
  Search,
  Copy,
  CheckCircle2,
  AlertCircle,
  History,
  Receipt,
  Calendar,
  CreditCard,
  ChevronRight,
  MessageCircle,
  QrCode,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Banknote,
  Send,
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

  // Settlements & UPI states
  const [settlements, setSettlements] = useState<SplitSettlement[]>([]);
  const [selectedDebtForSettle, setSelectedDebtForSettle] = useState<PairwiseDebt | null>(null);
  const [isShareDigestOpen, setIsShareDigestOpen] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);

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
        setSettlements(data.settlements || []);
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

    const unsubscribe = subscribeToGroupUpdates(groupId, () => {
      fetchDetails();
    });

    return () => {
      unsubscribe();
    };
  }, [groupId, fetchDetails]);

  // Is current logged in user the owner/creator of the group?
  const isOwner = Boolean(user && group && group.created_by === user.id);
  const currentMember = members.find((m) => m.user_id === user?.id);

  // Calculate sum of group expenses
  const calculatedTotalExpenses = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [expenses]);

  // Member balance calculation (including settlements)
  const memberBalances = useMemo(() => {
    const balances: { [userId: string]: { paid: number; share: number; net: number } } = {};

    members.forEach((m) => {
      balances[m.user_id] = { paid: 0, share: 0, net: 0 };
    });

    expenses.forEach((exp) => {
      if (balances[exp.paid_by_user_id]) {
        balances[exp.paid_by_user_id].paid += exp.amount;
      }
      exp.shares.forEach((share) => {
        if (balances[share.user_id]) {
          balances[share.user_id].share += share.amount;
        }
      });
    });

    settlements.forEach((s) => {
      if (balances[s.from_user_id]) {
        balances[s.from_user_id].paid += s.amount;
      }
      if (balances[s.to_user_id]) {
        balances[s.to_user_id].share += s.amount;
      }
    });

    members.forEach((m) => {
      const record = balances[m.user_id];
      if (record) {
        record.net = Math.round((record.paid - record.share) * 100) / 100;
      }
    });

    return balances;
  }, [members, expenses, settlements]);

  // Simplified pairwise debts (Who Owes Whom)
  const debts = useMemo(() => {
    return calculatePairwiseDebts(members, memberBalances);
  }, [members, memberBalances]);

  // Handler to record a settlement
  const handleConfirmSettlement = async (params: {
    amount: number;
    paymentMethod: 'UPI' | 'Cash' | 'Bank' | 'Other';
    upiRefId?: string;
    note?: string;
  }) => {
    if (!user || !selectedDebtForSettle) return;
    try {
      await recordSettlement({
        groupId,
        fromUserId: selectedDebtForSettle.fromUserId,
        toUserId: selectedDebtForSettle.toUserId,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        upiRefId: params.upiRefId,
        note: params.note,
        actorProfile: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone || '',
          avatar_url: user.avatar_url,
          upi_id: user.upi_id,
        },
      });
      await fetchDetails();
    } catch (err) {
      console.error('Failed to record settlement:', err);
      setError('Failed to record settlement.');
    }
  };

  // Search user by email or phone
  const handleSearchUser = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchAttempted(true);
    setError(null);

    try {
      const res = await searchUserByContact(searchQuery);
      setSearchResult(res);
      if (!res) {
        setError('No verified user found with that email or phone number.');
      }
    } catch (err) {
      console.error('Search user error:', err);
      setError('Error searching for user.');
    } finally {
      setSearching(false);
    }
  };

  // Add Member submit
  const handleAddMemberSubmit = async () => {
    if (!user || !searchResult) return;

    if (members.some((m) => m.user_id === searchResult.id)) {
      setError('This user is already a member of this split group.');
      return;
    }

    setAmountSubmitting(true);
    setError(null);

    try {
      const amountVal = parseMoney(newMemberAmount);
      await addMemberToSplitGroup({
        groupId,
        actorId: user.id,
        actorProfile: user,
        newUserId: searchResult.id,
        amount: amountVal,
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
        setError('Failed to add member to group.');
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
        <div className="h-8 w-40 bg-[#E6DFC8]/50 dark:bg-[#2A2926]/40 rounded-xl animate-pulse" />
        <div className="h-32 rounded-2xl bg-[#E6DFC8]/50 dark:bg-[#2A2926]/40 animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#E6DFC8]/50 dark:bg-[#2A2926]/40 animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <p className="text-base font-bold text-black dark:text-white">Split group not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black hover:brightness-105"
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
          className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
            isDark ? 'text-[#A6A29A] hover:text-white' : 'text-[#292524] hover:text-black'
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              isDark
                ? 'bg-[#0B0B0B] text-white border-[#2A2926] hover:border-[#6F5738]'
                : 'bg-white text-black border-[#E6DFC8] hover:border-[#D4AF37] shadow-xs'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#8C6B1F] dark:text-[#E6CA65]" />
            <span>Share Split</span>
          </button>

          {/* 1-Click WhatsApp & Social Summary Digest */}
          <button
            id="share-whatsapp-digest-btn"
            type="button"
            onClick={() => setIsShareDigestOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              isDark
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/50'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span>WhatsApp Digest</span>
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isDark
                  ? 'bg-[#0B0B0B] text-white border-[#2A2926] hover:border-[#6F5738]'
                  : 'bg-white text-black border-[#E6DFC8] hover:border-[#D4AF37] shadow-xs'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5 text-[#8C6B1F] dark:text-[#E6CA65]" />
              <span>Edit Details</span>
            </button>
          )}

          {/* If normal member: Leave Group */}
          {!isOwner && currentMember && (
            <button
              id="leave-split-btn"
              type="button"
              onClick={() => handleRemoveMember(user!.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-300 hover:bg-rose-50 text-rose-700 transition-colors`}
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
          className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center justify-between font-bold animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-black/60 hover:text-black">
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
            : 'bg-white border-[#E6DFC8] text-black shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isOwner
                    ? 'bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border-[#D4AF37]/40'
                    : 'bg-[#FAF8F5] text-[#292524] border-[#E6DFC8] dark:bg-[#151515] dark:text-[#A6A29A] dark:border-[#2A2926]'
                }`}
              >
                {isOwner ? 'Created by you (Owner)' : 'Member'}
              </span>
              <span className="text-xs text-[#292524] dark:text-[#A6A29A] flex items-center gap-1 font-semibold">
                <Users className="w-3.5 h-3.5 text-[#C59B27]" />
                <span>{members.length} members</span>
              </span>
              <span className="text-xs text-[#292524] dark:text-[#A6A29A] flex items-center gap-1 font-semibold">
                <Receipt className="w-3.5 h-3.5 text-[#C59B27]" />
                <span>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</span>
              </span>
            </div>

            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {group.name}
            </h1>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
              Shared expenses, real-time recalculation & transparent split contributions
            </p>
          </div>

          <div className="text-left sm:text-right bg-[#FAF8F5] dark:bg-[#151515]/60 p-4 rounded-xl border border-[#E6DFC8] dark:border-[#2A2926] sm:min-w-[200px]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#292524] dark:text-[#A6A29A] block mb-1">
              Total Expenses
            </span>
            <span
              id="group-total-expenses-display"
              className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[#8C6B1F] dark:text-[#E6CA65]"
            >
              {formatCurrency(calculatedTotalExpenses)}
            </span>
            <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] block mt-1 font-medium">
              {expenses.length === 0 ? 'No expenses added yet' : `Calculated across ${expenses.length} bills`}
            </span>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="pt-5 flex flex-wrap items-center gap-3">
          <button
            id="add-expense-main-btn"
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsAddExpenseOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
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
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
              isDark
                ? 'border-[#2A2926] bg-[#151515] hover:border-[#6F5738] text-white'
                : 'border-[#E6DFC8] bg-white hover:border-[#D4AF37] text-black shadow-xs'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-[#8C6B1F] dark:text-[#E6CA65] stroke-[3]" />
            <span>+ Add Member</span>
          </button>

          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
              isDark
                ? 'border-[#2A2926] bg-[#151515] hover:border-[#6F5738] text-white'
                : 'border-[#E6DFC8] bg-white hover:border-[#D4AF37] text-black shadow-xs'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-[#8C6B1F] dark:text-[#E6CA65]" />
            <span>Invite Link</span>
          </button>
        </div>
      </div>

      {/* 2. Group Expenses Section */}
      <div
        id="split-expenses-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#C59B27] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2
                className="text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Group Expenses ({expenses.length})
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-xs transition-all border border-[#B38A22]/40"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Expense List */}
        {expenses.length === 0 ? (
          <div
            id="empty-expenses-state"
            className={`py-12 px-4 rounded-xl border border-dashed text-center flex flex-col items-center justify-center ${
              isDark ? 'border-[#2A2926] bg-[#151515]/30' : 'border-[#E6DFC8] bg-[#FAF8F5]'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#C59B27] mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3
              className="text-base font-black text-black dark:text-white mb-1"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              No expenses added yet
            </h3>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] max-w-sm mb-4 font-medium">
              Add meals, travel, hotel, parking, or tickets. You can add unlimited expenses inside this group.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setIsAddExpenseOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 transition-colors border border-[#B38A22]/40"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
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

              const rawRef = exp.reference !== undefined && exp.reference !== null
                ? exp.reference.trim()
                : (exp.name && exp.name.trim() !== 'Expense' && exp.name.trim() !== 'Untitled' ? exp.name.trim() : '');
              const hasReference = Boolean(rawRef);

              const formattedDateTime = exp.created_at
                ? formatDateTime(exp.created_at)
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
                      : 'bg-[#FAF8F5] border-[#E6DFC8] hover:border-[#D4AF37] shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#C59B27] shrink-0 mt-0.5">
                      <Receipt className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasReference && (
                          <span className="font-black text-sm text-black dark:text-white truncate">
                            {rawRef}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/30">
                          {exp.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#292524] dark:text-[#A6A29A] flex-wrap font-medium">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-[#C59B27]" />
                          <span>
                            Paid by <strong className="font-bold text-black dark:text-white">{paidByName}</strong>
                            {isPaidByMe && ' (You)'}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#C59B27]" />
                          <span>{formattedDateTime}</span>
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
                      <span className="text-base sm:text-lg font-black font-mono tracking-tight text-[#8C6B1F] dark:text-[#E6CA65] block">
                        {formatCurrency(exp.amount)}
                      </span>
                      <span className="text-[10px] text-[#292524] dark:text-[#A6A29A] font-medium">
                        Click for breakdown
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#8C6B1F] dark:text-[#A6A29A]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Members Section */}
      <div
        id="split-members-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#C59B27] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2
                className="text-lg font-black tracking-tight text-black dark:text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Members ({members.length})
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-xs transition-all border border-[#B38A22]/40"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
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
                      ? 'bg-[#0B0B0B] border-[#D4AF37] ring-1 ring-[#D4AF37]/30'
                      : 'bg-[#FAF8F5] border-[#D4AF37] ring-1 ring-[#D4AF37]/30 shadow-xs'
                    : isDark
                    ? 'bg-[#0B0B0B] border-[#2A2926]'
                    : 'bg-[#FAF8F5] border-[#E6DFC8]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#DFB15B] to-[#C59B27] text-black border border-[#B38A22]/40 flex items-center justify-center font-black text-xs shrink-0">
                        {displayName ? displayName[0]?.toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm truncate text-black dark:text-white">
                            {displayName}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-[#D4AF37] text-black">
                              You
                            </span>
                          )}
                          {member.user_id === group.created_by && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/30">
                              Creator
                            </span>
                          )}
                        </div>
                        {contactIdentifier && (
                          <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] block truncate font-medium">
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
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Member balance info */}
                <div className="mt-4 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#292524] dark:text-[#A6A29A] font-semibold">Paid Upfront:</span>
                    <span className="font-mono font-bold text-black dark:text-white">
                      {formatCurrency(bal.paid)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#292524] dark:text-[#A6A29A] font-semibold">Share of Expenses:</span>
                    <span className="font-mono font-bold text-black dark:text-white">
                      {formatCurrency(bal.share)}
                    </span>
                  </div>

                  {/* Net status */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E6DFC8] dark:border-[#2A2926]/40">
                    <span className="font-bold text-black dark:text-white">Net Balance:</span>
                    {bal.net > 0 ? (
                      <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(bal.net)} (to receive)
                      </span>
                    ) : bal.net < 0 ? (
                      <span className="font-mono font-black text-amber-700 dark:text-amber-400">
                        -{formatCurrency(Math.abs(bal.net))} (to pay)
                      </span>
                    ) : (
                      <span className="font-mono font-semibold text-[#292524] dark:text-[#A6A29A]">
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

      {/* 4. Instant UPI Settlements & Who Owes Whom */}
      <div
        id="split-settlements-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#DFB15B] to-[#C59B27] text-black flex items-center justify-center font-black shadow-md border border-[#B38A22]/50">
              <QrCode className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2
                className="text-lg font-black tracking-tight text-black dark:text-white flex items-center gap-2"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                <span>Instant Settlements & Debts</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/30 uppercase tracking-wider">
                  UPI 1-Tap
                </span>
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
                Minimum cash flow netting · Launch GPay, PhonePe, Paytm, or scan QR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsShareDigestOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/50 transition-all self-start sm:self-auto"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span>Share on WhatsApp</span>
          </button>
        </div>

        {/* Pairwise debts list */}
        {debts.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#FAF8F5] dark:bg-[#141414] border border-[#E6DFC8] dark:border-[#2A2926] space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-black text-black dark:text-white">
              All Debts Settled!
            </h3>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] max-w-sm mx-auto font-medium">
              Everyone in this group is squared up with a ₹0.00 net balance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {debts.map((debt, idx) => {
              const isDebtor = debt.fromUserId === user?.id;
              const isCreditor = debt.toUserId === user?.id;

              return (
                <div
                  key={`${debt.fromUserId}_${debt.toUserId}_${idx}`}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    isDebtor
                      ? isDark
                        ? 'bg-[#151515] border-[#D4AF37] ring-1 ring-[#D4AF37]/40'
                        : 'bg-[#FAF8F5] border-[#D4AF37] ring-1 ring-[#D4AF37]/30 shadow-xs'
                      : isDark
                      ? 'bg-[#121212] border-[#2A2926]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Debtor */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center justify-center text-xs font-bold shrink-0">
                        {debt.fromName[0]?.toUpperCase() || 'D'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-black dark:text-white truncate block">
                          {debt.fromName} {isDebtor && '(You)'}
                        </span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                          Owes
                        </span>
                      </div>
                    </div>

                    {/* Arrow & Amount */}
                    <div className="text-center px-2 shrink-0">
                      <span className="text-sm sm:text-base font-black font-mono text-[#8C6B1F] dark:text-[#E6CA65] block">
                        {formatCurrency(debt.amount)}
                      </span>
                    </div>

                    {/* Creditor */}
                    <div className="flex items-center gap-2 min-w-0 justify-end text-right">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-black dark:text-white truncate block">
                          {debt.toName} {isCreditor && '(You)'}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                          Receives
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 flex items-center justify-center text-xs font-bold shrink-0">
                        {debt.toName[0]?.toUpperCase() || 'C'}
                      </div>
                    </div>
                  </div>

                  {/* Settle Action Button */}
                  <div className="pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#A6A29A] truncate">
                      {debt.toUpiId ? `UPI: ${debt.toUpiId}` : 'Instant settlement'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDebtForSettle(debt);
                        setIsUpiModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        isDebtor
                          ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black hover:brightness-105 shadow-md border border-[#B38A22]/50'
                          : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isDebtor ? `Pay via UPI (₹${debt.amount})` : 'Settle / QR'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recorded Settlements History */}
        {settlements.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#E6DFC8] dark:border-[#2A2926] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A6A29A]">
              Past Settlements ({settlements.length})
            </h3>
            <div className="space-y-2">
              {settlements.map((s) => (
                <div
                  key={s.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    isDark
                      ? 'bg-[#121212] border-[#2A2926]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-black dark:text-white truncate">
                        <strong>{s.from_profile?.full_name || 'Member'}</strong> paid{' '}
                        <strong>{s.to_profile?.full_name || 'Member'}</strong>
                      </p>
                      <span className="text-[10px] text-[#A6A29A]">
                        {s.payment_method} {s.upi_ref_id ? `· Ref: ${s.upi_ref_id}` : ''}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono font-black text-emerald-500 shrink-0">
                    +{formatCurrency(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Activity History Section */}
      <div
        id="split-activity-section"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#8C6B1F] dark:text-[#E6CA65]" />
            <h2
              className="text-lg font-black tracking-tight text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Activity History
            </h2>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isDark
                ? 'bg-[#2A2926] text-[#A6A29A] border-[#2A2926]'
                : 'bg-[#FAF8F5] text-[#292524] border-[#E6DFC8]'
            }`}
          >
            Immutable Audit Log
          </span>
        </div>

        {activity.length === 0 ? (
          <div id="activity-empty-state" className="py-8 text-center">
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">No activity yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivity).map(([dateGroup, items]) => (
              <div key={dateGroup} className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#8C6B1F] dark:text-[#E6CA65]">
                  {dateGroup}
                </div>
                <div className="space-y-2 pl-2 border-l border-[#E6DFC8] dark:border-[#2A2926]">
                  {items.map((act) => {
                    const isDeleted = act.action_type === 'delete_expense' || act.action_type === 'EXPENSE_DELETED';

                    if (isDeleted) {
                      return (
                        <div
                          key={act.id}
                          id={`activity-item-${act.id}`}
                          className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition-all ${
                            isDark ? 'bg-[#151515] border-rose-900/40 text-white' : 'bg-rose-50/40 border-rose-200 text-black'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                              <span className="font-black text-xs text-rose-700 dark:text-rose-400">
                                Expense deleted
                              </span>
                            </div>
                            <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-mono font-medium">
                              {formatTime(act.created_at)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
                            <div>
                              <span className="text-[#292524] dark:text-[#A6A29A] font-semibold block">Deleted by:</span>
                              <span className="font-bold text-black dark:text-white">
                                {act.actor?.full_name || 'Group Member'}
                              </span>
                            </div>

                            {act.old_value && (
                              <div>
                                <span className="text-[#292524] dark:text-[#A6A29A] font-semibold block">Amount:</span>
                                <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                                  {formatCurrency(act.old_value)}
                                </span>
                              </div>
                            )}

                            {act.deletion_reason && (
                              <div>
                                <span className="text-[#292524] dark:text-[#A6A29A] font-semibold block">Reason:</span>
                                <span className="font-bold text-black dark:text-white">
                                  {act.deletion_reason}
                                </span>
                              </div>
                            )}

                            {act.deletion_note && (
                              <div className="sm:col-span-2">
                                <span className="text-[#292524] dark:text-[#A6A29A] font-semibold block">Explanation:</span>
                                <p className="font-medium text-black dark:text-white italic">
                                  "{act.deletion_note}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (act.action_type === 'edit_expense_reference') {
                      const actorName = act.actor?.full_name || 'Member';
                      return (
                        <div
                          key={act.id}
                          id={`activity-item-${act.id}`}
                          className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                            isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                            <div>
                              <p className="font-bold text-black dark:text-white">
                                {actorName} changed reference
                              </p>
                              <p className="font-mono text-[11px] text-[#8C6B1F] dark:text-[#E6CA65] mt-0.5 font-bold">
                                &ldquo;{act.old_value || 'None'}&rdquo; → &ldquo;{act.new_value || 'None'}&rdquo;
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] shrink-0 font-mono font-medium">
                            {formatTime(act.created_at)}
                          </span>
                        </div>
                      );
                    }

                    const isOldNumeric =
                      act.old_value !== null &&
                      act.old_value !== undefined &&
                      !isNaN(Number(act.old_value)) &&
                      act.old_value.trim() !== '';
                    const isNewNumeric =
                      act.new_value !== null &&
                      act.new_value !== undefined &&
                      !isNaN(Number(act.new_value)) &&
                      act.new_value.trim() !== '';

                    return (
                      <div
                        key={act.id}
                        id={`activity-item-${act.id}`}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                          <div>
                            <p className="font-bold text-black dark:text-white">
                              {act.description}
                            </p>
                            {act.old_value && act.new_value && (
                              <p className="font-mono text-[11px] text-[#8C6B1F] dark:text-[#E6CA65] mt-0.5 font-bold">
                                {isOldNumeric ? formatCurrency(act.old_value) : `"${act.old_value}"`} →{' '}
                                {isNewNumeric ? formatCurrency(act.new_value) : `"${act.new_value}"`}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] shrink-0 font-mono font-medium">
                          {formatTime(act.created_at)}
                        </span>
                      </div>
                    );
                  })}
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
        isOwner={isOwner}
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
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <h3 className="font-black text-base text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Share Split Invitation
              </h3>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-3 mb-4">
              Share this invite link with any Konvexa Rupxa user to let them join "{group.name}" directly.
            </p>

            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono select-all ${
                isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-[#FAF8F5] border-[#E6DFC8] text-black font-semibold'
              }`}
            >
              <span className="truncate">{`${window.location.origin}?join_split=${groupId}`}</span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="p-1.5 rounded-lg bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black hover:brightness-105 shrink-0 transition-colors shadow-xs border border-[#B38A22]/40"
                title="Copy link"
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
              </button>
            </div>

            {copiedLink && (
              <p className="text-xs text-[#8C6B1F] dark:text-[#E6CA65] font-bold mt-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Link copied to clipboard!</span>
              </p>
            )}

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  isDark
                    ? 'bg-[#2A2926] hover:bg-[#6F5738]/40 text-white border-[#2A2926]'
                    : 'bg-[#FAF8F5] hover:bg-white text-black border-[#E6DFC8]'
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
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <h3 className="font-black text-base text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Add Member to Split
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium mt-3 mb-3">
              Search by email or phone number to find existing Konvexa Rupxa users.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C6B1F] dark:text-[#A6A29A]" />
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
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#292524]/60 focus:border-[#D4AF37] focus:bg-white'
                  }`}
                />
              </div>
              <button
                id="do-search-member-btn"
                type="button"
                onClick={handleSearchUser}
                disabled={searching || !searchQuery.trim()}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'bg-[#2A2926] hover:bg-[#6F5738]/40 border-[#2A2926] text-white'
                    : 'bg-[#FAF8F5] hover:bg-white border-[#E6DFC8] text-black'
                }`}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResult && (
              <div
                className={`mt-4 p-3 rounded-xl border space-y-3 ${
                  isDark ? 'border-[#2A2926] bg-[#0B0B0B]' : 'border-[#E6DFC8] bg-[#FAF8F5]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#DFB15B] to-[#C59B27] text-black border border-[#B38A22]/40 flex items-center justify-center font-black text-xs">
                      {searchResult.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-black dark:text-white">{searchResult.full_name}</p>
                      <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">{searchResult.masked_identifier}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[#292524] dark:text-[#A6A29A] font-bold uppercase tracking-wider mb-1">
                    Initial Assigned Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newMemberAmount}
                    onChange={(e) => setNewMemberAmount(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none focus:border-[#D4AF37] ${
                      isDark
                        ? 'border-[#2A2926] bg-[#0B0B0B] text-white'
                        : 'border-[#E6DFC8] bg-white text-black'
                    }`}
                  />
                </div>

                <button
                  id="confirm-add-member-btn"
                  type="button"
                  onClick={handleAddMemberSubmit}
                  disabled={amountSubmitting}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 text-black flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 border border-[#B38A22]/40 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add to Group</span>
                </button>
              </div>
            )}

            {searchAttempted && !searching && !searchResult && (
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] mt-3 text-center font-medium">
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
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E6DFC8] dark:border-[#2A2926]">
              <h3 className="font-black text-base text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Edit Group Details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingGroup(false)}
                className="text-black/60 dark:text-[#A6A29A] hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-medium border outline-none ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37] focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-white mb-1">
                  Estimated Total (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editGroupTotal}
                  onChange={(e) => setEditGroupTotal(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border outline-none ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37] focus:bg-white'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGroup(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    isDark
                      ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#2A2926]'
                      : 'border-[#E6DFC8] text-black hover:bg-[#FAF8F5]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroupDetails}
                  disabled={amountSubmitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black hover:brightness-105 disabled:opacity-50 border border-[#B38A22]/40 shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1-Click WhatsApp & Social Group Digest Modal */}
      {group && (
        <ShareSplitSummaryModal
          isOpen={isShareDigestOpen}
          onClose={() => setIsShareDigestOpen(false)}
          group={group}
          members={members}
          expenses={expenses}
          memberBalances={memberBalances}
          debts={debts}
          isDark={isDark}
        />
      )}

      {/* Instant 1-Tap UPI Settlement & QR Modal */}
      {selectedDebtForSettle && user && group && (
        <UpiSettlementModal
          isOpen={isUpiModalOpen}
          onClose={() => {
            setIsUpiModalOpen(false);
            setSelectedDebtForSettle(null);
          }}
          groupId={groupId}
          groupName={group.name}
          fromProfile={{
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone || '',
            avatar_url: user.avatar_url,
            upi_id: user.upi_id,
          }}
          toProfile={{
            id: selectedDebtForSettle.toUserId,
            full_name: selectedDebtForSettle.toName,
            upi_id: selectedDebtForSettle.toUpiId,
          }}
          debtAmount={selectedDebtForSettle.amount}
          onConfirmSettlement={handleConfirmSettlement}
          isDark={isDark}
        />
      )}
    </div>
  );
};
