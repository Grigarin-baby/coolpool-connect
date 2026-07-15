import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Car, CheckCircle2, Clock, MapPin, Phone, Radio, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RideRouteMap } from "@/components/RideRouteMap";
import { HostAvatar } from "@/components/HostAvatar";
import {
  getTripById,
  getTripShareByToken,
  getVehicleByDriverUserId,
  listDriverProfilesByUserIds,
} from "@/data/appwrite-repository";

dayjs.extend(relativeTime);

export const Route = createFileRoute("/track/$token")({
  head: () => ({
    meta: [
      { title: "Track ride - Coolpool" },
      { name: "description", content: "Follow this Coolpool ride live for safety." },
      // A shared safety link should not be indexed by search engines.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackRidePage,
});

function CenteredMessage({
  title,
  subtitle,
  tone = "neutral",
}: {
  title: string;
  subtitle?: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fffafd] px-6 text-center">
      <div
        className={
          tone === "success"
            ? "flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
            : "flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"
        }
      >
        {tone === "success" ? <CheckCircle2 size={26} /> : <MapPin size={26} />}
      </div>
      <div>
        <p className="text-lg font-black text-gray-900">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <Link to="/">
        <Button variant="outline" className="rounded-2xl">
          Go to Coolpool
        </Button>
      </Link>
    </div>
  );
}

function TrackRidePage() {
  const { token } = Route.useParams();

  const shareQuery = useQuery({
    queryKey: ["trip-share", token],
    queryFn: () => getTripShareByToken(token),
  });
  const share = shareQuery.data;

  const isShareUsable =
    !!share &&
    !share.revoked &&
    (!share.expiresAt || dayjs(share.expiresAt).isAfter(dayjs()));

  // Poll the trip for live coordinates while the link is usable.
  const tripQuery = useQuery({
    queryKey: ["track-trip", share?.tripId],
    queryFn: () => getTripById(share!.tripId),
    enabled: isShareUsable,
    refetchInterval: isShareUsable ? 8000 : false,
  });
  const trip = tripQuery.data;

  const hostProfileQuery = useQuery({
    queryKey: ["track-host", trip?.hostId],
    queryFn: async () => {
      const profiles = await listDriverProfilesByUserIds([trip!.hostId]);
      return profiles[0] ?? null;
    },
    enabled: !!trip?.hostId,
  });

  const vehicleQuery = useQuery({
    queryKey: ["track-vehicle", trip?.hostId],
    queryFn: () => getVehicleByDriverUserId(trip!.hostId),
    enabled: !!trip?.hostId,
  });

  if (shareQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffafd]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-b-primary" />
      </div>
    );
  }

  if (!share) {
    return (
      <CenteredMessage
        title="This tracking link is invalid"
        subtitle="Ask the traveller to share a fresh link."
      />
    );
  }

  if (share.revoked) {
    return (
      <CenteredMessage
        title="Tracking was turned off"
        subtitle="The traveller stopped sharing this ride."
      />
    );
  }

  if (share.expiresAt && dayjs(share.expiresAt).isBefore(dayjs())) {
    return (
      <CenteredMessage
        tone="success"
        title="This tracking link has expired"
        subtitle="The ride is no longer being shared."
      />
    );
  }

  if (tripQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffafd]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-b-primary" />
      </div>
    );
  }

  if (!trip) {
    return <CenteredMessage title="Ride not found" />;
  }

  const tripEnded = trip.status === "completed" || trip.status === "cancelled";
  if (tripEnded) {
    return (
      <CenteredMessage
        tone={trip.status === "completed" ? "success" : "neutral"}
        title={trip.status === "completed" ? "Trip ended safely" : "This trip was cancelled"}
        subtitle={trip.status === "completed" ? "The traveller has reached their destination." : undefined}
      />
    );
  }

  const hostProfile = hostProfileQuery.data;
  const vehicle = vehicleQuery.data;
  const hostName = trip.hostDisplayName || hostProfile?.fullName || "Coolpool host";
  const isVerified = hostProfile?.verificationStatus === "approved";
  const isLive = trip.status === "in_progress";
  const liveLocation =
    isLive && trip.currentLat != null && trip.currentLng != null
      ? { lat: trip.currentLat, lng: trip.currentLng, heading: trip.currentHeading ?? null }
      : null;
  const hostPhone = hostProfile?.phone;

  return (
    <div className="flex min-h-screen flex-col bg-[#fffafd]">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-10 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-gray-900">Coolpool</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
            Live trip
          </span>
        </div>

        {/* Status banner */}
        <div
          className={
            isLive
              ? "flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
              : "flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
          }
        >
          {isLive ? (
            <>
              <Radio className="h-4 w-4 animate-pulse text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                Ride in progress — tracking live
                {trip.locationUpdatedAt && (
                  <span className="ml-1 font-normal text-emerald-600/80">
                    · updated {dayjs(trip.locationUpdatedAt).fromNow()}
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">
                Ride hasn&apos;t started yet — live location appears once the host departs.
              </span>
            </>
          )}
        </div>

        {/* Map */}
        <RideRouteMap
          fromLat={trip.fromLat}
          fromLng={trip.fromLng}
          toLat={trip.toLat}
          toLng={trip.toLng}
          polyline={trip.polyline}
          liveLocation={liveLocation}
        />

        {/* Route */}
        <Card className="rounded-3xl border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Route</p>
          <p className="mt-2 text-base font-black text-gray-900">
            {trip.fromLocation.split(",")[0]} → {trip.toLocation.split(",")[0]}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {dayjs(trip.departureAt).format("ddd, MMM D · h:mm A")}
            </span>
          </div>
        </Card>

        {/* Host + vehicle */}
        <Card className="rounded-3xl border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <HostAvatar name={hostName} photoUrl={hostProfile?.photoUrl} size={52} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-black text-gray-900">
                {hostName}
                {isVerified && <ShieldCheck size={15} className="text-blue-500" />}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                <Car size={14} />
                {[vehicle?.modelName ?? trip.vehicleModel, vehicle?.plateNumber]
                  .filter(Boolean)
                  .join(" · ") || "Vehicle details pending"}
              </p>
            </div>
          </div>
        </Card>

        {/* Safety actions */}
        <div className="grid grid-cols-2 gap-3">
          {hostPhone && (
            <a href={`tel:${hostPhone}`}>
              <Button variant="outline" className="h-12 w-full rounded-2xl">
                <Phone size={16} className="mr-1.5" />
                Call host
              </Button>
            </a>
          )}
          <a href="tel:112" className={hostPhone ? "" : "col-span-2"}>
            <Button variant="outline" className="h-12 w-full rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50">
              <Phone size={16} className="mr-1.5" />
              Emergency 112
            </Button>
          </a>
        </div>

        <p className="px-1 text-center text-xs text-gray-400">
          You&apos;re viewing a ride shared with you for safety. Location updates automatically.
        </p>
      </main>
    </div>
  );
}
