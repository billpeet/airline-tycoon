/**
 * Pure finance math — used by both the sim and the UI previews.
 * Money in CENTS, rates in BASIS POINTS (1bp = 0.01%, so 600bps = 6.00% APR).
 */

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;

/**
 * Standard mortgage-style monthly payment for a fully-amortising loan.
 *   M = P × r(1+r)^n / ((1+r)^n − 1)
 * where r is monthly rate, n is term in months.
 */
export function monthlyPaymentCents(
  principalCents: number,
  rateBps: number,
  termMonths: number,
): number {
  if (termMonths <= 0) return principalCents;
  const monthlyRate = rateBps / 10_000 / MONTHS_PER_YEAR;
  if (monthlyRate === 0) return Math.round(principalCents / termMonths);
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return Math.round((principalCents * monthlyRate * factor) / (factor - 1));
}

/**
 * Apply one month's P&I to a loan balance. Returns the principal+interest
 * components and the new outstanding balance.
 */
export function loanMonthlyTick(
  outstandingCents: number,
  rateBps: number,
  termMonths: number,
  monthlyPayment: number,
): { interestCents: number; principalCents: number; newOutstandingCents: number; isFinalPayment: boolean } {
  const monthlyRate = rateBps / 10_000 / MONTHS_PER_YEAR;
  const interest = Math.round(outstandingCents * monthlyRate);
  // Last payment shouldn't overshoot.
  let principalPaid = monthlyPayment - interest;
  if (principalPaid > outstandingCents) principalPaid = outstandingCents;
  const newOutstanding = outstandingCents - principalPaid;
  return {
    interestCents: interest,
    principalCents: principalPaid,
    newOutstandingCents: newOutstanding,
    isFinalPayment: newOutstanding <= 0,
  };
}

/** Daily interest on an overdrawn cash position (negative `cashCents`). */
export function revolverDailyInterestCents(cashCents: number, rateBps: number): number {
  if (cashCents >= 0) return 0;
  const dailyRate = rateBps / 10_000 / 365;
  return Math.round(-cashCents * dailyRate);
}

/** Days since a finance instrument's start, divided by 30 → whole months elapsed. */
export function monthsElapsedSinceStart(currentDay: number, startedOnDay: number): number {
  return Math.floor((currentDay - startedOnDay) / DAYS_PER_MONTH);
}

/** Default loan rate for a new issuance. Uses a small base + variance later. */
export const DEFAULT_LOAN_RATE_BPS = 650;          // 6.50% APR
export const DEFAULT_REVOLVER_RATE_BPS = 1100;     // 11.00% APR
export const REVOLVER_MONTHLY_FEE_CENTS = 25_000;  // $250 / month facility fee
export const FINANCE_DOWNPAYMENT_PCT = 0.10;       // 10% down on aircraft finance
export const LEASE_DEPOSIT_MONTHS = 3;             // 3 months of payments upfront
