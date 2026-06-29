import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { ArrowLeft, X } from "lucide-react";
import { Button as UiButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepRoute } from "./StepRoute";
import { StepDateTime } from "./StepDateTime";
import { StepSeats } from "./StepSeats";
import { StepVehicle } from "./StepVehicle";
import { StepDriver } from "./StepDriver";
import { StepReview } from "./StepReview";
import type { IntermediatePoint, RouteAlternative, WizardData, WizardResult, WizardStop } from "./types";
import { EMPTY_WIZARD_DATA, MIN_DEPARTURE_LEAD_MINUTES } from "./types";
import { APP_FONT_FAMILY } from "@/lib/fonts";
import { closestPolylineIndex, decodePolyline, distanceAlongPolylineKm } from "@/lib/geo";
import type { DriverVehicle, Trip } from "@/lib/domain";
import { describeConflict, getResourceConflict } from "@/lib/trip-conflicts";
import type { SeatId } from "@/components/SeatPicker";

interface DriverOption {
  id: string;
  fullName: string;
  phone?: string;
  isYou?: boolean;
}

interface TripWizardProps {
  open: boolean;
  initial?: Partial<WizardData>;
  vehicles: DriverVehicle[];
  drivers: DriverOption[];
  /** Host's existing trips, used to detect driver/vehicle scheduling conflicts. */
  trips?: Trip[];
  /** When editing an existing trip, exclude it from conflict checks. */
  editingTripId?: string | null;
  publishing?: boolean;
  onClose: () => void;
  onComplete: (result: WizardResult) => void;
  onAddVehicle: () => void;
  onAddDriver: () => void;
}

type StepKey =
  | "route"
  | "when"
  | "seats"
  | "vehicle"
  | "driver"
  | "review";

const STEP_ORDER: StepKey[] = [
  "route",
  "when",
  "seats",
  "vehicle",
  "driver",
  "review",
];

const STEP_TITLES: Record<StepKey, string> = {
  route: "Where are you going?",
  when: "When are you leaving?",
  seats: "Seats & pricing",
  vehicle: "Which vehicle?",
  driver: "Who's driving?",
  review: "Review & publish",
};

function useIsDesktop(): boolean {
  const [matches, setMatches] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return matches;
}

