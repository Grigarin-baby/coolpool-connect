import { useEffect } from "react";
import dayjs from "dayjs";
import { Car, UserRound } from "lucide-react";
import type { DriverVehicle } from "@/lib/domain";
import type { PlacePoint, RouteAlternative, WizardStop } from "./types";
import type { ClockTime } from "./ClockFacePicker";
import type { Dayjs } from "dayjs";
import type { SeatId } from "@/components/SeatPicker";

interface DriverOption {
  id: string;
  fullName: string;
  isYou?: boolean;
}

interface StepReviewProps {
  from: PlacePoint;
  to: PlacePoint;
  alternative: RouteAlternative;
  stops: WizardStop[];
  date: Dayjs;
  time: ClockTime;
  pricePerSeat: number;
  seatConfig: SeatId[];
  vehicle: DriverVehicle;
  driver: DriverOption;
  segmentPrices: Record<string, number>;
  onSegmentPricesChange: (prices: Record<string, number>) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Shorten a full place label to just the city/locality part */
function shortLabel(label: string): string {
  return label.split(",")[0].trim();
}

export function StepReview({
  from,
  to,
  alternative,
  stops,
  date,
  time,
  pricePerSeat,
  seatConfig,
  vehicle,
  driver,
  segmentPrices,
  onSegmentPricesChange,
}: StepReviewProps) {
  const departure = date.hour(time.hour24).minute(time.minute).second(0).millisecond(0);
  const totalKm = alternative.distanceKm;
  const totalMin = Math.round(alternative.durationMin);

  // Ordered stop list: origin → intermediates (sorted by distance) → destination
  const allStops: { label: string; distanceFromOriginKm: number }[] = [
    { label: from.label, distanceFromOriginKm: 0 },
    ...stops
      .slice()
      .sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm),
    { label: to.label, distanceFromOriginKm: totalKm },
  ];

  const lastIdx = allStops.length - 1;

  // Build every forward segment pair
  type Seg = {
    key: string;
    fromLabel: string;
    toLabel: string;
    fromIdx: number;
    toIdx: number;
    distanceKm: number;
    durationMin: number;
    departAt: Dayjs;
    arriveAt: Dayjs;
    isFullTrip: boolean;
  };

  const segments: Seg[] = [];
  for (let i = 0; i < allStops.length - 1; i++) {
    for (let j = i + 1; j < allStops.length; j++) {
      const segKm = allStops[j].distanceFromOriginKm - allStops[i].distanceFromOriginKm;
      const segMin = Math.round((segKm / totalKm) * totalMin);
      const departOffsetMin = Math.round((allStops[i].distanceFromOriginKm / totalKm) * totalMin);
      const arriveOffsetMin = Math.round((allStops[j].distanceFromOriginKm / totalKm) * totalMin);
      segments.push({
        key: `${i}-${j}`,
        fromLabel: allStops[i].label,
        toLabel: allStops[j].label,
        fromIdx: i,
        toIdx: j,
        distanceKm: Math.round(segKm * 10) / 10,
        durationMin: segMin,
        departAt: departure.add(departOffsetMin, "minute"),
        arriveAt: departure.add(arriveOffsetMin, "minute"),
        isFullTrip: i === 0 && j === lastIdx,
      });
    }
  }

  // Full trip first, then sub-segments in route order
  segments.sort((a, b) => {
    if (a.isFullTrip) return -1;
    if (b.isFullTrip) return 1;
    return a.fromIdx !== b.fromIdx ? a.fromIdx - b.fromIdx : a.toIdx - b.toIdx;
  });

  // Auto-initialise prices proportionally when entering review step
  useEffect(() => {
    if (Object.keys(segmentPrices).length > 0) return;
    const init: Record<string, number> = {};
    segments.forEach((seg) => {
      init[seg.key] = seg.isFullTrip
        ? pricePerSeat
        : Math.round((seg.distanceKm / totalKm) * pricePerSeat);
    });
    onSegmentPricesChange(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePrice = (key: string, raw: string) => {
    const n = parseInt(raw, 10);
    onSegmentPricesChange({ ...segmentPrices, [key]: isNaN(n) ? 0 : Math.max(0, n) });
  };

  const fullTripKey = `0-${lastIdx}`;
  const subSegments = segments.filter((s) => !s.isFullTrip);
  const fullSeg = segments.find((s) => s.isFullTrip);

  return (
    <div className="flex flex-col px-5 pb-6 pt-3">

      {/* ── MAIN ROUTE (full trip) ── */}
      {fullSeg && (
        <div className="flex items-start justify-between gap-3 pb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-gray-900">{shortLabel(fullSeg.fromLabel)}</span>
              <span className="text-gray-300 font-bold">→</span>
              <span className="text-base font-black text-gray-900">{shortLabel(fullSeg.toLabel)}</span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              {fullSeg.distanceKm} km · {formatDuration(fullSeg.durationMin)}
            </p>
            <p className="text-xs text-gray-400">
              {fullSeg.departAt.format("ddd, MMM D · h:mm A")}
              {" → "}
              {fullSeg.arriveAt.format("h:mm A")}
            </p>
          </div>
          {/* Price box — right aligned */}
          <PriceInput
            value={segmentPrices[fullTripKey]}
            onChange={(v) => updatePrice(fullTripKey, v)}
            highlight
          />
        </div>
      )}

      {/* ── SUB-SEGMENTS ── */}
      {subSegments.length > 0 && (
        <>
          <div className="border-t border-gray-100 mb-3" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            Segment prices
          </p>
          <div className="flex flex-col gap-0">
            {subSegments.map((seg, idx) => (
              <div key={seg.key}>
                {idx > 0 && <div className="border-t border-gray-50 my-0" />}
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-800">{shortLabel(seg.fromLabel)}</span>
                      <span className="text-gray-300 text-xs">→</span>
                      <span className="text-sm font-bold text-gray-800">{shortLabel(seg.toLabel)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {seg.distanceKm} km · {formatDuration(seg.durationMin)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {seg.departAt.format("h:mm A")} → {seg.arriveAt.format("h:mm A")}
                    </p>
                  </div>
                  <PriceInput
                    value={segmentPrices[seg.key]}
                    onChange={(v) => updatePrice(seg.key, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── VEHICLE + DRIVER ── */}
      <div className="border-t border-gray-100 mt-2 pt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <Car size={13} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-700">{vehicle.modelName}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{vehicle.plateNumber}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <UserRound size={13} className="text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-700">{driver.fullName}</span>
          {driver.isYou && (
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{seatConfig.length} seat{seatConfig.length > 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

/** Reusable uniform price input box */
function PriceInput({
  value,
  onChange,
  highlight = false,
}: {
  value: number | undefined;
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`shrink-0 w-24 flex items-center gap-0.5 rounded-xl border-2 px-2 py-1.5 transition-colors focus-within:border-primary ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      <span className="text-xs font-bold text-gray-400">₹</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-black text-gray-900 bg-transparent outline-none tabular-nums"
      />
    </div>
  );
}
