import type { Trip, TripStop } from "./domain";

/**
 * Cumulative price (per seat) from the trip's origin to a given stop.
 * Falls back to distance-proportional pricing for trips published before
 * per-stop pricing was tracked (where every stop's priceFromOrigin is 0).
 */
function priceFromOrigin(trip: Trip, stop: TripStop, lastStop: TripStop): number {
  if (lastStop.priceFromOrigin > 0) return stop.priceFromOrigin;
  if (trip.totalDistanceKm <= 0) return 0;
  const pricePerSeat = trip.totalSeats > 0 ? trip.totalPrice / trip.totalSeats : trip.totalPrice;
  return (stop.distanceFromOriginKm / trip.totalDistanceKm) * pricePerSeat;
}

/**
 * Price per seat for travelling between two stops on a trip's route.
 * Returns the full per-seat price if the stops can't be resolved.
 */
export function getSegmentPrice(
  trip: Trip,
  stops: TripStop[],
  fromStopIndex: number,
  toStopIndex: number,
): number {
  const sorted = [...stops].sort((a, b) => a.stopIndex - b.stopIndex);
  const lastStop = sorted[sorted.length - 1];
  const fromStop = sorted.find((s) => s.stopIndex === fromStopIndex);
  const toStop = sorted.find((s) => s.stopIndex === toStopIndex);

  if (!fromStop || !toStop || !lastStop) {
    return trip.totalSeats > 0 ? trip.totalPrice / trip.totalSeats : trip.totalPrice;
  }

  const price = Math.max(0, priceFromOrigin(trip, toStop, lastStop) - priceFromOrigin(trip, fromStop, lastStop));
  // A paid segment must never round down to ₹0 (a real ₹0.25–₹0.99 price was
  // showing as "₹0" to riders). Keep genuinely free segments at ₹0, but floor
  // any positive price at ₹1.
  if (price === 0) return 0;
  return Math.max(1, Math.round(price));
}
