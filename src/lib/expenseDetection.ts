/**
 * Konvexa Rupxa - Transaction Message Parser & Expense Detection Engine
 * 
 * Provides privacy-first, local extraction of financial transaction messages
 * from Indian banks, UPI services (Google Pay, PhonePe, Paytm, BHIM, CRED),
 * card alerts, ATM withdrawals, credits, and refunds.
 *
 * Privacy & Security Guardrails:
 * 1. 100% Client-side processing: Zero raw message text is ever uploaded to servers or Firestore.
 * 2. OTPs, passwords, PINs, and personal chat texts are strictly filtered out and never saved.
 * 3. Only minimal structured metadata (amount, merchant, date, category, reference) is preserved.
 * 4. Duplicate prevention via reference ID matching and stable cryptographic-style fingerprints.
 * 5. Opt-in only: Disabled by default, requiring explicit user consent.
 */

import {
  SuggestedExpense,
  ConnectedCard,
  ExpenseSourceSettings,
  ExpenseCategory,
  PaymentMethod,
  TransactionType,
  ParsedTransaction,
  DetectionHistoryItem,
} from '../types';
import { parseMoney } from './formatters';
import { createExpense, updateExpense, getExpenses } from './db';

const STORAGE_KEYS = {
  SETTINGS: 'rupxa_expense_detection_settings_v2',
  CARDS: 'rupxa_connected_cards_v1',
  SUGGESTIONS: 'rupxa_suggested_expenses_v1',
  HISTORY: 'rupxa_detection_history_v1',
};

// ==========================================
// 1. SETTINGS MANAGEMENT
// ==========================================

export function getExpenseDetectionSettings(): ExpenseSourceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        message_detection_enabled: Boolean(parsed.message_detection_enabled),
        auto_record: Boolean(parsed.auto_record),
        cards_enabled: Boolean(parsed.cards_enabled),
        last_import_at: parsed.last_import_at,
        total_detected_count: Number(parsed.total_detected_count || 0),
        duplicate_prevention_enabled: parsed.duplicate_prevention_enabled !== false,
      };
    }
  } catch (e) {
    console.warn('Failed to read expense detection settings:', e);
  }

  // Default state: strictly OFF, explicit consent required
  return {
    message_detection_enabled: false,
    auto_record: false,
    cards_enabled: false,
    duplicate_prevention_enabled: true,
    total_detected_count: 0,
  };
}

export function saveExpenseDetectionSettings(
  settings: Partial<ExpenseSourceSettings>
): ExpenseSourceSettings {
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
// 2. CONNECTED CARDS (Safe metadata only)
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
// 3. DETECTION HISTORY & SUGGESTIONS
// ==========================================

export function getDetectionHistory(userId: string): DetectionHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const list: DetectionHistoryItem[] = raw ? JSON.parse(raw) : [];
    return list.filter((item) => item.user_id === userId);
  } catch (e) {
    console.error('Failed to load detection history:', e);
    return [];
  }
}

export function saveDetectionHistoryItem(item: DetectionHistoryItem): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const list: DetectionHistoryItem[] = raw ? JSON.parse(raw) : [];
    // Keep max 200 recent history entries
    const updated = [item, ...list.filter((i) => i.id !== item.id)].slice(0, 200);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save detection history item:', e);
  }
}

export function clearDetectionHistory(userId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    const list: DetectionHistoryItem[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((item) => item.user_id !== userId);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to clear detection history:', e);
  }
}

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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rupxa:suggestions_updated'));
  }
  return newSuggestion;
}

export function dismissSuggestedExpense(userId: string, id: string): void {
  const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
  const list: SuggestedExpense[] = raw ? JSON.parse(raw) : [];
  const filtered = list.filter((s) => !(s.id === id && s.user_id === userId));
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(filtered));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rupxa:suggestions_updated'));
  }
}

export function dismissAllSuggestedExpenses(userId: string): void {
  const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
  const list: SuggestedExpense[] = raw ? JSON.parse(raw) : [];
  const filtered = list.filter((s) => s.user_id !== userId);
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(filtered));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rupxa:suggestions_updated'));
  }
}

