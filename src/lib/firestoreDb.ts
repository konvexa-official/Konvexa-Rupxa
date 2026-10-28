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
  SplitSettlement,
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
    upi_id: profile.upi_id !== undefined ? (profile.upi_id ? profile.upi_id.trim() : null) : existing?.upi_id || null,
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
    custom_category: expenseData.category === 'Other' && expenseData.custom_category ? expenseData.custom_category.trim() : null,
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
  if (updates.category !== undefined) {
    payload.category = updates.category;
    payload.custom_category = updates.category === 'Other' && updates.custom_category ? updates.custom_category.trim() : null;
  } else if (updates.custom_category !== undefined) {
    payload.custom_category = updates.custom_category ? updates.custom_category.trim() : null;
  }
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
    if (gData.status === 'deleted' || Boolean((gData as any).deleted_at)) continue;

    if (isCreator || userMember) {
      const userRole: 'owner' | 'member' = isCreator ? 'owner' : 'member';

      const expensesSnap = await getDocs(collection(db, 'split_groups', gDoc.id, 'expenses')).catch(() => ({ docs: [] }));
      const activeExpenses = expensesSnap.docs
        .map((d) => d.data() as GroupExpense)
        .filter((e) => !e.deleted_at);

      const calculatedTotal = activeExpenses.length > 0
        ? parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0))
        : parseMoney(gData.total_amount);

      const calculatedUserAmount = activeExpenses.length > 0
        ? parseMoney(
            activeExpenses.reduce((sum, e) => {
              const sh = e.shares?.find((s) => s.user_id === userId);
              return sum + (sh ? parseMoney(sh.amount) : 0);
            }, 0)
          )
        : userMember
        ? parseMoney(userMember.amount)
        : 0;

      summaries.push({
        ...gData,
        id: gDoc.id,
        total_amount: calculatedTotal,
        member_count: Math.max(members.length, 1),
        user_role: userRole,
        user_amount: calculatedUserAmount,
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
  settlements: SplitSettlement[];
  isDeleted?: boolean;
} | null> {
  if (!isFirebaseConfigured() || !db) return null;

  const cleanGroupId = decodeURIComponent((groupId || '').trim());
  if (!cleanGroupId) return null;

  let gDoc = await getDoc(doc(db, 'split_groups', cleanGroupId));
  if (!gDoc.exists()) {
    const allGroupsSnap = await getDocs(collection(db, 'split_groups')).catch(() => ({ docs: [] }));
    const foundDoc = allGroupsSnap.docs.find(
      (d) => d.id === cleanGroupId || d.id.toLowerCase() === cleanGroupId.toLowerCase()
    );
    if (foundDoc) {
      gDoc = foundDoc;
    } else {
      return null;
    }
  }

  const groupData = gDoc.data() as SplitGroup;
  const isDeleted = groupData.status === 'deleted' || Boolean((groupData as any).deleted_at);

  if (isDeleted) {
    return {
      group: { ...groupData, id: gDoc.id, status: 'deleted' },
      members: [],
      activity: [],
      expenses: [],
      settlements: [],
      isDeleted: true,
    };
  }

  const group = { ...groupData, id: gDoc.id };
  const targetGroupId = gDoc.id;

  const [membersSnap, expensesSnap, activitiesSnap, settlementsSnap, profilesSnap] = await Promise.all([
    getDocs(collection(db, 'split_groups', targetGroupId, 'members')).catch((err) => {
      console.warn('Could not read members for group:', err);
      return { docs: [] };
    }),
    getDocs(collection(db, 'split_groups', targetGroupId, 'expenses')).catch((err) => {
      console.warn('Could not read expenses for group:', err);
      return { docs: [] };
    }),
    getDocs(collection(db, 'split_groups', targetGroupId, 'activities')).catch((err) => {
      console.warn('Could not read activities for group:', err);
      return { docs: [] };
    }),
    getDocs(collection(db, 'split_groups', targetGroupId, 'settlements')).catch((err) => {
      console.warn('Could not read settlements for group:', err);
      return { docs: [] };
    }),
    getDocs(collection(db, 'users')).catch((err) => {
      console.warn('Could not read profiles for group:', err);
      return { docs: [] };
    }),
  ]);

  const profilesMap = new Map<string, Profile>();
  profilesSnap.docs.forEach((p) => {
    profilesMap.set(p.id, p.data() as Profile);
  });

  const members: SplitMember[] = membersSnap.docs.map((d) => {
    const memData = d.data() as SplitMember;
    const profile = profilesMap.get(memData.user_id) || memData.profile;
    return {
      ...memData,
      id: d.id,
      amount: parseMoney(memData.amount),
      profile,
    };
  });

  const expenses: GroupExpense[] = expensesSnap.docs
    .map((d) => {
      const expData = d.data() as GroupExpense;
      const paidByProfile = profilesMap.get(expData.paid_by_user_id) || expData.paid_by_profile;
      return {
        ...expData,
        id: d.id,
        amount: parseMoney(expData.amount),
        paid_by_profile: paidByProfile,
        shares: (expData.shares || []).map((s) => ({
          ...s,
          amount: parseMoney(s.amount),
          profile: profilesMap.get(s.user_id) || s.profile,
        })),
      };
    })
    .filter((e) => !e.deleted_at);

  const settlements: SplitSettlement[] = settlementsSnap.docs.map((d) => {
    const sData = d.data() as SplitSettlement;
    return {
      ...sData,
      id: d.id,
      amount: parseMoney(sData.amount),
      from_profile: profilesMap.get(sData.from_user_id) || sData.from_profile,
      to_profile: profilesMap.get(sData.to_user_id) || sData.to_profile,
    };
  });

  const activity: SplitActivity[] = activitiesSnap.docs.map((d) => {
    const actData = d.data() as SplitActivity;
    return {
      ...actData,
      id: d.id,
      actor: profilesMap.get(actData.actor_user_id) || actData.actor,
      target: actData.target_user_id ? (profilesMap.get(actData.target_user_id) || actData.target) : undefined,
    };
  });

  const calculatedTotal = expenses.length > 0
    ? parseMoney(expenses.reduce((sum, e) => sum + e.amount, 0))
    : parseMoney(group.total_amount);

  return {
    group: { ...group, total_amount: calculatedTotal },
    members,
    expenses: expenses.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    settlements: settlements.sort((a, b) => new Date(b.settled_at).getTime() - new Date(a.settled_at).getTime()),
    activity: activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

export async function fsRecordSettlement(params: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  paymentMethod: 'UPI' | 'Cash' | 'Bank' | 'Other';
  upiRefId?: string;
  note?: string;
}): Promise<string> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore not initialized');
  const now = new Date().toISOString();
  const settlementsCol = collection(db, 'split_groups', params.groupId, 'settlements');
  const docRef = doc(settlementsCol);

  const payload: SplitSettlement = {
    id: docRef.id,
    split_group_id: params.groupId,
    from_user_id: params.fromUserId,
    to_user_id: params.toUserId,
    amount: parseMoney(params.amount),
    payment_method: params.paymentMethod,
    upi_ref_id: params.upiRefId || '',
    note: params.note || '',
    settled_at: now,
  };

  await setDoc(docRef, payload);

  // Add activity log
  const activitiesCol = collection(db, 'split_groups', params.groupId, 'activities');
  const actRef = doc(activitiesCol);
  await setDoc(actRef, {
    id: actRef.id,
    split_group_id: params.groupId,
    actor_user_id: params.fromUserId,
    action_type: 'settle_debt',
    target_user_id: params.toUserId,
    description: `Settled ₹${parseMoney(params.amount)} via ${params.paymentMethod}${params.upiRefId ? ` (Ref: ${params.upiRefId})` : ''}`,
    created_at: now,
  });

  return docRef.id;
}

export async function fsCreateSplitGroup(params: {
  name: string;
  reference?: string | null;
  totalAmount: number;
  currency: string;
  creatorId: string;
  creatorProfile: Profile;
  splitType?: 'equal' | 'custom';
  members: Array<{ userId: string; amount: number; profile?: Profile }>;
}): Promise<SplitGroup> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

  const newGroup: SplitGroup = {
    id: groupId,
    name: cleanName,
    reference: cleanRef,
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
      ...(m.profile ? { profile: JSON.parse(JSON.stringify(m.profile)) } : {}),
    };
    await setDoc(doc(db, 'split_groups', groupId, 'members', memId), JSON.parse(JSON.stringify(newMember)));

    // Save profile to users collection if available so other queries find it
    if (m.profile) {
      try {
        const uDoc = await getDoc(doc(db, 'users', m.userId));
        if (!uDoc.exists()) {
          await setDoc(doc(db, 'users', m.userId), JSON.parse(JSON.stringify(m.profile)));
        }
      } catch (err) {
        console.warn('Could not sync user profile to users collection:', err);
      }
    }
  }

  // Create initial group expense if totalAmount > 0
  if (safeTotal > 0) {
    const expId = `gexp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const initialExpense: GroupExpense = {
      id: expId,
      split_group_id: groupId,
      name: cleanName,
      reference: cleanRef,
      amount: safeTotal,
      category: 'Other',
      paid_by_user_id: params.creatorId,
      paid_by_profile: JSON.parse(JSON.stringify(params.creatorProfile)),
      split_type: params.splitType || 'equal',
      shares: memberList.map((m) => ({
        user_id: m.userId,
        amount: parseMoney(m.amount),
        ...(m.profile ? { profile: JSON.parse(JSON.stringify(m.profile)) } : {}),
      })),
      created_by: params.creatorId,
      created_at: now,
      updated_at: now,
    };
    await setDoc(doc(db, 'split_groups', groupId, 'expenses', expId), JSON.parse(JSON.stringify(initialExpense)));
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
    description: `${params.creatorProfile.full_name} created "${cleanName}" Total ₹${safeTotal.toLocaleString('en-IN')}`,
    created_at: now,
  };
  await setDoc(doc(db, 'split_groups', groupId, 'activities', actId), act);

  return newGroup;
}

export async function fsAddGroupExpense(params: {
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
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const safeTotal = parseMoney(params.amount);
  const cleanRef = params.reference?.trim() ? params.reference.trim() : null;
  const cleanName = params.name?.trim() ? params.name.trim() : (cleanRef || `${params.category} Expense`);

  const cleanedShares = params.shares.map((s) => {
    const item: { user_id: string; amount: number; profile?: Profile } = {
      user_id: s.userId,
      amount: parseMoney(s.amount),
    };
    if (s.profile) {
      item.profile = JSON.parse(JSON.stringify(s.profile));
    }
    return item;
  });

  const cleanedActorProfile = JSON.parse(JSON.stringify(params.actorProfile));

  const expRef = doc(collection(db, 'split_groups', params.groupId, 'expenses'));
  const newExp: GroupExpense = {
    id: expRef.id,
    split_group_id: params.groupId,
    name: cleanName,
    reference: cleanRef,
    amount: safeTotal,
    category: params.category,
    paid_by_user_id: params.paidByUserId,
    paid_by_profile: cleanedActorProfile,
    split_type: params.splitType,
    shares: cleanedShares,
    created_by: params.actorProfile.id,
    created_at: now,
    updated_at: now,
  };

  await setDoc(expRef, JSON.parse(JSON.stringify(newExp)));

  // Recalculate group total
  const allExpSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'expenses'));
  const activeExpenses = allExpSnap.docs
    .map((d) => d.data() as GroupExpense)
    .filter((e) => !e.deleted_at);

  const newGroupTotal = parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0));
  await updateDoc(doc(db, 'split_groups', params.groupId), {
    total_amount: newGroupTotal,
    updated_at: now,
  });

  // Recalculate member shares
  const membersSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'members'));
  for (const mDoc of membersSnap.docs) {
    const memData = mDoc.data() as SplitMember;
    const memberTotal = parseMoney(
      activeExpenses.reduce((sum, e) => {
        const s = e.shares?.find((sh) => sh.user_id === memData.user_id);
        return sum + (s ? parseMoney(s.amount) : 0);
      }, 0)
    );
    await updateDoc(doc(db, 'split_groups', params.groupId, 'members', mDoc.id), {
      amount: memberTotal,
      updated_at: now,
    });
  }

  // Add activity log
  const actRef = doc(collection(db, 'split_groups', params.groupId, 'activities'));
  const actDesc = cleanRef
    ? `${params.actorProfile.full_name} added expense "${cleanRef}" (₹${safeTotal.toLocaleString('en-IN')})`
    : `${params.actorProfile.full_name} added expense (₹${safeTotal.toLocaleString('en-IN')})`;

  const act: SplitActivity = {
    id: actRef.id,
    split_group_id: params.groupId,
    actor_user_id: params.actorProfile.id,
    action_type: 'add_expense',
    old_value: null,
    new_value: safeTotal.toString(),
    description: actDesc,
    created_at: now,
    actor: params.actorProfile,
  };
  await setDoc(actRef, JSON.parse(JSON.stringify(act)));

  return newExp;
}

export async function fsUpdateGroupExpense(params: {
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
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const safeTotal = parseMoney(params.amount);

  const expRef = doc(db, 'split_groups', params.groupId, 'expenses', params.expenseId);
  const expSnap = await getDoc(expRef);
  if (!expSnap.exists()) throw new Error('Expense not found.');

  const oldExp = expSnap.data() as GroupExpense;
  const cleanRef = params.reference !== undefined
    ? (params.reference?.trim() ? params.reference.trim() : null)
    : (oldExp.reference || null);
  const cleanName = params.name?.trim()
    ? params.name.trim()
    : (cleanRef || oldExp.name || `${params.category} Expense`);
  const isReferenceChanged = (oldExp.reference || '').trim() !== (cleanRef || '').trim();
  const oldAmount = parseMoney(oldExp.amount);

  const cleanedShares = params.shares.map((s) => {
    const item: { user_id: string; amount: number; profile?: Profile } = {
      user_id: s.userId,
      amount: parseMoney(s.amount),
    };
    if (s.profile) {
      item.profile = JSON.parse(JSON.stringify(s.profile));
    }
    return item;
  });

  const cleanedActorProfile = JSON.parse(JSON.stringify(params.actorProfile));

  const updatedExp: GroupExpense = {
    ...oldExp,
    name: cleanName,
    reference: cleanRef,
    amount: safeTotal,
    category: params.category,
    paid_by_user_id: params.paidByUserId,
    paid_by_profile: cleanedActorProfile,
    split_type: params.splitType,
    shares: cleanedShares,
    updated_at: now,
  };

  await setDoc(expRef, JSON.parse(JSON.stringify(updatedExp)), { merge: true });

  // Recalculate group total
  const allExpSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'expenses'));
  const activeExpenses = allExpSnap.docs
    .map((d) => d.data() as GroupExpense)
    .filter((e) => !e.deleted_at);

  const newGroupTotal = parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0));
  await updateDoc(doc(db, 'split_groups', params.groupId), {
    total_amount: newGroupTotal,
    updated_at: now,
  });

  // Recalculate member shares
  const membersSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'members'));
  for (const mDoc of membersSnap.docs) {
    const memData = mDoc.data() as SplitMember;
    const memberTotal = parseMoney(
      activeExpenses.reduce((sum, e) => {
        const s = e.shares?.find((sh) => sh.user_id === memData.user_id);
        return sum + (s ? parseMoney(s.amount) : 0);
      }, 0)
    );
    await updateDoc(doc(db, 'split_groups', params.groupId, 'members', mDoc.id), {
      amount: memberTotal,
      updated_at: now,
    });
  }

  // Create activity record
  const actRef = doc(collection(db, 'split_groups', params.groupId, 'activities'));
  const act: SplitActivity = isReferenceChanged
    ? {
        id: actRef.id,
        split_group_id: params.groupId,
        actor_user_id: params.actorProfile.id,
        action_type: 'edit_expense_reference',
        old_value: (oldExp.reference || '').trim(),
        new_value: (cleanRef || '').trim(),
        description: `${params.actorProfile.full_name} changed reference`,
        created_at: now,
        actor: params.actorProfile,
      }
    : {
        id: actRef.id,
        split_group_id: params.groupId,
        actor_user_id: params.actorProfile.id,
        action_type: 'edit_expense',
        old_value: oldAmount.toString(),
        new_value: safeTotal.toString(),
        description: `${params.actorProfile.full_name} updated expense "${cleanName}"`,
        created_at: now,
        actor: params.actorProfile,
      };

  await setDoc(actRef, JSON.parse(JSON.stringify(act)));

  return updatedExp;
}

export async function fsUpdateSplitGroup(params: {
  groupId: string;
  name?: string;
  reference?: string | null;
  totalAmount?: number;
  actorId: string;
  actorProfile: Profile;
}): Promise<SplitGroup> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const groupRef = doc(db, 'split_groups', params.groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error('Split group not found.');

  const oldData = snap.data() as SplitGroup;
  const updates: Partial<SplitGroup> = {
    updated_at: now,
  };
  if (params.name !== undefined) updates.name = params.name.trim();
  if (params.reference !== undefined) updates.reference = params.reference?.trim() || null;
  if (params.totalAmount !== undefined) updates.total_amount = parseMoney(params.totalAmount);

  await updateDoc(groupRef, updates);

  // If there is only 1 expense (the initial split), keep it in sync with group details
  const expensesSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'expenses'));
  const activeExpenses = expensesSnap.docs
    .map((d) => ({ ...(d.data() as GroupExpense), id: d.id }))
    .filter((e) => !e.deleted_at);

  if (activeExpenses.length === 1) {
    const singleExp = activeExpenses[0];
    const expUpdates: Partial<GroupExpense> = {
      updated_at: now,
    };
    if (updates.name !== undefined) expUpdates.name = updates.name;
    if (updates.reference !== undefined) expUpdates.reference = updates.reference;

    if (params.totalAmount !== undefined) {
      const newTotal = parseMoney(params.totalAmount);
      const membersSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'members'));
      const memberCount = Math.max(membersSnap.docs.length, 1);
      const perPerson = Math.floor((newTotal / memberCount) * 100) / 100;
      const remainder = parseMoney(newTotal - perPerson * memberCount);

      const updatedShares = membersSnap.docs.map((mDoc, idx) => {
        const m = mDoc.data() as SplitMember;
        const shAmt = idx === 0 ? parseMoney(perPerson + remainder) : perPerson;
        return {
          user_id: m.user_id,
          amount: shAmt,
          profile: m.profile,
        };
      });

      expUpdates.amount = newTotal;
      expUpdates.shares = JSON.parse(JSON.stringify(updatedShares));

      for (const sh of updatedShares) {
        const mDoc = membersSnap.docs.find((d) => (d.data() as SplitMember).user_id === sh.user_id);
        if (mDoc) {
          await updateDoc(doc(db, 'split_groups', params.groupId, 'members', mDoc.id), {
            amount: sh.amount,
            updated_at: now,
          });
        }
      }
    }

    await updateDoc(doc(db, 'split_groups', params.groupId, 'expenses', singleExp.id), expUpdates);
  }

  // Activity log
  const actRef = doc(collection(db, 'split_groups', params.groupId, 'activities'));
  const act: SplitActivity = {
    id: actRef.id,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'update_group',
    old_value: oldData.total_amount?.toString() || null,
    new_value: updates.total_amount ? updates.total_amount.toString() : null,
    description: `${params.actorProfile.full_name} updated split details`,
    created_at: now,
    actor: params.actorProfile,
  };
  await setDoc(actRef, JSON.parse(JSON.stringify(act)));

  return { ...oldData, ...updates, id: params.groupId };
}

export async function fsUpdateMemberAmount(params: {
  groupId: string;
  targetUserId: string;
  newAmount: number;
  actorId: string;
  actorProfile: Profile;
  targetProfile?: Profile;
}): Promise<void> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const safeAmount = parseMoney(params.newAmount);

  const membersSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'members'));
  const memberDoc = membersSnap.docs.find((d) => (d.data() as SplitMember).user_id === params.targetUserId);
  if (!memberDoc) throw new Error('Member not found in this group.');

  const oldAmount = parseMoney((memberDoc.data() as SplitMember).amount || 0);

  await updateDoc(doc(db, 'split_groups', params.groupId, 'members', memberDoc.id), {
    amount: safeAmount,
    updated_at: now,
  });

  // If there is only 1 expense (the initial split), update that member's share in it
  const expensesSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'expenses'));
  const activeExpenses = expensesSnap.docs
    .map((d) => ({ ...(d.data() as GroupExpense), id: d.id }))
    .filter((e) => !e.deleted_at);

  if (activeExpenses.length === 1) {
    const singleExp = activeExpenses[0];
    const shares = [...(singleExp.shares || [])];
    const shIdx = shares.findIndex((s) => s.user_id === params.targetUserId);
    if (shIdx !== -1) {
      shares[shIdx] = { ...shares[shIdx], amount: safeAmount };
    } else {
      shares.push({
        user_id: params.targetUserId,
        amount: safeAmount,
        ...(params.targetProfile ? { profile: JSON.parse(JSON.stringify(params.targetProfile)) } : {}),
      });
    }
    await updateDoc(doc(db, 'split_groups', params.groupId, 'expenses', singleExp.id), {
      shares: JSON.parse(JSON.stringify(shares)),
      updated_at: now,
    });
  }

  const targetName = params.targetProfile?.full_name || 'Member';
  const actRef = doc(collection(db, 'split_groups', params.groupId, 'activities'));
  const act: SplitActivity = {
    id: actRef.id,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    target_user_id: params.targetUserId,
    action_type: 'amount_change',
    old_value: oldAmount.toString(),
    new_value: safeAmount.toString(),
    description: `${params.actorProfile.full_name} updated share for ${targetName}`,
    created_at: now,
    actor: params.actorProfile,
  };
  await setDoc(actRef, JSON.parse(JSON.stringify(act)));
}

export async function fsDeleteGroupExpense(params: {
  expenseId: string;
  groupId: string;
  actorId: string;
  actorProfile: Profile;
  reason: string;
  note?: string;
}): Promise<void> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const expRef = doc(db, 'split_groups', params.groupId, 'expenses', params.expenseId);
  const expSnap = await getDoc(expRef);
  if (!expSnap.exists()) throw new Error('Expense not found.');

  const expData = expSnap.data() as GroupExpense;
  const oldName = expData.name;
  const oldAmount = parseMoney(expData.amount);

  // Soft delete: update with deleted_at, deleted_by, deletion_reason, deletion_note
  await updateDoc(expRef, {
    deleted_at: now,
    deleted_by: params.actorId,
    deletion_reason: params.reason,
    deletion_note: params.note?.trim() || null,
    updated_at: now,
  });

  // Fetch all active expenses to recalculate group totals and member shares
  const allExpSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'expenses'));
  const activeExpenses = allExpSnap.docs
    .map((d) => d.data() as GroupExpense)
    .filter((e) => !e.deleted_at);

  const newGroupTotal = parseMoney(activeExpenses.reduce((sum, e) => sum + parseMoney(e.amount), 0));
  await updateDoc(doc(db, 'split_groups', params.groupId), {
    total_amount: newGroupTotal,
    updated_at: now,
  });

  // Recalculate member shares
  const membersSnap = await getDocs(collection(db, 'split_groups', params.groupId, 'members'));
  for (const mDoc of membersSnap.docs) {
    const memData = mDoc.data() as SplitMember;
    const memberTotal = parseMoney(
      activeExpenses.reduce((sum, e) => {
        const s = e.shares?.find((sh) => sh.user_id === memData.user_id);
        return sum + (s ? parseMoney(s.amount) : 0);
      }, 0)
    );
    await updateDoc(doc(db, 'split_groups', params.groupId, 'members', mDoc.id), {
      amount: memberTotal,
      updated_at: now,
    });
  }

  // Create immutable activity record
  const actId = `act_${Date.now()}_deleted`;
  const act: SplitActivity = {
    id: actId,
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
    old_category: expData.category,
    old_paid_by: expData.paid_by_user_id,
    deletion_reason: params.reason,
    deletion_note: params.note?.trim() || null,
  };
  await setDoc(doc(db, 'split_groups', params.groupId, 'activities', actId), act);
}

export async function fsDeleteSplitGroup(params: {
  groupId: string;
  actorId: string;
  actorProfile: Profile;
}): Promise<void> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const groupRef = doc(db, 'split_groups', params.groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error('Split group not found.');

  const groupData = snap.data() as SplitGroup;
  if (groupData.created_by !== params.actorId) {
    throw new Error('Permission denied: Only the group owner can delete this group.');
  }

  // Soft delete group doc so that audit history is preserved and group routes handle cleanly
  await updateDoc(groupRef, {
    status: 'deleted',
    deleted_at: now,
    deleted_by: params.actorId,
    updated_at: now,
  });

  // Immutable activity record
  const actId = `act_${Date.now()}_grp_deleted`;
  const act: SplitActivity = {
    id: actId,
    split_group_id: params.groupId,
    actor_user_id: params.actorId,
    action_type: 'delete_group',
    old_value: groupData.name,
    new_value: 'deleted',
    description: `${params.actorProfile.full_name} deleted group "${groupData.name}"`,
    created_at: now,
    actor: params.actorProfile,
  };
  await setDoc(doc(db, 'split_groups', params.groupId, 'activities', actId), act);
}

export function fsSubscribeToGroupUpdates(
  groupId: string,
  callback: (event: { type: string; payload?: unknown }) => void
): () => void {
  if (!isFirebaseConfigured() || !db) return () => {};

  const unsubGroup = onSnapshot(doc(db, 'split_groups', groupId), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data?.status === 'deleted' || data?.deleted_at) {
        callback({ type: 'GROUP_DELETED', payload: data });
      } else {
        callback({ type: 'GROUP_UPDATED', payload: data });
      }
    } else {
      callback({ type: 'GROUP_DELETED' });
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

  const unsubActivities = onSnapshot(
    collection(db, 'split_groups', groupId, 'activities'),
    () => callback({ type: 'ACTIVITY_CHANGED' })
  );

  return () => {
    unsubGroup();
    unsubMembers();
    unsubExpenses();
    unsubActivities();
  };
}

// ==========================================
// 4. MONTHLY CATEGORY BUDGETS
// ==========================================

export async function fsGetBudgets(userId: string): Promise<Record<string, number>> {
  if (!isFirebaseConfigured() || !db) return {};

  try {
    const q = query(collection(db, 'budgets'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    const budgets: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.category && typeof data.limit_amount === 'number') {
        budgets[data.category] = parseMoney(data.limit_amount);
      }
    });
    return budgets;
  } catch (err) {
    console.error('Error fetching budgets from Firestore:', err);
    return {};
  }
}

export async function fsSetAllBudgets(
  userId: string,
  budgets: Record<string, number>
): Promise<void> {
  if (!isFirebaseConfigured() || !db) throw new Error('Firestore is not configured.');

  const now = new Date().toISOString();
  const promises: Promise<void>[] = [];

  for (const [category, amount] of Object.entries(budgets)) {
    const id = `${userId}_${category}`;
    const safeAmount = parseMoney(amount);
    const ref = doc(db, 'budgets', id);

    if (safeAmount > 0) {
      promises.push(
        setDoc(ref, {
          id,
          user_id: userId,
          category,
          limit_amount: safeAmount,
          period: 'monthly',
          updated_at: now,
        })
      );
    } else {
      // Clear zero budget document
      promises.push(deleteDoc(ref).catch(() => {}));
    }
  }

  await Promise.all(promises);
}
