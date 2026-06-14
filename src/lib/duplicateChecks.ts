/** Normalizes a license/plate number for comparison: uppercase, alphanumeric only. */
export function normalizeCode(value: string): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Checks whether a candidate vehicle's plate number matches an existing vehicle
 * (excluding `excludeId`, used when editing an existing record).
 */
export function findDuplicateVehicle(
  candidate: { plateNumber: string },
  existing: { id: string; plateNumber: string }[],
  excludeId?: string | null,
): boolean {
  const plate = normalizeCode(candidate.plateNumber);
  return existing.some((v) => v.id !== excludeId && plate && normalizeCode(v.plateNumber) === plate);
}
