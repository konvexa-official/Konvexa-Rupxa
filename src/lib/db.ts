/**
 * Rupxa Database Service Layer
 * Supports Supabase with full RLS and Realtime,
 * with resilient persistent storage and BroadcastChannel realtime synchronization.
 */

import { supabase, isSupabaseConfigured } from './supabase';
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

// Broadcast channel for multi-tab real-time sync in local storage mode
const localRealtimeChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('rupxa_realtime_bus')
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
      console.warn('Firestore getProfile fallback notice:', e);
    }
  }

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile from Supabase:', error.message);
      return null;
    }
    return data as Profile;
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
      console.warn('Firestore createOrUpdateProfile fallback notice:', e);
    }
  }

  if (isSupabaseConfigured() && supabase) {
    const payload = {
      ...profile,
      phone: normalizedPhone,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
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
      full_name: profile.full_name || 'User',
      email: (profile.email || '').toLowerCase().trim(),
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

/**
 * Secure user search:
 * Matches email or normalized phone number.
 * Returns only safe public information: id, full_name, avatar_url, masked_identifier.
 * NEVER returns passwords, tokens, or private finance data.
 */
export async function searchUserByContact(query: string, excludeUserId?: string): Promise<PublicUserSearchResult | null> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return null;

  const isEmail = cleanQuery.includes('@');
  const normalizedQueryPhone = normalizePhoneNumber(cleanQuery);

  if (isFirebaseConfigured()) {
    try {
      const fsRes = await fsSearchUserByContact(query, excludeUserId);
      if (fsRes) return fsRes;
    } catch (e) {
      console.warn('Firestore searchUserByContact fallback notice:', e);
    }
  }

  if (isSupabaseConfigured() && supabase) {
    let builder = supabase.from('profiles').select('id, full_name, email, phone, avatar_url');
    if (isEmail) {
      builder = builder.ilike('email', cleanQuery);
    } else {
      builder = builder.eq('phone', normalizedQueryPhone);
    }

    if (excludeUserId) {
      builder = builder.neq('id', excludeUserId);
    }

    const { data, error } = await builder.maybeSingle();
    if (error || !data) return null;

    return {
      id: data.id,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      masked_identifier: isEmail ? maskEmail(data.email) : maskPhone(data.phone),
    };
  }

  // Local storage mode
  const profiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);
  const match = profiles.find((p) => {
    if (excludeUserId && p.id === excludeUserId) return false;
    if (isEmail) {
      return p.email.toLowerCase() === cleanQuery;
    }
    const pPhone = normalizePhoneNumber(p.phone);
    return pPhone === normalizedQueryPhone && normalizedQueryPhone.length > 0;
  });

  if (!match) return null;

  return {
    id: match.id,
    full_name: match.full_name,
    avatar_url: match.avatar_url,
    masked_identifier: isEmail ? maskEmail(match.email) : maskPhone(match.phone),
  };
}

// ==========================================
// 2. EXPENSES
// ==========================================

export async function getExpenses(userId: string): Promise<Expense[]> {
  if (isFirebaseConfigured()) {
    try {
      return await fsGetExpenses(userId);
    } catch (e) {
      console.warn('Firestore getExpenses fallback notice:', e);
    }
  }

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching expenses:', error.message);
      return [];
    }
    return (data || []).map((e) => ({
      ...e,
      amount: parseMoney(e.amount),
    })) as Expense[];
  }

  // Local storage mode
  const expenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  return expenses
    .filter((e) => e.user_id === userId)
    .sort((a, b) => {
      const dateCmp = new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
      if (dateCmp !== 0) return dateCmp;
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
}

export async function createExpense(
  expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
): Promise<Expense> {
  const safeAmount = parseMoney(expenseData.amount);
  if (safeAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
  if (!expenseData.description.trim()) {
    throw new Error('Description is required.');
  }
  if (!expenseData.expense_date) {
    throw new Error('Valid expense date is required.');
  }

  if (isFirebaseConfigured()) {
    try {
      return await fsCreateExpense(expenseData);
    } catch (e) {
      console.warn('Firestore createExpense fallback notice:', e);
    }
  }

  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: expenseData.user_id,
        amount: safeAmount,
        category: expenseData.category,
        description: expenseData.description.trim(),
        expense_date: expenseData.expense_date,
        payment_method: expenseData.payment_method,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...data, amount: parseMoney(data.amount) } as Expense;
  }

  // Local storage mode
  const expenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const newExpense: Expense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user_id: expenseData.user_id,
    amount: safeAmount,
    category: expenseData.category,
    description: expenseData.description.trim(),
    expense_date: expenseData.expense_date,
    payment_method: expenseData.payment_method,
    created_at: now,
    updated_at: now,
  };

  expenses.unshift(newExpense);
  writeLocal(STORAGE_KEYS.EXPENSES, expenses);
  return newExpense;
}

