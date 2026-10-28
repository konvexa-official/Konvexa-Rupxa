/**
 * Konvexa Rupxa Database Service Layer
 * Powered by Google Cloud Firestore with real-time listeners and multi-member splits,
 * with resilient persistent offline storage and BroadcastChannel realtime synchronization.
 */

import { isFirebaseConfigured } from './firebase';
import {
  fsGetProfile,
  fsCreateOrUpdateProfile,
  fsSearchUserByContact,
  fsGetExpenses,
  fsCreateExpense,
  fsUpdateExpense,
  fsDeleteExpense,
  fsGetMySplitGroups,
  fsGetSplitGroupDetails,
  fsCreateSplitGroup,
  fsSubscribeToGroupUpdates,
  fsGetBudgets,
  fsSetAllBudgets,
  fsAddGroupExpense,
  fsUpdateGroupExpense,
  fsUpdateSplitGroup,
  fsUpdateMemberAmount,
  fsDeleteGroupExpense,
  fsDeleteSplitGroup,
  fsRecordSettlement,
} from './firestoreDb';
import {
  Profile,
  Expense,
  SplitGroup,
  SplitMember,
  SplitActivity,
  PublicUserSearchResult,
  SplitGroupSummary,
  GroupExpense,
  SplitSettlement,
} from '../types';
import { maskEmail, maskPhone, normalizePhoneNumber, parseMoney } from './formatters';

// Storage keys for persistent local storage engine
const STORAGE_KEYS = {
  PROFILES: 'rupxa_profiles_v1',
  EXPENSES: 'rupxa_expenses_v1',
  SPLIT_GROUPS: 'rupxa_split_groups_v1',
  SPLIT_MEMBERS: 'rupxa_split_members_v1',
  SPLIT_ACTIVITY: 'rupxa_split_activity_v1',
  SPLIT_GROUP_EXPENSES: 'rupxa_split_group_expenses_v1',
  SPLIT_SETTLEMENTS: 'rupxa_split_settlements_v1',
  BUDGETS: 'rupxa_budgets_v1',
};

// Helper for local storage read/write
function readLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.error(`Failed to read from localStorage [${key}]:`, err);
    return defaultValue;
  }
}

function writeLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error(`Failed to write to localStorage [${key}]:`, err);
  }
}

// Broadcast channel for instantaneous cross-tab/cross-window local realtime sync
const localRealtimeChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('rupxa_splitter_realtime')
  : null;

function emitLocalRealtime(groupId: string, eventType: string, payload?: unknown) {
  if (localRealtimeChannel) {
    localRealtimeChannel.postMessage({ groupId, eventType, payload, timestamp: Date.now() });
  }
}

// ==========================================
// 1. PROFILES & USER SEARCH
// ==========================================

export async function getProfile(userId: string): Promise<Profile | null> {
  if (isFirebaseConfigured()) {
    try {
      const fsProf = await fsGetProfile(userId);
      if (fsProf) return fsProf;
    } catch (e) {
      console.warn('Firestore getProfile notice:', e);
    }
  }

  // Local storage mode
  const profiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  return profiles.find((p) => p.id === userId) || null;
}

export async function createOrUpdateProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const now = new Date().toISOString();
  const normalizedPhone = profile.phone ? normalizePhoneNumber(profile.phone) : '';

  if (isFirebaseConfigured()) {
    try {
      const fsProf = await fsCreateOrUpdateProfile(profile);
      if (fsProf) return fsProf;
    } catch (e) {
      console.warn('Firestore createOrUpdateProfile notice:', e);
    }
  }

  // Local storage mode
  const profiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  const existingIndex = profiles.findIndex((p) => p.id === profile.id);

  let updatedProfile: Profile;
  if (existingIndex >= 0) {
    updatedProfile = {
      ...profiles[existingIndex],
      ...profile,
      phone: normalizedPhone || profiles[existingIndex].phone,
      updated_at: now,
    };
    profiles[existingIndex] = updatedProfile;
  } else {
    updatedProfile = {
      id: profile.id,
      full_name: profile.full_name || 'Rupxa User',
      email: profile.email || '',
      phone: normalizedPhone,
      avatar_url: profile.avatar_url || null,
      created_at: now,
      updated_at: now,
    };
    profiles.push(updatedProfile);
  }

  writeLocal(STORAGE_KEYS.PROFILES, profiles);
  return updatedProfile;
}

export async function searchUsersByContact(
  query: string,
  currentUserId: string
): Promise<PublicUserSearchResult[]> {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  if (isFirebaseConfigured()) {
    try {
      const res = await fsSearchUserByContact(clean, currentUserId);
      if (res) return [res];
    } catch (e) {
      console.warn('Firestore searchUsersByContact notice:', e);
    }
  }

  // Local storage mode
  const profiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  const results: PublicUserSearchResult[] = [];

  for (const p of profiles) {
    if (p.id === currentUserId) continue;

    const matchesEmail = p.email && p.email.toLowerCase().includes(clean);
    const matchesPhone = p.phone && p.phone.includes(clean);
    const matchesName = p.full_name && p.full_name.toLowerCase().includes(clean);

    if (matchesEmail || matchesPhone || matchesName) {
      results.push({
        id: p.id,
        full_name: p.full_name,
        masked_identifier: matchesEmail ? maskEmail(p.email) : maskPhone(p.phone),
        avatar_url: p.avatar_url || null,
      });
    }
  }

  return results.slice(0, 10);
}

