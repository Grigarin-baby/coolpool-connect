import { useEffect, useRef } from "react";
import { SeatPicker, type SeatId } from "@/components/SeatPicker";
import {
  buildSeatLayout,
  defaultOfferedSeatCodes,
  type VehicleSeatCapacity,
} from "@/lib/seatLayout";

interface StepSeatsProps {
  /** The selected vehicle's seat count — picks the sedan (5) or SUV (7) shape. */
  seatCapacity: VehicleSeatCapacity;
  seatConfig: SeatId[];
  pricePerSeat: number | null;
  onSeatsChange: (seats: SeatId[]) => void;
  onPriceChange: (price: number | null) => void;
}

export function StepSeats({
  seatCapacity,
  seatConfig,
  pricePerSeat,
  onSeatsChange,
  onPriceChange,
}: StepSeatsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Default to every seat except the optional B2/C2 middle seats — and
  // re-default if the chosen vehicle's shape no longer matches the current
  // selection (e.g. host switches from a 5- to a 7-seater).
  useEffect(() => {
    const validCodes = new Set(buildSeatLayout(seatCapacity).map((s) => s.seatCode));
    const matchesShape = seatConfig.every((code) => validCodes.has(code));
    if (seatConfig.length === 0 || !matchesShape) {
      onSeatsChange(defaultOfferedSeatCodes(seatCapacity) as SeatId[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatCapacity]);

  return (
    <div className="flex flex-col gap-3 px-4 pb-2 pt-0">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Available seats</p>
      </div>

      {/* Seat picker */}
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <SeatPicker seatCapacity={seatCapacity} value={seatConfig} onChange={onSeatsChange} />
      </div>

      {/* Price per seat input */}
      <div
        className="mx-auto min-h-36 w-full max-w-sm rounded-3xl border-2 border-primary/30 bg-white shadow-sm focus-within:border-primary transition-colors cursor-text overflow-hidden"
        onClick={() => inputRef.current?.focus()}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 pt-3">
          Price per seat
        </p>
        <div className="flex min-h-24 items-center justify-center gap-3 px-5 pb-4">
          <span className="text-6xl font-black text-gray-300 leading-none">₹</span>
          <input
            ref={inputRef}
            type="number"
            min={1}
            inputMode="numeric"
            value={pricePerSeat ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPriceChange(v === "" ? null : Math.max(1, Number(v)));
            }}
            placeholder="0"
            style={{ fontSize: "clamp(4.5rem, 21vw, 6.5rem)", lineHeight: 1 }}
            className="trip-wizard-price-input flex-1 font-black text-gray-900 bg-transparent outline-none tabular-nums placeholder:text-gray-200 min-w-0"
          />
        </div>
      </div>
    </div>
  );
}
