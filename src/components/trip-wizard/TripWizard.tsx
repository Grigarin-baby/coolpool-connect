import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { ArrowLeft, X } from "lucide-react";
import { Button as UiButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepRoute } from "./StepRoute";
import { StepDateTime } from "./StepDateTime";
import { StepStops } from "./StepStops";
import { StepAmount } from "./StepAmount";
import { StepSeats } from "./StepSeats";
import { StepVehicle } from "./StepVehicle";
import { StepDriver } from "./StepDriver";
import { StepReview } from "./StepReview";
import type { RouteAlternative, WizardData, WizardResult, WizardStop } from "./types";
import { EMPTY_WIZARD_DATA } from "./types";
import type { DriverVehicle } from "@/lib/domain";
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
  publishing?: boolean;
  onClose: () => void;
  onComplete: (result: WizardResult) => void;
  onAddVehicle: () => void;
  onAddDriver: () => void;
}

type StepKey =
  | "route"
  | "stops"
  | "when"
  | "amount"
  | "seats"
  | "vehicle"
  | "driver"
  | "review";

const STEP_ORDER: StepKey[] = [
  "route",
  "stops",
  "when",
  "amount",
  "seats",
  "vehicle",
  "driver",
  "review",
];

const STEP_TITLES: Record<StepKey, string> = {
  route: "Where are you going?",
  stops: "Boarding points",
  when: "When are you leaving?",
  amount: "How much per seat?",
  seats: "Pick the seats",
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

  const canContinue = (() => {
    switch (step) {
      case "route":
        return !!data.from && !!data.to && !!selectedAlt;
      case "stops":
        return true; // empty is valid
      case "when":
        return !!data.date && !!data.time;
      case "amount":
        return typeof data.pricePerSeat === "number" && data.pricePerSeat > 0;
      case "seats":
        return data.seatConfig.length > 0;
      case "vehicle":
        return !!selectedVehicle;
      case "driver":
        return !!selectedDriver;
      case "review":
        return !!(
          data.from &&
          data.to &&
          data.date &&
          data.time &&
          selectedAlt &&
          data.pricePerSeat &&
          data.seatConfig.length > 0 &&
          selectedVehicle &&
          selectedDriver
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
      !selectedDriver
    )
      return;
    const departure = data.date
      .hour(data.time.hour24)
      .minute(data.time.minute)
      .second(0)
      .millisecond(0);
    const result: WizardResult = {
      from: data.from,
      to: data.to,
      departureAt: departure.toISOString(),
      polyline: selectedAlt.polyline,
      totalDistanceKm: selectedAlt.distanceKm,
      durationMin: selectedAlt.durationMin,
      stops: data.stops,
      pricePerSeat: data.pricePerSeat,
      seatConfig: data.seatConfig,
      totalSeats: data.seatConfig.length,
      vehicleId: selectedVehicle.id,
      driverId: selectedDriver.id,
    };
    onComplete(result);
  };

  if (!open) return null;

  const body = (
    <div className="flex h-full flex-col">
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
            onFromChange={(from) => setData((d) => ({ ...d, from }))}
            onToChange={(to) => setData((d) => ({ ...d, to }))}
            onAlternativesChange={(alternatives, selectedAltId) =>
              setData((d) => ({ ...d, alternatives, selectedAltId }))
            }
          />
        )}
        {step === "stops" && data.from && data.to && selectedAlt && (
          <StepStops
            from={data.from}
            to={data.to}
            alternative={selectedAlt}
            stops={data.stops}
            onStopsChange={(stops: WizardStop[]) => setData((d) => ({ ...d, stops }))}
          />
        )}
        {step === "when" && (
          <StepDateTime
            date={data.date ?? dayjs().startOf("day")}
            time={data.time}
            onDateChange={(date) => setData((d) => ({ ...d, date }))}
            onTimeChange={(time) => setData((d) => ({ ...d, time }))}
          />
        )}
        {step === "amount" && (
          <StepAmount
            pricePerSeat={data.pricePerSeat}
            seatConfig={data.seatConfig}
            onChange={(val) => setData((d) => ({ ...d, pricePerSeat: val }))}
          />
        )}
        {step === "seats" && (
          <StepSeats
            seatConfig={data.seatConfig}
            onChange={(seatConfig: SeatId[]) => setData((d) => ({ ...d, seatConfig }))}
          />
        )}
        {step === "vehicle" && (
          <StepVehicle
            vehicles={vehicles}
            selectedVehicleId={data.vehicleId}
            onChange={(vehicleId) => setData((d) => ({ ...d, vehicleId }))}
            onAddNew={onAddVehicle}
          />
        )}
        {step === "driver" && (
          <StepDriver
            drivers={drivers}
            selectedDriverId={data.driverId}
            onChange={(driverId) => setData((d) => ({ ...d, driverId }))}
            onAddNew={onAddDriver}
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
              stops={data.stops}
              date={data.date}
              time={data.time}
              pricePerSeat={data.pricePerSeat}
              seatConfig={data.seatConfig}
              vehicle={selectedVehicle}
              driver={selectedDriver}
            />
          )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <UiButton
          type="button"
          variant="hero"
          size="lg"
          className="w-full rounded-2xl h-14 text-base font-bold"
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
    <div className="fixed inset-0 z-[1100] bg-white">
      <div className="h-full">{body}</div>
    </div>
  );
}
