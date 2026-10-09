import { SubscriptionPlan, SubscriptionStatus } from '../types';

/**
 * Automatically calculates expiry date based on start date and selected plan
 * 1_MONTH = +30 days (or 1 calendar month)
 * 1_YEAR = +365 days (or 1 calendar year)
 */
export function calculateExpiryDate(startDateStr: string, plan: SubscriptionPlan): string {
  if (!startDateStr) {
    startDateStr = new Date().toISOString().split('T')[0];
  }
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  if (plan === '1_MONTH') {
    date.setDate(date.getDate() + 30);
  } else {
    date.setDate(date.getDate() + 365);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Calculates current subscription status based on start date, expiry date, and suspension flag
 */
export function computeSubscriptionStatus(
  startDateStr: string,
  expiryDateStr: string,
  isSuspended: boolean = false
): SubscriptionStatus {
  if (isSuspended) {
    return 'SUSPENDED';
  }

  const todayStr = new Date().toISOString().split('T')[0];

  if (!expiryDateStr) {
    return 'EXPIRED';
  }

  if (todayStr > expiryDateStr) {
    return 'EXPIRED';
  }

  // Calculate days remaining
  const today = new Date(todayStr).getTime();
  const expiry = new Date(expiryDateStr).getTime();
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7 && diffDays >= 0) {
    return 'EXPIRING_SOON';
  }

  return 'ACTIVE';
}

/**
 * Formats a date string into readable format (e.g., "15 Oct 2026")
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates remaining days between today and expiry
 */
export function getDaysRemaining(expiryDateStr: string): number {
  if (!expiryDateStr) return 0;
  const today = new Date(new Date().toISOString().split('T')[0]).getTime();
  const expiry = new Date(expiryDateStr).getTime();
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}
