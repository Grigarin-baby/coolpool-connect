export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeEmail(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

export function normalizeLicense(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/[\s-]/g, "")
    .toUpperCase();
}
