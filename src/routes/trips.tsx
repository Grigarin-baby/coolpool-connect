import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Ticket, MapPin, Calendar, Users, Loader2, ShieldCheck, KeyRound, CheckCircle2, Download, Radio, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { listTravelerBookings, getTripById } from "@/data/appwrite-repository";
import { RideRouteMap } from "@/components/RideRouteMap";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { showAppNotification } from "@/lib/notifications";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import type { Booking, Trip } from "@/lib/domain";

type TripsSearch = { booking?: string };

export const Route = createFileRoute("/trips")({
  validateSearch: (search: Record<string, unknown>): TripsSearch => ({
    booking: typeof search.booking === "string" ? search.booking : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My trips — Coolpool" },
      { name: "description", content: "View your bookings and upcoming rides." },
    ],
  }),
  component: TripsPage,
});

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "cancelled":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "completed":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function downloadTicketPdf(
  booking: Booking,
  trip: Trip | undefined,
  passengerList: { seat: string; name: string; phone: string }[],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(16, 122, 87);
  doc.text("coolpool", margin, y);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("Ride Ticket", 595 - margin, y, { align: "right" });

  y += 30;
  doc.setDrawColor(220);
  doc.line(margin, y, 595 - margin, y);
  y += 30;

  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 140, y);
    y += 22;
  };

  addRow("Booking ID", booking.id);
  addRow("Status", booking.status.toUpperCase());
  if (trip) {
    addRow("From", trip.fromLocation);
    addRow("To", trip.toLocation);
    addRow("Departure", dayjs(trip.departureAt).format("MMM D, YYYY • h:mm A"));
  }
  addRow("Seats booked", String(booking.seatsBooked));
  addRow("Amount paid", `Rs. ${booking.segmentPrice}`);
  addRow("Booked on", dayjs(booking.createdAt).format("MMM D, YYYY • h:mm A"));

  if (booking.otp) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Boarding OTP", margin, y);
    doc.setFontSize(18);
    doc.text(booking.otp, margin + 140, y);
    doc.setFontSize(11);
    y += 30;
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Passengers", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  passengerList.forEach((p) => {
    doc.text(`Seat ${p.seat}: ${p.name}${p.phone ? ` (${p.phone})` : ""}`, margin, y);
    y += 20;
  });

  y += 20;
  doc.setDrawColor(220);
  doc.line(margin, y, 595 - margin, y);
  y += 24;
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text("Show this ticket and your boarding OTP to the host when boarding.", margin, y);

  doc.save(`coolpool-ticket-${booking.id}.pdf`);
}

function LiveTripTracker({ trip }: { trip: Trip }) {
  const isLive = trip.status === "in_progress";
  const liveQuery = useQuery({
    queryKey: ["trip-live-location", trip.id],
    queryFn: () => getTripById(trip.id),
    enabled: isLive,
    refetchInterval: isLive ? 8000 : false,
  });

  if (!isLive) return null;

  const live = liveQuery.data ?? trip;
  const liveLocation =
    live.currentLat != null && live.currentLng != null
      ? { lat: live.currentLat, lng: live.currentLng }
      : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
        <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
        <span className="text-sm font-semibold text-emerald-700">
          Trip in progress — track your ride live
        </span>
      </div>
      <RideRouteMap
        fromLat={trip.fromLat}
        fromLng={trip.fromLng}
        toLat={trip.toLat}
        toLng={trip.toLng}
        polyline={trip.polyline}
        liveLocation={liveLocation}
      />
    </div>
  );
}

