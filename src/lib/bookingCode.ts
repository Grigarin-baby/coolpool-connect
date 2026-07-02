/**
 * Human-readable booking ID: YYMM-CPBK-NNNN, e.g. "2607-CPBK-0001".
 *   YY/MM  — booking creation year/month.
 *   CPBK   — fixed brand + "booking" literal.
 *   NNNN   — running sequence starting at 0001, zero-padded to 4 digits;
 *            grows past 4 digits naturally instead of colliding.
 *
 * The sequence is assigned by ordering every booking chronologically
 * (oldest = 0001) at display time, so all existing bookings get a stable
 * number with no DB counter. It's a friendly label, not a primary key — the
 * real Appwrite booking id stays that.
 */
export function formatBookingCode(input: { createdAt: Date | string; sequence: number }): string {
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  const valid = !Number.isNaN(created.getTime());
  const yy = valid ? String(created.getUTCFullYear()).slice(-2) : "00";
  const mm = valid ? String(created.getUTCMonth() + 1).padStart(2, "0") : "00";

  const seq = String(Math.max(1, Math.floor(input.sequence)));
  const seqPadded = seq.length >= 4 ? seq : seq.padStart(4, "0");

  return `${yy}${mm}-CPBK-${seqPadded}`;
}
