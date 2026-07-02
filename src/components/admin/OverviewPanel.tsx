import { useQuery } from "@tanstack/react-query";
import { Card, Typography, Tag, Spin, List, Avatar } from "antd";
import {
  Activity,
  AlertTriangle,
  Car,
  CheckCircle,
  Route as RouteIcon,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import {
  listAllBookings,
  listAllTrips,
  listAllVehicles,
  listDriverProfiles,
} from "@/data/appwrite-repository";
import { platformFee, PLATFORM_FEE_PERCENT } from "@/lib/pricing";

const { Title, Text } = Typography;

const STAT_COLORS: Record<string, { bg: string; text: string }> = {
  purple: { bg: "rgba(107,70,193,0.10)", text: "#6b46c1" },
  geekblue: { bg: "rgba(49,100,211,0.10)", text: "#3164d3" },
  blue:    { bg: "rgba(22,119,255,0.10)", text: "#1677ff" },
  cyan:    { bg: "rgba(19,194,194,0.10)", text: "#13c2c2" },
  success: { bg: "rgba(82,196,26,0.10)",  text: "#52c41a" },
  gold:    { bg: "rgba(212,160,23,0.10)", text: "#d4a017" },
  warning: { bg: "rgba(250,173,20,0.10)", text: "#faad14" },
};

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
  const completedTrips = trips.filter((t) => t.status === "completed").length;
  const revenue = bookings
    .filter((b) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum, b) => sum + (b.segmentPrice || 0) * (b.seatsBooked || 1), 0);
  const pendingDriverVerifications = drivers.filter((d) => d.verificationStatus === "pending").length;
  const pendingVehicleVerifications = vehicles.filter((v) => v.verificationStatus === "pending").length;
  const pendingVerifications = pendingDriverVerifications + pendingVehicleVerifications;

  const stats = [
    {
      label: "Hosts + Drivers",
      value: drivers.length,
      icon: <Users size={26} />,
      tag: "Active network",
      tagColor: "purple",
      onClick: () => onNavigate("hosts"),
    },
    {
      label: "Total Vehicles",
      value: vehicles.length,
      icon: <Car size={26} />,
      tag: "Registered fleet",
      tagColor: "geekblue",
      onClick: () => onNavigate("hosts"),
    },
    {
      label: "Total Trips",
      value: trips.length,
      icon: <RouteIcon size={26} />,
      tag: `${activeTrips.length} active`,
      tagColor: "blue",
      onClick: () => onNavigate("trips"),
    },
    {
      label: "Completed Trips",
      value: completedTrips,
      icon: <CheckCircle size={26} />,
      tag: "Successfully finished",
      tagColor: "success",
      onClick: () => onNavigate("trips"),
    },
    {
      label: "Total Bookings",
      value: bookings.length,
      icon: <Ticket size={26} />,
      tag: `${bookings.filter((b) => b.status === "confirmed").length} confirmed`,
      tagColor: "cyan",
      onClick: () => onNavigate("bookings"),
    },
    {
      label: "Revenue (confirmed)",
      value: `₹${revenue.toLocaleString("en-IN")}`,
      icon: <Wallet size={26} />,
      tag: "Confirmed + completed",
      tagColor: "cyan",
      onClick: () => onNavigate("bookings"),
    },
    {
      label: "Platform earnings",
      value: `₹${platformFee(revenue).toLocaleString("en-IN")}`,
      icon: <Wallet size={26} />,
      tag: `${PLATFORM_FEE_PERCENT}% commission`,
      tagColor: "gold",
      onClick: () => onNavigate("bookings"),
    },
    {
      label: "Pending Verifications",
      value: pendingVerifications,
      icon: <AlertTriangle size={26} />,
      tag: pendingVerifications > 0 ? "Needs review" : "All clear",
      tagColor: pendingVerifications > 0 ? "warning" : "success",
      onClick: () => onNavigate("hosts"),
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
      <div className="flex flex-col gap-2">
        <Title level={1} style={{ margin: 0 }}>
          Administrator Control
        </Title>
        <Text type="secondary" className="text-lg">
          Monitoring the pulse of Coolpool's intercity ride-sharing network.
        </Text>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((s) => {
          const colors = STAT_COLORS[s.tagColor] ?? STAT_COLORS.purple;
          return (
            <Card
              key={s.label}
              onClick={s.onClick}
              className="rounded-3xl border-none shadow-soft hover:shadow-card transition-base bg-white/80 backdrop-blur-sm cursor-pointer group"
              styles={{ body: { padding: "24px 28px" } }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 52,
                    height: 52,
                    background: colors.bg,
                    color: colors.text,
                  }}
                >
                  {s.icon}
                </div>
                <Tag
                  color={s.tagColor}
                  bordered={false}
                  className="rounded-2xl text-xs font-semibold mt-1"
                >
                  {s.tag}
                </Tag>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold leading-none tracking-tight" style={{ color: "#1a1a2e" }}>
                  {loading ? <Spin size="small" /> : s.value}
                </div>
                <Text type="secondary" className="text-sm mt-1 block group-hover:text-primary transition-colors">
                  {s.label}
                </Text>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card
          className="rounded-3xl border-none shadow-soft bg-white/80 backdrop-blur-sm overflow-hidden"
          styles={{ body: { padding: 0 } }}
        >
          <div className="px-7 py-5 border-b border-border/60 flex items-center justify-between">
            <Title level={4} style={{ margin: 0 }}>Recent Bookings</Title>
            <span
              className="text-sm font-semibold text-primary cursor-pointer hover:underline"
              onClick={() => onNavigate("bookings")}
            >
              View all
            </span>
          </div>
          <List
            className="px-4"
            itemLayout="horizontal"
            loading={bookingsLoading}
            dataSource={recentBookings}
            locale={{ emptyText: "No bookings yet." }}
            renderItem={(b) => (
              <List.Item className="py-4">
                <List.Item.Meta
                  avatar={
                    <Avatar size={44} className="bg-gradient-primary text-base font-bold">
                      {b.passengerName.charAt(0) || "?"}
                    </Avatar>
                  }
                  title={<Text strong className="text-base">{b.passengerName}</Text>}
                  description={
                    <span className="text-sm">{b.seatsBooked} seat(s) · ₹{b.segmentPrice}</span>
                  }
                />
                <Tag
                  color={
                    b.status === "confirmed" ? "processing"
                    : b.status === "completed" ? "success"
                    : b.status === "cancelled" ? "error"
                    : "default"
                  }
                  bordered={false}
                  className="capitalize text-sm"
                >
                  {b.status}
                </Tag>
              </List.Item>
            )}
          />
        </Card>

        <Card
          className="rounded-3xl border-none shadow-soft bg-white/80 backdrop-blur-sm overflow-hidden"
          styles={{ body: { padding: 0 } }}
        >
          <div className="px-7 py-5 border-b border-border/60 flex items-center justify-between">
            <Title level={4} style={{ margin: 0 }}>Recent Trips</Title>
            <span
              className="text-sm font-semibold text-primary cursor-pointer hover:underline"
              onClick={() => onNavigate("trips")}
            >
              View all
            </span>
          </div>
          <List
            className="px-4"
            itemLayout="horizontal"
            loading={tripsLoading}
            dataSource={recentTrips}
            locale={{ emptyText: "No trips found." }}
            renderItem={(trip) => (
              <List.Item className="py-4">
                <List.Item.Meta
                  avatar={
                    <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity size={20} className="text-primary" />
                    </div>
                  }
                  title={
                    <Text strong className="text-base">
                      {trip.fromLocation.split(",")[0]} → {trip.toLocation.split(",")[0]}
                    </Text>
                  }
                  description={
                    <span className="text-sm">
                      {new Date(trip.departureAt).toLocaleString()} · ₹{trip.totalPrice}
                    </span>
                  }
                />
                <Tag
                  color={
                    trip.status === "in_progress" ? "processing"
                    : trip.status === "completed" ? "success"
                    : trip.status === "cancelled" ? "error"
                    : "blue"
                  }
                  bordered={false}
                  className="capitalize text-sm"
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
