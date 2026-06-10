import type { Dayjs } from "dayjs";
import type { SeatId } from "@/components/SeatPicker";
import type { ClockTime } from "./ClockFacePicker";

/** A geocoded place: human-readable label + coordinates. */
export interface PlacePoint {
  label: string;
  lat: number;
  lng: number;
}

/** An intermediate stop with a traveler-facing role. */
export interface IntermediatePoint extends PlacePoint {
  stopType: "pickup" | "drop" | "both";
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
  stopType: "pickup" | "drop" | "both";
}

/** Mutable wizard state held by the shell while the user moves through steps. */
export interface WizardData {
  from: PlacePoint | null;
  to: PlacePoint | null;
  alternatives: RouteAlternative[];
  selectedAltId: number | null;
  date: Dayjs | null;
  time: ClockTime | null;
  /** Intermediate stops collected in StepRoute (plain coords, no distance yet). */
  intermediatePoints: IntermediatePoint[];
  stops: WizardStop[];
  pricePerSeat: number | null;
  seatConfig: SeatId[];
  vehicleId: string | null;
  driverId: string | null;
  /** Editable per-segment prices. Key = "fromStopIdx-toStopIdx" in the ordered allStops array. */
  segmentPrices: Record<string, number>;
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
  /** Final per-segment prices after user review. Key = "fromStopIdx-toStopIdx". */
  segmentPrices: Record<string, number>;
}

export const STOP_TYPE_LABELS: Record<IntermediatePoint["stopType"], string> = {
  pickup: "Pick-up only",
  drop: "Drop-off only",
  both: "Pick-up & Drop-off",
};

export const EMPTY_WIZARD_DATA: WizardData = {
  from: null,
  to: null,
  alternatives: [],
  selectedAltId: null,
  date: null,
  time: null,
  intermediatePoints: [],
  stops: [],
  pricePerSeat: null,
  seatConfig: [],
  vehicleId: null,
  driverId: null,
  segmentPrices: {},
};
