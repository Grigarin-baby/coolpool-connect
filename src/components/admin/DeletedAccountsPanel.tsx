import { useQuery } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Empty } from "antd";
import dayjs from "dayjs";
import { listDeletedAccounts } from "@/data/appwrite-repository";
import type { DeletedAccount } from "@/lib/domain";

const { Title, Text } = Typography;

export function DeletedAccountsPanel() {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["admin-deleted-accounts"],
    queryFn: listDeletedAccounts,
  });

  const columns = [
    {
      title: "Name",
      dataIndex: "fullName",
      key: "fullName",
      render: (v: string) => <span className="font-semibold">{v || "—"}</span>,
    },
    { title: "Phone", dataIndex: "phone", key: "phone", render: (v: string) => v || "—" },
    { title: "Email", dataIndex: "email", key: "email", render: (v: string) => v || "—" },
    {
      title: "Roles",
      dataIndex: "roles",
      key: "roles",
      render: (v: string) =>
        v
          ? v.split(",").filter(Boolean).map((r) => (
              <Tag key={r} color="purple" className="rounded-full">
                {r}
              </Tag>
            ))
          : "—",
    },
    {
      title: "User ID (for record lookup)",
      dataIndex: "userId",
      key: "userId",
      render: (v: string) => <span className="font-mono text-xs text-gray-500">{v}</span>,
    },
    {
      title: "Deleted",
      dataIndex: "deletedAt",
      key: "deletedAt",
      render: (v: string) => (v ? dayjs(v).format("MMM D, YYYY h:mm A") : "—"),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Deleted Accounts
        </Title>
        <Text type="secondary">
          Users who deleted their login. Their trips, vehicles and bookings are retained under the
          listed User ID for your records — the user can no longer sign in or see this data.
        </Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md overflow-hidden">
        <Table<DeletedAccount>
          rowKey="id"
          loading={isLoading}
          dataSource={accounts}
          columns={columns}
          scroll={{ x: 720 }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} deleted account${t === 1 ? "" : "s"}` }}
          locale={{ emptyText: <Empty description="No deleted accounts yet" /> }}
        />
      </Card>
    </div>
  );
}