export async function searchUserByContact(
  query: string,
  excludeUserId?: string
): Promise<PublicUserSearchResult | null> {
  if (isFirebaseConfigured()) {
    try {
      const res = await fsSearchUserByContact(query, excludeUserId);
      if (res) return res;
    } catch (e) {
      console.warn('Firestore searchUserByContact notice:', e);
    }
  }

  const list = await searchUsersByContact(query, excludeUserId || '');
  return list.length > 0 ? list[0] : null;
}

// ==========================================
// 2. PERSONAL EXPENSES
// ==========================================

export async function getExpenses(userId: string): Promise<Expense[]> {
  if (isFirebaseConfigured()) {
    try {
      return await fsGetExpenses(userId);
    } catch (e) {
      console.warn('Firestore getExpenses notice:', e);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  return allExpenses
    .filter((e) => e.user_id === userId)
    .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
}

export async function createExpense(
  expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
): Promise<Expense> {
  const now = new Date().toISOString();
  const safeAmount = parseMoney(expense.amount);
  const cleanCustomCategory =
    expense.category === 'Other' && expense.custom_category
      ? expense.custom_category.trim()
      : null;

  if (isFirebaseConfigured()) {
    try {
      return await fsCreateExpense({
        ...expense,
        amount: safeAmount,
        custom_category: cleanCustomCategory,
      });
    } catch (e) {
      console.warn('Firestore createExpense notice:', e);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const newExpense: Expense = {
    ...expense,
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    amount: safeAmount,
    custom_category: cleanCustomCategory,
    created_at: now,
    updated_at: now,
  };

  allExpenses.unshift(newExpense);
  writeLocal(STORAGE_KEYS.EXPENSES, allExpenses);
  return newExpense;
}

export async function updateExpense(
  id: string,
  arg2: string | Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>,
  arg3?: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>
): Promise<Expense> {
  const now = new Date().toISOString();
  const userId = typeof arg2 === 'string' ? arg2 : '';
  const rawUpdates = typeof arg2 === 'string' ? (arg3 || {}) : arg2;
  const safeUpdates = {
    ...rawUpdates,
    ...(rawUpdates.amount !== undefined ? { amount: parseMoney(rawUpdates.amount) } : {}),
    ...(rawUpdates.category !== undefined
      ? {
          category: rawUpdates.category,
          custom_category:
            rawUpdates.category === 'Other' && rawUpdates.custom_category
              ? rawUpdates.custom_category.trim()
              : null,
        }
      : rawUpdates.custom_category !== undefined
      ? { custom_category: rawUpdates.custom_category ? rawUpdates.custom_category.trim() : null }
      : {}),
  };

  if (isFirebaseConfigured()) {
    try {
      return await fsUpdateExpense(id, userId, safeUpdates);
    } catch (e) {
      console.warn('Firestore updateExpense notice:', e);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const index = allExpenses.findIndex((e) => e.id === id);
  if (index === -1) throw new Error('Expense not found.');

  const updated: Expense = {
    ...allExpenses[index],
    ...safeUpdates,
    updated_at: now,
  };

  allExpenses[index] = updated;
  writeLocal(STORAGE_KEYS.EXPENSES, allExpenses);
  return updated;
}

export async function deleteExpense(id: string, _userId?: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await fsDeleteExpense(id);
      return;
    } catch (e) {
      console.warn('Firestore deleteExpense notice:', e);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const filtered = allExpenses.filter((e) => e.id !== id);
  writeLocal(STORAGE_KEYS.EXPENSES, filtered);
}

// ==========================================
// 3. SPLIT GROUPS & MULTI-USER SPLITTER
// ==========================================

export async function getMySplitGroups(userId: string): Promise<SplitGroupSummary[]> {
  if (isFirebaseConfigured()) {
    try {
      return await fsGetMySplitGroups(userId);
    } catch (e) {
      console.warn('Firestore getMySplitGroups notice:', e);
    }
  }

  // Local storage mode
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allGroupExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);

  const myMemberships = allMembers.filter((m) => m.user_id === userId);
  const myGroupIds = new Set(myMemberships.map((m) => m.split_group_id));

  const summaries: SplitGroupSummary[] = [];

  for (const group of allGroups) {
    if (group.status === 'deleted' || Boolean((group as any).deleted_at)) continue;
    if (!myGroupIds.has(group.id) && group.created_by !== userId) continue;

    const myMembership = myMemberships.find((m) => m.split_group_id === group.id);
    const memberCount = allMembers.filter((m) => m.split_group_id === group.id).length;

    // Recalculate dynamic totals from active expenses
    const activeExpenses = allGroupExpenses.filter((e) => e.split_group_id === group.id && !e.deleted_at);
    const calculatedTotal = activeExpenses.length > 0
      ? parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0))
      : parseMoney(group.total_amount);

    const calculatedUserAmount = activeExpenses.length > 0
      ? parseMoney(
          activeExpenses.reduce((sum, e) => {
            const sh = e.shares?.find((s) => s.user_id === userId);
            return sum + (sh ? parseMoney(sh.amount) : 0);
          }, 0)
        )
      : myMembership
      ? parseMoney(myMembership.amount)
      : 0;

    const isOwner = group.created_by === userId;

    summaries.push({
      ...group,
      status: group.status || 'active',
      total_amount: calculatedTotal,
      user_amount: calculatedUserAmount,
      member_count: Math.max(memberCount, 1),
      user_role: isOwner ? 'owner' : 'member',
    });
  }

  return summaries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
  if (isFirebaseConfigured()) {
    try {
      const details = await fsGetSplitGroupDetails(groupId, '');
      if (details) return details.expenses;
    } catch (err) {
      console.warn('Firestore getGroupExpenses notice:', err);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  return allExpenses
    .filter((e) => e.split_group_id === groupId && !e.deleted_at)
    .map((e) => ({
      ...e,
      paid_by_profile: allProfiles.find((p) => p.id === e.paid_by_user_id),
      shares: (e.shares || []).map((s) => ({
        ...s,
        profile: allProfiles.find((p) => p.id === s.user_id),
      })),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addGroupExpense(params: {
  groupId: string;
  name?: string;
  reference?: string | null;
  amount: number;
  category: string;
  paidByUserId: string;
  splitType: 'equal' | 'custom';
  shares: Array<{ userId: string; amount: number; profile?: Profile }>;
  actorId?: string;
  actorProfile: Profile;
  notes?: string;
}): Promise<GroupExpense> {
  const now = new Date().toISOString();
  const safeTotal = parseMoney(params.amount);
  const cleanRef = params.reference?.trim() ? params.reference.trim() : null;
  const cleanName = params.name?.trim() ? params.name.trim() : (cleanRef || `${params.category} Expense`);

  if (isFirebaseConfigured()) {
    try {
      const newExp = await fsAddGroupExpense(params);
      const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
      allExpenses.unshift(newExp);
      writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);
      emitLocalRealtime(params.groupId, 'expense_added', { expense: newExp });
      return newExp;
    } catch (err) {
      console.warn('Firestore addGroupExpense error, falling back to local storage:', err);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const expId = `gexp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newExp: GroupExpense = {
    id: expId,
    split_group_id: params.groupId,
    name: cleanName,
    reference: cleanRef,
    amount: safeTotal,
    category: params.category,
    paid_by_user_id: params.paidByUserId,
    paid_by_profile: params.actorProfile,
    split_type: params.splitType,
    shares: params.shares.map((s) => ({
      user_id: s.userId,
      amount: parseMoney(s.amount),
      profile: s.profile,
    })),
    created_by: params.actorProfile.id,
    created_at: now,
    updated_at: now,
  };

  allExpenses.unshift(newExp);
  writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);

  // Recalculate group total
  const activeExpenses = allExpenses.filter((e) => e.split_group_id === params.groupId && !e.deleted_at);
  const newGroupTotal = parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0));

  const grpIdx = allGroups.findIndex((g) => g.id === params.groupId);
  if (grpIdx >= 0) {
    allGroups[grpIdx].total_amount = newGroupTotal;
    allGroups[grpIdx].updated_at = now;
    writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);
  }

  // Recalculate member shares
  allMembers.forEach((m) => {
    if (m.split_group_id === params.groupId) {
      const memberTotal = parseMoney(
        activeExpenses.reduce((sum, e) => {
          const s = e.shares?.find((sh) => sh.user_id === m.user_id);
          return sum + (s ? parseMoney(s.amount) : 0);
        }, 0)
      );
      m.amount = memberTotal;
      m.updated_at = now;
    }
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  // Log activity
  const actDesc = cleanRef
    ? `${params.actorProfile.full_name} added expense "${cleanRef}" (₹${safeTotal.toLocaleString('en-IN')})`
    : `${params.actorProfile.full_name} added expense (₹${safeTotal.toLocaleString('en-IN')})`;

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorProfile.id,
    action_type: 'add_expense',
    old_value: null,
    new_value: safeTotal.toString(),
    description: actDesc,
    created_at: now,
    actor: params.actorProfile,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'expense_added', { expense: newExp, activity: act });
  return newExp;
}

export async function updateGroupExpense(params: {
  expenseId: string;
  groupId: string;
  name?: string;
  reference?: string | null;
  amount: number;
  category: string;
  paidByUserId: string;
  splitType: 'equal' | 'custom';
  shares: Array<{ userId: string; amount: number; profile?: Profile }>;
  actorId?: string;
  actorProfile: Profile;
  notes?: string;
}): Promise<GroupExpense> {
  const now = new Date().toISOString();
  const safeTotal = parseMoney(params.amount);

  if (isFirebaseConfigured()) {
    try {
      const updatedExp = await fsUpdateGroupExpense(params);
      const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
      const expIdx = allExpenses.findIndex((e) => e.id === params.expenseId);
      if (expIdx !== -1) {
        allExpenses[expIdx] = updatedExp;
        writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);
      }
      emitLocalRealtime(params.groupId, 'expense_updated', { expense: updatedExp });
      return updatedExp;
    } catch (err) {
      console.warn('Firestore updateGroupExpense error, falling back to local storage:', err);
    }
  }

  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const expIdx = allExpenses.findIndex((e) => e.id === params.expenseId);
  if (expIdx === -1) throw new Error('Expense not found.');

  const oldExp = allExpenses[expIdx];
  const oldAmount = oldExp.amount;
  const cleanRef = params.reference !== undefined
    ? (params.reference?.trim() ? params.reference.trim() : null)
    : (oldExp.reference || null);
  const oldRef = oldExp.reference || null;
  const newRef = cleanRef;
  const cleanName = params.name?.trim()
    ? params.name.trim()
    : (cleanRef || oldExp.name || `${params.category} Expense`);
  const isReferenceChanged = (oldExp.reference || '').trim() !== (cleanRef || '').trim();

  const updatedExp: GroupExpense = {
    ...oldExp,
    name: cleanName,
    reference: cleanRef,
    amount: safeTotal,
    category: params.category,
    paid_by_user_id: params.paidByUserId,
    paid_by_profile: params.actorProfile,
    split_type: params.splitType,
    shares: params.shares.map((s) => ({
      user_id: s.userId,
      amount: parseMoney(s.amount),
      profile: s.profile,
    })),
    updated_at: now,
  };

  allExpenses[expIdx] = updatedExp;
  writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);

  // Recalculate group total
  const activeExpenses = allExpenses.filter((e) => e.split_group_id === params.groupId && !e.deleted_at);
  const newGroupTotal = parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0));

  const grpIdx = allGroups.findIndex((g) => g.id === params.groupId);
  if (grpIdx >= 0) {
    allGroups[grpIdx].total_amount = newGroupTotal;
    allGroups[grpIdx].updated_at = now;
    writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);
  }

  // Recalculate member shares
  allMembers.forEach((m) => {
    if (m.split_group_id === params.groupId) {
      const memberTotal = parseMoney(
        activeExpenses.reduce((sum, e) => {
          const s = e.shares?.find((sh) => sh.user_id === m.user_id);
          return sum + (s ? parseMoney(s.amount) : 0);
        }, 0)
      );
      m.amount = memberTotal;
      m.updated_at = now;
    }
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  // Log activity
  // If reference was edited, record who changed it, previous reference, new reference, and date/time
  const act: SplitActivity = isReferenceChanged
    ? {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        split_group_id: params.groupId,
        actor_user_id: params.actorProfile.id,
        action_type: 'edit_expense_reference',
        old_value: oldRef,
        new_value: newRef,
        description: `${params.actorProfile.full_name} changed reference`,
        created_at: now,
        actor: params.actorProfile,
      }
    : {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        split_group_id: params.groupId,
        actor_user_id: params.actorProfile.id,
        action_type: 'edit_expense',
        old_value: oldAmount.toString(),
        new_value: safeTotal.toString(),
        description: `${params.actorProfile.full_name} updated expense ${newRef ? `"${newRef}"` : ''}`,
        created_at: now,
        actor: params.actorProfile,
      };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'expense_updated', { expense: updatedExp, activity: act });
  return updatedExp;
}

export async function deleteGroupExpense(params: {
  expenseId: string;
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  reason: string;
  note?: string;
}): Promise<void> {
  const now = new Date().toISOString();

  if (isFirebaseConfigured()) {
    try {
      await fsDeleteGroupExpense(params);
      return;
    } catch (e) {
      console.warn('Firestore fsDeleteGroupExpense notice:', e);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const expIdx = allExpenses.findIndex((e) => e.id === params.expenseId);
  if (expIdx === -1) throw new Error('Expense not found.');

  const exp = allExpenses[expIdx];
  const grp = allGroups.find((g) => g.id === params.groupId);

  // Permission enforcement
  const isOwner = Boolean(grp && grp.created_by === params.actorId);
  const isPayerOrCreator = exp.paid_by_user_id === params.actorId || exp.created_by === params.actorId;

  if (!isOwner && !isPayerOrCreator) {
    throw new Error('Permission denied: You can only delete expenses that you paid for or added, unless you are the group owner.');
  }

  const oldName = exp.name;
  const oldAmount = parseMoney(exp.amount);

  // Soft delete: mark with deletion metadata
  allExpenses[expIdx] = {
    ...exp,
    deleted_at: now,
    deleted_by: params.actorId,
    deletion_reason: params.reason,
    deletion_note: params.note?.trim() || null,
    updated_at: now,
  };
  writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);

  // Recalculate group total using only non-deleted active expenses
  const activeGroupExpenses = allExpenses.filter(
    (e) => e.split_group_id === params.groupId && !e.deleted_at
  );
  const newGroupTotal = parseMoney(activeGroupExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0));

  const grpIdx = allGroups.findIndex((g) => g.id === params.groupId);
  if (grpIdx >= 0) {
    allGroups[grpIdx].total_amount = newGroupTotal;
    allGroups[grpIdx].updated_at = now;
    writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);
  }

  // Recalculate member shares
  allMembers.forEach((m) => {
    if (m.split_group_id === params.groupId) {
      const memberTotal = parseMoney(
        activeGroupExpenses.reduce((sum, e) => {
          const s = e.shares?.find((sh) => sh.user_id === m.user_id);
          return sum + (s ? parseMoney(s.amount) : 0);
        }, 0)
      );
      m.amount = memberTotal;
      m.updated_at = now;
    }
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  // Create immutable activity audit record
  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'EXPENSE_DELETED',
    old_value: oldAmount.toString(),
    new_value: null,
    description: 'Expense deleted',
    created_at: now,
    actor: params.actorProfile,
    expense_id: params.expenseId,
    expense_name: oldName,
    old_amount: oldAmount,
    old_category: exp.category,
    old_paid_by: exp.paid_by_user_id,
    deletion_reason: params.reason,
    deletion_note: params.note?.trim() || null,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'expense_deleted', { expenseId: params.expenseId, activity: act });
}

export async function getSplitGroupDetails(
  groupId: string,
  currentUserId: string
): Promise<{
  group: SplitGroup;
  members: SplitMember[];
  activity: SplitActivity[];
  expenses: GroupExpense[];
  settlements: SplitSettlement[];
  isDeleted?: boolean;
} | null> {
  const cleanId = decodeURIComponent((groupId || '').trim());
  if (!cleanId) return null;

  if (isFirebaseConfigured()) {
    try {
      const fsDetails = await fsGetSplitGroupDetails(cleanId, currentUserId);
      if (fsDetails) return fsDetails;
    } catch (e) {
      console.warn('Firestore getSplitGroupDetails notice:', e);
    }
  }

  // Local storage mode & fallback
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  const allGroupExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allSettlements = readLocal<SplitSettlement[]>(STORAGE_KEYS.SPLIT_SETTLEMENTS, []);

  const group = allGroups.find(
    (g) => g.id === cleanId || g.id.toLowerCase() === cleanId.toLowerCase()
  );
  if (!group) return null;

  if (group.status === 'deleted' || Boolean((group as any).deleted_at)) {
    return {
      group: { ...group, status: 'deleted' },
      members: [],
      activity: [],
      expenses: [],
      settlements: [],
      isDeleted: true,
    };
  }

  const members = allMembers
    .filter((m) => m.split_group_id === group.id || m.split_group_id === cleanId)
    .map((m) => ({
      ...m,
      amount: parseMoney(m.amount),
      profile: allProfiles.find((p) => p.id === m.user_id) || m.profile,
    }));

  const activity = allActivity
    .filter((a) => a.split_group_id === group.id || a.split_group_id === cleanId)
    .map((a) => ({
      ...a,
      actor: allProfiles.find((p) => p.id === a.actor_user_id) || a.actor,
      target: a.target_user_id
        ? (allProfiles.find((p) => p.id === a.target_user_id) || a.target)
        : undefined,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const expenses = allGroupExpenses
    .filter((e) => e.split_group_id === groupId && !e.deleted_at)
    .map((e) => ({
      ...e,
      amount: parseMoney(e.amount),
      paid_by_profile: allProfiles.find((p) => p.id === e.paid_by_user_id) || e.paid_by_profile,
      shares: (e.shares || []).map((s) => ({
        ...s,
        amount: parseMoney(s.amount),
        profile: allProfiles.find((p) => p.id === s.user_id) || s.profile,
      })),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const settlements = allSettlements
    .filter((s) => s.split_group_id === groupId)
    .map((s) => ({
      ...s,
      amount: parseMoney(s.amount),
      from_profile: allProfiles.find((p) => p.id === s.from_user_id) || s.from_profile,
      to_profile: allProfiles.find((p) => p.id === s.to_user_id) || s.to_profile,
    }))
    .sort((a, b) => new Date(b.settled_at).getTime() - new Date(a.settled_at).getTime());

  const calculatedTotal = expenses.length > 0
    ? parseMoney(expenses.reduce((sum, e) => sum + parseMoney(e.amount), 0))
    : parseMoney(group.total_amount);

  return {
    group: {
      ...group,
      status: group.status || 'active',
      total_amount: calculatedTotal,
    },
    members,
    activity,
    expenses,
    settlements,
  };
}

export async function recordSettlement(params: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  paymentMethod: 'UPI' | 'Cash' | 'Bank' | 'Other';
  upiRefId?: string;
  note?: string;
  actorProfile: Profile;
}): Promise<SplitSettlement> {
  const now = new Date().toISOString();
  const safeAmount = parseMoney(params.amount);

  if (isFirebaseConfigured()) {
    try {
      await fsRecordSettlement(params);
    } catch (e) {
      console.warn('Firestore fsRecordSettlement notice:', e);
    }
  }

  const allSettlements = readLocal<SplitSettlement[]>(STORAGE_KEYS.SPLIT_SETTLEMENTS, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const newSettlement: SplitSettlement = {
    id: `stl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    from_user_id: params.fromUserId,
    to_user_id: params.toUserId,
    amount: safeAmount,
    payment_method: params.paymentMethod,
    upi_ref_id: params.upiRefId || '',
    note: params.note || '',
    settled_at: now,
    from_profile: params.actorProfile,
    to_profile: allProfiles.find((p) => p.id === params.toUserId),
  };

  allSettlements.unshift(newSettlement);
  writeLocal(STORAGE_KEYS.SPLIT_SETTLEMENTS, allSettlements);

  // Activity log
  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.fromUserId,
    action_type: 'settle_debt',
    target_user_id: params.toUserId,
    old_value: null,
    new_value: safeAmount.toString(),
    description: `Settled ₹${safeAmount} via ${params.paymentMethod}${params.upiRefId ? ` (Ref: ${params.upiRefId})` : ''}`,
    created_at: now,
    actor: params.actorProfile,
    target: allProfiles.find((p) => p.id === params.toUserId),
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'settlement_added', { settlement: newSettlement });
  return newSettlement;
}

export async function createSplitGroup(params: {
  name: string;
  reference?: string | null;
  totalAmount: number;
  currency: string;
  creatorId: string;
  creatorProfile: Profile;
  splitType?: 'equal' | 'custom';
  members: Array<{ userId: string; amount: number; profile?: Profile }>;
}): Promise<SplitGroup> {
  const now = new Date().toISOString();
  const safeTotal = parseMoney(params.totalAmount);
  const cleanName = params.name.trim();
  const cleanRef = params.reference?.trim() ? params.reference.trim() : null;

  const memberList = [...params.members];
  if (!memberList.some((m) => m.userId === params.creatorId)) {
    memberList.unshift({
      userId: params.creatorId,
      amount: safeTotal,
      profile: params.creatorProfile,
    });
  }

  // If equal split and safeTotal > 0, rebalance shares equally so each member has the exact share
  if ((!params.splitType || params.splitType === 'equal') && safeTotal > 0 && memberList.length > 0) {
    const perPerson = Math.floor((safeTotal / memberList.length) * 100) / 100;
    const remainder = parseMoney(safeTotal - perPerson * memberList.length);
    memberList.forEach((m, idx) => {
      m.amount = idx === 0 ? parseMoney(perPerson + remainder) : perPerson;
    });
  }

  // Ensure member profiles are cached in local profiles
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  let profilesChanged = false;
  memberList.forEach((m) => {
    if (m.profile && !allProfiles.some((p) => p.id === m.userId)) {
      allProfiles.push(m.profile);
      profilesChanged = true;
    }
  });
  if (profilesChanged) {
    writeLocal(STORAGE_KEYS.PROFILES, allProfiles);
  }

  if (isFirebaseConfigured()) {
    try {
      const newGroup = await fsCreateSplitGroup({
        name: cleanName,
        reference: cleanRef,
        totalAmount: safeTotal,
        currency: params.currency || 'INR',
        creatorId: params.creatorId,
        creatorProfile: params.creatorProfile,
        splitType: params.splitType || 'equal',
        members: memberList,
      });

      // Mirror to local cache for instant viewing
      const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
      allGroups.unshift(newGroup);
      writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);

      const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
      memberList.forEach((m) => {
        allMembers.push({
          id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          split_group_id: newGroup.id,
          user_id: m.userId,
          amount: parseMoney(m.amount),
          joined_at: now,
          updated_at: now,
          profile: m.profile,
        });
      });
      writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

      if (safeTotal > 0) {
        const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
        allExpenses.unshift({
          id: `gexp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          split_group_id: newGroup.id,
          name: cleanName,
          reference: cleanRef,
          amount: safeTotal,
          category: 'Other',
          paid_by_user_id: params.creatorId,
          paid_by_profile: params.creatorProfile,
          split_type: params.splitType || 'equal',
          shares: memberList.map((m) => ({
            user_id: m.userId,
            amount: parseMoney(m.amount),
            profile: m.profile,
          })),
          created_by: params.creatorId,
          created_at: now,
          updated_at: now,
        });
        writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);
      }

      emitLocalRealtime(newGroup.id, 'group_created', { group: newGroup });
      return newGroup;
    } catch (e) {
      console.warn('Firestore createSplitGroup notice:', e);
    }
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newGroup: SplitGroup = {
    id: groupId,
    name: cleanName,
    reference: cleanRef,
    total_amount: safeTotal,
    currency: params.currency || 'INR',
    status: 'active',
    created_by: params.creatorId,
    created_at: now,
    updated_at: now,
  };

  allGroups.unshift(newGroup);
  writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);

  memberList.forEach((m) => {
    allMembers.push({
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      split_group_id: groupId,
      user_id: m.userId,
      amount: parseMoney(m.amount),
      joined_at: now,
      updated_at: now,
      profile: m.profile,
    });
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  if (safeTotal > 0) {
    const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
    allExpenses.unshift({
      id: `gexp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      split_group_id: groupId,
      name: cleanName,
      reference: cleanRef,
      amount: safeTotal,
      category: 'Other',
      paid_by_user_id: params.creatorId,
      paid_by_profile: params.creatorProfile,
      split_type: params.splitType || 'equal',
      shares: memberList.map((m) => ({
        user_id: m.userId,
        amount: parseMoney(m.amount),
        profile: m.profile,
      })),
      created_by: params.creatorId,
      created_at: now,
      updated_at: now,
    });
    writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);
  }

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: groupId,
    actor_user_id: params.creatorId,
    action_type: 'create_group',
    old_value: null,
    new_value: safeTotal.toString(),
    description: `${params.creatorProfile.full_name} created "${cleanName}" Total ₹${safeTotal.toLocaleString('en-IN')}`,
    created_at: now,
    actor: params.creatorProfile,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(groupId, 'group_created', { group: newGroup });
  return newGroup;
}

export async function updateSplitGroup(params: {
  groupId: string;
  name?: string;
  reference?: string | null;
  totalAmount?: number;
  actorId: string;
  actorProfile: Profile;
}): Promise<SplitGroup> {
  const now = new Date().toISOString();

  if (isFirebaseConfigured()) {
    try {
      const updated = await fsUpdateSplitGroup(params);
      const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
      const index = allGroups.findIndex((g) => g.id === params.groupId);
      if (index !== -1) {
        allGroups[index] = updated;
        writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);
      }
      emitLocalRealtime(params.groupId, 'group_updated', { group: updated });
      return updated;
    } catch (e) {
      console.warn('Firestore updateSplitGroup notice:', e);
    }
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const index = allGroups.findIndex((g) => g.id === params.groupId);
  if (index === -1) throw new Error('Split group not found.');

  const grp = allGroups[index];
  const oldTotal = grp.total_amount;
  const newTotal = params.totalAmount !== undefined ? parseMoney(params.totalAmount) : grp.total_amount;
  const cleanName = params.name ? params.name.trim() : grp.name;
  const cleanRef = params.reference !== undefined ? (params.reference?.trim() || null) : grp.reference;

  const updated: SplitGroup = {
    ...grp,
    name: cleanName,
    reference: cleanRef,
    total_amount: newTotal,
    updated_at: now,
  };

  allGroups[index] = updated;
  writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);

  // If there is only 1 expense (the initial split), keep it in sync with group details
  const activeExpenses = allExpenses.filter((e) => e.split_group_id === params.groupId && !e.deleted_at);
  if (activeExpenses.length === 1) {
    const singleExp = activeExpenses[0];
    singleExp.name = cleanName;
    if (cleanRef !== undefined) singleExp.reference = cleanRef;

    if (params.totalAmount !== undefined) {
      const groupMembers = allMembers.filter((m) => m.split_group_id === params.groupId);
      const count = Math.max(groupMembers.length, 1);
      const perPerson = Math.floor((newTotal / count) * 100) / 100;
      const remainder = parseMoney(newTotal - perPerson * count);

      singleExp.amount = newTotal;
      singleExp.shares = groupMembers.map((m, idx) => ({
        user_id: m.user_id,
        amount: idx === 0 ? parseMoney(perPerson + remainder) : perPerson,
        profile: m.profile,
      }));

      groupMembers.forEach((m, idx) => {
        m.amount = idx === 0 ? parseMoney(perPerson + remainder) : perPerson;
        m.updated_at = now;
      });
      writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);
    }

    singleExp.updated_at = now;
    writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);
  }

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'update_group',
    old_value: oldTotal.toString(),
    new_value: newTotal.toString(),
    description: `${params.actorProfile.full_name} updated split details`,
    created_at: now,
    actor: params.actorProfile,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'group_updated', { group: updated, activity: act });
  return updated;
}

export async function updateMemberSplit(params: {
  groupId: string;
  targetUserId: string;
  newAmount: number;
  actorId: string;
  actorProfile: Profile;
  targetProfile?: Profile;
}): Promise<void> {
  const now = new Date().toISOString();
  const safeAmount = parseMoney(params.newAmount);

  if (isFirebaseConfigured()) {
    try {
      await fsUpdateMemberAmount(params);
    } catch (e) {
      console.warn('Firestore updateMemberSplit notice:', e);
    }
  }

  // Local storage mode
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const memIdx = allMembers.findIndex(
    (m) => m.split_group_id === params.groupId && m.user_id === params.targetUserId
  );
  if (memIdx === -1) throw new Error('Member not found in this group.');

  const oldAmount = parseMoney(allMembers[memIdx].amount);
  allMembers[memIdx].amount = safeAmount;
  allMembers[memIdx].updated_at = now;
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  // If there is only 1 expense (initial split expense), keep its shares in sync
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const activeExpenses = allExpenses.filter((e) => e.split_group_id === params.groupId && !e.deleted_at);
  if (activeExpenses.length === 1) {
    const singleExp = activeExpenses[0];
    const shIdx = (singleExp.shares || []).findIndex((s) => s.user_id === params.targetUserId);
    if (shIdx !== -1) {
      singleExp.shares[shIdx].amount = safeAmount;
    } else {
      singleExp.shares.push({
        user_id: params.targetUserId,
        amount: safeAmount,
        profile: params.targetProfile || allMembers[memIdx].profile,
      });
    }
    singleExp.updated_at = now;
    writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);
  }

  const targetName = params.targetProfile?.full_name || 'Member';
  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    target_user_id: params.targetUserId,
    action_type: 'amount_change',
    old_value: oldAmount.toString(),
    new_value: safeAmount.toString(),
    description: `${params.actorProfile.full_name} updated share for ${targetName}`,
    created_at: now,
    actor: params.actorProfile,
    target: params.targetProfile,
  };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'share_updated', {
    targetUserId: params.targetUserId,
    newAmount: safeAmount,
    activity: act,
  });
}

export async function addSplitMember(params: {
  groupId: string;
  userToAdd: PublicUserSearchResult;
  initialAmount?: number;
  actorId: string;
  actorProfile: Profile;
}): Promise<SplitMember> {
  const now = new Date().toISOString();
  const safeAmount = parseMoney(params.initialAmount || 0);

  // Local storage mode
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  const exists = allMembers.some(
    (m) => m.split_group_id === params.groupId && m.user_id === params.userToAdd.id
  );
  if (exists) throw new Error('User is already a member of this split group.');

  const newMember: SplitMember = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    user_id: params.userToAdd.id,
    amount: safeAmount,
    joined_at: now,
    updated_at: now,
    profile: allProfiles.find((p) => p.id === params.userToAdd.id),
  };

  allMembers.push(newMember);
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    target_user_id: params.userToAdd.id,
    action_type: 'add_member',
    old_value: null,
    new_value: safeAmount.toString(),
    description: `${params.actorProfile.full_name} added ${params.userToAdd.full_name} to the group`,
    created_at: now,
    actor: params.actorProfile,
    target: newMember.profile,
  };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'member_added', { member: newMember, activity: act });
  return newMember;
}

