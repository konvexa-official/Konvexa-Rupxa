import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitGroup, Profile } from '../types';
import { getSplitGroupDetails, addMemberToSplitGroup } from '../lib/db';
import { formatCurrency } from '../lib/formatters';
import { Users, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface JoinSplitInviteModalProps {
  groupId: string;
  onJoined: (groupId: string) => void;
  onDismiss: () => void;
}

export const JoinSplitInviteModal: React.FC<JoinSplitInviteModalProps> = ({
  groupId,
  onJoined,
  onDismiss,
}) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [group, setGroup] = useState<SplitGroup | null>(null);
  const [creatorName, setCreatorName] = useState<string>('A Konvexa Rupxa User');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGroup() {
      if (!user) return;
      try {
        const details = await getSplitGroupDetails(groupId, user.id);
        if (details) {
          setGroup(details.group);
          const creatorMember = details.members.find((m) => m.user_id === details.group.created_by);
          if (creatorMember?.profile?.full_name) {
            setCreatorName(creatorMember.profile.full_name);
          }
        } else {
          setError('This split group invite could not be found or has expired.');
        }
      } catch (err) {
        console.error('Failed to load split invite:', err);
        setError('Unable to load split group details.');
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [groupId, user]);

  const handleJoin = async () => {
    if (!user || !group) return;
    setJoining(true);
    setError(null);
    try {
      await addMemberToSplitGroup({
        groupId: group.id,
        actorId: user.id,
        actorProfile: user,
        newUserId: user.id,
        amount: 0,
      });
      onJoined(group.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to join group.');
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      id="join-split-invite-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="join-split-invite-card"
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl text-center transition-all ${
          isDark
            ? 'bg-[#0B0B0B] border-[#2A2926] text-white shadow-black/80'
            : 'bg-[#F5F2EA] border-[#2A2926] text-[#0B0B0B] shadow-black/20'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#B08D57]/15 text-[#B08D57] flex items-center justify-center mx-auto mb-4 border border-[#6F5738]/30">
          <Users className="w-7 h-7" />
        </div>

        {loading ? (
          <div className="py-6 space-y-3">
            <div className="h-6 w-48 bg-[#2A2926] rounded-lg mx-auto animate-pulse" />
            <div className="h-4 w-32 bg-[#2A2926]/60 rounded-lg mx-auto animate-pulse" />
          </div>
        ) : error ? (
          <div className="py-4">
            <div className="p-3 rounded-xl border border-[#6F5738]/40 bg-[#6F5738]/20 text-[#0B0B0B] dark:text-white text-xs flex items-center justify-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B08D57]" />
              <span>{error}</span>
            </div>
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2A2926] text-white hover:bg-[#6F5738]/40 border border-[#2A2926]"
            >
              Close
            </button>
          </div>
        ) : group ? (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B08D57] block mb-1">
              Group Invitation
            </span>
            <h2
              className="text-xl font-bold tracking-tight mb-1 text-[#0B0B0B] dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              You've been invited to join {group.name}
            </h2>
            <p className="text-xs text-[#6F5738] dark:text-[#A6A29A] mb-6">
              Created by <span className="font-semibold text-[#0B0B0B] dark:text-white">{creatorName}</span>
            </p>

            <div
              className={`p-4 rounded-xl border mb-6 text-left ${
                isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#F5F2EA] border-[#2A2926]'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6F5738] dark:text-[#A6A29A]">Total Group Amount:</span>
                <span className="font-bold font-mono text-base text-[#B08D57]">
                  {formatCurrency(group.total_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-[#2A2926]">
                <span className="text-[#6F5738] dark:text-[#A6A29A]">Currency:</span>
                <span className="font-medium text-[#0B0B0B] dark:text-white">INR (₹)</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onDismiss}
                disabled={joining}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  isDark
                    ? 'border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]'
                    : 'border-[#2A2926] hover:bg-[#2A2926]/10 text-[#6F5738]'
                }`}
              >
                Decline
              </button>
              <button
                id="join-group-confirm-btn"
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-[#0B0B0B] bg-[#B08D57] hover:bg-[#9F7E4C] shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {joining ? (
                  <div className="w-4 h-4 border-2 border-[#0B0B0B]/30 border-t-[#0B0B0B] rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Join Group</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
