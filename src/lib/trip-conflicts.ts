import dayjs, { type Dayjs } from "dayjs";
import type { Trip } from "./domain";

/** Trips without a computed duration are assumed to occupy this long. */
const FALLBACK_DURATION_MIN = 60;

export interface ResourceConflict {
  trip: Trip;
  /** "in_progress" trips block regardless of timing — we don't know when they'll actually end. */
  reason: "in_progress" | "overlap";
  windowEnd: Dayjs;
}

function getTripWindow(trip: Trip): { start: Dayjs; end: Dayjs } {
  const start = dayjs(trip.departureAt);
  const end = trip.arrivalAt
    ? dayjs(trip.arrivalAt)
    : start.add(trip.durationMinutes || FALLBACK_DURATION_MIN, "minute");
  return { start, end };
}

/**
 * Finds a trip that already occupies the given driver/vehicle during
 * [candidateStart, candidateEnd). Returns null if the resource is free.
 */
export function getResourceConflict(
  trips: Trip[],
  resourceField: "assignedDriverId" | "vehicleId",
  resourceId: string | null | undefined,
  candidateStart: Dayjs,
  candidateEnd: Dayjs,
  excludeTripId?: string | null,
): ResourceConflict | null {
  if (!resourceId) return null;

  for (const trip of trips) {
    if (trip.id === excludeTripId) continue;
    if (trip[resourceField] !== resourceId) continue;
    if (trip.status === "completed" || trip.status === "cancelled") continue;

    if (trip.status === "in_progress") {
      const { end } = getTripWindow(trip);
      return { trip, reason: "in_progress", windowEnd: end };
    }

    if (trip.status === "scheduled") {
      const { start, end } = getTripWindow(trip);
      if (candidateStart.isBefore(end) && candidateEnd.isAfter(start)) {
        return { trip, reason: "overlap", windowEnd: end };
      }
    }
  }

  return null;
}

export function describeConflict(conflict: ResourceConflict): string {
  if (conflict.reason === "in_progress") {
    return "On a trip now";
  }
  return `Busy until ${conflict.windowEnd.format("h:mm A")}`;
}
