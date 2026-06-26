import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Input, Drawer } from "antd";
import { User as UserIcon } from "lucide-react";
import { listAllBookings, listAllTrips, listDriverProfiles } from "@/data/appwrite-repository";
import { getBookingPassengers } from "@/lib/booking-passengers";
import { seatCodeToLabel } from "@/lib/seatLayout";
import { CreateUserButton, ResetPasswordButton } from "./AdminUserActions";
import type { Booking, Trip } from "@/lib/domain";

const { Title, Text } = Typography;

interface GuestRow {
  userId: string;
  name: string;
  phone: string;
  gender?: string;
  bookings: Booking[];
  lastAt: number;
}

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending: "default",
  confirmed: "processing",
  completed: "success",
  cancelled: "error",
  no_show: "error",
};

export function GuestManagementPanel() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GuestRow | null>(null);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => listAllBookings(1000),
  });
  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["admin-all-trips"],
    queryFn: () => listAllTrips(1000),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const tripById = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips]);
  const hostNameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    drivers.forEach((d) => m.set(d.userId, d.fullName));
    return m;
  }, [drivers]);

  // Build one row per traveler (guest) from their bookings.
  const guests = useMemo<GuestRow[]>(() => {
    const byUser = new Map<string, GuestRow>();
    for (const b of bookings) {
      if (!b.travelerId) continue;
      const primary = getBookingPassengers(b)[0];
      const at = new Date(b.createdAt).getTime();
      const existing = byUser.get(b.travelerId);
      if (existing) {
        existing.bookings.push(b);
        if (at > existing.lastAt) existing.lastAt = at;
      } else {
        byUser.set(b.travelerId, {
          userId: b.travelerId,
          name: primary?.name || b.passengerName || "Guest",
          phone: primary?.phone || b.passengerPhone || "",
          gender: primary?.gender,
          bookings: [b],
          lastAt: at,
        });
      }
    }
    return [...byUser.values()].sort((a, b) => b.lastAt - a.lastAt);
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.phone.toLowerCase().includes(q) ||
        g.userId.toLowerCase().includes(q),
    );
  }, [guests, search]);

  const hostNameForTrip = (trip?: Trip) =>
    trip ? trip.hostDisplayName || hostNameByUserId.get(trip.hostId) || "Host" : "—";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Guest Management
        </Title>
        <Text type="secondary">Everyone who has booked a ride. Search by name, phone, or user ID.</Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <Input.Search
            allowClear
            placeholder="Search guests by name, phone, or user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 420 }}
          />
          <CreateUserButton role="guest" />
        </div>
        <Table
          rowKey="userId"
          loading={bookingsLoading || tripsLoading}
          dataSource={filtered}
          locale={{ emptyText: "No guests found." }}
          pagination={{ pageSize: 10 }}
          onRow={(g) => ({ onClick: () => setSelected(g), style: { cursor: "pointer" } })}
          columns={[
            {
              title: "Name",
              key: "name",
              render: (_, g) => (
                <div>
                  <Text strong>{g.name}</Text>
                  {g.gender && (
                    <span className="ml-2 text-xs text-muted-foreground capitalize">{g.gender}</span>
                  )}
                </div>
              ),
            },
            { title: "Phone", dataIndex: "phone", key: "phone", render: (v: string) => v || "—" },
            { title: "Bookings", key: "count", render: (_, g) => g.bookings.length },
            {
              title: "Last booking",
              key: "last",
              render: (_, g) => new Date(g.lastAt).toLocaleDateString("en-IN"),
            },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        placement="right"
        width={Math.min(520, typeof window !== "undefined" ? window.innerWidth : 520)}
        title={selected?.name}
      >
        {selected && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gray-50 p-4 space-y-1 text-sm">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <UserIcon size={16} /> {selected.name}
                {selected.gender && (
                  <span className="text-xs font-normal text-muted-foreground capitalize">
                    · {selected.gender}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground">Phone: {selected.phone || "—"}</div>
              <div className="text-muted-foreground break-all">User ID: {selected.userId}</div>
              <div className="text-muted-foreground">{selected.bookings.length} booking(s)</div>
            </div>

            <div>
              <Text strong className="block mb-2">
                Trips booked
              </Text>
              <div className="space-y-2">
                {selected.bookings
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((b) => {
                    const trip = tripById.get(b.tripId);
                    const seats = getBookingPassengers(b)
                      .map((p) => seatCodeToLabel(p.seatCode))
                      .join(", ");
                    return (
                      <div key={b.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            {trip
                              ? `${trip.fromLocation.split(",")[0]} → ${trip.toLocation.split(",")[0]}`
                              : "Trip not found"}
                          </span>
                          <Tag
                            color={BOOKING_STATUS_COLOR[b.status] || "default"}
                            bordered={false}
                            className="capitalize m-0"
                          >
                            {b.status === "no_show" ? "No-show" : b.status}
                          </Tag>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {trip ? new Date(trip.departureAt).toLocaleString("en-IN") : "—"}
                          {seats ? ` · Seat ${seats}` : ""} · ₹{b.segmentPrice}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Host: {hostNameForTrip(trip)}
                          {b.otp ? ` · OTP ${b.otp}${b.verified ? " ✓" : ""}` : ""}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="space-y-2">
              <ResetPasswordButton userId={selected.userId} block />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
