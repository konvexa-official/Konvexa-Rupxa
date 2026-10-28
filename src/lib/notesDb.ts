/**
 * Konvexa Rupxa Notes Database & Sync Service Layer
 * 
 * Features:
 * - Per-user Firestore collection: users/{userId}/notes/{noteId}
 * - Offline-first architecture with user-scoped persistent localStorage caching
 * - Operation queue with stable operation IDs for idempotent retry
 * - Optimistic concurrency control & 3-way conflict resolution without silent data loss
 * - 30-day trash retention calculation & cleanup
 * - Real-time listeners with safe pending edit preservation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, auth } from './firebase';
import { Note, ChecklistItem, ConflictedNoteState } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Notes Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Local storage keys scoped by user
function getNotesStorageKey(userId: string): string {
  return `rupxa_notes_v1_${userId}`;
}

function getPendingStorageKey(userId: string): string {
  return `rupxa_notes_pending_v1_${userId}`;
}

export interface PendingOperation {
  operationId: string;
  userId: string;
  noteId: string;
  type: 'upsert' | 'delete';
  note?: Note;
  baseVersion: number;
  timestamp: number;
}

// Read and write helpers for localStorage
function readUserNotesLocal(userId: string): Note[] {
  try {
    const raw = localStorage.getItem(getNotesStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Failed to read notes from localStorage for ${userId}:`, err);
    return [];
  }
}

function writeUserNotesLocal(userId: string, notes: Note[]): void {
  try {
    localStorage.setItem(getNotesStorageKey(userId), JSON.stringify(notes));
  } catch (err) {
    console.error(`Failed to write notes to localStorage for ${userId}:`, err);
  }
}

function readPendingOpsLocal(userId: string): PendingOperation[] {
  try {
    const raw = localStorage.getItem(getPendingStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Failed to read pending ops for ${userId}:`, err);
    return [];
  }
}

function writePendingOpsLocal(userId: string, ops: PendingOperation[]): void {
  try {
    localStorage.setItem(getPendingStorageKey(userId), JSON.stringify(ops));
  } catch (err) {
    console.error(`Failed to write pending ops for ${userId}:`, err);
  }
}

/**
 * 30-Day Trash Retention helper
 */
export const RETENTION_DAYS = 30;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface RetentionStatus {
  daysRemaining: number;
  isEligibleForPurge: boolean;
  deletedAtFormatted: string;
}

export function computeRetentionStatus(deletedAt: string | null): RetentionStatus {
  if (!deletedAt) {
    return { daysRemaining: RETENTION_DAYS, isEligibleForPurge: false, deletedAtFormatted: '' };
  }
  const deletedTime = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsed = Math.max(0, now - deletedTime);
  const remainingMs = RETENTION_MS - elapsed;
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const isEligibleForPurge = remainingMs <= 0;

  let deletedAtFormatted = '';
  try {
    deletedAtFormatted = new Date(deletedAt).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    deletedAtFormatted = deletedAt;
  }

  return { daysRemaining, isEligibleForPurge, deletedAtFormatted };
}

/**
 * Generate a cryptographically random stable identifier
 */
export function generateNoteId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `nt_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
  return `nt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateChecklistItemId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `chk_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `chk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Fetch cached notes for a user and automatically purge notes older than 30 days in trash
 */
export function getLocalNotes(userId: string): Note[] {
  if (!userId) return [];
  const raw = readUserNotesLocal(userId);
  const activeAndValid = raw.filter((n) => {
    if (n.status !== 'trashed' || !n.deletedAt) return true;
    return !computeRetentionStatus(n.deletedAt).isEligibleForPurge;
  });

  if (activeAndValid.length !== raw.length) {
    writeUserNotesLocal(userId, activeAndValid);
    // Asynchronously delete permanently from Firestore as well
    autoPurgeExpiredTrash(userId).catch(console.error);
  }

  return activeAndValid;
}

/**
 * Automatically purge any trashed notes that have passed the 30-day retention window
 * Permanently deletes them from both local storage and Firestore.
 */
export async function autoPurgeExpiredTrash(userId: string): Promise<number> {
  if (!userId) return 0;
  const allNotes = readUserNotesLocal(userId);
  const expired = allNotes.filter((n) => {
    if (n.status !== 'trashed' || !n.deletedAt) return false;
    return computeRetentionStatus(n.deletedAt).isEligibleForPurge;
  });

  if (expired.length === 0) return 0;

  for (const note of expired) {
    await permanentlyDeleteNote(userId, note.id);
  }

  return expired.length;
}

