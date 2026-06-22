import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SeatMap } from "@/components/SeatMap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  createBookingWithSeatReservations,
  getTripById,
  getHostPreferences,
  getVehicleByDriverUserId,
  listDriverProfilesByUserIds,
  listTripSeatReservations,
  listTripStops,
  listTravelerBookings,
} from "@/data/appwrite-repository";
import { account } from "@/integrations/appwrite/client";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "@/integrations/razorpay/payment";
import { formatCurrency } from "@/lib/pricing";
import { getSegmentPrice } from "@/lib/segment-pricing";
import { estimateSegmentTimes } from "@/lib/segment-times";
import { buildSeatLayout } from "@/lib/seatLayout";
import { toast } from "sonner";
import { RideRouteMap } from "@/components/RideRouteMap";
import { RidePrefChips } from "@/components/RidePrefChips";
import { HostAvatar } from "@/components/HostAvatar";
import type { PassengerGender } from "@/lib/domain";

type PassengerForm = {
  name: string;
  phone: string;
  gender: PassengerGender | "";
};

interface BookingSearch {
  fromStopIndex?: number;
  toStopIndex?: number;
  fromLabel?: string;
  toLabel?: string;
  segmentPrice?: number;
}

export const Route = createFileRoute("/booking/$tripId")({
  validateSearch: (search: Record<string, unknown>): BookingSearch => ({
    fromStopIndex:
      typeof search.fromStopIndex === "number" ? search.fromStopIndex : undefined,
    toStopIndex: typeof search.toStopIndex === "number" ? search.toStopIndex : undefined,
    fromLabel: typeof search.fromLabel === "string" ? search.fromLabel : undefined,
    toLabel: typeof search.toLabel === "string" ? search.toLabel : undefined,
    segmentPrice: typeof search.segmentPrice === "number" ? search.segmentPrice : undefined,
  }),
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
  const segmentSearch = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [passengers, setPassengers] = useState<PassengerForm[]>([
    { name: "", phone: "", gender: "" },
  ]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [callConsentGiven, setCallConsentGiven] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  // Load Razorpay checkout script once on mount
  useEffect(() => {
    if (document.getElementById("razorpay-checkout-js")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Keep passengers array length in sync with number of selected seats (at least 1 row)
  useEffect(() => {
    const target = Math.max(1, selected.size);
    setPassengers((prev) => {
      if (prev.length === target) return prev;
      if (prev.length < target) {
        return [
          ...prev,
          ...Array.from({ length: target - prev.length }, () => ({
            name: "",
            phone: "",
            gender: "" as const,
          })),
        ];
      }
      return prev.slice(0, target);
    });
  }, [selected.size]);

  const updatePassenger = (idx: number, patch: Partial<PassengerForm>) => {
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

  const hostProfileQuery = useQuery({
    queryKey: ["host-profile", tripQuery.data?.hostId],
    queryFn: async () => {
      if (!tripQuery.data) return null;
      const profiles = await listDriverProfilesByUserIds([tripQuery.data.hostId]);
      return profiles[0] ?? null;
    },
    enabled: !!tripQuery.data,
  });

  const hostPrefsQuery = useQuery({
    queryKey: ["host-prefs", tripQuery.data?.hostId],
    queryFn: () =>
      tripQuery.data ? getHostPreferences(tripQuery.data.hostId) : Promise.resolve(null),
    enabled: !!tripQuery.data,
  });

  const reservationsQuery = useQuery({
    queryKey: ["trip-seat-reservations", tripId],
    queryFn: () => listTripSeatReservations(tripId),
    enabled: !!tripId,
    refetchInterval: 30_000,
  });

  const stopsQuery = useQuery({
    queryKey: ["trip-stops", tripId],
    queryFn: () => listTripStops(tripId),
    enabled: !!tripId,
  });

  const pastBookingsQuery = useQuery({
    queryKey: ["traveler-bookings", user?.$id],
    queryFn: () => listTravelerBookings(user!.$id),
    enabled: !!user?.$id,
  });

  useEffect(() => {
    if (!user) return;

    setPassengers((prev) => {
      const first = prev[0] || { name: "", phone: "", gender: "" };
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
      next[0] = { ...first, name, phone };
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
  const occupiedGenderByCode = useMemo(
    () =>
      new Map(
        (reservationsQuery.data ?? [])
          .filter((reservation) => reservation.gender)
          .map((reservation) => [reservation.seatCode, reservation.gender!]),
      ),
    [reservationsQuery.data],
  );

  /** Seat reservations are publicly readable; booking docs are not visible across travelers. */
  const remainingTripSeats = useMemo(() => {
    const trip = tripQuery.data;
    if (!trip) return 0;
    const sold = reservationsQuery.data?.length ?? 0;
    return Math.max(0, trip.totalSeats - sold);
  }, [tripQuery.data, reservationsQuery.data]);

  const sortedStops = useMemo(
    () => [...(stopsQuery.data ?? [])].sort((a, b) => a.stopIndex - b.stopIndex),
    [stopsQuery.data],
  );

  const segment = useMemo(() => {
    const trip = tripQuery.data;
    const firstStop = sortedStops[0];
    const lastStop = sortedStops[sortedStops.length - 1];
    const fromStopIndex = segmentSearch.fromStopIndex ?? firstStop?.stopIndex ?? 0;
    const toStopIndex = segmentSearch.toStopIndex ?? lastStop?.stopIndex ?? 0;
    const fromLabel = segmentSearch.fromLabel ?? trip?.fromLocation ?? "";
    const toLabel = segmentSearch.toLabel ?? trip?.toLocation ?? "";
    const price =
      segmentSearch.segmentPrice ??
      (trip && sortedStops.length >= 2
        ? getSegmentPrice(trip, sortedStops, fromStopIndex, toStopIndex)
        : trip && trip.totalSeats > 0
          ? trip.totalPrice / trip.totalSeats
          : 0);
    return { fromStopIndex, toStopIndex, fromLabel, toLabel, price };
  }, [tripQuery.data, sortedStops, segmentSearch]);

  const pricePerSeat = segment.price;

  // Boarding/arrival times for the passenger's own segment — estimated by
  // distance along the route when boarding at a mid-route stop.
  const segmentTimes = useMemo(() => {
    const trip = tripQuery.data;
    if (!trip) return null;
    return estimateSegmentTimes(
      trip,
      sortedStops,
      segment.fromStopIndex,
      segment.toStopIndex,
    );
  }, [tripQuery.data, sortedStops, segment.fromStopIndex, segment.toStopIndex]);

  const buildBookingPayload = () => {
    if (!user || !tripQuery.data) throw new Error("Not signed in.");
    const codes = [...selected];
    if (codes.length === 0) throw new Error("Select at least one seat.");

    const trimmed = passengers.slice(0, codes.length).map((p) => ({
      name: p.name.trim(),
      phone: p.phone.trim(),
      gender: p.gender,
    }));
    if (trimmed.some((p) => !p.name || !p.phone || !p.gender)) {
      throw new Error("Enter name, phone, and gender for every passenger.");
    }

    const primaryPhone = trimmed[0].phone;
    return { codes, trimmed, primaryPhone };
  };

  const confirmBooking = async (razorpayPaymentId?: string) => {
    if (!user || !tripQuery.data) throw new Error("Not signed in.");
    const { codes, trimmed, primaryPhone } = buildBookingPayload();

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
    const structuredPassengers = trimmed.map((passenger, index) => ({
      seatCode: codes[index],
      name: passenger.name,
      phone: passenger.phone,
      gender: passenger.gender as PassengerGender,
    }));

    return createBookingWithSeatReservations({
      tripId: tripQuery.data.id,
      travelerId: user.$id,
      hostId: tripQuery.data.hostId,
      fromStopIndex: segment.fromStopIndex,
      toStopIndex: segment.toStopIndex,
      seatsBooked: codes.length,
      segmentPrice: Math.round(pricePerSeat * codes.length * 100) / 100,
      passengerName: joinedName,
      passengerPhone: joinedPhone,
      passengers: structuredPassengers,
      status: "confirmed",
      seatCodes: codes,
      paymentMethod: "pay_online" as const,
      paymentReference: razorpayPaymentId ?? null,
    });
  };

  const handlePayOnline = async () => {
    try {
      buildBookingPayload(); // validate form before opening modal
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Please fill all details.");
      return;
    }

    setPaymentPending(true);
    try {
      const amountPaise = Math.round(totalAmount * 100);
      const order = await createRazorpayOrder({ data: { amountPaise, receipt: `coolpool_${Date.now()}` } });

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        toast.error("Payment gateway failed to load. Please refresh and try again.");
        return;
      }

      const rzp = new Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Coolpool",
        description: `Booking: ${segment.fromLabel} → ${segment.toLabel}`,
        prefill: {
          contact: user?.phone ?? "",
        },
        theme: { color: "#7C3AED" },
        // Surface UPI as the first, prominent payment block, with all other
        // enabled methods shown below it. (UPI must also be enabled for the
        // account in the Razorpay dashboard for it to actually render.)
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upi", "block.other"],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyRazorpayPayment({ data: response });
            const booking = await confirmBooking(response.razorpay_payment_id);
            toast.success("Payment successful! Booking confirmed.");
            await queryClient.invalidateQueries({ queryKey: ["trip-seat-reservations", tripId] });
            await queryClient.invalidateQueries({ queryKey: ["traveler-bookings"] });
            navigate({ to: "/trips", search: { booking: booking.id } as any });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Payment verification failed.");
          } finally {
            setPaymentPending(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled.");
            setPaymentPending(false);
          },
        },
      });

      rzp.on("payment.failed", (response: { error: { description: string } }) => {
        toast.error(response.error?.description ?? "Payment failed. Please try again.");
        setPaymentPending(false);
      });

      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not initiate payment.");
      setPaymentPending(false);
    }
  };

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
  const passengerDetailsComplete =
    selected.size > 0 &&
    passengers
      .slice(0, selected.size)
      .every((passenger) => passenger.name.trim() && passenger.phone.trim() && passenger.gender);

  const SERVICE_FEE = 20;
  const PAYMENT_GATEWAY_CHARGE = 5;

  const totalAmount =
    selected.size > 0
      ? pricePerSeat * selected.size + SERVICE_FEE + PAYMENT_GATEWAY_CHARGE
      : 0;

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
                <span className="font-semibold truncate">{segment.fromLabel}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold truncate">{segment.toLabel}</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {segmentTimes ? (
                  <>
                    Boarding {segmentTimes.isEstimated ? "~" : ""}
                    {new Date(segmentTimes.departureAt).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {" · arrives "}
                    {segmentTimes.isEstimated ? "~" : ""}
                    {new Date(segmentTimes.arrivalAt).toLocaleTimeString([], {
                      timeStyle: "short",
                    })}
                    {segmentTimes.isEstimated && (
                      <span className="text-muted-foreground/70"> (estimated)</span>
                    )}
                  </>
                ) : (
                  new Date(trip.departureAt).toLocaleString()
                )}
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
          {(trip.hostDisplayName || hostProfileQuery.data) && (
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2.5">
              <HostAvatar
                name={trip.hostDisplayName || hostProfileQuery.data?.fullName}
                photoUrl={hostProfileQuery.data?.photoUrl}
                size={40}
              />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {trip.hostDisplayName || hostProfileQuery.data?.fullName || "Verified Host"}
                </p>
                <p className="text-xs text-muted-foreground">Your host</p>
              </div>
            </div>
          )}
          {hostPrefsQuery.data && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Ride rules
              </p>
              <RidePrefChips prefs={hostPrefsQuery.data} size="md" />
            </div>
          )}
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
                  occupiedGenderByCode={occupiedGenderByCode}
                  selectedCodes={selected}
                  onTogglePassengerSeat={toggleSeat}
                  maxSelectable={remainingTripSeats}
                  seatConfig={trip.seatConfig}
                  disabled={paymentPending || reservationsQuery.isPending}
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
                          <Label className="text-xs font-semibold text-muted-foreground">
                            Gender
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            {(["male", "female"] as const).map((gender) => (
                              <button
                                key={gender}
                                type="button"
                                onClick={() => updatePassenger(idx, { gender })}
                                className={`h-10 rounded-xl border text-sm font-bold capitalize transition-colors ${
                                  p.gender === gender
                                    ? gender === "male"
                                      ? "border-blue-500 bg-blue-50 text-blue-700"
                                      : "border-pink-500 bg-pink-50 text-pink-700"
                                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/40"
                                }`}
                              >
                                {gender}
                              </button>
                            ))}
                          </div>
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
                <div className="flex items-center gap-3 rounded-2xl border border-primary/40 px-3 py-2.5 bg-primary/5">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Pay online via Razorpay</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Host charges ({selected.size} seat{selected.size === 1 ? "" : "s"})
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(pricePerSeat * selected.size)}
                  </span>
                </div>
                {selected.size > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Service fee</span>
                      <span className="font-semibold">{formatCurrency(SERVICE_FEE)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground/80">Inclusive of 18% GST</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment gateway charge</span>
                      <span className="font-semibold">{formatCurrency(PAYMENT_GATEWAY_CHARGE)}</span>
                    </div>
                  </>
                )}
                <div className="pt-2 border-t border-border/60 flex justify-between items-baseline">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-extrabold text-primary">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border/60">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(!!v)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-muted-foreground leading-snug">
                    I accept the{" "}
                    <Link to="/" className="text-primary underline">
                      Terms &amp; Conditions
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={callConsentGiven}
                    onCheckedChange={(v) => setCallConsentGiven(!!v)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-muted-foreground leading-snug">
                    I give consent to be called regarding my booking
                  </span>
                </label>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full rounded-2xl h-12 text-base"
                style={{ color: "#fff" }}
                disabled={
                  paymentPending ||
                  selected.size === 0 ||
                  remainingTripSeats === 0 ||
                  !termsAccepted ||
                  !callConsentGiven ||
                  !passengerDetailsComplete
                }
                onClick={() => void handlePayOnline()}
              >
                {paymentPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing payment…
                  </>
                ) : (
                  `Pay & book${selected.size > 0 ? ` • ${formatCurrency(totalAmount)}` : ""}`
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
