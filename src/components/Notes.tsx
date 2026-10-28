import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Note,
  NoteType,
  ChecklistItem,
  NoteNavFilter,
  NoteSortOption,
  ConflictedNoteState,
} from '../types';
import {
  getLocalNotes,
  saveNoteLocally,
  trashNote,
  restoreNote,
  toggleArchiveNote,
  permanentlyDeleteNote,
  emptyTrash,
  autoPurgeExpiredTrash,
  resolveNoteConflict,
  subscribeToUserNotes,
  generateNoteId,
  generateChecklistItemId,
  computeRetentionStatus,
  syncPendingNotes,
} from '../lib/notesDb';
import {
  FileText,
  CheckSquare,
  Pin,
  Star,
  Coins,
  Archive,
  Trash2,
  Plus,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  Check,
  Cloud,
  CloudOff,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Info,
  MoreVertical,
} from 'lucide-react';

export const Notes: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';

  // All notes in state (synced with localStorage & Firestore)
  const [notes, setNotes] = useState<Note[]>(() => (userId ? getLocalNotes(userId) : []));
  const [activeFilter, setActiveFilter] = useState<NoteNavFilter>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<NoteSortOption>('updated_desc');

  // Mobile navigation & action menu states
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const [showMobileCreateMenu, setShowMobileCreateMenu] = useState(false);
  const [showMobileEditorMoreMenu, setShowMobileEditorMoreMenu] = useState(false);

  // Active note editor state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Auto-save & sync status
  const [saveStatus, setSaveStatus] = useState<
    'saved' | 'saving' | 'offline' | 'pending' | 'conflict' | 'error'
  >('saved');

  // Conflict modal state
  const [activeConflict, setActiveConflict] = useState<ConflictedNoteState | null>(null);

  // Modals for trash actions
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [noteToDeletePermanently, setNoteToDeletePermanently] = useState<Note | null>(null);

  // Debounce save timer reference
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<{ noteId: string; note: Note; baseVer: number } | null>(null);
  const isEditingRef = useRef(false);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!userId) return;

    // Initial load & automatic 30-day trash cleanup
    setNotes(getLocalNotes(userId));
    autoPurgeExpiredTrash(userId).catch(console.error);

    // Subscribe to Firestore updates
    const unsubscribe = subscribeToUserNotes(
      userId,
      (updatedNotes) => {
        setNotes(updatedNotes);
      },
      (conflict) => {
        setActiveConflict(conflict);
        setSaveStatus('conflict');
      }
    );

    // Online reconnection handler
    const handleOnline = () => {
      syncPendingNotes(userId, (conflict) => {
        setActiveConflict(conflict);
        setSaveStatus('conflict');
      });
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [userId]);

  // Flush any pending unsaved draft
  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { note, baseVer } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      try {
        const res = await saveNoteLocally(note, baseVer, (conflict) => {
          setActiveConflict(conflict);
          setSaveStatus('conflict');
        });
        if (res.syncStatus === 'conflict') {
          setSaveStatus('conflict');
        } else if (res.syncStatus === 'saved_offline') {
          setSaveStatus('offline');
        } else {
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Flush save error:', err);
        setSaveStatus('error');
      }
    }
  }, []);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        flushPendingSave();
      }
    };
  }, [flushPendingSave]);

  // Find currently selected note
  const currentNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find((n) => n.id === selectedNoteId) || null;
  }, [notes, selectedNoteId]);

  // Sync editor fields when selected note changes
  useEffect(() => {
    if (currentNote) {
      // Don't overwrite draft if user is currently typing inside this note
      if (!isEditingRef.current) {
        setDraftTitle(currentNote.title);
        setDraftContent(currentNote.content);
        setDraftChecklist(currentNote.checklistItems || []);
        setSaveStatus('saved');
      }
    } else {
      setDraftTitle('');
      setDraftContent('');
      setDraftChecklist([]);
    }
  }, [selectedNoteId, currentNote]);

  // Trigger debounced auto-save
  const scheduleAutoSave = useCallback(
    (
      newTitle: string,
      newContent: string,
      newChecklist: ChecklistItem[],
      overrides?: Partial<Note>
    ) => {
      if (!currentNote || !userId) return;

      isEditingRef.current = true;
      setSaveStatus('saving');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const updatedNote: Note = {
        ...currentNote,
        title: newTitle,
        content: newContent,
        checklistItems: newChecklist,
        updatedAt: new Date().toISOString(),
        version: (currentNote.version || 1) + 1,
        ...overrides,
      };

      // Keep latest draft queued for immediate flush on navigation
      pendingSaveRef.current = {
        noteId: currentNote.id,
        note: updatedNote,
        baseVer: currentNote.version || 1,
      };

      // Also update local list in state for fast responsive UI
      setNotes((prev) =>
        prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
      );

      debounceTimerRef.current = setTimeout(async () => {
        debounceTimerRef.current = null;
        if (!pendingSaveRef.current) return;

        const { note, baseVer } = pendingSaveRef.current;
        try {
          const res = await saveNoteLocally(note, baseVer, (conflict) => {
            setActiveConflict(conflict);
            setSaveStatus('conflict');
          });

          if (res.syncStatus === 'conflict') {
            setSaveStatus('conflict');
          } else if (res.syncStatus === 'saved_offline' || !navigator.onLine) {
            setSaveStatus('offline');
          } else {
            setSaveStatus('saved');
          }
        } catch (err) {
          console.error('Auto-save error:', err);
          setSaveStatus('error');
        } finally {
          isEditingRef.current = false;
          pendingSaveRef.current = null;
        }
      }, 650);
    },
    [currentNote, userId]
  );

  // Title change handler
  const handleTitleChange = (val: string) => {
    setDraftTitle(val);
    scheduleAutoSave(val, draftContent, draftChecklist);
  };

  // Content change handler
  const handleContentChange = (val: string) => {
    setDraftContent(val);
    scheduleAutoSave(draftTitle, val, draftChecklist);
  };

  // Checklist items handlers
  const handleToggleChecklistItem = (itemId: string) => {
    const next = draftChecklist.map((item) =>
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );
    setDraftChecklist(next);
    scheduleAutoSave(draftTitle, draftContent, next);
  };

  const handleEditChecklistItemText = (itemId: string, text: string) => {
    const next = draftChecklist.map((item) =>
      item.id === itemId ? { ...item, text } : item
    );
    setDraftChecklist(next);
    scheduleAutoSave(draftTitle, draftContent, next);
  };

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;

    const newItem: ChecklistItem = {
      id: generateChecklistItemId(),
      text: trimmed,
      isCompleted: false,
      position: draftChecklist.length,
    };
    const next = [...draftChecklist, newItem];
    setDraftChecklist(next);
    setNewChecklistText('');
    scheduleAutoSave(draftTitle, draftContent, next);
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    const next = draftChecklist
      .filter((i) => i.id !== itemId)
      .map((item, idx) => ({ ...item, position: idx }));
    setDraftChecklist(next);
    scheduleAutoSave(draftTitle, draftContent, next);
  };

  const handleMoveChecklistItem = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= draftChecklist.length) return;

    const copy = [...draftChecklist];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    const reordered = copy.map((item, i) => ({ ...item, position: i }));
    setDraftChecklist(reordered);
    scheduleAutoSave(draftTitle, draftContent, reordered);
  };

  // Note property toggles
  const handleTogglePin = async () => {
    if (!currentNote || !userId) return;
    await flushPendingSave();
    const nextPinned = !currentNote.isPinned;
    const updated: Note = {
      ...currentNote,
      isPinned: nextPinned,
      updatedAt: new Date().toISOString(),
      version: (currentNote.version || 1) + 1,
    };
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    await saveNoteLocally(updated, currentNote.version || 1);
  };

  const handleToggleFavorite = async () => {
    if (!currentNote || !userId) return;
    await flushPendingSave();
    const nextFav = !currentNote.isFavorite;
    const updated: Note = {
      ...currentNote,
      isFavorite: nextFav,
      updatedAt: new Date().toISOString(),
      version: (currentNote.version || 1) + 1,
    };
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    await saveNoteLocally(updated, currentNote.version || 1);
  };

  const handleToggleFinanceNote = async () => {
    if (!currentNote || !userId) return;
    await flushPendingSave();
    const nextFinance = !currentNote.isFinanceNote;
    const updated: Note = {
      ...currentNote,
      isFinanceNote: nextFinance,
      updatedAt: new Date().toISOString(),
      version: (currentNote.version || 1) + 1,
    };
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    await saveNoteLocally(updated, currentNote.version || 1);
  };

  // Archive / Trash / Restore actions
  const handleArchiveToggle = async () => {
    if (!currentNote || !userId) return;
    await flushPendingSave();
    const updated = await toggleArchiveNote(userId, currentNote.id);
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    }
  };

  const handleMoveToTrash = async () => {
    if (!currentNote || !userId) return;
    await flushPendingSave();
    await trashNote(userId, currentNote.id);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === currentNote.id
          ? { ...n, status: 'trashed', deletedAt: new Date().toISOString() }
          : n
      )
    );
    // On mobile, return to list
    setMobileShowEditor(false);
  };

  const handleRestoreFromTrash = async () => {
    if (!currentNote || !userId) return;
    const restored = await restoreNote(userId, currentNote.id);
    if (restored) {
      setNotes((prev) => prev.map((n) => (n.id === restored.id ? restored : n)));
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!noteToDeletePermanently || !userId) return;
    const idToDelete = noteToDeletePermanently.id;
    await permanentlyDeleteNote(userId, idToDelete);
    setNotes((prev) => prev.filter((n) => n.id !== idToDelete));
    if (selectedNoteId === idToDelete) {
      setSelectedNoteId(null);
      setMobileShowEditor(false);
    }
    setNoteToDeletePermanently(null);
  };

  const handleConfirmEmptyTrash = async () => {
    if (!userId) return;
    await emptyTrash(userId);
    setNotes((prev) => prev.filter((n) => n.status !== 'trashed'));
    setSelectedNoteId(null);
    setMobileShowEditor(false);
    setShowEmptyTrashModal(false);
  };

  // Create new note
  const handleCreateNote = async (type: NoteType = 'text') => {
    if (!userId) return;
    await flushPendingSave();

    const now = new Date().toISOString();
    const newNote: Note = {
      id: generateNoteId(),
      userId,
      title: '',
      content: '',
      type,
      checklistItems: type === 'checklist' ? [] : [],
      isPinned: activeFilter === 'pinned',
      isFavorite: activeFilter === 'favorites',
      isFinanceNote: activeFilter === 'finance',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      schemaVersion: 1,
      version: 1,
    };

    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
    setDraftTitle('');
    setDraftContent('');
    setDraftChecklist([]);
    setMobileShowEditor(true);
    setSaveStatus('saved');

    await saveNoteLocally(newNote, 0);
  };

  // Note selection switch
  const handleSelectNote = async (noteId: string) => {
    if (selectedNoteId === noteId) {
      setMobileShowEditor(true);
      return;
    }
    await flushPendingSave();
    setSelectedNoteId(noteId);
    isEditingRef.current = false;
    setMobileShowEditor(true);
  };

  // Conflict resolution
  const handleResolveConflict = async (
    resolution: 'keep_local' | 'keep_remote' | 'merge_both'
  ) => {
    if (!activeConflict || !userId) return;
    const resolved = await resolveNoteConflict(userId, resolution, activeConflict);
    setNotes((prev) => prev.map((n) => (n.id === resolved.id ? resolved : n)));
    if (selectedNoteId === resolved.id) {
      setDraftTitle(resolved.title);
      setDraftContent(resolved.content);
      setDraftChecklist(resolved.checklistItems || []);
    }
    setActiveConflict(null);
    setSaveStatus('saved');
  };

  // Compute category counts for navigation
  const counts = useMemo(() => {
    const active = notes.filter((n) => n.status === 'active');
    return {
      all: active.length,
      pinned: active.filter((n) => n.isPinned).length,
      favorites: active.filter((n) => n.isFavorite).length,
      checklists: active.filter((n) => n.type === 'checklist').length,
      finance: active.filter((n) => n.isFinanceNote).length,
      archived: notes.filter((n) => n.status === 'archived').length,
      trash: notes.filter((n) => n.status === 'trashed').length,
    };
  }, [notes]);

  // Filter and sort notes list
  const filteredNotes = useMemo(() => {
    let list = notes.filter((note) => {
      // 1. Navigation category
      if (activeFilter === 'all') {
        if (note.status !== 'active') return false;
      } else if (activeFilter === 'pinned') {
        if (note.status !== 'active' || !note.isPinned) return false;
      } else if (activeFilter === 'favorites') {
        if (note.status !== 'active' || !note.isFavorite) return false;
      } else if (activeFilter === 'checklists') {
        if (note.status !== 'active' || note.type !== 'checklist') return false;
      } else if (activeFilter === 'finance') {
        if (note.status !== 'active' || !note.isFinanceNote) return false;
      } else if (activeFilter === 'archived') {
        if (note.status !== 'archived') return false;
      } else if (activeFilter === 'trash') {
        if (note.status !== 'trashed') return false;
      }

      // 2. Search query (title, content, checklist item texts)
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const titleMatch = (note.title || '').toLowerCase().includes(q);
      const contentMatch = (note.content || '').toLowerCase().includes(q);
      const checklistMatch = (note.checklistItems || []).some((item) =>
        item.text.toLowerCase().includes(q)
      );

      return titleMatch || contentMatch || checklistMatch;
    });

    // 3. Sorting
    list = [...list].sort((a, b) => {
      // In 'all' view, pinned notes stick to top
      if (activeFilter === 'all') {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
      }

      if (sortOption === 'title_asc') {
        const titleA = a.title.trim().toLowerCase() || 'untitled';
        const titleB = b.title.trim().toLowerCase() || 'untitled';
        return titleA.localeCompare(titleB);
      } else if (sortOption === 'created_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        // updated_desc
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return list;
  }, [notes, activeFilter, searchQuery, sortOption]);

  // Format date helper
  const formatNoteDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Nav filter item list
  const navItems: Array<{
    id: NoteNavFilter;
    label: string;
    icon: React.FC<{ className?: string }>;
    count: number;
    color?: string;
  }> = [
    { id: 'all', label: 'All Notes', icon: FileText, count: counts.all },
    { id: 'pinned', label: 'Pinned', icon: Pin, count: counts.pinned, color: 'text-[#B08D57]' },
    { id: 'favorites', label: 'Favorites', icon: Star, count: counts.favorites, color: 'text-amber-500' },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare, count: counts.checklists },
    { id: 'finance', label: 'Finance Notes', icon: Coins, count: counts.finance, color: 'text-emerald-500' },
    { id: 'archived', label: 'Archived', icon: Archive, count: counts.archived },
    { id: 'trash', label: 'Trash', icon: Trash2, count: counts.trash },
  ];

  // Checklist completion calculation
  const checklistStats = useMemo(() => {
    if (!draftChecklist || draftChecklist.length === 0) return { total: 0, completed: 0, pct: 0 };
    const total = draftChecklist.length;
    const completed = draftChecklist.filter((i) => i.isCompleted).length;
    const pct = Math.round((completed / total) * 100);
    return { total, completed, pct };
  }, [draftChecklist]);

  return (
    <div
      id="notes-feature-workspace"
      className="max-w-7xl mx-auto h-[calc(100dvh-7.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col transition-colors pb-14 md:pb-0"
    >
      {/* Top Banner / Heading */}
      <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2 border-b border-[var(--border)] shrink-0">
        <div>
          <h1
            className="text-xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Notes
          </h1>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-normal mt-0.5 hidden md:block">
            Organize thoughts, budget strategies, financial calculations, and checklists.
          </p>
        </div>

        {/* Mobile Header: One small circular plus button on the right */}
        <div className="md:hidden">
          <button
            id="notes-mobile-header-add-btn"
            type="button"
            onClick={() => setShowMobileCreateMenu(true)}
            aria-label="Add note or checklist"
            title="Create note or checklist"
            className="w-8 h-8 rounded-full bg-[#B08D57] text-[#0B0B0B] flex items-center justify-center shadow-xs active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Desktop Header Actions (Preserved) */}
        <div className="hidden md:flex items-center gap-2">
          <button
            id="notes-quick-create-text-btn"
            type="button"
            onClick={() => handleCreateNote('text')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#B08D57] text-[#0B0B0B] text-xs font-bold hover:brightness-105 active:scale-95 transition-all shadow-xs"
            title="Add a new note"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Note</span>
          </button>
          <button
            id="notes-quick-create-checklist-btn"
            type="button"
            onClick={() => handleCreateNote('checklist')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] text-xs font-semibold hover:border-[#B08D57] active:scale-95 transition-all"
            title="Add a new checklist"
          >
            <Plus className="w-3.5 h-3.5 text-[#B08D57] stroke-[3]" />
            <span>Checklist</span>
          </button>
        </div>
      </div>

      {/* Mobile Create Action Menu Bottom Sheet / Modal */}
      {showMobileCreateMenu && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowMobileCreateMenu(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-3 shadow-2xl space-y-1.5 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--border)]/50">
              <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Create Note
              </span>
              <button
                type="button"
                onClick={() => setShowMobileCreateMenu(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              id="notes-mobile-create-text-choice"
              type="button"
              onClick={() => {
                setShowMobileCreateMenu(false);
                handleCreateNote('text');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-secondary)] text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[var(--text-primary)]">New Text Note</div>
                <div className="text-[11px] text-[var(--text-secondary)]">Standard notes, thoughts, and financial calculations</div>
              </div>
            </button>

            <button
              id="notes-mobile-create-checklist-choice"
              type="button"
              onClick={() => {
                setShowMobileCreateMenu(false);
                handleCreateNote('checklist');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-secondary)] text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 border border-blue-500/30 flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[var(--text-primary)]">New Checklist</div>
                <div className="text-[11px] text-[var(--text-secondary)]">To-do items with checkable boxes and progress tracking</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Column Workspace */}
      <div className="flex-1 flex overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
        {/* ========================================================= */}
        {/* PANEL 1: Left Navigation Filters (Desktop Only)            */}
        {/* ========================================================= */}
        <aside
          id="notes-left-nav-panel"
          className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3 overflow-y-auto"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-2.5 py-1.5">
            Categories
          </div>
          <div className="space-y-1 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeFilter === item.id;
              return (
                <button
                  key={item.id}
                  id={`notes-nav-filter-${item.id}`}
                  onClick={() => {
                    flushPendingSave();
                    setActiveFilter(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#B08D57]/15 text-[#B08D57] border border-[#B08D57]/30 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${item.color || (isActive ? 'text-[#B08D57]' : 'text-[var(--text-secondary)]')}`} />
                    <span>{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-[#B08D57] text-[#0B0B0B] font-bold'
                        : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Small circular icon-only Add Category button at bottom */}
          <div className="mt-auto pt-3 border-t border-[var(--border)]/40 flex items-center justify-start px-1">
            <button
              id="notes-category-add-btn"
              type="button"
              onClick={() => handleCreateNote('text')}
              title="Add category"
              aria-label="Add category"
              className="w-7 h-7 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[#B08D57] hover:border-[#B08D57] hover:bg-[#B08D57]/15 flex items-center justify-center transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* PANEL 2: Middle Panel - Note List, Search, Sort          */}
        {/* (Visible on desktop; or on mobile when NOT in editor)     */}
        {/* ========================================================= */}
        <section
          id="notes-middle-list-panel"
          className={`${
            mobileShowEditor ? 'hidden md:flex' : 'flex'
          } flex-col w-full md:w-80 lg:w-96 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-hidden`}
        >
          {/* Mobile Filter Selector: Horizontally scrollable row of compact pills */}
          <div className="md:hidden w-full overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-secondary)]/30 scrollbar-none">
            <div className="flex items-center gap-1.5 px-2.5 py-2 min-w-max">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    id={`notes-mobile-filter-${item.id}`}
                    type="button"
                    onClick={() => {
                      flushPendingSave();
                      setActiveFilter(item.id);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                      isActive
                        ? 'bg-[#B08D57] text-[#0B0B0B] font-bold shadow-xs'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${isActive ? 'text-[#0B0B0B]' : item.color || 'text-[var(--text-secondary)]'}`} />
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-[#0B0B0B]/20 text-[#0B0B0B] font-bold'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Bar & Sort Dropdown */}
          <div className="p-2.5 sm:p-3 border-b border-[var(--border)] space-y-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="notes-search-input"
                type="text"
                placeholder="Search notes, checklists, finance..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-medium border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-0.5 pt-0.5">
              <span className="font-medium">
                {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
              </span>
              <div className="flex items-center gap-1 font-medium">
                <ArrowUpDown className="w-3 h-3 text-[#B08D57]" />
                <span className="text-[10px] sm:text-xs text-[var(--text-muted)]">Sort:</span>
                <select
                  id="notes-sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as NoteSortOption)}
                  className="px-1.5 py-0.5 rounded-md text-[11px] font-semibold border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] outline-none focus:border-[#B08D57]"
                >
                  <option value="updated_desc">Recently Updated</option>
                  <option value="created_desc">Created Date</option>
                  <option value="title_asc">Title (A–Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Trash Special Action Bar */}
          {activeFilter === 'trash' && counts.trash > 0 && (
            <div className="p-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between gap-2">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                {counts.trash} item{counts.trash === 1 ? '' : 's'} in Trash
              </span>
              <button
                id="notes-empty-trash-btn"
                onClick={() => setShowEmptyTrashModal(true)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Empty Trash
              </button>
            </div>
          )}

          {/* Notes List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]/40">
            {filteredNotes.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center justify-center h-48 sm:h-64 text-[var(--text-secondary)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--surface-secondary)]/70 flex items-center justify-center mb-2 border border-[var(--border)] text-[#B08D57]">
                  <FileText className="w-4 h-4 opacity-70" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {activeFilter === 'all' && 'No notes yet'}
                  {activeFilter === 'pinned' && 'No pinned notes'}
                  {activeFilter === 'favorites' && 'No favorite notes'}
                  {activeFilter === 'checklists' && 'No checklist notes'}
                  {activeFilter === 'finance' && 'No finance notes'}
                  {activeFilter === 'archived' && 'No archived notes'}
                  {activeFilter === 'trash' && 'Trash is empty'}
                </p>
                <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5 max-w-[220px]">
                  {searchQuery
                    ? 'No notes matched your search query.'
                    : activeFilter === 'trash'
                    ? 'Deleted items remain here for 30 days.'
                    : 'Tap create note to start organizing.'}
                </p>
                {activeFilter !== 'trash' && activeFilter !== 'archived' && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleCreateNote('text')}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-[#B08D57] text-[#0B0B0B] text-xs font-bold hover:brightness-105 active:scale-95 transition-all shadow-xs"
                  >
                    Create Note
                  </button>
                )}
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = selectedNoteId === note.id;
                const isChecklist = note.type === 'checklist';
                const retention = note.status === 'trashed' ? computeRetentionStatus(note.deletedAt) : null;

                // Preview snippet: ONLY one line if content exists, never "No additional text"
                let snippet = '';
                let checklistProgress = '';
                if (isChecklist) {
                  const completed = (note.checklistItems || []).filter((i) => i.isCompleted).length;
                  const total = (note.checklistItems || []).length;
                  if (total > 0) {
                    checklistProgress = `${completed} of ${total} completed`;
                    snippet = (note.checklistItems || [])
                      .map((i) => i.text.trim())
                      .filter(Boolean)
                      .join(' • ');
                  }
                } else {
                  snippet = (note.content || '').replace(/\s+/g, ' ').trim();
                }

                return (
                  <button
                    key={note.id}
                    id={`note-list-item-${note.id}`}
                    onClick={() => handleSelectNote(note.id)}
                    className={`w-full text-left py-2.5 px-3 sm:p-3.5 transition-colors relative block ${
                      isSelected
                        ? 'bg-[#B08D57]/15 md:border-l-4 md:border-l-[#B08D57]'
                        : 'hover:bg-[var(--surface-secondary)]/50 active:bg-[var(--surface-secondary)]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {note.isPinned && (
                          <Pin className="w-3 h-3 text-[#B08D57] shrink-0 fill-current" />
                        )}
                        {note.isFavorite && (
                          <Star className="w-3 h-3 text-amber-500 shrink-0 fill-current" />
                        )}
                        <h3
                          className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate"
                          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        >
                          {note.title.trim() || 'Untitled'}
                        </h3>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                        {formatNoteDate(note.updatedAt)}
                      </span>
                    </div>

                    {/* One-line preview snippet ONLY if content exists */}
                    {snippet ? (
                      <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] truncate mt-0.5 font-normal">
                        {snippet}
                      </p>
                    ) : null}

                    {/* Micro-badge indicator line */}
                    {(note.isFinanceNote || (isChecklist && checklistProgress) || (note.status === 'trashed' && retention)) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                        {note.isFinanceNote && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Coins className="w-2.5 h-2.5" />
                            <span>Finance</span>
                          </span>
                        )}
                        {isChecklist && checklistProgress && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold font-mono">
                            <CheckSquare className="w-2.5 h-2.5" />
                            <span>{checklistProgress}</span>
                          </span>
                        )}
                        {note.status === 'trashed' && retention && (
                          <span className="px-1.5 py-0.2 rounded-md font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                            {retention.daysRemaining}d left
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* PANEL 3: Right Panel - Selected Note Editor               */}
        {/* (Dedicated full-screen on mobile; 3rd column on desktop)  */}
        {/* ========================================================= */}
        <main
          id="notes-right-editor-panel"
          className={`${
            mobileShowEditor
              ? 'fixed inset-0 z-50 flex flex-col bg-[var(--surface)]'
              : 'hidden md:flex flex-1 flex-col bg-[var(--surface)]'
          } md:static md:z-auto overflow-hidden`}
        >
          {currentNote ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Editor Top Toolbar */}
              <div className="p-2.5 sm:px-6 sm:py-3.5 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-2 shrink-0">
                {/* Left side: Back button & Save Status Indicator */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    id="notes-mobile-back-btn"
                    type="button"
                    onClick={() => {
                      flushPendingSave();
                      setMobileShowEditor(false);
                      setShowMobileEditorMoreMenu(false);
                    }}
                    className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] active:scale-95 transition-transform"
                    aria-label="Back to notes list"
                    title="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* Save/Sync Status Indicator: silent during normal operation */}
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {saveStatus === 'saving' && (
                      <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-mono text-[10px] sm:text-[11px] animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin text-[#B08D57]" />
                        <span>Saving…</span>
                      </span>
                    )}
                    {saveStatus === 'offline' && (
                      <span
                        className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20"
                        title="Offline: Changes are saved on this device and will sync when reconnected"
                      >
                        <CloudOff className="w-3 h-3" />
                        <span className="hidden sm:inline">Offline</span>
                      </span>
                    )}
                    {saveStatus === 'conflict' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeConflict) setActiveConflict(activeConflict);
                        }}
                        className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-[10px] sm:text-[11px] underline"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Resolve Conflict</span>
                      </button>
                    )}
                    {saveStatus === 'error' && (
                      <div className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-mono text-[10px] sm:text-[11px]">
                        <AlertCircle className="w-3 h-3" />
                        <span>Save failed</span>
                        <button
                          type="button"
                          onClick={() => flushPendingSave()}
                          className="underline hover:text-rose-700 font-bold ml-0.5"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Right Controls: Pin, Favorite, and More menu */}
                <div className="flex md:hidden items-center gap-1.5 relative">
                  {currentNote.status !== 'trashed' ? (
                    <>
                      <button
                        id="note-mobile-toggle-pin-btn"
                        type="button"
                        onClick={handleTogglePin}
                        title={currentNote.isPinned ? 'Unpin note' : 'Pin note'}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                          currentNote.isPinned
                            ? 'border-[#B08D57] bg-[#B08D57]/20 text-[#B08D57]'
                            : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Pin className={`w-3.5 h-3.5 ${currentNote.isPinned ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        id="note-mobile-toggle-fav-btn"
                        type="button"
                        onClick={handleToggleFavorite}
                        title={currentNote.isFavorite ? 'Remove from favorites' : 'Favorite note'}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                          currentNote.isFavorite
                            ? 'border-amber-500 bg-amber-500/20 text-amber-500'
                            : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${currentNote.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                      {computeRetentionStatus(currentNote.deletedAt).daysRemaining}d left
                    </span>
                  )}

                  {/* Mobile More Options Button */}
                  <div className="relative">
                    <button
                      id="note-mobile-more-menu-btn"
                      type="button"
                      onClick={() => setShowMobileEditorMoreMenu((prev) => !prev)}
                      className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] flex items-center justify-center active:scale-95 transition-transform"
                      aria-label="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Mobile More Options Backdrop */}
                    {showMobileEditorMoreMenu && (
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setShowMobileEditorMoreMenu(false)}
                      />
                    )}

                    {/* Mobile More Options Dropdown */}
                    {showMobileEditorMoreMenu && (
                      <div
                        className="absolute right-0 top-9 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 space-y-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {currentNote.status !== 'trashed' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMobileEditorMoreMenu(false);
                                handleToggleFinanceNote();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[var(--surface-secondary)] transition-colors text-left"
                            >
                              <Coins className={`w-3.5 h-3.5 ${currentNote.isFinanceNote ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`} />
                              <span>{currentNote.isFinanceNote ? 'Remove Finance tag' : 'Mark as Finance'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setShowMobileEditorMoreMenu(false);
                                handleArchiveToggle();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[var(--surface-secondary)] transition-colors text-left"
                            >
                              <Archive className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                              <span>{currentNote.status === 'archived' ? 'Unarchive note' : 'Archive note'}</span>
                            </button>

                            <div className="border-t border-[var(--border)]/40 my-1" />

                            <button
                              type="button"
                              onClick={() => {
                                setShowMobileEditorMoreMenu(false);
                                handleMoveToTrash();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Move to Trash</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMobileEditorMoreMenu(false);
                                handleRestoreFromTrash();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore Note</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMobileEditorMoreMenu(false);
                                setNoteToDeletePermanently(currentNote);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Forever</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop Toolbar Right Controls: Preserved exactly */}
                <div className="hidden md:flex items-center gap-1 sm:gap-2">
                  {/* Pin button */}
                  {currentNote.status !== 'trashed' && (
                    <button
                      id="note-toggle-pin-btn"
                      onClick={handleTogglePin}
                      title={currentNote.isPinned ? 'Unpin note' : 'Pin note to top'}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                        currentNote.isPinned
                          ? 'border-[#B08D57] bg-[#B08D57]/20 text-[#B08D57]'
                          : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Pin className={`w-3.5 h-3.5 ${currentNote.isPinned ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {/* Favorite button */}
                  {currentNote.status !== 'trashed' && (
                    <button
                      id="note-toggle-favorite-btn"
                      onClick={handleToggleFavorite}
                      title={currentNote.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                        currentNote.isFavorite
                          ? 'border-amber-500 bg-amber-500/20 text-amber-500'
                          : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${currentNote.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  )}

                  {/* Finance Note toggle */}
                  {currentNote.status !== 'trashed' && (
                    <button
                      id="note-toggle-finance-btn"
                      onClick={handleToggleFinanceNote}
                      title={currentNote.isFinanceNote ? 'Remove Finance tag' : 'Mark as Finance Note'}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        currentNote.isFinanceNote
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">{currentNote.isFinanceNote ? 'Finance' : 'Tag Finance'}</span>
                    </button>
                  )}

                  {/* Archive / Unarchive */}
                  {currentNote.status !== 'trashed' && (
                    <button
                      id="note-toggle-archive-btn"
                      onClick={handleArchiveToggle}
                      title={currentNote.status === 'archived' ? 'Unarchive note' : 'Archive note'}
                      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Trash / Restore / Delete forever */}
                  {currentNote.status === 'trashed' ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-xs font-semibold">
                        {computeRetentionStatus(currentNote.deletedAt).daysRemaining}{' '}
                        {computeRetentionStatus(currentNote.deletedAt).daysRemaining === 1 ? 'day' : 'days'} left
                      </span>
                      <button
                        id="note-restore-btn"
                        onClick={handleRestoreFromTrash}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        id="note-delete-forever-btn"
                        onClick={() => setNoteToDeletePermanently(currentNote)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Forever</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        id="note-editor-add-btn"
                        type="button"
                        onClick={() => handleCreateNote('text')}
                        title="Add Note (+)"
                        className="p-2 rounded-xl border border-[#B08D57]/40 bg-[#B08D57]/15 text-[#B08D57] hover:bg-[#B08D57] hover:text-[#0B0B0B] text-xs font-semibold transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <button
                        id="note-trash-btn"
                        onClick={handleMoveToTrash}
                        title="Move note to trash"
                        className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor Body Area */}
              <div className="flex-1 flex flex-col p-3.5 sm:p-6 overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {/* Note Title Input */}
                <input
                  id="note-editor-title-input"
                  type="text"
                  placeholder="Note title…"
                  disabled={currentNote.status === 'trashed'}
                  value={draftTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-lg sm:text-2xl font-bold bg-transparent border-none outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] tracking-tight pb-2 sm:pb-3 border-b border-[var(--border)]/40 mb-3 sm:mb-4 transition-colors"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                />

                {/* Normal Note Editor */}
                {currentNote.type === 'text' && (
                  <textarea
                    id="note-editor-content-textarea"
                    placeholder="Type your note content here…"
                    disabled={currentNote.status === 'trashed'}
                    value={draftContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] leading-relaxed font-normal min-h-[300px]"
                  />
                )}

                {/* Checklist Note Editor */}
                {currentNote.type === 'checklist' && (
                  <div className="flex-1 flex flex-col space-y-3 sm:space-y-4">
                    {/* Checklist Progress Indicator */}
                    {draftChecklist.length > 0 && (
                      <div className="p-2.5 sm:p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-[var(--text-secondary)]">
                          <span>Progress</span>
                          <span className="font-mono text-[var(--text-primary)]">
                            {checklistStats.completed} of {checklistStats.total} completed ({checklistStats.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 sm:h-2 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                          <div
                            className="h-full bg-[#B08D57] transition-all duration-300"
                            style={{ width: `${checklistStats.pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* New Checklist Item Input */}
                    {currentNote.status !== 'trashed' && (
                      <div className="flex items-center gap-2">
                        <input
                          id="new-checklist-item-input"
                          type="text"
                          placeholder="Add new checklist item (Press Enter)…"
                          value={newChecklistText}
                          onChange={(e) => setNewChecklistText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddChecklistItem();
                            }
                          }}
                          className="flex-1 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-medium border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-primary)] outline-none focus:border-[#B08D57] transition-all"
                        />
                        <button
                          id="add-checklist-item-btn"
                          type="button"
                          onClick={handleAddChecklistItem}
                          className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#B08D57] text-[#0B0B0B] text-xs font-bold hover:brightness-105 active:scale-95 transition-all shadow-xs"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                        </button>
                      </div>
                    )}

                    {/* Checklist Items List */}
                    <div className="space-y-1.5 flex-1">
                      {draftChecklist.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                          No checklist items yet. Add an item above to start tracking tasks.
                        </div>
                      ) : (
                        draftChecklist.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`group flex items-center gap-2.5 p-2 rounded-xl border border-[var(--border)]/70 transition-all ${
                              item.isCompleted ? 'bg-[var(--surface-secondary)]/30 opacity-70' : 'bg-[var(--surface)]'
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              type="button"
                              disabled={currentNote.status === 'trashed'}
                              onClick={() => handleToggleChecklistItem(item.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                item.isCompleted
                                  ? 'bg-[#B08D57] border-[#B08D57] text-[#0B0B0B]'
                                  : 'border-[var(--border)] hover:border-[#B08D57] bg-[var(--surface)]'
                              }`}
                            >
                              {item.isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>

                            {/* Item Text Editable Input */}
                            <input
                              type="text"
                              disabled={currentNote.status === 'trashed'}
                              value={item.text}
                              onChange={(e) => handleEditChecklistItemText(item.id, e.target.value)}
                              className={`flex-1 bg-transparent border-none outline-none text-xs font-medium text-[var(--text-primary)] ${
                                item.isCompleted ? 'line-through text-[var(--text-secondary)]' : ''
                              }`}
                            />

                            {/* Reorder and Delete controls */}
                            {currentNote.status !== 'trashed' && (
                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveChecklistItem(idx, 'up')}
                                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"
                                  title="Move item up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === draftChecklist.length - 1}
                                  onClick={() => handleMoveChecklistItem(idx, 'down')}
                                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"
                                  title="Move item down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChecklistItem(item.id)}
                                  className="p-1 text-rose-500 hover:text-rose-700"
                                  title="Delete item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Simplified Empty State in Right Panel
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-secondary)] select-none">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)]/60 flex items-center justify-center mb-2.5 border border-[var(--border)]">
                <FileText className="w-5 h-5 text-[#B08D57]" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Select a note to view or edit
              </p>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CONFLICT RESOLUTION MODAL                        */}
      {/* ========================================================= */}
      {activeConflict && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3
                  className="text-lg font-bold text-[var(--text-primary)]"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Sync Conflict Detected
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  This note was modified on another device or session while you were editing. Choose how you would like to reconcile the differences. No content will be silently lost.
                </p>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Local Device Version */}
              <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                  <span>Your Device Version</span>
                  <span className="font-mono text-[10px]">v{activeConflict.localNote.version}</span>
                </div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {activeConflict.localNote.title || '(Untitled)'}
                </p>
                <div className="text-[11px] text-[var(--text-secondary)] max-h-36 overflow-y-auto whitespace-pre-wrap font-mono p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  {activeConflict.localNote.type === 'text'
                    ? activeConflict.localNote.content || '(Empty)'
                    : activeConflict.localNote.checklistItems?.map((i) => `• [${i.isCompleted ? 'x' : ' '}] ${i.text}`).join('\n') || '(Empty)'}
                </div>
              </div>

              {/* Server / Cloud Version */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>Cloud Version</span>
                  <span className="font-mono text-[10px]">v{activeConflict.serverNote.version}</span>
                </div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {activeConflict.serverNote.title || '(Untitled)'}
                </p>
                <div className="text-[11px] text-[var(--text-secondary)] max-h-36 overflow-y-auto whitespace-pre-wrap font-mono p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  {activeConflict.serverNote.type === 'text'
                    ? activeConflict.serverNote.content || '(Empty)'
                    : activeConflict.serverNote.checklistItems?.map((i) => `• [${i.isCompleted ? 'x' : ' '}] ${i.text}`).join('\n') || '(Empty)'}
                </div>
              </div>
            </div>

            {/* Reconciliation Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => handleResolveConflict('keep_remote')}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--surface-secondary)] transition-all"
              >
                Use Cloud Version
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('keep_local')}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all"
              >
                Keep Device Version
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('merge_both')}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#B08D57] text-[#0B0B0B] text-xs font-bold hover:brightness-105 transition-all shadow-xs"
              >
                Merge Both Versions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CONFIRM PERMANENT DELETE MODAL                   */}
      {/* ========================================================= */}
      {noteToDeletePermanently && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Permanently Delete Note?
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-[var(--text-primary)]">
                "{noteToDeletePermanently.title.trim() || 'Untitled Note'}"
              </strong>
              ? This action cannot be undone and will remove it from both this device and the cloud.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDeletePermanently(null)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-forever-btn"
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRM EMPTY TRASH MODAL                        */}
      {/* ========================================================= */}
      {showEmptyTrashModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Empty Trash?
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This will permanently delete all <strong className="text-[var(--text-primary)]">{counts.trash}</strong> trashed note{counts.trash === 1 ? '' : 's'}. You will not be able to recover them.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyTrashModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-empty-trash-btn"
                onClick={handleConfirmEmptyTrash}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
              >
                Empty Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
