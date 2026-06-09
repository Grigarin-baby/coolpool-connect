import { useEffect, useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { cn } from "@/lib/utils";
import { ClockFacePicker, type ClockTime } from "./ClockFacePicker";

interface StepDateTimeProps {
  date: Dayjs | null;
  time: ClockTime | null;
  onDateChange: (date: Dayjs) => void;
  onTimeChange: (time: ClockTime) => void;
}

export function StepDateTime({ date, time, onDateChange, onTimeChange }: StepDateTimeProps) {
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayjs().startOf("day").add(i, "day")),
    [],
  );

  // Apply Today as the default when the parent hasn't picked anything yet.
  useEffect(() => {
    if (!date) onDateChange(dates[0]);
  }, [date, dates, onDateChange]);

  const selected = date ?? dates[0];

  return (
    <div className="flex flex-col gap-6 px-4 pb-6">
      {/* Date chips */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">When</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {dates.map((d, idx) => {
            const isSelected = d.isSame(selected, "day");
            const topLabel = idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : d.format("ddd");
            return (
              <button
                key={d.format("YYYY-MM-DD")}
                type="button"
                onClick={() => onDateChange(d)}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border py-2.5 transition-all duration-200 active:scale-95",
                  isSelected
                    ? "bg-gradient-primary !text-white border-transparent shadow-glow-sm scale-[1.02]"
                    : "bg-white text-gray-700 border-gray-200 hover:border-primary/40 hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase tracking-tight leading-none",
                    isSelected && "!text-white",
                  )}
                >
                  {topLabel}
                </span>
                <span
                  className={cn(
                    "mt-1 text-lg font-black leading-none tabular-nums",
                    isSelected && "!text-white",
                  )}
                >
                  {d.format("D")}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-[10px] font-semibold uppercase tracking-tight leading-none text-gray-400",
                    isSelected && "!text-white/80",
                  )}
                >
                  {d.format("MMM")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time clock */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          Departure time
        </p>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <ClockFacePicker value={time} onChange={onTimeChange} size={260} />
        </div>
      </div>
    </div>
  );
}
