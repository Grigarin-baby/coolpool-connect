/**
 * Human-readable vehicle ID: CPVH-XXXX, e.g. plate "AP01AB1234" -> "CPVH-1234".
 * Derived straight from the plate's last 4 characters (cleaned of spaces/
 * dashes, uppercased) — no sequence, no time component. Not guaranteed
 * globally unique (two plates could share a last-4); it's a friendly label,
 * not a primary key — the real Appwrite vehicle id stays that.
 */
export function formatVehicleCode(plateNumber: string | null | undefined): string {
  const cleaned = String(plateNumber ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const tail = cleaned.slice(-4).padStart(4, "0");
  return `CPVH-${tail}`;
}
