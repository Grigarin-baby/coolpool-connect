import dayjs from "dayjs";
import { Car, Clock, MapPin, Tag, UserRound, Users } from "lucide-react";
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
}

function buildDeparture(date: Dayjs, time: ClockTime): Dayjs {
  return date.hour(time.hour24).minute(time.minute).second(0).millisecond(0);
}

function Row({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <p className="mt-0.5 text-base font-bold text-gray-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
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
}: StepReviewProps) {
  const departure = buildDeparture(date, time);
  const total = pricePerSeat * seatConfig.length;

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
      <Row
        icon={<MapPin size={20} />}
        label="Route"
        value={
          <span>
            <span className="text-primary">{from.label}</span>
            <span className="mx-2 text-gray-300">→</span>
            <span>{to.label}</span>
          </span>
        }
        hint={`${alternative.distanceKm.toFixed(1)} km · ${Math.round(alternative.durationMin)} min`}
      />
      <Row
        icon={<Clock size={20} />}
        label="Departure"
        value={departure.format("ddd, MMM D · h:mm A")}
      />
      {stops.length > 0 && (
        <Row
          icon={<MapPin size={20} />}
          label={`Boarding points (${stops.length})`}
          value={stops.map((s) => s.label).join(" · ")}
        />
      )}
      <Row
        icon={<Tag size={20} />}
        label="Price"
        value={
          <span>
            ₹{pricePerSeat.toLocaleString()} <span className="text-gray-400">/ seat</span>
          </span>
        }
        hint={`Total ₹${total.toLocaleString()} across ${seatConfig.length} seat${seatConfig.length === 1 ? "" : "s"}`}
      />
      <Row
        icon={<Users size={20} />}
        label="Seats offered"
        value={`${seatConfig.length} seat${seatConfig.length === 1 ? "" : "s"}`}
      />
      <Row
        icon={<Car size={20} />}
        label="Vehicle"
        value={vehicle.modelName}
        hint={`${vehicle.plateNumber} · ${vehicle.seatCapacity} seats`}
      />
      <Row
        icon={<UserRound size={20} />}
        label="Driver"
        value={
          <>
            {driver.fullName}
            {driver.isYou && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-primary">
                You
              </span>
            )}
          </>
        }
      />
    </div>
  );
}