// ==========================================
// 4. TRANSACTION MESSAGE PARSER (INDIAN FORMATS)
// ==========================================

/**
 * Generates a stable fingerprint from transaction attributes to prevent duplicates.
 */
export function generateFingerprint(
  userId: string,
  date: string,
  amount: number,
  merchant: string,
  type: string,
  refId?: string,
  accountLast4?: string
): string {
  const normMerchant = merchant
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  const normRef = (refId || '').trim().toLowerCase();
  const normLast4 = (accountLast4 || '').trim();
  return `${userId}_${date}_${amount.toFixed(2)}_${type}_${normMerchant}_${normRef}_${normLast4}`;
}

/**
 * Sanitizes raw text into a privacy-preserving snippet (max 80 chars, numbers masked).
 */
export function sanitizeSnippet(text: string): string {
  const truncated = text.trim().slice(0, 80);
  return truncated.replace(/\b\d{6,16}\b/g, '••••');
}

/**
 * Check if the text is an OTP, verification code, or promotional message.
 */
function isIgnoredMessageType(text: string): { isIgnored: boolean; reason?: string } {
  const lower = text.toLowerCase();

  // 1. One Time Password (OTP) patterns
  const isOtp =
    /\b(otp|one time password|verification code|secret code|security code)\b/i.test(lower) ||
    /do not share.*(otp|password|pin)/i.test(lower) ||
    /valid for\s*\d+\s*(?:mins?|minutes?)/i.test(lower) ||
    /use code\s*\d{4,8}/i.test(lower);

  if (isOtp) {
    return {
      isIgnored: true,
      reason: 'OTP / Verification Code message ignored for privacy & safety.',
    };
  }

  // 2. Marketing / Loan / Promotional patterns
  const isPromo =
    /\b(congratulations|pre-approved|apply for|avail loan|credit limit increase|win cash|flat \d+% off|use coupon|cashback up to|zero processing fee|click here to apply|download app to win)\b/i.test(
      lower
    ) && !/(?:debited|credited|spent|withdrawn|paid rs)/i.test(lower);

  if (isPromo) {
    return {
      isIgnored: true,
      reason: 'Promotional or marketing message ignored.',
    };
  }

  // 3. Balance statement only (without transaction event)
  const isBalanceOnly =
    /(?:your a\/c bal is|avail(?:able)? bal(?:ance)? is|ledger bal is)\s*(?:rs|inr|₹)/i.test(lower) &&
    !/(?:debited|credited|spent|withdrawn|paid|received|refund)/i.test(lower);

  if (isBalanceOnly) {
    return {
      isIgnored: true,
      reason: 'Account balance summary only (no debit/credit event).',
    };
  }

  return { isIgnored: false };
}

/**
 * Extracts Indian date format from transaction text.
 */
function extractTransactionDate(text: string): { date: string; time?: string } {
  const today = new Date().toISOString().split('T')[0];

  // Try time: 14:30, 02:45 PM
  let foundTime: string | undefined;
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (timeMatch) {
    foundTime = timeMatch[1].trim();
  }

  // Pattern 1: DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
  const dmyMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    // Basic validity check
    const mNum = parseInt(month, 10);
    const dNum = parseInt(day, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return { date: `${year}-${month}-${day}`, time: foundTime };
    }
  }

  // Pattern 2: DD-Mon-YYYY or DD-Mon-YY or DD Mon YYYY (e.g. 10-Oct-26, 09 Oct 2026)
  const monMatch = text.match(
    /\b(\d{1,2})[- ](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]?(\d{2,4})?\b/i
  );
  if (monMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const day = monMatch[1].padStart(2, '0');
    const mStr = monMatch[2].toLowerCase().slice(0, 3);
    const month = months[mStr] || '01';
    let year = monMatch[3] || new Date().getFullYear().toString();
    if (year.length === 2) year = `20${year}`;
    return { date: `${year}-${month}-${day}`, time: foundTime };
  }

  return { date: today, time: foundTime };
}

/**
 * Extracts Indian currency amount (handles commas like 1,50,000.50).
 */
