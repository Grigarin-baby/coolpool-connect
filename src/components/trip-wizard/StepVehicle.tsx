import { Car, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriverVehicle } from "@/lib/domain";

interface StepVehicleProps {
  vehicles: DriverVehicle[];
  selectedVehicleId: string | null;
  onChange: (id: string) => void;
  onAddNew: () => void;
}

export function StepVehicle({
  vehicles,
  selectedVehicleId,
  onChange,
  onAddNew,
}: StepVehicleProps) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Choose vehicle
        </p>
        <p className="mt-1 text-xs text-gray-500">
          The car you'll drive for this trip.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          You haven't added a vehicle yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {vehicles.map((v) => {
            const isSelected = v.id === selectedVehicleId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange(v.id)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 text-left transition-all active:scale-[0.98]",
                  isSelected
                    ? "border-primary shadow-[0_4px_20px_rgba(108,92,231,0.18)]"
                    : "border-gray-100 shadow-sm hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                    isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-500",
                  )}
                >
                  <Car size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-gray-900">
                    {v.modelName}
                  </p>
                  <p className="truncate text-xs font-semibold uppercase tracking-widest text-gray-500">
                    {v.plateNumber} · {v.seatCapacity} seats
                  </p>
                </div>
                {isSelected && (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAddNew}
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm font-extrabold uppercase tracking-widest text-primary transition-colors hover:border-primary/70 hover:bg-primary/10"
      >
        <Plus size={16} /> Add new vehicle
      </button>
    </div>
  );
}
