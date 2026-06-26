import { seatCodeToLabel } from "@/lib/seatLayout";
import type { PassengerGender } from "@/lib/domain";

export function passengerGenderLabel(gender?: PassengerGender | string | null): "M" | "F" | "—" {
  const normalized = String(gender ?? "").trim().toLowerCase();
  if (normalized === "male") return "M";
  if (normalized === "female") return "F";
  return "—";
}

export function passengerGenderTone(gender?: PassengerGender | string | null): "male" | "female" | "unknown" {
  const normalized = String(gender ?? "").trim().toLowerCase();
  if (normalized === "male") return "male";
  if (normalized === "female") return "female";
  return "unknown";
}

export function passengerSeatLabel(seatCode?: string | null): string {
  const code = String(seatCode ?? "").trim();
  return code ? seatCodeToLabel(code) : "—";
}