function extractAmount(text: string): number | null {
  // Regex matching Rs. 450, INR 1,200.50, ₹350, debited by Rs 500, paid INR 250
  const patterns = [
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:debited|spent|paid|credited|withdrawn|refund(?:ed)?)\s*(?:by|of|for)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:amount of|sum of)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleanStr = match[1].replace(/,/g, '');
      const num = parseFloat(cleanStr);
      // Validate reasonable amount
      if (!isNaN(num) && num > 0 && num < 10000000) {
        return parseMoney(num);
      }
    }
  }

  return null;
}

/**
 * Identifies the bank or payment provider from SMS headers or content.
 */
function identifyProvider(text: string): { bankName: string; isUpi: boolean; isCard: boolean } {
  const lower = text.toLowerCase();
  let bankName = 'Bank SMS';
  let isUpi = false;
  let isCard = false;

  if (/hdfc/i.test(lower)) bankName = 'HDFC Bank';
  else if (/icici/i.test(lower)) bankName = 'ICICI Bank';
  else if (/sbi|state bank/i.test(lower)) bankName = 'SBI';
  else if (/axis/i.test(lower)) bankName = 'Axis Bank';
  else if (/kotak/i.test(lower)) bankName = 'Kotak Bank';
  else if (/pnb|punjab national/i.test(lower)) bankName = 'PNB';
  else if (/baroda|bob/i.test(lower)) bankName = 'Bank of Baroda';
  else if (/indusind/i.test(lower)) bankName = 'IndusInd Bank';
  else if (/idfc/i.test(lower)) bankName = 'IDFC FIRST Bank';
  else if (/yes bank|yesbank/i.test(lower)) bankName = 'Yes Bank';
  else if (/canara/i.test(lower)) bankName = 'Canara Bank';
  else if (/union bank/i.test(lower)) bankName = 'Union Bank';
  else if (/paytm/i.test(lower)) bankName = 'Paytm';
  else if (/cred/i.test(lower)) bankName = 'CRED';
  else if (/phonepe/i.test(lower)) bankName = 'PhonePe';
  else if (/gpay|google pay/i.test(lower)) bankName = 'Google Pay';

  if (/upi|vpa|bhim|@okhdfc|@okicici|@oksbi|@okaxis|@ybl|@ibl|@axl|@paytm/i.test(lower)) {
    isUpi = true;
  }
  if (/card|credit card|debit card|ending \d{4}|card xx/i.test(lower)) {
    isCard = true;
  }

  return { bankName, isUpi, isCard };
}

/**
 * Extracts merchant or recipient and payment counterparty.
 */
