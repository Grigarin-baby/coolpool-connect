/**
 * Coolpool pricing engine — pure, dynamic, never store combinations.
 *
 * Rules:
 *   price_per_km = total_price / total_distance
 *   segment_price = (distance_to - distance_from) × price_per_km
 *
 * Updates to a trip's total_price recalculate price_per_km going forward
 * but DO NOT change segment_price on existing bookings.
 */

/**
 * Platform commission, as a percentage of gross fare. Charged to the HOST:
 * riders still pay exactly the host's price, the platform keeps this %, and the
 * host receives the rest. Earnings shown to hosts are already net of this fee.
 */
export const PLATFORM_FEE_PERCENT = 5;

/** Platform's cut of a gross amount — rounded to the paise (2 decimal places). */
export function platformFee(gross: number): number {
  return Math.round(Math.max(0, gross) * PLATFORM_FEE_PERCENT) / 100;
}

/** What the host keeps from a gross amount, after the platform commission. */
export function hostNetEarnings(gross: number): number {
  return Math.max(0, Math.round((gross - platformFee(gross)) * 100) / 100);
}

/**
 * Reverse-estimates the gross amount and commission that funded a net
 * payout, for payout requests created before gross/fee were snapshotted at
 * request time. Approximate — the real fee was rounded per-booking, not on
 * the lump net total — so callers should label this as an estimate.
 */
export function estimateGrossFromNet(net: number): number {
  return Math.round(Math.max(0, net) / (1 - PLATFORM_FEE_PERCENT / 100) * 100) / 100;
}

/** Estimated commission behind a net payout amount (see estimateGrossFromNet). */
export function estimateFeeFromNet(net: number): number {
  return Math.max(0, Math.round((estimateGrossFromNet(net) - Math.max(0, net)) * 100) / 100);
}

export function calcPricePerKm(totalPrice: number, totalDistanceKm: number): number {
  if (totalDistanceKm <= 0) return 0;
  return totalPrice / totalDistanceKm;
}

export function calcSegmentPrice(
  distanceFromKm: number,
  distanceToKm: number,
  pricePerKm: number,
): number {
  const segmentDistance = Math.max(0, distanceToKm - distanceFromKm);
  return Math.round(segmentDistance * pricePerKm * 100) / 100;
}

export function formatCurrency(amount: number, currency = "₹"): string {
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