export async function updateExpense(
  expenseId: string,
  userId: string,
  updates: Partial<Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Expense> {
  const safeAmount = updates.amount !== undefined ? parseMoney(updates.amount) : undefined;
  if (safeAmount !== undefined && safeAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }

  if (isFirebaseConfigured()) {
    try {
      return await fsUpdateExpense(expenseId, userId, updates);
    } catch (e) {
      console.warn('Firestore updateExpense fallback notice:', e);
    }
  }

  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    const payload: Record<string, unknown> = { updated_at: now };
    if (safeAmount !== undefined) payload.amount = safeAmount;
    if (updates.category) payload.category = updates.category;
    if (updates.description) payload.description = updates.description.trim();
    if (updates.expense_date) payload.expense_date = updates.expense_date;
    if (updates.payment_method) payload.payment_method = updates.payment_method;

    const { data, error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', expenseId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...data, amount: parseMoney(data.amount) } as Expense;
  }

  // Local storage mode
  const expenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const idx = expenses.findIndex((e) => e.id === expenseId && e.user_id === userId);
  if (idx === -1) throw new Error('Expense not found or unauthorized');

  const existing = expenses[idx];
  const updated: Expense = {
    ...existing,
    amount: safeAmount !== undefined ? safeAmount : existing.amount,
    category: updates.category || existing.category,
    description: updates.description ? updates.description.trim() : existing.description,
    expense_date: updates.expense_date || existing.expense_date,
    payment_method: updates.payment_method || existing.payment_method,
    updated_at: now,
  };

  expenses[idx] = updated;
  writeLocal(STORAGE_KEYS.EXPENSES, expenses);
  return updated;
}

export async function deleteExpense(expenseId: string, userId: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await fsDeleteExpense(expenseId);
      return;
    } catch (e) {
      console.warn('Firestore deleteExpense fallback notice:', e);
    }
  }

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return;
  }

  // Local storage mode
  const expenses = readLocal<Expense[]>(STORAGE_KEYS.EXPENSES, []);
  const filtered = expenses.filter((e) => !(e.id === expenseId && e.user_id === userId));
  writeLocal(STORAGE_KEYS.EXPENSES, filtered);
}

// ==========================================
// 3. SPLITTER (GROUPS, MEMBERS, & ACTIVITY)
// ==========================================

