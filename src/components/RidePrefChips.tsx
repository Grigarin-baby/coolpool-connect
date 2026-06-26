import type { RidePreferences } from "@/lib/domain";

// Color-coded ride preference pills using the brand indication icons
// (green = allowed, red = not allowed). Shown on search result cards, the
// booking page, and the host dashboard.

const SIZES = {
  sm: { chip: "gap-1 pl-1 pr-2 py-0.5 text-[10px]", icon: 18 },
  md: { chip: "gap-1.5 pl-1.5 pr-2.5 py-1 text-xs", icon: 22 },
} as const;

const PREF_ICONS = {
  smoking: { ok: "/prefs/smoking-ok.png", no: "/prefs/no-smoking.png" },
  alcohol: { ok: "/prefs/alcohol-ok.png", no: "/prefs/no-alcohol.png" },
  music: { ok: "/prefs/music-ok.png", no: "/prefs/no-music.png" },
  pets: { ok: "/prefs/pets-ok.png", no: "/prefs/no-pets.png" },
} as const;

function Chip({
  allowed,
  iconSrc,
  label,
  size,
}: {
  allowed: boolean;
  iconSrc: string;
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
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={SIZES[size].icon}
        height={SIZES[size].icon}
        className="shrink-0 object-contain"
        style={{ width: SIZES[size].icon, height: SIZES[size].icon }}
      />
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
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <Chip
        allowed={prefs.smokingAllowed}
        iconSrc={prefs.smokingAllowed ? PREF_ICONS.smoking.ok : PREF_ICONS.smoking.no}
        label={prefs.smokingAllowed ? "Smoking OK" : "No smoking"}
        size={size}
      />
      <Chip
        allowed={prefs.alcoholAllowed}
        iconSrc={prefs.alcoholAllowed ? PREF_ICONS.alcohol.ok : PREF_ICONS.alcohol.no}
        label={prefs.alcoholAllowed ? "Alcohol OK" : "No alcohol"}
        size={size}
      />
      <Chip
        allowed={prefs.musicAllowed}
        iconSrc={prefs.musicAllowed ? PREF_ICONS.music.ok : PREF_ICONS.music.no}
        label={prefs.musicAllowed ? "Music" : "No music"}
        size={size}
      />
      <Chip
        allowed={prefs.petsAllowed}
        iconSrc={prefs.petsAllowed ? PREF_ICONS.pets.ok : PREF_ICONS.pets.no}
        label={prefs.petsAllowed ? "Pets OK" : "No pets"}
        size={size}
      />
    </div>
  );
}