export async function addMemberToSplitGroup(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  newUserId: string;
  amount: number;
}): Promise<SplitMember> {
  const profile = await getProfile(params.newUserId);
  const userSearchResult: PublicUserSearchResult = {
    id: params.newUserId,
    full_name: profile?.full_name || 'Member',
    avatar_url: profile?.avatar_url || null,
    masked_identifier: profile?.email ? maskEmail(profile.email) : 'Member',
  };
  return addSplitMember({
    groupId: params.groupId,
    userToAdd: userSearchResult,
    initialAmount: params.amount,
    actorId: params.actorId,
    actorProfile: params.actorProfile,
  });
}

export async function removeSplitMember(params: {
  groupId: string;
  targetUserId: string;
  actorId: string;
  actorProfile: Profile;
}): Promise<void> {
  const now = new Date().toISOString();

  // Local storage mode
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  const memIdx = allMembers.findIndex(
    (m) => m.split_group_id === params.groupId && m.user_id === params.targetUserId
  );
  if (memIdx === -1) throw new Error('Member not found in this group.');

  const targetProf = allProfiles.find((p) => p.id === params.targetUserId);
  const targetName = targetProf?.full_name || 'Member';

  allMembers.splice(memIdx, 1);
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    target_user_id: params.targetUserId,
    action_type: 'remove_member',
    old_value: null,
    new_value: null,
    description: `${params.actorProfile.full_name} removed ${targetName} from the group`,
    created_at: now,
    actor: params.actorProfile,
    target: targetProf,
  };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'member_removed', { targetUserId: params.targetUserId, activity: act });
}

