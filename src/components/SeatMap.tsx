import { useState } from "react";
import type { SeatSlot } from "@/lib/seatLayout";
import { cn } from "@/lib/utils";
import { Check, Mars, Venus } from "lucide-react";
import type { PassengerGender } from "@/lib/domain";
import { Skeleton } from "@/components/ui/skeleton";
import sedanInterior from "@/assets/sedan-interior-v3.webp";
import suvInterior from "@/assets/suv-interior.webp";

interface SeatMapProps {
  slots: SeatSlot[];
  occupiedCodes: ReadonlySet<string>;
  occupiedGenderByCode?: ReadonlyMap<string, PassengerGender>;
  selectedCodes: ReadonlySet<string>;
  onTogglePassengerSeat: (seatCode: string) => void;
  maxSelectable: number;
  disabled?: boolean;
  seatConfig?: string[];
}

/**
 * Map coordinates for the final high-quality 5-seater RHD interior.
 * Facing UP orientation, no rear armrest.
 */
const COORDINATES: Record<string, { top: string; left: string }> = {
  // SEDAN (5 Seats) - Facing UP
  "SEDAN-R0-C0": { top: "42%", left: "32%" }, // Front L (Pass)
  "SEDAN-R0-C1": { top: "42%", left: "68%" }, // Front R (Drv)
  "SEDAN-R1-C0": { top: "80%", left: "27%" }, // Back L
  "SEDAN-R1-C1": { top: "80%", left: "50%" }, // Back C
  "SEDAN-R1-C2": { top: "80%", left: "73%" }, // Back R

  // SUV (6-7 Seats)
  "SUV-R0-C0": { top: "45.2%", left: "34%" },
  "SUV-R0-C1": { top: "45.2%", left: "66%" },
  "SUV-R1-C0": { top: "64.8%", left: "34%" },
  "SUV-R1-C1": { top: "64.8%", left: "66%" },
  "SUV-R2-C0": { top: "88.5%", left: "30%" },
  "SUV-R2-C1": { top: "88.5%", left: "70%" },
  "SUV-R2-C2": { top: "88.5%", left: "50%" },
};

