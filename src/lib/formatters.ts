/**
 * Rupxa Financial & Utility Formatters
 */

/**
 * Format currency in Indian Rupees (INR)
 * Ensures standard 2 decimal places with ₹ symbol
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

/**
 * Parse numeric input safely avoiding floating point quirks
 */
export function parseMoney(val: string | number): number {
  if (typeof val === 'number') {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }
  const clean = val.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

/**
 * Normalize phone numbers to ensure uniform matching
 * Strips whitespace, dashes, parentheticals, and country code prefix (+91 or 0)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/\D/g, '');
  // If 12 digits starting with 91, extract the 10 digits
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  // If 11 digits starting with 0, extract the 10 digits
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}

export const normalizePhone = normalizePhoneNumber;

/**
 * Mask an email for safe display in user search
 * e.g. rahul.kumar@gmail.com -> rah***@gmail.com
 */
export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) {
    return `${name[0]}***@${domain}`;
  }
  return `${name.substring(0, 3)}***@${domain}`;
}

/**
 * Mask a phone number for safe display
 * e.g. 9876543210 -> 987***3210
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}****${normalized.slice(7)}`;
  }
  if (normalized.length > 4) {
    return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
  }
  return '******';
}

/**
 * Format dates cleanly: "Today", "Yesterday", or "22 Sep 2026"
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  
  // Format matching today/yesterday in local date
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format activity timestamp: "5:50 PM" or "22 Sep, 5:50 PM"
 */
export function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format full activity date-time label for timeline groupings
 */
export function formatTimelineGroup(timestamp: string): string {
  if (!timestamp) return 'Recent';
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
