/**
 * Rupxa Expense Detection & Payment Sources Service
 * Manages optional message-based expense detection and tokenized card connections.
 * Follows strict privacy constraints:
 * - Completely optional, disabled by default.
 * - Never silently reads messages; requires explicit user permission.
 * - Extracts only structured metadata (merchant, amount, date, category, source).
 * - Never stores raw card credentials, CVV, PIN, or OTP.
 * - Stores only safe card metadata (provider, card_name, last4, card_type, status).
 * - All detected expenses are suggestions only; user must manually approve them.
 */

import { SuggestedExpense, ConnectedCard, ExpenseSourceSettings, ExpenseCategory } from '../types';
import { parseMoney } from './formatters';

const STORAGE_KEYS = {
  SETTINGS: 'rupxa_expense_detection_settings_v1',
  CARDS: 'rupxa_connected_cards_v1',
  SUGGESTIONS: 'rupxa_suggested_expenses_v1',
};

export function getExpenseDetectionSettings(): ExpenseSourceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read expense detection settings:', e);
  }
  return {
    message_detection_enabled: false,
    cards_enabled: false,
  };
}

export function saveExpenseDetectionSettings(settings: Partial<ExpenseSourceSettings>): ExpenseSourceSettings {
  const current = getExpenseDetectionSettings();
  const updated: ExpenseSourceSettings = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save expense detection settings:', e);
  }
  return updated;
}

// ==========================================
// 1. CONNECTED CARDS (Safe metadata only)
// ==========================================

export function getConnectedCards(userId: string): ConnectedCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
    const list: ConnectedCard[] = raw ? JSON.parse(raw) : [];
    return list.filter((c) => c.user_id === userId);
  } catch (e) {
    console.error('Failed to load connected cards:', e);
    return [];
  }
}

export function addConnectedCard(params: {
  userId: string;
  provider: string;
  cardName: string;
  last4: string;
  cardType: 'credit' | 'debit';
}): ConnectedCard {
  const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
  const list: ConnectedCard[] = raw ? JSON.parse(raw) : [];

  // Sanitize last4: exactly 4 digits
  const cleanLast4 = params.last4.replace(/\D/g, '').slice(-4);
  if (cleanLast4.length !== 4) {
    throw new Error('Please enter valid 4 digits for the card identifier.');
  }

  const cleanName = params.cardName.trim() || `${params.provider} Card`;

  const newCard: ConnectedCard = {
    id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.userId,
    provider: params.provider.trim(),
    card_name: cleanName,
    last4: cleanLast4,
    card_type: params.cardType,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  list.push(newCard);
  localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(list));

  // Enable cards in settings if not already
  saveExpenseDetectionSettings({ cards_enabled: true });

  return newCard;
}

export function disconnectCard(userId: string, cardId: string): void {
  const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
  const list: ConnectedCard[] = raw ? JSON.parse(raw) : [];
  const updated = list.map((c) => {
    if (c.id === cardId && c.user_id === userId) {
      return { ...c, status: 'disconnected' as const };
    }
    return c;
  });
  localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(updated));
}

export function removeCard(userId: string, cardId: string): void {
  const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
  const list: ConnectedCard[] = raw ? JSON.parse(raw) : [];
  const filtered = list.filter((c) => !(c.id === cardId && c.user_id === userId));
  localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(filtered));
}

// ==========================================
// 2. SUGGESTED EXPENSES (Potential Expenses)
// ==========================================

export function getSuggestedExpenses(userId: string): SuggestedExpense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
    const list: SuggestedExpense[] = raw ? JSON.parse(raw) : [];
    return list.filter((s) => s.user_id === userId);
  } catch (e) {
    console.error('Failed to load suggested expenses:', e);
    return [];
  }
}

export function addSuggestedExpense(params: Omit<SuggestedExpense, 'id' | 'created_at'>): SuggestedExpense {
  const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
  const list: SuggestedExpense[] = raw ? JSON.parse(raw) : [];

  // Check duplicate provider reference if present
  if (params.provider_reference) {
    const exists = list.some(
      (s) => s.user_id === params.user_id && s.provider_reference === params.provider_reference
    );
    if (exists) {
      throw new Error('This transaction suggestion has already been received.');
    }
  }

  const newSuggestion: SuggestedExpense = {
    ...params,
    id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount: parseMoney(params.amount),
    created_at: new Date().toISOString(),
  };

  list.unshift(newSuggestion);
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(list));
  return newSuggestion;
}

export function dismissSuggestedExpense(userId: string, id: string): void {
  const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
  const list: SuggestedExpense[] = raw ? JSON.parse(raw) : [];
  const filtered = list.filter((s) => !(s.id === id && s.user_id === userId));
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(filtered));
}

export function dismissAllSuggestedExpenses(userId: string): void {
  const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
  const list: SuggestedExpense[] = raw ? JSON.parse(raw) : [];
  const filtered = list.filter((s) => s.user_id !== userId);
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(filtered));
}

// ==========================================
// 3. LOCAL PRIVACY-PRESERVING MESSAGE PARSER
// ==========================================

export function parseTransactionMessage(text: string, userId: string): SuggestedExpense | null {
  const clean = text.trim();
  if (!clean || clean.length < 10) return null;

  // Extract amount: e.g. "Rs. 450", "INR 850.50", "₹1,250", "spent Rs 300"
  const amountMatch = clean.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                      clean.match(/(?:spent|debited by|paid)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (!amountMatch) return null;

  const rawAmountStr = amountMatch[1].replace(/,/g, '');
  const parsedAmount = parseFloat(rawAmountStr);
  if (isNaN(parsedAmount) || parsedAmount <= 0) return null;

  // Extract merchant: e.g. "at Starbucks", "to Swiggy", "for Uber", "vpa merchant@okhdfcbank"
  let merchant = 'Merchant';
  const merchantMatch = clean.match(/(?:at|to|for|vpa)\s+([A-Za-z0-9\s&'-]{2,25}?)(?:\s+(?:on|via|ref|using|avl|card|bal|\.|\n|$))/i);
  if (merchantMatch && merchantMatch[1]) {
    merchant = merchantMatch[1].trim();
  }

  // Infer Category
  const lower = clean.toLowerCase();
  let category: ExpenseCategory = 'Other';
  if (/swiggy|zomato|starbucks|mcdonald|restaurant|cafe|food|eat|dinner|lunch|breakfast|bakery/i.test(lower)) {
    category = 'Food';
  } else if (/uber|ola|rapido|irctc|flight|metro|petrol|fuel|toll|parking|taxi|train/i.test(lower)) {
    category = 'Travel';
  } else if (/amazon|flipkart|myntra|zara|h&m|store|mall|supermarket|mart|grocer/i.test(lower)) {
    category = 'Shopping';
  } else if (/electricity|bescom|airtel|jio|vodafone|bill|recharge|broadband|water|gas|utility/i.test(lower)) {
    category = 'Bills';
  } else if (/netflix|spotify|cinema|pvr|inox|movie|game|entertainment|prime/i.test(lower)) {
    category = 'Entertainment';
  } else if (/pharmacy|hospital|apollo|medplus|doctor|health|clinic|lab/i.test(lower)) {
    category = 'Health';
  } else if (/school|college|udemy|coursera|book|tuition|fee|education/i.test(lower)) {
    category = 'Education';
  }

  const today = new Date().toISOString().split('T')[0];

  return {
    id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    merchant,
    amount: parseMoney(parsedAmount),
    date: today,
    category,
    source: 'Message',
    created_at: new Date().toISOString(),
  };
}
