import { Cigarette, Wine, Music2, VolumeX, PawPrint, Headphones } from "lucide-react";
import type { ReactNode } from "react";
import type { RidePreferences } from "@/lib/domain";

// Color-coded ride preference pills: green = allowed, red = not allowed.
// Shown on search result cards, the booking page, and the host dashboard.

const SIZES = {
  sm: { chip: "gap-1 px-2 py-0.5 text-[10px]", icon: 11 },
  md: { chip: "gap-1.5 px-2.5 py-1 text-xs", icon: 13 },
} as const;

function Chip({
  allowed,
  icon,
  label,
  size,
}: {
  allowed: boolean;
  icon: ReactNode;
  label: string;
  size: keyof typeof SIZES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${SIZES[size].chip} ${
        allowed
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-rose-50 text-rose-600 border-rose-200"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

export function RidePrefChips({
  prefs,
  size = "sm",
  className = "",
}: {
  prefs: RidePreferences;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const iconSize = SIZES[size].icon;
  const musicLabel = prefs.musicAllowed ? "Music" : "Quiet ride";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <Chip
        allowed={prefs.smokingAllowed}
        icon={<Cigarette size={iconSize} />}
        label={prefs.smokingAllowed ? "Smoking OK" : "No smoking"}
        size={size}
      />
      <Chip
        allowed={prefs.alcoholAllowed}
        icon={<Wine size={iconSize} />}
        label={prefs.alcoholAllowed ? "Alcohol OK" : "No alcohol"}
        size={size}
      />
      <Chip
        allowed={prefs.musicAllowed}
        icon={prefs.musicAllowed ? <Music2 size={iconSize} /> : <VolumeX size={iconSize} />}
        label={musicLabel}
        size={size}
      />
      {prefs.musicAllowed && prefs.musicOnly && (
        <Chip
          allowed
          icon={<Headphones size={iconSize} />}
          label="Music only"
          size={size}
        />
      )}
      <Chip
        allowed={prefs.petsAllowed}
        icon={<PawPrint size={iconSize} />}
        label={prefs.petsAllowed ? "Pets OK" : "No pets"}
        size={size}
      />
    </div>
  );
}
