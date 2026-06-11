import dayjs from "dayjs";
import type { TripStop } from "./domain";

export interface SegmentTimes {
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  /** True when either endpoint is a mid-route stop, so the times are
   *  distance-proportional estimates rather than the host's exact times. */
  isEstimated: boolean;
}

/**
 * Estimates when the car reaches a passenger's pickup and drop stops by
 * apportioning the trip's total driving time across the route by distance —
 * a stop 40% of the way along the road is reached ~40% of the way through
 * the drive. Falls back to the full-trip times when distances are missing.
 */
export function estimateSegmentTimes(
  trip: { departureAt: string; arrivalAt?: string; durationMinutes?: number },
  stops: TripStop[],
  fromStopIndex: number,
  toStopIndex: number,
): SegmentTimes {
  const tripDeparture = dayjs(trip.departureAt);
  const totalDuration = trip.arrivalAt
    ? dayjs(trip.arrivalAt).diff(tripDeparture, "minute")
    : (trip.durationMinutes ?? 0);
  const tripArrival = tripDeparture.add(Math.max(totalDuration, 0), "minute");

  const fullTrip: SegmentTimes = {
    departureAt: tripDeparture.toISOString(),
    arrivalAt: tripArrival.toISOString(),
    durationMinutes: Math.max(totalDuration, 0),
    isEstimated: false,
  };

  const fromStop = stops.find((s) => s.stopIndex === fromStopIndex);
  const toStop = stops.find((s) => s.stopIndex === toStopIndex);
  const totalDistance = Math.max(...stops.map((s) => s.distanceFromOriginKm), 0);
  if (!fromStop || !toStop || totalDistance <= 0 || totalDuration <= 0) return fullTrip;

  const offsetMinutes = (distanceKm: number) =>
    Math.round(totalDuration * Math.min(Math.max(distanceKm / totalDistance, 0), 1));

  const segmentDeparture = tripDeparture.add(offsetMinutes(fromStop.distanceFromOriginKm), "minute");
  const segmentArrival = tripDeparture.add(offsetMinutes(toStop.distanceFromOriginKm), "minute");
  const isEstimated =
    fromStop.distanceFromOriginKm > 0 || toStop.distanceFromOriginKm < totalDistance;

  return {
    departureAt: segmentDeparture.toISOString(),
    arrivalAt: segmentArrival.toISOString(),
    durationMinutes: Math.max(segmentArrival.diff(segmentDeparture, "minute"), 0),
    isEstimated,
  };
}
