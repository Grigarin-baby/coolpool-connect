export type SeatKind = "driver" | "passenger";

export interface SeatSlot {
  seatCode: string;
  row: number;
  col: number;
  kind: SeatKind;
  /** Short label inside the tile */
  displayLabel: string;
}

/**
 * The only two vehicle shapes the app supports. This is a labeling choice,
 * not a literal seat count: "5 Seater" = 5 people total (driver + 4
 * passenger seats, standard sedan meaning). "7 Seater" = 7 *sellable*
 * passenger seats (driver doesn't count as a seat to sell), so a 7-seater
 * actually carries 8 people. Must match SeatMap.tsx's COORDINATES table.
 */
export type VehicleSeatCapacity = 5 | 7;

/**
 * Build a car-shaped grid. Two fixed shapes only (sedan / SUV), matching the
 * two seat-capacity options offered when adding a vehicle and the two sets of
 * hardcoded seat-position coordinates in SeatMap.tsx:
 *   5-seater (sedan): A1 + Drv, then a 3-seat back row (B1, B2, B3).
 *   7-seater (SUV):   A1 + Drv, a 3-seat middle row (B1, B2, B3), then a
 *                     3-seat back row (C1, C2, C3) — B2 and C2 are the true
 *                     middle seats of each row (8 people total, 7 sellable).
 */
export function buildSeatLayout(seatCapacity: number): SeatSlot[] {
  const cap: VehicleSeatCapacity = seatCapacity >= 6 ? 7 : 5;
  const slots: SeatSlot[] = [];

  const push = (row: number, col: number, kind: SeatKind, label: string) => {
    slots.push({
      seatCode: `R${row}-C${col}`,
      row,
      col,
      kind,
      displayLabel: label,
    });
  };

  // Row 0: Front Passenger (Left) + Driver (Right) — same for both shapes.
  push(0, 0, "passenger", "A1");
  push(0, 1, "driver", "Drv");

  if (cap === 5) {
    push(1, 0, "passenger", "B1");
    push(1, 1, "passenger", "B2");
    push(1, 2, "passenger", "B3");
  } else {
    push(1, 0, "passenger", "B1");
    push(1, 1, "passenger", "B2");
    push(1, 2, "passenger", "B3");
    push(2, 0, "passenger", "C1");
    push(2, 1, "passenger", "C2");
    push(2, 2, "passenger", "C3");
  }

  return slots;
}

/**
 * Seats offered by default when a host first configures a trip: every
 * passenger seat except the "optional" middle seats — B2 (center of the
 * 5-seater's back row, or the 7-seater's middle row) and, on a 7-seater,
 * C2 (center of the back row) — hosts opt back in by tapping those seats.
 */
export function defaultOfferedSeatCodes(seatCapacity: number): string[] {
  return buildSeatLayout(seatCapacity)
    .filter(
      (slot) => slot.kind === "passenger" && slot.seatCode !== "R1-C1" && slot.seatCode !== "R2-C1",
    )
    .map((slot) => slot.seatCode);
}

/**
 * Convert a stored seat code (`R{row}-C{col}`) to the human-friendly label
 * shown to riders and hosts (e.g. `R0-C0` → `A1`, `R1-C2` → `B3`). This mirrors
 * the `displayLabel` produced by buildSeatLayout. Unknown formats are returned
 * unchanged so nothing ever renders blank.
 */
export function seatCodeToLabel(seatCode: string): string {
  const match = /^R(\d+)-C(\d+)$/.exec(seatCode);
  if (!match) return seatCode;
  const row = Number(match[1]);
  const col = Number(match[2]);
  // Row 0 / col 1 is the driver in buildSeatLayout — never a bookable seat.
  if (row === 0 && col === 1) return "Drv";
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}
