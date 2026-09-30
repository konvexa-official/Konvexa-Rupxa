import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PublicUserSearchResult, Profile, SplitGroup } from '../types';
import { searchUserByContact, createSplitGroup } from '../lib/db';
import { parseMoney, formatCurrency } from '../lib/formatters';
import { X, Search, Plus, Trash2, Check, AlertCircle, Users } from 'lucide-react';

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
      if (result) {
        // Check if already in group
        const exists = members.some((m) => m.userId === result.id);
        if (exists) {
          setError('User is already added to this split group.');
          setSearchResult(null);
        } else {
          setSearchResult(result);
        }
      } else {
        setSearchResult(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to search user.');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = (foundUser: PublicUserSearchResult) => {
    const newMember: MemberInput = {
      userId: foundUser.id,
      name: foundUser.full_name,
      maskedIdentifier: foundUser.masked_identifier,
      amount: 0,
      isCreator: false,
    };

    const nextMembers = [...members, newMember];
    setMembers(nextMembers);
    setCustomAmounts((prev) => ({ ...prev, [foundUser.id]: '0' }));

    // Clear search
    setSearchQuery('');
    setSearchResult(null);
    setSearchAttempted(false);
    setError(null);
  };

  const handleRemoveMember = (userId: string) => {
    if (userId === user.id) return; // Cannot remove creator
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

  const assignedTotal = members.reduce((sum, m) => sum + m.amount, 0);
  const remainingTotal = parseMoney(parseMoney(totalAmount) - assignedTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const safeTotal = parseMoney(totalAmount);
    if (!name.trim()) {
      setError('Please provide a name for this split.');
      return;
    }
    if (safeTotal <= 0) {
      setError('Total amount must be greater than zero.');
      return;
    }
    if (members.length < 2) {
      setError('A split group must have at least 2 members. Search & add a member.');
      return;
    }

    if (splitMode === 'custom') {
      if (Math.abs(remainingTotal) > 0.05) {
        setError(
          `Custom split does not equal total amount. Difference: ${formatCurrency(
            Math.abs(remainingTotal)
          )}`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const created = await createSplitGroup({
        name: name.trim(),
        totalAmount: safeTotal,
        currency: 'INR',
        creatorId: user.id,
        creatorProfile: user,
        members: members.map((m) => ({
          userId: m.userId,
          amount: m.amount,
        })),
      });

      onCreated(created);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create split group. Please try again.');
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
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DFC8] dark:border-[#2A2926]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#C59B27]" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Create Split Group
              </h2>
              <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">Collaborative shared expense</p>
            </div>
          </div>
          <button
            id="close-create-split-btn"
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-[#A6A29A] hover:text-white hover:bg-[#2A2926]'
                : 'text-black/60 hover:text-black hover:bg-[#FAF8F5]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            id="create-split-error"
            className="mt-4 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 font-bold"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Split Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
              Split Name
            </label>
            <input
              id="split-name-input"
              type="text"
              required
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                isDark
                  ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                  : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
              }`}
            />
          </div>

          {/* Total Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                Total Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-[#8C6B1F] dark:text-[#E6CA65]">
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
                  className={`w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-black font-mono border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black focus:border-[#D4AF37]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
                Currency
              </label>
              <input
                type="text"
                readOnly
                value="INR (₹)"
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold border text-center ${
                  isDark ? 'bg-[#2A2926] border-[#2A2926] text-white' : 'bg-[#FAF8F5] border-[#E6DFC8] text-black'
                }`}
              />
            </div>
          </div>

          {/* Split Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
              Split Mode
            </label>
            <div className={`grid grid-cols-2 p-1 rounded-xl border ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
            }`}>
              <button
                id="split-mode-equal-btn"
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  splitMode === 'equal'
                    ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-xs'
                    : isDark
                    ? 'text-[#A6A29A] hover:text-white'
                    : 'text-black/70 hover:text-black'
                }`}
              >
                Equal Split
              </button>
              <button
                id="split-mode-custom-btn"
                type="button"
                onClick={() => setSplitMode('custom')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  splitMode === 'custom'
                    ? 'bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black shadow-xs'
                    : isDark
                    ? 'text-[#A6A29A] hover:text-white'
                    : 'text-black/70 hover:text-black'
                }`}
              >
                Custom Split
              </button>
            </div>
          </div>

          {/* Member Search Box */}
          <div className="pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-black dark:text-[#A6A29A]">
              Add Members (Search by Email or Phone)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C59B27]" />
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
                  className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold border transition-colors outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                  }`}
                />
              </div>
              <button
                id="search-user-btn"
                type="button"
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-black bg-black text-white hover:bg-black/85 transition-colors disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Result preview */}
            {searchResult && (
              <div
                id="search-user-result-card"
                className={`mt-2 p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 flex items-center justify-center font-bold text-xs">
                    {searchResult.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-black dark:text-white">{searchResult.full_name}</p>
                    <p className="text-[11px] text-[#292524] dark:text-[#A6A29A] truncate font-medium">{searchResult.masked_identifier}</p>
                  </div>
                </div>

                <button
                  id="add-searched-member-btn"
                  type="button"
                  onClick={() => handleAddMember(searchResult)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 flex items-center gap-1 shadow-xs transition-all border border-[#B38A22]/40"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add</span>
                </button>
              </div>
            )}

            {searchAttempted && !searching && !searchResult && (
              <p id="no-user-found-msg" className="text-xs text-[#292524] dark:text-[#A6A29A] mt-2 px-1 font-medium">
                No Konvexa Rupxa user found.
              </p>
            )}
          </div>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A]">
                Members ({members.length})
              </label>
              {splitMode === 'custom' && (
                <div className="text-xs font-mono">
                  <span className="text-[#292524] dark:text-[#A6A29A] font-bold">Assigned: </span>
                  <span className="font-bold text-black dark:text-white">{formatCurrency(assignedTotal)}</span>
                  <span className="text-[#292524] dark:text-[#A6A29A] ml-2 font-bold">Remaining: </span>
                  <span className={`font-black ${Math.abs(remainingTotal) < 0.01 ? 'text-[#8C6B1F] dark:text-[#E6CA65]' : 'text-rose-600'}`}>
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
                    isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#DFB15B] to-[#C59B27] text-black border border-[#D4AF37]/50 flex items-center justify-center text-xs font-bold shrink-0">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate text-black dark:text-white">{member.name}</span>
                        {member.isCreator && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border border-[#D4AF37]/40 font-bold">
                            Creator
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#292524] dark:text-[#A6A29A] block truncate font-medium">
                        {member.maskedIdentifier}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {splitMode === 'equal' ? (
                      <span className="text-xs font-mono font-black text-black dark:text-white">
                        {formatCurrency(member.amount)}
                      </span>
                    ) : (
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-[#8C6B1F] dark:text-[#E6CA65]">
                          ₹
                        </span>
                        <input
                          id={`custom-amount-input-${member.userId}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={customAmounts[member.userId] ?? member.amount.toString()}
                          onChange={(e) => handleCustomAmountChange(member.userId, e.target.value)}
                          className={`w-full pl-5 pr-2 py-1 rounded-lg text-xs font-mono font-bold border text-right outline-none focus:ring-1 focus:ring-[#D4AF37] ${
                            isDark
                              ? 'bg-[#0B0B0B] border-[#2A2926] text-white'
                              : 'bg-white border-[#E6DFC8] text-black'
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
                            : 'text-black/60 hover:text-rose-600 hover:bg-rose-50'
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926]">
            <button
              id="cancel-create-split-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                isDark
                  ? 'border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]'
                  : 'border-[#E6DFC8] hover:bg-[#FAF8F5] text-black'
              }`}
            >
              Cancel
            </button>
            <button
              id="submit-create-split-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 border border-[#B38A22]/40"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
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
