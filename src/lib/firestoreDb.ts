/**
 * Konvexa Rupxa Firestore Database Service
 * Provides full data persistence and real-time syncing using Google Cloud Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
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

// ==========================================
// 1. PROFILES & USER DIRECTORY
// ==========================================

export async function fsGetProfile(userId: string): Promise<Profile | null> {
  if (!isFirebaseConfigured() || !db) return null;
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  return userDoc.data() as Profile;
}

export async function fsCreateOrUpdateProfile(
  profile: Partial<Profile> & { id: string }
): Promise<Profile> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const normalizedPhone = profile.phone ? normalizePhoneNumber(profile.phone) : '';
  const userRef = doc(db, 'users', profile.id);

  const existingSnap = await getDoc(userRef);
  const existing = existingSnap.exists() ? (existingSnap.data() as Profile) : null;

  const payload: Profile = {
    id: profile.id,
    full_name: profile.full_name || existing?.full_name || 'User',
    email: (profile.email || existing?.email || '').toLowerCase().trim(),
    phone: normalizedPhone || existing?.phone || '',
    avatar_url: profile.avatar_url !== undefined ? profile.avatar_url : existing?.avatar_url || null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  await setDoc(userRef, payload, { merge: true });
  return payload;
}

export async function fsSearchUserByContact(
  queryStr: string,
  excludeUserId?: string
): Promise<PublicUserSearchResult | null> {
  if (!isFirebaseConfigured() || !db) return null;

  const cleanQuery = queryStr.trim().toLowerCase();
  if (!cleanQuery) return null;

  const isEmail = cleanQuery.includes('@');
  const normalizedQueryPhone = normalizePhoneNumber(cleanQuery);

  const usersCol = collection(db, 'users');
  const q = isEmail
    ? query(usersCol, where('email', '==', cleanQuery))
    : query(usersCol, where('phone', '==', normalizedQueryPhone));

  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    if (docSnap.id !== excludeUserId) {
      const data = docSnap.data() as Profile;
      return {
        id: data.id,
        full_name: data.full_name,
        avatar_url: data.avatar_url || null,
        masked_identifier: isEmail ? maskEmail(data.email) : maskPhone(data.phone),
      };
    }
  }

  return null;
}

// ==========================================
// 2. PERSONAL EXPENSES
// ==========================================

export async function fsGetExpenses(userId: string): Promise<Expense[]> {
  if (!isFirebaseConfigured() || !db) return [];

  const q = query(collection(db, 'expenses'), where('user_id', '==', userId));
  const snap = await getDocs(q);

  const list = snap.docs.map((d) => ({
    ...(d.data() as Expense),
    id: d.id,
    amount: parseMoney((d.data() as Expense).amount),
  }));

  // Sort descending by date, then creation time
  return list.sort((a, b) => {
    const dateCmp = new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
    if (dateCmp !== 0) return dateCmp;
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
  });
}

export async function fsCreateExpense(
  expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
): Promise<Expense> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const safeAmount = parseMoney(expenseData.amount);
  if (safeAmount <= 0) throw new Error('Expense amount must be greater than zero.');
  if (!expenseData.description.trim()) throw new Error('Description is required.');
  if (!expenseData.expense_date) throw new Error('Valid expense date is required.');

  const now = new Date().toISOString();
  const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newExpense: Expense = {
    id,
    user_id: expenseData.user_id,
    amount: safeAmount,
    category: expenseData.category,
    description: expenseData.description.trim(),
    expense_date: expenseData.expense_date,
    payment_method: expenseData.payment_method,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'expenses', id), newExpense);
  return newExpense;
}

export async function fsUpdateExpense(
  expenseId: string,
  userId: string,
  updates: Partial<Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Expense> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const safeAmount = updates.amount !== undefined ? parseMoney(updates.amount) : undefined;
  if (safeAmount !== undefined && safeAmount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }

  const expRef = doc(db, 'expenses', expenseId);
  const payload: Record<string, unknown> = { updated_at: now };
  if (safeAmount !== undefined) payload.amount = safeAmount;
  if (updates.category) payload.category = updates.category;
  if (updates.description) payload.description = updates.description.trim();
  if (updates.expense_date) payload.expense_date = updates.expense_date;
  if (updates.payment_method) payload.payment_method = updates.payment_method;

  await updateDoc(expRef, payload);
  const snap = await getDoc(expRef);
  const data = snap.data() as Expense;
  return { ...data, id: expenseId, amount: parseMoney(data.amount) };
}

export async function fsDeleteExpense(expenseId: string): Promise<void> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');
  await deleteDoc(doc(db, 'expenses', expenseId));
}

// ==========================================
// 3. SPLIT GROUPS & SUBCOLLECTIONS
// ==========================================

export async function fsGetMySplitGroups(userId: string): Promise<SplitGroupSummary[]> {
  if (!isFirebaseConfigured() || !db) return [];

  const groupsSnap = await getDocs(collection(db, 'split_groups'));
  const summaries: SplitGroupSummary[] = [];

  for (const gDoc of groupsSnap.docs) {
    const gData = gDoc.data() as SplitGroup;
    const membersSnap = await getDocs(collection(db, 'split_groups', gDoc.id, 'members'));
    const members = membersSnap.docs.map((m) => m.data() as SplitMember);

    const userMember = members.find((m) => m.user_id === userId);
    const isCreator = gData.created_by === userId;

    if (isCreator || userMember) {
      const userRole: 'owner' | 'member' = isCreator ? 'owner' : 'member';
      const userAmount = userMember ? userMember.amount : isCreator ? gData.total_amount : 0;

      summaries.push({
        ...gData,
        id: gDoc.id,
        total_amount: parseMoney(gData.total_amount),
        member_count: members.length,
        user_role: userRole,
        user_amount: parseMoney(userAmount),
      });
    }
  }

  return summaries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function fsGetSplitGroupDetails(
  groupId: string,
  userId: string
): Promise<{
  group: SplitGroup;
  members: SplitMember[];
  activity: SplitActivity[];
  expenses: GroupExpense[];
} | null> {
  if (!isFirebaseConfigured() || !db) return null;

  const gDoc = await getDoc(doc(db, 'split_groups', groupId));
  if (!gDoc.exists()) return null;

  const group = { ...(gDoc.data() as SplitGroup), id: gDoc.id };

  const [membersSnap, expensesSnap, activitiesSnap, profilesSnap] = await Promise.all([
    getDocs(collection(db, 'split_groups', groupId, 'members')),
    getDocs(collection(db, 'split_groups', groupId, 'expenses')),
    getDocs(collection(db, 'split_groups', groupId, 'activities')),
    getDocs(collection(db, 'users')),
  ]);

  const profilesMap = new Map<string, Profile>();
  profilesSnap.docs.forEach((p) => {
    profilesMap.set(p.id, p.data() as Profile);
  });

  const members: SplitMember[] = membersSnap.docs.map((d) => {
    const memData = d.data() as SplitMember;
    return {
      ...memData,
      id: d.id,
      amount: parseMoney(memData.amount),
      profile: profilesMap.get(memData.user_id),
    };
  });

  const expenses: GroupExpense[] = expensesSnap.docs.map((d) => {
    const expData = d.data() as GroupExpense;
    return {
      ...expData,
      id: d.id,
      amount: parseMoney(expData.amount),
      paid_by_profile: profilesMap.get(expData.paid_by_user_id),
      shares: (expData.shares || []).map((s) => ({
        ...s,
        amount: parseMoney(s.amount),
        profile: profilesMap.get(s.user_id),
      })),
    };
  });

  const activity: SplitActivity[] = activitiesSnap.docs.map((d) => {
    const actData = d.data() as SplitActivity;
    return {
      ...actData,
      id: d.id,
      actor: profilesMap.get(actData.actor_user_id),
      target: actData.target_user_id ? profilesMap.get(actData.target_user_id) : undefined,
    };
  });

  const calculatedTotal = expenses.length > 0
    ? parseMoney(expenses.reduce((sum, e) => sum + e.amount, 0))
    : parseMoney(group.total_amount);

  return {
    group: { ...group, total_amount: calculatedTotal },
    members,
    expenses: expenses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    activity: activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

export async function fsCreateSplitGroup(params: {
  name: string;
  totalAmount: number;
  currency: string;
  creatorId: string;
  creatorProfile: Profile;
  members: Array<{ userId: string; amount: number; profile?: Profile }>;
}): Promise<SplitGroup> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const safeTotal = parseMoney(params.totalAmount);

  const memberList = [...params.members];
  if (!memberList.some((m) => m.userId === params.creatorId)) {
    memberList.unshift({
      userId: params.creatorId,
      amount: safeTotal,
      profile: params.creatorProfile,
    });
  }

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

  await setDoc(doc(db, 'split_groups', groupId), {
    ...newGroup,
    member_uids: memberList.map((m) => m.userId),
  });

  // Add members
  for (const m of memberList) {
    const memId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMember: SplitMember = {
      id: memId,
      split_group_id: groupId,
      user_id: m.userId,
      amount: parseMoney(m.amount),
      joined_at: now,
      updated_at: now,
    };
    await setDoc(doc(db, 'split_groups', groupId, 'members', memId), newMember);
  }

  // Add activity
  const actId = `act_${Date.now()}_created`;
  const act: SplitActivity = {
    id: actId,
    split_group_id: groupId,
    actor_user_id: params.creatorId,
    action_type: 'create_group',
    old_value: null,
    new_value: safeTotal.toString(),
    description: `${params.creatorProfile.full_name} created "${params.name.trim()}" Total ₹${safeTotal.toLocaleString('en-IN')}`,
    created_at: now,
  };
  await setDoc(doc(db, 'split_groups', groupId, 'activities', actId), act);

  return newGroup;
}

export function fsSubscribeToGroupUpdates(
  groupId: string,
  callback: (event: { type: string; payload?: unknown }) => void
): () => void {
  if (!isFirebaseConfigured() || !db) return () => {};

  const unsubGroup = onSnapshot(doc(db, 'split_groups', groupId), (snap) => {
    if (snap.exists()) {
      callback({ type: 'GROUP_UPDATED', payload: snap.data() });
    }
  });

  const unsubMembers = onSnapshot(
    collection(db, 'split_groups', groupId, 'members'),
    () => callback({ type: 'MEMBERS_CHANGED' })
  );

  const unsubExpenses = onSnapshot(
    collection(db, 'split_groups', groupId, 'expenses'),
    () => callback({ type: 'EXPENSES_CHANGED' })
  );

  return () => {
    unsubGroup();
    unsubMembers();
    unsubExpenses();
  };
}