function TripsPage() {
  const { user, loading: authLoading } = useAuth();
  const { booking: highlightedBookingId } = Route.useSearch();
  const [expandedId, setExpandedId] = useState<string | null>(highlightedBookingId ?? null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Right after a booking, ask the traveler to enable notifications so they
  // get live updates (driver started, etc.). Optional for travelers.
  const { permission: notifPermission, supported: notifSupported, request: requestNotif } =
    useNotificationPermission();
  const [notifAskDismissed, setNotifAskDismissed] = useState(false);
  const showNotifAsk =
    Boolean(highlightedBookingId) &&
    notifSupported &&
    notifPermission === "default" &&
    !notifAskDismissed;

  useEffect(() => {
    if (highlightedBookingId) {
      setExpandedId(highlightedBookingId);
      const t = window.setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
      return () => window.clearTimeout(t);
    }
  }, [highlightedBookingId]);

  const bookingsQuery = useQuery({
    queryKey: ["traveler-bookings", user?.$id],
    queryFn: () => listTravelerBookings(user!.$id),
    enabled: !!user?.$id,
  });

  const tripIds = Array.from(new Set(bookingsQuery.data?.map((b) => b.tripId) ?? []));

  const tripsQuery = useQuery({
    queryKey: ["trips-for-bookings", tripIds],
    queryFn: async () => {
      const trips = await Promise.all(
        tripIds.map((id) =>
          getTripById(id).catch(() => null as Trip | null),
        ),
      );
      const map = new Map<string, Trip>();
      trips.forEach((t) => {
        if (t) map.set(t.id, t);
      });
      return map;
    },
    enabled: tripIds.length > 0,
    refetchInterval: tripIds.length > 0 ? 20000 : false,
  });

  const isLoading = authLoading || bookingsQuery.isLoading || tripsQuery.isLoading;
  const bookings = bookingsQuery.data ?? [];

  // Notify the passenger when their driver starts the trip.
  const tripStatusRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const trips = tripsQuery.data;
    if (!trips) return;

    trips.forEach((trip, id) => {
      const prevStatus = tripStatusRef.current.get(id);
      if (prevStatus && prevStatus !== "in_progress" && trip.status === "in_progress") {
        void showAppNotification("Your ride has started!", {
          body: `${trip.fromLocation} → ${trip.toLocation} — track your driver live.`,
          url: "/trips",
          tag: `trip-started-${id}`,
        });
      }
      tripStatusRef.current.set(id, trip.status);
    });
  }, [tripsQuery.data]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 bg-fixed">
      <SiteHeader />
      {showNotifAsk && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm rounded-3xl p-7 text-center shadow-card border-border/60 bg-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Bell className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-xl font-bold">Booking confirmed! 🎉</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Enable notifications to get live updates about your trip — like when your driver
              starts the ride.
            </p>
            <Button
              variant="hero"
              className="mt-5 w-full rounded-3xl h-11 font-bold"
              onClick={() => {
                void requestNotif().finally(() => setNotifAskDismissed(true));
              }}
            >
              Enable Notifications
            </Button>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setNotifAskDismissed(true)}
            >
              Maybe later
            </button>
          </Card>
        </div>
      )}
      <main className="container mx-auto px-4 pt-24 pb-10 md:pt-28 md:pb-14 max-w-4xl flex-1">
        <NotificationPermissionPrompt />
        <div className="mb-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My trips</h1>
            <p className="text-sm text-muted-foreground">Your booked rides and seat details.</p>
          </div>
        </div>

        {!user && !authLoading ? (
          <Card className="p-10 rounded-3xl text-center shadow-card border-border/60 bg-white/80">
            <p className="text-base text-muted-foreground mb-4">
              Sign in to see your bookings.
            </p>
            <Button asChild variant="hero" className="rounded-3xl">
              <Link to="/members">Sign in</Link>
            </Button>
          </Card>
        ) : isLoading ? (
          <Card className="p-16 rounded-3xl text-center shadow-card border-border/60 bg-white/80">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
          </Card>
        ) : bookings.length === 0 ? (
          <Card className="p-12 rounded-3xl text-center shadow-card border-border/60 bg-gradient-soft">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
              <Ticket className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">No trips yet</h2>
            <p className="mt-2 text-muted-foreground">
              Once you book a ride, it'll show up here.
            </p>
            <Button asChild variant="hero" className="mt-6 rounded-3xl">
              <a href="/#find-a-ride">Find a ride</a>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const trip = tripsQuery.data?.get(b.tripId);
              const departure = trip ? dayjs(trip.departureAt) : null;
              const isExpanded = expandedId === b.id;
              const isJustBooked = highlightedBookingId === b.id;
              const nameParts = (b.passengerName || "").split("|").map((s) => s.trim());
              const phoneParts = (b.passengerPhone || "").split("|").map((s) => s.trim());
              const passengerList = nameParts.map((raw, i) => {
                const m = raw.match(/^Seat\s+([^:]+):\s*(.*)$/i);
                return {
                  seat: m ? m[1] : String(i + 1),
                  name: m ? m[2] : raw,
                  phone: phoneParts[i] || phoneParts[0] || "",
                };
              });
              const primaryDisplay =
                passengerList[0]?.name +
                (passengerList.length > 1 ? ` +${passengerList.length - 1}` : "");
              return (
                <Card
                  key={b.id}
                  ref={isJustBooked ? highlightRef : undefined}
                  onClick={() => setExpandedId(b.id)}
                  className={`p-5 rounded-3xl border bg-white/85 shadow-card hover:shadow-elevated transition-all cursor-pointer ${
                    isJustBooked
                      ? "border-emerald-400 ring-2 ring-emerald-400/40"
                      : "border-border/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className={`rounded-full border ${statusColor(b.status)} capitalize`}>
                        {b.status}
                      </Badge>
                      {departure && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {departure.format("MMM D, YYYY • h:mm A")}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-600">₹{b.segmentPrice}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {b.seatsBooked} seat{b.seatsBooked > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {trip ? (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center shrink-0 self-stretch py-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span className="w-px flex-1 min-h-[1.5rem] bg-gray-200" />
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{trip.fromLocation}</div>
                        <div className="font-semibold text-gray-900 truncate mt-3">{trip.toLocation}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Trip details unavailable.
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-sm">
                    <div className="text-muted-foreground flex items-center gap-1.5 truncate">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">{primaryDisplay}</span>
                    </div>
                    {!isExpanded && (
                      <span className="text-xs font-semibold text-primary">Tap to view ticket</span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      {isJustBooked && (
                        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-700">
                            Booking confirmed
                          </span>
                        </div>
                      )}

                      {trip && <LiveTripTracker trip={trip} />}

                      {b.otp && (
                        <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                            <KeyRound className="h-4 w-4" />
                            Boarding OTP
                          </div>
                          <div className="mt-2 font-mono text-3xl font-extrabold tracking-[0.55rem] text-gray-900">
                            {b.otp}
                          </div>
                          {b.verified ? (
                            <Badge className="mt-3 rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Verified by host
                            </Badge>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              Share with your ride host at boarding.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="rounded-2xl bg-gray-50/70 border border-gray-100 p-4 space-y-3 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-2">
                            Passengers ({passengerList.length})
                          </div>
                          <div className="space-y-2">
                            {passengerList.map((p, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{p.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">{p.phone}</div>
                                </div>
                                <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
                                  Seat #{p.seat}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price paid</span>
                          <span className="font-semibold text-emerald-600">₹{b.segmentPrice}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Booked on</span>
                          <span className="font-semibold">
                            {dayjs(b.createdAt).format("MMM D, YYYY • h:mm A")}
                          </span>
                        </div>
                        {trip && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Departure</span>
                            <span className="font-semibold">
                              {dayjs(trip.departureAt).format("MMM D, YYYY • h:mm A")}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="hero"
                        size="sm"
                        className="w-full rounded-2xl gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadTicketPdf(b, trip, passengerList);
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download Ticket
                      </Button>

                      {trip && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="w-full rounded-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link to="/booking/$tripId" params={{ tripId: trip.id }}>
                            Open ride page
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
