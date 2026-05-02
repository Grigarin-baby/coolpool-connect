import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SeatMap } from "@/components/SeatMap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  createBookingWithSeatReservations,
  getTripById,
  getVehicleByDriverUserId,
  listTripSeatReservations,
} from "@/data/appwrite-repository";
import { formatCurrency } from "@/lib/pricing";
import { buildSeatLayout } from "@/lib/seatLayout";
import { toast } from "sonner";

export const Route = createFileRoute("/booking/$tripId")({
  head: () => ({
    meta: [
      { title: "Book seats — Coolpool" },
      { name: "description", content: "Choose seats for your ride." },
    ],
  }),
  component: BookingTripPage,
});

function BookingTripPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => getTripById(tripId),
    retry: 1,
  });

  const vehicleQuery = useQuery({
    queryKey: ["vehicle-by-host", tripQuery.data?.hostId],
    queryFn: () =>
      tripQuery.data ? getVehicleByDriverUserId(tripQuery.data.hostId) : Promise.resolve(null),
    enabled: !!tripQuery.data,
  });

  const reservationsQuery = useQuery({
    queryKey: ["trip-seat-reservations", tripId],
    queryFn: () => listTripSeatReservations(tripId),
    enabled: !!tripId,
    refetchInterval: 30_000,
  });

  const layoutCapacity = useMemo(() => {
    const vehicleCap = vehicleQuery.data?.seatCapacity ?? 0;
    const tripCap = (tripQuery.data?.totalSeats ?? 0);
    // Always use the larger of the two to ensure all seats are shown
    const finalCap = Math.max(vehicleCap, tripCap);
    return Math.min(12, Math.max(2, finalCap));
  }, [vehicleQuery.data?.seatCapacity, tripQuery.data?.totalSeats]);

  const layout = useMemo(() => buildSeatLayout(layoutCapacity), [layoutCapacity]);

  const occupiedCodes = useMemo(
    () => new Set(reservationsQuery.data?.map((r) => r.seatCode) ?? []),
    [reservationsQuery.data],
  );

  /** Seat reservations are publicly readable; booking docs are not visible across travelers. */
  const remainingTripSeats = useMemo(() => {
    const trip = tripQuery.data;
    if (!trip) return 0;
    const sold = reservationsQuery.data?.length ?? 0;
    return Math.max(0, trip.totalSeats - sold);
  }, [tripQuery.data, reservationsQuery.data]);

  const pricePerSeat =
    tripQuery.data && tripQuery.data.totalSeats > 0
      ? tripQuery.data.totalPrice / tripQuery.data.totalSeats
      : 0;

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!user || !tripQuery.data) throw new Error("Not signed in.");
      const codes = [...selected];
      if (codes.length === 0) throw new Error("Select at least one seat.");
      const name = passengerName.trim();
      const phone = passengerPhone.trim();
      if (!name || !phone) throw new Error("Enter passenger name and phone.");

      return createBookingWithSeatReservations({
        tripId: tripQuery.data.id,
        travelerId: user.$id,
        hostId: tripQuery.data.hostId,
        fromStopIndex: 0,
        toStopIndex: 0,
        seatsBooked: codes.length,
        segmentPrice: Math.round(pricePerSeat * codes.length * 100) / 100,
        passengerName: name,
        passengerPhone: phone,
        status: "confirmed",
        seatCodes: codes,
      });
    },
    onSuccess: async () => {
      toast.success("Booking confirmed.");
      await queryClient.invalidateQueries({ queryKey: ["trip-seat-reservations", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["traveler-bookings"] });
      navigate({ to: "/trips" });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Booking failed.");
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      void navigate({
        to: "/members",
        search: { redirect: `/booking/${tripId}` },
        replace: true,
      });
    }
  }, [authLoading, user, navigate, tripId]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-hero">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (tripQuery.isPending) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (tripQuery.isError || !tripQuery.data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 max-w-lg flex-1">
          <Card className="p-8 rounded-none text-center space-y-4">
            <p className="font-semibold">Trip not found</p>
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const trip = tripQuery.data;

  if (trip.status !== "scheduled" && trip.status !== "in_progress") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 max-w-lg flex-1">
          <Card className="p-8 rounded-none text-center space-y-4">
            <p className="font-semibold">This trip is not open for booking.</p>
            <Button asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (user && user.$id === trip.hostId) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 max-w-lg flex-1">
          <Card className="p-8 rounded-none text-center space-y-4">
            <p className="font-semibold">You cannot book your own trip.</p>
            <Button asChild variant="outline">
              <Link to="/driver/dashboard">Ride Host dashboard</Link>
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const toggleSeat = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else if (next.size < remainingTripSeats) next.add(code);
      return next;
    });
  };

  const vehicleMissing = vehicleQuery.data == null && vehicleQuery.isFetched;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-hero">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 max-w-3xl flex-1">
        <Button variant="ghost" className="mb-6 gap-2 -ml-2" asChild>
          <a href="/#find-a-ride">
            <ArrowLeft className="h-4 w-4" />
            Find rides
          </a>
        </Button>

        <Card className="p-6 md:p-8 rounded-none border-border/60 shadow-soft bg-card/90 backdrop-blur-sm mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Choose your seats</h1>
          <p className="text-muted-foreground mt-1">
            {trip.fromLocation} → {trip.toLocation}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Departure: {new Date(trip.departureAt).toLocaleString()}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-none bg-secondary px-3 py-1 text-xs font-medium">
              {remainingTripSeats} seat{remainingTripSeats !== 1 ? "s" : ""} left on this trip
            </span>
            <span className="rounded-none bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {formatCurrency(pricePerSeat)} / seat
            </span>
          </div>
          {vehicleMissing && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              Vehicle profile not found — layout uses trip seat count + ride host seat as an estimate.
            </p>
          )}
        </Card>

        {remainingTripSeats === 0 ? (
          <Card className="p-8 rounded-none text-center">
            <p className="font-medium">This trip is fully booked.</p>
            <Button className="mt-4" asChild variant="outline">
              <a href="/#find-a-ride">Find another ride</a>
            </Button>
          </Card>
        ) : (
          <>
            <SeatMap
              slots={layout}
              occupiedCodes={occupiedCodes}
              selectedCodes={selected}
              onTogglePassengerSeat={toggleSeat}
              maxSelectable={remainingTripSeats}
              disabled={bookingMutation.isPending || reservationsQuery.isPending}
            />

            <Card className="mt-8 p-6 rounded-none border-border/60 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Passenger name</Label>
                  <Input
                    id="p-name"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="Full name"
                    className="rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-phone">Phone</Label>
                  <Input
                    id="p-phone"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    placeholder="Mobile number"
                    className="rounded-none"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border/60">
                <div>
                  <p className="text-sm text-muted-foreground">Estimated total</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(pricePerSeat * selected.size)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.size} seat{selected.size !== 1 ? "s" : ""} selected
                  </p>
                </div>
                <Button
                  variant="hero"
                  size="lg"
                  className="rounded-none px-8"
                  disabled={
                    bookingMutation.isPending || selected.size === 0 || remainingTripSeats === 0
                  }
                  onClick={() => bookingMutation.mutate()}
                >
                  {bookingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Booking…
                    </>
                  ) : (
                    "Confirm booking"
                  )}
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

