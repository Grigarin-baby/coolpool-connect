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
import { RideRouteMap } from "@/components/RideRouteMap";

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
  const [passengers, setPassengers] = useState<{ name: string; phone: string }[]>([
    { name: "", phone: "" },
  ]);

  // Keep passengers array length in sync with number of selected seats (at least 1 row)
  useEffect(() => {
    const target = Math.max(1, selected.size);
    setPassengers((prev) => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        return [
          ...prev,
          ...Array.from({ length: target - prev.length }, () => ({ name: "", phone: "" })),
        ];
      }
      return prev.slice(0, target);
    });
  }, [selected.size]);

  const updatePassenger = (idx: number, patch: Partial<{ name: string; phone: string }>) => {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

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

    setPassengers((prev) => {
      const first = prev[0] || { name: "", phone: "" };
      let { name, phone } = first;
      const recent =
        pastBookingsQuery.data && pastBookingsQuery.data.length > 0
          ? [...pastBookingsQuery.data].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )[0]
          : undefined;

      if (!name) {
        if (user.name) name = user.name;
        else if (recent?.passengerName) name = recent.passengerName;
      }
      if (!phone) {
        if (user.prefs?.defaultPhone) phone = user.prefs.defaultPhone;
        else if ((user as any).phone) phone = (user as any).phone;
        else if (recent?.passengerPhone) phone = recent.passengerPhone;
      }
      if (name === first.name && phone === first.phone) return prev;
      const next = [...prev];
      next[0] = { name, phone };
      return next;
    });
  }, [user, pastBookingsQuery.data]);

  const layoutCapacity = useMemo(() => {
    const vehicleCap = vehicleQuery.data?.seatCapacity ?? 0;
    const tripCap = tripQuery.data?.totalSeats ?? 0;
    // Always use the larger of the two to ensure all seats are shown
    const finalCap = Math.max(vehicleCap, tripCap);
    return Math.min(12, Math.max(5, finalCap));
  }, [vehicleQuery.data?.seatCapacity, tripQuery.data?.totalSeats]);

  const layout = useMemo(() => buildSeatLayout(layoutCapacity), [layoutCapacity]);
  const seatLabelByCode = useMemo(() => {
    const m: Record<string, string> = {};
    layout.forEach((s) => {
      m[s.seatCode] = s.displayLabel;
    });
    return m;
  }, [layout]);

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

      const trimmed = passengers.slice(0, codes.length).map((p) => ({
        name: p.name.trim(),
        phone: p.phone.trim(),
      }));
      if (trimmed.some((p) => !p.name || !p.phone)) {
        throw new Error("Enter name and phone for every passenger.");
      }

      const primaryPhone = trimmed[0].phone;
      // Save first passenger's phone to preferences if new
      if (!user.prefs?.defaultPhone || user.prefs.defaultPhone !== primaryPhone) {
        try {
          await account.updatePrefs({ ...(user.prefs || {}), defaultPhone: primaryPhone });
        } catch (e) {
          console.error("Failed to update user prefs", e);
        }
      }

      const joinedName = trimmed
        .map((p, i) => {
          const label = seatLabelByCode[codes[i]] ?? codes[i];
          return `Seat ${label}: ${p.name}`;
        })
        .join(" | ");
      const joinedPhone = trimmed.map((p) => p.phone).join(" | ");

      return createBookingWithSeatReservations({
        tripId: tripQuery.data.id,
        travelerId: user.$id,
        hostId: tripQuery.data.hostId,
        fromStopIndex: 0,
        toStopIndex: 0,
        seatsBooked: codes.length,
        segmentPrice: Math.round(pricePerSeat * codes.length * 100) / 100,
        passengerName: joinedName,
        passengerPhone: joinedPhone,
        status: "confirmed",
        seatCodes: codes,
      });
    },
    onSuccess: async (booking) => {
      toast.success("Booking confirmed.");
      await queryClient.invalidateQueries({ queryKey: ["trip-seat-reservations", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["traveler-bookings"] });
      navigate({
        to: "/trips",
        search: { booking: booking.id } as any,
      });
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
          <Card className="p-8 rounded-3xl text-center space-y-4">
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
          <Card className="p-8 rounded-3xl text-center space-y-4">
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

  const toggleSeat = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else if (next.size < remainingTripSeats) next.add(code);
      return next;
    });
  };

  const vehicleMissing = vehicleQuery.data == null && vehicleQuery.isFetched;

  const totalAmount =
    selected.size > 0 ? pricePerSeat * selected.size + 29 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-hero">
      <SiteHeader />
      <main className="container mx-auto px-3 sm:px-4 pt-24 pb-10 md:pt-28 md:pb-14 max-w-6xl flex-1">
        <Button variant="ghost" className="mb-3 gap-2 -ml-2 h-9" asChild>
          <a href="/#find-a-ride">
            <ArrowLeft className="h-4 w-4" />
            Find rides
          </a>
        </Button>

        {/* Compact header */}
        <Card className="p-4 sm:p-5 rounded-3xl border-border/60 shadow-soft bg-card/90 backdrop-blur-sm mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Book your seat</h1>
              <div className="mt-2 flex items-center gap-2 text-sm sm:text-base">
                <span className="font-semibold truncate">{trip.fromLocation}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold truncate">{trip.toLocation}</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {new Date(trip.departureAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                {formatCurrency(pricePerSeat)} / seat
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                {remainingTripSeats} left
              </span>
            </div>
          </div>
          {vehicleMissing && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              Vehicle profile not found — seat layout is estimated.
            </p>
          )}
        </Card>

        {remainingTripSeats === 0 ? (
          <Card className="p-8 rounded-3xl text-center">
            <p className="font-medium">This trip is fully booked.</p>
            <Button className="mt-4" asChild variant="outline">
              <a href="/#find-a-ride">Find another ride</a>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
            {/* Left column: seats + route */}
            <div className="space-y-4 min-w-0">
              <Card className="p-4 sm:p-5 rounded-3xl border-border/60 shadow-soft bg-card/90 backdrop-blur-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Choose your seats
                </h2>
                <SeatMap
                  slots={layout}
                  occupiedCodes={occupiedCodes}
                  selectedCodes={selected}
                  onTogglePassengerSeat={toggleSeat}
                  maxSelectable={remainingTripSeats}
                  seatConfig={trip.seatConfig}
                  disabled={bookingMutation.isPending || reservationsQuery.isPending}
                />
              </Card>

              {trip.polyline && !!trip.fromLat && !!trip.fromLng && !!trip.toLat && !!trip.toLng && (
                <Card className="p-4 sm:p-5 rounded-3xl border-border/60 shadow-soft bg-card/90 backdrop-blur-sm overflow-hidden">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Route preview
                  </h2>
                  <div className="rounded-2xl overflow-hidden">
                    <RideRouteMap
                      fromLat={trip.fromLat}
                      fromLng={trip.fromLng}
                      toLat={trip.toLat}
                      toLng={trip.toLng}
                      polyline={trip.polyline}
                      isAirportDrop={
                        (trip.toLocation || "").toLowerCase().includes("air") ||
                        (trip.toLocation || "").toLowerCase().includes("flight") ||
                        (trip.toLocation || "").toLowerCase().includes("terminal")
                      }
                    />
                  </div>
                </Card>
              )}
            </div>

            {/* Right column: details + payment + summary (sticky on desktop) */}
            <Card className="p-4 sm:p-5 rounded-3xl border-border/60 shadow-soft bg-card/90 backdrop-blur-sm lg:sticky lg:top-24 space-y-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Passenger{passengers.length > 1 ? "s" : ""}
                </h2>
                <div className="space-y-4">
                  {passengers.map((p, idx) => {
                    const seatCode = [...selected][idx];
                    return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-border/60 bg-card/60 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary">
                            Passenger {idx + 1}
                          </span>
                          {seatCode && (
                            <span className="text-[10px] font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">
                              Seat #{seatLabelByCode[seatCode] ?? seatCode}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`p-name-${idx}`}
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Full name
                          </Label>
                          <Input
                            id={`p-name-${idx}`}
                            value={p.name}
                            onChange={(e) => updatePassenger(idx, { name: e.target.value })}
                            placeholder="Full name"
                            className="rounded-xl h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`p-phone-${idx}`}
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Mobile number
                          </Label>
                          <Input
                            id={`p-phone-${idx}`}
                            value={p.phone}
                            onChange={(e) => updatePassenger(idx, { phone: e.target.value })}
                            placeholder="Mobile number"
                            className="rounded-xl h-10"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border/60">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Payment
                </h2>
                <RadioGroup defaultValue="pay_on_car">
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 px-3 py-2.5 bg-card/50 cursor-pointer">
                    <RadioGroupItem value="pay_on_car" id="pay_on_car" />
                    <Label
                      htmlFor="pay_on_car"
                      className="flex items-center gap-2 cursor-pointer w-full text-sm font-semibold"
                    >
                      <Banknote className="h-4 w-4 text-primary" />
                      Pay on car
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tickets ({selected.size})
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(pricePerSeat * selected.size)}
                  </span>
                </div>
                {selected.size > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span className="font-semibold">{formatCurrency(29)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/60 flex justify-between items-baseline">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-extrabold text-primary">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full rounded-2xl h-12 text-base"
                style={{ color: "#fff" }}
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
                  `Confirm booking${selected.size > 0 ? ` • ${formatCurrency(totalAmount)}` : ""}`
                )}
              </Button>
            </Card>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