export async function removeMemberFromSplitGroup(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  targetUserId: string;
}): Promise<void> {
  return removeSplitMember(params);
}

export async function updateSplitGroupDetails(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  name?: string;
  reference?: string | null;
  totalAmount?: number;
}): Promise<SplitGroup> {
  return updateSplitGroup(params);
}

export async function updateMemberAmount(params: {
  groupId: string;
  targetUserId: string;
  newAmount: number;
  actorId: string;
  actorProfile: Profile;
  targetProfile?: Profile;
}): Promise<void> {
  return updateMemberSplit(params);
}

export async function deleteSplitGroup(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
}): Promise<void> {
  const now = new Date().toISOString();

  if (isFirebaseConfigured()) {
    try {
      await fsDeleteSplitGroup(params);
      const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
      const idx = allGroups.findIndex((g) => g.id === params.groupId);
      if (idx !== -1) {
        allGroups[idx].status = 'deleted';
        allGroups[idx].deleted_at = now;
        allGroups[idx].deleted_by = params.actorId;
        allGroups[idx].updated_at = now;
        writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);
      }
      emitLocalRealtime(params.groupId, 'group_deleted', { groupId: params.groupId, actorId: params.actorId });
      return;
    } catch (e) {
      console.warn('Firestore fsDeleteSplitGroup notice:', e);
    }
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const idx = allGroups.findIndex((g) => g.id === params.groupId);
  if (idx === -1) throw new Error('Split group not found.');

  const grp = allGroups[idx];
  if (grp.created_by !== params.actorId) {
    throw new Error('Permission denied: Only the group owner can delete this group.');
  }

  allGroups[idx] = {
    ...grp,
    status: 'deleted',
    deleted_at: now,
    deleted_by: params.actorId,
    updated_at: now,
  };
  writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);

  const act: SplitActivity = {
    id: `act_${Date.now()}_grp_deleted`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'delete_group',
    old_value: grp.name,
    new_value: 'deleted',
    description: `${params.actorProfile.full_name} deleted group "${grp.name}"`,
    created_at: now,
    actor: params.actorProfile,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'group_deleted', { groupId: params.groupId, actorId: params.actorId });
}

