import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Space, Button, Popconfirm, Select, message } from "antd";
import { listAllBookings, listAllTrips, updateBookingStatus } from "@/data/appwrite-repository";
import type { BookingStatus } from "@/lib/domain";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: "default",
  confirmed: "processing",
  completed: "success",
  cancelled: "error",
  no_show: "error",
};

const STATUS_OPTIONS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No-show", value: "no_show" },
];

export function BookingsPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => listAllBookings(500),
  });

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["admin-all-trips"],
    queryFn: () => listAllTrips(500),
  });

  const tripById = new Map(trips.map((t) => [t.id, t]));

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => updateBookingStatus(bookingId, "cancelled"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-bookings"] });
      message.success("Booking cancelled");
    },
    onError: (error: any) => message.error(error.message),
  });

  const filtered =
    statusFilter === "all" ? bookings : bookings.filter((b) => b.status === statusFilter);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Booking Manager
        </Title>
        <Text type="secondary">View and manage every booking made on the platform.</Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="px-4 pt-4 flex justify-end">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 180 }}
          />
        </div>
        <Table
          rowKey="id"
          loading={bookingsLoading || tripsLoading}
          dataSource={filtered}
          locale={{ emptyText: "No bookings found." }}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Passenger",
              key: "passenger",
              render: (_, b) => (
                <div>
                  <Text strong>{b.passengerName}</Text>
                  <div className="text-xs text-muted-foreground">{b.passengerPhone}</div>
                </div>
              ),
            },
            {
              title: "Route",
              key: "route",
              render: (_, b) => {
                const trip = tripById.get(b.tripId);
                return trip ? (
                  <Text>
                    {trip.fromLocation.split(",")[0]} → {trip.toLocation.split(",")[0]}
                  </Text>
                ) : (
                  <Text type="secondary">Trip not found</Text>
                );
              },
            },
            {
              title: "Departure",
              key: "departure",
              render: (_, b) => {
                const trip = tripById.get(b.tripId);
                return trip ? new Date(trip.departureAt).toLocaleString() : "—";
              },
            },
            {
              title: "Seats",
              dataIndex: "seatsBooked",
              key: "seats",
            },
            {
              title: "Price",
              key: "price",
              render: (_, b) => `₹${b.segmentPrice}`,
            },
            {
              title: "OTP Verified",
              key: "verified",
              render: (_, b) => (
                <Tag color={b.verified ? "success" : "default"} bordered={false}>
                  {b.verified ? "Yes" : "No"}
                </Tag>
              ),
            },
            {
              title: "Status",
              key: "status",
              render: (_, b) => (
                <Tag
                  color={STATUS_COLOR[b.status]}
                  bordered={false}
                  className="capitalize px-3 rounded-3xl"
                >
                  {b.status === "no_show" ? "No-show" : b.status}
                </Tag>
              ),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, b) => (
                <Space>
                  <Popconfirm
                    title="Cancel this booking?"
                    onConfirm={() => cancelMutation.mutate(b.id)}
                    okText="Cancel booking"
                    okButtonProps={{ danger: true }}
                    disabled={b.status === "cancelled" || b.status === "completed" || b.status === "no_show"}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      disabled={
                        b.status === "cancelled" ||
                        b.status === "completed" ||
                        b.status === "no_show" ||
                        cancelMutation.isPending
                      }
                    >
                      Cancel
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
