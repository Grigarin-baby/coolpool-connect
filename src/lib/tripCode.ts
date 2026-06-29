/**
 * Human-readable trip ID: YYMM-CPTR-NNNN, e.g. "2606-CPTR-0001".
 *   YY/MM  — trip creation year/month (immutable once assigned)
 *   CPTR   — fixed brand + "trip" literal
 *   NNNN   — global monotonic sequence (platform-wide), zero-padded to 4
 *            digits; grows past 4 digits naturally instead of colliding.
 */
export function formatTripCode(input: { createdAt: Date; sequence: number }): string {
  const yy = String(input.createdAt.getUTCFullYear()).slice(-2);
  const mm = String(input.createdAt.getUTCMonth() + 1).padStart(2, "0");
  const seq = String(Math.max(0, input.sequence));
  const seqPadded = seq.length >= 4 ? seq : seq.padStart(4, "0");
  return `${yy}${mm}-CPTR-${seqPadded}`;
}
