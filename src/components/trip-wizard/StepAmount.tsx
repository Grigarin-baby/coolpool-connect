import type { SeatId } from "@/components/SeatPicker";

interface StepAmountProps {
  pricePerSeat: number | null;
  seatConfig: SeatId[];
  onChange: (val: number) => void;
}

export function StepAmount({ pricePerSeat, seatConfig, onChange }: StepAmountProps) {
  const seats = seatConfig.length;
  const total = (pricePerSeat ?? 0) * seats;

  return (
    <div className="flex flex-col items-center gap-6 px-4 pb-6 pt-2">
      <div className="w-full text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Price per seat
        </p>
        <p className="mt-1 text-xs text-gray-500">
          The total earnings update automatically.
        </p>
      </div>

      <div className="flex w-full items-center justify-center gap-2">
        <span className="text-5xl font-black text-gray-300">₹</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={pricePerSeat ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) return onChange(0);
            const n = Math.max(0, Math.min(9999, Number(raw)));
            onChange(n);
          }}
          placeholder="0"
          className="w-48 border-b-4 border-primary/30 bg-transparent text-center text-7xl font-black text-gray-900 outline-none focus:border-primary"
        />
      </div>

      <div className="w-full rounded-3xl border border-gray-100 bg-white p-4 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Total for the trip
        </p>
        <p className="mt-1 text-3xl font-black text-primary tabular-nums">
          ₹{total.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {seats} seat{seats === 1 ? "" : "s"} × ₹{pricePerSeat ?? 0}
        </p>
      </div>
    </div>
  );
}
