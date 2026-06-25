import { useEffect, useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { cn } from "@/lib/utils";
import { type ClockTime } from "./ClockFacePicker";
import { DigitalTimePicker } from "./DigitalTimePicker";
import { MIN_DEPARTURE_LEAD_MINUTES } from "./types";

interface StepDateTimeProps {
  date: Dayjs | null;
  time: ClockTime | null;
  onDateChange: (date: Dayjs) => void;
  onTimeChange: (time: ClockTime) => void;
}

export function StepDateTime({ date, time, onDateChange, onTimeChange }: StepDateTimeProps) {
  const today = useMemo(() => dayjs().startOf("day"), []);
  const tomorrow = useMemo(() => today.add(1, "day"), [today]);
  // 7 upcoming days starting from day-after-tomorrow
  const upcomingDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => today.add(i + 2, "day")),
    [today],
  );

  // Default to today if nothing selected yet
  useEffect(() => {
    if (!date) onDateChange(today);
  }, [date, today, onDateChange]);

  // Keep the time default and wizard state in sync. Trips must be postable at
  // least MIN_DEPARTURE_LEAD_MINUTES out, so default to the next 15-minute slot
  // after that so Continue is immediately available.
  useEffect(() => {
    if (time) return;
    const next = dayjs().add(MIN_DEPARTURE_LEAD_MINUTES, "minute");
    const roundedMinute = Math.ceil(next.minute() / 15) * 15;
    const defaultTime = next.minute(0).second(0).millisecond(0).add(roundedMinute, "minute");
    if (!defaultTime.isSame(today, "day")) onDateChange(defaultTime.startOf("day"));
    const hour24 = defaultTime.hour();
    const hour12 = hour24 % 12 || 12;
    onTimeChange({
      hour12,
      hour24,
      minute: defaultTime.minute(),
      period: hour24 >= 12 ? "PM" : "AM",
    });
  }, [time, today, onDateChange, onTimeChange]);

  const selected = date ?? today;
  const todaySelected = selected.isSame(today, "day");
  const tomorrowSelected = selected.isSame(tomorrow, "day");

  const selectedDeparture = useMemo(() => {
    if (!date || !time) return null;
    return date.hour(time.hour24).minute(time.minute).second(0).millisecond(0);
  }, [date, time]);
  const tooSoon =
    !!selectedDeparture &&
    !selectedDeparture.isAfter(dayjs().add(MIN_DEPARTURE_LEAD_MINUTES, "minute"));

  return (
    <div className="flex flex-col gap-6 px-4 pb-6">
      {/* ── Date section ── */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          When are you leaving?
        </p>

        {/* Today / Tomorrow big buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onDateChange(today)}
            className={cn(
              "w-full h-16 rounded-2xl text-xl font-black tracking-wide transition-all duration-200 border-2 flex items-center justify-center active:scale-95",
              todaySelected
                ? "bg-gradient-primary !text-white border-transparent shadow-glow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:text-primary",
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onDateChange(tomorrow)}
            className={cn(
              "w-full h-16 rounded-2xl text-xl font-black tracking-wide transition-all duration-200 border-2 flex items-center justify-center active:scale-95",
              tomorrowSelected
                ? "bg-gradient-primary !text-white border-transparent shadow-glow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:text-primary",
            )}
          >
            Tomorrow
          </button>
        </div>

        {/* Next 7 days chips */}
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {upcomingDates.map((d) => {
            const isSelected = d.isSame(selected, "day");
            return (
              <button
                key={d.format("YYYY-MM-DD")}
                type="button"
                aria-label={d.format("dddd, MMMM D")}
                aria-pressed={isSelected}
                onClick={() => onDateChange(d)}
                className={cn(
                  "h-12 rounded-xl border text-center transition-all duration-200 active:scale-95",
                  isSelected
                    ? "bg-gradient-primary !text-white border-transparent shadow-glow-sm scale-[1.03]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "block text-[9px] font-extrabold uppercase tracking-tight leading-none",
                    isSelected ? "!text-white" : "text-gray-500",
                  )}
                >
                  {d.format("ddd")}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-sm font-black leading-none",
                    isSelected && "!text-white",
                  )}
                >
                  {d.format("D")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Time selector (digital, 15-min steps) ── */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          Departure time
        </p>
        <DigitalTimePicker value={time} onChange={onTimeChange} />
        {tooSoon && (
          <p className="mt-3 text-center text-sm font-semibold text-destructive">
            Trips must be scheduled at least {MIN_DEPARTURE_LEAD_MINUTES} minutes from now.
          </p>
        )}
      </div>
    </div>
  );
}
