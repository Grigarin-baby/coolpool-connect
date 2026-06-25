import { useQuery } from "@tanstack/react-query";
import { Card, Typography, Tag, Spin, List, Avatar } from "antd";
import { Activity, AlertTriangle, Car, Route as RouteIcon, Ticket, Users, Wallet } from "lucide-react";
import {
  listAllBookings,
  listAllTrips,
  listAllVehicles,
  listDriverProfiles,
} from "@/data/appwrite-repository";
import { platformFee, PLATFORM_FEE_PERCENT } from "@/lib/pricing";

const { Title, Text } = Typography;

export function OverviewPanel({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: listAllVehicles,
  });

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["admin-all-trips"],
    queryFn: () => listAllTrips(500),
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => listAllBookings(500),
  });

  const loading = driversLoading || vehiclesLoading || tripsLoading || bookingsLoading;

  const activeTrips = trips.filter((t) => t.status === "scheduled" || t.status === "in_progress");
  const revenue = bookings
    .filter((b) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum, b) => sum + (b.segmentPrice || 0) * (b.seatsBooked || 1), 0);
  const pendingDriverVerifications = drivers.filter(
    (d) => d.verificationStatus === "pending",
  ).length;
  const pendingVehicleVerifications = vehicles.filter(
    (v) => v.verificationStatus === "pending",
  ).length;
  const pendingVerifications = pendingDriverVerifications + pendingVehicleVerifications;

  const stats = [
    {
      label: "Total Drivers",
      value: drivers.length,
      icon: <Users size={18} />,
      tag: "Active network",
      tagColor: "purple",
      onClick: () => onNavigate("drivers"),
    },
    {
      label: "Total Vehicles",
      value: vehicles.length,
      icon: <Car size={18} />,
      tag: "Registered fleet",
      tagColor: "geekblue",
      onClick: () => onNavigate("vehicles"),
    },
    {
      label: "Total Trips",
      value: trips.length,
      icon: <RouteIcon size={18} />,
      tag: `${activeTrips.length} active`,
      tagColor: "blue",
      onClick: () => onNavigate("trips"),
    },
    {
      label: "Total Bookings",
      value: bookings.length,
      icon: <Ticket size={18} />,
      tag: `${bookings.filter((b) => b.status === "confirmed").length} confirmed`,
      tagColor: "cyan",
      onClick: () => onNavigate("bookings"),
    },
    {
      label: "Revenue (confirmed)",
      value: `₹${revenue.toLocaleString("en-IN")}`,
      icon: <Wallet size={18} />,
      tag: "Confirmed + completed",
      tagColor: "success",
      onClick: () => onNavigate("bookings"),
    },
    {
      label: "Platform earnings",
      value: `₹${platformFee(revenue).toLocaleString("en-IN")}`,
      icon: <Wallet size={18} />,
      tag: `${PLATFORM_FEE_PERCENT}% commission`,
      tagColor: "gold",
      onClick: () => onNavigate("bookings"),
    },
    {
      label: "Pending Verifications",
      value: pendingVerifications,
      icon: <AlertTriangle size={18} />,
      tag: pendingVerifications > 0 ? "Needs review" : "All clear",
      tagColor: pendingVerifications > 0 ? "warning" : "success",
      onClick: () => onNavigate("drivers"),
    },
  ];

  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentTrips = [...trips]
    .sort((a, b) => new Date(b.departureAt).getTime() - new Date(a.departureAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Administrator Control
        </Title>
        <Text type="secondary" className="text-lg">
          Monitoring the pulse of Coolpool's intercity ride-sharing network.
        </Text>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            onClick={s.onClick}
            className="rounded-3xl border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <Text type="secondary" className="group-hover:text-primary transition-colors">
                {s.label}
              </Text>
              <span className="text-primary/60">{s.icon}</span>
            </div>
            <Title level={2} style={{ margin: "8px 0" }}>
              {loading ? <Spin size="small" /> : s.value}
            </Title>
            <Tag color={s.tagColor} className="rounded-3xl px-3 border-none">
              {s.tag}
            </Tag>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-3xl border-none shadow-soft bg-white/80 backdrop-blur-sm p-2 overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <Title level={5} style={{ margin: 0 }}>
              Recent Bookings
            </Title>
            <a className="text-sm text-primary cursor-pointer" onClick={() => onNavigate("bookings")}>
              View all
            </a>
          </div>
          <List
            className="px-4"
            itemLayout="horizontal"
            loading={bookingsLoading}
            dataSource={recentBookings}
            locale={{ emptyText: "No bookings yet." }}
            renderItem={(b) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar className="bg-gradient-primary">
                      {b.passengerName.charAt(0) || "?"}
                    </Avatar>
                  }
                  title={<Text strong>{b.passengerName}</Text>}
                  description={`${b.seatsBooked} seat(s) · ₹${b.segmentPrice}`}
                />
                <Tag
                  color={
                    b.status === "confirmed"
                      ? "processing"
                      : b.status === "completed"
                        ? "success"
                        : b.status === "cancelled"
                          ? "error"
                          : "default"
                  }
                  bordered={false}
                  className="capitalize"
                >
                  {b.status}
                </Tag>
              </List.Item>
            )}
          />
        </Card>

        <Card className="rounded-3xl border-none shadow-soft bg-white/80 backdrop-blur-sm p-2 overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <Title level={5} style={{ margin: 0 }}>
              Recent Trips
            </Title>
            <a className="text-sm text-primary cursor-pointer" onClick={() => onNavigate("trips")}>
              View all
            </a>
          </div>
          <List
            className="px-4"
            itemLayout="horizontal"
            loading={tripsLoading}
            dataSource={recentTrips}
            locale={{ emptyText: "No trips found." }}
            renderItem={(trip) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <div className="h-10 w-10 rounded-3xl bg-secondary flex items-center justify-center">
                      <Activity size={18} className="text-primary" />
                    </div>
                  }
                  title={
                    <Text strong>
                      {trip.fromLocation.split(",")[0]} → {trip.toLocation.split(",")[0]}
                    </Text>
                  }
                  description={`${new Date(trip.departureAt).toLocaleString()} · ₹${trip.totalPrice}`}
                />
                <Tag
                  color={
                    trip.status === "in_progress"
                      ? "processing"
                      : trip.status === "completed"
                        ? "success"
                        : trip.status === "cancelled"
                          ? "error"
                          : "blue"
                  }
                  bordered={false}
                  className="capitalize"
                >
                  {trip.status?.replace("_", " ")}
                </Tag>
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
