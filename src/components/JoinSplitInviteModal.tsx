import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplitGroup } from '../types';
import { getSplitGroupDetails, addMemberToSplitGroup } from '../lib/db';
import { formatCurrency } from '../lib/formatters';
import { Users, CheckCircle2, AlertCircle } from 'lucide-react';

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
            : 'bg-white border-[#E6DFC8] text-black shadow-xl'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/15 text-[#C59B27] flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/40">
          <Users className="w-7 h-7" />
        </div>

        {loading ? (
          <div className="py-6 space-y-3">
            <div className="h-6 w-48 bg-[#E6DFC8]/50 rounded-lg mx-auto animate-pulse" />
            <div className="h-4 w-32 bg-[#E6DFC8]/40 rounded-lg mx-auto animate-pulse" />
          </div>
        ) : error ? (
          <div className="py-4">
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center justify-center gap-2 mb-4 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#FAF8F5] text-black hover:border-[#D4AF37] border border-[#E6DFC8]"
            >
              Close
            </button>
          </div>
        ) : group ? (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6B1F] dark:text-[#E6CA65] block mb-1">
              Group Invitation
            </span>
            <h2
              className="text-xl font-black tracking-tight mb-1 text-black dark:text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              You&apos;ve been invited to join {group.name}
            </h2>
            <p className="text-xs text-[#292524] dark:text-[#A6A29A] mb-6 font-medium">
              Created by <span className="font-bold text-black dark:text-white">{creatorName}</span>
            </p>

            <div
              className={`p-4 rounded-xl border mb-6 text-left ${
                isDark ? 'bg-[#0B0B0B] border-[#2A2926]' : 'bg-[#FAF8F5] border-[#E6DFC8]'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#292524] dark:text-[#A6A29A] font-bold">Total Group Amount:</span>
                <span className="font-black font-mono text-base text-[#8C6B1F] dark:text-[#E6CA65]">
                  {formatCurrency(group.total_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-[#E6DFC8] dark:border-[#2A2926]">
                <span className="text-[#292524] dark:text-[#A6A29A] font-bold">Currency:</span>
                <span className="font-bold text-black dark:text-white">INR (₹)</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onDismiss}
                disabled={joining}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  isDark
                    ? 'border-[#2A2926] hover:bg-[#2A2926] text-[#A6A29A]'
                    : 'border-[#E6DFC8] hover:bg-[#FAF8F5] text-black'
                }`}
              >
                Decline
              </button>
              <button
                id="join-group-confirm-btn"
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#DFB15B] to-[#C59B27] hover:brightness-105 active:scale-95 shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 border border-[#B38A22]/40"
              >
                {joining ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
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
