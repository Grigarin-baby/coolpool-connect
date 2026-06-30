import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Space, Button, Popconfirm, message } from "antd";
import { ShieldCheck } from "lucide-react";
import { listAllBookings, listDriverProfiles } from "@/data/appwrite-repository";
import { account } from "@/integrations/appwrite/client";
import { adminGrantAdminLabel } from "@/integrations/appwrite/account-server";

const { Title, Text } = Typography;

interface DirectoryUser {
  key: string;
  userId: string;
  name: string;
  contact: string;
  role: "Host / Driver" | "Traveler";
  detail: string;
}

export function UsersPanel() {
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-all-bookings"],
    queryFn: () => listAllBookings(500),
  });

  const grantAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { jwt } = await account.createJWT();
      await adminGrantAdminLabel({ data: { jwt, userId } });
    },
    onSuccess: () => {
      message.success("Admin role granted");
    },
    onError: (error: any) => message.error(error.message),
  });

  const users = useMemo<DirectoryUser[]>(() => {
    const driverUsers: DirectoryUser[] = drivers.map((d) => ({
      key: `driver-${d.userId}`,
      userId: d.userId,
      name: d.fullName,
      contact: `${d.email} · ${d.phone}`,
      role: "Host / Driver",
      detail: `${d.city} · License ${d.licenseNumber}`,
    }));

    const travelerMap = new Map<string, DirectoryUser>();
    for (const b of bookings) {
      if (!b.travelerId || travelerMap.has(b.travelerId)) continue;
      travelerMap.set(b.travelerId, {
        key: `traveler-${b.travelerId}`,
        userId: b.travelerId,
        name: b.passengerName,
        contact: b.passengerPhone,
        role: "Traveler",
        detail: `${bookings.filter((x) => x.travelerId === b.travelerId).length} booking(s)`,
      });
    }

    return [...driverUsers, ...travelerMap.values()];
  }, [drivers, bookings]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          User Management
        </Title>
        <Text type="secondary">
          Directory built from registered drivers/hosts and travelers seen in bookings.
        </Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <Table
          rowKey="key"
          loading={driversLoading || bookingsLoading}
          dataSource={users}
          locale={{ emptyText: "No users found yet." }}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Name",
              dataIndex: "name",
              key: "name",
              render: (name: string) => <Text strong>{name || "Unnamed"}</Text>,
            },
            {
              title: "Contact",
              dataIndex: "contact",
              key: "contact",
            },
            {
              title: "Role",
              key: "role",
              render: (_, u) => (
                <Tag color={u.role === "Host / Driver" ? "purple" : "blue"} bordered={false}>
                  {u.role}
                </Tag>
              ),
            },
            {
              title: "Detail",
              dataIndex: "detail",
              key: "detail",
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, u) => (
                <Space>
                  <Popconfirm
                    title="Grant admin access?"
                    description={`${u.name} will gain full access to this admin dashboard.`}
                    onConfirm={() => grantAdminMutation.mutate(u.userId)}
                    okText="Grant admin"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<ShieldCheck size={14} />}
                      loading={grantAdminMutation.isPending}
                    >
                      Make Admin
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