// ==========================================
// 4. REAL-TIME SUBSCRIPTION
// ==========================================

export function subscribeToGroupUpdates(
  groupId: string,
  onUpdate: (event?: { type: string; payload?: unknown }) => void
): () => void {
  if (isFirebaseConfigured()) {
    return fsSubscribeToGroupUpdates(groupId, (ev) => onUpdate(ev));
  }

  // Local storage broadcast channel listener
  const handleMessage = (e: MessageEvent) => {
    if (e.data && e.data.groupId === groupId) {
      onUpdate({ type: e.data.type || 'UPDATE', payload: e.data });
    }
  };

  // Cross-window storage event listener
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEYS.SPLIT_GROUPS ||
      e.key === STORAGE_KEYS.SPLIT_MEMBERS ||
      e.key === STORAGE_KEYS.SPLIT_ACTIVITY ||
      e.key === STORAGE_KEYS.SPLIT_GROUP_EXPENSES
    ) {
      onUpdate();
    }
  };

  if (localRealtimeChannel) {
    localRealtimeChannel.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (localRealtimeChannel) {
      localRealtimeChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

export const getUserExpenses = getExpenses;
export const getUserSplitGroups = getMySplitGroups;

// ==========================================
// 5. MONTHLY CATEGORY BUDGETS
// ==========================================

export async function getCategoryBudgets(userId: string): Promise<Record<string, number>> {
  if (isFirebaseConfigured()) {
    try {
      const fsBudgets = await fsGetBudgets(userId);
      if (fsBudgets && Object.keys(fsBudgets).length > 0) {
        writeLocal(STORAGE_KEYS.BUDGETS, fsBudgets);
        return fsBudgets;
      }
    } catch (err) {
      console.warn('Firestore getBudgets notice, using local cache:', err);
    }
  }

  // Local storage fallback
  return readLocal<Record<string, number>>(STORAGE_KEYS.BUDGETS, {});
}

export async function saveCategoryBudgets(
  userId: string,
  budgets: Record<string, number>
): Promise<void> {
  writeLocal(STORAGE_KEYS.BUDGETS, budgets);

  if (isFirebaseConfigured()) {
    try {
      await fsSetAllBudgets(userId, budgets);
    } catch (err) {
      console.error('Failed to sync budgets to Firestore:', err);
      throw err;
    }
  }
}