export async function getMySplitGroups(userId: string): Promise<SplitGroupSummary[]> {
  if (isFirebaseConfigured()) {
    try {
      const fsGroups = await fsGetMySplitGroups(userId);
      if (fsGroups.length > 0) return fsGroups;
    } catch (e) {
      console.warn('Firestore getMySplitGroups fallback notice:', e);
    }
  }

  if (isSupabaseConfigured() && supabase) {
    // Fetch memberships for this user
    const { data: memberRows, error: memError } = await supabase
      .from('split_members')
      .select('split_group_id, amount')
      .eq('user_id', userId);

    if (memError) {
      console.error('Error fetching memberships:', memError.message);
      return [];
    }

    const groupIds = (memberRows || []).map((m) => m.split_group_id);
    if (groupIds.length === 0) return [];

    const { data: groups, error: grpError } = await supabase
      .from('split_groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (grpError) {
      console.error('Error fetching groups:', grpError.message);
      return [];
    }

    // Get member counts for each group
    const { data: allGroupMembers } = await supabase
      .from('split_members')
      .select('split_group_id')
      .in('id', groupIds);

    const counts: Record<string, number> = {};
    (allGroupMembers || []).forEach((m) => {
      counts[m.split_group_id] = (counts[m.split_group_id] || 0) + 1;
    });

    return (groups || []).map((g) => {
      const myMem = memberRows?.find((m) => m.split_group_id === g.id);
      return {
        ...g,
        total_amount: parseMoney(g.total_amount),
        member_count: counts[g.id] || 1,
        user_role: g.created_by === userId ? 'owner' : 'member',
        user_amount: parseMoney(myMem?.amount || 0),
      };
    });
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);

  const myMemberships = allMembers.filter((m) => m.user_id === userId);
  const myGroupIds = new Set(myMemberships.map((m) => m.split_group_id));

  const filteredGroups = allGroups.filter((g) => myGroupIds.has(g.id) || g.created_by === userId);

  return filteredGroups
    .map((g) => {
      const groupMembers = allMembers.filter((m) => m.split_group_id === g.id);
      const myMem = groupMembers.find((m) => m.user_id === userId);
      return {
        ...g,
        total_amount: parseMoney(g.total_amount),
        member_count: groupMembers.length,
        user_role: (g.created_by === userId ? 'owner' : 'member') as 'owner' | 'member',
        user_amount: parseMoney(myMem?.amount || 0),
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ==========================================
// 3. GROUP EXPENSES & SPLITS
// ==========================================

export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('split_group_expenses')
        .select('*, paid_by_profile:profiles!paid_by_user_id(*)')
        .eq('split_group_id', groupId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const allProfilesRes = await supabase.from('profiles').select('*');
        const profilesMap = new Map((allProfilesRes.data || []).map((p: Profile) => [p.id, p]));

        return data.map((exp: any) => ({
          ...exp,
          amount: parseMoney(exp.amount),
          shares: (exp.shares || []).map((s: any) => ({
            ...s,
            amount: parseMoney(s.amount),
            profile: profilesMap.get(s.user_id),
          })),
        })) as GroupExpense[];
      }
    } catch (err) {
      console.warn('Supabase getGroupExpenses query fallback to local:', err);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  return allExpenses
    .filter((e) => e.split_group_id === groupId)
    .map((e) => {
      const paidProf = allProfiles.find((p) => p.id === e.paid_by_user_id);
      return {
        ...e,
        amount: parseMoney(e.amount),
        paid_by_profile: paidProf,
        shares: (e.shares || []).map((s) => ({
          ...s,
          amount: parseMoney(s.amount),
          profile: allProfiles.find((p) => p.id === s.user_id),
        })),
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addGroupExpense(params: {
  groupId: string;
  name: string;
  amount: number;
  category: string;
  paidByUserId: string;
  splitType: 'equal' | 'custom';
  shares: Array<{ userId: string; amount: number }>;
  actorId: string;
  actorProfile: Profile;
}): Promise<GroupExpense> {
  const safeAmount = parseMoney(params.amount);
  if (safeAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
  const cleanName = params.name.trim();
  if (!cleanName) {
    throw new Error('Expense name is required.');
  }
  const cleanCategory = params.category.trim();
  if (!cleanCategory) {
    throw new Error('Expense category is required.');
  }
  if (!params.paidByUserId) {
    throw new Error('Please select who paid for this expense.');
  }
  if (!params.shares || params.shares.length === 0) {
    throw new Error('Please select at least one member to split between.');
  }

  // Validate that sum of all shares matches expense amount (0.05 tolerance for paise rounding)
  const sharesTotal = parseMoney(params.shares.reduce((sum, s) => sum + parseMoney(s.amount), 0));
  if (Math.abs(sharesTotal - safeAmount) > 0.05) {
    throw new Error(
      `Sum of all shares (₹${sharesTotal.toFixed(2)}) must equal the total expense amount (₹${safeAmount.toFixed(2)}).`
    );
  }

  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const expenseId = `ge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Find paid_by profile for activity description
  let paidByName = params.actorProfile.full_name;
  if (params.paidByUserId !== params.actorId) {
    const prof = await getProfile(params.paidByUserId);
    if (prof) paidByName = prof.full_name;
  }

  const activityDesc = `${params.actorProfile.full_name} added expense "${cleanName}" for ₹${safeAmount.toLocaleString('en-IN')} (${cleanCategory}, paid by ${paidByName})`;

  const newExpense: GroupExpense = {
    id: expenseId,
    split_group_id: params.groupId,
    name: cleanName,
    amount: safeAmount,
    category: cleanCategory,
    paid_by_user_id: params.paidByUserId,
    split_type: params.splitType,
    shares: params.shares.map((s) => ({
      user_id: s.userId,
      amount: parseMoney(s.amount),
    })),
    created_by: params.actorId,
    expense_date: todayStr,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: inserted, error: expErr } = await supabase
        .from('split_group_expenses')
        .insert({
          id: expenseId,
          split_group_id: params.groupId,
          name: cleanName,
          amount: safeAmount,
          category: cleanCategory,
          paid_by_user_id: params.paidByUserId,
          split_type: params.splitType,
          shares: newExpense.shares,
          created_by: params.actorId,
          expense_date: todayStr,
        })
        .select('*, paid_by_profile:profiles!paid_by_user_id(*)')
        .single();

      if (!expErr && inserted) {
        // Recalculate group total & member shares
        const allGroupExpenses = await getGroupExpenses(params.groupId);
        const newGroupTotal = parseMoney(allGroupExpenses.reduce((sum, e) => sum + e.amount, 0));

        await supabase
          .from('split_groups')
          .update({ total_amount: newGroupTotal, updated_at: now })
          .eq('id', params.groupId);

        const { data: currentMembers } = await supabase
          .from('split_members')
          .select('user_id')
          .eq('split_group_id', params.groupId);

        if (currentMembers) {
          for (const m of currentMembers) {
            const memberTotal = parseMoney(
              allGroupExpenses.reduce((sum, e) => {
                const s = e.shares?.find((sh) => sh.user_id === m.user_id);
                return sum + (s ? s.amount : 0);
              }, 0)
            );
            await supabase
              .from('split_members')
              .update({ amount: memberTotal, updated_at: now })
              .eq('split_group_id', params.groupId)
              .eq('user_id', m.user_id);
          }
        }

        await supabase.from('split_activity').insert({
          split_group_id: params.groupId,
          actor_user_id: params.actorId,
          action_type: 'add_expense',
          new_value: safeAmount.toString(),
          description: activityDesc,
        });

        return inserted as GroupExpense;
      }
    } catch (err) {
      console.warn('Supabase addGroupExpense fallback to local:', err);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  allExpenses.unshift(newExpense);
  writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);

  // Recalculate group total
  const groupExpenses = allExpenses.filter((e) => e.split_group_id === params.groupId);
  const newGroupTotal = parseMoney(groupExpenses.reduce((sum, e) => sum + e.amount, 0));

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
        groupExpenses.reduce((sum, e) => {
          const s = e.shares?.find((sh) => sh.user_id === m.user_id);
          return sum + (s ? s.amount : 0);
        }, 0)
      );
      m.amount = memberTotal;
      m.updated_at = now;
    }
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  // Append immutable activity
  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'add_expense',
    new_value: safeAmount.toString(),
    description: activityDesc,
    created_at: now,
    actor: params.actorProfile,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'expense_added', { expense: newExpense, activity: act });
  return newExpense;
}

export async function updateGroupExpense(params: {
  expenseId: string;
  groupId: string;
  name: string;
  amount: number;
  category: string;
  paidByUserId: string;
  splitType: 'equal' | 'custom';
  shares: Array<{ userId: string; amount: number }>;
  actorId: string;
  actorProfile: Profile;
}): Promise<void> {
  const safeAmount = parseMoney(params.amount);
  if (safeAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
  const cleanName = params.name.trim();
  if (!cleanName) {
    throw new Error('Expense name is required.');
  }
  const cleanCategory = params.category.trim();
  if (!cleanCategory) {
    throw new Error('Expense category is required.');
  }
  if (!params.paidByUserId) {
    throw new Error('Please select who paid for this expense.');
  }
  if (!params.shares || params.shares.length === 0) {
    throw new Error('Please select at least one member to split between.');
  }

  const sharesTotal = parseMoney(params.shares.reduce((sum, s) => sum + parseMoney(s.amount), 0));
  if (Math.abs(sharesTotal - safeAmount) > 0.05) {
    throw new Error(
      `Sum of all shares (₹${sharesTotal.toFixed(2)}) must equal the total expense amount (₹${safeAmount.toFixed(2)}).`
    );
  }

  const now = new Date().toISOString();

  let paidByName = params.actorProfile.full_name;
  if (params.paidByUserId !== params.actorId) {
    const prof = await getProfile(params.paidByUserId);
    if (prof) paidByName = prof.full_name;
  }

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: existingExp } = await supabase
        .from('split_group_expenses')
        .select('name, amount')
        .eq('id', params.expenseId)
        .single();

      const oldAmount = parseMoney(existingExp?.amount || 0);

      const { error: updErr } = await supabase
        .from('split_group_expenses')
        .update({
          name: cleanName,
          amount: safeAmount,
          category: cleanCategory,
          paid_by_user_id: params.paidByUserId,
          split_type: params.splitType,
          shares: params.shares.map((s) => ({
            user_id: s.userId,
            amount: parseMoney(s.amount),
          })),
          updated_at: now,
        })
        .eq('id', params.expenseId);

      if (!updErr) {
        const allGroupExpenses = await getGroupExpenses(params.groupId);
        const newGroupTotal = parseMoney(allGroupExpenses.reduce((sum, e) => sum + e.amount, 0));

        await supabase
          .from('split_groups')
          .update({ total_amount: newGroupTotal, updated_at: now })
          .eq('id', params.groupId);

        const { data: currentMembers } = await supabase
          .from('split_members')
          .select('user_id')
          .eq('split_group_id', params.groupId);

        if (currentMembers) {
          for (const m of currentMembers) {
            const memberTotal = parseMoney(
              allGroupExpenses.reduce((sum, e) => {
                const s = e.shares?.find((sh) => sh.user_id === m.user_id);
                return sum + (s ? s.amount : 0);
              }, 0)
            );
            await supabase
              .from('split_members')
              .update({ amount: memberTotal, updated_at: now })
              .eq('split_group_id', params.groupId)
              .eq('user_id', m.user_id);
          }
        }

        const activityDesc = `${params.actorProfile.full_name} edited expense "${cleanName}" (₹${oldAmount.toLocaleString('en-IN')} → ₹${safeAmount.toLocaleString('en-IN')}, ${cleanCategory}, paid by ${paidByName})`;

        await supabase.from('split_activity').insert({
          split_group_id: params.groupId,
          actor_user_id: params.actorId,
          action_type: 'edit_expense',
          old_value: oldAmount.toString(),
          new_value: safeAmount.toString(),
          description: activityDesc,
        });

        return;
      }
    } catch (err) {
      console.warn('Supabase updateGroupExpense fallback to local:', err);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const expIdx = allExpenses.findIndex((e) => e.id === params.expenseId);
  if (expIdx === -1) throw new Error('Expense not found.');

  const oldExp = allExpenses[expIdx];
  const oldAmount = oldExp.amount;

  allExpenses[expIdx] = {
    ...oldExp,
    name: cleanName,
    amount: safeAmount,
    category: cleanCategory,
    paid_by_user_id: params.paidByUserId,
    split_type: params.splitType,
    shares: params.shares.map((s) => ({
      user_id: s.userId,
      amount: parseMoney(s.amount),
    })),
    updated_at: now,
  };
  writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, allExpenses);

  // Recalculate group total
  const groupExpenses = allExpenses.filter((e) => e.split_group_id === params.groupId);
  const newGroupTotal = parseMoney(groupExpenses.reduce((sum, e) => sum + e.amount, 0));

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
        groupExpenses.reduce((sum, e) => {
          const s = e.shares?.find((sh) => sh.user_id === m.user_id);
          return sum + (s ? s.amount : 0);
        }, 0)
      );
      m.amount = memberTotal;
      m.updated_at = now;
    }
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  const activityDesc = `${params.actorProfile.full_name} edited expense "${cleanName}" (₹${oldAmount.toLocaleString('en-IN')} → ₹${safeAmount.toLocaleString('en-IN')}, ${cleanCategory}, paid by ${paidByName})`;

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'edit_expense',
    old_value: oldAmount.toString(),
    new_value: safeAmount.toString(),
    description: activityDesc,
    created_at: now,
    actor: params.actorProfile,
  };
  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'expense_updated', { expense: allExpenses[expIdx], activity: act });
}

export async function deleteGroupExpense(params: {
  expenseId: string;
  groupId: string;
  actorId: string;
  actorProfile: Profile;
}): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: existingExp } = await supabase
        .from('split_group_expenses')
        .select('name, amount')
        .eq('id', params.expenseId)
        .single();

      const oldName = existingExp?.name || 'Expense';
      const oldAmount = parseMoney(existingExp?.amount || 0);

      const { error: delErr } = await supabase
        .from('split_group_expenses')
        .delete()
        .eq('id', params.expenseId);

      if (!delErr) {
        const allGroupExpenses = await getGroupExpenses(params.groupId);
        const newGroupTotal = parseMoney(allGroupExpenses.reduce((sum, e) => sum + e.amount, 0));

        await supabase
          .from('split_groups')
          .update({ total_amount: newGroupTotal, updated_at: now })
          .eq('id', params.groupId);

        const { data: currentMembers } = await supabase
          .from('split_members')
          .select('user_id')
          .eq('split_group_id', params.groupId);

        if (currentMembers) {
          for (const m of currentMembers) {
            const memberTotal = parseMoney(
              allGroupExpenses.reduce((sum, e) => {
                const s = e.shares?.find((sh) => sh.user_id === m.user_id);
                return sum + (s ? s.amount : 0);
              }, 0)
            );
            await supabase
              .from('split_members')
              .update({ amount: memberTotal, updated_at: now })
              .eq('split_group_id', params.groupId)
              .eq('user_id', m.user_id);
          }
        }

        const activityDesc = `${params.actorProfile.full_name} deleted expense "${oldName}" (₹${oldAmount.toLocaleString('en-IN')})`;

        await supabase.from('split_activity').insert({
          split_group_id: params.groupId,
          actor_user_id: params.actorId,
          action_type: 'delete_expense',
          old_value: oldAmount.toString(),
          new_value: null,
          description: activityDesc,
        });

        return;
      }
    } catch (err) {
      console.warn('Supabase deleteGroupExpense fallback to local:', err);
    }
  }

  // Local storage mode
  const allExpenses = readLocal<GroupExpense[]>(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, []);
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const exp = allExpenses.find((e) => e.id === params.expenseId);
  if (!exp) return;

  const oldName = exp.name;
  const oldAmount = exp.amount;

  const filtered = allExpenses.filter((e) => e.id !== params.expenseId);
  writeLocal(STORAGE_KEYS.SPLIT_GROUP_EXPENSES, filtered);

  // Recalculate group total
  const groupExpenses = filtered.filter((e) => e.split_group_id === params.groupId);
  const newGroupTotal = parseMoney(groupExpenses.reduce((sum, e) => sum + e.amount, 0));

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
        groupExpenses.reduce((sum, e) => {
          const s = e.shares?.find((sh) => sh.user_id === m.user_id);
          return sum + (s ? s.amount : 0);
        }, 0)
      );
      m.amount = memberTotal;
      m.updated_at = now;
    }
  });
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  const activityDesc = `${params.actorProfile.full_name} deleted expense "${oldName}" (₹${oldAmount.toLocaleString('en-IN')})`;

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'delete_expense',
    old_value: oldAmount.toString(),
    new_value: null,
    description: activityDesc,
    created_at: now,
    actor: params.actorProfile,
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
} | null> {
  if (isFirebaseConfigured()) {
    try {
      const fsDetails = await fsGetSplitGroupDetails(groupId, currentUserId);
      if (fsDetails) return fsDetails;
    } catch (e) {
      console.warn('Firestore getSplitGroupDetails fallback notice:', e);
    }
  }

  const expenses = await getGroupExpenses(groupId);

  if (isSupabaseConfigured() && supabase) {
    const { data: group, error: grpError } = await supabase
      .from('split_groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

    if (grpError || !group) return null;

    const { data: members, error: memError } = await supabase
      .from('split_members')
      .select('*, profile:profiles(*)')
      .eq('split_group_id', groupId)
      .order('joined_at', { ascending: true });

    if (memError) return null;

    const { data: activity, error: actError } = await supabase
      .from('split_activity')
      .select('*, actor:profiles!actor_user_id(*), target:profiles!target_user_id(*)')
      .eq('split_group_id', groupId)
      .order('created_at', { ascending: false });

    if (actError) return null;

    const calculatedTotal = expenses.length > 0
      ? parseMoney(expenses.reduce((sum, e) => sum + e.amount, 0))
      : parseMoney(group.total_amount);

    const updatedMembers = (members || []).map((m) => {
      const memberExpenseShare = expenses.reduce((sum, e) => {
        const sh = e.shares?.find((s) => s.user_id === m.user_id);
        return sum + (sh ? sh.amount : 0);
      }, 0);
      return {
        ...m,
        amount: expenses.length > 0 ? parseMoney(memberExpenseShare) : parseMoney(m.amount),
      };
    }) as SplitMember[];

    return {
      group: { ...group, total_amount: calculatedTotal } as SplitGroup,
      members: updatedMembers,
      activity: (activity || []) as SplitActivity[],
      expenses,
    };
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  const group = allGroups.find((g) => g.id === groupId);
  if (!group) return null;

  const calculatedTotal = expenses.length > 0
    ? parseMoney(expenses.reduce((sum, e) => sum + e.amount, 0))
    : parseMoney(group.total_amount);

  const members = allMembers
    .filter((m) => m.split_group_id === groupId)
    .map((m) => {
      const prof = allProfiles.find((p) => p.id === m.user_id);
      const memberExpenseShare = expenses.reduce((sum, e) => {
        const sh = e.shares?.find((s) => s.user_id === m.user_id);
        return sum + (sh ? sh.amount : 0);
      }, 0);

      return {
        ...m,
        amount: expenses.length > 0 ? parseMoney(memberExpenseShare) : parseMoney(m.amount),
        profile: prof || undefined,
      };
    })
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

  const activity = allActivity
    .filter((a) => a.split_group_id === groupId)
    .map((a) => {
      const actorProf = allProfiles.find((p) => p.id === a.actor_user_id);
      const targetProf = a.target_user_id ? allProfiles.find((p) => p.id === a.target_user_id) : undefined;
      return {
        ...a,
        actor: actorProf || undefined,
        target: targetProf || undefined,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    group: { ...group, total_amount: calculatedTotal },
    members,
    activity,
    expenses,
  };
}

export async function createSplitGroup(params: {
  name: string;
  totalAmount: number;
  currency: string;
  creatorId: string;
  creatorProfile: Profile;
  members: Array<{ userId: string; amount: number; profile?: Profile }>;
}): Promise<SplitGroup> {
  const safeTotal = parseMoney(params.totalAmount);
  if (safeTotal < 0) {
    throw new Error('Total amount cannot be negative.');
  }
  if (!params.name.trim()) {
    throw new Error('Split name is required.');
  }

  if (isFirebaseConfigured()) {
    try {
      return await fsCreateSplitGroup(params);
    } catch (e) {
      console.warn('Firestore createSplitGroup fallback notice:', e);
    }
  }

  const now = new Date().toISOString();
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Ensure creator is in the members list
  const memberList = [...params.members];
  if (!memberList.some((m) => m.userId === params.creatorId)) {
    memberList.unshift({
      userId: params.creatorId,
      amount: safeTotal,
      profile: params.creatorProfile,
    });
  }

  const initialActivityDescription = `${params.creatorProfile.full_name} created "${params.name.trim()}" Total ₹${safeTotal.toLocaleString('en-IN')}`;

  if (isSupabaseConfigured() && supabase) {
    // 1. Insert group
    const { data: groupData, error: groupErr } = await supabase
      .from('split_groups')
      .insert({
        name: params.name.trim(),
        created_by: params.creatorId,
        total_amount: safeTotal,
        currency: params.currency || 'INR',
        status: 'active',
      })
      .select()
      .single();

    if (groupErr) throw new Error(groupErr.message);

    const actualGroupId = groupData.id;

    // 2. Insert members
    const memberRows = memberList.map((m) => ({
      split_group_id: actualGroupId,
      user_id: m.userId,
      amount: parseMoney(m.amount),
    }));

    const { error: memErr } = await supabase.from('split_members').insert(memberRows);
    if (memErr) throw new Error(memErr.message);

    // 3. Insert immutable activity log
    await supabase.from('split_activity').insert({
      split_group_id: actualGroupId,
      actor_user_id: params.creatorId,
      action_type: 'create_group',
      old_value: null,
      new_value: safeTotal.toString(),
      description: initialActivityDescription,
    });

    return { ...groupData, total_amount: parseMoney(groupData.total_amount) } as SplitGroup;
  }

  // Local storage mode
  const newGroup: SplitGroup = {
    id: groupId,
    name: params.name.trim(),
    created_by: params.creatorId,
    total_amount: safeTotal,
    currency: params.currency || 'INR',
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  const newMembers: SplitMember[] = memberList.map((m) => ({
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: groupId,
    user_id: m.userId,
    amount: parseMoney(m.amount),
    joined_at: now,
    updated_at: now,
    profile: m.profile,
  }));

  const initialActivity: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: groupId,
    actor_user_id: params.creatorId,
    action_type: 'create_group',
    old_value: null,
    new_value: safeTotal.toString(),
    description: initialActivityDescription,
    created_at: now,
    actor: params.creatorProfile,
  };

  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  allGroups.unshift(newGroup);
  allMembers.push(...newMembers);
  allActivity.unshift(initialActivity);

  writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(groupId, 'group_created', newGroup);

  return newGroup;
}

export async function updateSplitGroupDetails(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  name?: string;
  totalAmount?: number;
}): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    // Verify owner
    const { data: grp } = await supabase
      .from('split_groups')
      .select('created_by, total_amount, name')
      .eq('id', params.groupId)
      .single();

    if (!grp || grp.created_by !== params.actorId) {
      throw new Error('Only the group owner can update group details.');
    }

    const payload: Record<string, unknown> = { updated_at: now };
    let desc = '';
    if (params.name && params.name.trim() !== grp.name) {
      payload.name = params.name.trim();
      desc = `${params.actorProfile.full_name} updated group name to "${params.name.trim()}"`;
    }
    if (params.totalAmount !== undefined && parseMoney(params.totalAmount) !== parseMoney(grp.total_amount)) {
      payload.total_amount = parseMoney(params.totalAmount);
      const totalDesc = `${params.actorProfile.full_name} updated group total to ₹${parseMoney(params.totalAmount).toLocaleString('en-IN')}`;
      desc = desc ? `${desc} and ${totalDesc}` : totalDesc;
    }

    if (Object.keys(payload).length > 1) {
      await supabase.from('split_groups').update(payload).eq('id', params.groupId);

      if (desc) {
        await supabase.from('split_activity').insert({
          split_group_id: params.groupId,
          actor_user_id: params.actorId,
          action_type: 'update_group',
          old_value: grp.total_amount?.toString() || null,
          new_value: params.totalAmount?.toString() || null,
          description: desc,
        });
      }
    }
    return;
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);

  const grpIndex = allGroups.findIndex((g) => g.id === params.groupId);
  if (grpIndex === -1) throw new Error('Group not found');

  const grp = allGroups[grpIndex];
  if (grp.created_by !== params.actorId) {
    throw new Error('Only the group owner can update group details.');
  }

  let desc = '';
  if (params.name && params.name.trim() !== grp.name) {
    desc = `${params.actorProfile.full_name} updated group name to "${params.name.trim()}"`;
    grp.name = params.name.trim();
  }
  if (params.totalAmount !== undefined && parseMoney(params.totalAmount) !== grp.total_amount) {
    const oldTot = grp.total_amount;
    grp.total_amount = parseMoney(params.totalAmount);
    const totalDesc = `${params.actorProfile.full_name} updated group total: ₹${oldTot.toLocaleString('en-IN')} → ₹${grp.total_amount.toLocaleString('en-IN')}`;
    desc = desc ? `${desc} and ${totalDesc}` : totalDesc;
  }

  grp.updated_at = now;
  allGroups[grpIndex] = grp;
  writeLocal(STORAGE_KEYS.SPLIT_GROUPS, allGroups);

  if (desc) {
    allActivity.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      split_group_id: params.groupId,
      actor_user_id: params.actorId,
      action_type: 'update_group',
      description: desc,
      created_at: now,
      actor: params.actorProfile,
    });
    writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);
  }

  emitLocalRealtime(params.groupId, 'group_updated', grp);
}

/**
 * Update a member's split amount.
 * Enforces permissions:
 * - Group owner can edit any member's amount
 * - Normal member can ONLY edit their own amount
 * Appends immutable record to split_activity.
 */
export async function updateMemberAmount(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  targetUserId: string;
  newAmount: number;
}): Promise<void> {
  const safeAmount = parseMoney(params.newAmount);
  if (safeAmount < 0) {
    throw new Error('Amount cannot be negative.');
  }
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    // 1. Fetch group to check ownership
    const { data: grp } = await supabase
      .from('split_groups')
      .select('created_by')
      .eq('id', params.groupId)
      .single();

    if (!grp) throw new Error('Split group not found');

    const isOwner = grp.created_by === params.actorId;
    const isSelf = params.actorId === params.targetUserId;

    if (!isOwner && !isSelf) {
      throw new Error('Unauthorized: You can only edit your own amount.');
    }

    // 2. Fetch existing member amount and profile
    const { data: existingMem } = await supabase
      .from('split_members')
      .select('amount, profile:profiles(*)')
      .eq('split_group_id', params.groupId)
      .eq('user_id', params.targetUserId)
      .single();

    if (!existingMem) throw new Error('Member not found in split');

    const oldAmount = parseMoney(existingMem.amount);
    if (oldAmount === safeAmount) return; // No change

    // 3. Update amount
    const { error: updErr } = await supabase
      .from('split_members')
      .update({ amount: safeAmount, updated_at: now })
      .eq('split_group_id', params.groupId)
      .eq('user_id', params.targetUserId);

    if (updErr) throw new Error(updErr.message);

    // 4. Construct description
    // Example: "Rahul changed his amount: ₹1,000 → ₹1,200"
    // or: "Sateesh changed Rahul's amount: ₹1,500 → ₹1,400"
    let desc = '';
    const targetName = (existingMem as any).profile?.full_name || 'Member';

    if (isSelf) {
      desc = `${params.actorProfile.full_name} changed their amount: ₹${oldAmount.toLocaleString('en-IN')} → ₹${safeAmount.toLocaleString('en-IN')}`;
    } else {
      desc = `${params.actorProfile.full_name} changed ${targetName}'s amount: ₹${oldAmount.toLocaleString('en-IN')} → ₹${safeAmount.toLocaleString('en-IN')}`;
    }

    // 5. Append immutable activity
    await supabase.from('split_activity').insert({
      split_group_id: params.groupId,
      actor_user_id: params.actorId,
      action_type: 'amount_change',
      target_user_id: params.targetUserId,
      old_value: oldAmount.toString(),
      new_value: safeAmount.toString(),
      description: desc,
    });

    return;
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  const grp = allGroups.find((g) => g.id === params.groupId);
  if (!grp) throw new Error('Split group not found');

  const isOwner = grp.created_by === params.actorId;
  const isSelf = params.actorId === params.targetUserId;

  if (!isOwner && !isSelf) {
    throw new Error('Unauthorized: You can only edit your own amount.');
  }

  const memIndex = allMembers.findIndex(
    (m) => m.split_group_id === params.groupId && m.user_id === params.targetUserId
  );
  if (memIndex === -1) throw new Error('Member not found in split');

  const member = allMembers[memIndex];
  const oldAmount = member.amount;
  if (oldAmount === safeAmount) return;

  member.amount = safeAmount;
  member.updated_at = now;
  allMembers[memIndex] = member;
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  const targetProf = allProfiles.find((p) => p.id === params.targetUserId);
  const targetName = targetProf ? targetProf.full_name : 'Member';

  let desc = '';
  if (isSelf) {
    desc = `${params.actorProfile.full_name} changed their amount: ₹${oldAmount.toLocaleString('en-IN')} → ₹${safeAmount.toLocaleString('en-IN')}`;
  } else {
    desc = `${params.actorProfile.full_name} changed ${targetName}'s amount: ₹${oldAmount.toLocaleString('en-IN')} → ₹${safeAmount.toLocaleString('en-IN')}`;
  }

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'amount_change',
    target_user_id: params.targetUserId,
    old_value: oldAmount.toString(),
    new_value: safeAmount.toString(),
    description: desc,
    created_at: now,
    actor: params.actorProfile,
    target: targetProf,
  };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'amount_changed', { member, activity: act });
}

export async function addMemberToSplitGroup(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  newUserId: string;
  amount: number;
}): Promise<void> {
  const safeAmount = parseMoney(params.amount);
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    // 1. Fetch group
    const { data: grp } = await supabase
      .from('split_groups')
      .select('created_by')
      .eq('id', params.groupId)
      .single();

    if (!grp) throw new Error('Split group not found');

    const isOwner = grp.created_by === params.actorId;
    const isJoiningSelf = params.actorId === params.newUserId;

    if (!isOwner && !isJoiningSelf) {
      throw new Error('Only the group owner can add members.');
    }

    // 2. Fetch new member profile for description
    const { data: newProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', params.newUserId)
      .single();

    const targetName = newProfile?.full_name || 'Member';

    // 3. Insert member
    const { error: insErr } = await supabase.from('split_members').insert({
      split_group_id: params.groupId,
      user_id: params.newUserId,
      amount: safeAmount,
    });

    if (insErr) {
      if (insErr.code === '23505') {
        throw new Error('User is already a member of this split group.');
      }
      throw new Error(insErr.message);
    }

    // 4. Log activity:
    // e.g. "Rahul joined the group" vs "Sateesh added Kiran"
    const desc = isJoiningSelf
      ? `${targetName} joined the group`
      : `${params.actorProfile.full_name} added ${targetName}`;

    await supabase.from('split_activity').insert({
      split_group_id: params.groupId,
      actor_user_id: params.actorId,
      action_type: isJoiningSelf ? 'join_group' : 'add_member',
      target_user_id: params.newUserId,
      old_value: null,
      new_value: safeAmount.toString(),
      description: desc,
    });

    return;
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  const grp = allGroups.find((g) => g.id === params.groupId);
  if (!grp) throw new Error('Split group not found');

  const isOwner = grp.created_by === params.actorId;
  const isJoiningSelf = params.actorId === params.newUserId;

  if (!isOwner && !isJoiningSelf) {
    throw new Error('Only the group owner can add members.');
  }

  const alreadyMember = allMembers.some(
    (m) => m.split_group_id === params.groupId && m.user_id === params.newUserId
  );
  if (alreadyMember) {
    throw new Error('User is already a member of this split group.');
  }

  const newMemProf = allProfiles.find((p) => p.id === params.newUserId);
  const targetName = newMemProf ? newMemProf.full_name : 'Member';

  const newMember: SplitMember = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    user_id: params.newUserId,
    amount: safeAmount,
    joined_at: now,
    updated_at: now,
    profile: newMemProf,
  };

  allMembers.push(newMember);
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, allMembers);

  const desc = isJoiningSelf
    ? `${targetName} joined the group`
    : `${params.actorProfile.full_name} added ${targetName}`;

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: isJoiningSelf ? 'join_group' : 'add_member',
    target_user_id: params.newUserId,
    old_value: null,
    new_value: safeAmount.toString(),
    description: desc,
    created_at: now,
    actor: params.actorProfile,
    target: newMemProf,
  };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'member_added', { member: newMember, activity: act });
}

export async function removeMemberFromSplitGroup(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  targetUserId: string;
}): Promise<void> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    const { data: grp } = await supabase
      .from('split_groups')
      .select('created_by')
      .eq('id', params.groupId)
      .single();

    if (!grp) throw new Error('Split group not found');

    const isOwner = grp.created_by === params.actorId;
    const isLeavingSelf = params.actorId === params.targetUserId;

    if (!isOwner && !isLeavingSelf) {
      throw new Error('Unauthorized to remove this member.');
    }

    // Owner cannot leave their own group if there are other members
    if (isLeavingSelf && isOwner) {
      throw new Error('Group creator cannot leave their own group.');
    }

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', params.targetUserId)
      .single();

    const targetName = targetProfile?.full_name || 'Member';

    // Delete membership
    const { error: delErr } = await supabase
      .from('split_members')
      .delete()
      .eq('split_group_id', params.groupId)
      .eq('user_id', params.targetUserId);

    if (delErr) throw new Error(delErr.message);

    // E.g. "Rahul left the group" vs "Sateesh removed Rahul"
    const desc = isLeavingSelf
      ? `${targetName} left the group`
      : `${params.actorProfile.full_name} removed ${targetName}`;

    await supabase.from('split_activity').insert({
      split_group_id: params.groupId,
      actor_user_id: params.actorId,
      action_type: isLeavingSelf ? 'leave_group' : 'remove_member',
      target_user_id: params.targetUserId,
      old_value: null,
      new_value: null,
      description: desc,
    });

    return;
  }

  // Local storage mode
  const allGroups = readLocal<SplitGroup[]>(STORAGE_KEYS.SPLIT_GROUPS, []);
  const allMembers = readLocal<SplitMember[]>(STORAGE_KEYS.SPLIT_MEMBERS, []);
  const allActivity = readLocal<SplitActivity[]>(STORAGE_KEYS.SPLIT_ACTIVITY, []);
  const allProfiles = readLocal<Profile[]>(STORAGE_KEYS.PROFILES, []);

  const grp = allGroups.find((g) => g.id === params.groupId);
  if (!grp) throw new Error('Split group not found');

  const isOwner = grp.created_by === params.actorId;
  const isLeavingSelf = params.actorId === params.targetUserId;

  if (!isOwner && !isLeavingSelf) {
    throw new Error('Unauthorized to remove this member.');
  }

  if (isLeavingSelf && isOwner) {
    throw new Error('Group creator cannot leave their own group.');
  }

  const targetProf = allProfiles.find((p) => p.id === params.targetUserId);
  const targetName = targetProf ? targetProf.full_name : 'Member';

  const updatedMembers = allMembers.filter(
    (m) => !(m.split_group_id === params.groupId && m.user_id === params.targetUserId)
  );
  writeLocal(STORAGE_KEYS.SPLIT_MEMBERS, updatedMembers);

  const desc = isLeavingSelf
    ? `${targetName} left the group`
    : `${params.actorProfile.full_name} removed ${targetName}`;

  const act: SplitActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: isLeavingSelf ? 'leave_group' : 'remove_member',
    target_user_id: params.targetUserId,
    old_value: null,
    new_value: null,
    description: desc,
    created_at: now,
    actor: params.actorProfile,
    target: targetProf,
  };

  allActivity.unshift(act);
  writeLocal(STORAGE_KEYS.SPLIT_ACTIVITY, allActivity);

  emitLocalRealtime(params.groupId, 'member_removed', { targetUserId: params.targetUserId, activity: act });
}

// ==========================================
// 4. REAL-TIME SUBSCRIPTION
// ==========================================

export function subscribeToGroupUpdates(
  groupId: string,
  onUpdate: () => void
): () => void {
  if (isFirebaseConfigured()) {
    return fsSubscribeToGroupUpdates(groupId, () => onUpdate());
  }

  if (isSupabaseConfigured() && supabase) {
    const channelName = `split_group_${groupId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_groups', filter: `id=eq.${groupId}` },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_members', filter: `split_group_id=eq.${groupId}` },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'split_activity', filter: `split_group_id=eq.${groupId}` },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'split_group_expenses', filter: `split_group_id=eq.${groupId}` },
        () => onUpdate()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected
        }
      });

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }

  // Local storage broadcast channel listener
  const handleMessage = (e: MessageEvent) => {
    if (e.data && e.data.groupId === groupId) {
      onUpdate();
    }
  };

  // Also listen to window storage event for cross-window sync
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
