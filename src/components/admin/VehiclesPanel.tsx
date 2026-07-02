import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Space, Button, Modal, Input, message } from "antd";
import { CheckCircle, XCircle, FileText } from "lucide-react";
import { listAllVehicles, listDriverProfiles } from "@/data/appwrite-repository";
import { account, appwriteConfig } from "@/integrations/appwrite/client";
import type { DriverVehicle, VerificationStatus } from "@/lib/domain";
import { adminUpdateVehicleVerification } from "@/integrations/appwrite/account-server";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<VerificationStatus, string> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

function docUrl(fileId: string): string {
  const { endpoint, projectId, driverDocsBucketId } = appwriteConfig;
  return `${endpoint}/storage/buckets/${driverDocsBucketId}/files/${fileId}/view?project=${projectId}`;
}

export function VehiclesPanel() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<DriverVehicle | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: listAllVehicles,
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const driverByUserId = new Map(drivers.map((d) => [d.userId, d]));

  const verifyMutation = useMutation({
    mutationFn: async ({
      vehicleId,
      status,
      note,
    }: {
      vehicleId: string;
      status: "approved" | "rejected";
      note?: string | null;
    }) => {
      const { jwt } = await account.createJWT();
      await adminUpdateVehicleVerification({ data: { jwt, vehicleId, status, note } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vehicles"] });
      message.success("Vehicle verification updated");
      setRejectTarget(null);
      setRejectNote("");
    },
    onError: (error: any) => message.error(error.message),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Vehicle Manager
        </Title>
        <Text type="secondary">
          Review registration & insurance documents and verify vehicles.
        </Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <Table
          rowKey="id"
          loading={vehiclesLoading || driversLoading}
          dataSource={vehicles}
          locale={{ emptyText: "No vehicles registered yet." }}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Vehicle",
              key: "vehicle",
              render: (_, v) => (
                <div>
                  <Text strong>{v.modelName}</Text>
                  <div className="text-xs text-muted-foreground">
                    {v.plateNumber} {v.color ? `· ${v.color}` : ""} · {v.seatCapacity} seats
                  </div>
                </div>
              ),
            },
            {
              title: "Driver",
              key: "driver",
              render: (_, v) => {
                const driver = driverByUserId.get(v.driverUserId);
                return driver ? (
                  <div>
                    <Text>{driver.fullName}</Text>
                    <div className="text-xs text-muted-foreground">{driver.phone}</div>
                  </div>
                ) : (
                  <Text type="secondary">Unknown</Text>
                );
              },
            },
            {
              title: "Documents",
              key: "docs",
              render: (_, v) => (
                <Space direction="vertical" size={2}>
                  {v.registrationDoc ? (
                    <a href={docUrl(v.registrationDoc)} target="_blank" rel="noreferrer">
                      <FileText size={12} className="inline mr-1" />
                      Registration
                    </a>
                  ) : (
                    <Text type="secondary" className="text-xs">
                      No registration doc
                    </Text>
                  )}
                  {v.insuranceDoc ? (
                    <a href={docUrl(v.insuranceDoc)} target="_blank" rel="noreferrer">
                      <FileText size={12} className="inline mr-1" />
                      Insurance
                    </a>
                  ) : (
                    <Text type="secondary" className="text-xs">
                      No insurance doc
                    </Text>
                  )}
                </Space>
              ),
            },
            {
              title: "Status",
              key: "status",
              render: (_, v) => {
                const status = v.verificationStatus ?? "approved";
                return (
                  <div>
                    <Tag color={STATUS_COLOR[status]} bordered={false} className="capitalize px-3 rounded-3xl">
                      {status}
                    </Tag>
                    {v.verificationNote && status === "rejected" && (
                      <div className="text-xs text-rose-500 mt-1">{v.verificationNote}</div>
                    )}
                  </div>
                );
              },
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, v) => {
                const status = v.verificationStatus ?? "approved";
                return (
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckCircle size={14} />}
                      className="text-success"
                      disabled={status === "approved" || verifyMutation.isPending}
                      onClick={() =>
                        verifyMutation.mutate({ vehicleId: v.id, status: "approved", note: null })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<XCircle size={14} />}
                      disabled={status === "rejected" || verifyMutation.isPending}
                      onClick={() => {
                        setRejectTarget(v);
                        setRejectNote(v.verificationNote ?? "");
                      }}
                    >
                      Reject
                    </Button>
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>

      <Modal
        title={`Reject ${rejectTarget?.modelName ?? "vehicle"}`}
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={() =>
          rejectTarget &&
          verifyMutation.mutate({
            vehicleId: rejectTarget.id,
            status: "rejected",
            note: rejectNote.trim() || null,
          })
        }
        confirmLoading={verifyMutation.isPending}
        okText="Reject vehicle"
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
