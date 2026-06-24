export type SeatKind = "driver" | "passenger";

export interface SeatSlot {
  seatCode: string;
  row: number;
  col: number;
  kind: SeatKind;
  /** Short label inside the tile */
  displayLabel: string;
}

const MIN_CAPACITY = 2;
const MAX_CAPACITY = 12;

/**
 * Build a car-shaped grid: row 0 = driver + copilot; further rows = back bench (3 seats per row).
 * Total slots equals seatCapacity (vehicle seat count).
 */
export function buildSeatLayout(seatCapacity: number): SeatSlot[] {
  const cap = Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.floor(seatCapacity)));
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

  // Seat code = row letter (A, B, C…) + seat number within that row (1, 2, 3…).
  const rowLetter = (r: number) => String.fromCharCode(65 + r);

  // Row 0: Front Passenger (Left) + Driver (Right)
  // Front Passenger on Left (Col 0)
  if (cap > 1) {
    push(0, 0, "passenger", `${rowLetter(0)}1`);
  }

  // Driver on Right (Col 1)
  push(0, 1, "driver", "Drv");

  // Dynamic Row Logic based on vehicle size
  let row = 1;
  const isLargeVehicle = cap >= 6;

  while (slots.length < cap) {
    const seatsInThisRow = isLargeVehicle ? 2 : 3;
    for (let c = 0; c < seatsInThisRow && slots.length < cap; c++) {
      push(row, c, "passenger", `${rowLetter(row)}${c + 1}`);
    }
    row++;
  }

  return slots;
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
