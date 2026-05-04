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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Banknote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  createBookingWithSeatReservations,
  getTripById,
  getVehicleByDriverUserId,
  listTripSeatReservations,
  listTravelerBookings,
} from "@/data/appwrite-repository";
import { account } from "@/integrations/appwrite/client";
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

  const pastBookingsQuery = useQuery({
    queryKey: ["traveler-bookings", user?.$id],
    queryFn: () => listTravelerBookings(user!.$id),
    enabled: !!user?.$id,
  });

  useEffect(() => {
    if (!user) return;
    
    if (!passengerName && user.name) {
      setPassengerName(user.name);
    }
    
    if (!passengerPhone) {
      if (user.prefs?.defaultPhone) {
        setPassengerPhone(user.prefs.defaultPhone);
      } else if (pastBookingsQuery.data && pastBookingsQuery.data.length > 0) {
        // Fallback to most recent booking
        const recentBooking = [...pastBookingsQuery.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (recentBooking?.passengerPhone) {
          setPassengerPhone(recentBooking.passengerPhone);
        }
      }
    }
  }, [user, pastBookingsQuery.data, passengerName, passengerPhone]);

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

      // Save phone to preferences if it's new or missing
      if (!user.prefs?.defaultPhone || user.prefs.defaultPhone !== phone) {
        try {
          await account.updatePrefs({ ...(user.prefs || {}), defaultPhone: phone });
        } catch (e) {
          console.error("Failed to update user prefs", e);
        }
      }

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
              <div className="pt-6 border-t border-border/60">
                <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
                <RadioGroup defaultValue="pay_on_car" className="space-y-3">
                  <div className="flex items-center space-x-3 border border-border/60 p-4 bg-card/50 cursor-pointer">
                    <RadioGroupItem value="pay_on_car" id="pay_on_car" />
                    <Label htmlFor="pay_on_car" className="flex items-center gap-2 cursor-pointer w-full text-base font-medium">
                      <Banknote className="h-5 w-5 text-primary" />
                      Pay on car
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="bg-muted/30 p-4 border border-border/60 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Price Breakdown</h3>
                <div className="flex justify-between text-sm">
                  <span>Tickets ({selected.size} seat{selected.size !== 1 ? "s" : ""})</span>
                  <span>{formatCurrency(pricePerSeat * selected.size)}</span>
                </div>
                {selected.size > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Platform fee</span>
                    <span>{formatCurrency(29)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-border/60 flex justify-between font-bold text-lg">
                  <span>Total Amount</span>
                  <span className="text-primary">{formatCurrency(selected.size > 0 ? (pricePerSeat * selected.size) + 29 : 0)}</span>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  variant="hero"
                  size="lg"
                  className="rounded-none px-8 w-full sm:w-auto"
                  disabled={
                    bookingMutation.isPending || selected.size === 0 || remainingTripSeats === 0
                  }
                  onClick={() => bookingMutation.mutate()}
                >
                  {bookingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Confirming…
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

