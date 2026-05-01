import type { SeatSlot } from "@/lib/seatLayout";
import { cn } from "@/lib/utils";

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
    <div className="space-y-4">
      <div className="rounded-none border border-border/60 bg-card/60 p-4 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Vehicle layout (front at top)
        </p>
        <div className="flex flex-col gap-4 items-center">
          {rows.map((row) => {
            const rowSlots = slots.filter((s) => s.row === row).sort((a, b) => a.col - b.col);
            return (
              <div key={row} className="flex flex-wrap justify-center gap-3">
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
                    <button
                      key={slot.seatCode}
                      type="button"
                      disabled={isDriver || taken || disabled || (!selected && selectedCodes.size >= maxSelectable)}
                      onClick={() => {
                        if (!isDriver && !taken && !disabled) onTogglePassengerSeat(slot.seatCode);
                      }}
                      title={
                        isDriver
                          ? "Driver"
                          : taken
                            ? "Taken"
                            : selected
                              ? "Selected — tap to clear"
                              : "Available"
                      }
                      className={cn(
                        "relative flex h-14 w-14 md:h-16 md:w-16 flex-col items-center justify-center rounded-none border-2 text-xs font-semibold transition-all",
                        isDriver &&
                          "cursor-default border-muted bg-muted/40 text-muted-foreground opacity-70",
                        !isDriver &&
                          taken &&
                          "cursor-not-allowed border-muted bg-muted/30 text-muted-foreground opacity-50",
                        !isDriver &&
                          !taken &&
                          selected &&
                          "border-primary bg-primary/15 text-primary shadow-soft scale-[1.02]",
                        !isDriver &&
                          !taken &&
                          !selected &&
                          canTrySelect &&
                          "cursor-pointer border-border bg-background hover:border-primary/50 hover:bg-primary/5",
                        !isDriver &&
                          !taken &&
                          !selected &&
                          !canTrySelect &&
                          "cursor-not-allowed border-border/60 bg-muted/20 text-muted-foreground opacity-80",
                      )}
                    >
                      <span className="leading-none">{slot.displayLabel}</span>
                      {!isDriver && !taken && (
                        <span className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                          {slot.seatCode}
                        </span>
                      )}
                      {taken && (
                        <span className="absolute bottom-1 text-[9px] font-medium uppercase text-muted-foreground">
                          Taken
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Faded seats are already booked. Driver seat is not selectable.
      </p>
    </div>
  );
}

