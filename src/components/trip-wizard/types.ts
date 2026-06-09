import type { Dayjs } from "dayjs";
import type { SeatId } from "@/components/SeatPicker";
import type { ClockTime } from "./ClockFacePicker";

/** A geocoded place: human-readable label + coordinates. */
export interface PlacePoint {
  label: string;
  lat: number;
  lng: number;
}

/** One alternative returned by the Directions API. */
export interface RouteAlternative {
  /** Stable id within the current Directions result set (the array index). */
  id: number;
  /** Encoded overview polyline string from Google. */
  polyline: string;
  /** Total driving distance in km for the alternative. */
  distanceKm: number;
  /** Total driving time in minutes. */
  durationMin: number;
  /** Short hint Google returns for the via-road set, e.g. "via NH 44". */
  summary: string;
}

/** Intermediate boarding/drop-off point selected by the host. */
export interface WizardStop {
  label: string;
  lat: number;
  lng: number;
  /** km along the chosen polyline from origin to this stop. */
  distanceFromOriginKm: number;
}

/** Mutable wizard state held by the shell while the user moves through steps. */
export interface WizardData {
  from: PlacePoint | null;
  to: PlacePoint | null;
  alternatives: RouteAlternative[];
  selectedAltId: number | null;
  date: Dayjs | null;
  time: ClockTime | null;
  stops: WizardStop[];
  pricePerSeat: number | null;
  seatConfig: SeatId[];
  vehicleId: string | null;
  driverId: string | null;
}

/** What the wizard hands back to the calling form on completion. */
export interface WizardResult {
  from: PlacePoint;
  to: PlacePoint;
  /** ISO string, local timezone. */
  departureAt: string;
  polyline: string;
  totalDistanceKm: number;
  durationMin: number;
  stops: WizardStop[];
  pricePerSeat: number;
  seatConfig: SeatId[];
  totalSeats: number;
  vehicleId: string;
  driverId: string;
}

export const EMPTY_WIZARD_DATA: WizardData = {
  from: null,
  to: null,
  alternatives: [],
  selectedAltId: null,
  date: null,
  time: null,
  stops: [],
  pricePerSeat: null,
  seatConfig: [],
  vehicleId: null,
  driverId: null,
};
