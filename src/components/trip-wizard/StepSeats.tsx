import { SeatPicker, type SeatId } from "@/components/SeatPicker";

interface StepSeatsProps {
  seatConfig: SeatId[];
  onChange: (seats: SeatId[]) => void;
}

export function StepSeats({ seatConfig, onChange }: StepSeatsProps) {
  return (
    <div className="flex flex-col gap-6 px-4 pb-6 pt-2">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Available seats
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Tap each seat you want to offer passengers.
        </p>
      </div>

      <div className="mx-auto w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <SeatPicker value={seatConfig} onChange={onChange} />
      </div>

      <div className="text-center">
        <p className="text-5xl font-black text-gray-900 tabular-nums">{seatConfig.length}</p>
        <p className="text-sm font-semibold text-gray-500">
          seat{seatConfig.length === 1 ? "" : "s"} selected
        </p>
      </div>
    </div>
  );
}
