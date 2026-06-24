/**
 * Host tiers based on completed trips. A host levels up as they complete more
 * rides, shown as a badge on the host's public card and their dashboard.
 *
 * Thresholds (completed trips → tier):
 *   <10 New host · 10 Intermediate · 25 Silver · 50 Gold · 60 Diamond
 *   75 Platinum · 100 Versatile
 */
export interface HostTier {
  label: string;
  minTrips: number;
  /** Tailwind classes for the badge (text + background). */
  badgeClass: string;
}

const TIERS: HostTier[] = [
  { label: "Versatile", minTrips: 100, badgeClass: "bg-fuchsia-100 text-fuchsia-700" },
  { label: "Platinum", minTrips: 75, badgeClass: "bg-violet-100 text-violet-700" },
  { label: "Diamond", minTrips: 60, badgeClass: "bg-cyan-100 text-cyan-700" },
  { label: "Gold", minTrips: 50, badgeClass: "bg-amber-100 text-amber-700" },
  { label: "Silver", minTrips: 25, badgeClass: "bg-slate-200 text-slate-700" },
  { label: "Intermediate", minTrips: 10, badgeClass: "bg-blue-100 text-blue-700" },
  { label: "New host", minTrips: 0, badgeClass: "bg-gray-100 text-gray-500" },
];

export function getHostTier(completedTrips: number): HostTier {
  const trips = Math.max(0, Math.floor(completedTrips || 0));
  return TIERS.find((tier) => trips >= tier.minTrips) ?? TIERS[TIERS.length - 1];
}

/** Trips needed to reach the next tier, or null if already at the top. */
export function tripsToNextTier(completedTrips: number): { tier: HostTier; remaining: number } | null {
  const trips = Math.max(0, Math.floor(completedTrips || 0));
  const higher = TIERS.filter((t) => t.minTrips > trips).sort((a, b) => a.minTrips - b.minTrips);
  const next = higher[0];
  if (!next) return null;
  return { tier: next, remaining: next.minTrips - trips };
}
