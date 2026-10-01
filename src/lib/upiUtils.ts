import QRCode from 'qrcode';
import { SplitMember } from '../types';

export interface PairwiseDebt {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toUpiId?: string | null;
  amount: number;
}

/**
 * Builds standard UPI URI for instant app opening and QR codes
 * Spec: upi://pay?pa=recipient@bank&pn=Recipient+Name&am=450.00&cu=INR&tn=Note
 */
export function buildUpiIntentUrl({
  upiId,
  name,
  amount,
  note = 'Rupxa Split Settlement',
}: {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}): string {
  const cleanUpi = upiId.trim();
  const cleanName = name.trim();
  const formattedAmount = Number(amount).toFixed(2);
  const cleanNote = note.trim();

  const params = new URLSearchParams();
  params.set('pa', cleanUpi);
  params.set('pn', cleanName);
  params.set('am', formattedAmount);
  params.set('cu', 'INR');
  if (cleanNote) {
    params.set('tn', cleanNote);
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Generates high-contrast base64 DataURL for rendering QR code
 */
export async function generateUpiQrCodeDataUrl(upiUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(upiUrl, {
      width: 320,
      margin: 1.5,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Failed to generate UPI QR code:', err);
    throw err;
  }
}

/**
 * Computes minimum pairwise cash flow / debts between members given net balances.
 * Debtor (net < 0) owes Creditor (net > 0).
 */
export function calculatePairwiseDebts(
  members: SplitMember[],
  balances: { [userId: string]: { paid: number; share: number; net: number } }
): PairwiseDebt[] {
  const membersMap = new Map<string, SplitMember>();
  members.forEach((m) => membersMap.set(m.user_id, m));

  // Debtors: net < 0 (they owe money)
  // Creditors: net > 0 (they are owed money)
  const debtors: { userId: string; amount: number }[] = [];
  const creditors: { userId: string; amount: number }[] = [];

  Object.entries(balances).forEach(([userId, b]) => {
    const net = Math.round(b.net * 100) / 100;
    if (net < -0.01) {
      debtors.push({ userId, amount: Math.abs(net) });
    } else if (net > 0.01) {
      creditors.push({ userId, amount: net });
    }
  });

  // Sort descending by amount for efficient matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const debts: PairwiseDebt[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    const roundedSettle = Math.round(settleAmount * 100) / 100;

    if (roundedSettle > 0) {
      const dMember = membersMap.get(debtor.userId);
      const cMember = membersMap.get(creditor.userId);

      const fromName = dMember?.profile?.full_name || 'Member';
      const toName = cMember?.profile?.full_name || 'Member';
      const toUpiId = cMember?.profile?.upi_id || null;

      debts.push({
        fromUserId: debtor.userId,
        fromName,
        toUserId: creditor.userId,
        toName,
        toUpiId,
        amount: roundedSettle,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (Math.round(debtor.amount * 100) / 100 <= 0.01) {
      dIdx++;
    }
    if (Math.round(creditor.amount * 100) / 100 <= 0.01) {
      cIdx++;
    }
  }

  return debts;
}
