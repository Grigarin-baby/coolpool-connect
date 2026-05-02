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

  // Row 0: Front Passenger (Left) + Driver (Right)
  let passengerNo = 1;
  
  // Front Passenger on Left (Col 0)
  if (cap > 1) {
    push(0, 0, "passenger", String(passengerNo));
    passengerNo++;
  }

  // Driver on Right (Col 1)
  push(0, 1, "driver", "Drv");

  // Row 1+: Back Rows (2 seats per row - Captain Seat style)
  let row = 1;
  while (slots.length < cap) {
    for (let c = 0; c < 2 && slots.length < cap; c++) {
      push(row, c, "passenger", String(passengerNo));
      passengerNo++;
    }
    row++;
  }

  return slots;
}
