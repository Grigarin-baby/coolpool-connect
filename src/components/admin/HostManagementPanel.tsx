import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Button, Input, Drawer, message, Popconfirm, Space } from "antd";
import { ShieldCheck, Car, Users as UsersIcon } from "lucide-react";
import {
  listDriverProfiles,
  listAllVehicles,
  listAllTrips,
  listAllBookings,
  updateDriverVerification,
  updateVehicleVerification,
  assignRole,
} from "@/data/appwrite-repository";
import { getBookingPassengers } from "@/lib/booking-passengers";
import { seatCodeToLabel } from "@/lib/seatLayout";
import { hostNetEarnings } from "@/lib/pricing";
import { CreateUserButton, ResetPasswordButton } from "./AdminUserActions";
import type { DriverProfile } from "@/lib/domain";

const { Title, Text } = Typography;

const VERIF_COLOR: Record<string, string> = {
  approved: "success",
  pending: "warning",
  rejected: "error",
};

export function HostManagementPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DriverProfile | null>(null);

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["admin-all-vehicles"],
    queryFn: listAllVehicles,
  });
  const { data: trips = [] } = useQuery({
    queryKey: ["admin-all-trips"],
    queryFn: () => listAllTrips(1000),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => listAllBookings(1000),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-all-vehicles"] });
  };

  const verifyDriver = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) =>
      updateDriverVerification(v.id, v.status),
    onSuccess: () => {
      message.success("Host verification updated");
      invalidate();
    },
    onError: (e: any) => message.error(e?.message || "Failed"),
  });
  const verifyVehicle = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) =>
      updateVehicleVerification(v.id, v.status),
    onSuccess: () => {
      message.success("Vehicle verification updated");
      invalidate();
    },
    onError: (e: any) => message.error(e?.message || "Failed"),
  });
  const makeAdmin = useMutation({
    mutationFn: (userId: string) => assignRole(userId, "admin"),
    onSuccess: () => message.success("Admin role granted"),
    onError: (e: any) => message.error(e?.message || "Failed"),
  });

  // Hosts = account holders (a profile that isn't owned by another host).
  const hosts = useMemo(
    () => drivers.filter((d) => !d.ownerUserId || d.ownerUserId === d.userId),
    [drivers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        h.fullName.toLowerCase().includes(q) ||
        (h.email || "").toLowerCase().includes(q) ||
        (h.phone || "").toLowerCase().includes(q) ||
        h.userId.toLowerCase().includes(q),
    );
  }, [hosts, search]);

  const detail = useMemo(() => {
    if (!selected) return null;
    const uid = selected.userId;
    const hostVehicles = vehicles.filter((v) => v.driverUserId === uid);
    const teamDrivers = drivers.filter((d) => d.ownerUserId === uid && d.userId !== uid);
    const hostTrips = trips
      .filter((t) => t.hostId === uid)
      .sort((a, b) => new Date(b.departureAt).getTime() - new Date(a.departureAt).getTime());
    const bookingsByTrip = new Map<string, typeof bookings>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const arr = bookingsByTrip.get(b.tripId) || [];
      arr.push(b);
      bookingsByTrip.set(b.tripId, arr);
    }
    const grossCompleted = hostTrips
      .filter((t) => t.status === "completed")
      .reduce(
        (sum, t) =>
          sum +
          (bookingsByTrip.get(t.id) || []).reduce((s, b) => s + b.segmentPrice * b.seatsBooked, 0),
        0,
      );
    return {
      hostVehicles,
      teamDrivers,
      hostTrips,
      bookingsByTrip,
      netEarnings: hostNetEarnings(grossCompleted),
    };
  }, [selected, vehicles, drivers, trips, bookings]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Host Management
        </Title>
        <Text type="secondary">All hosts. Search by name, email, phone, or user ID.</Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <Input.Search
            allowClear
            placeholder="Search hosts by name, email, phone, or user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 420 }}
          />
          <CreateUserButton role="host" />
        </div>
        <Table
          rowKey="id"
          loading={driversLoading}
          dataSource={filtered}
          locale={{ emptyText: "No hosts found." }}
          pagination={{ pageSize: 10 }}
          onRow={(h) => ({ onClick: () => setSelected(h), style: { cursor: "pointer" } })}
          columns={[
            {
              title: "Name",
              key: "name",
              render: (_, h) => <Text strong>{h.fullName}</Text>,
            },
            {
              title: "Contact",
              key: "contact",
              render: (_, h) => (
                <div className="text-xs">
                  <div>{h.email || "—"}</div>
                  <div className="text-muted-foreground">{h.phone || "—"}</div>
                </div>
              ),
            },
            {
              title: "Verification",
              key: "verif",
              render: (_, h) => (
                <Tag color={VERIF_COLOR[h.verificationStatus || "pending"]} bordered={false} className="capitalize">
                  {h.verificationStatus || "pending"}
                </Tag>
              ),
            },
            {
              title: "Rating",
              key: "rating",
              render: (_, h) => ((h.ratingCount ?? 0) > 0 ? `${(h.ratingAvg ?? 0).toFixed(1)}★` : "New"),
            },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        placement="right"
        width={Math.min(560, typeof window !== "undefined" ? window.innerWidth : 560)}
        title={selected?.fullName}
      >
        {selected && detail && (
          <div className="space-y-5">
            {/* Profile */}
            <div className="rounded-2xl bg-gray-50 p-4 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <Text strong>{selected.fullName}</Text>
                <Tag color={VERIF_COLOR[selected.verificationStatus || "pending"]} bordered={false} className="capitalize m-0">
                  {selected.verificationStatus || "pending"}
                </Tag>
              </div>
              <div className="text-muted-foreground">Email: {selected.email || "—"}</div>
              <div className="text-muted-foreground">Phone: {selected.phone || "—"}</div>
              <div className="text-muted-foreground">License: {selected.licenseNumber || "—"}</div>
              <div className="text-muted-foreground">City: {selected.city || "—"}</div>
              {selected.bio && <div className="text-muted-foreground">Bio: {selected.bio}</div>}
              <div className="text-muted-foreground break-all">User ID: {selected.userId}</div>
              <div className="font-semibold text-emerald-700 pt-1">
                Net earnings (completed): ₹{detail.netEarnings.toLocaleString("en-IN")}
              </div>
            </div>

            <Space>
              <Popconfirm title="Verify this host?" onConfirm={() => verifyDriver.mutate({ id: selected.id, status: "approved" })}>
                <Button size="small" type="primary">Verify</Button>
              </Popconfirm>
              <Popconfirm title="Reject this host?" onConfirm={() => verifyDriver.mutate({ id: selected.id, status: "rejected" })}>
                <Button size="small" danger>Reject</Button>
              </Popconfirm>
              <Popconfirm title="Grant admin access?" onConfirm={() => makeAdmin.mutate(selected.userId)}>
                <Button size="small" icon={<ShieldCheck size={14} />}>Make Admin</Button>
              </Popconfirm>
              <ResetPasswordButton userId={selected.userId} />
            </Space>

            {/* Vehicles */}
            <div>
              <Text strong className="flex items-center gap-1.5 mb-2">
                <Car size={15} /> Vehicles ({detail.hostVehicles.length})
              </Text>
              <div className="space-y-2">
                {detail.hostVehicles.length === 0 && <Text type="secondary">No vehicles.</Text>}
                {detail.hostVehicles.map((v) => (
                  <div key={v.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{v.modelName}</span>
                      <Tag color={VERIF_COLOR[v.verificationStatus || "pending"]} bordered={false} className="capitalize m-0">
                        {v.verificationStatus || "pending"}
                      </Tag>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.plateNumber}{v.color ? ` · ${v.color}` : ""} · {v.seatCapacity} seats
                    </div>
                    <Space className="mt-2">
                      <Button size="small" type="primary" onClick={() => verifyVehicle.mutate({ id: v.id, status: "approved" })}>
                        Approve
                      </Button>
                      <Button size="small" danger onClick={() => verifyVehicle.mutate({ id: v.id, status: "rejected" })}>
                        Reject
                      </Button>
                    </Space>
                  </div>
                ))}
              </div>
            </div>

            {/* Team drivers */}
            {detail.teamDrivers.length > 0 && (
              <div>
                <Text strong className="flex items-center gap-1.5 mb-2">
                  <UsersIcon size={15} /> Drivers ({detail.teamDrivers.length})
                </Text>
                <div className="space-y-2">
                  {detail.teamDrivers.map((d) => (
                    <div key={d.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                      <div className="font-semibold">{d.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.phone || "—"} · License {d.licenseNumber || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hosted trips + who came */}
            <div>
              <Text strong className="block mb-2">
                Trips hosted ({detail.hostTrips.length})
              </Text>
              <div className="space-y-2">
                {detail.hostTrips.length === 0 && <Text type="secondary">No trips yet.</Text>}
                {detail.hostTrips.map((t) => {
                  const tb = detail.bookingsByTrip.get(t.id) || [];
                  const gross = tb.reduce((s, b) => s + b.segmentPrice * b.seatsBooked, 0);
                  const passengers = tb.flatMap((b) =>
                    getBookingPassengers(b).map((p) => ({ ...p, otp: b.otp, verified: b.verified, price: b.segmentPrice })),
                  );
                  return (
                    <div key={t.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {t.fromLocation.split(",")[0]} → {t.toLocation.split(",")[0]}
                        </span>
                        <Tag bordered={false} className="capitalize m-0">{t.status}</Tag>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.departureAt).toLocaleString("en-IN")} · collected ₹{gross}
                        {t.status === "completed" ? ` · host net ₹${hostNetEarnings(gross)}` : ""}
                      </div>
                      {passengers.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {passengers.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span>
                                {p.name}{p.gender ? ` (${p.gender === "male" ? "M" : "F"})` : ""} · {p.phone}
                              </span>
                              <span className="text-muted-foreground">
                                {seatCodeToLabel(p.seatCode)}{p.verified ? " ✓" : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
