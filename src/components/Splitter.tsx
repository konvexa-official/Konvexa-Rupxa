import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitGroupSummary, SplitGroup } from '../types';
import { formatCurrency } from '../lib/formatters';
import { CreateSplitModal } from './CreateSplitModal';
import { SplitGroupDetail } from './SplitGroupDetail';
import { addMemberToSplitGroup } from '../lib/db';
import {
  Users,
  Plus,
  Link as LinkIcon,
  AlertCircle,
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
  const { isDark } = useTheme();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialSelectedGroupId || null
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Join Split with ID / Code dialog
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreated = (newGroup: SplitGroup) => {
    onRefresh();
    setSelectedGroupId(newGroup.id);
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
      setSelectedGroupId(targetGroupId);
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
        onBack={() => {
          setSelectedGroupId(null);
          onRefresh();
        }}
      />
    );
  }

  return (
    <div id="splitter-view" className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Collaborative Splitter
          </h1>
          <p className="text-xs sm:text-sm text-[#292524] dark:text-[#A6A29A] font-medium mt-1">
            Real-time shared groups, transparent splits & immutable audit trails
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            id="open-join-split-btn"
            type="button"
            onClick={() => {
              setIsJoinModalOpen(true);
              setJoinCodeInput('');
              setJoinError(null);
            }}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              isDark
                ? 'border-[#2A2926] bg-[#0B0B0B] hover:border-[#D4AF37] text-white'
                : 'border-[#D4AF37] bg-white hover:bg-[#FAF8F5] text-black shadow-xs'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#C59B27]" />
            <span>Join with Link</span>
          </button>

          <button
            id="create-split-btn"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 transition-all shadow-sm border border-[#B38A22]/40"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Split</span>
          </button>
        </div>
      </div>

      {/* My Splits Section */}
      <div
        id="my-splits-container"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-white border-[#E6DFC8] shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-lg font-black tracking-tight text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              My Splits
            </h2>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] font-medium">
              Groups where you are an owner or collaborative member
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-[#E6DFC8]/40 animate-pulse" />
            ))}
          </div>
        ) : splits.length === 0 ? (
          <div id="splitter-empty-state" className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#D4AF37]/15 flex items-center justify-center mx-auto mb-3 text-[#C59B27] border border-[#D4AF37]/40">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-black dark:text-white">
              You don&apos;t have any shared splits yet.
            </p>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] max-w-sm mx-auto mt-1 mb-5 font-medium">
              Create a shared split group with colleagues, flatmates, or travel buddies.
              Everyone sees updates in real-time.
            </p>
            <button
              id="empty-create-split-btn"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 shadow-sm transition-all border border-[#B38A22]/40"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create your first split</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {splits.map((split) => (
              <div
                key={split.id}
                id={`split-card-${split.id}`}
                onClick={() => setSelectedGroupId(split.id)}
                role="button"
                tabIndex={0}
                className={`p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between ${
                  isDark
                    ? 'border-[#2A2926] bg-[#0B0B0B] hover:border-[#D4AF37]'
                    : 'border-[#E6DFC8] bg-[#FAF8F5] hover:border-[#D4AF37] shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        split.user_role === 'owner'
                          ? 'bg-[#D4AF37]/20 text-[#8C6B1F] dark:text-[#E6CA65] border-[#D4AF37]/50'
                          : 'bg-black/10 text-black dark:text-white border-black/20'
                      }`}
                    >
                      {split.user_role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                    <span className="text-xs text-[#292524] dark:text-[#A6A29A] flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-[#C59B27]" />
                      <span>{split.member_count} member{split.member_count === 1 ? '' : 's'}</span>
                    </span>
                  </div>

                  <h3 className="font-bold text-base tracking-tight truncate text-black dark:text-white mb-1">
                    {split.name}
                  </h3>
                  <span className="text-[11px] text-[#292524] dark:text-[#A6A29A] font-medium">
                    Created {new Date(split.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className="mt-5 pt-3 border-t border-[#E6DFC8] dark:border-[#2A2926] flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-[#292524] dark:text-[#A6A29A] uppercase tracking-wider block font-bold">
                      Your Share
                    </span>
                    <span className="text-sm font-bold font-mono text-black dark:text-white">
                      {formatCurrency(split.user_amount)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#292524] dark:text-[#A6A29A] uppercase tracking-wider block font-bold">
                      Total
                    </span>
                    <span className="text-base font-black font-mono tracking-tight text-[#8C6B1F] dark:text-[#E6CA65]">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            id="join-split-modal-card"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? 'bg-[#0B0B0B] border-[#2A2926] text-white' : 'bg-white border-[#E6DFC8] text-black'
            }`}
          >
            <h3 className="font-black text-base text-black dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Join a Shared Split Group
            </h3>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] mt-1 mb-4 font-medium">
              Paste the invitation link or group ID shared by another Konvexa Rupxa user.
            </p>

            {joinError && (
              <div className="mb-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-[#A6A29A] mb-1">
                  Invite Link or Group ID
                </label>
                <input
                  id="join-split-input"
                  type="text"
                  required
                  placeholder="Invitation link or group ID"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs border outline-none font-mono font-bold ${
                    isDark
                      ? 'bg-[#0B0B0B] border-[#2A2926] text-white placeholder-[#A6A29A] focus:border-[#D4AF37]'
                      : 'bg-[#FAF8F5] border-[#E6DFC8] text-black placeholder-[#8F8A80] focus:border-[#D4AF37]'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  disabled={joinLoading}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    isDark
                      ? 'border-[#2A2926] text-[#A6A29A] hover:bg-[#2A2926]'
                      : 'border-[#E6DFC8] text-black hover:bg-[#FAF8F5]'
                  }`}
                >
                  Cancel
                </button>
                <button
                  id="confirm-join-group-btn"
                  type="submit"
                  disabled={joinLoading || !joinCodeInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 text-black disabled:opacity-50 border border-[#B38A22]/40"
                >
                  {joinLoading ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
