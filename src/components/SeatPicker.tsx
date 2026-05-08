import React from "react";
import { Users, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SeatId = "front_p" | "back_l" | "back_c" | "back_r";

interface SeatPickerProps {
  value?: SeatId[];
  onChange?: (seats: SeatId[]) => void;
  disabled?: boolean;
}

export function SeatPicker({ value = [], onChange, disabled }: SeatPickerProps) {
  const toggleSeat = (id: SeatId) => {
    if (disabled) return;
    if (value.includes(id)) {
      onChange?.(value.filter((s) => s !== id));
    } else {
      onChange?.([...value, id]);
    }
  };

  const Seat = ({ id, label, isDriver = false }: { id?: SeatId; label: string; isDriver?: boolean }) => {
    const isSelected = id ? value.includes(id) : false;

    return (
      <div
        onClick={() => id && toggleSeat(id)}
        className={cn(
          "relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300",
          isDriver
            ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
            : isSelected
            ? "bg-primary/10 border-primary shadow-sm scale-105"
            : "bg-white border-dashed border-gray-200 hover:border-primary/40 cursor-pointer",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {isDriver ? (
          <User className="h-6 w-6 text-gray-400" />
        ) : isSelected ? (
          <CheckCircle2 className="h-6 w-6 text-primary animate-in zoom-in-50 duration-300" />
        ) : (
          <Users className="h-6 w-6 text-gray-300" />
        )}
        <span className={cn(
          "mt-2 text-[10px] font-bold uppercase tracking-wider",
          isDriver ? "text-gray-400" : isSelected ? "text-primary" : "text-gray-400"
        )}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 max-w-sm mx-auto">
      <div className="flex flex-col gap-6">
        {/* FRONT ROW */}
        <div className="grid grid-cols-2 gap-4">
          <Seat label="Driver" isDriver />
          <Seat id="front_p" label="Passenger" />
        </div>

        {/* REAR ROW */}
        <div className="grid grid-cols-3 gap-3">
          <Seat id="back_l" label="Left" />
          <Seat id="back_c" label="Center" />
          <Seat id="back_r" label="Right" />
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-500">
            Total capacity: <span className="text-primary font-bold">{value.length} travelers</span>
          </p>
        </div>
      </div>
    </div>
  );
}
