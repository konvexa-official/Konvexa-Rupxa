import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SplitGroupSummary, SplitGroup } from '../types';
import { formatCurrency } from '../lib/formatters';
import { CreateSplitModal } from './CreateSplitModal';
import { SplitGroupDetail } from './SplitGroupDetail';
import { DeleteGroupModal } from './DeleteGroupModal';
import { addMemberToSplitGroup } from '../lib/db';
import {
  Users,
  Plus,
  Link as LinkIcon,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface SplitterProps {
  splits: SplitGroupSummary[];
  loading: boolean;
  onRefresh: () => void;
  initialSelectedGroupId?: string | null;
}

export const Splitter: React.FC<SplitterProps> = ({
  splits,
  loading,
  onRefresh,
  initialSelectedGroupId,
}) => {
  const { user } = useAuth();

  const getUrlGroupId = (): string | null => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('split') ||
        params.get('split_id') ||
        params.get('group_id') ||
        params.get('groupId') ||
        null
      );
    } catch {
      return null;
    }
  };

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialSelectedGroupId || getUrlGroupId()
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<SplitGroupSummary | null>(null);

  // Sync when initialSelectedGroupId changes from props
  useEffect(() => {
    if (initialSelectedGroupId) {
      setSelectedGroupId(initialSelectedGroupId);
    }
  }, [initialSelectedGroupId]);

  // Sync browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const gid = getUrlGroupId();
      setSelectedGroupId(gid);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectGroup = (groupId: string) => {
    const cleanId = groupId.trim();
    setSelectedGroupId(cleanId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'splitter');
      url.searchParams.set('split', cleanId);
      window.history.pushState({ splitId: cleanId }, '', url.toString());
    } catch (e) {
      console.warn('Could not update history state:', e);
    }
  };

  const handleBack = () => {
    setSelectedGroupId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('split');
      url.searchParams.delete('split_id');
      url.searchParams.delete('group_id');
      url.searchParams.delete('groupId');
      window.history.pushState({}, '', url.toString());
    } catch (e) {
      console.warn('Could not update history state:', e);
    }
    onRefresh();
  };

  // Join Split with ID / Code dialog
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreated = (newGroup: SplitGroup) => {
    onRefresh();
    handleSelectGroup(newGroup.id);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCodeInput.trim()) return;

    let targetGroupId = joinCodeInput.trim();
    // Support either pure group ID or full URL with join_split parameter
    if (targetGroupId.includes('join_split=')) {
      try {
        const url = new URL(targetGroupId);
        targetGroupId = url.searchParams.get('join_split') || targetGroupId;
      } catch (e) {
        const match = targetGroupId.match(/join_split=([a-zA-Z0-9_-]+)/);
        if (match) targetGroupId = match[1];
      }
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      await addMemberToSplitGroup({
        groupId: targetGroupId,
        actorId: user.id,
        actorProfile: user,
        newUserId: user.id,
        amount: 0,
      });

      onRefresh();
      setIsJoinModalOpen(false);
      setJoinCodeInput('');
      handleSelectGroup(targetGroupId);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setJoinError(err.message);
      } else {
        setJoinError('Could not join split group. Please verify the link or ID.');
      }
    } finally {
      setJoinLoading(false);
    }
  };

  // If a group is currently selected, display the detailed view
  if (selectedGroupId) {
    return (
      <SplitGroupDetail
        groupId={selectedGroupId}
        onBack={handleBack}
      />
    );
  }

  return (
    <div id="splitter-view" className="space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-8 sm:pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] truncate"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Splitter
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-normal mt-0.5 sm:mt-1 truncate hidden xs:block">
            Shared group expenses, transparent calculations, and instant settlements.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            id="open-join-split-btn"
            type="button"
            onClick={() => {
              setIsJoinModalOpen(true);
              setJoinCodeInput('');
              setJoinError(null);
            }}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[#B08D57] text-[var(--text-primary)] transition-all shadow-xs flex items-center gap-1.5"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#B08D57]" />
            <span className="hidden sm:inline">Join with Link</span>
            <span className="sm:hidden">Join</span>
          </button>

          <button
            id="create-split-btn"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 active:scale-95 transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>Create Split</span>
          </button>
        </div>
      </div>

      {/* My Splits Section */}
      <div
        id="my-splits-container"
        className="rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-6 shadow-xs transition-colors"
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2
            className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            My Splits
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 sm:h-36 rounded-xl sm:rounded-2xl bg-[var(--surface-secondary)] animate-pulse" />
            ))}
          </div>
        ) : splits.length === 0 ? (
          <div id="splitter-empty-state" className="py-10 sm:py-16 text-center px-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#B08D57]/15 flex items-center justify-center mx-auto mb-2.5 text-[#B08D57] border border-[#B08D57]/30">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
              You don&apos;t have any shared splits yet.
            </p>
            <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-0.5 mb-4 font-normal">
              Create a shared split group with colleagues, flatmates, or travel buddies.
            </p>
            <button
              id="empty-create-split-btn"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:brightness-105 shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create first split</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {splits.map((split) => (
              <div
                key={split.id}
                id={`split-card-${split.id}`}
                onClick={() => handleSelectGroup(split.id)}
                role="button"
                tabIndex={0}
                className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[#B08D57] cursor-pointer transition-all flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        split.user_role === 'owner'
                          ? 'bg-[#B08D57]/15 text-[#B08D57] border-[#B08D57]/30'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      {split.user_role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-[#B08D57]" />
                        <span>{split.member_count} member{split.member_count === 1 ? '' : 's'}</span>
                      </span>

                      {/* Delete split button (only for owner) */}
                      {split.user_role === 'owner' && (
                        <button
                          type="button"
                          id={`delete-split-btn-${split.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupToDelete(split);
                          }}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete Split Group"
                          aria-label={`Delete split group ${split.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-base tracking-tight truncate text-[var(--text-primary)] mb-0.5">
                    {split.name}
                  </h3>
                  {split.reference && (
                    <p className="text-xs text-[#B08D57] font-medium truncate mb-1">
                      Ref: {split.reference}
                    </p>
                  )}
                  <span className="text-[11px] text-[var(--text-muted)] font-normal block">
                    Created {new Date(split.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block font-semibold">
                      Your Share
                    </span>
                    <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                      {formatCurrency(split.user_amount)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block font-semibold">
                      Total
                    </span>
                    <span className="text-base font-bold font-mono tracking-tight text-[#B08D57]">
                      {formatCurrency(split.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Split Modal */}
      <CreateSplitModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      {/* Join Split with Link / ID Modal */}
      {isJoinModalOpen && (
        <div
          id="join-split-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            id="join-split-modal-card"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl transition-colors"
          >
            <h3 className="font-bold text-base text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Join a Shared Split Group
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 mb-4 font-normal">
              Paste the invitation link or group ID shared by another Konvexa Rupxa user.
            </p>

            {joinError && (
              <div className="mb-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Invite Link or Group ID
                </label>
                <input
                  id="join-split-input"
                  type="text"
                  required
                  placeholder="Invitation link or group ID"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none font-mono font-medium focus:border-[#B08D57] transition-colors"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  disabled={joinLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="confirm-join-group-btn"
                  type="submit"
                  disabled={joinLoading || !joinCodeInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#B08D57] hover:brightness-105 text-[#0B0B0B] disabled:opacity-50 transition-all shadow-xs"
                >
                  {joinLoading ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Split Group Confirmation Modal */}
      {groupToDelete && (
        <DeleteGroupModal
          isOpen={Boolean(groupToDelete)}
          onClose={() => setGroupToDelete(null)}
          groupId={groupToDelete.id}
          groupName={groupToDelete.name}
          onDeleted={() => {
            setGroupToDelete(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
