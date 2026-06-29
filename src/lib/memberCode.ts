/**
 * Human-readable member ID: YYMM-CP{ROLE}{GENDER}-NNNN, e.g. "2606-CPGM-0001".
 *   YY/MM  — account creation year/month (immutable once assigned)
 *   CP     — fixed brand literal
 *   ROLE   — "H" (host) or "G" (guest); assigned once at signup, never
 *            re-derived if a guest later becomes a host too.
 *   GENDER — "M" / "F" / "X" (not provided)
 *   NNNN   — global monotonic sequence (platform-wide, not per-bucket),
 *            zero-padded to 4 digits; grows past 4 digits naturally if ever
 *            needed instead of colliding.
 *
 * Codes minted before this format change look like "2606cpgm0001" (no
 * dashes, lowercase) — those are left as-is in storage/display; only newly
 * minted codes use this format.
 */

export type MemberCodeRole = "guest" | "host";

export function normalizeGenderChar(gender: string | null | undefined): "M" | "F" | "X" {
  const g = String(gender ?? "")
    .trim()
    .toLowerCase();
  if (g === "male" || g === "m") return "M";
  if (g === "female" || g === "f") return "F";
  return "X";
}

export function formatMemberCode(input: {
  createdAt: Date;
  role: MemberCodeRole;
  gender: string | null | undefined;
  sequence: number;
}): string {
  const yy = String(input.createdAt.getUTCFullYear()).slice(-2);
  const mm = String(input.createdAt.getUTCMonth() + 1).padStart(2, "0");
  const roleChar = input.role === "host" ? "H" : "G";
  const genderChar = normalizeGenderChar(input.gender);
  const seq = String(Math.max(0, input.sequence));
  const seqPadded = seq.length >= 4 ? seq : seq.padStart(4, "0");
  return `${yy}${mm}-CP${roleChar}${genderChar}-${seqPadded}`;
}
