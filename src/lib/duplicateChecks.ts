/** Normalizes a phone number for comparison: digits only, with leading "0" or "91" country code stripped. */
export function normalizePhone(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  while (digits.length > 10 && (digits.startsWith("91") || digits.startsWith("0"))) {
    digits = digits.startsWith("91") ? digits.slice(2) : digits.slice(1);
  }
  return digits;
}

/** Normalizes a license/plate number for comparison: uppercase, alphanumeric only. */
export function normalizeCode(value: string): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Checks whether a candidate driver's phone or license number matches an existing
 * driver (excluding `excludeId`, used when editing an existing record).
 */
export function findDuplicateTeamDriver(
  candidate: { phone: string; licenseNumber: string },
  existing: { id: string; phone: string; licenseNumber: string }[],
  excludeId?: string | null,
): "phone" | "license" | null {
  const phone = normalizePhone(candidate.phone);
  const license = normalizeCode(candidate.licenseNumber);
  for (const d of existing) {
    if (d.id === excludeId) continue;
    if (phone && normalizePhone(d.phone) === phone) return "phone";
    if (license && normalizeCode(d.licenseNumber) === license) return "license";
  }
  return null;
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
