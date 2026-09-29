import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PublicUserSearchResult, Profile, SplitGroup } from '../types';
import { searchUserByContact, createSplitGroup } from '../lib/db';
import { parseMoney, formatCurrency } from '../lib/formatters';
import { X, Search, Plus, Trash2, Check, AlertCircle, Users, CheckCircle2 } from 'lucide-react';

interface CreateSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: SplitGroup) => void;
}

interface MemberInput {
  userId: string;
  name: string;
  maskedIdentifier: string;
  amount: number;
  isCreator: boolean;
  profile?: Profile;
}

export const CreateSplitModal: React.FC<CreateSplitModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');

  // Member search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PublicUserSearchResult | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Members list
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with creator on open
  useEffect(() => {
    if (isOpen && user) {
      setName('');
      setTotalAmount('');
      setSplitMode('equal');
      setSearchQuery('');
      setSearchResult(null);
      setSearchAttempted(false);
      setError(null);

      const creatorMember: MemberInput = {
        userId: user.id,
        name: user.full_name,
        maskedIdentifier: user.email,
        amount: 0,
        isCreator: true,
        profile: user,
      };
      setMembers([creatorMember]);
      setCustomAmounts({ [user.id]: '0' });
    }
  }, [isOpen, user]);

  // Recalculate equal splits whenever total or members change
  useEffect(() => {
    const total = parseMoney(totalAmount);
    if (splitMode === 'equal' && members.length > 0) {
      const perPerson = Math.floor((total / members.length) * 100) / 100;
      // Remainder added to creator to balance paise precisely
      const remainder = parseMoney(total - perPerson * members.length);

      const updated = members.map((m, idx) => ({
        ...m,
        amount: idx === 0 ? parseMoney(perPerson + remainder) : perPerson,
      }));
      setMembers(updated);
    }
  }, [totalAmount, members.length, splitMode]);

  if (!isOpen || !user) return null;

  // Search member by email or phone
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchAttempted(true);
    setSearchResult(null);
    setError(null);

    try {
      const result = await searchUserByContact(searchQuery, user.id);
      setSearchResult(result);
    } catch (err) {
      console.error('Error searching user:', err);
    } finally {
      setSearching(false);
    }
  };

  // Add searched member
  const handleAddMember = (result: PublicUserSearchResult) => {
    if (members.some((m) => m.userId === result.id)) {
      setError('User is already added to this split.');
      return;
    }

    const newMember: MemberInput = {
      userId: result.id,
      name: result.full_name,
      maskedIdentifier: result.masked_identifier,
      amount: 0,
      isCreator: false,
    };

    const nextMembers = [...members, newMember];
    setMembers(nextMembers);
    setCustomAmounts((prev) => ({ ...prev, [result.id]: '0' }));
    setSearchQuery('');
    setSearchResult(null);
    setSearchAttempted(false);
  };

  const handleRemoveMember = (userId: string) => {
    const nextMembers = members.filter((m) => m.userId !== userId);
    setMembers(nextMembers);
    const nextCustom = { ...customAmounts };
    delete nextCustom[userId];
    setCustomAmounts(nextCustom);
  };

  const handleCustomAmountChange = (userId: string, val: string) => {
    setCustomAmounts((prev) => ({ ...prev, [userId]: val }));
    const parsed = parseMoney(val);
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, amount: parsed } : m))
    );
  };

  // Compute assigned and remaining
  const numTotal = parseMoney(totalAmount);
  const assignedTotal = members.reduce((sum, m) => sum + m.amount, 0);
  const remainingTotal = parseMoney(numTotal - assignedTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Split group name is required.');
      return;
    }
    if (numTotal < 0) {
      setError('Total amount cannot be negative.');
      return;
    }
    if (members.length === 0) {
      setError('At least one member is required.');
      return;
    }

    // Custom split validation: If total > 0, Assigned must equal Total
    if (numTotal > 0 && splitMode === 'custom' && Math.abs(remainingTotal) > 0.01) {
      setError(
        `Assigned amount (${formatCurrency(assignedTotal)}) must equal the group total (${formatCurrency(numTotal)}). Remaining: ${formatCurrency(remainingTotal)}.`
      );
      return;
    }

    setLoading(true);
    try {
      const created = await createSplitGroup({
        name: name.trim(),
        totalAmount: numTotal,
        currency: 'INR',
        creatorId: user.id,
        creatorProfile: user,
        members: members.map((m) => ({
          userId: m.userId,
          amount: m.amount,
          profile: m.profile,
        })),
      });

      onCreated(created);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create split group.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="create-split-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="create-split-modal-card"
        className={`w-full max-w-lg rounded-2xl border p-6 my-8 shadow-2xl transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white shadow-black/80'
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-black/20'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#0B0B0B] dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Create Split Group
              </h2>
              <p className="text-xs text-[#6F5738] dark:text-[#A6A29A]">Collaborative shared expense</p>
            </div>
          </div>
          <button
            id="close-create-split-btn"
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-[#A6A29A] hover:text-white hover:bg-[#2A2926]'
                : 'text-[#6F5738] hover:text-[#0B0B0B] hover:bg-[#2A2926]/20'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            id="create-split-error"
            className="mt-4 p-3 rounded-xl border border-[#6F5738]/40 bg-[#6F5738]/20 text-[#0B0B0B] dark:text-white text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-[#B08D57]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Split Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
              Split Name
            </label>
            <input
              id="split-name-input"
              type="text"
              required
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                  : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
              }`}
            />
          </div>

          {/* Total Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                Total Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#B08D57]">
                  ₹
                </span>
                <input
                  id="split-total-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className={`w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-semibold font-mono border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#B08D57]'
                      : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] focus:border-[#B08D57]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
                Currency
              </label>
              <input
                type="text"
                readOnly
                value="INR (₹)"
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border text-center ${
                  isDark ? 'bg-[#2A2926] border-[#2A2926] text-white' : 'bg-[#2A2926]/10 border-[#2A2926] text-[#0B0B0B]'
                }`}
              />
            </div>
          </div>

          {/* Split Type Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
              Split Mode
            </label>
            <div className={`grid grid-cols-2 p-1 rounded-xl border ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#2A2926]/10 border-[#2A2926]'
            }`}>
              <button
                id="split-mode-equal-btn"
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  splitMode === 'equal'
                    ? 'bg-[#B08D57] text-[#0B0B0B] shadow-sm'
                    : isDark
                    ? 'text-[#A6A29A] hover:text-white'
                    : 'text-[#6F5738] hover:text-[#0B0B0B]'
                }`}
              >
                Equal Split
              </button>
              <button
                id="split-mode-custom-btn"
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  splitMode === 'custom'
                    ? 'bg-[#B08D57] text-[#0B0B0B] shadow-sm'
                    : isDark
                    ? 'text-[#A6A29A] hover:text-white'
                    : 'text-[#6F5738] hover:text-[#0B0B0B]'
                }`}
              >
                Custom Split
              </button>
            </div>
          </div>

          {/* Member Search Box */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[#6F5738] dark:text-[#A6A29A]">
              Add Members (Search by Email or Phone)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A6A29A]" />
                <input
                  id="search-user-input"
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
                      handleSearch();
                    }
                  }}
                  className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border transition-colors outline-none focus:ring-2 focus:ring-[#B08D57]/20 ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#B08D57]'
                      : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] placeholder-[#6F5738]/60 focus:border-[#B08D57]'
                  }`}
                />
              </div>
              <button
                id="search-user-btn"
                type="button"
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#2A2926] bg-[#2A2926] text-white hover:bg-[#6F5738]/40 transition-colors disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Result preview */}
            {searchResult && (
              <div
                id="search-user-result-card"
                className={`mt-2 p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 flex items-center justify-center font-bold text-xs">
                    {searchResult.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-[#0B0B0B] dark:text-white">{searchResult.full_name}</p>
                    <p className="text-[11px] text-[#6F5738] dark:text-[#A6A29A] truncate">{searchResult.masked_identifier}</p>
                  </div>
                </div>

                <button
                  id="add-searched-member-btn"
                  type="button"
                  onClick={() => handleAddMember(searchResult)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] flex items-center gap-1 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            )}

            {searchAttempted && !searching && !searchResult && (
              <p id="no-user-found-msg" className="text-xs text-[#6F5738] dark:text-[#A6A29A] mt-2 px-1">
                No Konvexa Rupxa user found.
              </p>
            )}
          </div>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F5738] dark:text-[#A6A29A]">
                Members ({members.length})
              </label>
              {splitMode === 'custom' && (
                <div className="text-xs font-mono">
                  <span className="text-[#6F5738] dark:text-[#A6A29A]">Assigned: </span>
                  <span className="font-bold text-[#0B0B0B] dark:text-white">{formatCurrency(assignedTotal)}</span>
                  <span className="text-[#6F5738] dark:text-[#A6A29A] ml-2">Remaining: </span>
                  <span className={`font-bold ${Math.abs(remainingTotal) < 0.01 ? 'text-[#B08D57]' : 'text-[#6F5738]'}`}>
                    {formatCurrency(remainingTotal)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {members.map((member) => (
                <div
                  key={member.userId}
                  id={`member-row-${member.userId}`}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#2A2926] text-white border border-[#6F5738]/30 flex items-center justify-center text-xs font-semibold shrink-0">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate text-[#0B0B0B] dark:text-white">{member.name}</span>
                        {member.isCreator && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#B08D57]/15 text-[#B08D57] border border-[#6F5738]/30 font-medium">
                            Creator
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#6F5738] dark:text-[#A6A29A] block truncate">
                        {member.maskedIdentifier}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {splitMode === 'equal' ? (
                      <span className="text-xs font-mono font-bold text-[#0B0B0B] dark:text-white">
                        {formatCurrency(member.amount)}
                      </span>
                    ) : (
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[#B08D57]">
                          ₹
                        </span>
                        <input
                          id={`custom-amount-input-${member.userId}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={customAmounts[member.userId] ?? member.amount.toString()}
                          onChange={(e) => handleCustomAmountChange(member.userId, e.target.value)}
                          className={`w-full pl-5 pr-2 py-1 rounded-lg text-xs font-mono font-semibold border text-right outline-none focus:ring-1 focus:ring-[#B08D57] ${
                            isDark
                              ? 'bg-[#0B0B0B] border-[#2A2926] text-white'
                              : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B]'
                          }`}
                        />
                      </div>
                    )}

                    {!member.isCreator && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className={`p-1 rounded transition-colors ${
                          isDark
                            ? 'text-[#A6A29A] hover:text-white hover:bg-[#6F5738]/30'
                            : 'text-[#6F5738] hover:text-[#0B0B0B] hover:bg-[#2A2926]/20'
                        }`}
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2926]">
            <button
              id="cancel-create-split-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]'
                  : 'border-[#2A2926] hover:bg-[#2A2926]/10 text-[#6F5738]'
              }`}
            >
              Cancel
            </button>
            <button
              id="submit-create-split-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0B0B0B]/30 border-t-[#0B0B0B] rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Shared Split</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