/**
 * Save note locally immediately, queue pending sync, and attempt remote sync
 */
export async function saveNoteLocally(
  note: Note,
  baseVersion: number,
  onConflict?: (conflict: ConflictedNoteState) => void
): Promise<{ note: Note; syncStatus: 'saved_cloud' | 'saved_offline' | 'conflict' }> {
  const userId = note.userId;
  if (!userId) throw new Error('Note must have a valid userId');

  // Update local store
  const existingNotes = readUserNotesLocal(userId);
  const idx = existingNotes.findIndex((n) => n.id === note.id);
  let updatedList: Note[];
  if (idx >= 0) {
    updatedList = [...existingNotes];
    updatedList[idx] = note;
  } else {
    updatedList = [note, ...existingNotes];
  }
  writeUserNotesLocal(userId, updatedList);

  // Queue pending operation with stable ID
  const pendingOps = readPendingOpsLocal(userId).filter((op) => op.noteId !== note.id);
  const newOp: PendingOperation = {
    operationId: `op_${Date.now()}_${note.id}`,
    userId,
    noteId: note.id,
    type: 'upsert',
    note,
    baseVersion,
    timestamp: Date.now(),
  };
  pendingOps.push(newOp);
  writePendingOpsLocal(userId, pendingOps);

  // Attempt remote synchronization
  if (isFirebaseConfigured() && db && navigator.onLine) {
    try {
      const syncResult = await syncSingleNote(newOp, onConflict);
      if (syncResult === 'conflict') {
        return { note, syncStatus: 'conflict' };
      }
      return { note, syncStatus: 'saved_cloud' };
    } catch (err) {
      console.warn('Background sync failed; saved offline locally:', err);
      return { note, syncStatus: 'saved_offline' };
    }
  }

  return { note, syncStatus: 'saved_offline' };
}

/**
 * Move a note to Trash with deletedAt timestamp
 */
export async function trashNote(
  userId: string,
  noteId: string
): Promise<void> {
  const existingNotes = readUserNotesLocal(userId);
  const target = existingNotes.find((n) => n.id === noteId);
  if (!target) return;

  const updated: Note = {
    ...target,
    status: 'trashed',
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: (target.version || 1) + 1,
  };

  await saveNoteLocally(updated, target.version || 1);
}

/**
 * Restore a trashed note back to active
 */
export async function restoreNote(
  userId: string,
  noteId: string
): Promise<Note | null> {
  const existingNotes = readUserNotesLocal(userId);
  const target = existingNotes.find((n) => n.id === noteId);
  if (!target) return null;

  const updated: Note = {
    ...target,
    status: 'active',
    deletedAt: null,
    updatedAt: new Date().toISOString(),
    version: (target.version || 1) + 1,
  };

  await saveNoteLocally(updated, target.version || 1);
  return updated;
}

/**
 * Toggle archive state of an active note
 */
export async function toggleArchiveNote(
  userId: string,
  noteId: string
): Promise<Note | null> {
  const existingNotes = readUserNotesLocal(userId);
  const target = existingNotes.find((n) => n.id === noteId);
  if (!target) return null;

  const nextStatus = target.status === 'archived' ? 'active' : 'archived';
  const updated: Note = {
    ...target,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    version: (target.version || 1) + 1,
  };

  await saveNoteLocally(updated, target.version || 1);
  return updated;
}

/**
 * Permanently delete a single note
 */
