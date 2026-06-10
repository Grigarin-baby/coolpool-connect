import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export interface ClockTime {
  hour12: number; // 1..12
  hour24: number; // 0..23
  minute: number; // 0..59
  period: "AM" | "PM";
}

interface ClockFacePickerProps {
  value?: ClockTime | null;
  onChange: (time: ClockTime) => void;
  size?: number;
  className?: string;
}

const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const FACE_RADIUS = 140;
const NUMBER_RADIUS = 112;
const HAND_RADIUS = 96;
const SELECT_DOT_RADIUS = 22;

function to12h(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12;
  return { hour12: h === 0 ? 12 : h, period };
}

function to24h(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function position(clockAngleDeg: number, radius: number) {
  const rad = ((clockAngleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function clockAngleFromPoint(x: number, y: number) {
  const dx = x - CENTER;
  const dy = y - CENTER;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return deg;
}

function snapHour(deg: number): number {
  const sector = Math.round(deg / 30) % 12;
  return sector === 0 ? 12 : sector;
}

function snapMinute(deg: number): number {
  const sector = Math.round(deg / 6) % 60;
  return sector;
}

export function ClockFacePicker({ value, onChange, size = 280, className }: ClockFacePickerProps) {
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const initial: ClockTime = value ?? { hour12: 9, hour24: 9, minute: 0, period: "AM" };
  const [draft, setDraft] = useState<ClockTime>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  // Keep internal draft in sync when parent value changes externally
  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);

  const apply = useCallback(
    (next: ClockTime) => {
      setDraft(next);
      onChange(next);
    },
    [onChange],
  );

  const updateFromPoint = useCallback(
    (clientX: number, clientY: number, isFinal: boolean) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * VIEWBOX;
      const y = ((clientY - rect.top) / rect.height) * VIEWBOX;
      const deg = clockAngleFromPoint(x, y);

      if (mode === "hour") {
        const hour12 = snapHour(deg);
        apply({
          ...draft,
          hour12,
          hour24: to24h(hour12, draft.period),
        });
        // Auto-advance to minute mode only when the gesture ends (so dragging
        // around the hour ring doesn't keep flipping the mode).
        if (isFinal) setMode("minute");
      } else {
        const minute = snapMinute(deg);
        apply({ ...draft, minute });
      }
    },
    [apply, draft, mode],
  );

  const handlePointerDown = (e: PointerEvent<SVGSVGElement>) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromPoint(e.clientX, e.clientY, false);
  };
  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    updateFromPoint(e.clientX, e.clientY, false);
  };
  const handlePointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    updateFromPoint(e.clientX, e.clientY, true);
  };

  const setPeriod = (period: "AM" | "PM") => {
    if (period === draft.period) return;
    apply({
      ...draft,
      period,
      hour24: to24h(draft.hour12, period),
    });
  };

  // Numbers around the face
  const numbers =
    mode === "hour"
      ? Array.from({ length: 12 }, (_, i) => ({
          value: i + 1,
          label: String(i + 1),
          angle: ((i + 1) % 12) * 30,
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          value: i * 5,
          label: String(i * 5).padStart(2, "0"),
          angle: i * 30,
        }));

  // Hand position
  const handAngleDeg =
    mode === "hour" ? (draft.hour12 % 12) * 30 : draft.minute * 6;
  const handEnd = position(handAngleDeg, HAND_RADIUS);

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      {/* Read-out + inline AM/PM toggle */}
      <div className="flex items-center gap-2">
        {/* Time digits */}
        <div className="flex items-center gap-1 text-5xl font-black tabular-nums tracking-tight">
          <button
            type="button"
            onClick={() => setMode("hour")}
            className={cn(
              "rounded-xl px-3 py-1 transition-colors",
              mode === "hour"
                ? "bg-primary/10 text-primary"
                : "text-gray-700 hover:text-gray-900",
            )}
            aria-label={`Edit hour (currently ${draft.hour12})`}
          >
            {String(draft.hour12).padStart(2, "0")}
          </button>
          <span className="text-gray-300">:</span>
          <button
            type="button"
            onClick={() => setMode("minute")}
            className={cn(
              "rounded-xl px-3 py-1 transition-colors",
              mode === "minute"
                ? "bg-primary/10 text-primary"
                : "text-gray-700 hover:text-gray-900",
            )}
            aria-label={`Edit minute (currently ${draft.minute})`}
          >
            {String(draft.minute).padStart(2, "0")}
          </button>
        </div>

        {/* AM / PM toggle — always visible next to the time */}
        <div className="flex flex-col gap-1 ml-1">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "w-12 rounded-lg text-sm font-bold py-1 transition-all",
                draft.period === p
                  ? "bg-gradient-primary !text-white shadow-sm"
                  : "bg-gray-100 text-gray-400 hover:text-gray-700",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Face */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none select-none cursor-pointer"
        role="application"
        aria-label={`Clock face — tap to set ${mode}`}
      >
        <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="rgb(243 244 246)" />

        {/* Hand */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={handEnd.x}
          y2={handEnd.y}
          stroke="oklch(0.55 0.25 290)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx={handEnd.x}
          cy={handEnd.y}
          r={SELECT_DOT_RADIUS}
          fill="oklch(0.55 0.25 290)"
        />
        <circle cx={CENTER} cy={CENTER} r="5" fill="oklch(0.55 0.25 290)" />

        {/* Numbers */}
        {numbers.map((n) => {
          const isSelected =
            mode === "hour" ? n.value === draft.hour12 : n.value === draft.minute;
          // Selected number sits on the dot (HAND_RADIUS); others stay on the ring
          const p = position(n.angle, isSelected ? HAND_RADIUS : NUMBER_RADIUS);
          return (
            <text
              key={n.value}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn(
                "pointer-events-none select-none font-bold",
                isSelected ? "fill-white" : "fill-gray-700",
              )}
              style={{ fontSize: mode === "hour" ? 22 : 18 }}
            >
              {n.label}
            </text>
          );
        })}
      </svg>

    </div>
  );
}
