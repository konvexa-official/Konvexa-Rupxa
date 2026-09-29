/**
 * Rupxa TypeScript Type Definitions
 */

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PublicUserSearchResult {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  masked_identifier: string; // e.g. rah***@gmail.com or 987***3210
}

export type ExpenseCategory =
  | 'Food'
  | 'Travel'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Education'
  | 'Other';

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Card'
  | 'Bank'
  | 'Other';

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  expense_date: string; // YYYY-MM-DD
  payment_method: PaymentMethod;
  created_at?: string;
  updated_at?: string;
}

export interface SplitGroup {
  id: string;
  name: string;
  created_by: string;
  total_amount: number;
  currency: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface SplitMember {
  id: string;
  split_group_id: string;
  user_id: string;
  amount: number;
  joined_at: string;
  updated_at: string;
  profile?: Profile;
}

export type SplitActionType =
  | 'create_group'
  | 'join_group'
  | 'add_member'
  | 'remove_member'
  | 'amount_change'
  | 'update_group'
  | 'leave_group'
  | 'add_expense'
  | 'edit_expense'
  | 'delete_expense';

export interface GroupExpenseShare {
  user_id: string;
  amount: number;
  profile?: Profile;
}

export interface GroupExpense {
  id: string;
  split_group_id: string;
  name: string;
  amount: number;
  category: string;
  paid_by_user_id: string;
  paid_by_profile?: Profile;
  split_type: 'equal' | 'custom';
  shares: GroupExpenseShare[];
  created_by: string;
  expense_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SplitActivity {
  id: string;
  split_group_id: string;
  actor_user_id: string;
  action_type: SplitActionType;
  target_user_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  description: string;
  created_at: string;
  actor?: Profile;
  target?: Profile;
}

export type ActiveTab = 'dashboard' | 'expenses' | 'splitter' | 'settings';

export interface SplitGroupSummary extends SplitGroup {
  member_count: number;
  user_role: 'owner' | 'member';
  user_amount: number;
}
