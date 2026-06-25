import { cn } from "@/lib/utils";
import type { ClockTime } from "./ClockFacePicker";

interface DigitalTimePickerProps {
  value?: ClockTime | null;
  onChange: (time: ClockTime) => void;
  className?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = [0, 15, 30, 45];

function to24h(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

/**
 * Digital departure-time selector. Hour (1–12), minutes in 15-minute steps,
 * and an AM/PM toggle — replaces the clock-face dial.
 */
export function DigitalTimePicker({ value, onChange, className }: DigitalTimePickerProps) {
  const current: ClockTime = value ?? { hour12: 9, hour24: 9, minute: 0, period: "AM" };
  // Snap the displayed minute to the nearest 15 for selection highlighting.
  const snappedMinute = MINUTES.reduce((best, m) =>
    Math.abs(m - current.minute) < Math.abs(best - current.minute) ? m : best,
  MINUTES[0]);

  const emit = (patch: Partial<Pick<ClockTime, "hour12" | "minute" | "period">>) => {
    const hour12 = patch.hour12 ?? current.hour12;
    const minute = patch.minute ?? snappedMinute;
    const period = patch.period ?? current.period;
    onChange({ hour12, minute, period, hour24: to24h(hour12, period) });
  };

  const pill = (active: boolean) =>
    cn(
      "h-11 min-w-[3rem] rounded-2xl border text-base font-bold transition-all",
      active
        ? "bg-gradient-primary !text-white border-transparent shadow-glow-sm"
        : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary",
    );

  return (
    <div className={cn("rounded-3xl border border-gray-100 bg-white p-5 shadow-sm", className)}>
      <div className="flex items-start gap-4">
        {/* Hour */}
        <div className="flex-1">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Hour</p>
          <div className="grid grid-cols-4 gap-1.5">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => emit({ hour12: h })}
                className={pill(current.hour12 === h)}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Minute + AM/PM */}
        <div className="w-28 shrink-0">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Minute</p>
          <div className="grid grid-cols-2 gap-1.5">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => emit({ minute: m })}
                className={pill(snappedMinute === m)}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {(["AM", "PM"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => emit({ period: p })}
                className={pill(current.period === p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-3xl font-black tabular-nums text-gray-900">
        {current.hour12}:{String(snappedMinute).padStart(2, "0")}{" "}
        <span className="text-xl text-primary">{current.period}</span>
      </div>
    </div>
  );
}
