import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Table, Tag, Space, Button, Select, Modal, Form, Input, message } from "antd";
import { CheckCircle2, XCircle, Clock3 } from "lucide-react";
import {
  listAllPayoutRequests,
  listDriverProfiles,
  updatePayoutRequestStatus,
} from "@/data/appwrite-repository";
import type { PayoutRequest, PayoutStatus } from "@/lib/domain";

const { Title, Text } = Typography;

const STATUS_COLORS: Record<PayoutStatus, string> = {
  pending: "warning",
  processing: "processing",
  paid: "success",
  rejected: "error",
};

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `••••${accountNumber.slice(-4)}`;
}

export function PayoutsPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "all">("all");
  const [actionRequest, setActionRequest] = useState<PayoutRequest | null>(null);
  const [actionType, setActionType] = useState<"paid" | "rejected" | null>(null);
  const [form] = Form.useForm<{ paymentReference?: string; adminNote?: string }>();

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["admin-payout-requests"],
    queryFn: () => listAllPayoutRequests(500),
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: listDriverProfiles,
  });

  const driverNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    drivers.forEach((d) => map.set(d.userId, d.fullName));
    return map;
  }, [drivers]);

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      status: PayoutStatus;
      paymentReference?: string;
      adminNote?: string;
    }) =>
      updatePayoutRequestStatus(vars.id, {
        status: vars.status,
        paymentReference: vars.paymentReference,
        adminNote: vars.adminNote,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-payout-requests"] });
      message.success("Payout request updated.");
      setActionRequest(null);
      setActionType(null);
      form.resetFields();
    },
    onError: (error: any) => message.error(error.message || "Failed to update payout request."),
  });

  const processingMutation = useMutation({
    mutationFn: (id: string) => updatePayoutRequestStatus(id, { status: "processing" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-payout-requests"] });
      message.success("Marked as processing.");
    },
    onError: (error: any) => message.error(error.message || "Failed to update payout request."),
  });

  const filteredRequests =
    statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);

  const totalPending = requests
    .filter((r) => r.status === "pending" || r.status === "processing")
    .reduce((sum, r) => sum + r.amount, 0);

  const totalPaid = requests
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + r.amount, 0);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const openAction = (record: PayoutRequest, type: "paid" | "rejected") => {
    setActionRequest(record);
    setActionType(type);
    form.resetFields();
  };

  const submitAction = (values: { paymentReference?: string; adminNote?: string }) => {
    if (!actionRequest || !actionType) return;
    updateMutation.mutate({
      id: actionRequest.id,
      status: actionType,
      paymentReference: values.paymentReference,
      adminNote: values.adminNote,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Payouts
        </Title>
        <Text type="secondary">
          Review payout requests from hosts/drivers and mark them as paid once you've sent the
          money manually.
        </Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Pending requests</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            {pendingCount}
          </Title>
        </Card>
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Pending + processing amount</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            ₹{totalPending.toLocaleString("en-IN")}
          </Title>
        </Card>
        <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md">
          <Text type="secondary">Total paid out</Text>
          <Title level={3} style={{ margin: "4px 0" }}>
            ₹{totalPaid.toLocaleString("en-IN")}
          </Title>
        </Card>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md p-2 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <Text strong>Payout requests</Text>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "processing", label: "Processing" },
              { value: "paid", label: "Paid" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          loading={requestsLoading || driversLoading}
          dataSource={filteredRequests}
          locale={{ emptyText: "No payout requests yet." }}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Driver/Host",
              key: "driver",
              render: (_, r) => (
                <Text strong>{driverNameByUserId.get(r.driverUserId) || "Unknown"}</Text>
              ),
            },
            {
              title: "Amount",
              dataIndex: "amount",
              key: "amount",
              render: (amount: number) => `₹${amount.toLocaleString("en-IN")}`,
            },
            {
              title: "Bank details",
              key: "bank",
              render: (_, r) => (
                <div className="text-sm">
                  <div>{r.accountHolderName}</div>
                  <div className="text-muted-foreground">
                    {maskAccountNumber(r.accountNumber)} · {r.ifscCode}
                  </div>
                  {r.upiId && <div className="text-muted-foreground">UPI: {r.upiId}</div>}
                </div>
              ),
            },
            {
              title: "Requested",
              dataIndex: "requestedAt",
              key: "requestedAt",
              render: (date: string) => new Date(date).toLocaleString("en-IN"),
            },
            {
              title: "Status",
              key: "status",
              render: (_, r) => (
                <div className="flex flex-col gap-1">
                  <Tag color={STATUS_COLORS[r.status]} bordered={false} className="capitalize w-fit">
                    {r.status}
                  </Tag>
                  {r.paymentReference && (
                    <Text type="secondary" className="text-xs">
                      Ref: {r.paymentReference}
                    </Text>
                  )}
                  {r.adminNote && (
                    <Text type="secondary" className="text-xs">
                      Note: {r.adminNote}
                    </Text>
                  )}
                </div>
              ),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, r) =>
                r.status === "pending" || r.status === "processing" ? (
                  <Space direction="vertical" size="small">
                    {r.status === "pending" && (
                      <Button
                        size="small"
                        icon={<Clock3 size={14} />}
                        loading={processingMutation.isPending}
                        onClick={() => processingMutation.mutate(r.id)}
                      >
                        Mark Processing
                      </Button>
                    )}
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => openAction(r, "paid")}
                    >
                      Mark Paid
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<XCircle size={14} />}
                      onClick={() => openAction(r, "rejected")}
                    >
                      Reject
                    </Button>
                  </Space>
                ) : (
                  <Text type="secondary">
                    {r.processedAt ? new Date(r.processedAt).toLocaleDateString("en-IN") : "—"}
                  </Text>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={!!actionRequest}
        title={actionType === "paid" ? "Mark payout as paid" : "Reject payout request"}
        onCancel={() => {
          setActionRequest(null);
          setActionType(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={submitAction} className="mt-4">
          {actionType === "paid" && (
            <Form.Item
              label="Payment reference (UTR / Transaction ID)"
              name="paymentReference"
              rules={[{ required: true, message: "Enter the transfer reference number" }]}
            >
              <Input placeholder="e.g. 308812345678" />
            </Form.Item>
          )}
          <Form.Item label="Note (optional)" name="adminNote">
            <Input.TextArea
              rows={3}
              placeholder={
                actionType === "paid" ? "Any internal notes…" : "Reason for rejecting this request"
              }
            />
          </Form.Item>
          <Button
            type="primary"
            danger={actionType === "rejected"}
            htmlType="submit"
            loading={updateMutation.isPending}
            block
          >
            {actionType === "paid" ? "Confirm Paid" : "Confirm Reject"}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
