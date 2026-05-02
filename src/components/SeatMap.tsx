import type { SeatSlot } from "@/lib/seatLayout";
import { cn } from "@/lib/utils";
import { Gamepad2 as SteeringWheel, Check } from "lucide-react";

interface SeatMapProps {
  slots: SeatSlot[];
  occupiedCodes: ReadonlySet<string>;
  selectedCodes: ReadonlySet<string>;
  onTogglePassengerSeat: (seatCode: string) => void;
  maxSelectable: number;
  disabled?: boolean;
}

export function SeatMap({
  slots,
  occupiedCodes,
  selectedCodes,
  onTogglePassengerSeat,
  maxSelectable,
  disabled = false,
}: SeatMapProps) {
  const rows = [...new Set(slots.map((s) => s.row))].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="relative mx-auto max-w-[300px]">
        {/* Car Chassis */}
        <div className="relative bg-slate-50/80 backdrop-blur-md rounded-[56px] border-[6px] border-slate-200/50 p-8 pb-14 shadow-xl overflow-hidden">
          {/* Windshield / Hood */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-slate-200/30 border-b border-slate-300/30 flex items-center justify-center">
            <div className="w-24 h-1 bg-slate-300/50 rounded-full mb-4" />
          </div>

          <div className="relative z-10 flex flex-col gap-10 mt-12 items-center">
            {rows.map((row) => {
              const rowSlots = slots.filter((s) => s.row === row).sort((a, b) => a.col - b.col);
              return (
                <div key={row} className="flex justify-between gap-10 w-full px-2">
                  {/* Handle 1-seat rows (like a single back seat) by centering or spacing */}
                  {rowSlots.length === 1 && rowSlots[0].col === 1 ? <div className="w-14 md:w-16" /> : null}
                  
                  {rowSlots.map((slot) => {
                    const isDriver = slot.kind === "driver";
                    const taken = occupiedCodes.has(slot.seatCode);
                    const selected = selectedCodes.has(slot.seatCode);
                    const canTrySelect =
                      !isDriver &&
                      !taken &&
                      !disabled &&
                      (selected || selectedCodes.size < maxSelectable);

                    return (
                      <div key={slot.seatCode} className="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          disabled={isDriver || taken || disabled || (!selected && selectedCodes.size >= maxSelectable)}
                          onClick={() => {
                            if (!isDriver && !taken && !disabled) onTogglePassengerSeat(slot.seatCode);
                          }}
                          className={cn(
                            "relative flex h-16 w-14 md:h-20 md:w-16 flex-col items-center justify-center rounded-2xl border-[3px] transition-all duration-300",
                            // Base Seat Shape
                            "before:absolute before:-top-3 before:left-1/2 before:-translate-x-1/2 before:w-8 before:h-4 before:rounded-t-lg before:border-x-[3px] before:border-t-[3px] before:transition-all",
                            
                            isDriver && [
                              "cursor-default border-slate-300 bg-slate-100 text-slate-400 before:border-slate-300 before:bg-slate-100",
                              "shadow-inner"
                            ],
                            !isDriver && taken && [
                              "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 before:border-slate-200 before:bg-slate-50 opacity-40"
                            ],
                            !isDriver && !taken && selected && [
                              "border-purple-600 bg-purple-600 text-white before:border-purple-600 before:bg-purple-600 shadow-glow-purple scale-110 rotate-1",
                              "z-20"
                            ],
                            !isDriver && !taken && !selected && canTrySelect && [
                              "cursor-pointer border-emerald-500/40 bg-white text-emerald-600 before:border-emerald-500/40 before:bg-white hover:border-emerald-500 hover:before:border-emerald-500 hover:scale-105"
                            ],
                            !isDriver && !taken && !selected && !canTrySelect && [
                              "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 before:border-slate-200 before:bg-slate-50"
                            ]
                          )}
                        >
                          {isDriver ? (
                            <SteeringWheel size={24} className="opacity-40 animate-pulse" />
                          ) : taken ? (
                            <span className="text-[10px] font-bold uppercase opacity-40">Sold</span>
                          ) : selected ? (
                            <Check size={28} strokeWidth={3} className="animate-in zoom-in duration-300" />
                          ) : (
                            <span className="text-lg font-bold">{slot.displayLabel}</span>
                          )}
                          
                          {/* Seat Code Label */}
                          {!isDriver && !taken && !selected && (
                            <span className="absolute -bottom-6 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {slot.seatCode}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          
          {/* Rear of car styling */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-slate-200/50" />
        </div>

        {/* Dashboard Indicator */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-6 py-1 bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-lg z-20">
          Front
        </div>
      </div>

      <div className="flex justify-center gap-6 text-[11px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2 text-emerald-600">
          <div className="w-3 h-3 rounded-sm bg-white border-2 border-emerald-500/40" />
          Available
        </div>
        <div className="flex items-center gap-2 text-purple-600">
          <div className="w-3 h-3 rounded-sm bg-purple-600 shadow-glow-purple" />
          Selected
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-3 h-3 rounded-sm bg-slate-100 border-2 border-slate-200" />
          Booked
        </div>
      </div>
    </div>
  );
}