export async function permanentlyDeleteNote(
  userId: string,
  noteId: string
): Promise<void> {
  // Remove from local notes
  const existingNotes = readUserNotesLocal(userId).filter((n) => n.id !== noteId);
  writeUserNotesLocal(userId, existingNotes);

  // Queue delete op
  const pendingOps = readPendingOpsLocal(userId).filter((op) => op.noteId !== noteId);
  const delOp: PendingOperation = {
    operationId: `del_${Date.now()}_${noteId}`,
    userId,
    noteId,
    type: 'delete',
    baseVersion: 0,
    timestamp: Date.now(),
  };
  pendingOps.push(delOp);
  writePendingOpsLocal(userId, pendingOps);

  if (isFirebaseConfigured() && db && navigator.onLine) {
    try {
      const docPath = `users/${userId}/notes/${noteId}`;
      await deleteDoc(doc(db, 'users', userId, 'notes', noteId));
      // Remove from pending
      const remaining = readPendingOpsLocal(userId).filter((op) => op.operationId !== delOp.operationId);
      writePendingOpsLocal(userId, remaining);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}/notes/${noteId}`);
    }
  }
}

/**
 * Empty all notes in Trash
 */
export async function emptyTrash(userId: string): Promise<number> {
  const allNotes = readUserNotesLocal(userId);
  const trashedNotes = allNotes.filter((n) => n.status === 'trashed');
  if (trashedNotes.length === 0) return 0;

  for (const note of trashedNotes) {
    await permanentlyDeleteNote(userId, note.id);
  }

  return trashedNotes.length;
}

/**
 * Purge notes older than 30 days
 */
export async function purgeExpiredTrash(userId: string): Promise<number> {
  const allNotes = readUserNotesLocal(userId);
  const expiredNotes = allNotes.filter((n) => {
    if (n.status !== 'trashed' || !n.deletedAt) return false;
    const { isEligibleForPurge } = computeRetentionStatus(n.deletedAt);
    return isEligibleForPurge;
  });

  for (const note of expiredNotes) {
    await permanentlyDeleteNote(userId, note.id);
  }

  return expiredNotes.length;
}

/**
 * Synchronize a single pending note operation with conflict detection
 */
async function syncSingleNote(
  op: PendingOperation,
  onConflict?: (conflict: ConflictedNoteState) => void
): Promise<'synced' | 'conflict'> {
  if (!isFirebaseConfigured() || !db) return 'synced';
  const { userId, noteId, type, note, baseVersion } = op;
  const docRef = doc(db, 'users', userId, 'notes', noteId);
  const docPath = `users/${userId}/notes/${noteId}`;

  if (type === 'delete') {
    try {
      await deleteDoc(docRef);
      const remaining = readPendingOpsLocal(userId).filter((p) => p.operationId !== op.operationId);
      writePendingOpsLocal(userId, remaining);
      return 'synced';
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  }

  if (!note) return 'synced';

  try {
    const remoteSnap = await getDoc(docRef);
    if (remoteSnap.exists()) {
      const remoteData = remoteSnap.data() as Note;
      const remoteVer = remoteData.version || 1;

      // Check if remote version advanced since local editing started
      if (remoteVer > baseVersion) {
        // Did text or checklist content actually diverge?
        const textDiverged =
          note.type === 'text' &&
          (note.content !== remoteData.content || note.title !== remoteData.title);
        const checklistDiverged =
          note.type === 'checklist' &&
          (JSON.stringify(note.checklistItems) !== JSON.stringify(remoteData.checklistItems) ||
            note.title !== remoteData.title);

        if (textDiverged || checklistDiverged) {
          // Conflict detected! Do NOT overwrite!
          console.warn(`Sync conflict detected for note ${noteId}. Local: v${note.version}, Remote: v${remoteVer}, Base: v${baseVersion}`);
          if (onConflict) {
            onConflict({
              noteId,
              localNote: note,
              serverNote: remoteData,
              baseVersion,
            });
          }
          return 'conflict';
        } else {
          // Non-conflicting property merge (e.g. pin/favorite or status)
          const merged: Note = {
            ...remoteData,
            isPinned: note.isPinned,
            isFavorite: note.isFavorite,
            isFinanceNote: note.isFinanceNote,
            status: note.status,
            deletedAt: note.deletedAt,
            updatedAt: new Date().toISOString(),
            version: remoteVer + 1,
          };
          await setDoc(docRef, merged, { merge: true });
          const remaining = readPendingOpsLocal(userId).filter((p) => p.operationId !== op.operationId);
          writePendingOpsLocal(userId, remaining);
          return 'synced';
        }
      }
    }

    // Normal safe write
    await setDoc(docRef, note, { merge: true });
    const remaining = readPendingOpsLocal(userId).filter((p) => p.operationId !== op.operationId);
    writePendingOpsLocal(userId, remaining);
    return 'synced';
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

/**
 * Reconcile conflict by choosing local, remote, or merged version
 */
export async function resolveNoteConflict(
  userId: string,
  resolution: 'keep_local' | 'keep_remote' | 'merge_both',
  conflict: ConflictedNoteState
): Promise<Note> {
  const { localNote, serverNote } = conflict;
  let resolvedNote: Note;

  if (resolution === 'keep_local') {
    resolvedNote = {
      ...localNote,
      version: Math.max(localNote.version, serverNote.version) + 1,
      updatedAt: new Date().toISOString(),
    };
  } else if (resolution === 'keep_remote') {
    resolvedNote = {
      ...serverNote,
      version: serverNote.version + 1,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Merge both: combine titles and text
    let mergedContent = localNote.content;
    if (localNote.type === 'text') {
      mergedContent = `${localNote.content}\n\n--- Cloud Version (${new Date(serverNote.updatedAt).toLocaleTimeString()}) ---\n${serverNote.content}`;
    }
    // If checklist: merge items by ID or append
    let mergedChecklist: ChecklistItem[] = [...localNote.checklistItems];
    if (localNote.type === 'checklist') {
      const existingIds = new Set(localNote.checklistItems.map((i) => i.id));
      for (const item of serverNote.checklistItems || []) {
        if (!existingIds.has(item.id)) {
          mergedChecklist.push({ ...item, position: mergedChecklist.length });
        }
      }
    }

    resolvedNote = {
      ...localNote,
      content: mergedContent,
      checklistItems: mergedChecklist,
      version: Math.max(localNote.version, serverNote.version) + 1,
      updatedAt: new Date().toISOString(),
    };
  }

  await saveNoteLocally(resolvedNote, resolvedNote.version);
  return resolvedNote;
}

/**
 * Process all pending offline sync operations on reconnect
 */
export async function syncPendingNotes(
  userId: string,
  onConflict?: (conflict: ConflictedNoteState) => void
): Promise<void> {
  if (!isFirebaseConfigured() || !db || !navigator.onLine || !userId) return;

  const pending = readPendingOpsLocal(userId);
  if (pending.length === 0) return;

  for (const op of pending) {
    try {
      await syncSingleNote(op, onConflict);
    } catch (err) {
      console.warn(`Pending sync error for op ${op.operationId}:`, err);
    }
  }
}

/**
 * Real-time listener for user notes
 */
export function subscribeToUserNotes(
  userId: string,
  onNotesUpdate: (notes: Note[]) => void,
  onConflict?: (conflict: ConflictedNoteState) => void
): Unsubscribe {
  if (!userId) {
    return () => {};
  }

  // Provide cached notes immediately
  const initialLocal = readUserNotesLocal(userId);
  onNotesUpdate(initialLocal);

  if (!isFirebaseConfigured() || !db) {
    return () => {};
  }

  const notesCol = collection(db, 'users', userId, 'notes');
  const q = query(notesCol);

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const serverNotes: Note[] = [];
      snapshot.forEach((docSnap) => {
        serverNotes.push(docSnap.data() as Note);
      });

      // Merge with pending local operations so in-flight edits are not clobbered
      const pendingOps = readPendingOpsLocal(userId);
      const pendingNoteIds = new Set(pendingOps.map((op) => op.noteId));

      const mergedNotesMap = new Map<string, Note>();

      for (const sn of serverNotes) {
        if (pendingNoteIds.has(sn.id)) {
          // Local pending edit takes precedence while sync is running
          const localNote = initialLocal.find((n) => n.id === sn.id);
          if (localNote) {
            mergedNotesMap.set(sn.id, localNote);
          } else {
            mergedNotesMap.set(sn.id, sn);
          }
        } else {
          mergedNotesMap.set(sn.id, sn);
        }
      }

      // Add any brand-new locally created notes that haven't reached server yet
      for (const op of pendingOps) {
        if (op.type === 'upsert' && op.note && !mergedNotesMap.has(op.noteId)) {
          mergedNotesMap.set(op.noteId, op.note);
        } else if (op.type === 'delete') {
          mergedNotesMap.delete(op.noteId);
        }
      }

      const activeAndValidList = Array.from(mergedNotesMap.values()).filter((n) => {
        if (n.status !== 'trashed' || !n.deletedAt) return true;
        return !computeRetentionStatus(n.deletedAt).isEligibleForPurge;
      });

      writeUserNotesLocal(userId, activeAndValidList);
      onNotesUpdate(activeAndValidList);

      // Asynchronously purge expired trash from all places
      autoPurgeExpiredTrash(userId).catch(console.error);

      // Attempt any pending syncs
      syncPendingNotes(userId, onConflict);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/notes`);
    }
  );

  return unsub;
}
