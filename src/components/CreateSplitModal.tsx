import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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

  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
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
      setReference('');
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
    const isEmail = foundUser.masked_identifier.includes('@');
    const memberProfile: Profile = {
      id: foundUser.id,
      full_name: foundUser.full_name,
      email: isEmail ? foundUser.masked_identifier : '',
      phone: !isEmail ? foundUser.masked_identifier : '',
      avatar_url: foundUser.avatar_url,
    };

    const newMember: MemberInput = {
      userId: foundUser.id,
      name: foundUser.full_name,
      maskedIdentifier: foundUser.masked_identifier,
      amount: 0,
      isCreator: false,
      profile: memberProfile,
    };

    setMembers([...members, newMember]);
    setCustomAmounts((prev) => ({ ...prev, [foundUser.id]: '0' }));
    setSearchResult(null);
    setSearchQuery('');
    setSearchAttempted(false);
  };

  const handleRemoveMember = (userId: string) => {
    setMembers(members.filter((m) => m.userId !== userId));
    const nextCustom = { ...customAmounts };
    delete nextCustom[userId];
    setCustomAmounts(nextCustom);
  };

  const handleCustomAmountChange = (userId: string, val: string) => {
    setCustomAmounts((prev) => ({ ...prev, [userId]: val }));
    const parsed = parseMoney(val);
    setMembers(members.map((m) => (m.userId === userId ? { ...m, amount: parsed } : m)));
  };

  const assignedTotal = members.reduce((sum, m) => sum + m.amount, 0);
  const total = parseMoney(totalAmount);
  const remainingTotal = parseMoney(total - assignedTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Split group name is required.');
      return;
    }

    const numericTotal = parseMoney(totalAmount);
    if (numericTotal < 0) {
      setError('Total amount cannot be negative.');
      return;
    }

    if (splitMode === 'custom') {
      const sum = members.reduce((acc, m) => acc + m.amount, 0);
      if (Math.abs(sum - numericTotal) > 0.01) {
        setError(
          `Custom split sum (${formatCurrency(sum)}) must exactly equal the total amount (${formatCurrency(numericTotal)}). Difference: ${formatCurrency(Math.abs(numericTotal - sum))}.`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const initialMembersData = members.map((m) => ({
        user_id: m.userId,
        amount: m.amount,
        profile: m.profile,
      }));

      const newGroup = await createSplitGroup({
        name: name.trim(),
        reference: reference.trim() || undefined,
        totalAmount: numericTotal,
        currency: 'INR',
        creatorId: user.id,
        creatorProfile: user,
        members: initialMembersData.map(m => ({
          userId: m.user_id,
          amount: m.amount,
          profile: m.profile,
        })),
      });

      onCreated(newGroup);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        id="create-split-modal-card"
        className="w-full max-w-lg rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-4 sm:p-6 shadow-2xl transition-colors max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Create Split Group
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-normal">Collaborative shared expense</p>
            </div>
          </div>
          <button
            id="close-create-split-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            id="create-split-error"
            className="mt-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-semibold"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Split Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
              Split Name
            </label>
            <input
              id="split-name-input"
              type="text"
              required
              placeholder="Group name (e.g., Goa Trip, Flat 402 Rent)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
            />
          </div>

          {/* Reference / Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Reference / Description
              </label>
              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                Optional
              </span>
            </div>
            <input
              id="split-reference-input"
              type="text"
              placeholder="What is this amount for?"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
            />
          </div>

          {/* Total Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
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
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-bold font-mono border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
                Currency
              </label>
              <input
                type="text"
                readOnly
                value="INR (₹)"
                className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] text-center"
              />
            </div>
          </div>

          {/* Split Type Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
              Split Mode
            </label>
            <div className="grid grid-cols-2 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
              <button
                id="split-mode-equal-btn"
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  splitMode === 'equal'
                    ? 'bg-[#B08D57] text-[#0B0B0B] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                    ? 'bg-[#B08D57] text-[#0B0B0B] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Custom Split
              </button>
            </div>
          </div>

          {/* Member Search Box */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-secondary)]">
              Add Members (Search by Email or Phone)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#B08D57]" />
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
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-medium border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#B08D57] transition-colors"
                />
              </div>
              <button
                id="search-user-btn"
                type="button"
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#B08D57] hover:brightness-105 text-[#0B0B0B] transition-colors disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Result preview */}
            {searchResult && (
              <div
                id="search-user-result-card"
                className="mt-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center font-bold text-xs">
                    {searchResult.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate text-[var(--text-primary)]">{searchResult.full_name}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate font-normal">{searchResult.masked_identifier}</p>
                  </div>
                </div>

                <button
                  id="add-searched-member-btn"
                  type="button"
                  onClick={() => handleAddMember(searchResult)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 flex items-center gap-1 shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add</span>
                </button>
              </div>
            )}

            {searchAttempted && !searching && !searchResult && (
              <p id="no-user-found-msg" className="text-xs text-[var(--text-secondary)] mt-2 px-1 font-normal">
                No Konvexa Rupxa user found.
              </p>
            )}
          </div>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Members ({members.length})
              </label>
              {splitMode === 'custom' && (
                <div className="text-xs font-mono">
                  <span className="text-[var(--text-secondary)] font-medium">Assigned: </span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(assignedTotal)}</span>
                  <span className="text-[var(--text-secondary)] ml-2 font-medium">Remaining: </span>
                  <span className={`font-bold ${Math.abs(remainingTotal) < 0.01 ? 'text-[#B08D57]' : 'text-red-500'}`}>
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
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#B08D57] text-[#0B0B0B] flex items-center justify-center text-xs font-bold shrink-0">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate text-[var(--text-primary)]">{member.name}</span>
                        {member.isCreator && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30 font-semibold">
                            Creator
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] block truncate font-normal">
                        {member.maskedIdentifier}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {splitMode === 'equal' ? (
                      <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
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
                          className="w-full pl-5 pr-2 py-1 rounded-lg text-xs font-mono font-semibold border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-right outline-none focus:border-[#B08D57]"
                        />
                      </div>
                    )}

                    {!member.isCreator && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              id="cancel-create-split-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-create-split-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
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
