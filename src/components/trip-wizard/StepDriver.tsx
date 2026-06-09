import { Check, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverOption {
  id: string;
  fullName: string;
  phone?: string;
  isYou?: boolean;
}

interface StepDriverProps {
  drivers: DriverOption[];
  selectedDriverId: string | null;
  onChange: (id: string) => void;
  onAddNew: () => void;
}

export function StepDriver({
  drivers,
  selectedDriverId,
  onChange,
  onAddNew,
}: StepDriverProps) {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Who will drive?
        </p>
        <p className="mt-1 text-xs text-gray-500">
          You or a team driver you've added.
        </p>
      </div>

      <div className="space-y-2.5">
        {drivers.map((d) => {
          const isSelected = d.id === selectedDriverId;
          const initial = (d.fullName || "?").trim().charAt(0).toUpperCase();
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onChange(d.id)}
              className={cn(
                "flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 text-left transition-all active:scale-[0.98]",
                isSelected
                  ? "border-primary shadow-[0_4px_20px_rgba(108,92,231,0.18)]"
                  : "border-gray-100 shadow-sm hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-black",
                  isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-500",
                )}
              >
                {initial || <UserRound size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black text-gray-900">
                  {d.fullName}
                  {d.isYou && (
                    <span className="ml-2 align-middle rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-primary">
                      You
                    </span>
                  )}
                </p>
                {d.phone && (
                  <p className="truncate text-xs text-gray-500">{d.phone}</p>
                )}
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

      <button
        type="button"
        onClick={onAddNew}
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm font-extrabold uppercase tracking-widest text-primary transition-colors hover:border-primary/70 hover:bg-primary/10"
      >
        <Plus size={16} /> Add new driver
      </button>
    </div>
  );
}