export function SeatMap({
  slots,
  occupiedCodes,
  occupiedGenderByCode,
  selectedCodes,
  onTogglePassengerSeat,
  maxSelectable,
  disabled = false,
  seatConfig,
}: SeatMapProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isLargeVehicle = slots.length >= 6;
  const vType = isLargeVehicle ? "SUV" : "SEDAN";
  const mappedSlots = slots;

  return (
    <div className="space-y-6">
      <div className="relative mx-auto max-w-[450px] aspect-square group">
        {/* Realistic Car Interior Background */}
        <div className="absolute inset-0 rounded-[40px] overflow-hidden shadow-2xl border-8 border-slate-900/10 bg-slate-100">
          {!imageLoaded && <Skeleton className="absolute inset-0 rounded-[32px] bg-slate-200" />}
          <img
            src={isLargeVehicle ? suvInterior : sedanInterior}
            alt="Car Interior"
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={cn(
              "w-full h-full object-cover select-none pointer-events-none transition-all duration-700",
              imageLoaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-lg scale-105",
            )}
          />
          {/* Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 pointer-events-none" />
        </div>

        {/* Interactive Overlays */}
        {imageLoaded &&
          mappedSlots.map((slot) => {
            const seatId = `${vType}-${slot.seatCode}`;

            const pos = COORDINATES[seatId] || { top: "50%", left: "50%" };
            const isDriver = slot.kind === "driver";
            const isBooked = occupiedCodes.has(slot.seatCode);
            const bookedGender = occupiedGenderByCode?.get(slot.seatCode);
            const isOffered =
              !seatConfig || seatConfig.length === 0 || seatConfig.includes(slot.seatCode);
            const isUnavailable = !isDriver && !isOffered;
            const taken = isBooked || isUnavailable;
            const selected = selectedCodes.has(slot.seatCode);
            const canTrySelect =
              !isDriver && !taken && !disabled && (selected || selectedCodes.size < maxSelectable);

            return (
              <div
                key={slot.seatCode}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ top: pos.top, left: pos.left }}
              >
                <button
                  type="button"
                  disabled={
                    isDriver ||
                    taken ||
                    disabled ||
                    (!selected && selectedCodes.size >= maxSelectable)
                  }
                  onClick={() => {
                    if (!isDriver && !taken && !disabled) onTogglePassengerSeat(slot.seatCode);
                  }}
                  className={cn(
                    "relative flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full border-4 transition-all duration-300",
                    "shadow-[0_0_20px_rgba(0,0,0,0.3)]",

                    isDriver && [
                      "cursor-default border-transparent bg-white/10 scale-90",
                      "after:content-[''] after:absolute after:inset-0 after:rounded-full after:border-2 after:border-white/20 after:animate-pulse",
                    ],
                    !isDriver &&
                      isBooked &&
                      !bookedGender && [
                        "cursor-not-allowed border-red-500/40 bg-red-500/10 scale-90",
                        "after:content-[''] after:absolute after:w-full after:h-[2px] after:bg-red-500/60 after:rotate-45",
                      ],
                    !isDriver &&
                      isBooked &&
                      bookedGender === "male" && [
                        "cursor-not-allowed border-blue-400/80 bg-blue-500/60 text-white scale-90",
                      ],
                    !isDriver &&
                      isBooked &&
                      bookedGender === "female" && [
                        "cursor-not-allowed border-pink-400/80 bg-pink-500/60 text-white scale-90",
                      ],
                    !isDriver &&
                      isUnavailable && [
                        "cursor-not-allowed border-slate-400/40 bg-slate-500/40 scale-90",
                      ],
                    !isDriver &&
                      !taken &&
                      selected && [
                        "border-purple-400 bg-purple-600/80 text-white shadow-glow-purple scale-110",
                        "ring-4 ring-purple-600/20",
                      ],
                    !isDriver &&
                      !taken &&
                      !selected &&
                      canTrySelect && [
                        "cursor-pointer border-emerald-400/60 bg-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-500/40 hover:scale-110",
                        "animate-in fade-in zoom-in duration-500",
                      ],
                    !isDriver &&
                      !taken &&
                      !selected &&
                      !canTrySelect && ["cursor-not-allowed border-white/20 bg-white/5"],
                  )}
                >
                  {isDriver ? (
                    <span className="text-xs font-black uppercase text-white/40 tracking-tighter">
                      Host
                    </span>
                  ) : isBooked ? (
                    <span className="flex flex-col items-center text-white drop-shadow-md">
                      {bookedGender === "male" ? <Mars size={18} strokeWidth={3} /> : null}
                      {bookedGender === "female" ? <Venus size={18} strokeWidth={3} /> : null}
                      <span className="text-xs font-bold">{slot.displayLabel}</span>
                    </span>
                  ) : isUnavailable ? (
                    <span className="text-base font-bold text-slate-200 drop-shadow-md">
                      {slot.displayLabel}
                    </span>
                  ) : selected ? (
                    <span className="relative flex items-center justify-center">
                      <span className="text-base font-extrabold text-white drop-shadow-md">
                        {slot.displayLabel}
                      </span>
                      <Check
                        size={12}
                        strokeWidth={4}
                        className="absolute -top-2 -right-3 rounded-full bg-emerald-500 text-white p-0.5"
                      />
                    </span>
                  ) : (
                    <span className="text-base font-bold text-white drop-shadow-md">
                      {slot.displayLabel}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
      </div>

      <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500/60" />
          Available
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-600 shadow-glow-purple" />
          Selected
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500/60 border border-blue-400/80" />
          Male
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500/60 border border-pink-400/80" />
          Female
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
          Booked
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-500/40 border border-slate-400/40" />
          Unavailable
        </div>
      </div>
    </div>
  );
}
