import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, List, Avatar, Tag, Space, Button, Modal, Input, message } from "antd";
import { CheckCircle, XCircle } from "lucide-react";
import { listDriverProfiles, updateDriverVerification } from "@/data/appwrite-repository";
import type { DriverProfile, VerificationStatus } from "@/lib/domain";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<VerificationStatus, string> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export function DriversPanel() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<DriverProfile | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const verifyMutation = useMutation({
    mutationFn: ({
      driverId,
      status,
      note,
    }: {
      driverId: string;
      status: VerificationStatus;
      note?: string | null;
    }) => updateDriverVerification(driverId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
      message.success("Driver verification updated");
      setRejectTarget(null);
      setRejectNote("");
    },
    onError: (error: any) => message.error(error.message),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Driver Directory
        </Title>
        <Text type="secondary">
          Review and verify driver profiles across the network.
        </Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <List
          className="px-6"
          loading={isLoading}
          itemLayout="vertical"
          dataSource={drivers}
          locale={{ emptyText: "No drivers registered yet." }}
          renderItem={(driver) => {
            const status = driver.verificationStatus ?? "approved";
            return (
              <List.Item
                actions={[
                  <Button
                    key="approve"
                    type="text"
                    size="small"
                    icon={<CheckCircle size={14} />}
                    className="text-success"
                    disabled={status === "approved" || verifyMutation.isPending}
                    onClick={() =>
                      verifyMutation.mutate({ driverId: driver.id, status: "approved", note: null })
                    }
                  >
                    Approve
                  </Button>,
                  <Button
                    key="reject"
                    type="text"
                    size="small"
                    danger
                    icon={<XCircle size={14} />}
                    disabled={status === "rejected" || verifyMutation.isPending}
                    onClick={() => {
                      setRejectTarget(driver);
                      setRejectNote(driver.verificationNote ?? "");
                    }}
                  >
                    Reject
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar size={48} className="bg-gradient-primary">
                      {driver.fullName.charAt(0)}
                    </Avatar>
                  }
                  title={
                    <Title level={5} style={{ margin: 0 }}>
                      {driver.fullName}
                    </Title>
                  }
                  description={
                    <Space split={<Text type="secondary">·</Text>} wrap>
                      <Text type="secondary">{driver.email}</Text>
                      <Text type="secondary">{driver.phone}</Text>
                      <Text type="secondary">License: {driver.licenseNumber}</Text>
                    </Space>
                  }
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Tag color="purple" bordered={false} className="px-3 rounded-3xl">
                    {driver.city}
                  </Tag>
                  <Tag color={STATUS_COLOR[status]} bordered={false} className="capitalize px-3 rounded-3xl">
                    {status}
                  </Tag>
                  {driver.verificationNote && status === "rejected" && (
                    <Text type="danger" className="text-xs">
                      Reason: {driver.verificationNote}
                    </Text>
                  )}
                </div>
              </List.Item>
            );
          }}
        />
      </Card>

      <Modal
        title={`Reject ${rejectTarget?.fullName ?? "driver"}`}
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={() =>
          rejectTarget &&
          verifyMutation.mutate({
            driverId: rejectTarget.id,
            status: "rejected",
            note: rejectNote.trim() || null,
          })
        }
        confirmLoading={verifyMutation.isPending}
        okText="Reject driver"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Reason for rejection (shown to the driver)"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}
