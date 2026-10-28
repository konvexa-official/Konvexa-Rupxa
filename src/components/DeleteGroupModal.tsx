import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { deleteSplitGroup } from '../lib/db';
import { Trash2, X, AlertTriangle, AlertCircle } from 'lucide-react';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  onDeleted: () => void;
}

export const DeleteGroupModal: React.FC<DeleteGroupModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  onDeleted,
}) => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (!user) {
      setError('You must be logged in to delete this group.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteSplitGroup({
        groupId,
        actorId: user.id,
        actorProfile: user,
      });

      onDeleted();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to delete group:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete group. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="delete-group-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        id="delete-group-modal-card"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3
                className="font-bold text-base text-[var(--text-primary)]"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Delete this split group?
              </h3>
            </div>
          </div>
          <button
            type="button"
            id="close-delete-group-modal-btn"
            onClick={() => !loading && onClose()}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Group name reference */}
        <div className="mt-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]">
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold block mb-0.5">
            Group
          </span>
          <span className="font-bold text-sm text-[var(--text-primary)] truncate block">
            {groupName}
          </span>
        </div>

        {/* Explanatory notice */}
        <div className="my-4 space-y-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p className="font-semibold text-[var(--text-primary)]">
            This will remove the group from your active Splitter list.
          </p>
          <p>All group members will lose access to this group.</p>
          <p className="font-semibold text-red-600 dark:text-red-400">
            This action cannot be undone.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 mb-4 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            id="cancel-delete-group-btn"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] hover:border-[#B08D57] transition-colors"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-group-btn"
            type="button"
            onClick={handleConfirmDelete}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-all shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{loading ? 'Deleting...' : 'Delete Group'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
