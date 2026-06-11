import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Space, Button, Popconfirm, Select, message } from "antd";
import { listAllTrips, updateTrip } from "@/data/appwrite-repository";
import type { TripStatus } from "@/lib/domain";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<TripStatus, string> = {
  scheduled: "blue",
  in_progress: "processing",
  completed: "success",
  cancelled: "error",
};

const STATUS_OPTIONS: { label: string; value: TripStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export function TripsPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["admin-all-trips"],
    queryFn: () => listAllTrips(500),
  });

  const cancelMutation = useMutation({
    mutationFn: (tripId: string) => updateTrip(tripId, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-trips"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-trips"] });
      message.success("Trip cancelled");
    },
    onError: (error: any) => message.error(error.message),
  });

  const filtered =
    statusFilter === "all" ? trips : trips.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Trip Manager
        </Title>
        <Text type="secondary">
          Live monitoring of all scheduled, active, completed and cancelled routes.
        </Text>
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
          loading={isLoading}
          dataSource={filtered}
          locale={{ emptyText: "No trips found." }}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Route",
              key: "route",
              render: (_, trip) => (
                <Text strong>
                  {trip.fromLocation.split(",")[0]} → {trip.toLocation.split(",")[0]}
                </Text>
              ),
            },
            {
              title: "Departure",
              key: "departure",
              render: (_, trip) => new Date(trip.departureAt).toLocaleString(),
            },
            {
              title: "Seats",
              dataIndex: "totalSeats",
              key: "seats",
            },
            {
              title: "Price",
              key: "price",
              render: (_, trip) => `₹${trip.totalPrice}`,
            },
            {
              title: "Status",
              key: "status",
              render: (_, trip) => (
                <Tag
                  color={STATUS_COLOR[trip.status]}
                  bordered={false}
                  className="capitalize px-3 rounded-3xl"
                >
                  {trip.status?.replace("_", " ")}
                </Tag>
              ),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, trip) => (
                <Space>
                  <Popconfirm
                    title="Cancel this trip?"
                    description="Passengers with active bookings will need to be notified separately."
                    onConfirm={() => cancelMutation.mutate(trip.id)}
                    okText="Cancel trip"
                    okButtonProps={{ danger: true }}
                    disabled={trip.status === "cancelled" || trip.status === "completed"}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      disabled={
                        trip.status === "cancelled" ||
                        trip.status === "completed" ||
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
