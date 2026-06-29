import { Users, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleSeatCapacity } from "@/lib/seatLayout";

/**
 * Seat IDs matching buildSeatLayout — sedan (5-seater) uses R0-C0..R1-C2,
 * SUV (7-seater) additionally has a 3-seat back row R2-C0..R2-C2. R1-C1
 * ("B2") is the back-center seat on a sedan, or the middle-row-center seat
 * on an SUV; R2-C1 ("C2") is the SUV's back-row-center seat. Both are the
 * "optional" middle seats hosts can choose not to offer.
 */
export type SeatId = "R0-C0" | "R1-C0" | "R1-C1" | "R1-C2" | "R2-C0" | "R2-C1" | "R2-C2";

interface SeatPickerProps {
  seatCapacity?: VehicleSeatCapacity;
  value?: SeatId[];
  onChange?: (seats: SeatId[]) => void;
  disabled?: boolean;
}

function SeatTile({
  id,
  label,
  optional = false,
  isDriver = false,
  isSelected,
  disabled,
  onToggle,
}: {
  id?: SeatId;
  label: string;
  optional?: boolean;
  isDriver?: boolean;
  isSelected: boolean;
  disabled?: boolean;
  onToggle: (id: SeatId) => void;
}) {
  return (
    <div
      onClick={() => id && !disabled && onToggle(id)}
      className={cn(
        "relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300",
        isDriver
          ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
          : isSelected
            ? "bg-primary/10 border-primary shadow-sm scale-105"
            : "bg-white border-dashed border-gray-200 hover:border-primary/40 cursor-pointer",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {isDriver ? (
        <User className="h-6 w-6 text-gray-400" />
      ) : isSelected ? (
        <CheckCircle2 className="h-6 w-6 text-primary animate-in zoom-in-50 duration-300" />
      ) : (
        <Users className="h-6 w-6 text-gray-300" />
      )}
      <span
        className={cn(
          "mt-2 text-[10px] font-bold uppercase tracking-wider",
          isDriver ? "text-gray-400" : isSelected ? "text-primary" : "text-gray-400",
        )}
      >
        {label}
      </span>
      {optional && !isDriver && (
        <span className="mt-0.5 text-[9px] font-semibold text-gray-400">
          {isSelected ? "Offered" : "Tap to offer"}
        </span>
      )}
    </div>
  );
}

export function SeatPicker({ seatCapacity = 5, value = [], onChange, disabled }: SeatPickerProps) {
  const toggleSeat = (id: SeatId) => {
    if (value.includes(id)) {
      onChange?.(value.filter((s) => s !== id));
    } else {
      onChange?.([...value, id]);
    }
  };

  const isSelected = (id: SeatId) => value.includes(id);

  return (
    <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 max-w-sm mx-auto">
      <div className="flex flex-col gap-6">
        {/* FRONT ROW - RHD Layout (Driver on Right) */}
        <div className="grid grid-cols-2 gap-4">
          <SeatTile
            id="R0-C0"
            label="Passenger"
            isSelected={isSelected("R0-C0")}
            disabled={disabled}
            onToggle={toggleSeat}
          />
          <SeatTile label="Driver" isDriver isSelected={false} onToggle={toggleSeat} />
        </div>

        {seatCapacity === 5 ? (
          /* REAR ROW (3 seats) — B2 (Center) is the optional middle seat */
          <div className="grid grid-cols-3 gap-3">
            <SeatTile
              id="R1-C0"
              label="Left"
              isSelected={isSelected("R1-C0")}
              disabled={disabled}
              onToggle={toggleSeat}
            />
            <SeatTile
              id="R1-C1"
              label="Center"
              optional
              isSelected={isSelected("R1-C1")}
              disabled={disabled}
              onToggle={toggleSeat}
            />
            <SeatTile
              id="R1-C2"
              label="Right"
              isSelected={isSelected("R1-C2")}
              disabled={disabled}
              onToggle={toggleSeat}
            />
          </div>
        ) : (
          <>
            {/* MIDDLE ROW (3 seats) — B2 (Center) is the optional middle seat */}
            <div className="grid grid-cols-3 gap-3">
              <SeatTile
                id="R1-C0"
                label="Left"
                isSelected={isSelected("R1-C0")}
                disabled={disabled}
                onToggle={toggleSeat}
              />
              <SeatTile
                id="R1-C1"
                label="Center"
                optional
                isSelected={isSelected("R1-C1")}
                disabled={disabled}
                onToggle={toggleSeat}
              />
              <SeatTile
                id="R1-C2"
                label="Right"
                isSelected={isSelected("R1-C2")}
                disabled={disabled}
                onToggle={toggleSeat}
              />
            </div>

            {/* BACK ROW (3 seats) — C2 (Center) is the true middle seat */}
            <div className="grid grid-cols-3 gap-3">
              <SeatTile
                id="R2-C0"
                label="Left"
                isSelected={isSelected("R2-C0")}
                disabled={disabled}
                onToggle={toggleSeat}
              />
              <SeatTile
                id="R2-C1"
                label="Center"
                optional
                isSelected={isSelected("R2-C1")}
                disabled={disabled}
                onToggle={toggleSeat}
              />
              <SeatTile
                id="R2-C2"
                label="Right"
                isSelected={isSelected("R2-C2")}
                disabled={disabled}
                onToggle={toggleSeat}
              />
            </div>
          </>
        )}

        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-500">
            Total capacity: <span className="text-primary font-bold">{value.length} travelers</span>
          </p>
        </div>
      </div>
    </div>
  );
}