export function TripWizard({
  open,
  initial,
  vehicles,
  drivers,
  trips = [],
  editingTripId,
  publishing,
  onClose,
  onComplete,
  onAddVehicle,
  onAddDriver,
}: TripWizardProps) {
  const isDesktop = useIsDesktop();
  const [data, setData] = useState<WizardData>({ ...EMPTY_WIZARD_DATA, ...(initial ?? {}) });
  const [step, setStep] = useState<StepKey>("route");

  useEffect(() => {
    if (open) {
      setStep("route");
      setData({ ...EMPTY_WIZARD_DATA, ...(initial ?? {}) });
    }
  }, [open, initial]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const isLastStep = stepIndex === STEP_ORDER.length - 1;
  const isFirstStep = stepIndex === 0;

  const selectedAlt: RouteAlternative | null = useMemo(
    () =>
      data.alternatives.find((a) => a.id === data.selectedAltId) ??
      data.alternatives[0] ??
      null,
    [data.alternatives, data.selectedAltId],
  );

  const selectedVehicle = vehicles.find((v) => v.id === data.vehicleId) ?? null;
  const selectedDriver = drivers.find((d) => d.id === data.driverId) ?? null;

  const selectedDeparture = useMemo(() => {
    if (!data.date || !data.time) return null;
    return data.date
      .hour(data.time.hour24)
      .minute(data.time.minute)
      .second(0)
      .millisecond(0);
  }, [data.date, data.time]);

  // The candidate trip's [departure, arrival) window, used to detect driver/
  // vehicle scheduling conflicts. Only available once the route (for duration)
  // and departure time have been chosen.
  const candidateWindow = useMemo(() => {
    if (!selectedDeparture || !selectedAlt) return null;
    return {
      start: selectedDeparture,
      end: selectedDeparture.add(selectedAlt.durationMin, "minute"),
    };
  }, [selectedDeparture, selectedAlt]);

  const vehicleConflicts = useMemo(() => {
    const map: Record<string, string> = {};
    if (!candidateWindow) return map;
    for (const v of vehicles) {
      const conflict = getResourceConflict(
        trips,
        "vehicleId",
        v.id,
        candidateWindow.start,
        candidateWindow.end,
        editingTripId,
      );
      if (conflict) map[v.id] = describeConflict(conflict);
    }
    return map;
  }, [candidateWindow, vehicles, trips, editingTripId]);

  const driverConflicts = useMemo(() => {
    const map: Record<string, string> = {};
    if (!candidateWindow) return map;
    for (const d of drivers) {
      const conflict = getResourceConflict(
        trips,
        "assignedDriverId",
        d.id,
        candidateWindow.start,
        candidateWindow.end,
        editingTripId,
      );
      if (conflict) map[d.id] = describeConflict(conflict);
    }
    return map;
  }, [candidateWindow, drivers, trips, editingTripId]);

  // Default to the first available vehicle/driver so the host doesn't have to
  // pick when they only have one of each (the common case). Skip ones that
  // are already busy during this trip's time window.
  useEffect(() => {
    if (!data.vehicleId && vehicles.length > 0) {
      const firstFree = vehicles.find((v) => !vehicleConflicts[v.id]) ?? vehicles[0];
      setData((d) => ({ ...d, vehicleId: firstFree.id }));
    }
  }, [data.vehicleId, vehicles, vehicleConflicts]);

  useEffect(() => {
    if (!data.driverId && drivers.length > 0) {
      const firstFree = drivers.find((d2) => !driverConflicts[d2.id]) ?? drivers[0];
      setData((d) => ({ ...d, driverId: firstFree.id }));
    }
  }, [data.driverId, drivers, driverConflicts]);

  // If the chosen departure time/route shifts and the currently-selected
  // vehicle/driver becomes busy, clear the selection so the host must
  // re-pick (canContinue will block until they do).
  useEffect(() => {
    if (data.vehicleId && vehicleConflicts[data.vehicleId]) {
      setData((d) => ({ ...d, vehicleId: null }));
    }
  }, [data.vehicleId, vehicleConflicts]);

  useEffect(() => {
    if (data.driverId && driverConflicts[data.driverId]) {
      setData((d) => ({ ...d, driverId: null }));
    }
  }, [data.driverId, driverConflicts]);

  // Pre-compute stops with distanceFromOriginKm — shared by StepReview and finish()
  const computedStops = useMemo((): WizardStop[] => {
    if (!selectedAlt) return [];
    const decodedPath = decodePolyline(selectedAlt.polyline);
    return data.intermediatePoints
      .filter((p) => p.lat !== 0 && p.lng !== 0)
      .map((p) => {
        const idx = closestPolylineIndex({ lat: p.lat, lng: p.lng }, decodedPath);
        const km = distanceAlongPolylineKm(decodedPath, idx);
        return {
          label: p.label,
          lat: p.lat,
          lng: p.lng,
          distanceFromOriginKm: Math.round(km * 10) / 10,
          stopType: p.stopType,
        };
      })
      .sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm);
  }, [data.intermediatePoints, selectedAlt]);

  // Stable callbacks — must not change on every render or StepRoute re-fetches routes endlessly
  const handleFromChange = useCallback(
    (from: WizardData["from"]) => setData((d) => ({ ...d, from })),
    [],
  );
  const handleToChange = useCallback(
    (to: WizardData["to"]) => setData((d) => ({ ...d, to })),
    [],
  );
  const handleAlternativesChange = useCallback(
    (alternatives: RouteAlternative[], selectedAltId: number | null) =>
      setData((d) => ({ ...d, alternatives, selectedAltId })),
    [],
  );
  const handleIntermediatePointsChange = useCallback(
    (intermediatePoints: IntermediatePoint[]) =>
      setData((d) => ({ ...d, intermediatePoints })),
    [],
  );

  const canContinue = (() => {
    switch (step) {
      case "route":
        return !!data.from && !!data.to && !!selectedAlt;
      case "when":
        return (
          !!selectedDeparture &&
          selectedDeparture.isAfter(dayjs().add(MIN_DEPARTURE_LEAD_MINUTES, "minute"))
        );
      case "seats":
        return data.seatConfig.length > 0 && typeof data.pricePerSeat === "number" && data.pricePerSeat > 0;
      case "vehicle":
        return !!selectedVehicle && !vehicleConflicts[selectedVehicle.id];
      case "driver":
        return !!selectedDriver && !driverConflicts[selectedDriver.id];
      case "review":
        return !!(
          data.from &&
          data.to &&
          data.date &&
          data.time &&
          selectedDeparture?.isAfter(dayjs().add(MIN_DEPARTURE_LEAD_MINUTES, "minute")) &&
          selectedAlt &&
          data.pricePerSeat &&
          data.seatConfig.length > 0 &&
          selectedVehicle &&
          !vehicleConflicts[selectedVehicle.id] &&
          selectedDriver &&
          !driverConflicts[selectedDriver.id]
        );
    }
  })();

  const goNext = () => {
    if (!canContinue) return;
    if (isLastStep) {
      finish();
    } else {
      setStep(STEP_ORDER[stepIndex + 1]);
    }
  };

  const goBack = () => {
    if (!isFirstStep) setStep(STEP_ORDER[stepIndex - 1]);
  };

  const finish = () => {
    if (
      !data.from ||
      !data.to ||
      !data.date ||
      !data.time ||
      !selectedAlt ||
      !data.pricePerSeat ||
      !selectedVehicle ||
      !selectedDriver ||
      vehicleConflicts[selectedVehicle.id] ||
      driverConflicts[selectedDriver.id]
    )
      return;
    const departure = data.date
      .hour(data.time.hour24)
      .minute(data.time.minute)
      .second(0)
      .millisecond(0);
    // Re-validate at publish: time may have passed while the host filled in the
    // wizard, so a trip that was far enough out at the "when" step can become
    // too soon by now. Bounce back to the date step (which shows the reason)
    // rather than publishing a ride that's already inside the booking cutoff.
    if (!departure.isAfter(dayjs().add(MIN_DEPARTURE_LEAD_MINUTES, "minute"))) {
      setStep("when");
      return;
    }
    const result: WizardResult = {
      from: data.from,
      to: data.to,
      departureAt: departure.toISOString(),
      polyline: selectedAlt.polyline,
      totalDistanceKm: selectedAlt.distanceKm,
      durationMin: selectedAlt.durationMin,
      stops: computedStops,
      pricePerSeat: data.pricePerSeat,
      seatConfig: data.seatConfig,
      totalSeats: data.seatConfig.length,
      vehicleId: selectedVehicle.id,
      driverId: selectedDriver.id,
      segmentPrices: data.segmentPrices,
    };
    onComplete(result);
  };

  if (!open) return null;

  const body = (
    <div className="trip-wizard flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={isFirstStep ? onClose : goBack}
          aria-label={isFirstStep ? "Close" : "Back"}
          className="grid h-10 w-10 place-items-center rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100"
        >
          {isFirstStep ? <X size={18} /> : <ArrowLeft size={18} />}
        </button>
        <div className="flex-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Step {stepIndex + 1} of {STEP_ORDER.length}
          </p>
          <h2 className="text-base font-bold text-gray-900">{STEP_TITLES[step]}</h2>
        </div>
        <div className="flex w-10 justify-end">
          {!isFirstStep && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 place-items-center rounded-full text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 bg-white pb-2">
        {STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-gray-200",
              i < stepIndex && "bg-primary/40",
            )}
          />
        ))}
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        {step === "route" && (
          <StepRoute
            from={data.from}
            to={data.to}
            alternatives={data.alternatives}
            selectedAltId={data.selectedAltId}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onAlternativesChange={handleAlternativesChange}
            intermediatePoints={data.intermediatePoints}
            onIntermediatePointsChange={handleIntermediatePointsChange}
          />
        )}
        {step === "when" && (
          <StepDateTime
            date={data.date}
            time={data.time}
            onDateChange={(date) => setData((d) => ({ ...d, date }))}
            onTimeChange={(time) => setData((d) => ({ ...d, time }))}
          />
        )}
        {step === "seats" && (
          <StepSeats
            seatCapacity={selectedVehicle?.seatCapacity === 7 ? 7 : 5}
            seatConfig={data.seatConfig}
            pricePerSeat={data.pricePerSeat}
            onSeatsChange={(seatConfig: SeatId[]) => setData((d) => ({ ...d, seatConfig }))}
            onPriceChange={(pricePerSeat) => setData((d) => ({ ...d, pricePerSeat }))}
          />
        )}
        {step === "vehicle" && (
          <StepVehicle
            vehicles={vehicles}
            selectedVehicleId={data.vehicleId}
            onChange={(vehicleId) => setData((d) => ({ ...d, vehicleId }))}
            onAddNew={onAddVehicle}
            conflicts={vehicleConflicts}
          />
        )}
        {step === "driver" && (
          <StepDriver
            drivers={drivers}
            selectedDriverId={data.driverId}
            onChange={(driverId) => setData((d) => ({ ...d, driverId }))}
            onAddNew={onAddDriver}
            conflicts={driverConflicts}
          />
        )}
        {step === "review" &&
          data.from &&
          data.to &&
          data.date &&
          data.time &&
          selectedAlt &&
          data.pricePerSeat &&
          selectedVehicle &&
          selectedDriver && (
            <StepReview
              from={data.from}
              to={data.to}
              alternative={selectedAlt}
              stops={computedStops}
              date={data.date}
              time={data.time}
              pricePerSeat={data.pricePerSeat}
              seatConfig={data.seatConfig}
              vehicle={selectedVehicle}
              driver={selectedDriver}
              segmentPrices={data.segmentPrices}
              onSegmentPricesChange={(segmentPrices) => setData((d) => ({ ...d, segmentPrices }))}
            />
          )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <UiButton
          type="button"
          variant="hero"
          size="lg"
          className="w-full rounded-2xl h-16 !text-white text-xl font-extrabold tracking-[0.18em]"
          onClick={goNext}
          disabled={!canContinue || publishing}
        >
          {publishing
            ? "Publishing…"
            : isLastStep
              ? "Publish trip"
              : "Continue"}
        </UiButton>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        style={{ fontFamily: APP_FONT_FAMILY }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-2xl h-[88vh] max-h-[860px] rounded-3xl bg-white shadow-2xl overflow-hidden">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-white" style={{ fontFamily: APP_FONT_FAMILY }}>
      <div className="h-full">{body}</div>
    </div>
  );
}
