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

/** Flat platform fee deducted from the host's earnings per booking. */
export const PLATFORM_FEE_PER_BOOKING = 10;

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
