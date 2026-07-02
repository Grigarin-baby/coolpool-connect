/**
 * Human-readable booking ID: YYMM-CPBK-NNNN, e.g. "2607-CPBK-0032".
 *   YY/MM  — booking creation year/month.
 *   CPBK   — fixed brand + "booking" literal.
 *   NNNN   — 4 digits derived deterministically from the booking's Appwrite
 *            id (stable per booking, no counter needed). Grows past 4 digits
 *            only if the derived number ever exceeds 9999.
 *
 * Derived, not minted: it's a friendly label computed from data already on
 * the booking, so every existing booking gets one instantly and it never
 * changes. Like the vehicle code, it's a display label, not a primary key —
 * the real Appwrite booking id stays that. The YYMM prefix keeps the
 * collision scope tiny (same 4 digits only clash within one month).
 */
export function formatBookingCode(input: { createdAt: Date | string; id: string }): string {
  const created = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  const valid = !Number.isNaN(created.getTime());
  const yy = valid ? String(created.getUTCFullYear()).slice(-2) : "00";
  const mm = valid ? String(created.getUTCMonth() + 1).padStart(2, "0") : "00";

  // Stable, well-distributed 4-digit number from the id (djb2 hash).
  let hash = 5381;
  const id = String(input.id ?? "");
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) >>> 0;
  }
  const digits = String(hash % 10000).padStart(4, "0");

  return `${yy}${mm}-CPBK-${digits}`;
}
