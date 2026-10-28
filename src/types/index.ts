/**
 * Rupxa TypeScript Type Definitions
 */

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url?: string | null;
  upi_id?: string | null;
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
  custom_category?: string | null;
  description: string;
  expense_date: string; // YYYY-MM-DD
  payment_method: PaymentMethod;
  created_at?: string;
  updated_at?: string;
  source?: 'Manual' | 'Message' | 'Card';
}

export interface SplitGroup {
  id: string;
  name: string;
  reference?: string | null;
  created_by: string;
  total_amount: number;
  currency: string;
  status: 'active' | 'archived' | 'deleted';
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  | 'delete_group'
  | 'leave_group'
  | 'add_expense'
  | 'edit_expense'
  | 'edit_expense_reference'
  | 'delete_expense'
  | 'EXPENSE_DELETED'
  | 'settle_debt';

export interface SplitSettlement {
  id: string;
  split_group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  payment_method: 'UPI' | 'Cash' | 'Bank' | 'Other';
  upi_ref_id?: string;
  note?: string;
  settled_at: string;
  from_profile?: Profile;
  to_profile?: Profile;
}

export interface GroupExpenseShare {
  user_id: string;
  amount: number;
  profile?: Profile;
}

export interface GroupExpense {
  id: string;
  split_group_id: string;
  name: string;
  reference?: string | null;
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
  // Soft delete fields
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
  deletion_note?: string | null;
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
  // Audit details for expense deletion
  expense_id?: string | null;
  expense_name?: string | null;
  old_amount?: number | null;
  old_category?: string | null;
  old_paid_by?: string | null;
  deletion_reason?: string | null;
  deletion_note?: string | null;
}

export type ActiveTab = 'dashboard' | 'expenses' | 'splitter' | 'notes' | 'settings';

export interface SplitGroupSummary extends SplitGroup {
  member_count: number;
  user_role: 'owner' | 'member';
  user_amount: number;
}

export interface CategoryBudget {
  id: string; // `${userId}_${category}`
  user_id: string;
  category: ExpenseCategory;
  limit_amount: number;
  period?: 'monthly';
  created_at?: string;
  updated_at?: string;
}

export interface BudgetStatus {
  category: ExpenseCategory;
  limit_amount: number;
  spent_amount: number;
  remaining_amount: number;
  percentage: number;
  is_exceeded: boolean;
  exceeded_by: number;
  is_near_limit: boolean;
}

// ==========================================
// OPTIONAL EXPENSE SOURCES & SUGGESTIONS
// ==========================================

export type SuggestedExpenseSource = 'Message' | 'Card';

export interface SuggestedExpense {
  id: string;
  user_id: string;
  merchant: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  source: SuggestedExpenseSource;
  provider_reference?: string;
  created_at: string;
}

export interface ConnectedCard {
  id: string;
  user_id: string;
  provider: string; // e.g. "HDFC Bank", "ICICI Bank", "SBI", "Visa", "Mastercard"
  card_name: string; // e.g. "Dining Platinum", "Fuel Credit"
  last4: string; // e.g. "4821"
  card_type: 'credit' | 'debit';
  status: 'active' | 'disconnected';
  created_at: string;
}

export type TransactionType = 'Expense' | 'Income' | 'Refund' | 'Transfer';

export type DetectionStatus = 'recorded' | 'review_needed' | 'duplicate' | 'ignored';

export interface ParsedTransaction {
  amount: number;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  merchant: string;
  payment_method: PaymentMethod;
  account_last4?: string;
  reference_id?: string;
  source_type: string; // e.g. "HDFC Bank SMS", "UPI (Google Pay)", "Card Alert"
  category: ExpenseCategory;
  confidence: 'high' | 'medium' | 'low';
  fingerprint: string;
  is_financial: boolean;
  ignore_reason?: string;
}

export interface DetectionHistoryItem {
  id: string;
  user_id: string;
  timestamp: string; // ISO
  raw_snippet: string; // Sanitized preview
  parsed?: ParsedTransaction;
  status: DetectionStatus;
  status_reason?: string;
  expense_id?: string; // Reference to created Expense.id
  updated_at?: string;
}

export interface ExpenseSourceSettings {
  message_detection_enabled: boolean;
  auto_record: boolean;
  cards_enabled: boolean;
  last_import_at?: string;
  total_detected_count?: number;
  duplicate_prevention_enabled: boolean;
}

// ==========================================
// NOTES FEATURE TYPES
// ==========================================

export type NoteType = 'text' | 'checklist';
export type NoteStatus = 'active' | 'archived' | 'trashed';

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
  position: number;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: NoteType;
  checklistItems: ChecklistItem[];
  isPinned: boolean;
  isFavorite: boolean;
  isFinanceNote: boolean;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: number;
  version: number;
}

export type NoteNavFilter =
  | 'all'
  | 'pinned'
  | 'favorites'
  | 'checklists'
  | 'finance'
  | 'archived'
  | 'trash';

export type NoteSortOption = 'updated_desc' | 'created_desc' | 'title_asc';

export interface ConflictedNoteState {
  noteId: string;
  localNote: Note;
  serverNote: Note;
  baseVersion: number;
}