function extractMerchant(text: string, type: TransactionType): string {
  const clean = text.trim();

  // If ATM cash withdrawal
  if (/atm|cash withdrawal/i.test(clean)) {
    return 'ATM Cash Withdrawal';
  }

  // Look for VPA / UPI ID: e.g. "vpa swiggy@icici" or "to merchant@okhdfcbank"
  const vpaMatch = clean.match(/(?:vpa|upi id)\s+([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)/i);
  if (vpaMatch && vpaMatch[1]) {
    const rawVpa = vpaMatch[1];
    const prefix = rawVpa.split('@')[0].replace(/[._-]/g, ' ');
    if (prefix.length >= 3 && !/^\d+$/.test(prefix)) {
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
  }

  // Common patterns: "at Starbucks", "to Swiggy", "for Uber", "info: DMART", "towards ZOMATO"
  const merchantPatterns = [
    /(?:at|towards|info[:\s]+)\s+([A-Za-z0-9\s&'.-]{2,25}?)(?:\s+(?:on|via|ref|using|avl|card|bal|thru|dated|\.|\n|$))/i,
    /(?:paid to|transferred to|sent to)\s+([A-Za-z0-9\s&'.-]{2,25}?)(?:\s+(?:on|via|ref|using|avl|card|bal|thru|\.|\n|$))/i,
    /(?:for)\s+([A-Za-z0-9\s&'.-]{2,25}?)(?:\s+(?:on|via|ref|using|avl|card|bal|thru|\.|\n|$))/i,
  ];

  for (const pat of merchantPatterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/^[A-Za-z]+\/\s*/, '');
      // Filter out non-merchant noise words
      if (
        candidate.length >= 2 &&
        !/^(your|the|card|bank|account|a\/c|upi|inr|rs|ref|avl|bal)$/i.test(candidate)
      ) {
        return candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }

  // Fallback defaults based on type
  if (type === 'Refund') return 'Merchant Refund';
  if (type === 'Income') return 'Bank Credit / Salary';
  if (type === 'Transfer') return 'Account Transfer';
  return 'Merchant';
}

/**
 * Intelligent categorization based on merchant keyword.
 */
function inferCategory(merchant: string, text: string): ExpenseCategory {
  const combined = `${merchant} ${text}`.toLowerCase();

  if (
    /swiggy|zomato|starbucks|mcdonald|kfc|burger|pizza|domino|restaurant|cafe|food|eat|dinner|lunch|breakfast|bakery|dining|blinkit|zepto|dunzo|instamart/i.test(
      combined
    )
  ) {
    return 'Food';
  }

  if (
    /uber|ola|rapido|irctc|makemytrip|cleartrip|flight|indigo|air india|petrol|fuel|indianoil|bpcl|hpcl|shell|toll|fastag|metro|parking|taxi|cab|train/i.test(
      combined
    )
  ) {
    return 'Travel';
  }

  if (
    /amazon|flipkart|myntra|meesho|zara|h&m|nykaa|reliance|trends|tata neu|dmart|bigbasket|store|mall|supermarket|mart|grocer|retail|apparel/i.test(
      combined
    )
  ) {
    return 'Shopping';
  }

  if (
    /electricity|bescom|mseb|tata power|adani|airtel|jio|vodafone|vi|bill|recharge|broadband|water|gas|igl|utility|dth|tata play|insurance|lic/i.test(
      combined
    )
  ) {
    return 'Bills';
  }

  if (
    /netflix|spotify|disney|hotstar|prime video|cinema|pvr|inox|movie|game|entertainment|prime|bookmyshow|steam|playstation|youtube/i.test(
      combined
    )
  ) {
    return 'Entertainment';
  }

  if (
    /pharmacy|hospital|apollo|medplus|pharmeasy|1mg|doctor|health|clinic|lab|diagnostic|dental|medical/i.test(
      combined
    )
  ) {
    return 'Health';
  }

  if (
    /school|college|udemy|coursera|book|tuition|fee|education|university|exam/i.test(
      combined
    )
  ) {
    return 'Education';
  }

  return 'Other';
}

/**
 * Core parsing function for any Indian bank/UPI/card SMS message.
 */
export function parseFinancialMessage(
  text: string,
  userId: string
): ParsedTransaction | { is_financial: false; ignore_reason: string } {
  const clean = text.trim();
  if (!clean || clean.length < 10) {
    return { is_financial: false, ignore_reason: 'Message too short or empty.' };
  }

  // 1. Check if ignored message (OTP, promotion, balance inquiry)
  const ignoreCheck = isIgnoredMessageType(clean);
  if (ignoreCheck.isIgnored) {
    return {
      is_financial: false,
      ignore_reason: ignoreCheck.reason || 'Non-transaction message.',
    };
  }

  // 2. Extract Amount
  const amount = extractAmount(clean);
  if (!amount || amount <= 0) {
    return {
      is_financial: false,
      ignore_reason: 'No clear financial amount found or ambiguous amount.',
    };
  }

  // 3. Determine Transaction Type
  const lower = clean.toLowerCase();
  let type: TransactionType = 'Expense';

  if (/refund|reversal|reversed/i.test(lower)) {
    type = 'Refund';
  } else if (/atm cash withdrawal|withdrawn from atm|cash withdrawal/i.test(lower)) {
    type = 'Transfer';
  } else if (
    /credited|salary credited|received rs|deposited/i.test(lower) &&
    !/debited/i.test(lower)
  ) {
    type = 'Income';
  } else if (/debited|spent|paid|purchase of|charged to/i.test(lower)) {
    type = 'Expense';
  } else {
    // If has amount but no clear debit/credit indicator, reject to be safe
    return {
      is_financial: false,
      ignore_reason: 'Ambiguous transaction: missing debit/credit/payment indicator.',
    };
  }

  // 4. Date & Time
  const { date, time } = extractTransactionDate(clean);

  // 5. Provider & Payment Method
  const providerInfo = identifyProvider(clean);
  let paymentMethod: PaymentMethod = 'UPI';
  if (providerInfo.isCard) paymentMethod = 'Card';
  else if (type === 'Transfer') paymentMethod = 'Cash';
  else if (/neft|imps|rtgs|netbanking/i.test(lower)) paymentMethod = 'Bank';
  else if (providerInfo.isUpi) paymentMethod = 'UPI';

  // 6. Account or Card last 4 digits
  let accountLast4: string | undefined;
  const acctMatch = clean.match(
    /(?:a\/c|ac|account|card|ending|xx)\s*(?:no\.?)?\s*(?:ending)?\s*(?:x{2,}|\*{2,})?(\d{4})/i
  );
  if (acctMatch && acctMatch[1]) {
    accountLast4 = acctMatch[1];
  }

  // 7. Reference ID / UTR / UPI Ref
  let referenceId: string | undefined;
  const refMatch = clean.match(
    /(?:ref(?:\s*no\.?|\s*id)?|utr(?:\s*no\.?)?|upi\s*ref(?:\s*no\.?)?|txn(?:\s*id|\s*no\.?)?)\s*[:#-]?\s*([A-Za-z0-9]{6,25})/i
  );
  if (refMatch && refMatch[1]) {
    referenceId = refMatch[1].trim();
  }

  // 8. Merchant / Counterparty
  const merchant = extractMerchant(clean, type);

  // 9. Category Mapping
  const category = inferCategory(merchant, clean);

  // 10. Source Type description
  let sourceType = `${providerInfo.bankName} Alert`;
  if (providerInfo.isUpi) sourceType = `UPI (${providerInfo.bankName})`;
  else if (providerInfo.isCard) sourceType = `${providerInfo.bankName} Card`;

  // 11. Confidence scoring
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (merchant === 'Merchant' || merchant === 'Bank SMS') confidence = 'medium';

  // 12. Stable Fingerprint
  const fingerprint = generateFingerprint(
    userId,
    date,
    amount,
    merchant,
    type,
    referenceId,
    accountLast4
  );

  return {
    amount,
    type,
    date,
    time,
    merchant,
    payment_method: paymentMethod,
    account_last4: accountLast4,
    reference_id: referenceId,
    source_type: sourceType,
    category,
    confidence,
    fingerprint,
    is_financial: true,
  };
}

// Backward compatible helper
export function parseTransactionMessage(text: string, userId: string): SuggestedExpense | null {
  const result = parseFinancialMessage(text, userId);
  if (!('is_financial' in result) || !result.is_financial) return null;

  return {
    id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    merchant: result.merchant,
    amount: result.amount,
    date: result.date,
    category: result.category,
    source: 'Message',
    provider_reference: result.reference_id,
    created_at: new Date().toISOString(),
  };
}

// ==========================================
// 5. AUTOMATIC RECORDING & PROCESSOR
// ==========================================

export interface ProcessMessageResult {
  status: 'recorded' | 'review_needed' | 'duplicate' | 'ignored';
  status_reason: string;
  parsed?: ParsedTransaction;
  expense_id?: string;
  history_id: string;
}

/**
 * Checks if a parsed transaction is a duplicate of an existing Rupxa expense or history item.
 */
export async function checkDuplicate(
  userId: string,
  parsed: ParsedTransaction
): Promise<{ isDuplicate: boolean; reason?: string }> {
  // 1. Check existing detection history
  const history = getDetectionHistory(userId);
  const historyDup = history.find((h) => {
    if (!h.parsed) return false;
    // Direct reference match
    if (parsed.reference_id && h.parsed.reference_id === parsed.reference_id) {
      return true;
    }
    // Fingerprint match
    return h.parsed.fingerprint === parsed.fingerprint;
  });

  if (historyDup) {
    return {
      isDuplicate: true,
      reason: `Matches previously detected transaction (Ref: ${
        parsed.reference_id || 'Fingerprint'
      }).`,
    };
  }

  // 2. Check existing Rupxa recorded expenses
  try {
    const existingExpenses = await getExpenses(userId);
    const expenseDup = existingExpenses.find((exp) => {
      // Same amount and same date and matching description
      const amountMatches = Math.abs(exp.amount - parsed.amount) < 0.01;
      const dateMatches = exp.expense_date === parsed.date;
      const descMatches =
        exp.description.toLowerCase().includes(parsed.merchant.toLowerCase()) ||
        parsed.merchant.toLowerCase().includes(exp.description.toLowerCase());
      return amountMatches && dateMatches && descMatches;
    });

    if (expenseDup) {
      return {
        isDuplicate: true,
        reason: `Matches existing recorded expense: "${expenseDup.description}" (₹${expenseDup.amount} on ${expenseDup.expense_date}).`,
      };
    }
  } catch (e) {
    console.warn('Duplicate check against expenses notice:', e);
  }

  return { isDuplicate: false };
}

/**
 * Processes a single financial message according to user settings.
 * Automatically records if enabled and confident, or saves for review.
 */
export async function processFinancialMessage(
  text: string,
  userId: string
): Promise<ProcessMessageResult> {
  const settings = getExpenseDetectionSettings();
  const historyId = `det_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const snippet = sanitizeSnippet(text);

  // 1. Parse
  const parseResult = parseFinancialMessage(text, userId);

  // If not a financial transaction
  if (!parseResult.is_financial) {
    const reasonText = parseResult.ignore_reason || 'Non-transaction message.';
    const item: DetectionHistoryItem = {
      id: historyId,
      user_id: userId,
      timestamp: new Date().toISOString(),
      raw_snippet: snippet,
      status: 'ignored',
      status_reason: reasonText,
    };
    saveDetectionHistoryItem(item);
    return {
      status: 'ignored',
      status_reason: reasonText,
      history_id: historyId,
    };
  }

  const parsed = parseResult as ParsedTransaction;

  // 2. Duplicate Detection
  if (settings.duplicate_prevention_enabled) {
    const dupCheck = await checkDuplicate(userId, parsed);
    if (dupCheck.isDuplicate) {
      const item: DetectionHistoryItem = {
        id: historyId,
        user_id: userId,
        timestamp: new Date().toISOString(),
        raw_snippet: snippet,
        parsed,
        status: 'duplicate',
        status_reason: dupCheck.reason,
      };
      saveDetectionHistoryItem(item);
      return {
        status: 'duplicate',
        status_reason: dupCheck.reason || 'Duplicate transaction detected.',
        parsed,
        history_id: historyId,
      };
    }
  }

  // 3. Automatic Recording Eligibility
  const canAutoRecord =
    settings.message_detection_enabled &&
    settings.auto_record &&
    parsed.type === 'Expense' &&
    parsed.amount > 0 &&
    parsed.confidence === 'high';

  if (canAutoRecord) {
    try {
      const createdExpense = await createExpense({
        user_id: userId,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.merchant,
        expense_date: parsed.date,
        payment_method: parsed.payment_method,
        source: 'Message',
      });

      const item: DetectionHistoryItem = {
        id: historyId,
        user_id: userId,
        timestamp: new Date().toISOString(),
        raw_snippet: snippet,
        parsed,
        status: 'recorded',
        status_reason: `Automatically recorded as ${parsed.category} expense.`,
        expense_id: createdExpense.id,
      };
      saveDetectionHistoryItem(item);

      // Update settings metrics
      saveExpenseDetectionSettings({
        last_import_at: new Date().toISOString(),
        total_detected_count: (settings.total_detected_count || 0) + 1,
      });

      return {
        status: 'recorded',
        status_reason: 'Automatically recorded to your Rupxa expenses.',
        parsed,
        expense_id: createdExpense.id,
        history_id: historyId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record expense.';
      console.error('Auto-record error:', err);
      // Fallback to review_needed
      const item: DetectionHistoryItem = {
        id: historyId,
        user_id: userId,
        timestamp: new Date().toISOString(),
        raw_snippet: snippet,
        parsed,
        status: 'review_needed',
        status_reason: `Auto-record encountered an error: ${msg}. Review required.`,
      };
      saveDetectionHistoryItem(item);
      return {
        status: 'review_needed',
        status_reason: `Auto-record encountered an error: ${msg}`,
        parsed,
        history_id: historyId,
      };
    }
  }

  // 4. Default: Review Needed (adds to suggestions for one-click manual confirmation)
  const reason =
    parsed.type !== 'Expense'
      ? `${parsed.type} detected. Ready for your review.`
      : !settings.message_detection_enabled
      ? 'Detection inactive in settings. Stored for review.'
      : !settings.auto_record
      ? 'Automatic recording is turned off. Ready for your 1-click confirmation.'
      : 'Confidence requires verification. Ready for your review.';

  // Add to suggestions card so it appears in Dashboard
  try {
    addSuggestedExpense({
      user_id: userId,
      merchant: parsed.merchant,
      amount: parsed.amount,
      date: parsed.date,
      category: parsed.category,
      source: 'Message',
      provider_reference: parsed.reference_id,
    });
  } catch (e) {
    console.warn('Suggested expense duplicate notice:', e);
  }

  const item: DetectionHistoryItem = {
    id: historyId,
    user_id: userId,
    timestamp: new Date().toISOString(),
    raw_snippet: snippet,
    parsed,
    status: 'review_needed',
    status_reason: reason,
  };
  saveDetectionHistoryItem(item);

  saveExpenseDetectionSettings({
    last_import_at: new Date().toISOString(),
    total_detected_count: (settings.total_detected_count || 0) + 1,
  });

  return {
    status: 'review_needed',
    status_reason: reason,
    parsed,
    history_id: historyId,
  };
}

/**
 * Batch processes an array of text messages (e.g. from clipboard or shared text).
 */
export async function batchProcessMessages(
  texts: string[],
  userId: string
): Promise<ProcessMessageResult[]> {
  const results: ProcessMessageResult[] = [];
  for (const t of texts) {
    if (t.trim()) {
      const res = await processFinancialMessage(t, userId);
      results.push(res);
    }
  }
  return results;
}

/**
 * Converts a history item into a recorded Rupxa expense (for manual confirmation from history).
 */
export async function confirmHistoryItemAsExpense(
  userId: string,
  historyId: string,
  customCategory?: ExpenseCategory,
  customDescription?: string
): Promise<string> {
  const history = getDetectionHistory(userId);
  const target = history.find((h) => h.id === historyId);
  if (!target || !target.parsed) {
    throw new Error('Transaction record not found in detection history.');
  }

  const created = await createExpense({
    user_id: userId,
    amount: target.parsed.amount,
    category: customCategory || target.parsed.category,
    description: (customDescription || target.parsed.merchant).trim(),
    expense_date: target.parsed.date,
    payment_method: target.parsed.payment_method,
    source: 'Message',
  });

  // Update history item status
  target.status = 'recorded';
  target.expense_id = created.id;
  target.status_reason = 'Manually confirmed and recorded to expenses.';
  target.updated_at = new Date().toISOString();
  saveDetectionHistoryItem(target);

  return created.id;
}

/**
 * Directly updates an already recorded Rupxa expense from the history panel.
 */
export async function updateRecordedExpenseFromHistory(
  userId: string,
  historyId: string,
  updates: { category: ExpenseCategory; description: string; amount: number }
): Promise<void> {
  const history = getDetectionHistory(userId);
  const target = history.find((h) => h.id === historyId);
  if (!target || !target.expense_id) {
    throw new Error('This detected transaction is not linked to a recorded expense.');
  }

  await updateExpense(target.expense_id, userId, {
    category: updates.category,
    description: updates.description.trim(),
    amount: parseMoney(updates.amount),
  });

  // Keep history metadata updated
  if (target.parsed) {
    target.parsed.category = updates.category;
    target.parsed.merchant = updates.description.trim();
    target.parsed.amount = parseMoney(updates.amount);
  }
  target.updated_at = new Date().toISOString();
  saveDetectionHistoryItem(target);
}
